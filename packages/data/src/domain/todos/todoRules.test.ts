import { describe, expect, it } from "vitest";
import {
  todoContentZSchema,
  todoCreateZSchema,
  todoOccurrenceZSchema,
  todoUpdateZSchema,
} from "../../db/schema/todos/todo";
import {
  assigneeOf,
  canCompleteTodo,
  completionOnly,
  doneOrder,
  localTime,
  repeatColumnsFor,
  todoOrder,
  todoRepeatText,
  todoState,
} from "./todoRules";

const LA = "America/Los_Angeles";
const NY = "America/New_York";
const GROUP = "8f7f1d1e-0000-4000-8000-000000000001";
const USER = "8f7f1d1e-0000-4000-8000-0000000000aa";
const OTHER = "8f7f1d1e-0000-4000-8000-0000000000bb";

type T = Parameters<typeof todoOrder>[0][number];
const todo = (overrides: Partial<T> = {}): T => ({
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

describe("todo schemas", () => {
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
    expect(issuePaths(todoCreateZSchema.safeParse({ groupId: GROUP, ...fields }))).toEqual(paths);
  });

  it("trims, and turns empty optional text into null", () => {
    const parsed = todoCreateZSchema.parse({ groupId: GROUP, title: "  Call  ", assigneeName: "  " });
    expect(parsed).toMatchObject({ title: "Call", assigneeName: null, dueOn: null, dueTime: null });
  });

  it("needs both done fields or neither", () => {
    const base = { title: "x" };
    expect(issuePaths(todoContentZSchema.safeParse({ ...base, doneAt: "2026-11-20T10:00:00Z" }))).toEqual([
      "doneAt",
    ]);
    expect(issuePaths(todoContentZSchema.safeParse({ ...base, doneBy: USER }))).toEqual(["doneAt"]);
    expect(
      issuePaths(todoContentZSchema.safeParse({ ...base, doneAt: "2026-11-20T10:00:00Z", doneBy: USER })),
    ).toEqual([]);
  });
});

describe("todoState", () => {
  it.each([
    // LA is UTC-8 in November: 08:00Z is local midnight.
    [
      "done",
      todo({ doneAt: "2026-11-19T10:00:00Z", dueOn: "2026-11-01" }),
      "2026-11-20T12:00:00Z",
      LA,
      "done",
    ],
    ["undated", todo(), "2026-11-20T12:00:00Z", LA, "undated"],
    ["all day, before midnight", todo({ dueOn: "2026-11-19" }), "2026-11-20T07:59:59Z", LA, "today"],
    ["all day, after midnight", todo({ dueOn: "2026-11-19" }), "2026-11-20T08:00:00Z", LA, "overdue"],
    ["a later day", todo({ dueOn: "2026-11-21" }), "2026-11-20T12:00:00Z", LA, "upcoming"],
    [
      "timed, at the time",
      todo({ dueOn: "2026-11-20", dueTime: "09:00" }),
      "2026-11-20T17:00:00Z",
      LA,
      "today",
    ],
    [
      "timed, past it",
      todo({ dueOn: "2026-11-20", dueTime: "09:00" }),
      "2026-11-20T17:00:01Z",
      LA,
      "overdue",
    ],
    // The same instant in two zones.
    ["LA, the evening before", todo({ dueOn: "2026-11-20" }), "2026-11-20T06:00:00Z", LA, "upcoming"],
    ["New York, already the day", todo({ dueOn: "2026-11-20" }), "2026-11-20T06:00:00Z", NY, "today"],
    // 2026-03-08: LA springs forward at 02:00 (02:30 never happens).
    [
      "DST, before the gap",
      todo({ dueOn: "2026-03-08", dueTime: "02:30" }),
      "2026-03-08T09:59:00Z",
      LA,
      "today",
    ],
    [
      "DST, after the gap",
      todo({ dueOn: "2026-03-08", dueTime: "02:30" }),
      "2026-03-08T10:00:00Z",
      LA,
      "overdue",
    ],
    // 2026-11-01: LA falls back; 17:00 is still 17:00 wall-clock (PST, 01:00Z next day).
    [
      "DST, wall clock kept",
      todo({ dueOn: "2026-11-01", dueTime: "17:00" }),
      "2026-11-02T00:59:00Z",
      LA,
      "today",
    ],
  ])("%s", (_, t, now, zone, state) => {
    expect(todoState(t, now, zone)).toBe(state);
  });

  it("reads the wall clock in the zone", () => {
    expect(localTime("2026-11-20T17:05:09Z", LA)).toBe("09:05:09");
    expect(localTime("2026-11-20T05:00:00Z", NY)).toBe("00:00:00");
  });
});

