import type { AssistantAction } from "@caretook/data/schema";
import type { ActionResult, FieldIssue } from "../api";
import type { SyncDb } from "./index";
import type { PassRow } from "./medicationPasses";
import type { MedicationRow, RecipientRow } from "./medications";
import type { ProviderRow } from "./providers";
import type { EntryRow } from "./timeline";

import { eq } from "drizzle-orm";
import {
  assistantActionZSchema,
  encodeNoteDoc,
  entryProviderId,
  noteDocFromText,
  timelineEntryContentZSchema,
} from "@caretook/data/schema";
import { duePasses, givenAllWrites } from "../duePasses";
import { dosesSinceQuery, dueMedicationsQuery, duePassesQuery, toDueDoses, yesterdayStart } from "./dueDoses";
import { doseRows, medicationQuery, recipientQuery, toMedication } from "./medications";
import { toPasses } from "./medicationPasses";
import { providerQuery, toProvider } from "./providers";
import { noteDocuments, noteUpdates, tasks, timelineEntries, timelineEntryProviders } from "./schema";
import { plannedTask } from "./tasks";
import {
  contentColumns,
  forbidden,
  futureRefusal,
  groupFor,
  invalid,
  nowTimestamp,
  readRows,
  WRITER_ROLES,
} from "./timeline";

// Carrying out assistant actions (quick entry's cards) on this device: every
// action in ONE local transaction, so a line is saved whole or not at all,
// and the upload queue has each entry before its document and links. Each
// row is checked as the forms' own writes check it (`createEntry`,
// `logDose`, `materializeLiveEntry`, `linkProvider`): the shared content
// schemas, the writer role, no future time on a past-only kind, a live
// medication or provider in the group. A pass (`givePass`) is the medication
// strip's Given all: the doses `givenAllWrites` plans for the pass's open
// slots on its day, as one round. A task (`addTask`) is checked as
// `createTask` checks it (`plannedTask`) and written in the same transaction;
// it isn't an entry. A refused action refuses the batch, naming the action
// it was.

export type RunActionsResult =
  | {
      ok: true;
      /** Every entry (and task) written, in order (a pass writes one per medication): what Undo removes. */
      ids: string[];
      /** Each action's entries (an `addTask`'s task), in the actions' order. */
      byAction: string[][];
    }
  | { ok: false; error: string; issues: FieldIssue[]; index: number | null };

type EntryInsert = typeof timelineEntries.$inferInsert;

type Rows =
  | EntryRows
  /** A task (not an entry). */
  | { task: typeof tasks.$inferInsert };

type EntryRows = {
  entry: EntryInsert;
  /** More entries the action writes with it (a pass's other doses). */
  more?: EntryInsert[];
  document?: { text: string | null };
  providerIds?: string[];
};

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const refuse = (error: string, index: number | null, issues: FieldIssue[] = []): RunActionsResult => ({
  ok: false,
  error,
  issues,
  index,
});

/** The content an action writes, before the role and group checks (a pass's doses are planned apart). */
const contentOf = (action: Exclude<AssistantAction, { type: "givePass" | "addTask" }>, timeZone: string) => {
  switch (action.type) {
    case "logVital":
      return {
        kind: "vital",
        occurredAt: action.occurredAt,
        timeZone,
        body: action.note ?? null,
        details: { readings: action.readings },
      };
    case "logSymptom":
      return {
        kind: "symptom",
        occurredAt: action.occurredAt,
        timeZone,
        body: action.note ?? null,
        details: { name: action.name, severity: action.severity ?? null },
      };
    case "logDose":
      return {
        kind: "dose",
        occurredAt: action.occurredAt,
        timeZone,
        details: {
          medicationId: action.medicationId,
          status: action.status,
          ...(action.amount && { amount: action.amount }),
          ...(action.note && { note: action.note }),
        },
      };
    case "addNote":
      return {
        kind: "note",
        title: action.title ?? null,
        occurredAt: action.occurredAt,
        timeZone,
        details: null,
      };
    case "addEvent":
      return {
        kind: "event",
        title: action.title,
        occurredAt: action.occurredAt,
        timeZone: action.timeZone,
        details: null,
        ...(action.allDay && { allDay: true }),
        ...(action.endsAt && { endsAt: action.endsAt }),
        ...(action.place && { place: action.place }),
      };
  }
};

