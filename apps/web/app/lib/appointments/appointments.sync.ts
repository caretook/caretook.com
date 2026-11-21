import type { ActionResult } from "../core/api";
import type { Schedule } from "./entrySchedule";
import type { SyncDb } from "../sync/index";
import type { EntryRow } from "../timeline/timeline.sync";

import {
  buildNoteDoc,
  encodeNoteDoc,
  entryProviderId,
  timelineEntryContentZSchema,
} from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { cancelPatch, UNCANCEL_PATCH } from "./eventCancel";
import { noteDocuments, noteUpdates, timelineEntries, timelineEntryProviders } from "../sync/schema";
import {
  contentColumns,
  forbidden,
  groupFor,
  invalid,
  missing,
  nowTimestamp,
  readRows,
  toTimelineEntry,
  updateEntry,
  WRITER_ROLES,
} from "../timeline/timeline.sync";

// Local writes for appointments (events), beside timeline.ts: cancel, undo
// cancel and reschedule. Cancel and undo are ordinary updates of the cancel
// fields, so they're checked like any edit (writers only, events only: the
// content rules refuse cancel fields on other kinds), land at once and
// upload as a PATCH. Past events can be cancelled too. The server records
// who cancelled.

/** Cancel an event now, with an optional reason. */
export const cancelEvent = (db: SyncDb, id: string, reason?: string | null): Promise<ActionResult> =>
  updateEntry(db, id, cancelPatch(reason));

/** Undo a cancel: the event is back, without its reason or "rescheduled to". */
export const uncancelEvent = (db: SyncDb, id: string): Promise<ActionResult> =>
  updateEntry(db, id, { ...UNCANCEL_PATCH });

export type RescheduleInput = Schedule & {
  /** Keep the old event, cancelled and linking to a new one; otherwise just move it. */
  keepOldAsCancelled: boolean;
};

/** The event that holds the notes now: the same one when it just moved, else the new one. */
export type RescheduleResult = { ok: true; id: string } | Extract<ActionResult, { ok: false }>;

const refuse = (error: string): RescheduleResult => ({ ok: false, error, issues: [] });

/**
 * Reschedule an event. Without `keepOldAsCancelled` it's an ordinary time
 * update: the event keeps its id, notes and links.
 *
 * With it, **one local transaction** (so a half-made reschedule never
 * syncs, and the upload queue has each row before what points at it): a new
 * event at the new time with the old one's title and place; copies of its
 * links to providers that aren't deleted (their ids from `entryProviderId`);
 * its live document, plus one note update carrying the old document's whole
 * Yjs state (devices can't write a snapshot), so the notes carry on there;
 * then the old event cancelled (now, unless it already was, keeping its
 * reason) with `rescheduled_to` the new one. The old document is left as it
 * was. Writers only, events only, and not one already rescheduled.
 */
export const rescheduleEvent = async (
  db: SyncDb,
  id: string,
  { keepOldAsCancelled, ...schedule }: RescheduleInput,
): Promise<RescheduleResult> => {
  const [row] = await readRows<EntryRow>(db, {
    sql: "SELECT * FROM timeline_entry WHERE id = ? AND deleted_at IS NULL",
    params: [id],
  });
  const old = row ? toTimelineEntry(row) : null;
  if (!old) return missing as RescheduleResult;
  if (old.kind !== "event") return refuse("Only events can be rescheduled");
  const group = await groupFor(db, old.groupId);
  if (!group?.role || !WRITER_ROLES.includes(group.role)) return forbidden as RescheduleResult;

  const timing = {
    occurredAt: schedule.occurredAt,
    allDay: schedule.allDay,
    endsAt: schedule.allDay ? null : schedule.endsAt,
  };
  if (!keepOldAsCancelled) {
    const res = await updateEntry(db, id, timing);
    return res.ok ? { ok: true, id } : res;
  }
  if (old.rescheduledTo) return refuse("This event was already rescheduled");

  const newId = crypto.randomUUID();
  const fresh = timelineEntryContentZSchema.safeParse({
    kind: "event",
    title: old.title,
    occurredAt: timing.occurredAt,
    timeZone: old.timeZone,
    details: null,
    ...(timing.allDay && { allDay: true }),
    ...(timing.endsAt && { endsAt: timing.endsAt }),
    ...(old.place && { place: old.place }),
  });
  if (!fresh.success) return invalid(fresh.error) as RescheduleResult;
  const cancelled = timelineEntryContentZSchema.safeParse({
    kind: old.kind,
    title: old.title,
    body: old.body,
    occurredAt: old.occurredAt,
    timeZone: old.timeZone,
    details: old.details,
    allDay: old.allDay,
    endsAt: old.endsAt,
    place: old.place,
    cancelledAt: old.cancelledAt ?? new Date().toISOString(),
    cancelReason: old.cancelReason,
    rescheduledTo: newId,
    seriesId: old.seriesId,
    seriesDay: old.seriesDay,
    seriesDetached: old.seriesDetached,
  });
  if (!cancelled.success) return invalid(cancelled.error) as RescheduleResult;

  // The old notes: its snapshot and every update not yet folded into it.
  const [document] = await readRows<{ snapshot: string | null }>(db, {
    sql: "SELECT snapshot FROM note_document WHERE id = ?",
    params: [id],
  });
  const updates = await readRows<{ data: string | null }>(db, {
    sql: "SELECT data FROM note_update WHERE document_id = ? ORDER BY created_at, id",
    params: [id],
  });
  const parts = updates.map((u) => u.data).filter((d): d is string => !!d);
  let notes: string | null = null;
  if (document?.snapshot || parts.length) {
    const doc = buildNoteDoc(document?.snapshot, parts);
    notes = encodeNoteDoc(doc);
    doc.destroy();
  }
  const links = await readRows<{ provider_id: string }>(db, {
    sql: `SELECT l.provider_id FROM timeline_entry_provider l
          JOIN provider p ON p.id = l.provider_id AND p.deleted_at IS NULL
          WHERE l.entry_id = ? ORDER BY l.created_at, l.id`,
    params: [id],
  });

  const now = nowTimestamp();
  const audit = { createdAt: now, updatedAt: now, createdBy: db.userId, updatedBy: db.userId };
  await db.drizzle.transaction(async (tx) => {
    await tx.insert(timelineEntries).values({
      id: newId,
      groupId: old.groupId,
      recipientId: old.recipientId,
      kind: "event",
      ...contentColumns(fresh.data),
      cancelledBy: null,
      deletedAt: null,
      ...audit,
    });
    await tx.insert(noteDocuments).values({
      id: newId,
      groupId: old.groupId,
      subject: "entry",
      entryId: newId,
      providerId: null,
      snapshot: null,
      text: "",
      ...audit,
    });
    if (notes) {
      await tx.insert(noteUpdates).values({
        id: crypto.randomUUID(),
        groupId: old.groupId,
        documentId: newId,
        data: notes,
        createdAt: now,
        createdBy: db.userId,
      });
    }
    for (const { provider_id: providerId } of links) {
      await tx.insert(timelineEntryProviders).values({
        id: entryProviderId(newId, providerId),
        groupId: old.groupId,
        entryId: newId,
        providerId,
        ...audit,
      });
    }
    await tx
      .update(timelineEntries)
      .set({
        ...contentColumns(cancelled.data),
        cancelledBy: old.cancelledAt ? old.cancelledBy : db.userId,
        updatedAt: now,
        updatedBy: db.userId,
      })
      .where(eq(timelineEntries.id, id));
  });
  return { ok: true, id: newId };
};
