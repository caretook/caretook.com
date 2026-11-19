import type { z } from "zod";
import type {
  RecipientAllergyCreateInput,
  RecipientAllergyUpdateInput,
  RecipientAllergyUpsertInput,
  Tx,
} from "../db";
import type { IncludeDeleted } from "../models/recipientAllergy";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  recipientAllergyContentZSchema,
  recipientAllergyCreateZSchema,
  recipientAllergyUpdateZSchema,
  recipientAllergyUpsertZSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careRecipientModel, recipientAllergyModel } from "../models";
import { rejectError } from "../permissions";
import { resolveRecipient } from "./medicationService";

// The care recipient's allergies. Write through here, not the model: content
// is validated here, and adding an allergy clears "No known allergies"
// (`care_recipient.no_known_allergies_at`) in the same transaction.

export const serviceName = "recipientAllergy";
export const schemaName = recipientAllergyModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "recipientAllergyService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const notFound = () => newError({ code: "recipientAllergyService:notFound" });

/** An allergy on file means the recipient no longer has "No known allergies". As the system. */
const clearNoKnownAllergies = async (tx: Tx, recipientId: string) => {
  const res = await careRecipientModel.update({
    authUser: SYSTEM_USER,
    tx,
    filter: { id: { type: "eq", value: recipientId }, noKnownAllergiesAt: { type: "isNotNull" } },
    data: { noKnownAllergiesAt: null },
  });
  return isError(res) && res.code !== "baseModel:update:nothingUpdated" ? res : null;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getById = (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) =>
  recipientAllergyModel.getById(id, { ...ctx, ...opts });

/** A group's allergies, by substance. */
export const list = (ctx: ServiceContext, { groupId, ...opts }: IncludeDeleted & { groupId: string }) =>
  recipientAllergyModel.list({ ...ctx, ...opts, filter: { groupId: { type: "eq", value: groupId } } });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Add an allergy (writers). `id` may come from an offline device. Clears "No known allergies". */
export const create = (ctx: ServiceContext, input: RecipientAllergyCreateInput) =>
  withTransaction(async (tx) => {
    const parsed = recipientAllergyCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { recipientId, ...data } = parsed.data;

    const recipient = await resolveRecipient(ctx, tx, data.groupId, recipientId);
    if (isError(recipient)) return recipient;

    const created = await recipientAllergyModel.create({
      ...ctx,
      tx,
      data: { ...data, recipientId: recipient.id },
    });
    if (isError(created) || !created) return created;
    const cleared = await clearNoKnownAllergies(tx, recipient.id);
    if (cleared) return cleared;
    return created;
  }, ctx);

/** Edit an allergy's substance, reaction or severity. The merged allergy must be valid. */
export const update = (ctx: ServiceContext, id: string, input: RecipientAllergyUpdateInput) =>
  withTransaction(async (tx) => {
    const parsed = recipientAllergyUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const existing = await recipientAllergyModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const merged = recipientAllergyContentZSchema.safeParse({ ...existing, ...patch });
    if (!merged.success) return invalid(merged.error);

    const updated = await recipientAllergyModel.update({
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

/**
 * Create the allergy with this id, or bring the existing one up to date
 * (PowerSync's upload queue). Safe to replay; the group and recipient never
 * change, and a deleted allergy stays deleted.
 */
export const upsert = (ctx: ServiceContext, input: RecipientAllergyUpsertInput) =>
  withTransaction(async (tx) => {
    const parsed = recipientAllergyUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId, ...content } = parsed.data;

    const existing = await recipientAllergyModel.getById(id, {
      authUser: SYSTEM_USER,
      tx,
      includeDeleted: true,
    });
    if (isError(existing)) return existing;
    if (!existing) return create({ ...ctx, tx }, input);

    const visible = await recipientAllergyModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);
    if (visible.groupId !== groupId || (recipientId !== undefined && visible.recipientId !== recipientId))
      return newError({ code: "recipientAllergyService:immutable" });
    if (visible.deletedAt) return visible;

    return update({ ...ctx, tx }, id, content);
  }, ctx);

/** Soft delete (writers). */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const res = await recipientAllergyModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
    if (!isError(res) || res.code !== "baseModel:remove:nothingRemoved") return res;
    const visible = await recipientAllergyModel.getById(id, { ...ctx, tx });
    if (isError(visible)) return visible;
    return visible ? rejectError(ctx.authUser) : notFound();
  }, ctx);
