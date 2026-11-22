import type { TodoContent, TodoUpdateInput } from "@caretook/data/schema";
import type { ActionResult } from "../core/api";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import {
  ASSIGNEE_NOT_MEMBER_ISSUE,
  BAD_TODO_LINK_ISSUES,
  canCompleteTodo,
  isTodoWriter,
  repeatColumnsFor,
  todoContentOf,
  todoContentZSchema,
  todoCreateZSchema,
  todoUpdateZSchema,
} from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { noteDocuments, todos } from "../sync/schema";
import { forbidden, fromLocalTimestamp, groupFor, nowTimestamp, readRows } from "../timeline/timeline.sync";

// Todos on this device: local queries for `useLiveQuery` and loaders, and
// local writes that validate with the shared Zod schemas and check the role
// (writers, or a viewer completing their own todo: `canCompleteTodo`), like
// carePeriods.ts. Writes queue for upload (sync.upload's todoOp), where
// todoService checks them again. State and order come from todoRules.

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type TodoRow = {
  id: string;
  group_id: string | null;
  recipient_id: string | null;
  title: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  due_on: string | null;
  due_time: string | null;
  done_at: string | null;
  done_by: string | null;
  provider_id: string | null;
  medication_id: string | null;
  event_id: string | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  // Added through a member's AI assistant (connectors; optional: rows from before it synced).
  via?: string | null;
  // Repeating (planner-2; optional: rows from before it synced): the rule, anchor and chain.
  repeat_rule?: string | null;
  repeat_starts_on?: string | null;
  repeat_id?: string | null;
};

export type LocalTodo = {
  id: string;
  groupId: string;
  recipientId: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueOn: string | null;
  dueTime: string | null;
  /** ISO 8601, or null while open. */
  doneAt: string | null;
  doneBy: string | null;
  providerId: string | null;
  medicationId: string | null;
  eventId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  /** The assistant it was added through ("Claude"), or null. */
  via: string | null;
  /** RRULE text when it repeats (with its anchor day and chain id), else all null. */
  repeatRule: string | null;
  repeatStartsOn: string | null;
  repeatId: string | null;
};

/** A local row as a todo, or null for a half-synced one. */
export const toTodo = (row: TodoRow): LocalTodo | null => {
  if (!row.group_id || row.title == null) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    recipientId: row.recipient_id ?? "",
    title: row.title,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    dueOn: row.due_on,
    dueTime: row.due_time,
    doneAt: row.done_at ? fromLocalTimestamp(row.done_at) : null,
    doneBy: row.done_by,
    providerId: row.provider_id,
    medicationId: row.medication_id,
    eventId: row.event_id,
    deletedAt: row.deleted_at ? fromLocalTimestamp(row.deleted_at) : null,
    createdAt: row.created_at ? fromLocalTimestamp(row.created_at) : "",
    updatedAt: row.updated_at ? fromLocalTimestamp(row.updated_at) : "",
    createdBy: row.created_by ?? "",
    updatedBy: row.updated_by ?? "",
    via: row.via ?? null,
    repeatRule: row.repeat_rule ?? null,
    repeatStartsOn: row.repeat_starts_on ?? null,
    repeatId: row.repeat_id ?? null,
  };
};

export const toTodos = (rows: TodoRow[]) => rows.map(toTodo).filter((t): t is LocalTodo => t !== null);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type TodosFilter = {
  /** Open todos (the default), or done ones (newest first). */
  done?: boolean;
  /** Only the chip's todos (see `showsTodo` in lib/todos/todoList.ts): mine needs `userId`. */
  who?: "mine" | "unassigned" | "everyone";
  userId?: string;
  /** At most this many (the Done list's pages). */
  limit?: number;
};

const whoCondition = ({ who, userId }: TodosFilter): { sql: string; params: unknown[] } => {
  if (who === "mine") return { sql: " AND assignee_id = ?", params: [userId ?? ""] };
  if (who === "unassigned")
    return {
      sql: " AND assignee_id IS NULL AND (assignee_name IS NULL OR TRIM(assignee_name) = '')",
      params: [],
    };
  return { sql: "", params: [] };
};

/**
 * A group's live todos: open ones by due day (sort them with `todoOrder`,
 * which knows the zone), or done ones newest first.
 */
