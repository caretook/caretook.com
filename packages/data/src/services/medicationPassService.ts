import type { z } from "zod";
import type {
  MedicationPass,
  MedicationPassCreateInput,
  MedicationPassUpdateInput,
  MedicationPassUpsertInput,
  Tx,
} from "../db";
import type { IncludeDeleted } from "../models/medicationPass";
import type { ChangeTimes } from "../db/schema";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  canAddPass,
  DEFAULT_PASSES,
  medicationPassContentZSchema,
  medicationPassCreateZSchema,
  medicationPassUpdateZSchema,
  medicationPassUpsertZSchema,
  medicationsInPass,
  nextSortOrder,
  normalizeSchedule,
  PASS_NAME_TAKEN_ISSUE,
  passMoved,
  scheduleHasPass,
  passMovedId,
  passNameTaken,
  timelineEntryContentZSchema,
  withoutPass,
  changeTimes,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careRecipientModel, medicationModel, medicationPassModel, timelineEntryModel } from "../models";
import { rejectError } from "../permissions";
import { asCreated, unchanged } from "./upserted";
import { resolveRecipient } from "./medicationService";

// A care group's medication passes (Morning, Evening…). Write through here,
// not the model: this is where names are kept unique (live ones, case
// ignored) and the count capped, where a retime writes its `passMoved`
// change entry, and where deleting a pass turns it into a time of its own in
// every medication's schedule, each in one transaction.

export const schemaName = medicationPassModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "medicationPassService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const notFound = () => newError({ code: "medicationPassService:notFound" });
const nameTaken = () =>
  newError({ code: "medicationPassService:nameTaken", meta: { issues: [{ ...PASS_NAME_TAKEN_ISSUE }] } });
const tooMany = () => newError({ code: "medicationPassService:tooMany" });

/** When a save happened, as with medications: a device passes its row's `updated_at`. */
export type PassWriteOptions = { changedAt?: string | null };

/** The save's change times: the device's for the entry's id, never later than now for its date. */
const changeTimeOf = (opts: PassWriteOptions) => changeTimes(opts.changedAt);

const system = (tx: Tx) => ({ authUser: SYSTEM_USER, tx });

