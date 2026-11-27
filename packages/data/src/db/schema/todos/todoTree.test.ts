import { describe, expect, it } from "vitest";
import {
  canHaveSubtask,
  depthOf,
  listsOnItsOwn,
  MAX_TODO_DEPTH,
  rollupOf,
  subtaskProgress,
  upcomingListsSubtask,
} from "./todoTree";

const DONE = "2026-11-20T10:00:00.000Z";
const GONE = "2026-11-21T10:00:00.000Z";
const PARENT = "8f7f1d1e-0000-4000-8000-000000000001";
const USER = "8f7f1d1e-0000-4000-8000-0000000000aa";

const open = { doneAt: null, deletedAt: null };
const done = { doneAt: DONE, deletedAt: null };
const deletedOpen = { doneAt: null, deletedAt: GONE };
const deletedDone = { doneAt: DONE, deletedAt: GONE };

describe("rollupOf", () => {
  it.each([
    ["no children", [], null, null],
    ["no children, done", [], DONE, null],
    ["all open", [open, open], null, null],
    ["some done", [done, open], null, null],
    ["all done", [done, done], null, "complete"],
    ["all done, already done", [done, done], DONE, null],
    ["some done, the parent done", [done, open], DONE, "reopen"],
    ["all open, the parent done", [open], DONE, "reopen"],
    ["the open one deleted", [done, deletedOpen], null, "complete"],
    ["a deleted done one beside an open one", [deletedDone, open], DONE, "reopen"],
    ["a lone deleted open child", [deletedOpen], DONE, null],
    ["a lone deleted done child", [deletedDone], null, null],
  ] as const)("%s", (_, children, parentDoneAt, expected) => {
    expect(rollupOf({ doneAt: parentDoneAt }, children)).toBe(expected);
  });
});

describe("depthOf and canHaveSubtask", () => {
  const live = { deletedAt: null, repeatRule: null };
  // A todo at depth n has n - 1 ancestors.
  const chainAt = (depth: number) => Array.from({ length: depth - 1 }, () => live);

  it("counts a top-level todo as 1", () => {
    expect(MAX_TODO_DEPTH).toBe(3);
    expect([1, 2, 3, 4].map((d) => depthOf(chainAt(d)))).toEqual([1, 2, 3, 4]);
  });

  it.each([
    [1, true],
    [2, true],
    [3, false],
    [4, false],
  ])("a parent at depth %i takes a subtask: %s", (depth, expected) => {
    expect(canHaveSubtask(chainAt(depth), live)).toBe(expected);
  });

  it("refuses a repeating parent and a deleted one, at any depth", () => {
    for (const depth of [1, 2]) {
      expect(canHaveSubtask(chainAt(depth), { ...live, repeatRule: "FREQ=WEEKLY;BYDAY=MO" })).toBe(false);
      expect(canHaveSubtask(chainAt(depth), { ...live, deletedAt: GONE })).toBe(false);
    }
  });
});

describe("subtaskProgress", () => {
  it.each([
    ["none", [], { done: 0, total: 0 }],
    ["some done", [done, open, open], { done: 1, total: 3 }],
    ["all done", [done, done], { done: 2, total: 2 }],
    ["deleted ones left out", [done, deletedDone, deletedOpen, open], { done: 1, total: 2 }],
  ] as const)("%s", (_, children, expected) => {
    expect(subtaskProgress(children)).toEqual(expected);
  });
});

describe("listsOnItsOwn", () => {
  const plain = { parentId: null, dueOn: null, assigneeId: null, assigneeName: null };

  it.each([
    ["a top-level todo", plain, true],
    ["a top-level todo with no parent field", { dueOn: null, assigneeId: null, assigneeName: null }, true],
    ["a plain subtask", { ...plain, parentId: PARENT }, false],
    ["a dated subtask", { ...plain, parentId: PARENT, dueOn: "2026-11-30" }, true],
    ["a subtask assigned to a member", { ...plain, parentId: PARENT, assigneeId: USER }, true],
    ["a subtask assigned to a typed name", { ...plain, parentId: PARENT, assigneeName: "Aunt May" }, true],
    ["a subtask with a blank typed name", { ...plain, parentId: PARENT, assigneeName: "  " }, false],
  ])("%s: %s", (_, todo, expected) => {
    expect(listsOnItsOwn(todo)).toBe(expected);
  });
});

describe("upcomingListsSubtask", () => {
  const step = { parentId: PARENT, dueOn: "2026-11-30", assigneeId: null, assigneeName: null };

  it.each([
    ["a top-level todo", { ...step, parentId: null }, "2026-11-30", true],
    ["a subtask on its parent's day", step, "2026-11-30", false],
    ["a subtask a day before its parent", { ...step, dueOn: "2026-11-29" }, "2026-11-30", true],
    [
      "a subtask assigned to a member, on its parent's day",
      { ...step, assigneeId: USER },
      "2026-11-30",
      true,
    ],
    ["a subtask assigned to a typed name", { ...step, assigneeName: "Aunt May" }, "2026-11-30", true],
    ["a dated subtask under an undated parent", step, null, true],
    ["an undated, unassigned subtask under an undated parent", { ...step, dueOn: null }, null, false],
  ])("%s", (_, todo, parentDueOn, expected) => {
    expect(upcomingListsSubtask(todo, parentDueOn)).toBe(expected);
  });
});