/**
 * Carry out `actions` in the group, in order, in one local transaction.
 * Returns the new entries' ids (in order; a pass writes one per medication
 * still open in it) for Undo, or the
 * first refusal with the index of the action refused (null when the whole
 * batch is: a viewer, a group with no recipient). Nothing is written unless
 * every action passes. Entries are dated in the device's zone, as the forms
 * date them; an event carries its own.
 */
export const runActions = async (
  db: SyncDb,
  groupId: string,
  actions: readonly unknown[],
  { timeZone = deviceTimeZone() }: { timeZone?: string } = {},
): Promise<RunActionsResult> => {
  const group = await groupFor(db, groupId);
  if (!group?.role || !WRITER_ROLES.includes(group.role))
    return refuse("You don't have permission to do that.", null);
  if (!group.recipient) return refuse("This care group has no care recipient yet", null);
  if (!actions.length) return { ok: true, ids: [], byAction: [] };

  const now = nowTimestamp();
  const audit = { createdAt: now, updatedAt: now, createdBy: db.userId, updatedBy: db.userId };
  const planned: Rows[] = [];
  for (const [index, input] of actions.entries()) {
    const parsed = assistantActionZSchema.safeParse(input);
    if (!parsed.success) {
      const { issues } = invalid(parsed.error) as { issues: FieldIssue[] };
      return refuse("This card can't be saved as it is.", index, issues);
    }
    const action = parsed.data;
    if (action.type === "givePass") {
      const doses = await passDoses(db, groupId, action, timeZone);
      if (!doses.ok) return refuse(doses.error, index, doses.issues);
      const [first, ...more] = doses.rows;
      planned.push({ entry: first!, more });
      continue;
    }
    if (action.type === "addTask") {
      const { type: _type, ...input } = action;
      const task = await plannedTask(db, groupId, input);
      if (!task.ok) return refuse(task.error, index, task.issues);
      planned.push({ task: task.row });
      continue;
    }
    const content = timelineEntryContentZSchema.safeParse(contentOf(action, timeZone));
    if (!content.success) {
      const { issues } = invalid(content.error) as { issues: FieldIssue[] };
      return refuse("This card can't be saved as it is.", index, issues);
    }
    const future = futureRefusal(content.data.kind, content.data.occurredAt);
    if (future && !future.ok) return refuse(future.error, index, future.issues);

    if (action.type === "logDose") {
      const [row] = await readRows<MedicationRow>(db, medicationQuery(action.medicationId));
      const medication = row ? toMedication(row) : null;
      if (!medication || medication.deletedAt || medication.groupId !== groupId)
        return refuse("That medication is gone. It may have been deleted.", index);
    }
    const providerIds = action.type === "addEvent" ? [...new Set(action.providerIds)] : [];
    for (const providerId of providerIds) {
      const [row] = await readRows<ProviderRow>(db, providerQuery(providerId));
      const provider = row ? toProvider(row) : null;
      if (!provider || provider.deletedAt || provider.groupId !== groupId)
        return refuse("That provider is gone. It may have been deleted.", index);
    }

    const id = crypto.randomUUID();
    planned.push({
      entry: {
        id,
        groupId,
        recipientId: group.recipient.id,
        kind: content.data.kind,
        ...contentColumns(content.data),
        cancelledBy: null,
        deletedAt: null,
        ...audit,
      },
      // A note's or event's text is its live document, written with it.
      ...((action.type === "addNote" || action.type === "addEvent") && {
        document: { text: action.type === "addNote" ? action.text : null },
      }),
      providerIds,
    });
  }

  await db.drizzle.transaction(async (tx) => {
    for (const rows of planned) {
      if ("task" in rows) {
        await tx.insert(tasks).values(rows.task);
        continue;
      }
      const { entry, more, document, providerIds } = rows;
      await tx.insert(timelineEntries).values(entry);
      for (const row of more ?? []) await tx.insert(timelineEntries).values(row);
      if (document) {
        await tx.insert(noteDocuments).values({
          id: entry.id,
          groupId,
          subject: "entry",
          entryId: entry.id,
          providerId: null,
          snapshot: null,
          text: "",
          ...audit,
        });
        if (document.text?.trim()) {
          // Devices can't write a snapshot: the text goes in as the document's first update.
          const doc = noteDocFromText(document.text);
          await tx.insert(noteUpdates).values({
            id: crypto.randomUUID(),
            groupId,
            documentId: entry.id,
            data: encodeNoteDoc(doc),
            createdAt: now,
            createdBy: db.userId,
          });
          doc.destroy();
        }
      }
      for (const providerId of providerIds ?? [])
        await tx.insert(timelineEntryProviders).values({
          id: entryProviderId(entry.id, providerId),
          groupId,
          entryId: entry.id,
          providerId,
          ...audit,
        });
    }
  });
  const byAction = planned.map((p) =>
    "task" in p ? [p.task.id] : [p.entry.id, ...(p.more ?? []).map((r) => r.id)],
  );
  return { ok: true, ids: byAction.flat(), byAction };
};

