// The history state on a link that opens a todo sheet (`todos/new`,
// `todos/:todoId/edit`), so closing it goes back to where it was opened:
// the todo list, or quick entry's Edit on the timeline. Pure; the todo
// routes' `todoSheets.ts` re-exports it. The Planner's Add > Todo, from
// Upcoming or Past, also marks that a save lands on the Todos tab.

/** History state on a link that opens a todo sheet. */
export const TODO_SHEET_STATE = { todoSheet: true } as const;

/** Whether a sheet was opened by one of this app's links (so closing it can go back). */
export const openedFromApp = (state: unknown) =>
  typeof state === "object" && state !== null && "todoSheet" in state;

/**
 * History state on the Planner's Add > Todo, from Upcoming or Past: a save
 * lands on the Todos tab (replacing the sheet, so Back doesn't reopen it);
 * Cancel, Escape and a tap outside still go back to the tab.
 */
export const PLANNER_TODO_STATE = { ...TODO_SHEET_STATE, savedToTodos: true } as const;

/** Whether a save from this sheet lands on the Todos tab (`PLANNER_TODO_STATE`). */
export const savesToTodos = (state: unknown) =>
  openedFromApp(state) && typeof state === "object" && state !== null && "savedToTodos" in state;
