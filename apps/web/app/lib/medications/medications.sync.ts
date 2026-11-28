import type {
  DoseDetails,
  DoseInput,
  MedicationChangeDetails,
  MedicationContent,
  MedicationContentInput,
  MedicationSchedule,
  MedicationStatus,
  MedicationUpdateInput,
} from "@caretook/data/schema";
import type { ActionResult } from "../core/api";
import type { SyncDb } from "../sync/index";
import type { ProviderRow } from "../providers/providers.sync";
import type { EntryRow, LocalQuery } from "../timeline/timeline.sync";

import {
  BAD_PHARMACY_ISSUE,
  BAD_PRESCRIBER_ISSUE,
  doseDetailsZSchema,
  doseSlotIdFor,
  isPharmacyType,
  isPrescriberType,
  MEDICATION_FORMS,
  MEDICATION_STATUSES,
  MEDICATION_STOP_REASONS,
  medicationChange,
  medicationChangeDetailsZSchema,
  medicationChangeId,
  medicationContentOf,
  medicationContentZSchema,
  medicationFormContentZSchema,
  medicationUpdateZSchema,
  parseMedicationSchedule,
  schedulePassIds,
  timelineEntryContentZSchema,
  withoutPass,
} from "@caretook/data/schema";
import { MEDICATION_TYPES, dayInZone } from "@caretook/data/domain";
import { eq } from "drizzle-orm";
import { changedColumns } from "../core/changedColumns";
import { newProviderRow } from "../providers/providers.sync";
import { medications, noteDocuments, providers, timelineEntries } from "../sync/schema";
import {
  forbidden,
  fromLocalTimestamp,
  groupFor,
  nowTimestamp,
  readRows,
  toLocalTimestamp,
  WRITER_ROLES,
  mayChangeEntry,
  mayLog,
} from "../timeline/timeline.sync";