export const todosQuery = (groupId: string, filter: TodosFilter = {}): LocalQuery => {
  const who = whoCondition(filter);
  return {
    sql: `SELECT * FROM todo WHERE group_id = ? AND deleted_at IS NULL
          AND done_at IS ${filter.done ? "NOT NULL" : "NULL"}${who.sql}
          ORDER BY ${filter.done ? "done_at DESC, id" : "due_on IS NULL, due_on, due_time, created_at, id"}
          ${filter.limit ? "LIMIT ?" : ""}`,
    params: [groupId, ...who.params, ...(filter.limit ? [filter.limit] : [])],
  };
};

/** How many done todos the chip shows (the Done list's "Show more"). */
export const doneCountQuery = (
  groupId: string,
  filter: Pick<TodosFilter, "who" | "userId"> = {},
): LocalQuery => {
  const who = whoCondition(filter);
  return {
    sql: `SELECT COUNT(*) AS count FROM todo WHERE group_id = ? AND deleted_at IS NULL AND done_at IS NOT NULL${who.sql}`,
    params: [groupId, ...who.params],
  };
};

/** One todo, deleted or not (screens decide: a deleted one is a 404). */
export const todoQuery = (id: string): LocalQuery => ({
  sql: "SELECT * FROM todo WHERE id = ?",
  params: [id],
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;
export type TodoWriteResult = { ok: true; id: string } | Refusal;

const refuse = (error: string, issues: Refusal["issues"] = []): Refusal => ({ ok: false, error, issues });

const invalid = (error: { issues: { path: PropertyKey[]; message: string }[] }): Refusal =>
  refuse(
    "The todo is invalid",
    error.issues.map(({ path, message }) => ({ path: path.map(String).join("."), message })),
  );

const todoMissing = refuse("That todo is gone. It may have been deleted.");
const viewerOnly = refuse("Viewers can only complete or reopen todos assigned to them");

const liveTodo = async (db: SyncDb, id: string) => {
  const [row] = await readRows<TodoRow>(db, todoQuery(id));
  const todo = row ? toTodo(row) : null;
  return todo && !todo.deletedAt ? todo : null;
};

const recipientOf = async (db: SyncDb, groupId: string) => {
  const [row] = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM care_recipient WHERE group_id = ?",
    params: [groupId],
  });
  return row?.id ?? null;
};

/** The assignee must be a member of the group (see `todoService`'s `checkAssignee`). */
const assigneeRefusal = async (db: SyncDb, groupId: string, assigneeId: string | null) => {
  if (!assigneeId) return null;
  const rows = await readRows<{ user_id: string }>(db, {
    sql: "SELECT user_id FROM care_group_member WHERE group_id = ? AND user_id = ?",
    params: [groupId, assigneeId],
  });
  return rows.length
    ? null
    : refuse("The assignee must be a member of this care group", [{ ...ASSIGNEE_NOT_MEMBER_ISSUE }]);
};

const LINK_TABLES = {
  providerId: "provider",
  medicationId: "medication",
  eventId: "timeline_entry",
} as const;

/** Each link given must be live in the group, and the event an event (see `todoService`'s `checkLinks`). */
const linkRefusal = async (
  db: SyncDb,
  groupId: string,
  links: Partial<Record<keyof typeof LINK_TABLES, string | null>>,
) => {
  for (const field of Object.keys(LINK_TABLES) as (keyof typeof LINK_TABLES)[]) {
    const id = links[field];
    if (!id) continue;
    const table = LINK_TABLES[field];
    const [row] = await readRows<{
      group_id: string | null;
      deleted_at: string | null;
      kind?: string | null;
    }>(db, {
      sql: `SELECT group_id, deleted_at${table === "timeline_entry" ? ", kind" : ""} FROM ${table} WHERE id = ?`,
      params: [id],
    });
    const ok =
      !!row &&
      !row.deleted_at &&
      row.group_id === groupId &&
      (table !== "timeline_entry" || row.kind === "event");
    if (!ok) return refuse("A linked item must be in this care group", [{ ...BAD_TODO_LINK_ISSUES[field] }]);
  }
  return null;
};

