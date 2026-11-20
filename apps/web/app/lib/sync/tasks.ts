import type { TaskContent, TaskUpdateInput } from "@caretook/data/schema";
import type { ActionResult } from "../api";
import type { SyncDb } from "./index";
import type { LocalQuery } from "./timeline";

import {
  ASSIGNEE_NOT_MEMBER_ISSUE,
  BAD_TASK_LINK_ISSUES,
  canCompleteTask,
  isTaskWriter,
  taskContentOf,
  taskContentZSchema,
  taskCreateZSchema,
  taskUpdateZSchema,
} from "@caretook/data/schema";
import { eq } from "drizzle-orm";
import { noteDocuments, tasks } from "./schema";
import { forbidden, fromLocalTimestamp, groupFor, nowTimestamp, readRows } from "./timeline";

// Tasks on this device: local queries for `useLiveQuery` and loaders, and
// local writes that validate with the shared Zod schemas and check the role
// (writers, or a viewer completing their own task: `canCompleteTask`), like
// carePeriods.ts. Writes queue for upload (sync.upload's taskOp), where
// taskService checks them again. State and order come from taskRules.

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type TaskRow = {
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
};

export type LocalTask = {
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
};

/** A local row as a task, or null for a half-synced one. */
export const toTask = (row: TaskRow): LocalTask | null => {
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
  };
};

export const toTasks = (rows: TaskRow[]) => rows.map(toTask).filter((t): t is LocalTask => t !== null);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type TasksFilter = {
  /** Open tasks (the default), or done ones (newest first). */
  done?: boolean;
  /** Only the chip's tasks (see `showsTask` in lib/taskList.ts): mine needs `userId`. */
  who?: "mine" | "unassigned" | "everyone";
  userId?: string;
  /** At most this many (the Done list's pages). */
  limit?: number;
};

const whoCondition = ({ who, userId }: TasksFilter): { sql: string; params: unknown[] } => {
  if (who === "mine") return { sql: " AND assignee_id = ?", params: [userId ?? ""] };
  if (who === "unassigned")
    return {
      sql: " AND assignee_id IS NULL AND (assignee_name IS NULL OR TRIM(assignee_name) = '')",
      params: [],
    };
  return { sql: "", params: [] };
};

/**
 * A group's live tasks: open ones by due day (sort them with `taskOrder`,
 * which knows the zone), or done ones newest first.
 */
export const tasksQuery = (groupId: string, filter: TasksFilter = {}): LocalQuery => {
  const who = whoCondition(filter);
  return {
    sql: `SELECT * FROM task WHERE group_id = ? AND deleted_at IS NULL
          AND done_at IS ${filter.done ? "NOT NULL" : "NULL"}${who.sql}
          ORDER BY ${filter.done ? "done_at DESC, id" : "due_on IS NULL, due_on, due_time, created_at, id"}
          ${filter.limit ? "LIMIT ?" : ""}`,
    params: [groupId, ...who.params, ...(filter.limit ? [filter.limit] : [])],
  };
};

/** How many done tasks the chip shows (the Done list's "Show more"). */
export const doneCountQuery = (
  groupId: string,
  filter: Pick<TasksFilter, "who" | "userId"> = {},
): LocalQuery => {
  const who = whoCondition(filter);
  return {
    sql: `SELECT COUNT(*) AS count FROM task WHERE group_id = ? AND deleted_at IS NULL AND done_at IS NOT NULL${who.sql}`,
    params: [groupId, ...who.params],
  };
};

/** One task, deleted or not (screens decide: a deleted one is a 404). */
export const taskQuery = (id: string): LocalQuery => ({
  sql: "SELECT * FROM task WHERE id = ?",
  params: [id],
});

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type Refusal = Extract<ActionResult, { ok: false }>;
export type TaskWriteResult = { ok: true; id: string } | Refusal;

const refuse = (error: string, issues: Refusal["issues"] = []): Refusal => ({ ok: false, error, issues });

const invalid = (error: { issues: { path: PropertyKey[]; message: string }[] }): Refusal =>
  refuse(
    "The task is invalid",
    error.issues.map(({ path, message }) => ({ path: path.map(String).join("."), message })),
  );

const taskMissing = refuse("That task is gone. It may have been deleted.");
const viewerOnly = refuse("Viewers can only complete or reopen tasks assigned to them");

const liveTask = async (db: SyncDb, id: string) => {
  const [row] = await readRows<TaskRow>(db, taskQuery(id));
  const task = row ? toTask(row) : null;
  return task && !task.deletedAt ? task : null;
};

const recipientOf = async (db: SyncDb, groupId: string) => {
  const [row] = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM care_recipient WHERE group_id = ?",
    params: [groupId],
  });
  return row?.id ?? null;
};

/** The assignee must be a member of the group (see `taskService`'s `checkAssignee`). */
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

/** Each link given must be live in the group, and the event an event (see `taskService`'s `checkLinks`). */
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
    if (!ok) return refuse("A linked item must be in this care group", [{ ...BAD_TASK_LINK_ISSUES[field] }]);
  }
  return null;
};

const contentColumns = (content: Omit<TaskContent, "doneAt" | "doneBy">) => ({
  title: content.title,
  assigneeId: content.assigneeId,
  assigneeName: content.assigneeName,
  dueOn: content.dueOn,
  dueTime: content.dueTime,
  providerId: content.providerId,
  medicationId: content.medicationId,
  eventId: content.eventId,
});

