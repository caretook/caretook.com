import type { z } from "zod";
import type { CarePeriodCreateInput, CarePeriodUpdateInput, CarePeriodUpsertInput, Tx } from "../db";
import type { IncludeDeleted } from "../models/carePeriod";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  BAD_PLACE_ISSUE,
  carePeriodContentOf,
  carePeriodContentZSchema,
  carePeriodCreateZSchema,
  carePeriodStartIssue,
  carePeriodUpdateZSchema,
  carePeriodUpsertZSchema,
  FUTURE_START_ISSUE,
  SERVER_FUTURE_SKEW_MS,
} from "../db/schema";
import { isError, newError } from "../errors";
import { carePeriodModel, careGroupModel, careRecipientModel, providerModel } from "../models";
import { rejectError } from "../permissions";
import { asCreated, unchanged } from "./upserted";

// Care periods: where the recipient's care happens, over time. Write through
// here, not the model: this is where content is validated, the place is
// checked and starts in the future are refused. The track itself (ends,
// ties, the current period) is derived, never stored: carePeriodTrack.ts.

export const schemaName = carePeriodModel.schemaName;

const issuesOf = (error: z.ZodError) =>
  error.issues.map(({ path, message }) => ({ path: path.join("."), message }));

const invalid = (error: z.ZodError) =>
  newError({ code: "carePeriodService:invalid", meta: { issues: issuesOf(error) } });

const notFound = () => newError({ code: "carePeriodService:notFound" });
const badPlace = () =>
  newError({ code: "carePeriodService:badPlace", meta: { issues: [{ ...BAD_PLACE_ISSUE }] } });

/** A start in the future, or a date-only start that isn't at the start of its day. */
const startRefusal = (
  content: { startedAt: string; dateOnly: boolean },
  timeZone: string,
  now = new Date(),
) => {
  const issue = carePeriodStartIssue(content, { now, skewMs: SERVER_FUTURE_SKEW_MS, timeZone });
  if (!issue) return null;
  return issue === FUTURE_START_ISSUE
    ? newError({ code: "carePeriodService:futureStart", meta: { issues: [{ ...issue }] } })
    : newError({ code: "carePeriodService:invalid", meta: { issues: [{ ...issue }] } });
};

/**
 * The recipient a period is for: `recipientId` when given (it must be in the
 * group), else the group's only recipient. Reads are scoped to the actor, so
 * a non-member learns nothing about the group.
 */