const contentColumns = (content: Omit<TodoContent, "doneAt" | "doneBy">) => ({
  title: content.title,
  assigneeId: content.assigneeId,
  assigneeName: content.assigneeName,
  dueOn: content.dueOn,
  dueTime: content.dueTime,
  providerId: content.providerId,
  medicationId: content.medicationId,
  eventId: content.eventId,
  repeatRule: content.repeatRule,
});

export type TodoInput = {
  title: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueOn?: string | null;
  dueTime?: string | null;
  providerId?: string | null;
  medicationId?: string | null;
  eventId?: string | null;
  /** RRULE text (`ruleText`) to repeat; it needs a due day. */
  repeatRule?: string | null;
};

/**
 * The row `createTodo` writes, checked as it checks it (the writer role, the
 * shared schema, a member assignee, live links), without writing it: quick
 * entry's runner inserts it in its own transaction.
 */
export const plannedTodo = async (
  db: SyncDb,
  groupId: string,
  input: TodoInput,
): Promise<{ ok: true; row: typeof todos.$inferInsert } | Refusal> => {
  const group = await groupFor(db, groupId);
  if (!isTodoWriter(group?.role)) return forbidden as Refusal;
  const recipientId = await recipientOf(db, groupId);
  if (!recipientId) return refuse("This care group has no care recipient yet");

  const parsed = todoCreateZSchema.safeParse({ groupId, ...input });
  if (!parsed.success) return invalid(parsed.error);
  const { groupId: _g, recipientId: _r, id: _id, ...content } = parsed.data;
  const assignee = await assigneeRefusal(db, groupId, content.assigneeId);
  if (assignee) return assignee;
  const links = await linkRefusal(db, groupId, content);
  if (links) return links;

  const now = nowTimestamp();
  const id = crypto.randomUUID();
  return {
    ok: true,
    row: {
      id,
      groupId,
      recipientId,
      ...contentColumns(content),
      ...repeatColumnsFor(id, null, content),
      doneAt: null,
      doneBy: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: db.userId,
      updatedBy: db.userId,
    },
  };
};

/** Add a todo on this device (writers). It syncs when the device is online. */
export const createTodo = async (db: SyncDb, groupId: string, input: TodoInput): Promise<TodoWriteResult> => {
  const planned = await plannedTodo(db, groupId, input);
  if (!planned.ok) return planned;
  await db.drizzle.insert(todos).values(planned.row);
  return { ok: true, id: planned.row.id };
};

/**
 * Edit a todo's title, assignee, due or links (writers). The merged todo must
 * be valid; a changed assignee must be a member and a changed link live.
 */
export const updateTodo = async (
  db: SyncDb,
  id: string,
  patch: TodoUpdateInput,
): Promise<TodoWriteResult> => {
  const existing = await liveTodo(db, id);
  if (!existing) return todoMissing;
  const group = await groupFor(db, existing.groupId);
  if (group?.role === "viewer") return viewerOnly;
  if (!isTodoWriter(group?.role)) return forbidden as Refusal;

  const shape = todoUpdateZSchema.safeParse(patch);
  if (!shape.success) return invalid(shape.error);
  const defined = Object.fromEntries(Object.entries(shape.data).filter(([, v]) => v !== undefined));
  const merged = todoContentZSchema.safeParse({ ...todoContentOf(existing), ...defined });
  if (!merged.success) return invalid(merged.error);
  const { doneAt: _doneAt, doneBy: _doneBy, ...content } = merged.data;

  if (content.assigneeId !== existing.assigneeId) {
    const assignee = await assigneeRefusal(db, existing.groupId, content.assigneeId);
    if (assignee) return assignee;
  }
  const links = await linkRefusal(db, existing.groupId, {
    providerId: content.providerId !== existing.providerId ? content.providerId : null,
    medicationId: content.medicationId !== existing.medicationId ? content.medicationId : null,
    eventId: content.eventId !== existing.eventId ? content.eventId : null,
  });
  if (links) return links;

  // A new rule or due day moves the anchor; no rule clears all three (as todoService).
  await db.drizzle
    .update(todos)
    .set({
      ...contentColumns(content),
      ...repeatColumnsFor(id, existing, content),
      updatedAt: nowTimestamp(),
      updatedBy: db.userId,
    })
    .where(eq(todos.id, id));
  return { ok: true, id };
};

