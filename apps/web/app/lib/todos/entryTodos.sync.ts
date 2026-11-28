import type { ActionResult } from "../core/api";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import { entryTodoId } from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { timelineEntryTodos } from "../sync/schema";
import { forbidden, groupFor, nowTimestamp, readRows } from "../timeline/timeline.sync";
import { isTodoWriter } from "@caretook/data/domain";

// Which todos a timeline entry links, on this device (planner-3): the entry ↔
// todo links (`timeline_entry_todo`), many to many. Writes queue for upload,
// where entryTodoService checks them again (PUT links, DELETE unlinks). A
// link's id comes from its pair (`entryTodoId`), so two devices linking one
// pair offline make one row.
//
// Soft-deleting an entry or a todo keeps its link rows; every read here
// joins live rows only. No kind check: screens show links on notes and
// events (`NOTE_DOCUMENT_KINDS`). New code never writes `todo.event_id`.
// One live query per list, never one per row.

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** An entry's live linked todos, open and done (sort them with `todoOrder` / `doneOrder`). */
export const entryTodosQuery = (entryId: string): LocalQuery => ({
  sql: `SELECT t.* FROM timeline_entry_todo l
        JOIN todo t ON t.id = l.todo_id AND t.group_id = l.group_id
        WHERE l.entry_id = ? AND t.deleted_at IS NULL
        ORDER BY l.created_at, l.id`,
  params: [entryId],
});

/** A todo's live linked entries, newest first. */
export const todoEntriesQuery = (todoId: string): LocalQuery => ({
  sql: `SELECT e.* FROM timeline_entry_todo l
        JOIN timeline_entry e ON e.id = l.entry_id AND e.group_id = l.group_id
        WHERE l.todo_id = ? AND e.deleted_at IS NULL
        ORDER BY e.occurred_at DESC, e.id DESC`,
  params: [todoId],
});

export type OpenTodoCountRow = { entry_id: string; open: number };

/** How many live open todos each live entry in the group links (entries with none are left out). */
export const openTodoCountsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT l.entry_id, COUNT(*) AS open FROM timeline_entry_todo l
        JOIN todo t ON t.id = l.todo_id AND t.group_id = l.group_id
        JOIN timeline_entry e ON e.id = l.entry_id AND e.group_id = l.group_id
        WHERE l.group_id = ? AND t.deleted_at IS NULL AND t.done_at IS NULL AND e.deleted_at IS NULL
        GROUP BY l.entry_id`,
  params: [groupId],
});

/** The counts by entry id. */
export const openCountsByEntry = (rows: readonly OpenTodoCountRow[]) =>
  new Map(rows.map((r) => [r.entry_id, Number(r.open)]));

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;
const refuse = (error: string): Refusal => ({ ok: false, error, issues: [] });
const entryMissing = refuse("That entry is gone. It may have been deleted.");
const todoMissing = refuse("That todo is gone. It may have been deleted.");

const liveRow = async (db: SyncDb, table: "timeline_entry" | "todo", id: string) => {
  const [row] = await readRows<{ group_id: string | null }>(db, {
    sql: `SELECT group_id FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
    params: [id],
  });
  return row?.group_id ?? null;
};

const canLink = async (db: SyncDb, groupId: string) => isTodoWriter((await groupFor(db, groupId))?.role);

/** The row a link inserts (also for writers that link inside their own transaction). */
export const entryTodoRow = (db: SyncDb, groupId: string, entryId: string, todoId: string) => {
  const now = nowTimestamp();
  return {
    id: entryTodoId(entryId, todoId),
    groupId,
    entryId,
    todoId,
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  };
};

/**
 * Link a todo to an entry (writers). Both must be live, in one group.
 * Idempotent: linking a pair that's already linked changes nothing.
 */
export const linkTodo = async (db: SyncDb, entryId: string, todoId: string): Promise<ActionResult> => {
  const groupId = await liveRow(db, "timeline_entry", entryId);
  if (!groupId) return entryMissing;
  const todoGroup = await liveRow(db, "todo", todoId);
  if (todoGroup !== groupId) return todoMissing;
  if (!(await canLink(db, groupId))) return forbidden;

  const row = entryTodoRow(db, groupId, entryId, todoId);
  const [linked] = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM timeline_entry_todo WHERE id = ?",
    params: [row.id],
  });
  if (!linked) await db.drizzle.insert(timelineEntryTodos).values(row);
  return { ok: true };
};

/** Remove a link (writers; a hard delete, so it uploads as a DELETE). Unlinking what isn't linked is fine. */
export const unlinkTodo = async (db: SyncDb, entryId: string, todoId: string): Promise<ActionResult> => {
  const id = entryTodoId(entryId, todoId);
  const [link] = await readRows<{ group_id: string | null }>(db, {
    sql: "SELECT group_id FROM timeline_entry_todo WHERE id = ?",
    params: [id],
  });
  if (!link) return { ok: true };
  if (!link.group_id || !(await canLink(db, link.group_id))) return forbidden;
  await db.drizzle.delete(timelineEntryTodos).where(eq(timelineEntryTodos.id, id));
  return { ok: true };
};

// ---------------------------------------------------------------------------
// The todo page's Linked to (planner-3 slice 4)
// ---------------------------------------------------------------------------

/** The documents of a todo's live linked entries, as `NoteDocRow`s (their preview text: `previewText`). */
export const todoEntryDocumentsQuery = (todoId: string): LocalQuery => ({
  sql: `SELECT d.id, d.snapshot, d.text,
               (SELECT json_group_array(u.data) FROM note_update u WHERE u.document_id = d.id) AS updates
        FROM timeline_entry_todo l
        JOIN timeline_entry e ON e.id = l.entry_id AND e.group_id = l.group_id
        JOIN note_document d ON d.id = e.id
        WHERE l.todo_id = ? AND e.deleted_at IS NULL`,
  params: [todoId],
});

export type LinkableEntryRow = {
  id: string;
  kind: string;
  title: string | null;
  occurred_at: string;
  text: string | null;
};

/** How many notes and events "Link an entry" reads (newest first). */
export const LINKABLE_ENTRIES_LIMIT = 500;

/** The group's live notes and events this todo doesn't link yet, newest first, with their documents' text. */
export const linkableEntriesQuery = (groupId: string, todoId: string): LocalQuery => ({
  sql: `SELECT e.id, e.kind, e.title, e.occurred_at, d.text FROM timeline_entry e
        LEFT JOIN note_document d ON d.id = e.id
        WHERE e.group_id = ? AND e.kind IN ('note', 'event') AND e.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM timeline_entry_todo l WHERE l.entry_id = e.id AND l.todo_id = ?)
        ORDER BY e.occurred_at DESC, e.id DESC
        LIMIT ${LINKABLE_ENTRIES_LIMIT}`,
  params: [groupId, todoId],
});
