import { describe, expect, it } from "vitest";
import {
  editTaskGuard,
  listSearch,
  listSearchFromState,
  newTaskGuard,
  onlyTaskSheetChanged,
  openedFromApp,
  TASK_SHEET_STATE,
  taskPageState,
} from "./taskSheets";

const G = "g1";
const LIST = `/app/groups/${G}/tasks`;

describe("task sheet guards", () => {
  it("opens the add sheet for writers; a viewer gets the list, with its chip", () => {
    expect(newTaskGuard({ groupId: G, search: "?who=mine&dueOn=2026-11-20", canWrite: true })).toEqual({
      sheet: true,
    });
    expect(newTaskGuard({ groupId: G, search: "?who=mine&dueOn=2026-11-20", canWrite: false })).toEqual({
      redirect: `${LIST}?who=mine`,
    });
  });

  it("opens the edit sheet on a live task in the group, for writers", () => {
    const task = { id: "t", groupId: G, deletedAt: null };
    expect(editTaskGuard({ groupId: G, search: "", canWrite: true, task })).toEqual({ sheet: task });
    for (const decision of [
      editTaskGuard({ groupId: G, search: "", canWrite: false, task }),
      editTaskGuard({ groupId: G, search: "", canWrite: true, task: null }),
      editTaskGuard({ groupId: G, search: "", canWrite: true, task: { ...task, deletedAt: "x" } }),
      editTaskGuard({ groupId: G, search: "", canWrite: true, task: { ...task, groupId: "other" } }),
    ])
      expect(decision).toEqual({ redirect: LIST });
  });

  it("knows its own links and sheet-only navigations", () => {
    expect(openedFromApp(TASK_SHEET_STATE)).toBe(true);
    expect(openedFromApp(null)).toBe(false);
    expect(listSearch("?who=everyone&providerId=p")).toBe("?who=everyone");
    const url = (path: string) => new URL(`http://x${path}`);
    expect(onlyTaskSheetChanged(G, url(LIST), url(`${LIST}/new`))).toBe(true);
    expect(onlyTaskSheetChanged(G, url(`${LIST}/t1/edit`), url(LIST))).toBe(true);
    expect(onlyTaskSheetChanged(G, url(LIST), url(`/app/groups/${G}/timeline`))).toBe(false);
  });
});

describe("the task page's way back", () => {
  it("carries the list's chip from a row to the page, and nothing else", () => {
    expect(listSearchFromState(taskPageState("?who=everyone&providerId=p1"))).toBe("?who=everyone");
    expect(listSearchFromState(taskPageState(""))).toBe("");
    expect(listSearchFromState(null)).toBe("");
    expect(listSearchFromState(TASK_SHEET_STATE)).toBe("");
    expect(listSearchFromState({ taskListSearch: 3 })).toBe("");
  });
});
