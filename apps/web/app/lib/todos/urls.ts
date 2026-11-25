import type { Search } from "../core/urls";

import { groupHome, searchString, segment } from "../core/urls";

/** What `todos/new` can start with (`appUrls.newTodo`): a link, a due day, and (quick entry's Edit) the rest. */
export const TODO_PREFILL_PARAMS = {
  providerId: "providerId",
  medicationId: "medicationId",
  eventId: "eventId",
  entryId: "entryId",
  dueOn: "dueOn",
  title: "title",
  assigneeId: "assigneeId",
  dueTime: "dueTime",
  repeatRule: "repeatRule",
} as const;
export type TodoPrefill = {
  providerId?: string;
  medicationId?: string;
  eventId?: string;
  /** A live note or event to link (planner-3); an event's shows in the picker. */
  entryId?: string;
  dueOn?: string;
  title?: string;
  assigneeId?: string;
  dueTime?: string;
  /** Quick entry's repeat (RRULE text); the sheet ignores one that doesn't parse. */
  repeatRule?: string;
};

export const todoUrls = {
  /** A group's todos, with the Mine / Unassigned / Everyone chip (`?who=`) carried through. */
  todos: (groupId: string, search?: Search) => `${groupHome(groupId)}/todos${searchString(search)}`,
  /** One todo's page. */
  todo: (groupId: string, todoId: string) => `${groupHome(groupId)}/todos/${segment(todoId)}`,
  /**
   * The add sheet over the todo list, optionally prefilled with a link
   * (a provider, a medication, an event) or a due day, carrying the list's chip.
   */
  newTodo: (groupId: string, prefill: TodoPrefill = {}, search?: Search) =>
    `${groupHome(groupId)}/todos/new${searchString({
      ...Object.fromEntries(new URLSearchParams(searchString(search))),
      [TODO_PREFILL_PARAMS.providerId]: prefill.providerId,
      [TODO_PREFILL_PARAMS.medicationId]: prefill.medicationId,
      [TODO_PREFILL_PARAMS.eventId]: prefill.eventId,
      [TODO_PREFILL_PARAMS.entryId]: prefill.entryId,
      [TODO_PREFILL_PARAMS.dueOn]: prefill.dueOn,
      [TODO_PREFILL_PARAMS.title]: prefill.title,
      [TODO_PREFILL_PARAMS.assigneeId]: prefill.assigneeId,
      [TODO_PREFILL_PARAMS.dueTime]: prefill.dueTime,
      [TODO_PREFILL_PARAMS.repeatRule]: prefill.repeatRule,
    })}`,
  /** The edit sheet for one todo, over the todo list, carrying the list's chip. */
  editTodo: (groupId: string, todoId: string, search?: Search) =>
    `${groupHome(groupId)}/todos/${segment(todoId)}/edit${searchString(search)}`,
} as const;
