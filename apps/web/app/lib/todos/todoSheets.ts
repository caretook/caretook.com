import { TAG_PARAM } from "@caretook/data/schema";
import { appUrls } from "../app-shell/appUrls";
import { SUBTASKS_PARAM } from "./todoView";

// The todo list's sheet routes (`todos/new`, `todos/:todoId/edit`): which
// sheet a URL opens, or where it goes instead, and the history state that
// lets a sheet go back to where it was opened from (the list, or a todo's
// page). Pure, so web:unit tests it; the routes apply it. Like
// `lib/medications/medicationSheets.ts`; it lives in lib/ because the todo page opens the
// edit sheet too.

export { openedFromApp, PLANNER_TODO_STATE, savesToTodos, TODO_SHEET_STATE } from "./todoSheetLink";

export type TodoSheetDecision<Sheet> = { sheet: Sheet } | { redirect: string };

/** `todos/new`: the add sheet, for writers; a viewer gets the list. */
export const newTodoGuard = ({
  groupId,
  search,
  canWrite,
}: {
  groupId: string;
  search: string;
  canWrite: boolean;
}): TodoSheetDecision<true> =>
  canWrite ? { sheet: true } : { redirect: appUrls.todos(groupId, listSearch(search)) };

/**
 * `todos/:todoId/edit`: a live todo in this group, for a writer. A viewer,
 * and a todo that's missing, deleted or in another group, get the list.
 */
export const editTodoGuard = <T extends { groupId: string; deletedAt: string | null }>({
  groupId,
  search,
  canWrite,
  todo,
}: {
  groupId: string;
  search: string;
  canWrite: boolean;
  todo: T | null;
}): TodoSheetDecision<T> => {
  if (!canWrite || !todo || todo.groupId !== groupId || todo.deletedAt)
    return { redirect: appUrls.todos(groupId, listSearch(search)) };
  return { sheet: todo };
};

/** The list's own search (its filters: `?who=`, `?tag=` and the view, `?subtasks=`), without a sheet's prefills. */
export const listSearch = (search: string) => {
  const params = new URLSearchParams(search);
  const out = new URLSearchParams();
  for (const key of ["who", TAG_PARAM, SUBTASKS_PARAM]) {
    const value = params.get(key);
    if (value) out.set(key, value);
  }
  const text = out.toString();
  return text ? `?${text}` : "";
};

/** Whether a navigation only opened or closed a sheet over the list (its loader needn't run). */
export const onlyTodoSheetChanged = (groupId: string, current: URL, next: URL) => {
  const base = appUrls.todos(groupId);
  const isListOrSheet = (pathname: string) =>
    pathname === base || pathname === `${base}/new` || /\/todos\/[^/]+\/edit$/.test(pathname);
  return isListOrSheet(current.pathname) && isListOrSheet(next.pathname) && current.pathname.startsWith(base);
};

/** History state on a list row's link to a todo's page: the list's chip, for the page's way back. */
export const todoPageState = (search: string) => ({ todoListSearch: listSearch(search) });

/** The list's chip a todo's page was opened with (`todoPageState`), or "" (the list's default). */
export const listSearchFromState = (state: unknown) => {
  if (typeof state !== "object" || state === null || !("todoListSearch" in state)) return "";
  const search = state.todoListSearch;
  return typeof search === "string" ? listSearch(search) : "";
};
