import { describe, expect, it } from "vitest";
import {
  canHaveSubtask,
  clampDue,
  depthOf,
  inheritedDue,
  isDueAfterParent,
  MAX_TODO_DEPTH,
  rollupOf,
  siblingOrder,
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

describe("clampDue and inheritedDue (todo-subtasks-3)", () => {
  const friday = { dueOn: "2026-11-27", dueTime: "09:00" };
  const undated = { dueOn: null, dueTime: null };

  it("caps a later day at the parent's day and takes its time", () => {
    expect(clampDue({ dueOn: "2026-11-30", dueTime: "15:00" }, friday)).toEqual(friday);
    expect(clampDue({ dueOn: "2026-11-30", dueTime: null }, friday)).toEqual(friday);
    expect(
      clampDue({ dueOn: "2026-11-30", dueTime: "15:00" }, { dueOn: "2026-11-27", dueTime: null }),
    ).toEqual({ dueOn: "2026-11-27", dueTime: null });
    expect(isDueAfterParent({ dueOn: "2026-11-30", dueTime: null }, friday)).toBe(true);
  });

  it("keeps the same day (any time) and an earlier one", () => {
    const sameDayLater = { dueOn: "2026-11-27", dueTime: "18:00" };
    expect(clampDue(sameDayLater, friday)).toEqual(sameDayLater);
    const earlier = { dueOn: "2026-11-24", dueTime: null };
    expect(clampDue(earlier, friday)).toEqual(earlier);
    expect(isDueAfterParent(sameDayLater, friday)).toBe(false);
  });

  it("an undated parent caps nothing, and an undated subtask is kept", () => {
    const late = { dueOn: "2026-12-31", dueTime: "08:00" };
    expect(clampDue(late, undated)).toEqual(late);
    expect(clampDue(late, null)).toEqual(late);
    expect(clampDue(undated, friday)).toEqual(undated);
  });

  it("inherits the parent's day and time; an undated parent's is none", () => {
    expect(inheritedDue(friday)).toEqual(friday);
    expect(inheritedDue({ dueOn: "2026-11-27", dueTime: null })).toEqual({
      dueOn: "2026-11-27",
      dueTime: null,
    });
    expect(inheritedDue(undated)).toEqual(undated);
    expect(inheritedDue(null)).toEqual(undated);
  });
});

describe("siblingOrder", () => {
  const sib = (id: string, dueOn: string | null, dueTime: string | null, createdAt: string) => ({
    id,
    dueOn,
    dueTime,
    createdAt,
  });
  const ids = (list: ReturnType<typeof sib>[]) => siblingOrder(list).map((s) => s.id);

  it("puts dated before undated, by day", () => {
    expect(
      ids([
        sib("undated", null, null, "2026-11-01T00:00:00.000Z"),
        sib("friday", "2026-11-27", null, "2026-11-02T00:00:00.000Z"),
        sib("tuesday", "2026-11-24", null, "2026-11-03T00:00:00.000Z"),
      ]),
    ).toEqual(["tuesday", "friday", "undated"]);
  });

  it("puts timed before day-only on one day, by time", () => {
    expect(
      ids([
        sib("day-only", "2026-11-24", null, "2026-11-01T00:00:00.000Z"),
        sib("at 15:00", "2026-11-24", "15:00", "2026-11-02T00:00:00.000Z"),
        sib("at 09:30", "2026-11-24", "09:30", "2026-11-03T00:00:00.000Z"),
      ]),
    ).toEqual(["at 09:30", "at 15:00", "day-only"]);
  });

  it("then by when they were made, then the id", () => {
    expect(
      ids([
        sib("b-later", null, null, "2026-11-02T00:00:00.000Z"),
        sib("b-first", null, null, "2026-11-01T00:00:00.000Z"),
        sib("a-first", null, null, "2026-11-01T00:00:00.000Z"),
      ]),
    ).toEqual(["a-first", "b-first", "b-later"]);
  });

  it("leaves its input as it was", () => {
    const list = [
      sib("2", null, null, "2026-11-02T00:00:00.000Z"),
      sib("1", "2026-11-24", null, "2026-11-01"),
    ];
    siblingOrder(list);
    expect(list.map((s) => s.id)).toEqual(["2", "1"]);
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
