import type { z } from "zod";
import type { EntryTodoLinkInput, Tx } from "../db";
import type { ServiceContext } from "./types";

import { MAX_PAGE_SIZE, SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { entryTodoId, entryTodoLinkZSchema } from "../db/schema";
import { isError, newError } from "../errors";
import { timelineEntryModel, timelineEntryTodoModel, todoModel } from "../models";
import { rejectError } from "../permissions";

// Links between a timeline entry and the todos it links (planner-3), many to
// many. Write through here: this is where both ends are checked (a live
// entry and a live todo, both in the link's group). No kind check: screens
// show links only on notes and events (`NOTE_DOCUMENT_KINDS`).
//
// A link's id is derived from its pair (`entryTodoId`), so linking is
// idempotent everywhere: a replay, or two devices linking the same todo.
//
// While `todo.event_id` exists (until a contract migration drops it), old
// clients still write it: `todoService` mirrors it into link rows, and
// `unlink` here clears it when it names the unlinked entry, so an old client
// doesn't keep showing a removed link.

export const serviceName = "entryTodo";
export const schemaName = timelineEntryTodoModel.schemaName;

const invalid = (error: z.ZodError) =>
  newError({
    code: "entryTodoService:invalid",
    meta: { issues: error.issues.map(({ path, message }) => ({ path: path.join("."), message })) },
  });

const entryNotFound = () => newError({ code: "entryTodoService:entryNotFound" });
const todoNotFound = () => newError({ code: "entryTodoService:todoNotFound" });

const system = (tx: Tx) => ({ authUser: SYSTEM_USER, tx });

/**
 * A live entry the actor can see, or the right refusal: `unauthorized` when
 * it's in a group they can't see, `entryNotFound` when it doesn't exist or
 * is deleted.
 */
const visibleEntry = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const entry = await timelineEntryModel.getById(id, { ...ctx, tx });
  if (isError(entry) || entry) return entry;
  const any = await timelineEntryModel.getById(id, system(tx));
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : entryNotFound();
};

/** The same for a live todo. */
const visibleTodo = async (ctx: ServiceContext, tx: Tx, id: string) => {
  const todo = await todoModel.getById(id, { ...ctx, tx });
  if (isError(todo) || todo) return todo;
  const any = await todoModel.getById(id, system(tx));
  if (isError(any)) return any;
  return any ? rejectError(ctx.authUser) : todoNotFound();
};

// ---------------------------------------------------------------------------
// Reads (link rows; a reader joins live entries and todos)
// ---------------------------------------------------------------------------

/** An entry's links, oldest first. */
export const listForEntry = (ctx: ServiceContext, entryId: string) =>
  timelineEntryTodoModel.list({
    ...ctx,
    filter: { entryId: { type: "eq", value: entryId } },
    orderBy: [{ field: "createdAt", direction: "asc" }],
  });

