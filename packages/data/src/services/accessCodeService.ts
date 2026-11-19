import type { Tx } from "../db";
import type { AccessCodeCreateInput, NewCareGroupInput } from "../db/schema";
import type { ServiceContext } from "./types";

import { randomBytes } from "node:crypto";
import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  auditChanges,
  codeState,
  formatAccessCode,
  newCareGroupZSchema,
  normalizeAccessCode,
  resolveNewCareGroup,
} from "../db/schema";
import { isError, newError } from "../errors";
import { accessCodeModel, accessCodeRedemptionModel, careGroupModel, careRecipientModel } from "../models";
import * as adminAuditService from "./adminAuditService";
import { signupRefusal } from "./appSettingService";
import { auditActorId, staffRefusal } from "./staffAccess";
import { addDefaults as addDefaultPasses } from "./medicationPassService";

export const serviceName = "accessCode";
export const schemaName = accessCodeModel.schemaName;

// Access codes (invites slice 5): staff make them, print them, and revoke
// them; anyone holding one may ask whether it works and use it to create an
// account and their own care group (`redeem`, inside signUpWithTicket's
// transaction). Codes are stored as printed (see db/schema/accessCode.ts).
// Staff writes (create, revoke) need `accessCodes.write` and record an
// audit entry in their own transaction.

const system = (tx?: Tx) => ({ authUser: SYSTEM_USER, tx });
const DAY_MS = 24 * 60 * 60 * 1000;
const ATTEMPTS = 5;

/** Staff: every code, newest first, with how many times each was used. */
export const list = async (ctx: ServiceContext) => {
  const page = await accessCodeModel.list({ ...ctx, paginate: { page: 1, limit: 200 } });
  if (isError(page)) return page;
  return page.data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const getById = (ctx: ServiceContext, id: string) => accessCodeModel.getById(id, ctx);

/** What an access code's audit entries record. */
const AUDIT_FIELDS = ["code", "label", "expiresAt", "maxUses", "revokedAt"] as const;

/** Staff (`accessCodes.write`): a new code with a label, an expiry and an optional maximum number of uses. */
export const create = (ctx: ServiceContext, input: AccessCodeCreateInput) =>
  withTransaction(async (tx) => {
    const refused = staffRefusal(ctx, "accessCodes.write");
    if (refused) return refused;
    const expiresAt = new Date(Date.now() + input.expiresInDays * DAY_MS).toISOString();
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const code = formatAccessCode(randomBytes(8));
      const taken = await accessCodeModel.getByCode(code, { tx });
      if (isError(taken)) return taken;
      if (taken) continue;
      const created = await accessCodeModel.create({
        ...ctx,
        tx,
        data: { code, label: input.label.trim(), expiresAt, maxUses: input.maxUses ?? null },
      });
      if (isError(created)) return created;
      if (!created) return newError({ code: "baseModel:create:nothingCreated" });
      const recorded = await adminAuditService.record(tx, {
        actorId: auditActorId(ctx),
        action: "accessCode.create",
        changes: auditChanges(null, created, AUDIT_FIELDS),
      });
      if (isError(recorded)) return recorded;
      return created;
    }
    return newError({ code: "accessCodeService:noUniqueCode" });
  }, ctx);

/** Staff (`accessCodes.write`): stop a code working at once. Revoking twice keeps the first time (and records once). */
export const revoke = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const refused = staffRefusal(ctx, "accessCodes.write");
    if (refused) return refused;
    const current = await accessCodeModel.getById(id, { ...ctx, tx });
    if (isError(current)) return current;
    if (!current) return newError({ code: "accessCodeService:notFound" });
    if (current.revokedAt) return current;
    const updated = await accessCodeModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: { revokedAt: new Date().toISOString() },
    });
    if (isError(updated)) return updated;
    const row = updated[0];
    if (!row) return newError({ code: "accessCodeService:notFound" });
    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action: "accessCode.revoke",
      changes: { ...auditChanges(current, row, AUDIT_FIELDS), code: [current.code, row.code] },
    });
    if (isError(recorded)) return recorded;
    return row;
  }, ctx);

