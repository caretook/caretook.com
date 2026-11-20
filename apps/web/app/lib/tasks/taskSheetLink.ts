// The history state on a link that opens a task sheet (`tasks/new`,
// `tasks/:taskId/edit`), so closing it goes back to where it was opened:
// the task list, or quick entry's Edit on the timeline. Pure; the task
// routes' `taskSheets.ts` re-exports it.

/** History state on a link that opens a task sheet. */
export const TASK_SHEET_STATE = { taskSheet: true } as const;

/** Whether a sheet was opened by one of this app's links (so closing it can go back). */
export const openedFromApp = (state: unknown) =>
  typeof state === "object" && state !== null && "taskSheet" in state;