// The medication list, doses and medication changes on this device: local
// queries for `useLiveQuery` and loaders, and local writes that validate with
// the shared Zod schemas and check the role, like timeline.ts and
// providers.ts. Writes queue for upload (sync.upload), where
// medicationService and timelineEntryService check them again.
//
// Doses and changes are timeline entries (kinds `dose` and
// `medicationChange`). A change entry is written here in the same local
// transaction as the medication, with the id the server derives for the same
// save (`medicationChangeId`), so the two are one row.

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type MedicationRow = {
  id: string;
  group_id: string | null;
  recipient_id: string | null;
  name: string | null;
  strength: string | null;
  form: string | null;
  dose: string | null;
  directions: string | null;
  reason: string | null;
  schedule: string | null;
  status: string | null;
  started_on: string | null;
  stopped_on: string | null;
  stop_reason: string | null;
  stop_note: string | null;
  prescriber_id: string | null;
  pharmacy_id: string | null;
  last_filled_on: string | null;
  quantity: string | null;
  refills_left: number | null;
  rx_number: string | null;
  type: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

export type LocalMedication = MedicationContent & {
  id: string;
  groupId: string;
  recipientId: string;
  /** ISO 8601, or null. Deleted medications only reach screens through their doses and changes. */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

const oneOf = <T extends string>(values: readonly T[], value: string | null): T | null =>
  (values as readonly (string | null)[]).includes(value) ? (value as T) : null;

/**
 * A local row as a medication, or null for one this build can't show (a
 * schedule from a newer app version, a half-synced row).
 */
export const toMedication = (row: MedicationRow): LocalMedication | null => {
  const schedule = parseMedicationSchedule(row.schedule);
  if (!schedule || !row.group_id || !row.name) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    recipientId: row.recipient_id ?? "",
    name: row.name,
    strength: row.strength,
    form: oneOf(MEDICATION_FORMS, row.form),
    dose: row.dose,
    directions: row.directions,
    reason: row.reason,
    schedule,
    status: oneOf(MEDICATION_STATUSES, row.status) ?? "current",
    startedOn: row.started_on,
    stoppedOn: row.stopped_on,
    stopReason: oneOf(MEDICATION_STOP_REASONS, row.stop_reason),
    stopNote: row.stop_note,
    prescriberId: row.prescriber_id,
    pharmacyId: row.pharmacy_id,
    lastFilledOn: row.last_filled_on,
    quantity: row.quantity,
    refillsLeft: row.refills_left,
    rxNumber: row.rx_number,
    type: oneOf(MEDICATION_TYPES, row.type),
    deletedAt: row.deleted_at ? fromLocalTimestamp(row.deleted_at) : null,
    createdAt: row.created_at ? fromLocalTimestamp(row.created_at) : "",
    updatedAt: row.updated_at ? fromLocalTimestamp(row.updated_at) : "",
    createdBy: row.created_by ?? "",
    updatedBy: row.updated_by ?? "",
  };
};

export const toMedications = (rows: MedicationRow[]) =>
  rows.map(toMedication).filter((m): m is LocalMedication => m !== null);

type EntryBase = {
  id: string;
  groupId: string;
  /** ISO 8601. */
  occurredAt: string;
  timeZone: string;
  createdAt: string;
  createdBy: string;
};
export type DoseEntry = EntryBase & { kind: "dose"; details: DoseDetails };
export type MedicationChangeEntry = EntryBase & {
  kind: "medicationChange";
  details: MedicationChangeDetails;
};
export type MedicationEntry = DoseEntry | MedicationChangeEntry;

const parseJson = (value: string | null): unknown => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/** A local timeline row as a dose or a medication change, or null for anything else or malformed. */
export const toMedicationEntry = (row: EntryRow): MedicationEntry | null => {
  if (!row.occurred_at || !row.group_id) return null;
  const base: EntryBase = {
    id: row.id,
    groupId: row.group_id,
    occurredAt: fromLocalTimestamp(row.occurred_at),
    timeZone: row.time_zone ?? "UTC",
    createdAt: row.created_at ? fromLocalTimestamp(row.created_at) : "",
    createdBy: row.created_by ?? "",
  };
  if (row.kind === "dose") {
    const details = doseDetailsZSchema.safeParse(parseJson(row.details));
    return details.success ? { ...base, kind: "dose", details: details.data } : null;
  }
  if (row.kind === "medicationChange") {
    const details = medicationChangeDetailsZSchema.safeParse(parseJson(row.details));
    return details.success ? { ...base, kind: "medicationChange", details: details.data } : null;
  }
  return null;
};

export const toMedicationEntries = (rows: EntryRow[]) =>
  rows.map(toMedicationEntry).filter((e): e is MedicationEntry => e !== null);

export const isDoseEntry = (entry: MedicationEntry): entry is DoseEntry => entry.kind === "dose";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** `%` and `_` are LIKE's wildcards: escape them (with `\`) so typed text matches itself. */
const likePattern = (word: string) => `%${word.replace(/[\\%_]/g, "\\$&")}%`;

export type MedicationListOptions = {
  /** One status, or every status when null or left out. */
  status?: MedicationStatus | null;
  /** Search text: every word must be in the name or the reason (case ignored). */
  q?: string | null;
  includeDeleted?: boolean;
};

/**
 * A group's medications: current ones first, then the rest, each by name.
 * Deleted ones are left out unless asked for.
 */
export const medicationsQuery = (groupId: string, opts: MedicationListOptions = {}): LocalQuery => {
  const words = (opts.q ?? "").trim().split(/\s+/).filter(Boolean);
  const where = [
    "group_id = ?",
    ...(opts.includeDeleted ? [] : ["deleted_at IS NULL"]),
    ...(opts.status ? ["status = ?"] : []),
    ...words.map(() => `(name LIKE ? ESCAPE '\\' OR IFNULL(reason, '') LIKE ? ESCAPE '\\')`),
  ];
  return {
    sql: `SELECT * FROM medication WHERE ${where.join(" AND ")}
          ORDER BY status = 'current' DESC, name COLLATE NOCASE, id`,
    params: [
      groupId,
      ...(opts.status ? [opts.status] : []),
      ...words.flatMap((word) => [likePattern(word), likePattern(word)]),
    ],
  };
};

/** One medication, deleted or not (screens decide: a deleted one's page is a 404). */
export const medicationQuery = (id: string): LocalQuery => ({
  sql: "SELECT * FROM medication WHERE id = ?",
  params: [id],
});

export type MedicationEntryKind = MedicationEntry["kind"];

/**
 * A medication's history: its doses and changes (not deleted), newest
 * first. `kind` narrows it to one of the two.
 */
export const medicationEntriesQuery = (medicationId: string, kind?: MedicationEntryKind): LocalQuery => ({
  sql: `SELECT * FROM timeline_entry
        WHERE ${kind ? "kind = ?" : "kind IN ('dose', 'medicationChange')"}
          AND deleted_at IS NULL AND json_extract(details, '$.medicationId') = ?
        ORDER BY occurred_at DESC, id DESC`,
  params: kind ? [kind, medicationId] : [medicationId],
});

/**
 * The group's doses (not deleted) that happened from `from` up to, but not
 * including, `to`, oldest first: one day's, when the caller passes the
 * recipient's day (see `dayBounds`).
 */
export const groupDosesQuery = (groupId: string, from: string | Date, to: string | Date): LocalQuery => ({
  sql: `SELECT * FROM timeline_entry
        WHERE group_id = ? AND kind = 'dose' AND deleted_at IS NULL
          AND occurred_at >= ? AND occurred_at < ?
        ORDER BY occurred_at, id`,
  params: [groupId, toLocalTimestamp(from), toLocalTimestamp(to)],
});

export type MedicationNameRow = { name: string; last_used: string | null };

/**
 * Every name the group has used (any status, deleted ones left out), most
 * recently saved first, one row per name whatever its case: the history
 * behind name suggestions.
 */
export const medicationNamesQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT name, MAX(updated_at) AS last_used FROM medication
        WHERE group_id = ? AND deleted_at IS NULL AND name IS NOT NULL
        GROUP BY name COLLATE NOCASE
        ORDER BY last_used DESC, name COLLATE NOCASE`,
  params: [groupId],
});

export type RecipientRow = {
  id: string;
  group_id: string | null;
  name: string | null;
  preferred_name: string | null;
  time_zone: string | null;
  date_of_birth: string | null;
};

/** The group's care recipient, with the time zone schedule times are in and the date of birth. */
export const recipientQuery = (groupId: string): LocalQuery => ({
  sql: "SELECT id, group_id, name, preferred_name, time_zone, date_of_birth FROM care_recipient WHERE group_id = ?",
  params: [groupId],
});

// ---------------------------------------------------------------------------
// Days in the recipient's zone
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;
export type MedicationWriteResult = { ok: true; id: string } | Refusal;

const refuse = (error: string, issues: Refusal["issues"] = []): Refusal => ({ ok: false, error, issues });

const invalid = (
  error: { issues: { path: PropertyKey[]; message: string }[] },
  what = "The medication is invalid",
): Refusal =>
  refuse(
    what,
    error.issues.map(({ path, message }) => ({ path: path.map(String).join("."), message })),
  );

const medicationMissing = refuse("That medication is gone. It may have been deleted.");
const doseMissing = refuse("That entry is gone. It may have been deleted.");
const badPrescriber = refuse("The prescriber must be a clinician or practice in this care group", [
  { ...BAD_PRESCRIBER_ISSUE },
]);
const badPharmacy = refuse("The pharmacy must be a pharmacy in this care group", [{ ...BAD_PHARMACY_ISSUE }]);

const canWrite = async (db: SyncDb, groupId: string) => {
  const group = await groupFor(db, groupId);
  return !!group?.role && WRITER_ROLES.includes(group.role);
};

const localMedication = async (db: SyncDb, id: string) => {
  const [row] = await readRows<MedicationRow>(db, medicationQuery(id));
  return row ? toMedication(row) : null;
};

const liveMedication = async (db: SyncDb, id: string) => {
  const medication = await localMedication(db, id);
  return medication && !medication.deletedAt ? medication : null;
};

const recipientOf = async (db: SyncDb, groupId: string) => {
  const [row] = await readRows<RecipientRow>(db, recipientQuery(groupId));
  return row ?? null;
};

/** A live provider of an allowed type in the group (see `medicationService`'s `checkProviders`). */
const providerOk = async (db: SyncDb, groupId: string, id: string, allowed: (type: string) => boolean) => {
  const [row] = await readRows<Pick<ProviderRow, "group_id" | "type" | "deleted_at">>(db, {
    sql: "SELECT group_id, type, deleted_at FROM provider WHERE id = ?",
    params: [id],
  });
  return !!row && !row.deleted_at && row.group_id === groupId && allowed(row.type ?? "");
};

/**
 * The prescriber and pharmacy are checked when set or changed; one deleted
 * later stays linked. `added` are providers written in the same transaction
 * (new, so not on the device yet, and of the right type by construction).
 */
const checkProviders = async (
  db: SyncDb,
  groupId: string,
  { prescriberId, pharmacyId }: { prescriberId: string | null; pharmacyId: string | null },
  added: ReadonlySet<string> = new Set(),
) => {
  if (
    prescriberId &&
    !added.has(prescriberId) &&
    !(await providerOk(db, groupId, prescriberId, isPrescriberType))
  )
    return badPrescriber;
  if (pharmacyId && !added.has(pharmacyId) && !(await providerOk(db, groupId, pharmacyId, isPharmacyType)))
    return badPharmacy;
  return null;
};

const badPass = refuse("Choose med times in this care group", [
  { path: "schedule", message: "Choose med times in this care group" },
]);

/**
 * The schedule's passes must be the group's (see `medicationService`'s
 * `checkPasses`). One deleted since this form opened becomes a time of its
 * own, as the pass's deletion made every other medication's.
 */
const checkPasses = async (
  db: SyncDb,
  groupId: string,
  schedule: MedicationSchedule,
): Promise<MedicationSchedule | Refusal> => {
  let checked = schedule;
  for (const passId of schedulePassIds(schedule)) {
    const [row] = await readRows<{ group_id: string | null; time: string | null; deleted_at: string | null }>(
      db,
      { sql: "SELECT group_id, time, deleted_at FROM medication_pass WHERE id = ?", params: [passId] },
    );
    if (!row?.time || row.group_id !== groupId) return badPass;
    if (row.deleted_at) checked = withoutPass(checked, { id: passId, time: row.time });
  }
  return checked;
};

/**
 * A prescriber or pharmacy to add with the medication, by name (the form's
 * "Add "<typed>" as a new prescriber"): a clinician, and a pharmacy. They're
 * written in the medication's transaction, first, so neither is ever left
 * without the other, and they upload before the medication that names them.
 */
export type NewMedicationProviders = { prescriber?: string; pharmacy?: string };

type ProviderRowToAdd = Exclude<Awaited<ReturnType<typeof newProviderRow>>, Refusal>;

/** The new providers' rows, validated, and the ids the medication takes; or the refusal, on its field. */
const newProviderRows = async (db: SyncDb, groupId: string, names: NewMedicationProviders) => {
  const rows: ProviderRowToAdd[] = [];
  const ids: { prescriberId?: string; pharmacyId?: string } = {};
  const wanted = [
    ["prescriberId", names.prescriber, "clinician"],
    ["pharmacyId", names.pharmacy, "pharmacy"],
  ] as const;
  for (const [field, name, type] of wanted) {
    if (name === undefined) continue;
    const row = await newProviderRow(db, groupId, { type, name });
    if ("ok" in row) {
      if (!row.issues.length) return row;
      const what = field === "prescriberId" ? "prescriber" : "pharmacy";
      return refuse(`The new ${what} is invalid`, [
        { path: field, message: row.issues[0]?.message ?? `Check the ${what}'s name` },
      ]);
    }
    rows.push(row);
    ids[field] = row.id;
  }
  return { rows, ids, added: new Set(rows.map((r) => r.id)) };
};

