import type { AssistantAction } from "@caretook/data/schema";
import type { FieldIssue } from "../api";
import type { SyncDb } from "./index";
import type { MedicationRow } from "./medications";
import type { ProviderRow } from "./providers";

import {
  assistantActionZSchema,
  encodeNoteDoc,
  entryProviderId,
  noteDocFromText,
  timelineEntryContentZSchema,
} from "@caretook/data/schema";
import { medicationQuery, toMedication } from "./medications";
import { providerQuery, toProvider } from "./providers";
import { noteDocuments, noteUpdates, timelineEntries, timelineEntryProviders } from "./schema";
import {
  contentColumns,
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
// medication or provider in the group. A refused action refuses the batch,
// naming the action it was.

export type RunActionsResult =
  { ok: true; ids: string[] } | { ok: false; error: string; issues: FieldIssue[]; index: number | null };

type EntryInsert = typeof timelineEntries.$inferInsert;

type Rows = {
  entry: EntryInsert;
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

/** The content an action writes, before the role and group checks. */
const contentOf = (action: AssistantAction, timeZone: string) => {
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
 * Returns the new entries' ids (one per action, in order) for Undo, or the
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
  if (!actions.length) return { ok: true, ids: [] };

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
    for (const { entry, document, providerIds } of planned) {
      await tx.insert(timelineEntries).values(entry);
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
  return { ok: true, ids: planned.map((p) => p.entry.id) };
};