/** Every pass in the group, deleted ones too unless `live` (read as the system: callers checked access). */
const groupPasses = async (tx: Tx, groupId: string, live = true) => {
  const res = await medicationPassModel.list({
    ...system(tx),
    includeDeleted: !live,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  return isError(res) ? res : res.data;
};

/** The group's live medications (any status) whose schedule (read in any shape) has a slot in `passId`. */
const medicationsWithPass = async (tx: Tx, groupId: string, passId: string) => {
  const res = await medicationModel.list({
    ...system(tx),
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(res)) return res;
  return res.data.flatMap((m) => {
    const schedule = normalizeSchedule(m.schedule);
    return schedule && scheduleHasPass(schedule, passId) ? [{ ...m, schedule }] : [];
  });
};

/**
 * Record a retime on the timeline: one `medicationChange` entry (`passMoved`)
 * naming the medications in the pass, in the recipient's zone. Its id comes
 * from the pass and `changedAt`, so a replay (or the device's own copy,
 * uploaded next) lands on the same row.
 */
const writeMoved = async (
  ctx: ServiceContext,
  tx: Tx,
  { before, after, changedAt }: { before: MedicationPass; after: MedicationPass; changedAt: ChangeTimes },
) => {
  const medications = await medicationsWithPass(tx, after.groupId, after.id);
  if (isError(medications)) return medications;
  const details = passMoved(
    before,
    after,
    medicationsInPass(medications, after.id).map((m) => m.id),
  );
  if (!details) return null;

  const id = passMovedId(after.id, changedAt.key);
  const existing = await timelineEntryModel.getById(id, { ...system(tx), includeDeleted: true });
  if (isError(existing)) return existing;
  if (existing) return existing;

  const recipient = await careRecipientModel.getById(after.recipientId, system(tx));
  if (isError(recipient)) return recipient;
  const timeZone = recipient?.timeZone ?? "UTC";
  const content = timelineEntryContentZSchema.safeParse({
    kind: "medicationChange",
    occurredAt: changedAt.date,
    timeZone,
    details,
  });
  if (!content.success) return invalid(content.error);

  return timelineEntryModel.create({
    ...ctx,
    tx,
    data: {
      id,
      groupId: after.groupId,
      recipientId: after.recipientId,
      kind: "medicationChange",
      occurredAt: changedAt.date,
      timeZone,
      title: null,
      body: null,
      details: content.data.details ?? null,
    },
  });
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One pass, if the actor can see it. Deleted ones only with `includeDeleted`. */
export const getById = (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) =>
  medicationPassModel.getById(id, { ...ctx, ...opts });

/** A group's passes in the day's order (by sort order, then time). */
export const list = (ctx: ServiceContext, { groupId, ...opts }: IncludeDeleted & { groupId: string }) =>
  medicationPassModel.list({ ...ctx, ...opts, filter: { groupId: { type: "eq", value: groupId } } });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Add a pass. `id` may come from an offline device; without a sort order it
 * goes last. Writers only; the name must be free and the group under its cap.
 */
export const create = (ctx: ServiceContext, input: MedicationPassCreateInput) =>
  withTransaction(async (tx) => {
    const parsed = medicationPassCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { recipientId, ...data } = parsed.data;

    const recipient = await resolveRecipient(ctx, tx, data.groupId, recipientId);
    if (isError(recipient)) return recipient;

    const locked = await medicationPassModel.lockGroup(data.groupId, tx);
    if (isError(locked)) return locked;
    const passes = await groupPasses(tx, data.groupId);
    if (isError(passes)) return passes;
    if (passNameTaken(passes, data.name)) return nameTaken();
    if (!canAddPass(passes)) return tooMany();

    const sortOrder = input.sortOrder === undefined ? nextSortOrder(passes) : data.sortOrder;
    return medicationPassModel.create({
      ...ctx,
      tx,
      data: { ...data, sortOrder, recipientId: recipient.id },
    });
  }, ctx);

/**
 * Rename, retime or reorder a pass. A new time moves every medication in it
 * (they name the pass, not its time) and writes one `passMoved` entry on the
 * timeline; a rename or reorder writes none.
 */
export const update = (
  ctx: ServiceContext,
  id: string,
  input: MedicationPassUpdateInput,
  opts: PassWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = medicationPassUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const visible = await medicationPassModel.getById(id, { ...ctx, tx });
    if (isError(visible)) return visible;
    if (!visible) return notFound();
    const before = await medicationPassModel.lockLive(id, tx);
    if (isError(before)) return before;
    if (!before) return notFound();

    const merged = medicationPassContentZSchema.safeParse({ ...before, ...patch });
    if (!merged.success) return invalid(merged.error);

    if (merged.data.name !== before.name) {
      const locked = await medicationPassModel.lockGroup(before.groupId, tx);
      if (isError(locked)) return locked;
      const passes = await groupPasses(tx, before.groupId);
      if (isError(passes)) return passes;
      if (passNameTaken(passes, merged.data.name, id)) return nameTaken();
    }

    const updated = await medicationPassModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: merged.data,
    });
    // Visible but not writable: a viewer.
    if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
      return rejectError(ctx.authUser);
    if (isError(updated)) return updated;
    const after = updated[0];
    if (!after) return null;

    const moved = await writeMoved(ctx, tx, { before, after, changedAt: changeTimeOf(opts) });
    if (isError(moved)) return moved;
    return after;
  }, ctx);

/**
 * Create the pass with this id if there is none: what PowerSync's upload
 * queue sends for a row a device created. A replay changes nothing (only a
 * PATCH edits), whatever the actor's role now, so it never reverts a newer
 * edit. The group and recipient never change, and an id the actor can't see is refused
 * without saying whether it exists. Says whether it created (`Upserted`).
 */
export const upsert = (ctx: ServiceContext, input: MedicationPassUpsertInput, _opts: PassWriteOptions = {}) =>
  withTransaction(async (tx) => {
    const parsed = medicationPassUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId } = parsed.data;

    const existing = await medicationPassModel.getById(id, { ...system(tx), includeDeleted: true });
    if (isError(existing)) return existing;
    if (!existing) return asCreated(await create({ ...ctx, tx }, input));

    const visible = await medicationPassModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);
    if (visible.groupId !== groupId || (recipientId !== undefined && visible.recipientId !== recipientId))
      return newError({ code: "medicationPassService:immutable" });
    return unchanged(visible);
  }, ctx);

/**
 * Soft delete a pass. Every live medication with a slot in it keeps the
 * pass's time as a time of its own (its amount kept), in the same
 * transaction, with no change entries: the pass's deletion is the change.
 */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const visible = await medicationPassModel.getById(id, { ...ctx, tx });
    if (isError(visible)) return visible;
    if (!visible) return notFound();
    const pass = await medicationPassModel.lockLive(id, tx);
    if (isError(pass)) return pass;
    if (!pass) return notFound();

    const res = await medicationPassModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
    // Visible but not removable: a viewer.
    if (isError(res) && res.code === "baseModel:remove:nothingRemoved") return rejectError(ctx.authUser);
    if (isError(res)) return res;

    const medications = await medicationsWithPass(tx, pass.groupId, pass.id);
    if (isError(medications)) return medications;
    for (const medication of medications) {
      const rewritten = await medicationModel.update({
        ...ctx,
        tx,
        filter: { id: { type: "eq", value: medication.id } },
        data: { schedule: withoutPass(medication.schedule, pass) },
      });
      if (isError(rewritten)) return rewritten;
    }
    return res;
  }, ctx);

/**
 * A new care group's passes (`DEFAULT_PASSES`: Morning 08:00, Evening
 * 20:00), as the system, inside the caller's transaction. Every way of
 * creating a group calls this once its recipient exists.
 */
export const addDefaults = async (
  tx: Tx,
  { groupId, recipientId }: { groupId: string; recipientId: string },
) => {
  for (const [sortOrder, pass] of DEFAULT_PASSES.entries()) {
    const created = await medicationPassModel.create({
      ...system(tx),
      data: { groupId, recipientId, name: pass.name, time: pass.time, sortOrder },
    });
    if (isError(created)) return created;
  }
  return null;
};
