import type { UnitChoices } from "@caretook/data/schema";
import type { ActionResult } from "../core/api";
import type { VisitEvent, VisitPrepData, VisitWindow } from "./visitPrep";
import type { SyncDb } from "../sync/index";
import type { CarePeriodRow } from "../care-periods/carePeriods.sync";
import type { PassRow } from "../medications/medicationPasses.sync";
import type { MedicationRow } from "../medications/medications.sync";
import type { ProviderRow } from "../providers/providers.sync";
import type { EntryRow, LocalQuery } from "../timeline/timeline.sync";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { localTimeZone } from "../core/format";
import { visitWindow } from "./visitPrep";
import { carePeriodsQuery, toPeriodSpans } from "../care-periods/carePeriods.sync";
import { passesQuery, toPasses } from "../medications/medicationPasses.sync";
import {
  groupDosesQuery,
  isDoseEntry,
  medicationsQuery,
  recipientQuery,
  toMedicationEntries,
  toMedications,
} from "../medications/medications.sync";
import { providersQuery, toProviders } from "../providers/providers.sync";
import { noteDocuments, noteUpdates } from "../sync/schema";
import {
  forbidden,
  groupFor,
  missing,
  nowTimestamp,
  readRows,
  toLocalTimestamp,
  toTimelineEntries,
  toTimelineEntry,
  WRITER_ROLES,
} from "../timeline/timeline.sync";
import type { NoteSectionLine } from "@caretook/data/domain";
import { buildNoteDoc, noteText, prependNoteSection, toBase64 } from "@caretook/data/domain";

// Visit prep on the device: the window and the data for an appointment's
// "Since your last visit" section (lib/appointments/visitPrep.ts words it), all read from
// local rows so it works offline, and the write that puts the section at the
// top of the appointment's live notes. That write is a note_update like a
// burst of typing, so it uploads, syncs to co-editors and merges with what
// they type (Yjs).

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The providers linked to an entry (ids only, deleted ones too). */
export const entryProviderIdsQuery = (entryId: string): LocalQuery => ({
  sql: "SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ? ORDER BY created_at, id",
  params: [entryId],
});

/** Live events linked to any of `providerIds`, each row once per link (`provider_id`). */
export const providerEventsQuery = (providerIds: readonly string[]): LocalQuery => ({
  sql: `SELECT e.*, l.provider_id AS link_provider_id
        FROM timeline_entry_provider l JOIN timeline_entry e ON e.id = l.entry_id
        WHERE l.provider_id IN (${providerIds.map(() => "?").join(", ") || "NULL"})
          AND e.kind = 'event' AND e.deleted_at IS NULL`,
  params: [...providerIds],
});

/** One document's stored parts, for its current text. */
const documentQuery = (id: string): LocalQuery => ({
  sql: `SELECT d.snapshot, (SELECT json_group_array(u.data) FROM note_update u WHERE u.document_id = d.id) AS updates
        FROM note_document d WHERE d.id = ?`,
  params: [id],
});

/** The entries a section reads: vitals, symptoms, events and medication changes in `[from, to]`. */
const prepEntriesQuery = (groupId: string, from: string, to: string): LocalQuery => ({
  sql: `SELECT * FROM timeline_entry
        WHERE group_id = ? AND deleted_at IS NULL
          AND kind IN ('vital', 'symptom', 'event', 'medicationChange')
          AND occurred_at >= ? AND occurred_at <= ?
        ORDER BY occurred_at, id`,
  params: [groupId, toLocalTimestamp(from), toLocalTimestamp(to)],
});

/**
 * The group's medication change entries from `from` on, deleted ones too:
 * deleting the timeline line doesn't undo the change. No end: schedule history
 * undoes every change later than the day it reads.
 */
export const scheduleChangesQuery = (groupId: string, from: string | Date): LocalQuery => ({
  sql: `SELECT * FROM timeline_entry
        WHERE group_id = ? AND kind = 'medicationChange' AND occurred_at >= ?
        ORDER BY occurred_at, id`,
  params: [groupId, toLocalTimestamp(from)],
});

/** Rows of `providerEventsQuery` as events with their linked providers. */
export const toVisitEvents = (rows: (EntryRow & { link_provider_id: string })[]): VisitEvent[] => {
  const byId = new Map<string, VisitEvent & { providerIds: string[] }>();
  for (const row of rows) {
    const entry = toTimelineEntry(row);
    if (!entry) continue;
    const known = byId.get(entry.id);
    if (known) known.providerIds.push(row.link_provider_id);
    else byId.set(entry.id, { ...entry, providerIds: [row.link_provider_id] });
  }
  return [...byId.values()];
};

/** The window for preparing an appointment: since the last past visit with its providers, else 30 days. */
export const loadVisitWindow = async (db: SyncDb, appointmentId: string, now: Date): Promise<VisitWindow> => {
  const links = await readRows<{ provider_id: string }>(db, entryProviderIdsQuery(appointmentId));
  const providerIds = links.map((l) => l.provider_id);
  const events = providerIds.length
    ? toVisitEvents(await readRows(db, providerEventsQuery(providerIds)))
    : [];
  return visitWindow({ providerIds, events: events.filter((e) => e.id !== appointmentId), now });
};

