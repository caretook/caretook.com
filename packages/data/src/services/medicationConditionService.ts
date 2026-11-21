import type { MedicationConditionLinkInput, Tx } from "../db";
import type { ServiceContext } from "./types";

import { z } from "zod";
import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { medicationConditionId, medicationConditionLinkZSchema } from "../db/schema";
import { isError, newError } from "../errors";
import { medicationConditionModel, medicationModel, recipientConditionModel } from "../models";
import { rejectError } from "../permissions";

// What a medication is for (conditions slice 4): links between a medication
// and the recipient's conditions. Write through here: this is where both
// ends are checked (a live medication and a live condition, both in the
// link's group).
//
// A link's id is derived from its pair (`medicationConditionId`), so linking
// is idempotent everywhere: a replay, or two devices linking the same pair.
// A deleted condition's (or medication's) links stay in place, and the
// reads here leave them out.

export const serviceName = "medicationCondition";
export const schemaName = medicationConditionModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "medicationConditionService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const medicationNotFound = () => newError({ code: "medicationConditionService:medicationNotFound" });
const conditionNotFound = () => newError({ code: "medicationConditionService:conditionNotFound" });

/**
 * A live medication the actor can see, or the right refusal: `unauthorized`
 * when it's in a group they can't see, `medicationNotFound` when it doesn't
 * exist or is deleted.
 */
const visibleMedication = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const medication = await medicationModel.getById(id, { ...ctx, tx });
  if (isError(medication) || medication) return medication;
  const visible = await medicationModel.getById(id, { ...ctx, tx, includeDeleted: true });
  if (isError(visible)) return visible;
  if (visible) return medicationNotFound();
  const any = await medicationModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : medicationNotFound();
};

/** The same for a condition that isn't deleted. */
const visibleCondition = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const condition = await recipientConditionModel.getById(id, { ...ctx, tx });
  if (isError(condition) || condition) return condition;
  const visible = await recipientConditionModel.getById(id, { ...ctx, tx, includeDeleted: true });
  if (isError(visible)) return visible;
  if (visible) return conditionNotFound();
  const any = await recipientConditionModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : conditionNotFound();
};

const ids = (rows: readonly { id: string }[]) => new Set(rows.map((r) => r.id));

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** A medication's links to live conditions, oldest first. A deleted condition's links are left out. */
export const listForMedication = (ctx: ServiceContext, medicationId: string) =>
  withTransaction(async (tx) => {
    const links = await medicationConditionModel.list({
      ...ctx,
      tx,
      filter: { medicationId: { type: "eq", value: medicationId } },
      orderBy: [{ field: "createdAt", direction: "asc" }],
    });
    if (isError(links) || !links.data.length) return links;
    const conditions = await recipientConditionModel.list({
      ...ctx,
      tx,
      filter: { id: { type: "inArray", value: links.data.map((l) => l.conditionId) } },
    });
    if (isError(conditions)) return conditions;
    const live = ids(conditions.data);
    return { ...links, data: links.data.filter((l) => live.has(l.conditionId)) };
  }, ctx);

/**
 * A condition's links to live medications, oldest first. A deleted
 * medication's links are left out, and a deleted condition has none.
 */
export const listForCondition = (ctx: ServiceContext, conditionId: string) =>
  withTransaction(async (tx) => {
    const links = await medicationConditionModel.list({
      ...ctx,
      tx,
      filter: { conditionId: { type: "eq", value: conditionId } },
      orderBy: [{ field: "createdAt", direction: "asc" }],
    });
    if (isError(links) || !links.data.length) return links;
    const condition = await recipientConditionModel.getById(conditionId, { ...ctx, tx });
    if (isError(condition)) return condition;
    if (!condition) return { ...links, data: [] };
    const medications = await medicationModel.list({
      ...ctx,
      tx,
      filter: { id: { type: "inArray", value: links.data.map((l) => l.medicationId) } },
    });
    if (isError(medications)) return medications;
    const live = ids(medications.data);
    return { ...links, data: links.data.filter((l) => live.has(l.medicationId)) };
  }, ctx);

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Say a medication is for a condition. Writers only. Both must be live and
 * in `groupId`. Linking a pair that's already linked returns the existing
 * link (a replay).
 */
export const link = (ctx: ServiceContext, input: MedicationConditionLinkInput) =>
  withTransaction(async (tx) => {
    const parsed = medicationConditionLinkZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { groupId, medicationId, conditionId } = parsed.data;
    const id = medicationConditionId(medicationId, conditionId);

    const medication = await visibleMedication(ctx, tx, medicationId);
    if (isError(medication)) return medication;
    const condition = await visibleCondition(ctx, tx, conditionId);
    if (isError(condition)) return condition;
    if (medication.groupId !== groupId || condition.groupId !== groupId)
      return newError({ code: "medicationConditionService:immutable" });

    const existing = await medicationConditionModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (existing) return existing;

    return medicationConditionModel.create({ ...ctx, tx, data: { id, groupId, medicationId, conditionId } });
  }, ctx);

/**
 * Remove a link (a hard delete). Writers only. Removing a link that's
 * already gone is fine (a replay); one the actor can see but not remove is
 * refused.
 */
export const unlink = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const res = await medicationConditionModel.remove({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
    });
    if (!isError(res)) return res;
    if (res.code !== "baseModel:remove:nothingRemoved") return res;
    const any = await medicationConditionModel.getById(id, { authUser: SYSTEM_USER, tx });
    if (isError(any)) return any;
    return any ? rejectError(ctx.authUser) : { ids: [] as string[] };
  }, ctx);

const setZSchema = z.strictObject({
  medicationId: z.uuid(),
  conditionIds: z.array(z.uuid()).max(50),
});
export type SetMedicationConditionsInput = z.input<typeof setZSchema>;

/**
 * Make a medication's conditions exactly `conditionIds` (writers): links
 * the new ones and unlinks the rest, in one transaction. Each must be a live
 * condition in the medication's group. A deleted condition's link is left
 * alone (no list shows it). Safe to replay. Returns the live links.
 */
export const setMedicationConditions = (ctx: ServiceContext, input: SetMedicationConditionsInput) =>
  withTransaction(async (tx) => {
    const parsed = setZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { medicationId } = parsed.data;
    const wanted = new Set(parsed.data.conditionIds.map((id) => id.toLowerCase()));

    const medication = await visibleMedication(ctx, tx, medicationId);
    if (isError(medication)) return medication;

    const current = await listForMedication({ ...ctx, tx }, medicationId);
    if (isError(current)) return current;
    for (const l of current.data) {
      if (wanted.has(l.conditionId.toLowerCase())) continue;
      const res = await unlink({ ...ctx, tx }, l.id);
      if (isError(res)) return res;
    }
    const have = new Set(current.data.map((l) => l.conditionId.toLowerCase()));
    for (const conditionId of wanted) {
      if (have.has(conditionId)) continue;
      const res = await link({ ...ctx, tx }, { groupId: medication.groupId, medicationId, conditionId });
      if (isError(res)) return res;
    }
    return listForMedication({ ...ctx, tx }, medicationId);
  }, ctx);