// Repeats (planner-2): ticking a repeating todo makes the next occurrence on
// the device at once, an optimistic twin of the one todoService makes (the
// same id, `nextTodoId`); sync replaces it with the server's. Making it needs
// rrule, so `@caretook/data/series` loads only for a repeating todo.

/** The recipient's day now: a todo's days are theirs. */
const recipientToday = async (db: SyncDb, recipientId: string) => {
  const [row] = await readRows<{ time_zone: string | null }>(db, {
    sql: "SELECT time_zone FROM care_recipient WHERE id = ?",
    params: [recipientId],
  });
  return localDate(new Date(), row?.time_zone ?? "UTC");
};

type Tx = Parameters<Parameters<SyncDb["drizzle"]["transaction"]>[0]>[0];

/**
 * Write the occurrence after `todo` (ticked or skipped today) in `tx`,
 * unless a live row with its id exists; a soft-deleted one (an Undo took it
 * away) comes back as new. As `todoService`'s `insertNext`.
 */
const planNext = async (db: SyncDb, todo: LocalTodo) => {
  if (!todo.repeatRule) return null;
  const { nextOccurrence } = await import("@caretook/data/series");
  const next = nextOccurrence(todo, await recipientToday(db, todo.recipientId));
  if (!next) return null;
  const [row] = await readRows<TodoRow>(db, todoQuery(next.id));
  if (row && !row.deleted_at) return null;
  const now = nowTimestamp();
  // The group and recipient never change (a PATCH of them is refused).
  const { id, groupId: _g, recipientId: _r, ...content } = next;
  return async (tx: Tx) => {
    if (row) {
      await tx
        .update(todos)
        .set({ ...content, updatedAt: now, updatedBy: db.userId })
        .where(eq(todos.id, id));
    } else {
      await tx.insert(todos).values({
        ...next,
        createdAt: now,
        updatedAt: now,
        createdBy: db.userId,
        updatedBy: db.userId,
      });
    }
  };
};

const doneRefusal = async (db: SyncDb, existing: LocalTodo) => {
  const group = await groupFor(db, existing.groupId);
  if (canCompleteTodo({ role: group?.role, userId: db.userId, todo: existing })) return null;
  return group?.role === "viewer" ? viewerOnly : (forbidden as Refusal);
};

/**
 * Tick a todo done (writers, or a viewer on their own todo). Ticking a done
 * one is fine. A repeating todo's next occurrence is written in the same
 * local transaction.
 */
export const completeTodo = async (db: SyncDb, id: string): Promise<TodoWriteResult> => {
  const existing = await liveTodo(db, id);
  if (!existing) return todoMissing;
  const refusal = await doneRefusal(db, existing);
  if (refusal) return refusal;
  if (existing.doneAt) return { ok: true, id };
  const next = await planNext(db, existing);
  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    // Only the done columns change, so the upload maps it to complete.
    await tx.update(todos).set({ doneAt: now, doneBy: db.userId }).where(eq(todos.id, id));
    await next?.(tx);
  });
  return { ok: true, id };
};

/** The next live row of `todo`'s chain after its due day, if any (what ticking it made). */
const laterInChain = async (db: SyncDb, todo: LocalTodo) => {
  if (!todo.repeatId || !todo.dueOn) return null;
  const [row] = await readRows<TodoRow>(db, {
    sql: `SELECT * FROM todo WHERE group_id = ? AND repeat_id = ? AND id != ? AND due_on > ?
            AND deleted_at IS NULL
          ORDER BY due_on, id LIMIT 1`,
    params: [todo.groupId, todo.repeatId, todo.id, todo.dueOn],
  });
  return row ? toTodo(row) : null;
};

/**
 * Reopen a done todo, or undo a tick (the same people as `completeTodo`).
 * A repeating todo's next occurrence goes when nobody has touched it (open,
 * as the tick made it, no notes); otherwise both stay and this one stops
 * repeating. One local transaction, as `todoService.reopen`.
 */
