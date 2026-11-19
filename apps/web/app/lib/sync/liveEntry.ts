import type { ActionResult } from "../api";
import type { SyncDb } from "./index";

import { canHaveNoteDocument, timelineEntryContentZSchema } from "@caretook/data/schema";
import { noteDocuments, timelineEntries } from "./schema";
import {
  contentColumns,
  forbidden,
  groupFor,
  invalid,
  missing,
  nowTimestamp,
  readRows,
  WRITER_ROLES,
} from "./timeline";

// Saving a live entry: a note (or event) and its live document, written
// together on the first change (see lib/liveEntry.ts for when).

export type MaterializeInput = {
  /** Made on the device when the draft opened; also the document's id. */
  id: string;
  groupId: string;
  kind: "note" | "event";
  title: string | null;
  /** ISO 8601. */
  occurredAt: string;
  timeZone: string;
  /** An event's end (ISO 8601), all day, and place, when set before the first save. */
  endsAt?: string | null;
  allDay?: boolean;
  place?: string | null;
};

type ExistingRow = { id: string; group_id: string | null; kind: string | null; deleted_at: string | null };

/**
 * Write the entry and its document in one local transaction, so the upload
 * queue has the entry's PUT before the document's. Idempotent on the id: an
 * entry that already exists keeps its content and only gains a document if
 * it has none (older events, from before every note and event had one).
 *
 * Validates with the same rules as the server and checks the role locally,
 * like the other local writes.
 */
export const materializeLiveEntry = async (db: SyncDb, input: MaterializeInput): Promise<ActionResult> => {
  const group = await groupFor(db, input.groupId);
  if (!group?.role || !WRITER_ROLES.includes(group.role)) return forbidden;

  const [existing] = await readRows<ExistingRow>(db, {
    sql: "SELECT id, group_id, kind, deleted_at FROM timeline_entry WHERE id = ?",
    params: [input.id],
  });
  if (existing && (existing.group_id !== input.groupId || existing.deleted_at)) return missing;
  if (existing && !canHaveNoteDocument(existing.kind ?? "")) {
    return { ok: false, error: "Only notes and events have live documents", issues: [] };
  }
  const [document] = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM note_document WHERE id = ?",
    params: [input.id],
  });
  if (existing && document) return { ok: true };

  let entryValues: typeof timelineEntries.$inferInsert | null = null;
  if (!existing) {
    if (!group.recipient)
      return { ok: false, error: "This care group has no care recipient yet", issues: [] };
    const parsed = timelineEntryContentZSchema.safeParse({
      kind: input.kind,
      title: input.title,
      occurredAt: input.occurredAt,
      timeZone: input.timeZone,
      details: null,
      ...(input.allDay && { allDay: true }),
      ...(input.endsAt && { endsAt: input.endsAt }),
      ...(input.place && { place: input.place }),
    });
    if (!parsed.success) return invalid(parsed.error);
    const now = nowTimestamp();
    entryValues = {
      id: input.id,
      groupId: input.groupId,
      recipientId: group.recipient.id,
      kind: parsed.data.kind,
      ...contentColumns(parsed.data),
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: db.userId,
      updatedBy: db.userId,
    };
  }

  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    if (entryValues) await tx.insert(timelineEntries).values(entryValues);
    if (!document) {
      await tx.insert(noteDocuments).values({
        id: input.id,
        groupId: input.groupId,
        subject: "entry",
        entryId: input.id,
        providerId: null,
        snapshot: null,
        text: "",
        createdAt: now,
        updatedAt: now,
        createdBy: db.userId,
        updatedBy: db.userId,
      });
    }
  });
  return { ok: true };
};