const contentColumns = (content: MedicationContent) => ({
  name: content.name,
  strength: content.strength,
  form: content.form,
  dose: content.dose,
  directions: content.directions,
  reason: content.reason,
  schedule: JSON.stringify(content.schedule),
  status: content.status,
  startedOn: content.startedOn,
  stoppedOn: content.stoppedOn,
  stopReason: content.stopReason,
  stopNote: content.stopNote,
  prescriberId: content.prescriberId,
  pharmacyId: content.pharmacyId,
  lastFilledOn: content.lastFilledOn,
  quantity: content.quantity,
  refillsLeft: content.refillsLeft,
  rxNumber: content.rxNumber,
  type: content.type,
});

/**
 * The timeline row for what a save did, or null when the timeline records
 * nothing for it (refills, reason, providers). `now` is the medication's new
 * `updated_at`: the entry's time, and with the medication's id, its id.
 */
const changeEntryRow = (
  userId: string,
  medication: { id: string; groupId: string; recipientId: string },
  before: MedicationContent | null,
  after: MedicationContent,
  now: string,
  timeZone: string,
) => {
  const change = medicationChange(before, after);
  if (!change) return null;
  return {
    id: medicationChangeId(medication.id, now),
    groupId: medication.groupId,
    recipientId: medication.recipientId,
    kind: "medicationChange",
    occurredAt: now,
    timeZone,
    title: null,
    body: null,
    details: JSON.stringify({ medicationId: medication.id, ...change }),
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  };
};