export const reopenTodo = async (db: SyncDb, id: string): Promise<TodoWriteResult> => {
  const existing = await liveTodo(db, id);
  if (!existing) return todoMissing;
  const refusal = await doneRefusal(db, existing);
  if (refusal) return refusal;
  if (!existing.doneAt) return { ok: true, id };

  const next = existing.repeatRule ? await laterInChain(db, existing) : null;
  let untouched = false;
  if (next) {
    const { isUntouchedNext } = await import("@caretook/data/series");
    const notes = await readRows<{ id: string }>(db, {
      sql: "SELECT id FROM note_document WHERE id = ?",
      params: [next.id],
    });
    untouched = isUntouchedNext(existing, next) && !notes.length;
  }
  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    // The done columns (and a stopped repeat, which the server decides for
    // itself): the upload maps it to reopen.
    const stops = next && !untouched ? { repeatRule: null, repeatStartsOn: null, repeatId: null } : {};
    await tx
      .update(todos)
      .set({ doneAt: null, doneBy: null, ...stops })
      .where(eq(todos.id, id));
    if (next && untouched) {
      await tx
        .update(todos)
        .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
        .where(eq(todos.id, next.id));
    }
  });
  return { ok: true, id };
};

/**
 * Skip this occurrence of a repeating todo (writers): it's soft-deleted and
 * the next one written, in one local transaction (as `todoService.skip`).
 * One that doesn't repeat, or whose rule has ended, is just deleted.
 */
export const skipTodo = async (db: SyncDb, id: string): Promise<TodoWriteResult> => {
  const existing = await liveTodo(db, id);
  if (!existing) return todoMissing;
  const group = await groupFor(db, existing.groupId);
  if (!isTodoWriter(group?.role)) return forbidden as Refusal;
  const next = await planNext(db, existing);
  const now = nowTimestamp();
  await db.drizzle.transaction(async (tx) => {
    await tx
      .update(todos)
      .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
      .where(eq(todos.id, id));
    await next?.(tx);
  });
  return { ok: true, id };
};

/** Soft delete (writers). Deleting what's gone is fine. */
export const removeTodo = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const existing = await liveTodo(db, id);
  if (!existing) return { ok: true };
  const group = await groupFor(db, existing.groupId);
  if (!isTodoWriter(group?.role)) return forbidden;
  const now = nowTimestamp();
  await db.drizzle
    .update(todos)
    .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
    .where(eq(todos.id, id));
  return { ok: true };
};

// ---------------------------------------------------------------------------
// Notes (todos slice 2)
// ---------------------------------------------------------------------------

/**
 * Make a todo's notes document (writers), on the first real change: its id
 * is the todo's. Idempotent; it syncs like the medication page's
 * (`noteDocumentService.create` checks the todo is live and in the group).
 */
export const createTodoDocument = async (db: SyncDb, todoId: string): Promise<ActionResult> => {
  const todo = await liveTodo(db, todoId);
  if (!todo) return todoMissing;
  const group = await groupFor(db, todo.groupId);
  if (!isTodoWriter(group?.role)) return forbidden;
  const existing = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM note_document WHERE id = ?",
    params: [todoId],
  });
  if (existing.length) return { ok: true };
  const now = nowTimestamp();
  await db.drizzle.insert(noteDocuments).values({
    id: todoId,
    groupId: todo.groupId,
    subject: "todo",
    entryId: null,
    providerId: null,
    medicationId: null,
    carePeriodId: null,
    todoId: todoId,
    snapshot: null,
    text: "",
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  });
  return { ok: true };
};

// ---------------------------------------------------------------------------
// Due todos (todos slice 4: Upcoming and the timeline's todo strip)
// ---------------------------------------------------------------------------

// Kept with this block (not at the top) so parallel slices' additions merge
// as separate hunks; imports are hoisted either way.
import { addDays, localDate, todoOrder } from "@caretook/data/schema";
import { useMemo } from "react";
import { useNow } from "../live-notes/editors.sync";
import { useRememberedQuery } from "../sync/useRememberedQuery";

/**
 * A group's open (not done, not deleted) todos with a due day, from `from`
 * through `to` ("YYYY-MM-DD", either null for no bound), by due day. Undated
 * todos are never due. Sort with `todoOrder`, which knows the zone.
 */
export const dueTodosQuery = (groupId: string, from: string | null, to: string | null): LocalQuery => ({
  sql: `SELECT * FROM todo WHERE group_id = ? AND deleted_at IS NULL AND done_at IS NULL
          AND due_on IS NOT NULL${from ? " AND due_on >= ?" : ""}${to ? " AND due_on <= ?" : ""}
        ORDER BY due_on, due_time IS NOT NULL, due_time, created_at, id`,
  params: [groupId, ...(from ? [from] : []), ...(to ? [to] : [])],
});

