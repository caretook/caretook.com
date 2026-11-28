import type { z } from "zod";
import type { Todo, TodoCreateInput, TodoOccurrenceInput, TodoUpdateInput, TodoUpsertInput, Tx } from "../db";
import type { IncludeDeleted } from "../models/todo";
import type { ServiceContext } from "./types";

import { randomUUID } from "node:crypto";
import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  ASSIGNEE_NOT_MEMBER_ISSUE,
  BAD_PARENT_ISSUE,
  BAD_TODO_LINK_ISSUES,
  REPEAT_WITH_SUBTASKS_ISSUE,
  TODO_LIMITS,
  todoContentOf,
  todoContentZSchema,
  todoCreateZSchema,
  todoOccurrenceZSchema,
  todoUpdateZSchema,
  todoUpsertZSchema,
} from "../db/schema";
import { isUntouchedNext, nextOccurrence, nextTodoId } from "../db/schema/appointments/series";
import { isError, newError } from "../errors";
import {
  careGroupMemberModel,
  careGroupModel,
  careRecipientModel,
  medicationModel,
  noteDocumentModel,
  providerModel,
  todoModel,
  timelineEntryModel,
  timelineEntryTodoModel,
  userModel,
} from "../models";
import { isSystemUser, rejectError } from "../permissions";
import { asCreated, unchanged } from "./upserted";
import { enqueue as enqueueCalendarPush } from "./calendarSyncService";
import { linkIn, unlinkIn } from "./entryTodoService";
import { copyLinks } from "./recordTagService";
import {
  canCompleteTodo,
  completionOnly,
  isTodoCompleter,
  isTodoWriter,
  repeatColumnsFor,
} from "../domain/todos/todoRules";
import { canHaveSubtask, clampDue, inheritedDue, MAX_TODO_DEPTH, rollupOf } from "../domain/todos/todoTree";
import { localDate } from "../domain/core/entryTiming";

// Todos: the group's shared todo list. Write through here, not the model:
// this is where content is validated, the assignee and links are checked,
// and viewers are limited to completing and reopening todos assigned to
// them (the permissions map lets every member update; this narrows it).
// State and order are derived, never stored: todoRules.ts.

export const schemaName = todoModel.schemaName;

const issuesOf = (error: z.ZodError) =>
  error.issues.map(({ path, message }) => ({ path: path.join("."), message }));

const invalid = (error: z.ZodError) =>
  newError({ code: "todoService:invalid", meta: { issues: issuesOf(error) } });

const notFound = () => newError({ code: "todoService:notFound" });
/** A completer's refusal (`isTodoCompleter`): one code for a viewer and both easy roles. */
const completionRefused = () => newError({ code: "todoService:completionOnly" });

/**
 * The actor's role in the group, or null. The system acts as an owner; a
 * non-member (staff included) is null.
 */
const roleIn = async (ctx: ServiceContext, tx: Tx, groupId: string) => {
  if (isSystemUser(ctx.authUser)) return "owner" as const;
  if (!ctx.authUser) return null;
  return careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
};

/**
 * The recipient a todo is for: `recipientId` when given (it must be in the
 * group), else the group's only recipient. Reads are scoped to the actor,
 * so a non-member learns nothing about the group.
 */
