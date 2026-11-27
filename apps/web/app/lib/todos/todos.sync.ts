import type { TodoContent, TodoUpdateInput } from "@caretook/data/schema";
import type { ActionResult } from "../core/api";
import type { SyncDb } from "../sync/index";
import type { LocalQuery } from "../timeline/timeline.sync";

import {
  ASSIGNEE_NOT_MEMBER_ISSUE,
  BAD_PARENT_ISSUE,
  BAD_TODO_LINK_ISSUES,
  canCompleteTodo,
  canHaveSubtask,
  isTodoCompleter,
  isTodoWriter,
  MAX_TODO_DEPTH,
  NOTE_DOCUMENT_KINDS,
  REPEAT_WITH_SUBTASKS_ISSUE,
  repeatColumnsFor,
  ROLLUP_METADATA,
  rollupOf,
  SIBLING_ORDER_SQL,
  todoContentOf,
  todoContentZSchema,
  todoCreateZSchema,
  todoUpdateZSchema,
  UNDO_NEXT_METADATA,
} from "@caretook/data/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { noteDocuments, recordTags, timelineEntryTodos, todos } from "../sync/schema";
import { recordTagRow } from "../tags/tags.sync";
import { forbidden, fromLocalTimestamp, groupFor, nowTimestamp, readRows } from "../timeline/timeline.sync";
import { entryTodoRow } from "./entryTodos.sync";

// Todos on this device: local queries for `useLiveQuery` and loaders, and
// local writes that validate with the shared Zod schemas and check the role
// (writers, or a viewer completing their own todo: `canCompleteTodo`), like
// carePeriods.ts. Writes queue for upload (sync.upload's todoOp), where
// todoService checks them again. State and order come from todoRules.
//
// A todo's events are link rows (`timeline_entry_todo`, planner-3): this
// device never writes `todo.event_id` (only the quick-entry runner's
// `plannedTodo` row still carries it, until it links too). Creating with an
// event or an entry writes the todo and its link in one local transaction.

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
  // A subtask's parent (todo-subtasks; optional: rows from before it synced).
  parent_id?: string | null;
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
  /** The todo it's a subtask of, or null for a top-level one. */
  parentId: string | null;
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
    parentId: row.parent_id ?? null,
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
  /** Only the todos carrying this tag (`?tag=`; tags PRD). */
  tagId?: string | null;
  /** Only the todos that list on their own (`listsOnItsOwn`: top-level, or a dated or assigned subtask). */
  listed?: boolean;
  /**
   * The Done list's rule (todo-subtasks-3): top-level todos, and subtasks whose
   * top-level todo is done too. One whose top-level todo is open shows struck in
   * that tree (`todoTreesQuery`) instead.
   */
  doneListed?: boolean;
};

/** `listsOnItsOwn` in SQL, for the queries that page or count (the Done list). */
const LISTED_SQL = ` AND (parent_id IS NULL OR due_on IS NOT NULL OR assignee_id IS NOT NULL
  OR (assignee_name IS NOT NULL AND TRIM(assignee_name) <> ''))`;

/**
 * A todo's top-level todo's `done_at`, as a correlated subquery on the outer
 * `todo` (never a join: the other conditions' columns are unqualified). With
 * `MAX_TODO_DEPTH` 3 the top is the parent or the parent's parent.
 */
const TOP_DONE_AT_SQL = `(SELECT top_todo.done_at FROM todo top_todo WHERE top_todo.id = COALESCE(
  (SELECT up_todo.parent_id FROM todo up_todo WHERE up_todo.id = todo.parent_id), todo.parent_id))`;

/** `doneListed` in SQL: top-level, or under a done top-level todo. */
const DONE_LISTED_SQL = ` AND (parent_id IS NULL OR ${TOP_DONE_AT_SQL} IS NOT NULL)`;

const whoCondition = ({ who, userId }: TodosFilter): { sql: string; params: unknown[] } => {
  if (who === "mine") return { sql: " AND assignee_id = ?", params: [userId ?? ""] };
  if (who === "unassigned")
    return {
      sql: " AND assignee_id IS NULL AND (assignee_name IS NULL OR TRIM(assignee_name) = '')",
      params: [],
    };
  return { sql: "", params: [] };
};

