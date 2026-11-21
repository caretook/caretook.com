// The history state on a link that opens a todo sheet (`todos/new`,
// `todos/:todoId/edit`), so closing it goes back to where it was opened:
// the todo list, or quick entry's Edit on the timeline. Pure; the todo
// routes' `todoSheets.ts` re-exports it.

/** History state on a link that opens a todo sheet. */
export const TODO_SHEET_STATE = { todoSheet: true } as const;

/** Whether a sheet was opened by one of this app's links (so closing it can go back). */
export const openedFromApp = (state: unknown) =>
  typeof state === "object" && state !== null && "todoSheet" in state;
