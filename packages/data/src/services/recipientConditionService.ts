import type {
  ConditionChangeSource,
  ConditionManagerLinkInput,
  ConditionProviderRef,
  ConditionStatus,
  RecipientCondition,
  RecipientConditionCreateInput,
  RecipientConditionUpdateInput,
  RecipientConditionUpsertInput,
  Tx,
} from "../db";
import type { IncludeDeleted } from "../models/recipientCondition";
import type { ChangeTimes } from "../db/schema";
import type { ServiceContext } from "./types";

import { z } from "zod";
import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  conditionChange,
  conditionChangeDetailsZSchema,
  conditionChangeId,
  conditionManagerId,
  conditionManagerLinkZSchema,
  managerNames,
  recipientConditionContentZSchema,
  recipientConditionCreateZSchema,
  recipientConditionUpdateZSchema,
  recipientConditionUpsertZSchema,
  timelineEntryContentZSchema,
  withManagersChange,
  changeTimes,
} from "../db/schema";
import { isError, newError } from "../errors";
import {
  careRecipientModel,
  conditionManagerModel,
  providerModel,
  recipientConditionModel,
  timelineEntryModel,
} from "../models";
import { rejectError } from "../permissions";
import { createIfAbsent } from "./upserted";
import { resolveRecipient } from "./medicationService";

// The care recipient's conditions (conditions PRD). Write through here, not
// the model: content is validated here, and adding a condition clears "No
// known conditions" (`care_recipient.no_known_conditions_at`) in the same
// transaction. Every write runs in one transaction that has the condition
// before and after, so what a change also writes (its timeline entry, its
// links) goes in beside it.
//
// Who diagnosed it (`diagnosed_by_id`) and who manages it (`condition_manager`
// links, slice 3) must be live providers in the condition's group when set;
// one deleted later stays, and screens grey it "(removed)". Each manager link
// or unlink folds into the change entry of its save's time, so one save's
// links (however many) are one entry with "Managed by: before → after".

export const schemaName = recipientConditionModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "recipientConditionService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const notFound = () => newError({ code: "recipientConditionService:notFound" });

const providerIssue = (code: "badProvider" | "providerNotFound", path: string, message: string) =>
  newError({ code: `recipientConditionService:${code}`, meta: { issues: [{ path, message }] } });
const badProvider = (path: string) =>
  providerIssue("badProvider", path, "Choose a provider in this care group");
const providerGone = (path: string) =>
  providerIssue("providerNotFound", path, "That provider is gone. It may have been deleted.");

/**
 * A live provider in `groupId`, or the refusal (on `path`): `unauthorized`
 * for one in a group the actor can't see, `providerNotFound` for a deleted
 * one, `badProvider` for one in another of their groups or none at all.
 */
const checkProvider = async (ctx: ServiceContext, tx: Tx, groupId: string, id: string, path: string) => {
  const live = await providerModel.getById(id, { ...ctx, tx });
  if (isError(live)) return live;
  if (live) return live.groupId === groupId ? live : badProvider(path);
  const visible = await providerModel.getById(id, { ...ctx, tx, includeDeleted: true });
  if (isError(visible)) return visible;
  if (visible) return visible.groupId === groupId ? providerGone(path) : badProvider(path);
  const any = await providerModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : badProvider(path);
};

/** A live condition the actor can see, or `unauthorized` (another group's) or `notFound` (none, or deleted). */
const visibleCondition = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const condition = await recipientConditionModel.getById(id, { ...ctx, tx });
  if (isError(condition) || condition) return condition;
  const visible = await recipientConditionModel.getById(id, { ...ctx, tx, includeDeleted: true });
  if (isError(visible)) return visible;
  if (visible) return notFound();
  const any = await recipientConditionModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : notFound();
};

/** A provider's id and name (deleted ones too: a change entry records names). As the system. */
const providerRef = async (tx: Tx, id: string | null): Promise<ConditionProviderRef | null> => {
  if (!id) return null;
  const provider = await providerModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
  return provider && !isError(provider) ? { id: provider.id, name: provider.name } : null;
};