describe("todoOrder and doneOrder", () => {
  const now = "2026-11-20T20:00:00Z"; // 12:00 in LA
  it("puts overdue first by due, then today (all-day before timed), later days, then undated newest first", () => {
    const todos = [
      todo({ id: "undated-old", createdAt: "2026-11-01T00:00:00Z" }),
      todo({ id: "later", dueOn: "2026-11-22" }),
      todo({ id: "today-15", dueOn: "2026-11-20", dueTime: "15:00" }),
      todo({ id: "today-allday", dueOn: "2026-11-20" }),
      todo({ id: "today-overdue", dueOn: "2026-11-20", dueTime: "09:00" }),
      todo({ id: "undated-new", createdAt: "2026-11-10T00:00:00Z" }),
      todo({ id: "overdue-old", dueOn: "2026-11-10" }),
      todo({ id: "tomorrow-timed", dueOn: "2026-11-21", dueTime: "08:00" }),
      todo({ id: "tomorrow-allday", dueOn: "2026-11-21" }),
    ];
    expect(todoOrder(todos, now, LA).map((t) => t.id)).toEqual([
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

  it("orders done todos newest first", () => {
    const todos = [
      todo({ id: "a", doneAt: "2026-11-18T10:00:00Z" }),
      todo({ id: "b", doneAt: "2026-11-20T10:00:00Z" }),
      todo({ id: "c", doneAt: "2026-11-19T10:00:00Z" }),
    ];
    expect(doneOrder(todos).map((t) => t.id)).toEqual(["b", "c", "a"]);
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
    ["easy_helper", { assigneeId: USER }, true],
    ["easy_helper", { assigneeId: OTHER }, false],
    ["easy_helper", { assigneeId: null }, false],
    ["easy_viewer", { assigneeId: USER }, true],
    ["easy_viewer", { assigneeId: OTHER }, false],
    ["easy_viewer", { assigneeId: null }, false],
    [null, { assigneeId: USER }, false],
  ] as const)("canCompleteTodo: %s on %j", (role, t, expected) => {
    expect(canCompleteTodo({ role, userId: USER, todo: t })).toBe(expected);
  });

  it("never lets a viewer complete a typed name's todo", () => {
    expect(canCompleteTodo({ role: "viewer", userId: USER, todo: { assigneeId: null } })).toBe(false);
    expect(canCompleteTodo({ role: "caretaker", userId: USER, todo: { assigneeId: null } })).toBe(true);
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

describe("repeats", () => {
  const WEEKLY = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO";
  const issues = (res: {
    success: boolean;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  }) => (res.success ? [] : res.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`));

  it("a repeat needs a due day and a rule Caretook writes; empty is none", () => {
    expect(
      issues(todoCreateZSchema.safeParse({ groupId: GROUP, title: "Bins", repeatRule: WEEKLY })),
    ).toEqual(["repeatRule: Choose a due day to repeat"]);
    expect(
      issues(
        todoCreateZSchema.safeParse({
          groupId: GROUP,
          title: "Bins",
          dueOn: "2026-11-16",
          repeatRule: "FREQ=HOURLY",
        }),
      ),
    ).toEqual(["repeatRule: Choose daily, weekly or monthly"]);
    const ok = todoCreateZSchema.parse({
      groupId: GROUP,
      title: "Bins",
      dueOn: "2026-11-16",
      repeatRule: ` ${WEEKLY} `,
    });
    expect(ok.repeatRule).toBe(WEEKLY);
    expect(todoCreateZSchema.parse({ groupId: GROUP, title: "Bins", repeatRule: "" }).repeatRule).toBeNull();
    // Clearing the due day of a repeating todo is refused on the merged row.
    expect(issues(todoContentZSchema.safeParse({ title: "Bins", dueOn: null, repeatRule: WEEKLY }))).toEqual([
      "repeatRule: Choose a due day to repeat",
    ]);
    expect(todoUpdateZSchema.safeParse({ repeatRule: null }).success).toBe(true);
  });

  it("an uploaded occurrence must repeat, with its chain and anchor", () => {
    const base = { id: GROUP, groupId: GROUP, title: "Bins", dueOn: "2026-11-23" };
    expect(
      issues(todoOccurrenceZSchema.safeParse({ ...base, repeatStartsOn: "2026-11-16", repeatId: USER })),
    ).toEqual(["repeatRule: Not a repeat"]);
    expect(
      todoOccurrenceZSchema.safeParse({
        ...base,
        repeatRule: WEEKLY,
        repeatStartsOn: "2026-11-16",
        repeatId: USER,
      }).success,
    ).toBe(true);
  });

  it("repeatColumnsFor: a new repeat starts a chain on the todo; a rule or day change moves the anchor; clearing clears all three", () => {
    const none = { repeatRule: null, repeatStartsOn: null, repeatId: null };
    expect(
      repeatColumnsFor("a", { dueOn: "2026-11-16", ...none }, { repeatRule: WEEKLY, dueOn: "2026-11-16" }),
    ).toEqual({
      repeatRule: WEEKLY,
      repeatStartsOn: "2026-11-16",
      repeatId: "a",
    });
    expect(repeatColumnsFor("a", null, { repeatRule: WEEKLY, dueOn: "2026-11-16" }).repeatId).toBe("a");
    const chain = {
      dueOn: "2026-11-23",
      repeatRule: WEEKLY,
      repeatStartsOn: "2026-11-16",
      repeatId: "first",
    };
    // Unchanged (a title edit): all kept.
    expect(repeatColumnsFor("b", chain, { repeatRule: WEEKLY, dueOn: "2026-11-23" })).toEqual({
      repeatRule: WEEKLY,
      repeatStartsOn: "2026-11-16",
      repeatId: "first",
    });
    // A new due day or rule: the anchor moves to the due day; the chain stays.
    expect(repeatColumnsFor("b", chain, { repeatRule: WEEKLY, dueOn: "2026-11-24" })).toEqual({
      repeatRule: WEEKLY,
      repeatStartsOn: "2026-11-24",
      repeatId: "first",
    });
    const fortnightly = "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO";
    expect(repeatColumnsFor("b", chain, { repeatRule: fortnightly, dueOn: "2026-11-23" })).toEqual({
      repeatRule: fortnightly,
      repeatStartsOn: "2026-11-23",
      repeatId: "first",
    });
    expect(repeatColumnsFor("b", chain, { repeatRule: null, dueOn: "2026-11-23" })).toEqual(none);
  });

  it("todoRepeatText says the rule with the due time, or null", () => {
    expect(todoRepeatText({ dueTime: "19:00", repeatRule: WEEKLY, repeatStartsOn: "2026-11-16" })).toBe(
      "Every Mon at 19:00",
    );
    expect(todoRepeatText({ dueTime: null, repeatRule: "FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR" })).toBe(
      "Monthly on the last Friday",
    );
    expect(todoRepeatText({ dueTime: null, repeatRule: null })).toBeNull();
  });

  it("completionOnly: a viewer can't change the repeat", () => {
    const before = { title: "Bins", repeatRule: WEEKLY, repeatStartsOn: "2026-11-16", repeatId: USER };
    expect(completionOnly(before, { repeatRule: null })).toBe(false);
    expect(completionOnly(before, { repeatRule: WEEKLY, doneAt: "x" })).toBe(true);
  });
});
