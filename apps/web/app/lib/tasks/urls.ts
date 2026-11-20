import type { Search } from "../core/urls";

import { groupHome, searchString, segment } from "../core/urls";

/** What `tasks/new` can start with (`appUrls.newTask`): a link, a due day, and (quick entry's Edit) the rest. */
export const TASK_PREFILL_PARAMS = {
  providerId: "providerId",
  medicationId: "medicationId",
  eventId: "eventId",
  dueOn: "dueOn",
  title: "title",
  assigneeId: "assigneeId",
  dueTime: "dueTime",
} as const;
export type TaskPrefill = {
  providerId?: string;
  medicationId?: string;
  eventId?: string;
  dueOn?: string;
  title?: string;
  assigneeId?: string;
  dueTime?: string;
};

export const taskUrls = {
  /** A group's tasks, with the Mine / Unassigned / Everyone chip (`?who=`) carried through. */
  tasks: (groupId: string, search?: Search) => `${groupHome(groupId)}/tasks${searchString(search)}`,
  /** One task's page. */
  task: (groupId: string, taskId: string) => `${groupHome(groupId)}/tasks/${segment(taskId)}`,
  /**
   * The add sheet over the task list, optionally prefilled with a link
   * (a provider, a medication, an event) or a due day, carrying the list's chip.
   */
  newTask: (groupId: string, prefill: TaskPrefill = {}, search?: Search) =>
    `${groupHome(groupId)}/tasks/new${searchString({
      ...Object.fromEntries(new URLSearchParams(searchString(search))),
      [TASK_PREFILL_PARAMS.providerId]: prefill.providerId,
      [TASK_PREFILL_PARAMS.medicationId]: prefill.medicationId,
      [TASK_PREFILL_PARAMS.eventId]: prefill.eventId,
      [TASK_PREFILL_PARAMS.dueOn]: prefill.dueOn,
      [TASK_PREFILL_PARAMS.title]: prefill.title,
      [TASK_PREFILL_PARAMS.assigneeId]: prefill.assigneeId,
      [TASK_PREFILL_PARAMS.dueTime]: prefill.dueTime,
    })}`,
  /** The edit sheet for one task, over the task list, carrying the list's chip. */
  editTask: (groupId: string, taskId: string, search?: Search) =>
    `${groupHome(groupId)}/tasks/${segment(taskId)}/edit${searchString(search)}`,
} as const;
