import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { audits, timestamps } from "../core/columns";
import { medicationSchema } from "../medications/medication";
import { providerSchema } from "../providers/provider";
import { timelineEntrySchema } from "../timeline/timelineEntry";
import { todoSchema } from "../todos/todo";
import { tagSchema } from "./tag";
import { recordTagId, targetOf } from "./tagRules";

// Which records carry which tags (tags PRD): one row per (tag, record), with
// one nullable column per target type (a timeline entry, todo, provider or
// medication) and a check that exactly one is set. Every key is composite on
// the group, so a link never crosses groups; a hard delete of the tag or the
// record removes the link. Soft-deleting a record keeps its links (readers
// join live rows), so an undo or restore gets its tags back.
//
// The id is derived from the tag and the record (`recordTagId`), so replays
// and two devices tagging one record land on one row. Untagging deletes it.

export const recordTagSchema = pgTable(
  "record_tag",
  {
    // Always given: recordTagId(tagId, recordId).
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull(),
    tagId: uuid("tag_id").notNull(),
    entryId: uuid("entry_id"),
    todoId: uuid("todo_id"),
    providerId: uuid("provider_id"),
    medicationId: uuid("medication_id"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    foreignKey({
      name: "record_tag_tag_fk",
      columns: [t.groupId, t.tagId],
      foreignColumns: [tagSchema.groupId, tagSchema.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "record_tag_entry_fk",
      columns: [t.groupId, t.entryId],
      foreignColumns: [timelineEntrySchema.groupId, timelineEntrySchema.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "record_tag_todo_fk",
      columns: [t.groupId, t.todoId],
      foreignColumns: [todoSchema.groupId, todoSchema.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "record_tag_provider_fk",
      columns: [t.groupId, t.providerId],
      foreignColumns: [providerSchema.groupId, providerSchema.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "record_tag_medication_fk",
      columns: [t.groupId, t.medicationId],
      foreignColumns: [medicationSchema.groupId, medicationSchema.id],
    }).onDelete("cascade"),
    check(
      "record_tag_one_target",
      sql`num_nonnulls(${t.entryId}, ${t.todoId}, ${t.providerId}, ${t.medicationId}) = 1`,
    ),
    unique("record_tag_tag_entry_unique").on(t.tagId, t.entryId),
    unique("record_tag_tag_todo_unique").on(t.tagId, t.todoId),
    unique("record_tag_tag_provider_unique").on(t.tagId, t.providerId),
    unique("record_tag_tag_medication_unique").on(t.tagId, t.medicationId),
    // A record's tags.
    index("record_tag_entry_idx").on(t.entryId),
    index("record_tag_todo_idx").on(t.todoId),
    index("record_tag_provider_idx").on(t.providerId),
    index("record_tag_medication_idx").on(t.medicationId),
  ],
);

export type RecordTagSchema = typeof recordTagSchema;
export type RecordTagSelect = InferSelectModel<RecordTagSchema>;
export type RecordTagInsert = Omit<InferInsertModel<RecordTagSchema>, ProtectedField>;
export type RecordTag = RecordTagSelect;

const targetId = z.uuid().nullable().optional();

/**
 * Put a tag on a record: exactly one target. `id`, when given (a device's
 * upload), must be the derived one for the tag and the record.
 */
export const recordTagLinkZSchema = z
  .strictObject({
    id: z.uuid().optional(),
    groupId: z.uuid(),
    tagId: z.uuid(),
    entryId: targetId,
    todoId: targetId,
    providerId: targetId,
    medicationId: targetId,
  })
  .refine((v) => targetOf(v) !== null, {
    path: ["target"],
    error: "A tag goes on exactly one record",
  })
  .refine(
    (v) => {
      const target = targetOf(v);
      return !v.id || !target || v.id.toLowerCase() === recordTagId(v.tagId, target.recordId);
    },
    { path: ["id"], error: "A link's id comes from its tag and record" },
  );
export type RecordTagLinkInput = z.input<typeof recordTagLinkZSchema>;
