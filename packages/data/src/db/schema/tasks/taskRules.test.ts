import { describe, expect, it } from "vitest";
import { taskContentZSchema, taskCreateZSchema } from "./task";
import {
  assigneeOf,
  canCompleteTask,
  completionOnly,
  doneOrder,
  localTime,
  taskOrder,
  taskState,
} from "./taskRules";

const LA = "America/Los_Angeles";
const NY = "America/New_York";
const GROUP = "8f7f1d1e-0000-4000-8000-000000000001";
const USER = "8f7f1d1e-0000-4000-8000-0000000000aa";
const OTHER = "8f7f1d1e-0000-4000-8000-0000000000bb";

type T = Parameters<typeof taskOrder>[0][number];
const task = (overrides: Partial<T> = {}): T => ({
  id: "t",
  assigneeId: null,
  assigneeName: null,
  dueOn: null,
  dueTime: null,
  doneAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  ...overrides,
});

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.success ? [] : result.error!.issues.map((i) => i.path.join("."));

describe("task schemas", () => {
  it.each([
    ["a title only", { title: "Call the pharmacy" }, []],
    ["a blank title", { title: "   " }, ["title"]],
    ["a time without a day", { title: "x", dueTime: "17:00" }, ["dueTime"]],
    ["a day and a time", { title: "x", dueOn: "2026-11-20", dueTime: "17:00" }, []],
    ["a bad time", { title: "x", dueOn: "2026-11-20", dueTime: "5pm" }, ["dueTime"]],
    ["a bad day", { title: "x", dueOn: "20/11/2026" }, ["dueOn"]],
    ["a member and a typed name", { title: "x", assigneeId: USER, assigneeName: "May" }, ["assigneeName"]],
    ["a typed name", { title: "x", assigneeName: "Aunt May" }, []],
  ])("create: %s", (_, fields, paths) => {
    expect(issuePaths(taskCreateZSchema.safeParse({ groupId: GROUP, ...fields }))).toEqual(paths);
  });

  it("trims, and turns empty optional text into null", () => {
    const parsed = taskCreateZSchema.parse({ groupId: GROUP, title: "  Call  ", assigneeName: "  " });
    expect(parsed).toMatchObject({ title: "Call", assigneeName: null, dueOn: null, dueTime: null });
  });

  it("needs both done fields or neither", () => {
    const base = { title: "x" };
    expect(issuePaths(taskContentZSchema.safeParse({ ...base, doneAt: "2026-11-20T10:00:00Z" }))).toEqual([
      "doneAt",
    ]);
    expect(issuePaths(taskContentZSchema.safeParse({ ...base, doneBy: USER }))).toEqual(["doneAt"]);
    expect(
      issuePaths(taskContentZSchema.safeParse({ ...base, doneAt: "2026-11-20T10:00:00Z", doneBy: USER })),
    ).toEqual([]);
  });
});

describe("taskState", () => {
  it.each([
    // LA is UTC-8 in November: 08:00Z is local midnight.
    [
      "done",
      task({ doneAt: "2026-11-19T10:00:00Z", dueOn: "2026-11-01" }),
      "2026-11-20T12:00:00Z",
      LA,
      "done",
    ],
    ["undated", task(), "2026-11-20T12:00:00Z", LA, "undated"],
    ["all day, before midnight", task({ dueOn: "2026-11-19" }), "2026-11-20T07:59:59Z", LA, "today"],
    ["all day, after midnight", task({ dueOn: "2026-11-19" }), "2026-11-20T08:00:00Z", LA, "overdue"],
    ["a later day", task({ dueOn: "2026-11-21" }), "2026-11-20T12:00:00Z", LA, "upcoming"],
    [
      "timed, at the time",
      task({ dueOn: "2026-11-20", dueTime: "09:00" }),
      "2026-11-20T17:00:00Z",
      LA,
      "today",
    ],
    [
      "timed, past it",
      task({ dueOn: "2026-11-20", dueTime: "09:00" }),
      "2026-11-20T17:00:01Z",
      LA,
      "overdue",
    ],
    // The same instant in two zones.
    ["LA, the evening before", task({ dueOn: "2026-11-20" }), "2026-11-20T06:00:00Z", LA, "upcoming"],
    ["New York, already the day", task({ dueOn: "2026-11-20" }), "2026-11-20T06:00:00Z", NY, "today"],
    // 2026-03-08: LA springs forward at 02:00 (02:30 never happens).
    [
      "DST, before the gap",
      task({ dueOn: "2026-03-08", dueTime: "02:30" }),
      "2026-03-08T09:59:00Z",
      LA,
      "today",
    ],
    [
      "DST, after the gap",
      task({ dueOn: "2026-03-08", dueTime: "02:30" }),
      "2026-03-08T10:00:00Z",
      LA,
      "overdue",
    ],
    // 2026-11-01: LA falls back; 17:00 is still 17:00 wall-clock (PST, 01:00Z next day).
    [
      "DST, wall clock kept",
      task({ dueOn: "2026-11-01", dueTime: "17:00" }),
      "2026-11-02T00:59:00Z",
      LA,
      "today",
    ],
  ])("%s", (_, t, now, zone, state) => {
    expect(taskState(t, now, zone)).toBe(state);
  });

  it("reads the wall clock in the zone", () => {
    expect(localTime("2026-11-20T17:05:09Z", LA)).toBe("09:05:09");
    expect(localTime("2026-11-20T05:00:00Z", NY)).toBe("00:00:00");
  });
});