/** A condition as a change source: its content and who diagnosed it, by name. */
const sourceOf = async (tx: Tx, row: RecipientCondition): Promise<ConditionChangeSource> => ({
  ...row,
  diagnosedBy: await providerRef(tx, row.diagnosedById),
});

/**
 * When a save happened, for its change entry (as `MedicationWriteOptions`):
 * a device passes its row's `updated_at`, so the entry it wrote locally and
 * the one written here get the same derived id; without one, it's now.
 */
export type ConditionWriteOptions = {
  changedAt?: string | null;
  /** Server-only, never from a device: the assistant the save came through (connectors); stored on its change entry. */
  via?: string | null;
};

/** The save's change times: the device's for the entry's id, never later than now for its date. */
const changeTimeOf = (opts: ConditionWriteOptions) => changeTimes(opts.changedAt);

/**
 * Record what a save did on the timeline, as the actor: one
 * `conditionChange` entry for a new condition, a resolve or reactivate, or
 * an edit to a tracked field (name, since, note, diagnosed by); none for a save that
 * changed none of them. Its id comes from the condition and `changedAt`, so
 * a replay (or the device's own copy of the entry, uploaded next) lands on
 * the same row and changes nothing. In the recipient's time zone.
 */
const writeChange = async (
  ctx: ServiceContext,
  tx: Tx,
  {
    condition: after,
    before,
    source,
    changedAt,
    via,
  }: {
    /** The condition after the save. */
    condition: RecipientCondition;
    before: ConditionChangeSource | null;
    /** The condition after the save, as a change source (default: its row). */
    source?: ConditionChangeSource;
    /** The save's times: `key` for the id, `date` for `occurredAt`. */
    changedAt: ChangeTimes;
    via?: string | null;
  },
) => {
  const change = conditionChange(before, source ?? (await sourceOf(tx, after)));
  if (!change) return null;

  const id = conditionChangeId(after.id, changedAt.key);
  const existing = await timelineEntryModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
  if (isError(existing)) return existing;
  if (existing) return existing;

  // Read as the system: the actor could already write the condition.
  const recipient = await careRecipientModel.getById(after.recipientId, { authUser: SYSTEM_USER, tx });
  if (isError(recipient)) return recipient;
  const timeZone = recipient?.timeZone ?? "UTC";

  const content = timelineEntryContentZSchema.safeParse({
    kind: "conditionChange",
    occurredAt: changedAt.date,
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
      occurredAt: changedAt.date,
      timeZone,
      title: null,
      body: null,
      details: content.data.details ?? null,
      ...(via ? { via } : {}),
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
    if (data.diagnosedById) {
      const provider = await checkProvider(ctx, tx, data.groupId, data.diagnosedById, "diagnosedById");
      if (isError(provider)) return provider;
    }

    const created = await recipientConditionModel.create({
      ...ctx,
      tx,
      data: { ...data, recipientId: recipient.id },
    });
    if (isError(created) || !created) return created;
    const cleared = await clearNoKnownConditions(tx, recipient.id);
    if (cleared) return cleared;
    const change = await writeChange(ctx, tx, {
      condition: created,
      before: null,
      changedAt: changeTimeOf(opts),
      via: opts.via,
    });
    if (isError(change)) return change;
    return created;
  }, ctx);

/**
 * Edit a condition's name, status, since, note or who diagnosed it (writers). What's left out
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
    // Checked when set or changed: one deleted since stays (greyed).
    const diagnosedById = merged.data.diagnosedById;
    if (diagnosedById && diagnosedById.toLowerCase() !== before.diagnosedById?.toLowerCase()) {
      const provider = await checkProvider(ctx, tx, before.groupId, diagnosedById, "diagnosedById");
      if (isError(provider)) return provider;
    }

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
      condition: after,
      before: await sourceOf(tx, before),
      changedAt: changeTimeOf(opts),
      via: opts.via,
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
 * Create the condition with this id if there is none: what PowerSync's
 * upload queue sends for a row a device created. A replay changes nothing
 * (only a PATCH edits), whatever the actor's role now, so it never reverts a
 * newer edit. A replay records no change entry. The group and recipient
 * never change, and an id the actor can't see is refused without saying
 * whether it exists. Says whether it created (`Upserted`).
 */
export const upsert = (
  ctx: ServiceContext,
  input: RecipientConditionUpsertInput,
  opts: ConditionWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = recipientConditionUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId } = parsed.data;

    return createIfAbsent({
      ctx,
      tx,
      getById: recipientConditionModel.getById,
      id,
      create: () => create({ ...ctx, tx }, input, opts),
      immutable: (visible) =>
        visible.groupId !== groupId || (recipientId !== undefined && visible.recipientId !== recipientId)
          ? newError({ code: "recipientConditionService:immutable" })
          : undefined,
    });
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

// ---------------------------------------------------------------------------
// Who manages it (`condition_manager`, slice 3)
// ---------------------------------------------------------------------------

/** A condition's managers now, by id and name (deleted providers too). As the system. */
const managerRefs = async (tx: Tx, conditionId: string) => {
  const links = await conditionManagerModel.list({
    authUser: SYSTEM_USER,
    tx,
    filter: { conditionId: { type: "eq", value: conditionId } },
  });
  if (isError(links)) return links;
  if (!links.data.length) return [] as ConditionProviderRef[];
  const providers = await providerModel.list({
    authUser: SYSTEM_USER,
    tx,
    includeDeleted: true,
    filter: { id: { type: "inArray", value: links.data.map((l) => l.providerId) } },
  });
  if (isError(providers)) return providers;
  return providers.data.map((p): ConditionProviderRef => ({ id: p.id, name: p.name }));
};

/**
 * Record a change to who manages a condition, as the actor: folded into the
 * change entry of `changedAt` when the save already wrote one (its edits, or
 * an earlier link of the same save), else a new `changed` entry.
 */
const recordManagers = async (
  ctx: ServiceContext,
  tx: Tx,
  condition: RecipientCondition,
  before: readonly ConditionProviderRef[],
  after: readonly ConditionProviderRef[],
  changedAt: ChangeTimes,
) => {
  const id = conditionChangeId(condition.id, changedAt.key);
  const existing = await timelineEntryModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
  if (isError(existing)) return existing;
  if (!existing) {
    const source = await sourceOf(tx, condition);
    return writeChange(ctx, tx, {
      condition,
      before: { ...source, managedBy: before },
      source: { ...source, managedBy: after },
      changedAt,
    });
  }
  if (existing.kind !== "conditionChange" || existing.deletedAt) return null;
  const details = conditionChangeDetailsZSchema.safeParse(existing.details);
  if (!details.success) return null;
  const next = withManagersChange(details.data, managerNames(before), managerNames(after));
  if (!next) return null;
  const updated = await timelineEntryModel.update({
    ...ctx,
    tx,
    filter: { id: { type: "eq", value: id } },
    data: { details: next },
  });
  return isError(updated) ? updated : (updated[0] ?? null);
};

/** A condition's manager links, oldest first. Deleted providers' links are included (screens grey them). */
export const listManagers = (ctx: ServiceContext, conditionId: string) =>
  conditionManagerModel.list({
    ...ctx,
    filter: { conditionId: { type: "eq", value: conditionId } },
    orderBy: [{ field: "createdAt", direction: "asc" }],
  });

/**
 * Say a provider manages a condition (writers). Both must be live and in
 * `groupId`. Linking a pair that's already linked returns the existing link
 * (a replay) and records nothing.
 */
export const linkManager = (
  ctx: ServiceContext,
  input: ConditionManagerLinkInput,
  opts: ConditionWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = conditionManagerLinkZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { groupId, conditionId, providerId } = parsed.data;
    const id = conditionManagerId(conditionId, providerId);

    const condition = await visibleCondition(ctx, tx, conditionId);
    if (isError(condition)) return condition;
    if (condition.groupId !== groupId)
      return newError({ code: "recipientConditionService:managerNotInGroup" });
    const provider = await checkProvider(ctx, tx, groupId, providerId, "managedBy");
    if (isError(provider)) return provider;

    const existing = await conditionManagerModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (existing) return existing;

    const before = await managerRefs(tx, conditionId);
    if (isError(before)) return before;
    const created = await conditionManagerModel.create({
      ...ctx,
      tx,
      data: { id, groupId, conditionId, providerId },
    });
    if (isError(created) || !created) return created;
    const after = [...before, { id: provider.id, name: provider.name }];
    const change = await recordManagers(ctx, tx, condition, before, after, changeTimeOf(opts));
    if (isError(change)) return change;
    return created;
  }, ctx);

