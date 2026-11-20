import { appUrls } from "./appUrls";

// The task list's sheet routes (`tasks/new`, `tasks/:taskId/edit`): which
// sheet a URL opens, or where it goes instead, and the history state that
// lets a sheet go back to where it was opened from (the list, or a task's
// page). Pure, so web:unit tests it; the routes apply it. Like
// `lib/medicationSheets.ts`; it lives in lib/ because the task page opens the
// edit sheet too.

export { openedFromApp, TASK_SHEET_STATE } from "./taskSheetLink";

export type TaskSheetDecision<Sheet> = { sheet: Sheet } | { redirect: string };

/** `tasks/new`: the add sheet, for writers; a viewer gets the list. */
export const newTaskGuard = ({
  groupId,
  search,
  canWrite,
}: {
  groupId: string;
  search: string;
  canWrite: boolean;
}): TaskSheetDecision<true> =>
  canWrite ? { sheet: true } : { redirect: appUrls.tasks(groupId, listSearch(search)) };

/**
 * `tasks/:taskId/edit`: a live task in this group, for a writer. A viewer,
 * and a task that's missing, deleted or in another group, get the list.
 */
export const editTaskGuard = <T extends { groupId: string; deletedAt: string | null }>({
  groupId,
  search,
  canWrite,
  task,
}: {
  groupId: string;
  search: string;
  canWrite: boolean;
  task: T | null;
}): TaskSheetDecision<T> => {
  if (!canWrite || !task || task.groupId !== groupId || task.deletedAt)
    return { redirect: appUrls.tasks(groupId, listSearch(search)) };
  return { sheet: task };
};

/** The list's own search (its chip), without a sheet's prefills. */
export const listSearch = (search: string) => {
  const who = new URLSearchParams(search).get("who");
  return who ? `?who=${encodeURIComponent(who)}` : "";
};

/** Whether a navigation only opened or closed a sheet over the list (its loader needn't run). */
export const onlyTaskSheetChanged = (groupId: string, current: URL, next: URL) => {
  const base = appUrls.tasks(groupId);
  const isListOrSheet = (pathname: string) =>
    pathname === base || pathname === `${base}/new` || /\/tasks\/[^/]+\/edit$/.test(pathname);
  return isListOrSheet(current.pathname) && isListOrSheet(next.pathname) && current.pathname.startsWith(base);
};

/** History state on a list row's link to a task's page: the list's chip, for the page's way back. */
export const taskPageState = (search: string) => ({ taskListSearch: listSearch(search) });

/** The list's chip a task's page was opened with (`taskPageState`), or "" (the list's default). */
export const listSearchFromState = (state: unknown) => {
  if (typeof state !== "object" || state === null || !("taskListSearch" in state)) return "";
  const search = state.taskListSearch;
  return typeof search === "string" ? listSearch(search) : "";
};