const resolveRecipient = async (ctx: ServiceContext, tx: Tx, groupId: string, recipientId?: string) => {
  const group = await careGroupModel.getById(groupId, { ...ctx, tx });
  if (isError(group)) return group;
  if (!group) return rejectError(ctx.authUser);

  if (recipientId) {
    const recipient = await careRecipientModel.getById(recipientId, { ...ctx, tx });
    if (isError(recipient)) return recipient;
    if (recipient?.groupId !== groupId) return newError({ code: "todoService:recipientNotInGroup" });
    return recipient;
  }

  const recipient = await careRecipientModel.get({
    ...ctx,
    tx,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(recipient)) return recipient;
  return recipient ?? newError({ code: "todoService:noRecipient" });
};

/** The assignee must be a member of the group. Checked when set or changed. */
const checkAssignee = async (tx: Tx, groupId: string, assigneeId: string | null) => {
  if (!assigneeId) return null;
  const role = await careGroupMemberModel.getRole(groupId, assigneeId, { tx });
  if (isError(role)) return role;
  return role
    ? null
    : newError({
        code: "todoService:assigneeNotMember",
        meta: { issues: [{ ...ASSIGNEE_NOT_MEMBER_ISSUE }] },
      });
};

const badLink = (field: keyof typeof BAD_TODO_LINK_ISSUES) =>
  newError({ code: "todoService:badLink", meta: { issues: [{ ...BAD_TODO_LINK_ISSUES[field] }] } });

type Links = { providerId?: string | null; medicationId?: string | null; eventId?: string | null };

/**
 * Each link given must be live and in the group, and the event an event.
 * Checked only when set or changed: a provider or medication deleted later
 * stays linked, and shows greyed.
 */
const checkLinks = async (ctx: ServiceContext, tx: Tx, groupId: string, links: Links) => {
  if (links.providerId) {
    const provider = await providerModel.getById(links.providerId, { ...ctx, tx });
    if (isError(provider)) return provider;
    if (provider?.groupId !== groupId) return badLink("providerId");
  }
  if (links.medicationId) {
    const medication = await medicationModel.getById(links.medicationId, { ...ctx, tx });
    if (isError(medication)) return medication;
    if (medication?.groupId !== groupId) return badLink("medicationId");
  }
  if (links.eventId) {
    const event = await timelineEntryModel.getById(links.eventId, { ...ctx, tx });
    if (isError(event)) return event;
    if (event?.groupId !== groupId || event.kind !== "event") return badLink("eventId");
  }
  return null;
};

const changed = <T>(after: T, before: T) => (after !== before ? after : null);

/** Write `data` to the todo, as the actor. A refusal by RBAC means a viewer on a writer's field, or a non-member. */
const write = async (ctx: ServiceContext, tx: Tx, id: string, data: Partial<Todo>) => {
  const updated = await todoModel.update({ ...ctx, tx, filter: { id: { type: "eq", value: id } }, data });
  if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
    return rejectError(ctx.authUser);
  if (isError(updated)) return updated;
  // Todos with a due day reach members' Google calendars (appointments-2).
  const queued = await enqueueCalendarPush(tx, { todoId: id }, "todo");
  return queued ?? updated[0] ?? null;
};

// ---------------------------------------------------------------------------
// Repeats (planner-2): a repeating todo is one open row. Ticking or skipping
// it makes the next occurrence here, as the system (the server is its
// author; a device's copy is a twin with the same id, see `upsertOccurrence`).
// ---------------------------------------------------------------------------

const system = (tx: Tx) => ({ authUser: SYSTEM_USER, tx });

/** The day it is at `at` where the recipient is: a todo's days are theirs. */
const recipientDay = async (tx: Tx, recipientId: string, at: Date) => {
  const recipient = await careRecipientModel.getById(recipientId, system(tx));
  if (isError(recipient)) return recipient;
  return localDate(at, recipient?.timeZone ?? "UTC");
};

/**
 * Make the occurrence after `todo` (ticked or skipped on `today`), unless a
 * live open row with its id exists (a replay, or another device's tick that
 * day). A live done one with its id (a successor moved off its day and
 * ticked), like `todo` itself, is passed over for the rule's following day
 * (B-386), as the device's `planNext` does. A soft-deleted one (an Undo took
 * it away) comes back as new. Returns the next todo's id, or null when the
 * rule has ended or it doesn't repeat.
 */
const insertNext = async (tx: Tx, todo: Todo, today: string) => {
  const passOver = new Set<string>();
  let next = nextOccurrence(todo, today, passOver);
  let existing = next && (await todoModel.getById(next.id, { ...system(tx), includeDeleted: true }));
  while (next && existing && !isError(existing) && !existing.deletedAt && existing.doneAt) {
    passOver.add(next.id);
    next = nextOccurrence(todo, today, passOver);
    existing = next && (await todoModel.getById(next.id, { ...system(tx), includeDeleted: true }));
  }
  if (!next) return null;
  if (isError(existing)) return existing;
  if (existing && !existing.deletedAt) return next.id;
  const { id, ...content } = next;
  const written = existing
    ? await todoModel.restore(id, content, tx)
    : await todoModel.create({ ...system(tx), data: next });
  if (isError(written)) return written;
  // Made after `todo`, even in the transaction that made `todo` (`laterInChain`).
  const stamped = await todoModel.stampMadeAfter(id, todo.id, tx);
  if (stamped) return stamped;
  // Its tags come along (tags PRD), with the ids the device's twin writes.
  const tagged = await copyLinks(tx, "todo", todo.id, id);
  if (tagged) return tagged;
  return (await enqueueCalendarPush(tx, { todoId: id }, "todo")) ?? next.id;
};

/**
 * What ticking `todo` made (its successor): the live row of its chain, other
 * than it, made at or after its `done_at` and after `todo` itself, the
 * earliest first (then id), whatever its due day now, so one moved to the
 * same day or earlier is still found (B-383). After `todo`: an offline tick's
 * `done_at` is the device's, earlier than the rows the upload makes, so it
 * alone would let an earlier occurrence made at upload pass; `created_at`s
 * are all this clock's, and a successor is made after its predecessor. As
 * the device's `laterInChain` in `reopenTodo`. Relies on `complete` clamping
 * `done_at` to at most the transaction's now (`tickTime`), and on a restored
 * next being made again (`todoModel.restore`).
 */
const laterInChain = async (tx: Tx, todo: Todo) => {
  if (!todo.repeatId || !todo.doneAt) return null;
  const rows = await todoModel.list({
    ...system(tx),
    filter: {
      groupId: { type: "eq", value: todo.groupId },
      repeatId: { type: "eq", value: todo.repeatId },
      id: { type: "ne", value: todo.id },
      createdAt: {
        type: "and",
        value: [
          { type: "gte", value: todo.doneAt },
          { type: "gt", value: todo.createdAt },
        ],
      },
    },
    orderBy: [
      { field: "createdAt", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
    paginate: { limit: 1, page: 1 },
  });
  if (isError(rows)) return rows;
  return rows.data[0] ?? null;
};

const hasNotes = async (tx: Tx, todoId: string) => {
  const doc = await noteDocumentModel.getById(todoId, system(tx));
  if (isError(doc)) return doc;
  return !!doc;
};

/** Whether a timeline entry links the todo (any link row: someone's deliberate work). */
const hasEntryLinks = async (tx: Tx, todoId: string) => {
  const link = await timelineEntryTodoModel.get({
    ...system(tx),
    filter: { todoId: { type: "eq", value: todoId } },
  });
  if (isError(link)) return link;
  return !!link;
};

/** A next occurrence counts as touched with notes or an entry linking it, as well as by content. */
const isTouched = async (tx: Tx, todoId: string) => {
  const notes = await hasNotes(tx, todoId);
  if (isError(notes) || notes) return notes;
  return hasEntryLinks(tx, todoId);
};

// ---------------------------------------------------------------------------
// Subtasks (todo-subtasks): a subtask is a todo with a parent, set on create
// only. The parent must be live, in the group, not repeating, and leave the
// subtask within `MAX_TODO_DEPTH` (todoTree.ts); a subtask never repeats,
// nor does a todo with live subtasks.
// ---------------------------------------------------------------------------

const badParent = () =>
  newError({ code: "todoService:badParent", meta: { issues: [{ ...BAD_PARENT_ISSUE }] } });

const repeatWithSubtasks = () =>
  newError({ code: "todoService:repeatWithSubtasks", meta: { issues: [{ ...REPEAT_WITH_SUBTASKS_ISSUE }] } });

/**
 * `todo`'s ancestors, its parent first, deleted ones included (they still
 * count for depth). Stops past `MAX_TODO_DEPTH`: enough to refuse.
 */
const ancestorsOf = async (tx: Tx, todo: Todo) => {
  const chain: Todo[] = [];
  let parentId = todo.parentId;
  while (parentId && chain.length < MAX_TODO_DEPTH) {
    const parent = await todoModel.getById(parentId, { ...system(tx), includeDeleted: true });
    if (isError(parent)) return parent;
    if (!parent) break;
    chain.push(parent);
    parentId = parent.parentId;
  }
  return chain;
};

/** A new subtask's parent must be able to take one (`canHaveSubtask`). Read as the actor. */
const checkParent = async (ctx: ServiceContext, tx: Tx, groupId: string, parentId: string | null) => {
  if (!parentId) return null;
  const parent = await todoModel.getById(parentId, { ...ctx, tx });
  if (isError(parent)) return parent;
  if (parent?.groupId !== groupId) return badParent();
  const ancestors = await ancestorsOf(tx, parent);
  if (isError(ancestors)) return ancestors;
  return canHaveSubtask(ancestors, parent) ? null : badParent();
};

/** Whether the todo has a live subtask. */
const hasLiveSubtasks = async (tx: Tx, todo: Todo) => {
  const child = await todoModel.get({
    ...system(tx),
    filter: { groupId: { type: "eq", value: todo.groupId }, parentId: { type: "eq", value: todo.id } },
  });
  if (isError(child)) return child;
  return !!child;
};

/** A new rule on a subtask, or on a todo with live subtasks, is refused. */
const checkRepeatInTree = async (tx: Tx, todo: Todo) => {
  if (todo.parentId) return repeatWithSubtasks();
  const hasSubtasks = await hasLiveSubtasks(tx, todo);
  if (isError(hasSubtasks)) return hasSubtasks;
  return hasSubtasks ? repeatWithSubtasks() : null;
};

/** A subtask's parent, live, read as the system (its due caps the subtask's); null for a top-level todo. */
const liveParentOf = async (tx: Tx, parentId: string | null) =>
  parentId ? todoModel.getById(parentId, system(tx)) : null;

/**
 * A todo's due day just changed (todo-subtasks-3): its open live
 * descendants, all levels, are clamped (`clampDue`), each under its own
 * parent's due as clamped here. Each goes through `write`, so each queues
 * its calendar push. Done ones are left as they are.
 */
const clampDescendants = async (ctx: ServiceContext, tx: Tx, todo: Todo) => {
  const dueOf = new Map([[todo.id, { dueOn: todo.dueOn, dueTime: todo.dueTime }]]);
  let level = [todo.id];
  for (let depth = 1; level.length && depth < MAX_TODO_DEPTH + 1; depth++) {
    const rows = await todoModel.list({
      ...system(tx),
      filter: { groupId: { type: "eq", value: todo.groupId }, parentId: { type: "inArray", value: level } },
    });
    if (isError(rows)) return rows;
    for (const child of rows.data) {
      const own = { dueOn: child.dueOn, dueTime: child.dueTime };
      const due = child.doneAt ? own : clampDue(own, child.parentId ? dueOf.get(child.parentId) : null);
      dueOf.set(child.id, due);
      if (due.dueOn === own.dueOn && due.dueTime === own.dueTime) continue;
      const written = await write(ctx, tx, child.id, due);
      if (isError(written)) return written;
    }
    level = rows.data.map((r) => r.id);
  }
  return null;
};

const openSubtasks = () => newError({ code: "todoService:openSubtasks" });

/** Whether the todo has a live subtask still open: then only its subtasks tick it. */
const hasOpenSubtasks = async (tx: Tx, todo: Todo) => {
  const child = await todoModel.get({
    ...system(tx),
    filter: {
      groupId: { type: "eq", value: todo.groupId },
      parentId: { type: "eq", value: todo.id },
      doneAt: { type: "isNull" },
    },
  });
  if (isError(child)) return child;
  return !!child;
};

/**
 * The ids of `todo`'s live descendants, all levels, read as the system.
 * Bounded by `MAX_TODO_DEPTH`; a deleted subtask's own subtasks were
 * deleted with it.
 */
const liveDescendantsOf = async (tx: Tx, todo: Todo) => {
  const ids: string[] = [];
  let level = [todo.id];
  for (let depth = 1; level.length && depth < MAX_TODO_DEPTH + 1; depth++) {
    const rows = await todoModel.list({
      ...system(tx),
      filter: { groupId: { type: "eq", value: todo.groupId }, parentId: { type: "inArray", value: level } },
    });
    if (isError(rows)) return rows;
    level = rows.data.map((r) => r.id);
    ids.push(...level);
  }
  return ids;
};

/**
 * The rollup: recompute the todo `parentId` names from its live children
 * (`rollupOf`), then its parent from theirs, up to the top. A parent whose
 * every live child is done is completed, with `actorId` (whose change
 * finished it) as `done_by` and `at` as `done_at`; a done one with an open
 * child reopens. Written as the system, so a viewer's tick of their own last
 * subtask completes a parent assigned to someone else. Decided by the rows
 * alone, so it's idempotent and two devices' changes land on the same
 * answer in either order. Runs in the caller's transaction; exported for
 * the upload switch (a device's flagged parent write). Returns null, or an
 * error.
 */
export const rollUp = async (tx: Tx, parentId: string | null, actorId: string, at: Date = new Date()) => {
  let id = parentId;
  for (let depth = 0; id && depth < MAX_TODO_DEPTH; depth++) {
    const parent = await todoModel.getById(id, system(tx));
    if (isError(parent)) return parent;
    // A deleted parent (or none) stops the climb: its own parent no longer counts it.
    if (!parent) return null;
    const children = await todoModel.list({
      ...system(tx),
      filter: { groupId: { type: "eq", value: parent.groupId }, parentId: { type: "eq", value: parent.id } },
    });
    if (isError(children)) return children;
    const step = rollupOf(parent, children.data);
    if (step) {
      const written = await write(
        system(tx),
        tx,
        parent.id,
        step === "complete" ? { doneAt: at.toISOString(), doneBy: actorId } : { doneAt: null, doneBy: null },
      );
      if (isError(written)) return written;
    }
    id = parent.parentId;
  }
  return null;
};

const actorIdOf = (ctx: ServiceContext) => ctx.authUser?.id ?? SYSTEM_USER.id;

/** When a tick happened: a device's time (offline), else `now`, and never after `now`. */
const tickTime = (doneAt?: string | null, now: Date = new Date()) => {
  const at = doneAt && Number.isFinite(new Date(doneAt).getTime()) ? new Date(doneAt) : now;
  // A device clock ahead of the server's.
  return at.getTime() > now.getTime() ? now : at;
};

/**
 * Lock the todo (`todoModel.lockById`) and return the locked row when the
 * actor can see it, else null; a deleted one only with `includeDeleted`.
 * The tick, reopen, skip, Undo and restore take it first and decide from
 * it, so two at once on one todo run one after the other (B-384).
 */
const lockVisible = async (ctx: ServiceContext, tx: Tx, id: string, opts: IncludeDeleted = {}) => {
  const locked = await todoModel.lockById(id, tx);
  if (isError(locked) || !locked) return locked;
  const visible = await todoModel.getById(id, { ...ctx, tx, includeDeleted: true });
  if (isError(visible)) return visible;
  if (!visible || (locked.deletedAt && !opts.includeDeleted)) return null;
  return locked;
};

/**
 * A device's rollup write to a parent (the upload's `ROLLUP_METADATA`): the
 * device followed a child's change up the chain; here the parent and those
 * above it are recomputed from the server's rows (`rollUp`), whatever the
 * device wrote, so a late write never undoes a newer change and two
 * devices end on the same answer. Any member may (the rollup is the
 * system's; a viewer's tick of their last subtask finishes a parent that
 * isn't theirs): never `completionOnly`. `doneAt` is the device's tick
 * time, for a parent it completes. A deleted parent is left alone.
 */
export const rollUpUploaded = (
  ctx: ServiceContext,
  id: string,
  { doneAt }: { doneAt?: string | null } = {},
) =>
  withTransaction(async (tx) => {
    const parent = await todoModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(parent)) return parent;
    if (!parent) return notFound();
    const role = await roleIn(ctx, tx, parent.groupId);
    if (isError(role)) return role;
    if (!role) return rejectError(ctx.authUser);
    if (parent.deletedAt) return parent;
    const rolled = await rollUp(tx, id, actorIdOf(ctx), tickTime(doneAt));
    if (rolled) return rolled;
    return todoModel.getById(id, system(tx));
  }, ctx);

// ---------------------------------------------------------------------------
// The mirror (planner-3): links are rows in `timeline_entry_todo`. New
// clients never write `todo.event_id`; an old client's `eventId` on create
// or update becomes the pair's link row here (a change removes the old pair
// and adds the new), until a contract migration drops the column.
// ---------------------------------------------------------------------------

const mirrorEvent = async (
  ctx: ServiceContext,
  tx: Tx,
  todo: { id: string; groupId: string },
  before: string | null,
  after: string | null,
) => {
  if (before === after) return null;
  if (before) {
    const removed = await unlinkIn(ctx, tx, before, todo.id);
    if (isError(removed)) return removed;
  }
  if (after) {
    const linked = await linkIn(ctx, tx, { groupId: todo.groupId, entryId: after, todoId: todo.id });
    if (isError(linked)) return linked;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One todo, if the actor can see it. Deleted ones only with `includeDeleted`. */
export const getById = (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) =>
  todoModel.getById(id, { ...ctx, ...opts });

/** A group's todos (storage order: sort with `todoOrder` / `doneOrder`). */
export const list = (ctx: ServiceContext, { groupId, ...opts }: IncludeDeleted & { groupId: string }) =>
  todoModel.list({ ...ctx, ...opts, filter: { groupId: { type: "eq", value: groupId } } });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Server-only write options, never from a device: `via` is the assistant a
 * todo was added through ("Claude"; connectors PRD), set only by
 * `assistantActionService.run`.
 */
export type TodoWriteOptions = { via?: string | null };

/**
 * Add a todo. `id` may come from an offline device; creating one that
 * exists returns it (a replay). Writers only. `parentId` makes it a
 * subtask (`checkParent`), which never repeats.
 */
export const create = (ctx: ServiceContext, input: TodoCreateInput, opts: TodoWriteOptions = {}) =>
  withTransaction(async (tx) => {
    const parsed = todoCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { recipientId, ...data } = parsed.data;

    if (data.id) {
      const existing = await todoModel.getById(data.id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
      if (isError(existing)) return existing;
      if (existing) {
        const visible = await todoModel.getById(data.id, { ...ctx, tx, includeDeleted: true });
        if (isError(visible)) return visible;
        if (!visible) return rejectError(ctx.authUser);
        return visible.groupId === data.groupId ? visible : newError({ code: "todoService:immutable" });
      }
    }

    const recipient = await resolveRecipient(ctx, tx, data.groupId, recipientId);
    if (isError(recipient)) return recipient;

    const role = await roleIn(ctx, tx, data.groupId);
    if (isError(role)) return role;
    if (!isTodoWriter(role)) return rejectError(ctx.authUser);

    const assignee = await checkAssignee(tx, data.groupId, data.assigneeId);
    if (assignee) return assignee;
    const links = await checkLinks(ctx, tx, data.groupId, data);
    if (links) return links;
    const parent = await checkParent(ctx, tx, data.groupId, data.parentId);
    if (parent) return parent;
    if (data.parentId && data.repeatRule) return repeatWithSubtasks();
    // A subtask with no due takes its parent's; any due is never after the parent's day (clamped).
    const parentRow = await liveParentOf(tx, data.parentId);
    if (isError(parentRow)) return parentRow;
    const due = parentRow ? clampDue(data.dueOn ? data : inheritedDue(parentRow), parentRow) : null;

    const id = data.id ?? randomUUID();
    const created = await todoModel.create({
      ...ctx,
      tx,
      data: {
        ...data,
        ...(due ? { dueOn: due.dueOn, dueTime: due.dueTime } : {}),
        id,
        recipientId: recipient.id,
        ...repeatColumnsFor(id, null, data),
        ...(opts.via ? { via: opts.via } : {}),
      },
    });
    if (isError(created) || !created) return created;
    const mirrored = await mirrorEvent(ctx, tx, created, null, created.eventId);
    if (mirrored) return mirrored;
    const queued = await enqueueCalendarPush(tx, { todoId: created.id }, "todo");
    if (queued) return queued;
    // A new open subtask reopens a done parent (and up the chain).
    const rolled = await rollUp(tx, created.parentId, actorIdOf(ctx));
    return rolled ?? created;
  }, ctx);

/**
 * Edit a todo's content: title, assignee, due and links. The group and
 * recipient are fixed; the merged todo must be valid; a changed assignee
 * must be a member and a changed link live in the group. The parent never
 * changes, and a new rule is refused in a tree. Viewers and the
 * easy roles are refused (`completionOnly`):
 * they only complete and reopen.
 */
export const update = (ctx: ServiceContext, id: string, input: TodoUpdateInput) =>
  withTransaction(async (tx) => {
    const parsed = todoUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const existing = await todoModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const merged = todoContentZSchema.safeParse({ ...todoContentOf(existing), ...patch });
    if (!merged.success) return invalid(merged.error);

    const role = await roleIn(ctx, tx, existing.groupId);
    if (isError(role)) return role;
    if (isTodoCompleter(role)) {
      const own = canCompleteTodo({ role, userId: ctx.authUser?.id, todo: existing });
      if (!own || !completionOnly(existing, merged.data)) return completionRefused();
    } else if (!isTodoWriter(role)) return rejectError(ctx.authUser);

    const assignee = await checkAssignee(
      tx,
      existing.groupId,
      changed(merged.data.assigneeId, existing.assigneeId),
    );
    if (assignee) return assignee;
    const links = await checkLinks(ctx, tx, existing.groupId, {
      providerId: changed(merged.data.providerId, existing.providerId),
      medicationId: changed(merged.data.medicationId, existing.medicationId),
      eventId: changed(merged.data.eventId, existing.eventId),
    });
    if (links) return links;
    if (merged.data.repeatRule && merged.data.repeatRule !== existing.repeatRule) {
      const tree = await checkRepeatInTree(tx, existing);
      if (tree) return tree;
    }

    const { doneAt: _doneAt, doneBy: _doneBy, ...edited } = merged.data;
    // A writer's edit keeps a subtask's due on or before its parent's day (clamped,
    // never refused). Not a completer's: theirs changes no due (`completionOnly`).
    const writer = isTodoWriter(role);
    const parent = writer ? await liveParentOf(tx, existing.parentId) : null;
    if (isError(parent)) return parent;
    const content = parent ? { ...edited, ...clampDue(edited, parent) } : edited;
    // An old client's changed event moves its link row (the mirror).
    const mirrored = await mirrorEvent(ctx, tx, existing, existing.eventId, content.eventId);
    if (mirrored) return mirrored;
    // A new rule or due day moves the anchor; no rule clears all three.
    const written = await write(ctx, tx, id, { ...content, ...repeatColumnsFor(id, existing, content) });
    if (isError(written) || !written) return written;
    // A new day (moved, or a first one) clamps the open subtasks below; clearing it changes none.
    if (writer && content.dueOn && content.dueOn !== existing.dueOn) {
      const clamped = await clampDescendants(ctx, tx, written);
      if (clamped) return clamped;
    }
    return written;
  }, ctx);

/**
 * Tick a todo done. The server records the actor as `done_by`; `doneAt`
 * may come from an offline device (when it was ticked), else now. Writers
 * complete any todo; a viewer only one assigned to them. Completing a done
 * todo keeps who finished it first (a replay).
 */
export const complete = (ctx: ServiceContext, id: string, { doneAt }: { doneAt?: string | null } = {}) =>
  withTransaction(async (tx) => {
    const existing = await lockVisible(ctx, tx, id);
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const role = await roleIn(ctx, tx, existing.groupId);
    if (isError(role)) return role;
    if (!canCompleteTodo({ role, userId: ctx.authUser?.id, todo: existing }))
      return isTodoCompleter(role) ? completionRefused() : rejectError(ctx.authUser);
    if (existing.doneAt) return existing;
    // A parent is ticked by its subtasks (the rollup), never by hand while one is open.
    const open = await hasOpenSubtasks(tx, existing);
    if (isError(open)) return open;
    if (open) return openSubtasks();

    const now = await todoModel.transactionNow(tx);
    if (isError(now)) return now;
    // Never after the transaction's now, which the next occurrence's
    // `created_at` is: `reopen` finds the successor as the row made at or
    // after `done_at` (`laterInChain`), so this clamp keeps that true. (On
    // the device, both times come from its clock.)
    const when = tickTime(doneAt, now);
    const done = await write(ctx, tx, id, { doneAt: when.toISOString(), doneBy: actorIdOf(ctx) });
    if (isError(done)) return done;
    if (existing.parentId) {
      const rolled = await rollUp(tx, existing.parentId, actorIdOf(ctx), when);
      if (rolled) return rolled;
    }
    if (!existing.repeatRule) return done;

    // A repeating todo: the next one, after the day it was ticked (the
    // device's tick time, so an offline tick and its twin agree on the day).
    const today = await recipientDay(tx, existing.recipientId, when);
    if (isError(today)) return today;
    const next = await insertNext(tx, existing, today);
    return isError(next) ? next : done;
  }, ctx);

/** Reopen a done todo: clears who finished it and when. The same people as `complete`. */
export const reopen = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const existing = await lockVisible(ctx, tx, id);
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const role = await roleIn(ctx, tx, existing.groupId);
    if (isError(role)) return role;
    if (!canCompleteTodo({ role, userId: ctx.authUser?.id, todo: existing }))
      return isTodoCompleter(role) ? completionRefused() : rejectError(ctx.authUser);
    if (!existing.doneAt) return existing;
    if (!existing.repeatRule) {
      // Only this todo reopens (its subtasks stay as they are); a done parent above it follows.
      const reopened = await write(ctx, tx, id, { doneAt: null, doneBy: null });
      if (isError(reopened)) return reopened;
      return (await rollUp(tx, existing.parentId, actorIdOf(ctx))) ?? reopened;
    }

    // A repeating todo: the next one goes when nobody has touched it (open,
    // as ticking made it, no notes, no entry linking it). Otherwise both
    // stay, and the later one carries the repeat: this one stops repeating.
    const next = await laterInChain(tx, existing);
    if (isError(next)) return next;
    const touched = next ? await isTouched(tx, next.id) : false;
    if (isError(touched)) return touched;
    if (next && isUntouchedNext(existing, next) && !touched) {
      const removed = await todoModel.remove({
        ...system(tx),
        filter: { id: { type: "eq", value: next.id } },
      });
      if (isError(removed)) return removed;
      const queued = await enqueueCalendarPush(tx, { todoId: next.id }, "todo");
      if (queued) return queued;
      return write(ctx, tx, id, { doneAt: null, doneBy: null });
    }
    const stops = next ? { repeatRule: null, repeatStartsOn: null, repeatId: null } : {};
    return write(ctx, tx, id, { doneAt: null, doneBy: null, ...stops });
  }, ctx);

/** The open row of `next`'s chain due just before it (the one an Undo reopened), if any. */
const openBeforeInChain = async (tx: Tx, next: Todo) => {
  if (!next.repeatId || next.repeatId === next.id || !next.dueOn) return null;
  const rows = await todoModel.list({
    ...system(tx),
    filter: {
      groupId: { type: "eq", value: next.groupId },
      repeatId: { type: "eq", value: next.repeatId },
      id: { type: "ne", value: next.id },
      dueOn: { type: "lt", value: next.dueOn },
      doneAt: { type: "isNull" },
    },
    orderBy: [
      { field: "dueOn", direction: "desc" },
      { field: "id", direction: "desc" },
    ],
    paginate: { limit: 1, page: 1 },
  });
  if (isError(rows)) return rows;
  return rows.data[0] ?? null;
};

/**
 * A device's Undo taking away the next occurrence its tick made (that
 * row's soft delete, flagged on the upload, B-382). `reopen`, uploaded just
 * before it, has already decided; this removes the next only when it's
 * still untouched after the reopened todo (the same test as `reopen`), so
 * a next another member edited, completed or wrote notes on meanwhile
 * stays. The same people as `reopen` (for this row and the reopened one),
 * checked before anything else. Returns the row when it stays.
 */
export const removeUndoneNext = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const next = await lockVisible(ctx, tx, id, { includeDeleted: true });
    if (isError(next)) return next;
    if (!next) return notFound();

    // The role first, so a refused write reads as refused whatever the row's state (B-510).
    const role = await roleIn(ctx, tx, next.groupId);
    if (isError(role)) return role;
    if (!canCompleteTodo({ role, userId: ctx.authUser?.id, todo: next }))
      return isTodoCompleter(role) ? completionRefused() : rejectError(ctx.authUser);
    if (next.deletedAt) return next;

    const before = await openBeforeInChain(tx, next);
    if (isError(before)) return before;
    if (!before?.repeatRule) return next;
    if (!canCompleteTodo({ role, userId: ctx.authUser?.id, todo: before }))
      return isTodoCompleter(role) ? completionRefused() : rejectError(ctx.authUser);

    const touched = await isTouched(tx, id);
    if (isError(touched)) return touched;
    if (!isUntouchedNext(before, next) || touched) return next;

    const removed = await todoModel.remove({ ...system(tx), filter: { id: { type: "eq", value: id } } });
    if (isError(removed)) return removed;
    const queued = await enqueueCalendarPush(tx, { todoId: id }, "todo");
    return queued ?? removed;
  }, ctx);

/**
 * Skip this occurrence of a repeating todo: it's soft-deleted and the next
 * one made, in one transaction. A todo that doesn't repeat (or whose rule
 * has ended) is just deleted. Writers only. Returns the next one's id, or
 * null. "Delete and stop repeating" is the ordinary `remove`.
 */
export const skip = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const existing = await lockVisible(ctx, tx, id);
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const role = await roleIn(ctx, tx, existing.groupId);
    if (isError(role)) return role;
    if (!isTodoWriter(role)) return rejectError(ctx.authUser);

    const removed = await todoModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
    if (isError(removed)) return removed;
    const queued = await enqueueCalendarPush(tx, { todoId: id }, "todo");
    if (queued) return queued;

    const today = await recipientDay(tx, existing.recipientId, new Date());
    if (isError(today)) return today;
    const next = await insertNext(tx, existing, today);
    if (isError(next)) return next;
    return { nextId: next };
  }, ctx);