/**
 * How a write validates. `requireType`: the save comes from a form that asks
 * for the type (the medication form), so a missing one is refused on its
 * field; other writes accept none (it stays as it was, or null).
 */
export type MedicationWriteOptions = { requireType?: boolean };

const contentSchema = ({ requireType }: MedicationWriteOptions) =>
  requireType ? medicationFormContentZSchema : medicationContentZSchema;

/** Who writes a new medication, when, and its id and recipient: what its rows need besides the content. */
export type NewMedicationContext = {
  id: string;
  /** Its `created_at` and `updated_at`, and its "started" entry's time (as `nowTimestamp` gives it). */
  now: string;
  groupId: string;
  recipient: { id: string; timeZone: string };
  userId: string;
};

/** A new medication's row and its "started" entry, from validated content. Pure. */
const medicationRows = (content: MedicationContent, ctx: NewMedicationContext) => {
  const medication = {
    id: ctx.id,
    groupId: ctx.groupId,
    recipientId: ctx.recipient.id,
    ...contentColumns(content),
    deletedAt: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  };
  const entry = changeEntryRow(ctx.userId, medication, null, content, ctx.now, ctx.recipient.timeZone);
  return { medication, entry };
};

/** A medication's row and its "started" entry, validated: what `createMedication` writes. */
export const newMedicationRows = async (
  db: SyncDb,
  groupId: string,
  input: MedicationContentInput,
  added: ReadonlySet<string> = new Set(),
  opts: MedicationWriteOptions = {},
) => {
  if (!(await canWrite(db, groupId))) return forbidden as Refusal;
  const recipient = await recipientOf(db, groupId);
  if (!recipient) return refuse("This care group has no care recipient yet");
  const parsed = contentSchema(opts).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const badProviders = await checkProviders(db, groupId, parsed.data, added);
  if (badProviders) return badProviders;
  const schedule = await checkPasses(db, groupId, parsed.data.schedule);
  if ("ok" in schedule) return schedule;
  const content = { ...parsed.data, schedule };
  return medicationRows(content, {
    id: crypto.randomUUID(),
    now: nowTimestamp(),
    groupId,
    recipient: { id: recipient.id, timeZone: recipient.time_zone ?? "UTC" },
    userId: db.userId,
  });
};