/** A document's text now, pending edits included ("" when it has none yet). */
export const loadDocumentText = async (db: SyncDb, id: string) => {
  const [row] = await readRows<{ snapshot: string | null; updates: string | null }>(db, documentQuery(id));
  if (!row) return "";
  const doc = buildNoteDoc(row.snapshot, parseUpdates(row.updates));
  const text = noteText(doc);
  doc.destroy();
  return text;
};

const parseUpdates = (json: string | null) => {
  try {
    return ((JSON.parse(json ?? "[]") as (string | null)[]) ?? []).filter((u): u is string => !!u);
  } catch {
    return [];
  }
};

/** Everything `visitPrepSection` reads for `window`, from local rows. */
export const loadVisitPrepData = async (
  db: SyncDb,
  {
    groupId,
    appointmentId,
    window,
    units,
    now,
  }: { groupId: string; appointmentId: string; window: VisitWindow; units: UnitChoices; now: Date },
): Promise<VisitPrepData> => {
  const from = new Date(window.from).getTime();
  const to = new Date(window.to).getTime();
  const beforeFrom = new Date(from - Math.max(0, to - from)).toISOString();
  // Doses a little either side of the window, so a slot at its edge finds the dose that answers it.
  const doseMargin = 3 * 3_600_000;
  // Changes from before the window's first day too: matching reads the day either side.
  const changesFrom = new Date(from - 3 * 86_400_000);
  const [entryRows, medicationRows, passRows, periodRows, providerRows, recipientRows, doseRows, changeRows] =
    await Promise.all([
      readRows<EntryRow>(db, prepEntriesQuery(groupId, beforeFrom, window.to)),
      readRows<MedicationRow>(db, medicationsQuery(groupId, { includeDeleted: true })),
      readRows<PassRow>(db, passesQuery(groupId, { includeDeleted: true })),
      readRows<CarePeriodRow>(db, carePeriodsQuery(groupId)),
      readRows<ProviderRow>(db, providersQuery(groupId, { includeDeleted: true })),
      readRows<{ time_zone: string | null }>(db, recipientQuery(groupId)),
      readRows<EntryRow>(
        db,
        groupDosesQuery(groupId, new Date(from - doseMargin), new Date(to + doseMargin)),
      ),
      readRows<EntryRow>(db, scheduleChangesQuery(groupId, changesFrom)),
    ]);
  return {
    entries: toTimelineEntries(entryRows),
    medications: toMedications(medicationRows).map((m) => ({
      id: m.id,
      name: m.name,
      strength: m.strength ?? null,
      dose: m.dose ?? null,
      status: m.status,
      schedule: m.schedule,
      deletedAt: m.deletedAt,
      createdAt: m.createdAt || null,
      startedOn: m.startedOn ?? null,
      stoppedOn: m.stoppedOn ?? null,
    })),
    doses: toMedicationEntries(doseRows).filter(isDoseEntry),
    changes: toTimelineEntries(changeRows),
    passes: toPasses(passRows),
    periods: toPeriodSpans(periodRows),
    placeNames: new Map(toProviders(providerRows).map((p) => [p.id, p.name])),
    appointmentId,
    units,
    timeZone: recipientRows[0]?.time_zone || localTimeZone(),
    now,
  };
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Put `lines` at the top of a note's or event's live document, as one
 * note_update (a document is made first if the entry has none yet, in the
 * same transaction). Writers only. Nothing already in the document changes,
 * so it merges with what anyone is typing at the same time.
 */
export const insertNoteSection = async (
  db: SyncDb,
  { groupId, entryId, lines }: { groupId: string; entryId: string; lines: readonly NoteSectionLine[] },
): Promise<ActionResult> => {
  const group = await groupFor(db, groupId);
  if (!group?.role || !WRITER_ROLES.includes(group.role)) return forbidden;
  const [entry] = await readRows<{ kind: string | null; group_id: string | null }>(db, {
    sql: "SELECT kind, group_id FROM timeline_entry WHERE id = ? AND deleted_at IS NULL",
    params: [entryId],
  });
  if (!entry || entry.group_id !== groupId || !canHaveNoteDocument(entry.kind ?? "")) return missing;

  const [row] = await readRows<{ snapshot: string | null; updates: string | null }>(
    db,
    documentQuery(entryId),
  );
  const doc = buildNoteDoc(row?.snapshot, parseUpdates(row?.updates ?? null));
  const update = prependNoteSection(doc, lines);
  doc.destroy();

  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    if (!row) {
      await tx.insert(noteDocuments).values({
        id: entryId,
        groupId,
        subject: "entry",
        entryId,
        providerId: null,
        snapshot: null,
        text: "",
        createdAt: now,
        updatedAt: now,
        createdBy: db.userId,
        updatedBy: db.userId,
      });
    }
    await tx.insert(noteUpdates).values({
      id: crypto.randomUUID(),
      groupId,
      documentId: entryId,
      data: toBase64(update),
      createdAt: now,
      createdBy: db.userId,
    });
  });
  return { ok: true };
};
