import type {
  ConditionStatus,
  RecipientCondition,
  RecipientConditionCreateInput,
  RecipientConditionUpdateInput,
  RecipientConditionUpsertInput,
  Tx,
} from "../db";
import type { IncludeDeleted } from "../models/recipientCondition";
import type { ServiceContext } from "./types";

import { z } from "zod";
import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  conditionChange,
  conditionChangeId,
  recipientConditionContentZSchema,
  recipientConditionCreateZSchema,
  recipientConditionUpdateZSchema,
  recipientConditionUpsertZSchema,
  timelineEntryContentZSchema,
  toChangeTime,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careRecipientModel, recipientConditionModel, timelineEntryModel } from "../models";
import { rejectError } from "../permissions";
import { resolveRecipient } from "./medicationService";

// The care recipient's conditions (conditions PRD). Write through here, not
// the model: content is validated here, and adding a condition clears "No
// known conditions" (`care_recipient.no_known_conditions_at`) in the same
// transaction. Every write runs in one transaction that has the condition
// before and after, so what a change also writes (its timeline entry, its
// links) goes in beside it.

export const serviceName = "recipientCondition";
export const schemaName = recipientConditionModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "recipientConditionService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const notFound = () => newError({ code: "recipientConditionService:notFound" });

/**
 * When a save happened, for its change entry (as `MedicationWriteOptions`):
 * a device passes its row's `updated_at`, so the entry it wrote locally and
 * the one written here get the same derived id; without one, it's now.
 */
export type ConditionWriteOptions = { changedAt?: string | null };

const changeTimeOf = (opts: ConditionWriteOptions) =>
  (opts.changedAt ? toChangeTime(opts.changedAt) : null) ?? new Date().toISOString();

/**
 * Record what a save did on the timeline, as the actor: one
 * `conditionChange` entry for a new condition, a resolve or reactivate, or
 * an edit to a tracked field (name, since, note); none for a save that
 * changed none of them. Its id comes from the condition and `changedAt`, so
 * a replay (or the device's own copy of the entry, uploaded next) lands on
 * the same row and changes nothing. In the recipient's time zone.
 */
const writeChange = async (
  ctx: ServiceContext,
  tx: Tx,
  {
    before,
    after,
    changedAt,
  }: { before: Parameters<typeof conditionChange>[0]; after: RecipientCondition; changedAt: string },
) => {
  const change = conditionChange(before, after);
  if (!change) return null;

  const id = conditionChangeId(after.id, changedAt);
  const existing = await timelineEntryModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
  if (isError(existing)) return existing;
  if (existing) return existing;

  // Read as the system: the actor could already write the condition.
  const recipient = await careRecipientModel.getById(after.recipientId, { authUser: SYSTEM_USER, tx });
  if (isError(recipient)) return recipient;
  const timeZone = recipient?.timeZone ?? "UTC";

  const content = timelineEntryContentZSchema.safeParse({
    kind: "conditionChange",
    occurredAt: changedAt,
    timeZone,
    details: { conditionId: after.id, ...change },
  });
  if (!content.success) return invalid(content.error);

  return timelineEntryModel.create({
    ...ctx,
    tx,
    data: {
      id,
      groupId: after.groupId,
      recipientId: after.recipientId,
      kind: "conditionChange",
      occurredAt: changedAt,
      timeZone,
      title: null,
      body: null,
      details: content.data.details ?? null,
    },
  });
};

/** A condition on file means the recipient no longer has "No known conditions". As the system. */
const clearNoKnownConditions = async (tx: Tx, recipientId: string) => {
  const res = await careRecipientModel.update({
    authUser: SYSTEM_USER,
    tx,
    filter: { id: { type: "eq", value: recipientId }, noKnownConditionsAt: { type: "isNotNull" } },
    data: { noKnownConditionsAt: null },
  });
  return isError(res) && res.code !== "baseModel:update:nothingUpdated" ? res : null;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getById = (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) =>
  recipientConditionModel.getById(id, { ...ctx, ...opts });

/** A group's conditions, by name (screens order them by status and since). */
export const list = (ctx: ServiceContext, { groupId, ...opts }: IncludeDeleted & { groupId: string }) =>
  recipientConditionModel.list({ ...ctx, ...opts, filter: { groupId: { type: "eq", value: groupId } } });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Add a condition (writers), and its "added" entry on the timeline. `id` may
 * come from an offline device. Clears "No known conditions".
 */
export const create = (
  ctx: ServiceContext,
  input: RecipientConditionCreateInput,
  opts: ConditionWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = recipientConditionCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { recipientId, ...data } = parsed.data;

    const recipient = await resolveRecipient(ctx, tx, data.groupId, recipientId);
    if (isError(recipient)) return recipient;

    const created = await recipientConditionModel.create({
      ...ctx,
      tx,
      data: { ...data, recipientId: recipient.id },
    });
    if (isError(created) || !created) return created;
    const cleared = await clearNoKnownConditions(tx, recipient.id);
    if (cleared) return cleared;
    const change = await writeChange(ctx, tx, {
      before: null,
      after: created,
      changedAt: changeTimeOf(opts),
    });
    if (isError(change)) return change;
    return created;
  }, ctx);

