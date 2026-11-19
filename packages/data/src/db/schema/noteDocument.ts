import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";
import type { NoteEditors } from "./noteEditors";
import type { TimelineEntryKind } from "./timelineEntry";

import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { audits, enumCheck, timestamps } from "./columns";
import { medicationSchema } from "./medication";
import { isYjsUpdate } from "./noteYjs";
import { providerSchema } from "./provider";
import { timelineEntrySchema } from "./timelineEntry";

// Live documents: collaborative notes attached to a timeline entry, a
// provider or a medication (see noteYjs.ts for the Yjs side). Only notes and events have one
// among entries.
export const NOTE_DOCUMENT_KINDS = ["note", "event"] as const satisfies readonly TimelineEntryKind[];
export const canHaveNoteDocument = (kind: string): kind is (typeof NOTE_DOCUMENT_KINDS)[number] =>
  (NOTE_DOCUMENT_KINDS as readonly string[]).includes(kind);

/**
 * What a document belongs to: an entry (its text), a provider (shared notes
 * about them) or a medication (shared notes about it).
 */
export const NOTE_DOCUMENT_SUBJECTS = ["entry", "provider", "medication"] as const;
export type NoteDocumentSubject = (typeof NOTE_DOCUMENT_SUBJECTS)[number];

// One live document per entry or provider, and its id **is** the owner's id. Two
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
// `subject` says which owner column is set: `entry_id`, `provider_id` or
// `medication_id`, each equal to `id` (a check enforces it), each with its
// own cascading FK.
//
// Deleting the owner (hard) cascades. A soft-deleted owner hides its document.
export const noteDocumentSchema = pgTable(
  "note_document",
  {
    // The owner's id. No defaultRandom: it's always given.
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull(),
    subject: text("subject", { enum: NOTE_DOCUMENT_SUBJECTS }).notNull().default("entry"),
    // Exactly one is set, and equals `id`.
    entryId: uuid("entry_id"),
    providerId: uuid("provider_id"),
    medicationId: uuid("medication_id"),
    snapshot: text("snapshot"),
    text: text("text").notNull().default(""),
    editors: jsonb("editors").$type<NoteEditors>().notNull().default({}),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // The owner must exist and be in the same group.
    foreignKey({
      name: "note_document_entry_fk",
      columns: [t.groupId, t.entryId],
      foreignColumns: [timelineEntrySchema.groupId, timelineEntrySchema.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "note_document_provider_fk",
      columns: [t.groupId, t.providerId],
      foreignColumns: [providerSchema.groupId, providerSchema.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "note_document_medication_fk",
      columns: [t.groupId, t.medicationId],
      foreignColumns: [medicationSchema.groupId, medicationSchema.id],
    }).onDelete("cascade"),
    enumCheck("note_document_subject_check", t.subject, NOTE_DOCUMENT_SUBJECTS),
    check(
      "note_document_owner_check",
      sql`(${t.subject} = 'entry' AND ${t.entryId} = ${t.id} AND ${t.providerId} IS NULL AND ${t.medicationId} IS NULL)
        OR (${t.subject} = 'provider' AND ${t.providerId} = ${t.id} AND ${t.entryId} IS NULL AND ${t.medicationId} IS NULL)
        OR (${t.subject} = 'medication' AND ${t.medicationId} = ${t.id} AND ${t.entryId} IS NULL AND ${t.providerId} IS NULL)`,
    ),
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

/** Add a live document to an entry, a provider or a medication. `id` is the owner's id; the subject defaults to an entry. */
export const noteDocumentCreateZSchema = z.strictObject({
  id: z.uuid(),
  groupId: z.uuid(),
  subject: z.enum(NOTE_DOCUMENT_SUBJECTS).default("entry"),
});
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