/**
 * What anyone holding `input` may know: whether it works (and nothing
 * else: not its label, uses or who made it). `notFound` for a code that
 * matches nothing or isn't code-shaped; `unavailable` for every code while
 * access-code sign-up is switched off.
 */
export const preview = async (input: string) => {
  // Access-code sign-up switched off (admin settings): every code says so alike.
  if (await signupRefusal("accessCodes")) return { state: "unavailable" as const };
  const code = normalizeAccessCode(input);
  if (!code) return { state: "notFound" as const };
  const row = await accessCodeModel.getByCode(code);
  if (isError(row)) return row;
  if (!row) return { state: "notFound" as const };
  return { state: codeState({ code: row }), code: row.code };
};

/**
 * The code's row and the parsed group, or why `redeem` refuses them: an
 * unknown code, one that can't be used (expired, revoked, used up), or a bad
 * group. With `tx` and `lock`, the code is locked `FOR UPDATE`.
 */
const checkTicket = async (
  input: string,
  group: NewCareGroupInput,
  opts: { tx?: Tx; lock?: boolean } = {},
) => {
  const closed = await signupRefusal("accessCodes");
  if (closed) return closed;
  const code = normalizeAccessCode(input);
  if (!code) return newError({ code: "accessCodeService:notFound" });
  const row = await accessCodeModel.getByCode(code, opts);
  if (isError(row)) return row;
  if (!row) return newError({ code: "accessCodeService:notFound" });
  const state = codeState({ code: row });
  if (state !== "usable") return newError({ code: "accessCodeService:unusable", meta: { state } });

  const parsed = newCareGroupZSchema.safeParse(group);
  if (!parsed.success) {
    return newError({
      code: "accessCodeService:invalid",
      meta: { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    });
  }
  return { row, group: parsed.data };
};

/**
 * What `redeem` would refuse, without using the code (null when it would
 * go through). Sign-up refuses an address that already has an account the
 * same way as a new one (B-67), then creates nothing.
 */
export const refusal = async (input: string, group: NewCareGroupInput) => {
  const checked = await checkTicket(input, group);
  return isError(checked) ? checked : null;
};

/**
 * Use a code to start `userId`'s care group, inside the caller's
 * transaction (sign-up's, so the account, the group and the redemption
 * commit together). As the system: the code locked `FOR UPDATE` and checked,
 * the group with its recipient and `userId` as owner, one more use, and the
 * redemption recorded. Returns the new group's id.
 */
export const redeem = async (
  tx: Tx,
  { code: input, userId, group }: { code: string; userId: string; group: NewCareGroupInput },
) => {
  const checked = await checkTicket(input, group, { tx, lock: true });
  if (isError(checked)) return checked;
  const { row, group: parsed } = checked;
  const { name, recipient } = resolveNewCareGroup(parsed);

  const created = await careGroupModel.create({ ...system(tx), ownerId: userId, data: { name } });
  if (isError(created)) return created;
  if (!created) return newError({ code: "baseModel:create:nothingCreated" });
  const recipientRow = await careRecipientModel.create({
    ...system(tx),
    data: { ...recipient, groupId: created.id },
  });
  if (isError(recipientRow)) return recipientRow;
  if (!recipientRow) return newError({ code: "baseModel:create:nothingCreated" });
  const passes = await addDefaultPasses(tx, { groupId: created.id, recipientId: recipientRow.id });
  if (passes) return passes;

  const counted = await accessCodeModel.countUse(row.id, tx);
  if (isError(counted)) return counted;
  const redemption = await accessCodeRedemptionModel.create({
    ...system(tx),
    data: { codeId: row.id, userId, groupId: created.id },
  });
  if (isError(redemption)) return redemption;
  return { groupId: created.id, codeId: row.id };
};
