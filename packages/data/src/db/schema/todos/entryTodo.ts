import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { foreignKey, index, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";
import { audits, timestamps } from "../core/columns";
import { timelineEntrySchema } from "../timeline/timelineEntry";
import { todoSchema } from "./todo";
import { uuidV5 } from "../../../domain/core/uuidV5";

// Which todos a timeline entry links (planner-3): one row per (entry, todo),
// many to many. A todo discussed at two visits shows on both; a note links
// the todos it asks for. Built as `timeline_entry_provider` is.
//
// The id is derived from the pair (`entryTodoId`), so two devices that link
// the same todo offline write the same row, and replays land on it.
// Unlinking deletes the row; linking again writes the same id. Soft-deleting
// either end keeps the row (readers join live rows only).
//
// No kind check here or in the service: screens show links only on
// `NOTE_DOCUMENT_KINDS` (notes and events).

/** The namespace for link ids (a fixed, random UUID; never change it: the migration's backfill uses it). */
export const ENTRY_TODO_NAMESPACE = "2fa00756-8b6f-4ca0-b198-c34baab5a7ce";

/** A link's id: the version 5 UUID of its entry and todo ids. Case-insensitive in its inputs. */
export const entryTodoId = (entryId: string, todoId: string) =>
  uuidV5(`${entryId.toLowerCase()}:${todoId.toLowerCase()}`, ENTRY_TODO_NAMESPACE);

export const timelineEntryTodoSchema = pgTable(
  "timeline_entry_todo",
  {
    // Always given: entryTodoId(entryId, todoId).
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull(),
    entryId: uuid("entry_id").notNull(),
    todoId: uuid("todo_id").notNull(),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // Both ends must be in the link's group; a hard delete of either removes the link.
    foreignKey({
      name: "timeline_entry_todo_entry_fk",
      columns: [t.groupId, t.entryId],
      foreignColumns: [timelineEntrySchema.groupId, timelineEntrySchema.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "timeline_entry_todo_todo_fk",
      columns: [t.groupId, t.todoId],
      foreignColumns: [todoSchema.groupId, todoSchema.id],
    }).onDelete("cascade"),
    unique("timeline_entry_todo_entry_todo_unique").on(t.entryId, t.todoId),
    // A todo's linked entries.
    index("timeline_entry_todo_todo_idx").on(t.todoId),
  ],
);

export type TimelineEntryTodoSchema = typeof timelineEntryTodoSchema;
export type TimelineEntryTodoSelect = InferSelectModel<TimelineEntryTodoSchema>;
export type TimelineEntryTodoInsert = Omit<InferInsertModel<TimelineEntryTodoSchema>, ProtectedField>;
export type TimelineEntryTodo = TimelineEntryTodoSelect;

/**
 * Link a todo to an entry. `id`, when given (a device's upload), must be
 * the pair's derived id.
 */
export const entryTodoLinkZSchema = z
  .strictObject({
    id: z.uuid().optional(),
    groupId: z.uuid(),
    entryId: z.uuid(),
    todoId: z.uuid(),
  })
  .refine((v) => !v.id || v.id.toLowerCase() === entryTodoId(v.entryId, v.todoId), {
    path: ["id"],
    error: "A link's id comes from its entry and todo",
  });
export type EntryTodoLinkInput = z.input<typeof entryTodoLinkZSchema>;