/**
 * Edit a condition's name, status, since or note (writers). What's left out
 * keeps its value; the merged condition must be valid. An edit that changes
 * nothing still succeeds (and records nothing); one that does records its
 * `conditionChange` entry (see `writeChange`).
 */
export const update = (
  ctx: ServiceContext,
  id: string,
  input: RecipientConditionUpdateInput,
  opts: ConditionWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = recipientConditionUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const before = await recipientConditionModel.getById(id, { ...ctx, tx });
    if (isError(before)) return before;
    if (!before) return notFound();

    const merged = recipientConditionContentZSchema.safeParse({ ...before, ...patch });
    if (!merged.success) return invalid(merged.error);

    const updated = await recipientConditionModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: merged.data,
    });
    if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
      return rejectError(ctx.authUser);
    if (isError(updated)) return updated;
    const after = updated[0];
    if (!after) return null;

    const change = await writeChange(ctx, tx, {
      before,
      after,
      changedAt: changeTimeOf(opts),
    });
    if (isError(change)) return change;
    return after;
  }, ctx);

/** Resolve a condition, or make a resolved one active again (writers). Safe to replay. */
const setStatus = (ctx: ServiceContext, id: string, status: ConditionStatus, opts: ConditionWriteOptions) =>
  update(ctx, id, { status }, opts);

/** Mark a condition resolved: it moves to Past (writers). */
export const resolve = (ctx: ServiceContext, id: string, opts: ConditionWriteOptions = {}) =>
  setStatus(ctx, id, "resolved", opts);

/** Mark a resolved condition active again, for a recurrence (writers). */
export const reactivate = (ctx: ServiceContext, id: string, opts: ConditionWriteOptions = {}) =>
  setStatus(ctx, id, "active", opts);

/**
 * Create the condition with this id, or bring the existing one up to date
 * (PowerSync's upload queue). Safe to replay; the group and recipient never
 * change, and a deleted condition stays deleted. A replay records no second
 * change entry.
 */
export const upsert = (
  ctx: ServiceContext,
  input: RecipientConditionUpsertInput,
  opts: ConditionWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = recipientConditionUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId, ...content } = parsed.data;

    const existing = await recipientConditionModel.getById(id, {
      authUser: SYSTEM_USER,
      tx,
      includeDeleted: true,
    });
    if (isError(existing)) return existing;
    if (!existing) return create({ ...ctx, tx }, input, opts);

    const visible = await recipientConditionModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);
    if (visible.groupId !== groupId || (recipientId !== undefined && visible.recipientId !== recipientId))
      return newError({ code: "recipientConditionService:immutable" });
    if (visible.deletedAt) return visible;

    return update({ ...ctx, tx }, id, content, opts);
  }, ctx);

/** Soft delete (writers), for a condition entered by mistake. It leaves every list; no change entry. */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const res = await recipientConditionModel.remove({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
    });
    if (!isError(res) || res.code !== "baseModel:remove:nothingRemoved") return res;
    const visible = await recipientConditionModel.getById(id, { ...ctx, tx });
    if (isError(visible)) return visible;
    return visible ? rejectError(ctx.authUser) : notFound();
  }, ctx);

// ---------------------------------------------------------------------------
// "No known conditions" (`care_recipient.no_known_conditions_at`)
// ---------------------------------------------------------------------------

const noKnownAtZSchema = z.iso.datetime({ offset: true }).nullable();

/**
 * Record "No known conditions" (a time) or clear it (null). Permission is
 * care_recipient's update rule (writers). Recording it while live
 * conditions (active or resolved) are on file is refused: the list would
 * contradict itself. Safe to replay.
 */
export const setNoKnownConditions = (ctx: ServiceContext, recipientId: string, at: string | null) =>
  withTransaction(async (tx) => {
    const parsed = noKnownAtZSchema.safeParse(at);
    if (!parsed.success) return newError({ code: "recipientConditionService:invalidNoKnown" });

    const recipient = await careRecipientModel.getById(recipientId, { ...ctx, tx });
    if (isError(recipient)) return recipient;
    if (!recipient) return rejectError(ctx.authUser);

    if (parsed.data) {
      const conditions = await recipientConditionModel.list({
        authUser: SYSTEM_USER,
        tx,
        filter: { recipientId: { type: "eq", value: recipientId } },
      });
      if (isError(conditions)) return conditions;
      if (conditions.data.length) return newError({ code: "recipientConditionService:hasConditions" });
    }

    const updated = await careRecipientModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: recipientId } },
      data: { noKnownConditionsAt: parsed.data },
    });
    if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
      return rejectError(ctx.authUser);
    if (isError(updated)) return updated;
    return updated[0] ?? null;
  }, ctx);