/**
 * Add a medication on this device, with its "started" entry on the timeline
 * in the same transaction (the medication first, so it uploads first), and
 * any prescriber or pharmacy added with it before both. It syncs when the
 * device is online.
 */
export const createMedication = async (
  db: SyncDb,
  groupId: string,
  input: MedicationContentInput,
  newProviders: NewMedicationProviders = {},
  opts: MedicationWriteOptions = {},
): Promise<MedicationWriteResult> => {
  if (!(await canWrite(db, groupId))) return forbidden as Refusal;
  const added = await newProviderRows(db, groupId, newProviders);
  if ("ok" in added) return added;
  const rows = await newMedicationRows(db, groupId, { ...input, ...added.ids }, added.added, opts);
  if ("ok" in rows) return rows;
  await db.drizzle.transaction(async (tx) => {
    for (const provider of added.rows) await tx.insert(providers).values(provider);
    await tx.insert(medications).values(rows.medication);
    if (rows.entry) await tx.insert(timelineEntries).values(rows.entry);
  });
  return { ok: true, id: rows.medication.id };
};

/**
 * Edit a medication, including stopping and restarting it (`status`). The
 * group and recipient are fixed; the merged medication must be valid. A stop,
 * a restart or an edit to a tracked field writes its change entry in the
 * same transaction, and a prescriber or pharmacy added with the edit goes in
 * it first. Only the columns that changed are written (the schedule compared
 * as JSON), so an edit that changes nothing queues nothing.
 */
export const updateMedication = async (
  db: SyncDb,
  id: string,
  patch: MedicationUpdateInput,
  newProviders: NewMedicationProviders = {},
  opts: MedicationWriteOptions = {},
): Promise<MedicationWriteResult> => {
  const existing = await liveMedication(db, id);
  if (!existing) return medicationMissing;
  if (!(await canWrite(db, existing.groupId))) return forbidden as Refusal;

  const shape = medicationUpdateZSchema.safeParse(patch);
  if (!shape.success) return invalid(shape.error);
  const added = await newProviderRows(db, existing.groupId, newProviders);
  if ("ok" in added) return added;
  const defined = Object.fromEntries(
    Object.entries({ ...shape.data, ...added.ids }).filter(([, v]) => v !== undefined),
  );
  const before = medicationContentOf(existing);
  const merged = contentSchema(opts).safeParse({ ...before, ...defined });
  if (!merged.success) return invalid(merged.error);
  const badProviders = await checkProviders(
    db,
    existing.groupId,
    {
      prescriberId: merged.data.prescriberId !== existing.prescriberId ? merged.data.prescriberId : null,
      pharmacyId: merged.data.pharmacyId !== existing.pharmacyId ? merged.data.pharmacyId : null,
    },
    added.added,
  );
  if (badProviders) return badProviders;
  const schedule = await checkPasses(db, existing.groupId, merged.data.schedule);
  if ("ok" in schedule) return schedule;
  const after = { ...merged.data, schedule };

  // Only what changed: the schedule rewritten unchanged would be re-sent and
  // overwrite a co-member's newer one on the server.
  const changed = changedColumns(contentColumns(before), contentColumns(after), ["schedule"]);
  if (!Object.keys(changed).length && !added.rows.length) return { ok: true, id };

  const recipient = await recipientOf(db, existing.groupId);
  const now = nowTimestamp();
  const entry = changeEntryRow(db.userId, existing, before, after, now, recipient?.time_zone ?? "UTC");
  await db.drizzle.transaction(async (tx) => {
    for (const provider of added.rows) await tx.insert(providers).values(provider);
    await tx
      .update(medications)
      .set({ ...changed, updatedAt: now, updatedBy: db.userId })
      .where(eq(medications.id, id));
    if (entry) await tx.insert(timelineEntries).values(entry);
  });
  return { ok: true, id };
};

export type MedicationStatusChange =
  | { status: "current" }
  | { status: "completed"; stoppedOn?: string; stopNote?: string | null }
  | {
      status: "discontinued";
      stopReason: MedicationUpdateInput["stopReason"];
      stoppedOn?: string;
      stopNote?: string | null;
    };

/**
 * Mark a medication completed or discontinued, or restart it. The stop date
 * defaults to today in the recipient's time zone. Writes the "stopped" or
 * "resumed" entry with it (through `updateMedication`).
 */
export const changeMedicationStatus = async (
  db: SyncDb,
  id: string,
  change: MedicationStatusChange,
): Promise<MedicationWriteResult> => {
  if (change.status === "current") return updateMedication(db, id, { status: "current" });
  const existing = await liveMedication(db, id);
  if (!existing) return medicationMissing;
  const recipient = await recipientOf(db, existing.groupId);
  return updateMedication(db, id, {
    ...change,
    stoppedOn: change.stoppedOn ?? dayInZone(new Date(), recipient?.time_zone ?? "UTC"),
  });
};

