import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";
import type { NoteEditors } from "./noteEditors";
import type { TimelineEntryKind } from "./timelineEntry";

import { foreignKey, index, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { audits, timestamps } from "./columns";
import { isYjsUpdate } from "./noteYjs";
import { timelineEntrySchema } from "./timelineEntry";

// Live documents: collaborative notes attached to a timeline entry (see
// noteYjs.ts for the Yjs side). Only notes and events can have one.
export const NOTE_DOCUMENT_KINDS = ["note", "event"] as const satisfies readonly TimelineEntryKind[];
export const canHaveNoteDocument = (kind: string): kind is (typeof NOTE_DOCUMENT_KINDS)[number] =>
  (NOTE_DOCUMENT_KINDS as readonly string[]).includes(kind);

// One live document per entry, and its id **is** the entry's id. Two
// devices that both add live notes to an entry while offline create the
// same row, and their edits merge, instead of one being refused.
//
// `snapshot` is the compacted Yjs state (base64), null until the first
// compaction. `text` is derived from it for previews, search and AI; the
// server writes both (noteDocumentService.compact), devices never do.
//
// `editors` is `{ [userId]: lastEditAt }`: who has edited it and when, merged
// from the updates compaction folds in, so "who's typing" (noteEditors.ts)
// outlives the deleted updates. System only, like the snapshot.
//
// Deleting the entry (hard) cascades. A soft-deleted entry hides its document.
export const noteDocumentSchema = pgTable(
  "note_document",
  {
    // The entry's id. No defaultRandom: it's always given.
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull(),
    snapshot: text("snapshot"),
    text: text("text").notNull().default(""),
    editors: jsonb("editors").$type<NoteEditors>().notNull().default({}),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // The entry must exist and be in the same group.
    foreignKey({
      name: "note_document_entry_fk",
      columns: [t.groupId, t.id],
      foreignColumns: [timelineEntrySchema.groupId, timelineEntrySchema.id],
    }).onDelete("cascade"),
    // Target of note_update's composite FK.
    unique("note_document_group_id_id_unique").on(t.groupId, t.id),
  ],
);

// Yjs updates not yet compacted into the snapshot: append-only, one row per
// burst of typing from one device. The document's state is the snapshot
// plus every row here, in any order (Yjs merges commute). Compaction folds
// rows into the snapshot and deletes them.
export const noteUpdateSchema = pgTable(
  "note_update",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull(),
    documentId: uuid("document_id").notNull(),
    // A Yjs update, base64.
    data: text("data").notNull(),
    ...timestamps,
    ...audits,
  },
  (t) => [
    foreignKey({
      name: "note_update_document_fk",
      columns: [t.groupId, t.documentId],
      foreignColumns: [noteDocumentSchema.groupId, noteDocumentSchema.id],
    }).onDelete("cascade"),
    index("note_update_document_idx").on(t.documentId, t.createdAt),
  ],
);

export type NoteDocumentSchema = typeof noteDocumentSchema;
export type NoteDocumentSelect = InferSelectModel<NoteDocumentSchema>;
export type NoteDocumentInsert = Omit<InferInsertModel<NoteDocumentSchema>, ProtectedField>;
export type NoteDocument = NoteDocumentSelect;

export type NoteUpdateSchema = typeof noteUpdateSchema;
export type NoteUpdateSelect = InferSelectModel<NoteUpdateSchema>;
export type NoteUpdateInsert = Omit<InferInsertModel<NoteUpdateSchema>, ProtectedField>;
export type NoteUpdate = NoteUpdateSelect;

// ---------------------------------------------------------------------------
// Zod schemas (client-safe)
// ---------------------------------------------------------------------------

export const NOTE_LIMITS = {
  /** One update, base64. A big paste is one update; ~750 KB of binary. */
  updateChars: 1_000_000,
} as const;

/** Add a live document to an entry. `id` is the entry's id. */
export const noteDocumentCreateZSchema = z.strictObject({ id: z.uuid(), groupId: z.uuid() });
export type NoteDocumentCreateInput = z.input<typeof noteDocumentCreateZSchema>;

/** Append one Yjs update. `id` comes from the device, so replays land on the same row. */
export const noteUpdateCreateZSchema = z.strictObject({
  id: z.uuid(),
  groupId: z.uuid(),
  documentId: z.uuid(),
  data: z
    .string()
    .min(1)
    .max(NOTE_LIMITS.updateChars)
    .refine(isYjsUpdate, { message: "Not a valid document update" }),
});
export type NoteUpdateCreateInput = z.input<typeof noteUpdateCreateZSchema>;