/**
 * Remove a manager link (a hard delete; writers). Removing one that's
 * already gone is fine (a replay); one the actor can see but not remove is
 * refused.
 */
export const unlinkManager = (ctx: ServiceContext, id: string, opts: ConditionWriteOptions = {}) =>
  withTransaction(async (tx) => {
    const link = await conditionManagerModel.getById(id, { ...ctx, tx });
    if (isError(link)) return link;
    if (!link) {
      const any = await conditionManagerModel.getById(id, { authUser: SYSTEM_USER, tx });
      if (isError(any)) return any;
      return any ? rejectError(ctx.authUser) : { ids: [] as string[] };
    }
    const before = await managerRefs(tx, link.conditionId);
    if (isError(before)) return before;
    const res = await conditionManagerModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
    if (isError(res)) return res.code === "baseModel:remove:nothingRemoved" ? rejectError(ctx.authUser) : res;

    const condition = await recipientConditionModel.getById(link.conditionId, { ...ctx, tx });
    if (isError(condition)) return condition;
    if (condition) {
      const after = before.filter((r) => r.id.toLowerCase() !== link.providerId.toLowerCase());
      const change = await recordManagers(ctx, tx, condition, before, after, changeTimeOf(opts));
      if (isError(change)) return change;
    }
    return res;
  }, ctx);