/**
 * Soft delete (a medication added by mistake), so the deletion syncs and its
 * doses and changes keep its name. No change entry.
 */
export const removeMedication = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const existing = await liveMedication(db, id);
  if (!existing) return { ok: true };
  if (!(await canWrite(db, existing.groupId))) return forbidden;
  const now = nowTimestamp();
  await db.drizzle
    .update(medications)
    .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
    .where(eq(medications.id, id));
  return { ok: true };
};

/**
 * The medication's notes document (its id is the medication's), made on the
 * first real change on its page, like a provider's. Making one that's
 * already there is fine. The medication must be live and the user a writer.
 */
export const createMedicationDocument = async (db: SyncDb, medicationId: string): Promise<ActionResult> => {
  const medication = await liveMedication(db, medicationId);
  if (!medication) return medicationMissing;
  if (!(await canWrite(db, medication.groupId))) return forbidden;
  const existing = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM note_document WHERE id = ?",
    params: [medicationId],
  });
  if (existing.length) return { ok: true };
  const now = nowTimestamp();
  await db.drizzle.insert(noteDocuments).values({
    id: medicationId,
    groupId: medication.groupId,
    subject: "medication",
    entryId: null,
    providerId: null,
    medicationId,
    snapshot: null,
    text: "",
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  });
  return { ok: true };
};

// ---------------------------------------------------------------------------
// Doses
// ---------------------------------------------------------------------------

export type { DoseInput } from "@caretook/data/schema";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const doseContent = (details: unknown, { occurredAt, timeZone }: { occurredAt: string; timeZone: string }) =>
  timelineEntryContentZSchema.safeParse({ kind: "dose", occurredAt, timeZone, details });

const liveMedicationEntry = async (db: SyncDb, id: string) => {
  const [row] = await readRows<EntryRow>(db, {
    sql: "SELECT * FROM timeline_entry WHERE id = ? AND deleted_at IS NULL",
    params: [id],
  });
  return row ? toMedicationEntry(row) : null;
};

type ParsedDoseTime = { occurredAt: string; timeZone: string };
type ParsedDose = ParsedDoseTime & { details?: unknown };

/** A dose's timeline row, from its validated content (`doseContent`). Pure. */
const doseRow = (
  dose: ParsedDose,
  medication: { recipientId: string },
  ctx: { id: string; now: string; groupId: string; userId: string },
): typeof timelineEntries.$inferInsert & { id: string } => ({
  id: ctx.id,
  groupId: ctx.groupId,
  recipientId: medication.recipientId,
  kind: "dose",
  occurredAt: toLocalTimestamp(dose.occurredAt),
  timeZone: dose.timeZone,
  title: null,
  body: null,
  details: JSON.stringify(dose.details),
  deletedAt: null,
  createdAt: ctx.now,
  updatedAt: ctx.now,
  createdBy: ctx.userId,
  updatedBy: ctx.userId,
});

/**
 * The id a planned dose takes on this device: its slot's (`doseSlotIdFor`),
 * unless a row here has it, live or deleted, or the batch already used it
 * (`used`); then a random one, so a deliberate extra dose or one logged again
 * after an Undo is a new row.
 */
const plannedDoseId = async (
  db: SyncDb,
  { occurredAt, details }: { occurredAt: string; details: DoseDetails },
  timeZone: string,
  used: ReadonlySet<string>,
) => {
  const [pass] = details.passId
    ? await readRows<{ time: string | null }>(db, {
        sql: "SELECT time FROM medication_pass WHERE id = ? AND deleted_at IS NULL",
        params: [details.passId],
      })
    : [];
  const slotId = doseSlotIdFor({ ...details, occurredAt }, { timeZone, passTime: pass?.time });
  if (!slotId || used.has(slotId)) return crypto.randomUUID();
  const [taken] = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM timeline_entry WHERE id = ?",
    params: [slotId],
  });
  return taken ? crypto.randomUUID() : slotId;
};

/**
 * Inside the write's transaction, give any dose whose id a row has taken since
 * it was planned (a double tap, a row just synced down) a random id. Changes
 * `rows` in place, so a caller's ids stay right.
 */
export const claimDoseIds = async (
  tx: Pick<SyncDb["drizzle"], "select">,
  rows: readonly (typeof timelineEntries.$inferInsert)[],
) => {
  for (const row of rows) {
    const [taken] = await tx
      .select({ id: timelineEntries.id })
      .from(timelineEntries)
      .where(eq(timelineEntries.id, row.id));
    if (taken) row.id = crypto.randomUUID();
  }
};

const writeDoseRows = (db: SyncDb, rows: readonly (typeof timelineEntries.$inferInsert)[]) =>
  db.drizzle.transaction(async (tx) => {
    await claimDoseIds(tx, rows);
    for (const row of rows) await tx.insert(timelineEntries).values(row);
  });

