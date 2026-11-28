import type { z } from "zod";
import type {
  Medication,
  MedicationContent,
  MedicationSchedule,
  MedicationCreateInput,
  MedicationUpdateInput,
  MedicationUpsertInput,
  Tx,
} from "../db";
import type { IncludeDeleted } from "../models/medication";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  BAD_PHARMACY_ISSUE,
  BAD_PRESCRIBER_ISSUE,
  isPharmacyType,
  isPrescriberType,
  medicationChange,
  medicationChangeId,
  medicationContentOf,
  medicationContentZSchema,
  medicationCreateZSchema,
  medicationUpdateZSchema,
  medicationUpsertZSchema,
  schedulePassIds,
  timelineEntryContentZSchema,
  toChangeTime,
  withoutPass,
} from "../db/schema";
import { isError, newError } from "../errors";
import {
  careGroupModel,
  careRecipientModel,
  medicationModel,
  medicationPassModel,
  providerModel,
  timelineEntryModel,
} from "../models";
import { rejectError } from "../permissions";
import { asCreated, unchanged } from "./upserted";

// A care group's medication list. Write through here, not the model: this is
// where content is validated, the prescriber and pharmacy are checked, and
// the timeline's `medicationChange` entry is written, in the same transaction
// as the medication.

export const serviceName = "medication";
export const schemaName = medicationModel.schemaName;

const issuesOf = (error: z.ZodError) =>
  error.issues.map(({ path, message }) => ({ path: path.join("."), message }));

const invalid = (error: z.ZodError) =>
  newError({ code: "medicationService:invalid", meta: { issues: issuesOf(error) } });

const notFound = () => newError({ code: "medicationService:notFound" });
const badPrescriber = () =>
  newError({ code: "medicationService:badPrescriber", meta: { issues: [{ ...BAD_PRESCRIBER_ISSUE }] } });
const badPharmacy = () =>
  newError({ code: "medicationService:badPharmacy", meta: { issues: [{ ...BAD_PHARMACY_ISSUE }] } });

/**
 * When a save happened, for its change entry.
 * - A device passes its row's `updated_at` (`changedAt`), so the entry it
 *   wrote locally and the one written here get the same derived id.
 * - Without one (an API caller), it's now.
 */
export type MedicationWriteOptions = { changedAt?: string | null };

/**
 * A create's options: `via` (server only, never from a device) is the
 * assistant a member added it through ("Claude"; connectors-3), put on the
 * "started" entry as `timelineEntryService.create` puts it on an entry.
 */
export type MedicationCreateOptions = MedicationWriteOptions & { via?: string | null };

const changeTimeOf = (opts: MedicationWriteOptions) =>
  (opts.changedAt ? toChangeTime(opts.changedAt) : null) ?? new Date().toISOString();

/**
 * The recipient a medication is for: `recipientId` when given (it must be in
 * the group), else the group's only recipient. Reads are scoped to the
 * actor, so a non-member learns nothing about the group.
 */
