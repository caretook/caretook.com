import type {
  ConditionStatus,
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
  recipientConditionContentZSchema,
  recipientConditionCreateZSchema,
  recipientConditionUpdateZSchema,
  recipientConditionUpsertZSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careRecipientModel, recipientConditionModel } from "../models";
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

/** Add a condition (writers). `id` may come from an offline device. Clears "No known conditions". */
export const create = (ctx: ServiceContext, input: RecipientConditionCreateInput) =>
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
    return created;
  }, ctx);

/**
 * Edit a condition's name, status, since or note (writers). What's left out
 * keeps its value; the merged condition must be valid. An edit that changes
 * nothing still succeeds.
 */
export const update = (ctx: ServiceContext, id: string, input: RecipientConditionUpdateInput) =>
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
    return updated[0] ?? null;
  }, ctx);

/** Resolve a condition, or make a resolved one active again (writers). Safe to replay. */
const setStatus = (ctx: ServiceContext, id: string, status: ConditionStatus) => update(ctx, id, { status });

/** Mark a condition resolved: it moves to Past (writers). */
export const resolve = (ctx: ServiceContext, id: string) => setStatus(ctx, id, "resolved");

/** Mark a resolved condition active again, for a recurrence (writers). */
export const reactivate = (ctx: ServiceContext, id: string) => setStatus(ctx, id, "active");

/**
 * Create the condition with this id, or bring the existing one up to date
 * (PowerSync's upload queue). Safe to replay; the group and recipient never
 * change, and a deleted condition stays deleted.
 */
export const upsert = (ctx: ServiceContext, input: RecipientConditionUpsertInput) =>
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
    if (!existing) return create({ ...ctx, tx }, input);

    const visible = await recipientConditionModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);
    if (visible.groupId !== groupId || (recipientId !== undefined && visible.recipientId !== recipientId))
      return newError({ code: "recipientConditionService:immutable" });
    if (visible.deletedAt) return visible;

    return update({ ...ctx, tx }, id, content);
  }, ctx);

/** Soft delete (writers), for a condition entered by mistake. It leaves every list. */
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