/** A todo's links, newest first. */
export const listForTodo = (ctx: ServiceContext, todoId: string) =>
  timelineEntryTodoModel.list({
    ...ctx,
    filter: { todoId: { type: "eq", value: todoId } },
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Link a todo to an entry. Writers only. The entry and the todo must be
 * live, both in `groupId`. Linking a pair that's already linked returns the
 * existing link.
 */
export const link = (ctx: ServiceContext, input: EntryTodoLinkInput) =>
  withTransaction(async (tx) => {
    const parsed = entryTodoLinkZSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { groupId, entryId, todoId } = parsed.data;
    const id = entryTodoId(entryId, todoId);

    const entry = await visibleEntry(ctx, tx, entryId);
    if (isError(entry)) return entry;
    const todo = await visibleTodo(ctx, tx, todoId);
    if (isError(todo)) return todo;

    if (entry.groupId !== groupId || todo.groupId !== groupId) {
      return newError({ code: "entryTodoService:immutable" });
    }

    const existing = await timelineEntryTodoModel.getById(id, { ...ctx, tx });
    if (isError(existing)) return existing;
    if (existing) return existing;

    return timelineEntryTodoModel.create({ ...ctx, tx, data: { id, groupId, entryId, todoId } });
  }, ctx);

/**
 * The mirror's write (`todoService`, an old client's `eventId`): link the
 * pair as the actor, inside the caller's transaction, with both ends
 * already checked. A pair that's linked stays as it is.
 */
export const linkIn = async (
  ctx: ServiceContext,
  tx: Tx,
  link: { groupId: string; entryId: string; todoId: string },
) => {
  const id = entryTodoId(link.entryId, link.todoId);
  const existing = await timelineEntryTodoModel.getById(id, system(tx));
  if (isError(existing) || existing) return existing;
  return timelineEntryTodoModel.create({ ...ctx, tx, data: { id, ...link } });
};

/**
 * The mirror's removal: the pair's link goes, as the actor, inside the
 * caller's transaction. A pair that isn't linked is fine.
 */
export const unlinkIn = async (ctx: ServiceContext, tx: Tx, entryId: string, todoId: string) => {
  const res = await timelineEntryTodoModel.remove({
    ...ctx,
    tx,
    filter: { id: { type: "eq", value: entryTodoId(entryId, todoId) } },
  });
  if (isError(res) && res.code === "baseModel:remove:nothingRemoved") return { ids: [] as string[] };
  return res;
};

/**
 * Remove a link (a hard delete). Writers only. Removing a link that's
 * already gone is fine (a replay); one the actor can see but not remove is
 * refused. An old client's `todo.event_id` naming the unlinked entry is
 * cleared with it.
 */
export const unlink = (ctx: ServiceContext, id: string) =>
  withTransaction(async (tx) => {
    const row = await timelineEntryTodoModel.getById(id, { ...ctx, tx });
    if (isError(row)) return row;
    const res = await timelineEntryTodoModel.remove({
      ...ctx,
      tx,
      filter: { id: { type: "eq", value: id } },
    });
    if (isError(res)) {
      if (res.code !== "baseModel:remove:nothingRemoved") return res;
      const any = await timelineEntryTodoModel.getById(id, system(tx));
      if (isError(any)) return any;
      return any ? rejectError(ctx.authUser) : { ids: [] as string[] };
    }
    if (!row) return res;

    const cleared = await todoModel.update({
      ...system(tx),
      filter: { id: { type: "eq", value: row.todoId }, eventId: { type: "eq", value: row.entryId } },
      data: { eventId: null },
    });
    if (isError(cleared) && cleared.code !== "baseModel:update:nothingUpdated") return cleared;
    return res;
  }, ctx);

/** `unlink` by the pair. */
export const unlinkPair = (ctx: ServiceContext, entryId: string, todoId: string) =>
  unlink(ctx, entryTodoId(entryId, todoId));

/**
 * Each todo's live linked entries, oldest link first (the connector's
 * `list_todos`): two reads for a page of todos, never one per todo. Todos
 * with no live link are left out.
 */
export const linkedEntriesOf = async (ctx: ServiceContext, todoIds: readonly string[]) => {
  const byTodo = new Map<string, { entryId: string; kind: string }[]>();
  if (!todoIds.length) return byTodo;
  const links = await timelineEntryTodoModel.list({
    ...ctx,
    filter: { todoId: { type: "inArray", value: [...todoIds] } },
    orderBy: [
      { field: "createdAt", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
  });
  if (isError(links)) return links;
  const entryIds = [...new Set(links.data.map((l) => l.entryId))];
  const kinds = new Map<string, string>();
  let cursor: string | null = null;
  while (entryIds.length) {
    const page = await timelineEntryModel.listPage({
      ...ctx,
      filter: { id: { type: "inArray", value: entryIds } },
      cursor,
      limit: MAX_PAGE_SIZE,
    });
    if (isError(page)) return page;
    for (const entry of page.data) kinds.set(entry.id, entry.kind);
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  for (const link of links.data) {
    const kind = kinds.get(link.entryId);
    if (!kind) continue;
    byTodo.set(link.todoId, [...(byTodo.get(link.todoId) ?? []), { entryId: link.entryId, kind }]);
  }
  return byTodo;
};
