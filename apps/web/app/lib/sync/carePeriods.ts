import type {
  CarePeriodContent,
  CarePeriodContentInput,
  CarePeriodUpdateInput,
  PeriodSpan,
} from "@caretook/data/schema";
import type { ActionResult } from "../api";
import type { SyncDb } from "./index";
import type { ProviderRow } from "./providers";
import type { LocalQuery } from "./timeline";

import {
  BAD_PLACE_ISSUE,
  carePeriodContentOf,
  carePeriodContentZSchema,
  carePeriodStartIssue,
  carePeriodUpdateZSchema,
  DEVICE_FUTURE_SKEW_MS,
  isCarePeriodType,
  periodSpans,
} from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { newProviderRow, providersQuery } from "./providers";
import { carePeriods, noteDocuments, providers } from "./schema";
import {
  forbidden,
  fromLocalTimestamp,
  groupFor,
  nowTimestamp,
  readRows,
  toLocalTimestamp,
  WRITER_ROLES,
} from "./timeline";

// Care periods on this device: local queries for `useLiveQuery` and loaders,
// and local writes that validate with the shared Zod schema and check the
// role, like medications.ts. Writes queue for upload (sync.upload), where
// carePeriodService checks them again. The track (ends, the current period,
// "day N") is worked out by `periodSpans` and friends, never stored.

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type CarePeriodRow = {
  id: string;
  group_id: string | null;
  recipient_id: string | null;
  type: string | null;
  label: string | null;
  place_provider_id: string | null;
  place_detail: string | null;
  started_at: string | null;
  date_only: number | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

export type LocalCarePeriod = CarePeriodContent & {
  id: string;
  groupId: string;
  recipientId: string;
  /** ISO 8601, or null. */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

/**
 * A local row as a period, or null for a half-synced one. A type this build
 * doesn't know (from a newer app version) shows as Other.
 */
export const toCarePeriod = (row: CarePeriodRow): LocalCarePeriod | null => {
  if (!row.group_id || !row.started_at) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    recipientId: row.recipient_id ?? "",
    type: isCarePeriodType(row.type) ? row.type : "other",
    label: row.label,
    placeProviderId: row.place_provider_id,
    placeDetail: row.place_detail,
    startedAt: fromLocalTimestamp(row.started_at),
    dateOnly: row.date_only === 1,
    deletedAt: row.deleted_at ? fromLocalTimestamp(row.deleted_at) : null,
    createdAt: row.created_at ? fromLocalTimestamp(row.created_at) : "",
    updatedAt: row.updated_at ? fromLocalTimestamp(row.updated_at) : "",
    createdBy: row.created_by ?? "",
    updatedBy: row.updated_by ?? "",
  };
};

export const toCarePeriods = (rows: CarePeriodRow[]) =>
  rows.map(toCarePeriod).filter((p): p is LocalCarePeriod => p !== null);

/** A group's track from its local rows: live periods, oldest first, each with its derived end. */
export const toPeriodSpans = (rows: CarePeriodRow[]): PeriodSpan<LocalCarePeriod>[] =>
  periodSpans(toCarePeriods(rows));

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** A group's periods in track order (start, then created, then id), oldest first. Deleted ones only when asked for. */
export const carePeriodsQuery = (groupId: string, opts: { includeDeleted?: boolean } = {}): LocalQuery => ({
  sql: `SELECT * FROM care_period WHERE group_id = ?${opts.includeDeleted ? "" : " AND deleted_at IS NULL"}
        ORDER BY started_at, created_at, id`,
  params: [groupId],
});

/** One period, deleted or not (screens decide: a deleted one's page is a 404). */
export const carePeriodQuery = (id: string): LocalQuery => ({
  sql: "SELECT * FROM care_period WHERE id = ?",
  params: [id],
});

/** What the place picker offers and names: the group's providers, deleted ones too (a removed place keeps its name). */
export const placeChoicesQuery = (groupId: string): LocalQuery =>
  providersQuery(groupId, { includeDeleted: true });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;
export type CarePeriodWriteResult = { ok: true; id: string } | Refusal;

const refuse = (error: string, issues: Refusal["issues"] = []): Refusal => ({ ok: false, error, issues });

const invalid = (error: { issues: { path: PropertyKey[]; message: string }[] }): Refusal =>
  refuse(
    "The care period is invalid",
    error.issues.map(({ path, message }) => ({ path: path.map(String).join("."), message })),
  );

const periodMissing = refuse("That care period is gone. It may have been deleted.");
const badPlace = refuse("The place must be a provider in this care group", [{ ...BAD_PLACE_ISSUE }]);

const writerGroup = async (db: SyncDb, groupId: string) => {
  const group = await groupFor(db, groupId);
  return group?.role && WRITER_ROLES.includes(group.role) ? group : null;
};

const recipientZone = async (db: SyncDb, groupId: string) => {
  const [row] = await readRows<{ id: string; time_zone: string | null }>(db, {
    sql: "SELECT id, time_zone FROM care_recipient WHERE group_id = ?",
    params: [groupId],
  });
  return row ? { id: row.id, timeZone: row.time_zone ?? "UTC" } : null;
};

const livePeriod = async (db: SyncDb, id: string) => {
  const [row] = await readRows<CarePeriodRow>(db, carePeriodQuery(id));
  const period = row ? toCarePeriod(row) : null;
  return period && !period.deletedAt ? period : null;
};

/** A live provider in the group (any type): see `carePeriodService`'s `checkPlace`. */
const placeOk = async (db: SyncDb, groupId: string, id: string) => {
  const [row] = await readRows<Pick<ProviderRow, "group_id" | "deleted_at">>(db, {
    sql: "SELECT group_id, deleted_at FROM provider WHERE id = ?",
    params: [id],
  });
  return !!row && !row.deleted_at && row.group_id === groupId;
};

/** A start in the future (past the device's 5 minutes), or a date-only start off its day's start. */
const startRefusal = (content: CarePeriodContent, timeZone: string) => {
  const issue = carePeriodStartIssue(content, { now: new Date(), skewMs: DEVICE_FUTURE_SKEW_MS, timeZone });
  return issue ? refuse("The care period is invalid", [{ ...issue }]) : null;
};

/**
 * A place to add with the period, by name (the picker's "Add "<typed>" as a
 * new place"): a practice in the directory, written in the period's
 * transaction, first, so it uploads before the period that names it.
 */
export type NewPlace = { name: string } | null;

const newPlaceRow = async (db: SyncDb, groupId: string, place: NewPlace) => {
  if (!place) return null;
  const row = await newProviderRow(db, groupId, { type: "practice", name: place.name });
  if (!("ok" in row)) return row;
  if (!row.issues.length) return row;
  return refuse("The new place is invalid", [
    { path: "placeProviderId", message: row.issues[0]?.message ?? "Check the place's name" },
  ]);
};

const contentColumns = (content: CarePeriodContent) => ({
  type: content.type,
  label: content.label,
  placeProviderId: content.placeProviderId,
  placeDetail: content.placeDetail,
  startedAt: toLocalTimestamp(content.startedAt),
  dateOnly: content.dateOnly ? 1 : 0,
});

/**
 * Start a period on this device (it ends the current one, by coming after it
 * on the track), or add one in the past. `newPlace` adds a place to the
 * directory in the same transaction. It syncs when the device is online.
 */
export const createCarePeriod = async (
  db: SyncDb,
  groupId: string,
  input: CarePeriodContentInput,
  newPlace: NewPlace = null,
): Promise<CarePeriodWriteResult> => {
  if (!(await writerGroup(db, groupId))) return forbidden as Refusal;
  const recipient = await recipientZone(db, groupId);
  if (!recipient) return refuse("This care group has no care recipient yet");

  const place = await newPlaceRow(db, groupId, newPlace);
  if (place && "ok" in place) return place;
  const parsed = carePeriodContentZSchema.safeParse({
    ...input,
    ...(place ? { placeProviderId: place.id } : {}),
  });
  if (!parsed.success) return invalid(parsed.error);
  const start = startRefusal(parsed.data, recipient.timeZone);
  if (start) return start;
  if (!place && parsed.data.placeProviderId && !(await placeOk(db, groupId, parsed.data.placeProviderId)))
    return badPlace;

  const id = crypto.randomUUID();
  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    if (place) await tx.insert(providers).values(place);
    await tx.insert(carePeriods).values({
      id,
      groupId,
      recipientId: recipient.id,
      ...contentColumns(parsed.data),
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: db.userId,
      updatedBy: db.userId,
    });
  });
  return { ok: true, id };
};