/**
 * Log a dose (given, skipped or refused) of one of the group's medications,
 * as a `dose` entry on the timeline. The medication must be on this device,
 * in the group and not deleted. A dose naming a slot takes that slot's id
 * (`plannedDoseId`).
 */
export const logDose = async (
  db: SyncDb,
  groupId: string,
  dose: DoseInput,
): Promise<MedicationWriteResult> => {
  if (!(await mayLog(db, groupId))) return forbidden as Refusal;
  const planned = await doseRows(db, groupId, [dose]);
  if (!planned.ok) return planned;
  await writeDoseRows(db, planned.rows);
  return { ok: true, id: planned.rows[0]!.id };
};

/**
 * The rows `logDoses` writes, checked as `logDose` checks one, without
 * writing them: for a caller that writes them in its own transaction (quick
 * entry's runner). The writer role is the caller's to check.
 */
export const doseRows = async (
  db: SyncDb,
  groupId: string,
  doses: readonly DoseInput[],
): Promise<{ ok: true; rows: (typeof timelineEntries.$inferInsert)[] } | Refusal> => {
  const now = nowTimestamp();
  const recipientZone = (await recipientOf(db, groupId))?.time_zone || "UTC";
  const used = new Set<string>();
  const rows: (typeof timelineEntries.$inferInsert)[] = [];
  for (const { medicationId, occurredAt, timeZone, ...rest } of doses) {
    const medication = await liveMedication(db, medicationId);
    if (!medication || medication.groupId !== groupId) return medicationMissing;
    const parsed = doseContent(
      { medicationId, ...rest },
      { occurredAt: occurredAt ?? new Date().toISOString(), timeZone: timeZone ?? deviceTimeZone() },
    );
    if (!parsed.success) return invalid(parsed.error, "The dose is invalid");
    const id = await plannedDoseId(
      db,
      { occurredAt: parsed.data.occurredAt, details: parsed.data.details as DoseDetails },
      recipientZone,
      used,
    );
    used.add(id);
    rows.push(doseRow(parsed.data, medication, { id, now, groupId, userId: db.userId }));
  }
  return { ok: true, rows };
};

/**
 * Log several doses at once (a pass's Given all), in one local transaction:
 * all of them or none. Each is checked as `logDose` checks one. Returns the
 * new entries' ids, in order, so they can be undone exactly.
 */
export const logDoses = async (
  db: SyncDb,
  groupId: string,
  doses: readonly DoseInput[],
): Promise<{ ok: true; ids: string[] } | Refusal> => {
  if (!(await mayLog(db, groupId))) return forbidden as Refusal;
  const planned = await doseRows(db, groupId, doses);
  if (!planned.ok) return planned;
  const { rows } = planned;
  if (rows.length) await writeDoseRows(db, rows);
  return { ok: true, ids: rows.map((r) => r.id) };
};

// ---------------------------------------------------------------------------
// A new medication with its first dose (the Dose sheet's "+ New medication")
// ---------------------------------------------------------------------------

/** What the Dose sheet's quick add asks for: the name, the dose and the type (as posted). */
export type QuickAddMedication = { name: string; dose: string | null; type: string | null };

/** A dose of a medication not written yet: everything but its medication. */
export type NewMedicationDose = Omit<DoseInput, "medicationId">;

/** The quick-added medication: what was typed, as needed with no maximum, and current. */
export const quickAddContent = ({ name, dose, type }: QuickAddMedication): MedicationContentInput => ({
  name,
  dose,
  // An unknown one is refused by the schema, on its field.
  type: type as MedicationContentInput["type"],
  schedule: { type: "asNeeded" },
  status: "current",
});

/**
 * The quick add's rows, pure: the medication's row and its "started" entry
 * (the rows `createMedication` writes, so its id is `medicationChangeId(id,
 * now)`), and the dose's row, for that medication. The type is required, as
 * on the medication form. A refusal names every field at fault, the
 * medication's (`name`, `type`, `dose`) and the dose's (`details.amount`, `occurredAt`).
 */
export const quickAddRows = (
  { medication, dose }: { medication: QuickAddMedication; dose: NewMedicationDose & ParsedDoseTime },
  ctx: NewMedicationContext & { doseId: string },
) => {
  const content = medicationFormContentZSchema.safeParse(quickAddContent(medication));
  const { occurredAt, timeZone, ...details } = dose;
  const parsedDose = doseContent({ medicationId: ctx.id, ...details }, { occurredAt, timeZone });
  if (!content.success || !parsedDose.success)
    return invalid(
      { issues: [...(content.error?.issues ?? []), ...(parsedDose.error?.issues ?? [])] },
      content.success ? "The dose is invalid" : "The medication is invalid",
    );
  const rows = medicationRows(content.data, ctx);
  const doseCtx = { id: ctx.doseId, now: ctx.now, groupId: ctx.groupId, userId: ctx.userId };
  return { ok: true as const, ...rows, dose: doseRow(parsedDose.data, rows.medication, doseCtx) };
};