export const resolveRecipient = async (
  ctx: ServiceContext,
  tx: Tx,
  groupId: string,
  recipientId?: string,
) => {
  const group = await careGroupModel.getById(groupId, { ...ctx, tx });
  if (isError(group)) return group;
  if (!group) return rejectError(ctx.authUser);

  if (recipientId) {
    const recipient = await careRecipientModel.getById(recipientId, { ...ctx, tx });
    if (isError(recipient)) return recipient;
    if (recipient?.groupId !== groupId) return newError({ code: "medicationService:recipientNotInGroup" });
    return recipient;
  }

  const recipient = await careRecipientModel.get({
    ...ctx,
    tx,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(recipient)) return recipient;
  return recipient ?? newError({ code: "medicationService:noRecipient" });
};

/**
 * The prescriber must be a live clinician or practice in the group, and the
 * pharmacy a live pharmacy. Checked when set or changed: a provider deleted
 * later stays linked (and shows greyed).
 */
const checkProviders = async (
  ctx: ServiceContext,
  tx: Tx,
  groupId: string,
  { prescriberId, pharmacyId }: { prescriberId?: string | null; pharmacyId?: string | null },
) => {
  if (prescriberId) {
    const prescriber = await providerModel.getById(prescriberId, { ...ctx, tx });
    if (isError(prescriber)) return prescriber;
    if (!prescriber || prescriber.groupId !== groupId || !isPrescriberType(prescriber.type))
      return badPrescriber();
  }
  if (pharmacyId) {
    const pharmacy = await providerModel.getById(pharmacyId, { ...ctx, tx });
    if (isError(pharmacy)) return pharmacy;
    if (!pharmacy || pharmacy.groupId !== groupId || !isPharmacyType(pharmacy.type)) return badPharmacy();
  }
  return null;
};

const badPass = () =>
  newError({
    code: "medicationService:badPass",
    meta: { issues: [{ path: "schedule", message: "Choose med times in this care group" }] },
  });

/**
 * The schedule's passes must be the group's. One deleted since the device
 * last synced becomes a time of its own (as the pass's deletion made every
 * other medication's), so the schedule stored never names a deleted pass.
 */
const checkPasses = async (tx: Tx, groupId: string, schedule: MedicationSchedule) => {
  let checked: MedicationSchedule = schedule;
  for (const passId of schedulePassIds(schedule)) {
    const pass = await medicationPassModel.getById(passId, {
      authUser: SYSTEM_USER,
      tx,
      includeDeleted: true,
    });
    if (isError(pass)) return pass;
    if (!pass || pass.groupId !== groupId) return badPass();
    if (pass.deletedAt) checked = withoutPass(checked, pass);
  }
  return checked;
};

/**
 * Record what a save did on the timeline, as the actor: one
 * `medicationChange` entry for a new medication, a stop or restart, or an
 * edit to a tracked field; none for anything else (refills, reason,
 * providers). Its id comes from the medication and `changedAt`, so a replay
 * (or the device's own copy of the entry, uploaded next) lands on the same
 * row and changes nothing.
 */
const writeChange = async (
  ctx: ServiceContext,
  tx: Tx,
  {
    before,
    after,
    changedAt,
    timeZone,
    via,
  }: {
    before: MedicationContent | null;
    after: Medication;
    changedAt: string;
    timeZone: string;
    via?: string | null;
  },
) => {
  const change = medicationChange(before, after);
  if (!change) return null;

  const id = medicationChangeId(after.id, changedAt);
  const existing = await timelineEntryModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
  if (isError(existing)) return existing;
  if (existing) return existing;

  const content = timelineEntryContentZSchema.safeParse({
    kind: "medicationChange",
    occurredAt: changedAt,
    timeZone,
    details: { medicationId: after.id, ...change },
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
      occurredAt: changedAt,
      timeZone,
      title: null,
      body: null,
      details: content.data.details ?? null,
      ...(via ? { via } : {}),
    },
  });
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One medication, if the actor can see it. Deleted ones only with `includeDeleted`. */
export const getById = (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) =>
  medicationModel.getById(id, { ...ctx, ...opts });

/** A group's medications: current ones first, then the rest, each by name. */
export const list = async (
  ctx: ServiceContext,
  { groupId, ...opts }: IncludeDeleted & { groupId: string },
) => {
  const res = await medicationModel.list({
    ...ctx,
    ...opts,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(res)) return res;
  const rank = (m: Medication) => (m.status === "current" ? 0 : 1);
  return { ...res, data: [...res.data].sort((a, b) => rank(a) - rank(b)) };
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Add a medication, and its "started" entry on the timeline (with `via`
 * when an assistant added it). `id` may come from an offline device.
 * Writers only.
 */
export const create = (
  ctx: ServiceContext,
  input: MedicationCreateInput,
  opts: MedicationCreateOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = medicationCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { recipientId, ...data } = parsed.data;

    const recipient = await resolveRecipient(ctx, tx, data.groupId, recipientId);
    if (isError(recipient)) return recipient;

    const providers = await checkProviders(ctx, tx, data.groupId, data);
    if (providers) return providers;
    const schedule = await checkPasses(tx, data.groupId, data.schedule);
    if (isError(schedule)) return schedule;

    const created = await medicationModel.create({
      ...ctx,
      tx,
      data: { ...data, schedule, recipientId: recipient.id },
    });
    if (isError(created) || !created) return created;

    const change = await writeChange(ctx, tx, {
      before: null,
      after: created,
      changedAt: changeTimeOf(opts),
      timeZone: recipient.timeZone,
      via: opts.via,
    });
    if (isError(change)) return change;
    return created;
  }, ctx);

/**
 * Edit a medication, including stopping and restarting it (`status`). The
 * group and recipient are fixed. The merged medication must be valid (a
 * discontinued one needs a reason), a changed prescriber or pharmacy is
 * checked, and what changed is recorded on the timeline (see `writeChange`).
 */
export const update = (
  ctx: ServiceContext,
  id: string,
  input: MedicationUpdateInput,
  opts: MedicationWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = medicationUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const existing = await medicationModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    // Read through the schema, so an old-shape stored schedule compares as slots.
    const stored = medicationContentZSchema.safeParse(medicationContentOf(existing));
    const before = stored.success ? stored.data : medicationContentOf(existing);
    const merged = medicationContentZSchema.safeParse({ ...before, ...patch });
    if (!merged.success) return invalid(merged.error);

    const providers = await checkProviders(ctx, tx, existing.groupId, {
      prescriberId: merged.data.prescriberId !== existing.prescriberId ? merged.data.prescriberId : null,
      pharmacyId: merged.data.pharmacyId !== existing.pharmacyId ? merged.data.pharmacyId : null,
    });
    if (providers) return providers;
    const schedule = await checkPasses(tx, existing.groupId, merged.data.schedule);
    if (isError(schedule)) return schedule;

    const updated = await medicationModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: { ...merged.data, schedule },
    });
    // Visible but not writable: a viewer.
    if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
      return rejectError(ctx.authUser);
    if (isError(updated)) return updated;
    const after = updated[0];
    if (!after) return null;

    // The entry is in the recipient's zone. Read as the system: the actor
    // could already write the medication.
    const recipient = await careRecipientModel.getById(after.recipientId, { authUser: SYSTEM_USER, tx });
    if (isError(recipient)) return recipient;

    const change = await writeChange(ctx, tx, {
      before,
      after,
      changedAt: changeTimeOf(opts),
      timeZone: recipient?.timeZone ?? "UTC",
    });
    if (isError(change)) return change;
    return after;
  }, ctx);

