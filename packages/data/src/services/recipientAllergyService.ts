import type {
  RecipientAllergyCreateInput,
  RecipientAllergyUpdateInput,
  RecipientAllergyUpsertInput,
  Tx,
} from "../db";
import type { IncludeDeleted } from "../models/recipientAllergy";
import type { ServiceContext } from "./types";

import { z } from "zod";
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
import { asCreated, unchanged } from "./upserted";
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
 * Create the allergy with this id if there is none: what PowerSync's upload
 * queue sends for a row a device created. A replay changes nothing (only a
 * PATCH edits), whatever the actor's role now, so it never reverts a newer
 * edit. The group and recipient never change, and an id the actor can't see is refused
 * without saying whether it exists. Says whether it created (`Upserted`).
 */
export const upsert = (ctx: ServiceContext, input: RecipientAllergyUpsertInput) =>
  withTransaction(async (tx) => {
    const parsed = recipientAllergyUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId } = parsed.data;

    const existing = await recipientAllergyModel.getById(id, {
      authUser: SYSTEM_USER,
      tx,
      includeDeleted: true,
    });
    if (isError(existing)) return existing;
    if (!existing) return asCreated(await create({ ...ctx, tx }, input));

    const visible = await recipientAllergyModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);
    if (visible.groupId !== groupId || (recipientId !== undefined && visible.recipientId !== recipientId))
      return newError({ code: "recipientAllergyService:immutable" });
    return unchanged(visible);
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

// ---------------------------------------------------------------------------
// "No known allergies" (`care_recipient.no_known_allergies_at`)
// ---------------------------------------------------------------------------

const noKnownAtZSchema = z.iso.datetime({ offset: true }).nullable();

/**
 * Record "No known allergies" (a time) or clear it (null): the one
 * care_recipient column a device may change. Permission is
 * care_recipient's update rule (writers). Recording it while allergies are
 * on file is refused: the list would contradict itself. Safe to replay.
 */
export const setNoKnownAllergies = (ctx: ServiceContext, recipientId: string, at: string | null) =>
  withTransaction(async (tx) => {
    const parsed = noKnownAtZSchema.safeParse(at);
    if (!parsed.success) return newError({ code: "recipientAllergyService:invalidNoKnown" });

    const recipient = await careRecipientModel.getById(recipientId, { ...ctx, tx });
    if (isError(recipient)) return recipient;
    if (!recipient) return rejectError(ctx.authUser);

    if (parsed.data) {
      const allergies = await recipientAllergyModel.list({
        authUser: SYSTEM_USER,
        tx,
        filter: { recipientId: { type: "eq", value: recipientId } },
      });
      if (isError(allergies)) return allergies;
      if (allergies.data.length) return newError({ code: "recipientAllergyService:hasAllergies" });
    }

    const updated = await careRecipientModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: recipientId } },
      data: { noKnownAllergiesAt: parsed.data },
    });
    if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
      return rejectError(ctx.authUser);
    if (isError(updated)) return updated;
    return updated[0] ?? null;
  }, ctx);