/**
 * Add a medication and log a dose of it (the Dose sheet's "+ New
 * medication"), in one local transaction: the medication, its "started"
 * entry, then the dose, so they upload in that order and neither is ever
 * written without the other. Returns the medication's id.
 */
export const logDoseOfNewMedication = async (
  db: SyncDb,
  groupId: string,
  { medication, dose }: { medication: QuickAddMedication; dose: NewMedicationDose },
): Promise<MedicationWriteResult> => {
  if (!(await canWrite(db, groupId))) return forbidden as Refusal;
  const recipient = await recipientOf(db, groupId);
  if (!recipient) return refuse("This care group has no care recipient yet");
  const planned = quickAddRows(
    {
      medication,
      dose: {
        ...dose,
        occurredAt: dose.occurredAt ?? new Date().toISOString(),
        timeZone: dose.timeZone ?? deviceTimeZone(),
      },
    },
    {
      id: crypto.randomUUID(),
      doseId: crypto.randomUUID(),
      now: nowTimestamp(),
      groupId,
      recipient: { id: recipient.id, timeZone: recipient.time_zone ?? "UTC" },
      userId: db.userId,
    },
  );
  if (!planned.ok) return planned;
  await db.drizzle.transaction(async (tx) => {
    await tx.insert(medications).values(planned.medication);
    if (planned.entry) await tx.insert(timelineEntries).values(planned.entry);
    await tx.insert(timelineEntries).values(planned.dose);
  });
  return { ok: true, id: planned.medication.id };
};

/**
 * Soft delete exactly these doses (Given all's Undo), in one local
 * transaction. Ones already gone, or not doses, are left alone.
 */
export const removeDoses = async (db: SyncDb, ids: readonly string[]): Promise<ActionResult> => {
  const live: DoseEntry[] = [];
  for (const id of ids) {
    const entry = await liveMedicationEntry(db, id);
    if (entry && isDoseEntry(entry)) live.push(entry);
  }
  for (const entry of live) if (!(await mayChangeEntry(db, entry))) return forbidden;
  if (!live.length) return { ok: true };
  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    for (const entry of live)
      await tx
        .update(timelineEntries)
        .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
        .where(eq(timelineEntries.id, entry.id));
  });
  return { ok: true };
};

export type DosePatch = Partial<Omit<DoseDetails, "medicationId">> & { occurredAt?: string };

/** Edit a logged dose: its status, amount, slot, note or time. Its medication is fixed. */
export const updateDose = async (
  db: SyncDb,
  id: string,
  patch: DosePatch,
): Promise<MedicationWriteResult> => {
  const entry = await liveMedicationEntry(db, id);
  if (!entry || !isDoseEntry(entry)) return doseMissing;
  if (!(await mayChangeEntry(db, entry))) return forbidden as Refusal;

  const { occurredAt, ...details } = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as DosePatch;
  const parsed = doseContent(
    { ...entry.details, ...details },
    { occurredAt: occurredAt ?? entry.occurredAt, timeZone: entry.timeZone },
  );
  if (!parsed.success) return invalid(parsed.error, "The dose is invalid");

  // Only what changed (the details as JSON values, as the server compares them).
  const changed = changedColumns(
    { occurredAt: toLocalTimestamp(entry.occurredAt), details: JSON.stringify(entry.details) },
    { occurredAt: toLocalTimestamp(parsed.data.occurredAt), details: JSON.stringify(parsed.data.details) },
    ["details"],
  );
  if (!Object.keys(changed).length) return { ok: true, id };
  await db.drizzle
    .update(timelineEntries)
    .set({ ...changed, updatedAt: nowTimestamp(), updatedBy: db.userId })
    .where(eq(timelineEntries.id, id));
  return { ok: true, id };
};

/**
 * Soft delete a dose, or a medication change (a correction: the medication
 * itself is untouched). Deleting what's already gone is fine.
 */
export const removeMedicationEntry = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const entry = await liveMedicationEntry(db, id);
  if (!entry) return { ok: true };
  if (!(await mayChangeEntry(db, entry))) return forbidden;
  const now = nowTimestamp();
  await db.drizzle
    .update(timelineEntries)
    .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
    .where(eq(timelineEntries.id, id));
  return { ok: true };
};

// ---------------------------------------------------------------------------
// A provider's medications (the provider page)
// ---------------------------------------------------------------------------

/**
 * The current medications (not deleted) that name a provider as their
 * prescriber or their pharmacy, by name: the provider page's Medications.
 */
export const providerMedicationsQuery = (groupId: string, providerId: string): LocalQuery => ({
  sql: `SELECT * FROM medication
        WHERE group_id = ? AND deleted_at IS NULL AND status = 'current'
          AND (prescriber_id = ? OR pharmacy_id = ?)
        ORDER BY name COLLATE NOCASE, id`,
  params: [groupId, providerId, providerId],
});