/**
 * A device bringing a later occurrence back (its PATCH of `deleted_at` to
 * null): its tick or skip remade one an Undo had taken away. A tick's is
 * already back (`complete` restores it); a skip's comes back here when the
 * chain has no other open todo, for writers. A stale one changes nothing,
 * and a todo that isn't a later occurrence is never undeleted. A tick's
 * (`fromTick`, the upload's `TICK_NEXT_METADATA`) never restores: with no
 * open row the chain was stopped since that tick, so it stays stopped and
 * null says nothing was written, for any role (B-1003). Returns the row as
 * it now is, or null.
 */
export const restoreOccurrence = (
  ctx: ServiceContext,
  id: string,
  { fromTick = false }: { fromTick?: boolean } = {},
) =>
  withTransaction(async (tx) => {
    const visible = await lockVisible(ctx, tx, id, { includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return notFound();
    if (!visible.deletedAt || !visible.repeatId || visible.repeatId === id) return visible;

    const open = await todoModel.get({
      ...system(tx),
      filter: {
        groupId: { type: "eq", value: visible.groupId },
        repeatId: { type: "eq", value: visible.repeatId },
        doneAt: { type: "isNull" },
      },
    });
    if (isError(open)) return open;
    if (open) return visible;
    if (fromTick) return null;

    const role = await roleIn(ctx, tx, visible.groupId);
    if (isError(role)) return role;
    if (!isTodoWriter(role)) return rejectError(ctx.authUser);
    const restored = await todoModel.restore(id, {}, tx);
    if (isError(restored)) return restored;
    if (!restored) return visible;
    return (await enqueueCalendarPush(tx, { todoId: id }, "todo")) ?? restored;
  }, ctx);

/**
 * A device's copy of a later occurrence (PowerSync's upload of the row its
 * tick or skip made, with the id `nextTodoId` gives). When the server has
 * the row (it made it on the tick), the upload is satisfied as it is,
 * whatever the uploader's role: it changes nothing. When the chain already
 * has another open todo (two devices ticked it on different days), it's a
 * stale twin: nothing is written. Otherwise it's a skip the device made: a
 * writer's create. A tick's twin (`fromTick`, the upload's
 * `TICK_NEXT_METADATA`) never creates: the tick made its row here, so with
 * none it's a stale tick's, and a chain stopped since stays stopped (B-387).
 * Says whether it created (`Upserted`), or null when nothing was written.
 */
export const upsertOccurrence = (
  ctx: ServiceContext,
  input: TodoOccurrenceInput,
  { fromTick = false }: { fromTick?: boolean } = {},
) =>
  withTransaction(async (tx) => {
    const parsed = todoOccurrenceZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId, repeatStartsOn, repeatId, ...content } = parsed.data;
    if (!content.dueOn || id !== nextTodoId(repeatId, content.dueOn))
      return newError({ code: "todoService:notAnOccurrence" });

    const existing = await todoModel.getById(id, { ...system(tx), includeDeleted: true });
    if (isError(existing)) return existing;
    if (existing) {
      const visible = await todoModel.getById(id, { ...ctx, tx, includeDeleted: true });
      if (isError(visible)) return visible;
      if (!visible) return rejectError(ctx.authUser);
      return visible.groupId === groupId ? unchanged(visible) : newError({ code: "todoService:immutable" });
    }

    const role = await roleIn(ctx, tx, groupId);
    if (isError(role)) return role;
    if (!role) return rejectError(ctx.authUser);
    if (fromTick) return null;
    const open = await todoModel.get({
      ...system(tx),
      filter: {
        groupId: { type: "eq", value: groupId },
        repeatId: { type: "eq", value: repeatId },
        doneAt: { type: "isNull" },
      },
    });
    if (isError(open)) return open;
    if (open) return null;

    if (!isTodoWriter(role)) return rejectError(ctx.authUser);
    const recipient = await resolveRecipient(ctx, tx, groupId, recipientId);
    if (isError(recipient)) return recipient;
    const assignee = await checkAssignee(tx, groupId, content.assigneeId);
    if (assignee) return assignee;
    // Links are carried from the chain as they are (a provider deleted
    // since stays linked, greyed), so they aren't checked again.
    const created = await todoModel.create({
      ...ctx,
      tx,
      data: { ...content, id, groupId, recipientId: recipient.id, eventId: null, repeatStartsOn, repeatId },
    });
    if (isError(created) || !created) return created;
    return (await enqueueCalendarPush(tx, { todoId: id }, "todo")) ?? asCreated(created);
  }, ctx);

/**
 * Create the todo with this id if there is none: what PowerSync's upload
 * queue sends for a row a device created. A replay changes nothing (only a
 * PATCH edits), whatever the actor's role now (a viewer's device replaying
 * the create included), so it never reverts a newer edit. The group and
 * recipient never change, and an id the actor can't see is refused without
 * saying whether it exists. Says whether it created (`Upserted`).
 */
export const upsert = (ctx: ServiceContext, input: TodoUpsertInput) =>
  withTransaction(async (tx) => {
    const parsed = todoUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId } = parsed.data;

    const existing = await todoModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
    if (isError(existing)) return existing;
    if (!existing) return asCreated(await create({ ...ctx, tx }, input));

    const visible = await todoModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);
    if (visible.groupId !== groupId || (recipientId !== undefined && visible.recipientId !== recipientId))
      return newError({ code: "todoService:immutable" });
    return unchanged(visible);
  }, ctx);