/** How often due todos are re-evaluated (overdue and today follow the clock). */
export const DUE_TODOS_TICK_MS = 60_000;

/** The last day `useDueTodos` reads, `days` after today in the recipient's zone. */
export const dueTodosThrough = (now: Date | number, timeZone: string, days: number) =>
  addDays(localDate(now, timeZone), days);

const NO_TODO_ROWS: TodoRow[] = [];

/**
 * A group's open dated todos due by `days` after today (0: overdue and
 * today's only), in `todoOrder`, live and re-evaluated once a minute.
 * `timeZone` is the recipient's: due days and times are wall-clock there.
 * `initial` is a loader's rows (from `dueTodosQuery`). Left out, the query
 * reads through the tile cache (`useRememberedQuery`, under `name`, which
 * differs per `days`): `ready` is true once there's an answer, remembered
 * from earlier this session or live, and `fresh` once it has answered live.
 */
export function useDueTodos(
  groupId: string,
  timeZone: string,
  { days = 0, initial }: { days?: number; initial?: TodoRow[] } = {},
) {
  const now = useNow(DUE_TODOS_TICK_MS);
  // Keyed on the day, so the query only changes at midnight.
  const query = dueTodosQuery(groupId, null, dueTodosThrough(now, timeZone, days));
  const { value, fresh } = useRememberedQuery<TodoRow>({ groupId, name: `dueTodos:${days}` }, query, initial);
  const rows = value ?? NO_TODO_ROWS;
  const todos = useMemo(() => todoOrder(toTodos(rows), now, timeZone), [rows, now, timeZone]);
  return { todos, now, timeZone, ready: value !== undefined, fresh };
}

// ---------------------------------------------------------------------------
// Links (todos slice 3: the pickers, the todo page's link rows, LinkedTodos)
// ---------------------------------------------------------------------------

/** What a todo can link to: one of each. */
export type TodoLink = { providerId: string } | { medicationId: string } | { eventId: string };

const LINK_COLUMNS = {
  providerId: "provider_id",
  medicationId: "medication_id",
  eventId: "event_id",
} as const;

/** The one link a `TodoLink` names, as its form field and id. */
export const linkOf = (link: TodoLink): { field: keyof typeof LINK_COLUMNS; id: string } => {
  if ("providerId" in link) return { field: "providerId", id: link.providerId };
  if ("medicationId" in link) return { field: "medicationId", id: link.medicationId };
  return { field: "eventId", id: link.eventId };
};

/**
 * A group's open (not done, not deleted) todos linked to one provider,
 * medication or event, by due day (sort with `todoOrder`, which knows the zone).
 */
export const linkedTodosQuery = (groupId: string, link: TodoLink): LocalQuery => {
  const { field, id } = linkOf(link);
  return {
    sql: `SELECT * FROM todo WHERE group_id = ? AND ${LINK_COLUMNS[field]} = ?
            AND deleted_at IS NULL AND done_at IS NULL
          ORDER BY due_on IS NULL, due_on, due_time, created_at, id`,
    params: [groupId, id],
  };
};

/**
 * The events the todo form's appointment picker reads: the group's live
 * events from `from` (a moment, ISO 8601) on, plus `chosenId` wherever it
 * is (an older or cancelled one a todo already links to, for its chip).
 * `todoLinks.ts` picks and orders the choices.
 */
export const todoEventChoicesQuery = (
  groupId: string,
  from: string,
  chosenId: string | null,
): LocalQuery => ({
  sql: `SELECT * FROM timeline_entry WHERE group_id = ? AND kind = 'event' AND deleted_at IS NULL
          AND (occurred_at >= ? OR id = ?)
        ORDER BY occurred_at, id`,
  params: [groupId, toLocalTimestamp(from), chosenId ?? ""],
});

/** A todo's linked event, while it's a live event (a deleted one's link is gone). */
export const linkedEventQuery = (id: string): LocalQuery => ({
  sql: "SELECT * FROM timeline_entry WHERE id = ? AND kind = 'event' AND deleted_at IS NULL",
  params: [id],
});

import { toLocalTimestamp } from "../timeline/timeline.sync";
