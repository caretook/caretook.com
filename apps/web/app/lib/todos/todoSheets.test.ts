import { describe, expect, it } from "vitest";
import {
  editTodoGuard,
  listSearch,
  listSearchFromState,
  newTodoGuard,
  onlyTodoSheetChanged,
  openedFromApp,
  PLANNER_TODO_STATE,
  savesToTodos,
  TODO_SHEET_STATE,
  todoPageState,
} from "./todoSheets";

const G = "g1";
const LIST = `/app/groups/${G}/todos`;

describe("todo sheet guards", () => {
  it("opens the add sheet for writers; a viewer gets the list, with its chip", () => {
    expect(newTodoGuard({ groupId: G, search: "?who=mine&dueOn=2026-11-20", canWrite: true })).toEqual({
      sheet: true,
    });
    expect(newTodoGuard({ groupId: G, search: "?who=mine&dueOn=2026-11-20", canWrite: false })).toEqual({
      redirect: `${LIST}?who=mine`,
    });
  });

  it("opens the edit sheet on a live todo in the group, for writers", () => {
    const todo = { id: "t", groupId: G, deletedAt: null };
    expect(editTodoGuard({ groupId: G, search: "", canWrite: true, todo })).toEqual({ sheet: todo });
    for (const decision of [
      editTodoGuard({ groupId: G, search: "", canWrite: false, todo }),
      editTodoGuard({ groupId: G, search: "", canWrite: true, todo: null }),
      editTodoGuard({ groupId: G, search: "", canWrite: true, todo: { ...todo, deletedAt: "x" } }),
      editTodoGuard({ groupId: G, search: "", canWrite: true, todo: { ...todo, groupId: "other" } }),
    ])
      expect(decision).toEqual({ redirect: LIST });
  });

  it("knows its own links and sheet-only navigations", () => {
    expect(openedFromApp(TODO_SHEET_STATE)).toBe(true);
    expect(openedFromApp(null)).toBe(false);
    expect(openedFromApp(PLANNER_TODO_STATE)).toBe(true);
    expect(savesToTodos(PLANNER_TODO_STATE)).toBe(true);
    expect(savesToTodos(TODO_SHEET_STATE)).toBe(false);
    expect(savesToTodos({ savedToTodos: true })).toBe(false);
    expect(savesToTodos(null)).toBe(false);
    expect(listSearch("?who=everyone&providerId=p")).toBe("?who=everyone");
    const url = (path: string) => new URL(`http://x${path}`);
    expect(onlyTodoSheetChanged(G, url(LIST), url(`${LIST}/new`))).toBe(true);
    expect(onlyTodoSheetChanged(G, url(`${LIST}/t1/edit`), url(LIST))).toBe(true);
    expect(onlyTodoSheetChanged(G, url(LIST), url(`/app/groups/${G}/timeline`))).toBe(false);
  });
});

describe("the todo page's way back", () => {
  it("carries the list's chip from a row to the page, and nothing else", () => {
    expect(listSearchFromState(todoPageState("?who=everyone&providerId=p1"))).toBe("?who=everyone");
    expect(listSearchFromState(todoPageState(""))).toBe("");
    expect(listSearchFromState(null)).toBe("");
    expect(listSearchFromState(TODO_SHEET_STATE)).toBe("");
    expect(listSearchFromState({ todoListSearch: 3 })).toBe("");
  });
});