const resolveRecipient = async (ctx: ServiceContext, tx: Tx, groupId: string, recipientId?: string) => {
  const group = await careGroupModel.getById(groupId, { ...ctx, tx });
  if (isError(group)) return group;
  if (!group) return rejectError(ctx.authUser);

  if (recipientId) {
    const recipient = await careRecipientModel.getById(recipientId, { ...ctx, tx });
    if (isError(recipient)) return recipient;
    if (recipient?.groupId !== groupId) return newError({ code: "carePeriodService:recipientNotInGroup" });
    return recipient;
  }

  const recipient = await careRecipientModel.get({
    ...ctx,
    tx,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(recipient)) return recipient;
  return recipient ?? newError({ code: "carePeriodService:noRecipient" });
};

/**
 * The place must be a live provider in the group (any type). Checked when
 * set or changed: a provider deleted later stays linked, and shows greyed.
 */
const checkPlace = async (ctx: ServiceContext, tx: Tx, groupId: string, placeProviderId: string | null) => {
  if (!placeProviderId) return null;
  const provider = await providerModel.getById(placeProviderId, { ...ctx, tx });
  if (isError(provider)) return provider;
  return !provider || provider.groupId !== groupId ? badPlace() : null;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One period, if the actor can see it. Deleted ones only with `includeDeleted`. */
export const getById = (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) =>
  carePeriodModel.getById(id, { ...ctx, ...opts });

/** A group's periods in track order (oldest first): pass them to `periodSpans` for the ends. */
export const list = (ctx: ServiceContext, { groupId, ...opts }: IncludeDeleted & { groupId: string }) =>
  carePeriodModel.list({ ...ctx, ...opts, filter: { groupId: { type: "eq", value: groupId } } });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Start a period (it ends the one before it, by being after it on the
 * track), or add one in the past. `id` may come from an offline device.
 * Writers only.
 */
export const create = (ctx: ServiceContext, input: CarePeriodCreateInput) =>
  withTransaction(async (tx) => {
    const parsed = carePeriodCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { recipientId, ...data } = parsed.data;

    const recipient = await resolveRecipient(ctx, tx, data.groupId, recipientId);
    if (isError(recipient)) return recipient;

    const start = startRefusal(data, recipient.timeZone);
    if (start) return start;
    const place = await checkPlace(ctx, tx, data.groupId, data.placeProviderId);
    if (place) return place;

    return carePeriodModel.create({ ...ctx, tx, data: { ...data, recipientId: recipient.id } });
  }, ctx);

/**
 * Edit a period: its type, label, place or start (moving a start moves the
 * end of the period before it, since ends are derived). The group and
 * recipient are fixed; the merged period must be valid. A changed place or
 * start is checked.
 */
export const update = (ctx: ServiceContext, id: string, input: CarePeriodUpdateInput) =>
  withTransaction(async (tx) => {
    const parsed = carePeriodUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const existing = await carePeriodModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const before = carePeriodContentOf(existing);
    const merged = carePeriodContentZSchema.safeParse({ ...before, ...patch });
    if (!merged.success) return invalid(merged.error);

    const startChanged =
      new Date(merged.data.startedAt).getTime() !== new Date(before.startedAt).getTime() ||
      merged.data.dateOnly !== before.dateOnly;
    if (startChanged) {
      const recipient = await careRecipientModel.getById(existing.recipientId, { authUser: SYSTEM_USER, tx });
      if (isError(recipient)) return recipient;
      const start = startRefusal(merged.data, recipient?.timeZone ?? "UTC");
      if (start) return start;
    }
    if (merged.data.placeProviderId !== existing.placeProviderId) {
      const place = await checkPlace(ctx, tx, existing.groupId, merged.data.placeProviderId);
      if (place) return place;
    }

    const updated = await carePeriodModel.update({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
      data: merged.data,
    });
    // Visible but not writable: a viewer.
    if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
      return rejectError(ctx.authUser);
    if (isError(updated)) return updated;
    return updated[0] ?? null;
  }, ctx);

/**
 * Create the period with this id if there is none: what PowerSync's upload
 * queue sends for a row a device created. A replay changes nothing (only a
 * PATCH edits), whatever the actor's role now, so it never reverts a newer
 * edit. The group and recipient never change, and an id the actor can't see is refused
 * without saying whether it exists. Says whether it created (`Upserted`).
 */
export const upsert = (ctx: ServiceContext, input: CarePeriodUpsertInput) =>
  withTransaction(async (tx) => {
    const parsed = carePeriodUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId } = parsed.data;

    const existing = await carePeriodModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
    if (isError(existing)) return existing;
    if (!existing) return asCreated(await create({ ...ctx, tx }, input));

    const visible = await carePeriodModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);
    if (visible.groupId !== groupId || (recipientId !== undefined && visible.recipientId !== recipientId))
      return newError({ code: "carePeriodService:immutable" });
    return unchanged(visible);
  }, ctx);

/** Soft delete (a period recorded by mistake). The period before it runs on in its place. */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const res = await carePeriodModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
    if (!isError(res) || res.code !== "baseModel:remove:nothingRemoved") return res;
    // Visible but not removable: a viewer. Otherwise gone, or never theirs.
    const visible = await carePeriodModel.getById(id, { ...ctx, tx });
    if (isError(visible)) return visible;
    return visible ? rejectError(ctx.authUser) : notFound();
  }, ctx);