const setManagersZSchema = z.strictObject({
  conditionId: z.uuid(),
  providerIds: z.array(z.uuid()).max(50),
});
export type SetConditionManagersInput = z.input<typeof setManagersZSchema>;

/**
 * Make a condition's managers exactly `providerIds` (writers): unlinks the
 * rest and links the new ones, in one transaction, recorded as one change
 * entry. Each new one must be a live provider in the condition's group; a
 * deleted provider already linked may stay. Safe to replay. Returns the links.
 */
export const setManagers = (
  ctx: ServiceContext,
  input: SetConditionManagersInput,
  opts: ConditionWriteOptions = {},
) =>
  withTransaction(async (tx) => {
    const parsed = setManagersZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { conditionId } = parsed.data;
    const wanted = new Set(parsed.data.providerIds.map((id) => id.toLowerCase()));
    // One time for every link, so they all land in one entry.
    const once = { changedAt: changeTimeOf(opts).key };

    const condition = await visibleCondition(ctx, tx, conditionId);
    if (isError(condition)) return condition;
    const current = await listManagers({ ...ctx, tx }, conditionId);
    if (isError(current)) return current;
    for (const l of current.data) {
      if (wanted.has(l.providerId.toLowerCase())) continue;
      const res = await unlinkManager({ ...ctx, tx }, l.id, once);
      if (isError(res)) return res;
    }
    const have = new Set(current.data.map((l) => l.providerId.toLowerCase()));
    for (const providerId of wanted) {
      if (have.has(providerId)) continue;
      const res = await linkManager(
        { ...ctx, tx },
        { groupId: condition.groupId, conditionId, providerId },
        once,
      );
      if (isError(res)) return res;
    }
    return listManagers({ ...ctx, tx }, conditionId);
  }, ctx);
