import type { z } from "zod";
import type { Task, TaskCreateInput, TaskUpdateInput, TaskUpsertInput, Tx } from "../db";
import type { IncludeDeleted } from "../models/task";
import type { ServiceContext } from "./types";

import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  ASSIGNEE_NOT_MEMBER_ISSUE,
  BAD_TASK_LINK_ISSUES,
  canCompleteTask,
  completionOnly,
  TASK_LIMITS,
  taskContentOf,
  taskContentZSchema,
  taskCreateZSchema,
  taskUpdateZSchema,
  taskUpsertZSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import {
  careGroupMemberModel,
  careGroupModel,
  careRecipientModel,
  medicationModel,
  providerModel,
  taskModel,
  timelineEntryModel,
  userModel,
} from "../models";
import { isSystemUser, rejectError } from "../permissions";

// Tasks: the group's shared todo list. Write through here, not the model:
// this is where content is validated, the assignee and links are checked,
// and viewers are limited to completing and reopening tasks assigned to
// them (the permissions map lets every member update; this narrows it).
// State and order are derived, never stored: taskRules.ts.

export const serviceName = "task";
export const schemaName = taskModel.schemaName;

const issuesOf = (error: z.ZodError) =>
  error.issues.map(({ path, message }) => ({ path: path.join("."), message }));

const invalid = (error: z.ZodError) =>
  newError({ code: "taskService:invalid", meta: { issues: issuesOf(error) } });

const notFound = () => newError({ code: "taskService:notFound" });
const viewerCompletionOnly = () => newError({ code: "taskService:viewerCompletionOnly" });

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
 * The recipient a task is for: `recipientId` when given (it must be in the
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
    if (recipient?.groupId !== groupId) return newError({ code: "taskService:recipientNotInGroup" });
    return recipient;
  }

  const recipient = await careRecipientModel.get({
    ...ctx,
    tx,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(recipient)) return recipient;
  return recipient ?? newError({ code: "taskService:noRecipient" });
};

/** The assignee must be a member of the group. Checked when set or changed. */
const checkAssignee = async (tx: Tx, groupId: string, assigneeId: string | null) => {
  if (!assigneeId) return null;
  const role = await careGroupMemberModel.getRole(groupId, assigneeId, { tx });
  if (isError(role)) return role;
  return role
    ? null
    : newError({
        code: "taskService:assigneeNotMember",
        meta: { issues: [{ ...ASSIGNEE_NOT_MEMBER_ISSUE }] },
      });
};

const badLink = (field: keyof typeof BAD_TASK_LINK_ISSUES) =>
  newError({ code: "taskService:badLink", meta: { issues: [{ ...BAD_TASK_LINK_ISSUES[field] }] } });

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