/**
 * Soft delete (a mistake, a cancelled errand). Writers only. Its live
 * subtasks, all levels, go with it in the same statement; then its parent
 * follows the children it has left (the rollup).
 */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const existing = await todoModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();
    const descendants = await liveDescendantsOf(tx, existing);
    if (isError(descendants)) return descendants;

    const ids = [...descendants, id];
    const res = await todoModel.remove({ ...ctx, tx, filter: { id: { type: "inArray", value: ids } } });
    if (isError(res) && res.code === "baseModel:remove:nothingRemoved") return rejectError(ctx.authUser);
    if (isError(res)) return res;
    for (const todoId of res.ids) {
      const queued = await enqueueCalendarPush(tx, { todoId }, "todo");
      if (queued) return queued;
    }
    return (await rollUp(tx, existing.parentId, actorIdOf(ctx))) ?? res;
  }, ctx);

/**
 * A member is leaving `groupId` (removed, or leaving): their open todos
 * there keep their name as a typed-in assignee (`assignee_id` null,
 * `assignee_name` their display name now), so the group still knows who
 * had them and can reassign. Done todos are left alone. Runs as the system,
 * inside the caller's transaction.
 */
export const releaseAssignee = async (tx: Tx, groupId: string, userId: string) => {
  const system = { authUser: SYSTEM_USER, tx };
  const user = await userModel.getById(userId, system);
  if (isError(user)) return user;
  const name = (user?.name?.trim() || "Former member").slice(0, TODO_LIMITS.assigneeName);

  const updated = await todoModel.update({
    ...system,
    filter: {
      groupId: { type: "eq", value: groupId },
      assigneeId: { type: "eq", value: userId },
      doneAt: { type: "isNull" },
    },
    data: { assigneeId: null, assigneeName: name },
  });
  if (isError(updated) && updated.code === "baseModel:update:nothingUpdated") return { count: 0 };
  if (isError(updated)) return updated;
  return { count: updated.length };
};

/**
 * An event was deleted: todos linked to it lose the old column's link
 * (`event_id` null, for old clients), quietly, done ones included (deleted
 * todos stay as they were). The FK does the same on a hard delete; this is
 * the soft one. Link rows (`timeline_entry_todo`) stay: readers join live
 * entries only. Runs as the system, inside the caller's transaction.
 */
export const releaseEvent = async (tx: Tx, eventId: string) => {
  const updated = await todoModel.update({
    authUser: SYSTEM_USER,
    tx,
    filter: { eventId: { type: "eq", value: eventId } },
    data: { eventId: null },
  });
  if (isError(updated) && updated.code === "baseModel:update:nothingUpdated") return { count: 0 };
  if (isError(updated)) return updated;
  return { count: updated.length };
};