/**
 * Edit a period: its type, label, place or start (a moved start moves the
 * end of the period before it). The merged period must be valid; a changed
 * place or start is checked.
 */
export const updateCarePeriod = async (
  db: SyncDb,
  id: string,
  patch: CarePeriodUpdateInput,
  newPlace: NewPlace = null,
): Promise<CarePeriodWriteResult> => {
  const existing = await livePeriod(db, id);
  if (!existing) return periodMissing;
  if (!(await writerGroup(db, existing.groupId))) return forbidden as Refusal;

  const shape = carePeriodUpdateZSchema.safeParse(patch);
  if (!shape.success) return invalid(shape.error);
  const place = await newPlaceRow(db, existing.groupId, newPlace);
  if (place && "ok" in place) return place;
  const defined = Object.fromEntries(
    Object.entries({ ...shape.data, ...(place ? { placeProviderId: place.id } : {}) }).filter(
      ([, v]) => v !== undefined,
    ),
  );
  const before = carePeriodContentOf(existing);
  const merged = carePeriodContentZSchema.safeParse({ ...before, ...defined });
  if (!merged.success) return invalid(merged.error);

  const startChanged =
    new Date(merged.data.startedAt).getTime() !== new Date(existing.startedAt).getTime() ||
    merged.data.dateOnly !== existing.dateOnly;
  if (startChanged) {
    const recipient = await recipientZone(db, existing.groupId);
    const start = startRefusal(merged.data, recipient?.timeZone ?? "UTC");
    if (start) return start;
  }
  if (
    !place &&
    merged.data.placeProviderId &&
    merged.data.placeProviderId !== existing.placeProviderId &&
    !(await placeOk(db, existing.groupId, merged.data.placeProviderId))
  )
    return badPlace;

  await db.drizzle.transaction(async (tx) => {
    if (place) await tx.insert(providers).values(place);
    await tx
      .update(carePeriods)
      .set({ ...contentColumns(merged.data), updatedAt: nowTimestamp(), updatedBy: db.userId })
      .where(eq(carePeriods.id, id));
  });
  return { ok: true, id };
};