/** Write `data` to the task, as the actor. A refusal by RBAC means a viewer on a writer's field, or a non-member. */
const write = async (ctx: ServiceContext, tx: Tx, id: string, data: Partial<Task>) => {
  const updated = await taskModel.update({ ...ctx, tx, filter: { id: { type: "eq", value: id } }, data });
  if (isError(updated) && updated.code === "baseModel:update:nothingUpdated")
    return rejectError(ctx.authUser);
  if (isError(updated)) return updated;
  return updated[0] ?? null;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One task, if the actor can see it. Deleted ones only with `includeDeleted`. */
export const getById = (ctx: ServiceContext, id: string, opts: IncludeDeleted = {}) =>
  taskModel.getById(id, { ...ctx, ...opts });

/** A group's tasks (storage order: sort with `taskOrder` / `doneOrder`). */
export const list = (ctx: ServiceContext, { groupId, ...opts }: IncludeDeleted & { groupId: string }) =>
  taskModel.list({ ...ctx, ...opts, filter: { groupId: { type: "eq", value: groupId } } });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Add a task. `id` may come from an offline device; creating one that
 * exists returns it (a replay). Writers only.
 */
export const create = (ctx: ServiceContext, input: TaskCreateInput) =>
  withTransaction(async (tx) => {
    const parsed = taskCreateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { recipientId, ...data } = parsed.data;

    if (data.id) {
      const existing = await taskModel.getById(data.id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
      if (isError(existing)) return existing;
      if (existing) {
        const visible = await taskModel.getById(data.id, { ...ctx, tx, includeDeleted: true });
        if (isError(visible)) return visible;
        if (!visible) return rejectError(ctx.authUser);
        return visible.groupId === data.groupId ? visible : newError({ code: "taskService:immutable" });
      }
    }

    const recipient = await resolveRecipient(ctx, tx, data.groupId, recipientId);
    if (isError(recipient)) return recipient;

    const role = await roleIn(ctx, tx, data.groupId);
    if (isError(role)) return role;
    if (role === "viewer") return rejectError(ctx.authUser);

    const assignee = await checkAssignee(tx, data.groupId, data.assigneeId);
    if (assignee) return assignee;
    const links = await checkLinks(ctx, tx, data.groupId, data);
    if (links) return links;

    return taskModel.create({ ...ctx, tx, data: { ...data, recipientId: recipient.id } });
  }, ctx);

/**
 * Edit a task's content: title, assignee, due and links. The group and
 * recipient are fixed; the merged task must be valid; a changed assignee
 * must be a member and a changed link live in the group. Viewers are
 * refused (`viewerCompletionOnly`): they only complete and reopen.
 */
export const update = (ctx: ServiceContext, id: string, input: TaskUpdateInput) =>
  withTransaction(async (tx) => {
    const parsed = taskUpdateZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

    const existing = await taskModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const merged = taskContentZSchema.safeParse({ ...taskContentOf(existing), ...patch });
    if (!merged.success) return invalid(merged.error);

    const role = await roleIn(ctx, tx, existing.groupId);
    if (isError(role)) return role;
    if (role === "viewer") {
      const own = canCompleteTask({ role, userId: ctx.authUser?.id, task: existing });
      if (!own || !completionOnly(existing, merged.data)) return viewerCompletionOnly();
    }

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

    const { doneAt: _doneAt, doneBy: _doneBy, ...content } = merged.data;
    return write(ctx, tx, id, content);
  }, ctx);

/**
 * Tick a task done. The server records the actor as `done_by`; `doneAt`
 * may come from an offline device (when it was ticked), else now. Writers
 * complete any task; a viewer only one assigned to them. Completing a done
 * task keeps who finished it first (a replay).
 */
export const complete = (ctx: ServiceContext, id: string, { doneAt }: { doneAt?: string | null } = {}) =>
  withTransaction(async (tx) => {
    const existing = await taskModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const role = await roleIn(ctx, tx, existing.groupId);
    if (isError(role)) return role;
    if (!canCompleteTask({ role, userId: ctx.authUser?.id, task: existing }))
      return role === "viewer" ? viewerCompletionOnly() : rejectError(ctx.authUser);
    if (existing.doneAt) return existing;

    const at = doneAt && Number.isFinite(new Date(doneAt).getTime()) ? new Date(doneAt) : new Date();
    // A device clock ahead of the server's: never in the future.
    const when = at.getTime() > Date.now() ? new Date() : at;
    return write(ctx, tx, id, {
      doneAt: when.toISOString(),
      doneBy: ctx.authUser?.id ?? SYSTEM_USER.id,
    });
  }, ctx);

/** Reopen a done task: clears who finished it and when. The same people as `complete`. */
export const reopen = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const existing = await taskModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (!existing) return notFound();

    const role = await roleIn(ctx, tx, existing.groupId);
    if (isError(role)) return role;
    if (!canCompleteTask({ role, userId: ctx.authUser?.id, task: existing }))
      return role === "viewer" ? viewerCompletionOnly() : rejectError(ctx.authUser);
    if (!existing.doneAt) return existing;

    return write(ctx, tx, id, { doneAt: null, doneBy: null });
  }, ctx);

/**
 * Create the task with this id, or bring the existing one up to date: what
 * PowerSync's upload queue sends for a row a device created. Safe to
 * replay. The group and recipient never change, a deleted task stays
 * deleted, and an id the actor can't see is refused without saying whether
 * it exists.
 */
export const upsert = (ctx: ServiceContext, input: TaskUpsertInput) =>
  withTransaction(async (tx) => {
    const parsed = taskUpsertZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, groupId, recipientId, ...content } = parsed.data;

    const existing = await taskModel.getById(id, { authUser: SYSTEM_USER, tx, includeDeleted: true });
    if (isError(existing)) return existing;
    if (!existing) return create({ ...ctx, tx }, input);

    const visible = await taskModel.getById(id, { ...ctx, tx, includeDeleted: true });
    if (isError(visible)) return visible;
    if (!visible) return rejectError(ctx.authUser);
    if (visible.groupId !== groupId || (recipientId !== undefined && visible.recipientId !== recipientId))
      return newError({ code: "taskService:immutable" });
    if (visible.deletedAt) return visible;

    // A replay of the create from a viewer's device changes nothing.
    if (completionOnly(visible, content)) return visible;
    return update({ ...ctx, tx }, id, content);
  }, ctx);

/** Soft delete (a mistake, a cancelled errand). Writers only. */
export const remove = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const res = await taskModel.remove({ ...ctx, tx, filter: { id: { type: "eq", value: id } } });
    if (!isError(res) || res.code !== "baseModel:remove:nothingRemoved") return res;
    // Visible but not removable: a viewer. Otherwise gone, or never theirs.
    const visible = await taskModel.getById(id, { ...ctx, tx });
    if (isError(visible)) return visible;
    return visible ? rejectError(ctx.authUser) : notFound();
  }, ctx);

/**
 * A member is leaving `groupId` (removed, or leaving): their open tasks
 * there keep their name as a typed-in assignee (`assignee_id` null,
 * `assignee_name` their display name now), so the group still knows who
 * had them and can reassign. Done tasks are left alone. Runs as the system,
 * inside the caller's transaction.
 */
export const releaseAssignee = async (tx: Tx, groupId: string, userId: string) => {
  const system = { authUser: SYSTEM_USER, tx };
  const user = await userModel.getById(userId, system);
  if (isError(user)) return user;
  const name = (user?.name?.trim() || "Former member").slice(0, TASK_LIMITS.assigneeName);

  const updated = await taskModel.update({
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