/**
 * A pass's Given all, planned for the day `occurredAt` falls on: one dose per
 * slot of the pass nothing has answered yet (`duePasses`, `givenAllWrites`),
 * given then, in one round (joining one already started). Refused when the
 * pass is gone or has nothing left to give.
 */
const passDoses = async (
  db: SyncDb,
  groupId: string,
  action: Extract<AssistantAction, { type: "givePass" }>,
  timeZone: string,
): Promise<{ ok: true; rows: EntryInsert[] } | { ok: false; error: string; issues: FieldIssue[] }> => {
  const at = new Date(action.occurredAt);
  const future = futureRefusal("dose", action.occurredAt);
  if (future && !future.ok) return future;
  // What's due on that day (as `loadDueDoses` reads today's).
  const [recipient, medications, passes] = await Promise.all([
    readRows<RecipientRow>(db, recipientQuery(groupId)),
    readRows<MedicationRow>(db, dueMedicationsQuery(groupId)),
    readRows<PassRow>(db, duePassesQuery(groupId)),
  ]);
  const zone = recipient[0]?.time_zone || "UTC";
  const doses = await readRows<EntryRow>(db, dosesSinceQuery(groupId, yesterdayStart(at, zone)));
  const rows = { recipient, medications, passes, doses };
  const passRow = rows.passes.find((p) => p.id === action.passId);
  if (!passRow || passRow.deleted_at || passRow.group_id !== groupId)
    return { ok: false, error: "That pass is gone. It may have been deleted.", issues: [] };
  const due = toDueDoses(rows, at);
  const pass = duePasses(due, toPasses(rows.passes)).find((p) => p.passId === action.passId);
  const name = passRow.name ?? "This pass";
  if (!pass?.slots.length) return { ok: false, error: `${name} has no medications.`, issues: [] };
  const writes = givenAllWrites(pass, at).map((w) => ({ ...w, timeZone }));
  if (!writes.length) return { ok: false, error: `Nothing is left to give in ${name}.`, issues: [] };
  return doseRows(db, groupId, writes);
};

/**
 * Soft delete exactly these entries (and tasks: quick entry's line can add
 * one), in one local transaction (quick entry's Undo: the line it just
 * saved). Ones already gone are left alone; any in a group you can't write
 * refuses the lot.
 */
export const removeEntries = async (db: SyncDb, ids: readonly string[]): Promise<ActionResult> => {
  const live: { id: string; groupId: string; task: boolean }[] = [];
  for (const id of new Set(ids)) {
    // Any kind (doses and medication changes too), so not through `toTimelineEntry`.
    const [row] = await readRows<{ id: string; group_id: string | null; task: number }>(db, {
      sql: `SELECT id, group_id, 0 AS task FROM timeline_entry WHERE id = ? AND deleted_at IS NULL
            UNION ALL SELECT id, group_id, 1 AS task FROM task WHERE id = ? AND deleted_at IS NULL`,
      params: [id, id],
    });
    if (row?.group_id) live.push({ id: row.id, groupId: row.group_id, task: !!row.task });
  }
  for (const groupId of new Set(live.map((e) => e.groupId))) {
    const group = await groupFor(db, groupId);
    if (!group?.role || !WRITER_ROLES.includes(group.role)) return forbidden;
  }
  if (!live.length) return { ok: true };
  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    for (const entry of live)
      if (entry.task)
        await tx
          .update(tasks)
          .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
          .where(eq(tasks.id, entry.id));
      else
        await tx
          .update(timelineEntries)
          .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
          .where(eq(timelineEntries.id, entry.id));
  });
  return { ok: true };
};