/**
 * Create the medication with this id if there is none: what PowerSync's
 * upload queue sends for a row a device created. A replay changes nothing
 * (only a PATCH edits), whatever the actor's role now, so it never reverts a
 * newer edit. A replay writes no change entry. The group and recipient never
 * change, and an id the actor can't see is refused without saying whether it
 * exists. Says whether it created (`Upserted`).
 */
export const upsert = (
  ctx: ServiceContext,
  input: MedicationUpsertInput,
  opts: MedicationWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = medicationUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId } = parsed.data;

    const existing = await medicationModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
    if (isError(existing)) return existing;
    // The device's own input, not the parsed one: `create` parses it again.
    // A device's create: never a `via`.
    if (!existing) return asCreated(await create({ ...ctx, tx }, input, { changedAt: opts.changedAt }));

    const visible = await medicationModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);
    if (visible.groupId !== groupId || (recipientId !== undefined && visible.recipientId !== recipientId))
      return newError({ code: "medicationService:immutable" });
    return unchanged(visible);
  }, ctx);

/**
 * Soft delete (a medication added by mistake). It leaves the list but syncs
 * as deleted; its doses and changes stay on the timeline. No change entry.
 */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const res = await medicationModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
    if (!isError(res) || res.code !== "baseModel:remove:nothingRemoved") return res;
    // Visible but not removable: a viewer. Otherwise gone, or never theirs.
    const visible = await medicationModel.getById(id, { ...ctx, tx });
    if (isError(visible)) return visible;
    return visible ? rejectError(ctx.authUser) : notFound();
  }, ctx);
