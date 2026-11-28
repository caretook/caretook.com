import type { CareGroupInsert, CareRecipientInsert, Tx } from "../db";
import type { ServiceContext, ServiceSelectArgs, ServiceUpdateArgs } from "./types";

import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import { DEFAULT_PAGE_SIZE, SYSTEM_USER } from "../constants";
import { dbMayFail, txOrDb, withTransaction } from "../db";
import {
  careGroupInviteSchema,
  careGroupSchema,
  confirmsGroupName,
  googleCalendarConnectionSchema,
  isTimeZone,
  notificationOutboxSchema as outbox,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupMemberModel, careGroupModel, careRecipientModel } from "../models";
import { isSystemUser } from "../permissions";
import * as adminAuditService from "./adminAuditService";
import { revokeForGroup } from "./connectorGrantService";
import { disconnectForMember as disconnectGoogle } from "./googleConnectionService";
import { defaultLimit as groupLimitDefault, refusal as groupLimitRefusal } from "./groupLimitService";
import { addDefaults as addDefaultPasses } from "./medicationPassService";
import { addDefaults as addDefaultSymptoms } from "./symptomTypeService";

export const schemaName = careGroupModel.schemaName;

type K = typeof schemaName;

export type CareGroupCreateData = CareGroupInsert & {
  /** The care recipient's profile, created in the same transaction. */
  recipient?: Omit<CareRecipientInsert, "groupId">;
};

/**
 * Start a care group. The actor becomes its first owner; the recipient
 * profile, when given, is created with it. All or nothing. A member at the
 * free plan's limit is refused first (`groupLimitService:atLimit`).
 */
export const create = async (ctx: ServiceContext, { recipient, ...data }: CareGroupCreateData) => {
  // The free plan's cap (free-limits): the setting is read before the
  // transaction opens (B-1036), then checked first inside it, the user's row
  // locked until commit.
  const limited = ctx.authUser && !isSystemUser(ctx.authUser) ? ctx.authUser.id : null;
  const fallback = limited ? await groupLimitDefault() : 0;
  return withTransaction(async (tx) => {
    if (limited) {
      const atLimit = await groupLimitRefusal(tx, limited, fallback);
      if (atLimit) return atLimit;
    }
    const group = await careGroupModel.create({ ...ctx, tx, data });
    if (isError(group)) return group;
    if (!group) return { group: null, recipient: null };
    const symptoms = await addDefaultSymptoms(tx, group.id);
    if (symptoms) return symptoms;

    if (!recipient) return { group, recipient: null };
    // Where the recipient lives: the zone of the device that creates the group, unless it says otherwise.
    if (!isTimeZone(recipient.timeZone)) return newError({ code: "careRecipientService:invalidTimeZone" });

    const created = await careRecipientModel.create({
      ...ctx,
      tx,
      data: { ...recipient, groupId: group.id },
    });
    if (isError(created)) return created;
    if (created) {
      const passes = await addDefaultPasses(tx, { groupId: group.id, recipientId: created.id });
      if (passes) return passes;
    }
    return { group, recipient: created };
  }, ctx);
};

export const get = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupModel.get({ ...ctx, ...opts });

export const getById = (ctx: ServiceContext, id: string) => careGroupModel.getById(id, ctx);

export const list = (ctx: ServiceContext, opts: ServiceSelectArgs<K> = {}) =>
  careGroupModel.list({ ...ctx, ...opts, paginate: opts.paginate ?? { page: 1, limit: DEFAULT_PAGE_SIZE } });

/**
 * Update groups in the actor's scope (owners and admins, in SQL). The
 * Assistants switch (`connectorsEnabled`, connectors PRD) is owners' only,
 * one group at a time; turning it off revokes every member's connection in
 * the same transaction, and turning it on restores none. Read only
 * (`connectorsReadOnly`, assistant-access) is owners' only the same way and
 * revokes nothing.
 */
export const update = (ctx: ServiceContext, opts: ServiceUpdateArgs<K>) => {
  if (opts.data.connectorsEnabled === undefined && opts.data.connectorsReadOnly === undefined)
    return careGroupModel.update({ ...ctx, ...opts });
  const target = opts.filter?.id;
  const groupId = target && "value" in target && target.type === "eq" ? target.value : undefined;
  if (typeof groupId !== "string")
    return Promise.resolve(newError({ code: "careGroupService:connectorsOwnerOnly" }));

  return withTransaction(async (tx) => {
    if (!isSystemUser(ctx.authUser)) {
      const role = ctx.authUser ? await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx }) : null;
      if (isError(role)) return role;
      if (role !== "owner") return newError({ code: "careGroupService:connectorsOwnerOnly" });
    }
    const updated = await careGroupModel.update({ ...ctx, ...opts, tx });
    if (isError(updated)) return updated;
    if (opts.data.connectorsEnabled === false) {
      const revoked = await revokeForGroup(tx, groupId);
      if (isError(revoked)) return revoked;
    }
    return updated;
  }, ctx);
};