export type TaskInput = {
  title: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueOn?: string | null;
  dueTime?: string | null;
  providerId?: string | null;
  medicationId?: string | null;
  eventId?: string | null;
};

/** Add a task on this device (writers). It syncs when the device is online. */
export const createTask = async (db: SyncDb, groupId: string, input: TaskInput): Promise<TaskWriteResult> => {
  const group = await groupFor(db, groupId);
  if (!isTaskWriter(group?.role)) return forbidden as Refusal;
  const recipientId = await recipientOf(db, groupId);
  if (!recipientId) return refuse("This care group has no care recipient yet");

  const parsed = taskCreateZSchema.safeParse({ groupId, ...input });
  if (!parsed.success) return invalid(parsed.error);
  const { groupId: _g, recipientId: _r, id: _id, ...content } = parsed.data;
  const assignee = await assigneeRefusal(db, groupId, content.assigneeId);
  if (assignee) return assignee;
  const links = await linkRefusal(db, groupId, content);
  if (links) return links;

  const id = crypto.randomUUID();
  const now = nowTimestamp();
  await db.drizzle.insert(tasks).values({
    id,
    groupId,
    recipientId,
    ...contentColumns(content),
    doneAt: null,
    doneBy: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  });
  return { ok: true, id };
};

/**
 * Edit a task's title, assignee, due or links (writers). The merged task must
 * be valid; a changed assignee must be a member and a changed link live.
 */
export const updateTask = async (
  db: SyncDb,
  id: string,
  patch: TaskUpdateInput,
): Promise<TaskWriteResult> => {
  const existing = await liveTask(db, id);
  if (!existing) return taskMissing;
  const group = await groupFor(db, existing.groupId);
  if (group?.role === "viewer") return viewerOnly;
  if (!isTaskWriter(group?.role)) return forbidden as Refusal;

  const shape = taskUpdateZSchema.safeParse(patch);
  if (!shape.success) return invalid(shape.error);
  const defined = Object.fromEntries(Object.entries(shape.data).filter(([, v]) => v !== undefined));
  const merged = taskContentZSchema.safeParse({ ...taskContentOf(existing), ...defined });
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

  await db.drizzle
    .update(tasks)
    .set({ ...contentColumns(content), updatedAt: nowTimestamp(), updatedBy: db.userId })
    .where(eq(tasks.id, id));
  return { ok: true, id };
};

const setDone = async (db: SyncDb, id: string, done: boolean): Promise<TaskWriteResult> => {
  const existing = await liveTask(db, id);
  if (!existing) return taskMissing;
  const group = await groupFor(db, existing.groupId);
  if (!canCompleteTask({ role: group?.role, userId: db.userId, task: existing }))
    return group?.role === "viewer" ? viewerOnly : (forbidden as Refusal);
  if (!!existing.doneAt === done) return { ok: true, id };
  const now = nowTimestamp();
  // Only the done columns change, so the upload maps it to complete or reopen.
  await db.drizzle
    .update(tasks)
    .set({ doneAt: done ? now : null, doneBy: done ? db.userId : null })
    .where(eq(tasks.id, id));
  return { ok: true, id };
};

/** Tick a task done (writers, or a viewer on their own task). Ticking a done one is fine. */
export const completeTask = (db: SyncDb, id: string) => setDone(db, id, true);

/** Reopen a done task, or undo a tick (the same people as `completeTask`). */
export const reopenTask = (db: SyncDb, id: string) => setDone(db, id, false);

/** Soft delete (writers). Deleting what's gone is fine. */
export const removeTask = async (db: SyncDb, id: string): Promise<ActionResult> => {
  const existing = await liveTask(db, id);
  if (!existing) return { ok: true };
  const group = await groupFor(db, existing.groupId);
  if (!isTaskWriter(group?.role)) return forbidden;
  const now = nowTimestamp();
  await db.drizzle
    .update(tasks)
    .set({ deletedAt: now, updatedAt: now, updatedBy: db.userId })
    .where(eq(tasks.id, id));
  return { ok: true };
};

// ---------------------------------------------------------------------------
// Notes (tasks slice 2)
// ---------------------------------------------------------------------------

/**
 * Make a task's notes document (writers), on the first real change: its id
 * is the task's. Idempotent; it syncs like the medication page's
 * (`noteDocumentService.create` checks the task is live and in the group).
 */
export const createTaskDocument = async (db: SyncDb, taskId: string): Promise<ActionResult> => {
  const task = await liveTask(db, taskId);
  if (!task) return taskMissing;
  const group = await groupFor(db, task.groupId);
  if (!isTaskWriter(group?.role)) return forbidden;
  const existing = await readRows<{ id: string }>(db, {
    sql: "SELECT id FROM note_document WHERE id = ?",
    params: [taskId],
  });
  if (existing.length) return { ok: true };
  const now = nowTimestamp();
  await db.drizzle.insert(noteDocuments).values({
    id: taskId,
    groupId: task.groupId,
    subject: "task",
    entryId: null,
    providerId: null,
    medicationId: null,
    carePeriodId: null,
    taskId,
    snapshot: null,
    text: "",
    createdAt: now,
    updatedAt: now,
    createdBy: db.userId,
    updatedBy: db.userId,
  });
  return { ok: true };
};