describe("taskOrder and doneOrder", () => {
  const now = "2026-11-20T20:00:00Z"; // 12:00 in LA
  it("puts overdue first by due, then today (all-day before timed), later days, then undated newest first", () => {
    const tasks = [
      task({ id: "undated-old", createdAt: "2026-11-01T00:00:00Z" }),
      task({ id: "later", dueOn: "2026-11-22" }),
      task({ id: "today-15", dueOn: "2026-11-20", dueTime: "15:00" }),
      task({ id: "today-allday", dueOn: "2026-11-20" }),
      task({ id: "today-overdue", dueOn: "2026-11-20", dueTime: "09:00" }),
      task({ id: "undated-new", createdAt: "2026-11-10T00:00:00Z" }),
      task({ id: "overdue-old", dueOn: "2026-11-10" }),
      task({ id: "tomorrow-timed", dueOn: "2026-11-21", dueTime: "08:00" }),
      task({ id: "tomorrow-allday", dueOn: "2026-11-21" }),
    ];
    expect(taskOrder(tasks, now, LA).map((t) => t.id)).toEqual([
      "overdue-old",
      "today-overdue",
      "today-allday",
      "today-15",
      "tomorrow-allday",
      "tomorrow-timed",
      "later",
      "undated-new",
      "undated-old",
    ]);
  });

  it("orders done tasks newest first", () => {
    const tasks = [
      task({ id: "a", doneAt: "2026-11-18T10:00:00Z" }),
      task({ id: "b", doneAt: "2026-11-20T10:00:00Z" }),
      task({ id: "c", doneAt: "2026-11-19T10:00:00Z" }),
    ];
    expect(doneOrder(tasks).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });
});

describe("who", () => {
  it("reads the assignee", () => {
    expect(assigneeOf({ assigneeId: USER, assigneeName: null })).toEqual({ type: "member", userId: USER });
    expect(assigneeOf({ assigneeId: null, assigneeName: "Aunt May" })).toEqual({
      type: "name",
      name: "Aunt May",
    });
    expect(assigneeOf({ assigneeId: null, assigneeName: "  " })).toEqual({ type: "none" });
    expect(assigneeOf({ assigneeId: null, assigneeName: null })).toEqual({ type: "none" });
  });

  it.each([
    ["owner", { assigneeId: null }, true],
    ["admin", { assigneeId: OTHER }, true],
    ["caretaker", { assigneeId: null }, true],
    ["viewer", { assigneeId: USER }, true],
    ["viewer", { assigneeId: OTHER }, false],
    ["viewer", { assigneeId: null }, false],
    [null, { assigneeId: USER }, false],
  ] as const)("canCompleteTask: %s on %j", (role, t, expected) => {
    expect(canCompleteTask({ role, userId: USER, task: t })).toBe(expected);
  });

  it("never lets a viewer complete a typed name's task", () => {
    expect(canCompleteTask({ role: "viewer", userId: USER, task: { assigneeId: null } })).toBe(false);
    expect(canCompleteTask({ role: "caretaker", userId: USER, task: { assigneeId: null } })).toBe(true);
  });

  it("completionOnly: only the done fields may differ", () => {
    const before = { title: "Call", assigneeId: USER, dueOn: "2026-11-20", dueTime: null, doneAt: null };
    expect(completionOnly(before, { ...before, doneAt: "2026-11-20T10:00:00Z", doneBy: USER })).toBe(true);
    expect(completionOnly(before, { doneAt: null })).toBe(true);
    expect(completionOnly(before, { title: "Called" })).toBe(false);
    expect(completionOnly(before, { assigneeId: null })).toBe(false);
    expect(completionOnly(before, { dueTime: "" })).toBe(true);
    expect(completionOnly(before, { deletedAt: "2026-11-20T10:00:00Z" })).toBe(false);
  });
});