/** The chip's condition, the tag's and the listing rule's, ANDed. */
const filterCondition = (filter: TodosFilter): { sql: string; params: unknown[] } => {
  const chip = whoCondition(filter);
  const listing = (filter.listed ? LISTED_SQL : "") + (filter.doneListed ? DONE_LISTED_SQL : "");
  const who = listing ? { sql: chip.sql + listing, params: chip.params } : chip;
  if (!filter.tagId) return who;
  return {
    sql: `${who.sql} AND id IN (SELECT todo_id FROM record_tag WHERE tag_id = ? AND todo_id IS NOT NULL)`,
    params: [...who.params, filter.tagId],
  };
};

/**
 * A group's live todos: open ones by due day (sort them with `todoOrder`,
 * which knows the zone), or done ones newest first.
 */
export const todosQuery = (groupId: string, filter: TodosFilter = {}): LocalQuery => {
  const who = filterCondition(filter);
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
  filter: Pick<TodosFilter, "who" | "userId" | "tagId" | "listed" | "doneListed"> = {},
): LocalQuery => {
  const who = filterCondition(filter);
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

/**
 * The trees' rows (todo-subtasks-3): the group's open live todos and its live
 * done subtasks whose top-level todo is open (they show struck in their tree),
 * in `siblingOrder`. One live query for a whole list of trees (`todoTrees`
 * builds them on the device), never one per row.
 */
export const todoTreesQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT * FROM todo WHERE group_id = ? AND deleted_at IS NULL
        AND (done_at IS NULL OR (parent_id IS NOT NULL AND ${TOP_DONE_AT_SQL} IS NULL))
        ORDER BY ${SIBLING_ORDER_SQL}`,
  params: [groupId],
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
/** A completer's refusal (a viewer or an easy role), the server's `todoService:completionOnly` twin. */
const completionOnly = refuse("You can only complete or reopen todos assigned to you");

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
  repeatRule: content.repeatRule,
});

// Subtasks (todo-subtasks): the tree rules are todoTree's, checked against
// the local copy as todoService checks them, so a refused upload is never
// queued. The device doesn't roll a parent up yet: the server does.

const badParent = refuse("Choose a todo in this care group that can have subtasks", [
  { ...BAD_PARENT_ISSUE },
]);
const repeatWithSubtasks = refuse("A subtask, or a todo with subtasks, can't repeat", [
  { ...REPEAT_WITH_SUBTASKS_ISSUE },
]);

/**
 * A todo's ancestors, its parent first, deleted ones included (they still
 * count for depth). Stops past `MAX_TODO_DEPTH`: enough to refuse.
 */
const ancestorsOf = async (db: SyncDb, todo: { parentId: string | null }) => {
  const chain: LocalTodo[] = [];
  let parentId = todo.parentId;
  while (parentId && chain.length < MAX_TODO_DEPTH) {
    const [row] = await readRows<TodoRow>(db, todoQuery(parentId));
    const parent = row ? toTodo(row) : null;
    if (!parent) break;
    chain.push(parent);
    parentId = parent.parentId;
  }
  return chain;
};

/** A new subtask's parent must be live in the group and able to take one (`canHaveSubtask`). */
const parentRefusal = async (db: SyncDb, groupId: string, parentId: string | null | undefined) => {
  if (!parentId) return null;
  const parent = await liveTodo(db, parentId);
  if (parent?.groupId !== groupId) return badParent;
  return canHaveSubtask(await ancestorsOf(db, parent), parent) ? null : badParent;
};

/** Whether the todo has a live subtask. */
const hasLiveSubtasks = async (db: SyncDb, id: string) =>
  (
    await readRows<{ id: string }>(db, {
      sql: "SELECT id FROM todo WHERE parent_id = ? AND deleted_at IS NULL LIMIT 1",
      params: [id],
    })
  ).length > 0;

export type TodoInput = {
  title: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueOn?: string | null;
  dueTime?: string | null;
  providerId?: string | null;
  medicationId?: string | null;
  /** An event to link (the form's picker): `createTodo` writes it as a link row. */
  eventId?: string | null;
  /**
   * `createTodo` only: a live note or event to link (`todos/new?entryId=`).
   * One that isn't live in the group is ignored.
   */
  entryId?: string | null;
  /** RRULE text (`ruleText`) to repeat; it needs a due day. */
  repeatRule?: string | null;
  /** `createTodo` only: the todo this is a subtask of (`canHaveSubtask`; it never repeats). */
  parentId?: string | null;
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

  const { entryId: _entryId, ...fields } = input;
  const parsed = todoCreateZSchema.safeParse({ groupId, ...fields });
  if (!parsed.success) return invalid(parsed.error);
  const { groupId: _g, recipientId: _r, id: _id, ...content } = parsed.data;
  const assignee = await assigneeRefusal(db, groupId, content.assigneeId);
  if (assignee) return assignee;
  const links = await linkRefusal(db, groupId, content);
  if (links) return links;
  const parent = await parentRefusal(db, groupId, content.parentId);
  if (parent) return parent;
  if (content.parentId && content.repeatRule) return repeatWithSubtasks;

  const now = nowTimestamp();
  const id = crypto.randomUUID();
  return {
    ok: true,
    row: {
      id,
      groupId,
      recipientId,
      ...contentColumns(content),
      parentId: content.parentId,
      // The quick-entry runner's until it writes a link row; `createTodo` takes it off.
      eventId: content.eventId,
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

// The rollup on the device (todo-subtasks): a child's tick, reopen or
// delete, or a new subtask, moves its parent chain in the same local
// transaction, as `todoService.rollUp` does on the server. Each parent's
// write is flagged (`ROLLUP_METADATA`), so the upload recomputes it from the
// server's rows rather than replaying it as a complete or reopen.

type Tx = Parameters<Parameters<SyncDb["drizzle"]["transaction"]>[0]>[0];

/** A todo as the rollup sees it after this write: under `parentId`, done or not, live or not. */
type TreeChange = { id: string; parentId: string | null; doneAt: string | null; deletedAt: string | null };

/**
 * The parent writes `change` makes, from its parent up to the top: each is
 * `rollupOf` its live children here, `change` (and the writes below it)
 * counted as written. A completed parent is done at `at` by this user.
 * Returns the writes to run in the caller's transaction (none: a no-op).
 */
const planRollup = async (db: SyncDb, change: TreeChange, at: string) => {
  const changed = new Map([[change.id, change]]);
  const writes: { id: string; doneAt: string | null }[] = [];
  let id = change.parentId;
  for (let depth = 0; id && depth < MAX_TODO_DEPTH; depth++) {
    const [parent] = await readRows<{
      parent_id: string | null;
      done_at: string | null;
      deleted_at: string | null;
    }>(db, { sql: "SELECT parent_id, done_at, deleted_at FROM todo WHERE id = ?", params: [id] });
    // A deleted parent (or one not on this device) stops the climb, as on the server.
    if (!parent || parent.deleted_at) break;
    const rows = await readRows<{ id: string; done_at: string | null; deleted_at: string | null }>(db, {
      sql: "SELECT id, done_at, deleted_at FROM todo WHERE parent_id = ?",
      params: [id],
    });
    const children = [
      ...rows.filter((r) => !changed.has(r.id)).map((r) => ({ doneAt: r.done_at, deletedAt: r.deleted_at })),
      ...[...changed.values()].filter((c) => c.parentId === id),
    ];
    const step = rollupOf({ doneAt: parent.done_at }, children);
    if (step) {
      const doneAt = step === "complete" ? at : null;
      writes.push({ id, doneAt });
      changed.set(id, { id, parentId: parent.parent_id ?? null, doneAt, deletedAt: null });
    }
    id = parent.parent_id ?? null;
  }
  return async (tx: Tx) => {
    for (const write of writes) {
      // `_metadata` is PowerSync's, outside the Drizzle table (as an Undo's flag).
      await tx.run(
        sql`UPDATE todo SET done_at = ${write.doneAt}, done_by = ${write.doneAt ? db.userId : null},
              _metadata = ${ROLLUP_METADATA} WHERE id = ${write.id}`,
      );
    }
  };
};

/** A live note or event in the group (what `entryId` may link), else null. */
const linkableEntry = async (db: SyncDb, groupId: string, entryId: string | null | undefined) => {
  if (!entryId) return null;
  const [row] = await readRows<{ id: string }>(db, {
    sql: `SELECT id FROM timeline_entry WHERE id = ? AND group_id = ? AND deleted_at IS NULL
            AND kind IN (${NOTE_DOCUMENT_KINDS.map(() => "?").join(", ")})`,
    params: [entryId, groupId, ...NOTE_DOCUMENT_KINDS],
  });
  return row?.id ?? null;
};

/**
 * Add a todo on this device (writers). It syncs when the device is online.
 * Its event (the picker's, checked live) and `entryId` (a live note or
 * event, else ignored) become link rows in the same local transaction; the
 * todo's `event_id` stays empty.
 */
export const createTodo = async (db: SyncDb, groupId: string, input: TodoInput): Promise<TodoWriteResult> => {
  const planned = await plannedTodo(db, groupId, input);
  if (!planned.ok) return planned;
  const { eventId, ...row } = planned.row;
  const entry = await linkableEntry(db, groupId, input.entryId);
  const linked = [...new Set([eventId, entry].filter((id): id is string => !!id))];
  // A new open subtask reopens a done parent (and those above it).
  const rollup = row.parentId
    ? await planRollup(
        db,
        { id: row.id, parentId: row.parentId, doneAt: null, deletedAt: null },
        nowTimestamp(),
      )
    : null;
  await db.drizzle.transaction(async (tx) => {
    // The todo first, so the upload queue has it before its links.
    await tx.insert(todos).values(row);
    for (const entryId of linked) {
      await tx.insert(timelineEntryTodos).values(entryTodoRow(db, groupId, entryId, row.id));
    }
    await rollup?.(tx);
  });
  return { ok: true, id: row.id };
};

/**
 * Edit a todo's title, assignee, due, repeat or provider and medication
 * links (writers). The merged todo must be valid; a changed assignee must be
 * a member and a changed link live. Its events are link rows, which an edit
 * leaves alone: a patch's `eventId` (and a form's `entryId`) is ignored, and
 * `event_id` isn't written.
 */
export const updateTodo = async (
  db: SyncDb,
  id: string,
  { eventId: _eventId, entryId: _entryId, ...patch }: TodoUpdateInput & { entryId?: string | null },
): Promise<TodoWriteResult> => {
  const existing = await liveTodo(db, id);
  if (!existing) return todoMissing;
  const group = await groupFor(db, existing.groupId);
  if (isTodoCompleter(group?.role)) return completionOnly;
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
  });
  if (links) return links;
  if (
    content.repeatRule &&
    content.repeatRule !== existing.repeatRule &&
    (existing.parentId || (await hasLiveSubtasks(db, id)))
  )
    return repeatWithSubtasks;

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

/**
 * Write the occurrence after `todo` (ticked or skipped today) in `tx`,
 * unless a live open row with its id exists; a live done one, like `todo`
 * itself, is passed over for the rule's following day (B-386), and a
 * soft-deleted one (an Undo took it away) comes back as new. As
 * `todoService`'s `insertNext`, so both write the same row.
 */
const planNext = async (db: SyncDb, todo: LocalTodo) => {
  if (!todo.repeatRule) return null;
  const { nextOccurrence } = await import("@caretook/data/series");
  const today = await recipientToday(db, todo.recipientId);
  const passOver = new Set<string>();
  let next = nextOccurrence(todo, today, passOver);
  let [row] = next ? await readRows<TodoRow>(db, todoQuery(next.id)) : [];
  while (next && row && !row.deleted_at && row.done_at) {
    passOver.add(next.id);
    next = nextOccurrence(todo, today, passOver);
    [row] = next ? await readRows<TodoRow>(db, todoQuery(next.id)) : [];
  }
  if (!next) return null;
  if (row && !row.deleted_at) return null;
  const now = nowTimestamp();
  // The group and recipient never change; `event_id` isn't this device's to write.
  const { id, groupId, recipientId, eventId: _e, ...content } = next;
  // The ticked todo's tags go on the next (tags PRD), with the link ids the
  // server's copy derives, so a viewer's upload of them is a replay. Not a
  // tagging: whoever may tick carries them (a restored next may have some).
  const tagLinks = await readRows<{ tag_id: string }>(db, {
    sql: `SELECT tag_id FROM record_tag WHERE todo_id = ?
            AND tag_id NOT IN (SELECT tag_id FROM record_tag WHERE todo_id = ?)
          ORDER BY created_at, id`,
    params: [todo.id, id],
  });
  return async (tx: Tx) => {
    if (row) {
      await tx
        .update(todos)
        .set({ ...content, updatedAt: now, updatedBy: db.userId })
        .where(eq(todos.id, id));
    } else {
      await tx.insert(todos).values({
        id,
        groupId,
        recipientId,
        ...content,
        createdAt: now,
        updatedAt: now,
        createdBy: db.userId,
        updatedBy: db.userId,
      });
    }
    for (const { tag_id: tagId } of tagLinks) {
      await tx.insert(recordTags).values(recordTagRow(db, groupId, tagId, "todo", id));
    }
  };
};

const doneRefusal = async (db: SyncDb, existing: LocalTodo) => {
  const group = await groupFor(db, existing.groupId);
  if (canCompleteTodo({ role: group?.role, userId: db.userId, todo: existing })) return null;
  return isTodoCompleter(group?.role) ? completionOnly : (forbidden as Refusal);
};

/**
 * Tick a todo done (writers, or a viewer or an easy role on their own todo). Ticking a done
 * one is fine. A repeating todo's next occurrence, and a subtask's parent
 * chain (the rollup), are written in the same local transaction.
 */
export const completeTodo = async (db: SyncDb, id: string): Promise<TodoWriteResult> => {
  const existing = await liveTodo(db, id);
  if (!existing) return todoMissing;
  const refusal = await doneRefusal(db, existing);
  if (refusal) return refusal;
  if (existing.doneAt) return { ok: true, id };
  const next = await planNext(db, existing);
  const now = nowTimestamp();
  const rollup = await planRollup(db, { id, parentId: existing.parentId, doneAt: now, deletedAt: null }, now);
  await db.drizzle.transaction(async (tx) => {
    // Only the done columns change, so the upload maps it to complete.
    await tx.update(todos).set({ doneAt: now, doneBy: db.userId }).where(eq(todos.id, id));
    await next?.(tx);
    await rollup(tx);
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
 * repeating. Its subtasks stay as they are; a done parent above it reopens
 * (the rollup). One local transaction, as `todoService.reopen`.
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
    // Notes or an entry linking it (any link row: as todoService's `isTouched`) touch it too.
    const touches = await readRows<{ id: string }>(db, {
      sql: `SELECT id FROM note_document WHERE id = ?
            UNION ALL SELECT id FROM timeline_entry_todo WHERE todo_id = ? LIMIT 1`,
      params: [next.id, next.id],
    });
    untouched = isUntouchedNext(existing, next) && !touches.length;
  }
  const now = nowTimestamp();
  const rollup = await planRollup(
    db,
    { id, parentId: existing.parentId, doneAt: null, deletedAt: null },
    now,
  );
  await db.drizzle.transaction(async (tx) => {
    // The done columns (and a stopped repeat, which the server decides for
    // itself): the upload maps it to reopen.
    const stops = next && !untouched ? { repeatRule: null, repeatStartsOn: null, repeatId: null } : {};
    await tx
      .update(todos)
      .set({ doneAt: null, doneBy: null, ...stops })
      .where(eq(todos.id, id));
    if (next && untouched) {
      // Flagged for the upload: the server takes it away only while it's
      // still untouched there, as its reopen does (B-382). `_metadata` is
      // PowerSync's, outside the Drizzle table.
      await tx.run(
        sql`UPDATE todo SET deleted_at = ${now}, updated_at = ${now}, updated_by = ${db.userId},
              _metadata = ${UNDO_NEXT_METADATA} WHERE id = ${next.id}`,
      );
    }
    await rollup(tx);
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

/** The live todos under `id` (its subtasks, theirs, …), not `id` itself. */
const liveDescendantIds = async (db: SyncDb, id: string) =>
  (
    await readRows<{ id: string }>(db, {
      sql: `WITH RECURSIVE below(id, depth) AS (
              SELECT id, 1 FROM todo WHERE parent_id = ? AND deleted_at IS NULL
              UNION ALL
              SELECT t.id, below.depth + 1 FROM todo t JOIN below ON t.parent_id = below.id
                WHERE t.deleted_at IS NULL AND below.depth < ?
            )
            SELECT id FROM below`,
      params: [id, MAX_TODO_DEPTH],
    })
  ).map((r) => r.id);

/**
 * Soft delete (writers), with its live subtasks and theirs in the same
 * local transaction (as `todoService.remove`). The todo goes first, so the
 * server's cascade has taken the rest before their own deletes upload
 * (replays); then its parent chain follows the children left (the rollup).
 * Deleting what's gone is fine.
 */
export const removeTodo = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const existing = await liveTodo(db, id);
  if (!existing) return { ok: true };
  const group = await groupFor(db, existing.groupId);
  if (!isTodoWriter(group?.role)) return forbidden;
  const below = await liveDescendantIds(db, id);
  const now = nowTimestamp();
  const removed = { deletedAt: now, updatedAt: now, updatedBy: db.userId };
  const rollup = await planRollup(
    db,
    { id, parentId: existing.parentId, doneAt: existing.doneAt, deletedAt: now },
    now,
  );
  await db.drizzle.transaction(async (tx) => {
    await tx.update(todos).set(removed).where(eq(todos.id, id));
    if (below.length) await tx.update(todos).set(removed).where(inArray(todos.id, below));
    await rollup(tx);
  });
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
} as const;

/** The one link a `TodoLink` names, as its form field and id. */
export const linkOf = (link: TodoLink): { field: "providerId" | "medicationId" | "eventId"; id: string } => {
  if ("providerId" in link) return { field: "providerId", id: link.providerId };
  if ("medicationId" in link) return { field: "medicationId", id: link.medicationId };
  return { field: "eventId", id: link.eventId };
};

/**
 * A group's open (not done, not deleted) todos linked to one provider,
 * medication or event (through its link rows), by due day (sort with
 * `todoOrder`, which knows the zone).
 */
export const linkedTodosQuery = (groupId: string, link: TodoLink): LocalQuery => {
  const { field, id } = linkOf(link);
  const linked =
    field === "eventId"
      ? "id IN (SELECT todo_id FROM timeline_entry_todo WHERE entry_id = ? AND group_id = todo.group_id)"
      : `${LINK_COLUMNS[field]} = ?`;
  return {
    sql: `SELECT * FROM todo WHERE group_id = ? AND ${linked}
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

import { toLocalTimestamp } from "../timeline/timeline.sync";

// ---------------------------------------------------------------------------
// Subtasks (todo-subtasks)
// ---------------------------------------------------------------------------

/** A todo's live subtasks, done ones too, oldest first. */
export const subtasksQuery = (todoId: string): LocalQuery => ({
  sql: "SELECT * FROM todo WHERE parent_id = ? AND deleted_at IS NULL ORDER BY created_at, id",
  params: [todoId],
});

/** One row per parent with live subtasks: how many, how many are done (`subtaskProgress`), and its title. */
export type SubtaskProgressRow = { parent_id: string; done: number; total: number; title?: string | null };

/**
 * A group's subtask progress, every parent in one query (one live query per
 * list, never one per row): live children only, as `subtaskProgress` counts,
 * with the parent's title for a listed subtask's "Part of <parent>".
 */
export const subtaskProgressQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT c.parent_id, p.title AS title, COUNT(c.done_at) AS done, COUNT(*) AS total
        FROM todo c LEFT JOIN todo p ON p.id = c.parent_id
        WHERE c.group_id = ? AND c.parent_id IS NOT NULL AND c.deleted_at IS NULL
        GROUP BY c.parent_id`,
  params: [groupId],
});

/** The query's parents by id, with their titles (a listed subtask's "Part of"). */
export const parentsById = (rows: readonly SubtaskProgressRow[]) =>
  new Map(
    rows.flatMap((r) => (r.title ? [[r.parent_id, { id: r.parent_id, title: r.title }] as const] : [])),
  );

/** The query's rows by parent id; a todo with no live subtask isn't there. */
export const progressByParent = (rows: readonly SubtaskProgressRow[]) =>
  new Map(rows.map((r) => [r.parent_id, { done: Number(r.done), total: Number(r.total) }]));

// ---------------------------------------------------------------------------
// One todo's tree (todo-subtasks-3 slice 6)
// ---------------------------------------------------------------------------

/**
 * The group's live todos under `todoId` (its subtasks, theirs, …), done ones
 * too, not `todoId` itself: the todo page's tree (`todoTrees` with
 * `rootId`), in one live query. Deleted ones and what's under them are left
 * out, as the delete takes them.
 */
export const todoDescendantsQuery = (groupId: string, todoId: string): LocalQuery => ({
  sql: `WITH RECURSIVE below(id, depth) AS (
          SELECT id, 1 FROM todo WHERE parent_id = ? AND group_id = ? AND deleted_at IS NULL
          UNION ALL
          SELECT t.id, below.depth + 1 FROM todo t JOIN below ON t.parent_id = below.id
            WHERE t.group_id = ? AND t.deleted_at IS NULL AND below.depth < ?
        )
        SELECT todo.* FROM todo JOIN below ON below.id = todo.id ORDER BY todo.created_at, todo.id`,
  params: [todoId, groupId, groupId, MAX_TODO_DEPTH],
});