const dbFails = <T>(run: () => PromiseLike<T>) => dbMayFail(run, "careGroupService:db");

/**
 * The group's mail still waiting to go: skipped (`groupDeleted`), never
 * sent. The outbox keeps no group id, so a row is the group's by what it
 * carries: a reminder's key (`reminder:<user>:<group>:…`), a link into the
 * group (`/app/groups/<id>`: join requests, assistants, staff changes,
 * reminders), or an invite of the group's (`groupInvite:<id>:…`,
 * `ownerInvite:<id>:…`). Inside `tx`, before the invites cascade away.
 */
const skipGroupMail = (tx: Tx, groupId: string) =>
  dbFails(async () => {
    const db = txOrDb(tx);
    const invites = await db
      .select({ id: careGroupInviteSchema.id })
      .from(careGroupInviteSchema)
      .where(eq(careGroupInviteSchema.groupId, groupId));
    const inviteKeys = invites.flatMap(({ id }) => [
      like(outbox.idempotencyKey, `groupInvite:${id}:%`),
      like(outbox.idempotencyKey, `ownerInvite:${id}:%`),
    ]);
    await db
      .update(outbox)
      .set({ status: "skipped", lastError: "groupDeleted", updatedBy: SYSTEM_USER.id, updatedAt: sql`now()` })
      .where(
        and(
          eq(outbox.status, "pending"),
          or(
            like(outbox.idempotencyKey, `reminder:%:${groupId}:%`),
            sql`position(${`/app/groups/${groupId}`} in ${outbox.text}) > 0`,
            ...inviteKeys,
          ),
        ),
      );
    return null;
  });

/** Who has a live Google connection in the group. */
const googleMembers = (tx: Tx, groupId: string) =>
  dbFails(async () => {
    const rows = await txOrDb(tx)
      .selectDistinct({ userId: googleCalendarConnectionSchema.userId })
      .from(googleCalendarConnectionSchema)
      .where(
        and(
          eq(googleCalendarConnectionSchema.groupId, groupId),
          isNull(googleCalendarConnectionSchema.disconnectedAt),
        ),
      );
    return rows.map((row) => row.userId);
  });

/**
 * Delete `groupId` inside `tx`, as the system (data-rights; account
 * deletion reuses it): every assistant grant revoked, every member's Google
 * connection disconnected (revoked at Google after commit, logged, never
 * blocking), the group's waiting mail skipped, `group.deleted` in the audit
 * log (`actorId`, the bare group id, no content), then the group itself:
 * everything in it cascades except the evidence (consent, legal acceptance,
 * the audit log). The caller has locked the group and checked who may.
 */
export const deleteGroup = async (
  tx: Tx,
  { groupId, actorId }: { groupId: string; actorId: string | null },
) => {
  const revoked = await revokeForGroup(tx, groupId);
  if (isError(revoked)) return revoked;
  const connected = await googleMembers(tx, groupId);
  if (isError(connected)) return connected;
  for (const userId of connected) {
    const unsynced = await disconnectGoogle(tx, groupId, userId);
    if (unsynced) return unsynced;
  }
  const skipped = await skipGroupMail(tx, groupId);
  if (skipped) return skipped;
  const audited = await adminAuditService.record(tx, {
    actorId,
    action: "group.deleted",
    targetGroupId: groupId,
  });
  if (isError(audited)) return audited;
  const removed = await careGroupModel.remove({
    authUser: SYSTEM_USER,
    tx,
    filter: { id: { type: "eq", value: groupId } },
  });
  if (isError(removed)) return removed;
  return { groupId };
};

/**
 * An owner deletes their care group, typing its name to confirm
 * (`confirmsGroupName`). One transaction: the group locked, the actor's
 * role and the name checked, then `deleteGroup`. A non-member gets
 * `notFound`, any other member `ownerOnly`, a wrong name `wrongName`.
 */
export const remove = (
  ctx: ServiceContext,
  { groupId, confirmName }: { groupId: string; confirmName: string },
) =>
  withTransaction(async (tx) => {
    if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
    const locked = await dbFails(() =>
      txOrDb(tx)
        .select({ name: careGroupSchema.name })
        .from(careGroupSchema)
        .where(eq(careGroupSchema.id, groupId))
        .for("update"),
    );
    if (isError(locked)) return locked;
    const [group] = locked;
    if (!group) return newError({ code: "careGroupService:notFound" });
    if (!isSystemUser(ctx.authUser)) {
      const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
      if (isError(role)) return role;
      if (!role) return newError({ code: "careGroupService:notFound" });
      if (role !== "owner") return newError({ code: "careGroupService:ownerOnly" });
    }
    if (!confirmsGroupName(confirmName, group.name)) return newError({ code: "careGroupService:wrongName" });
    return deleteGroup(tx, { groupId, actorId: isSystemUser(ctx.authUser) ? null : ctx.authUser.id });
  }, ctx);

export const upsert = (ctx: ServiceContext, data: CareGroupInsert) => careGroupModel.upsert({ ...ctx, data });