/** Soft delete (a period recorded by mistake): the period before it runs on. Deleting what's gone is fine. */
export const removeCarePeriod = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const existing = await livePeriod(db, id);
  if (!existing) return { ok: true };
  if (!(await writerGroup(db, existing.groupId))) return forbidden;
  const now = nowTimestamp();
  await db.drizzle
    .update(carePeriods)
    .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
    .where(eq(carePeriods.id, id));
  return { ok: true };
};

/**
 * The period's notes document (its id is the period's), made on the first
 * real change on its page, like a medication's. Making one that's already
 * there is fine. The period must be live and the user a writer.
 */
export const createCarePeriodDocument = async (db: SyncDb, periodId: string): Promise<ActionResult> => {
  const period = await livePeriod(db, periodId);
  if (!period) return periodMissing;
  if (!(await writerGroup(db, period.groupId))) return forbidden;
  const existing = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM note_document WHERE id = ?",
    params: [periodId],
  });
  if (existing.length) return { ok: true };
  const now = nowTimestamp();
  await db.drizzle.insert(noteDocuments).values({
    id: periodId,
    groupId: period.groupId,
    subject: "carePeriod",
    entryId: null,
    providerId: null,
    medicationId: null,
    carePeriodId: periodId,
    snapshot: null,
    text: "",
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  });
  return { ok: true };
};
