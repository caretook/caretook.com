import { describe, expect, it } from "vitest";
import { upcomingSections } from "../appointments/upcomingDays";
import type { TodoTreeNode } from "./todoTreeView";

import { isPlannerTree, plannerDayTrees, showsTodos, withDueTodos } from "./plannerTodos";
import { splitTrees, todoTrees } from "./todoTreeView";
import type { TodoRuleFields } from "@caretook/data/domain";

const LA = "America/Los_Angeles";
const NY = "America/New_York";
// Wednesday, Nov 18, 2026, 10:00 AM in Los Angeles.
const NOW = new Date("2026-11-18T18:00:00.000Z");

const todo = (
  id: string,
  dueOn: string | null,
  dueTime: string | null = null,
  extra: Partial<TodoRuleFields> = {},
) => ({
  id,
  assigneeId: null,
  assigneeName: null,
  dueOn,
  dueTime,
  doneAt: null,
  createdAt: "2026-11-10T12:00:00.000Z",
  ...extra,
});

type Item = { id: string; occurredAt: string; timeZone: string; allDay?: boolean; endsAt?: string | null };
const entry = (id: string, occurredAt: string, extra: Partial<Item> = {}): Item => ({
  id,
  occurredAt,
  timeZone: LA,
  ...extra,
});

const keyOf = (i: object) => ("key" in i ? (i as { key: string }).key : (i as Item).id);
const shape = (sections: { label: string; items: object[] }[]) =>
  sections.map((s) => [s.label, s.items.map(keyOf)]);

/** Each todo as a one-todo tree's day items, in the order given. */
const dueItems = (todos: ReturnType<typeof todo>[], now: Date, timeZone: string) =>
  todos.flatMap((t) =>
    plannerDayTrees(todoTrees([{ ...t, parentId: null, deletedAt: null }], { now, timeZone }), now, timeZone),
  );

describe("withDueTodos", () => {
  const place = (
    entries: Item[],
    todos: ReturnType<typeof todo>[],
    { viewer = LA, recipient = LA, now = NOW } = {},
  ) =>
    withDueTodos(
      upcomingSections(entries, now, viewer),
      dueItems(todos, now, recipient),
      now,
      viewer,
      recipient,
    ).map((s) => [s.label, s.items.map((i) => (isPlannerTree(i) ? `todo:${i.todo.id}` : i.id))]);

  it("puts overdue todos first under Today, never under Now", () => {
    const visit = entry("visit", "2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T19:00:00.000Z" });
    const lunch = entry("lunch", "2026-11-18T20:00:00.000Z");
    expect(
      place(
        [visit, lunch],
        [todo("a", "2026-11-15"), todo("b", "2026-11-17"), todo("c", "2026-11-18", "08:00")],
      ),
    ).toEqual([
      ["Now", ["visit"]],
      ["Today", ["todo:a", "todo:b", "todo:c", "lunch"]],
    ]);
  });

  it("makes a Today section for an overdue todo when nothing else is today, after Now and before later days", () => {
    const visit = entry("visit", "2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T19:00:00.000Z" });
    const friday = entry("friday", "2026-11-20T18:00:00.000Z");
    expect(place([visit, friday], [todo("a", "2026-11-17")])).toEqual([
      ["Now", ["visit"]],
      ["Today", ["todo:a"]],
      ["Friday, Nov 20", ["friday"]],
    ]);
  });

  it("within a day: all-day entries, then all-day todos, then timed items by time (a todo after an item at the same time)", () => {
    const allDay = entry("allday", "2026-11-20T08:00:00.000Z", { allDay: true });
    const nine = entry("nine", "2026-11-20T17:00:00.000Z"); // 9:00 AM
    const noon = entry("noon", "2026-11-20T20:00:00.000Z"); // 12:00 PM
    expect(
      place(
        [allDay, nine, noon],
        [
          todo("at-noon", "2026-11-20", "12:00"),
          todo("at-ten", "2026-11-20", "10:00"),
          todo("whole-day", "2026-11-20"),
        ],
      ),
    ).toEqual([
      ["Friday, Nov 20", ["allday", "todo:whole-day", "nine", "todo:at-ten", "noon", "todo:at-noon"]],
    ]);
  });

  it("gives a day with only todos its own section, in day order", () => {
    const monday = entry("monday", "2026-11-23T18:00:00.000Z");
    expect(place([monday], [todo("tomorrow", "2026-11-19"), todo("sat", "2026-11-21", "09:00")])).toEqual([
      ["Tomorrow", ["todo:tomorrow"]],
      ["Saturday, Nov 21", ["todo:sat"]],
      ["Monday, Nov 23", ["monday"]],
    ]);
  });

  it("keeps the given order among todos at the same place", () => {
    expect(place([], [todo("first", "2026-11-19"), todo("second", "2026-11-19")])).toEqual([
      ["Tomorrow", ["todo:first", "todo:second"]],
    ]);
  });

  it("places a timed todo by the moment it falls where the viewer is; an all-day one on its own day", () => {
    // Recipient in New York: 23:30 there on Thursday is 8:30 PM Thursday in LA,
    // and 00:30 Friday there is 9:30 PM Thursday in LA.
    expect(
      place(
        [],
        [
          todo("late-thu", "2026-11-19", "23:30"),
          todo("fri-early", "2026-11-20", "00:30"),
          todo("fri", "2026-11-20"),
        ],
        {
          recipient: NY,
        },
      ),
    ).toEqual([
      ["Tomorrow", ["todo:late-thu", "todo:fri-early"]],
      ["Friday, Nov 20", ["todo:fri"]],
    ]);
  });

  it("puts nothing in Now and leaves the sections alone with no todos", () => {
    const visit = entry("visit", "2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T19:00:00.000Z" });
    expect(place([visit], [])).toEqual([["Now", ["visit"]]]);
  });
});

describe("showsTodos", () => {
  it("shows todos only without a kind or author filter", () => {
    expect(showsTodos({})).toBe(true);
    expect(showsTodos({ kind: null, author: null })).toBe(true);
    expect(showsTodos({ kind: "event" })).toBe(false);
    expect(showsTodos({ author: "u1" })).toBe(false);
  });
});

describe("plannerDayTrees (todo-subtasks-3)", () => {
  const TUESDAY = "2026-11-24";
  const FRIDAY = "2026-11-27";
  const node = (id: string, dueOn: string | null, parentId: string | null = null) => ({
    ...todo(id, dueOn),
    parentId,
    deletedAt: null,
  });
  const trees = (todos: ReturnType<typeof node>[]) => todoTrees(todos, { now: NOW, timeZone: LA });
  /** A tree as nested ids, context ones marked with `~`. */
  type Shape = { [id: string]: Shape };
  const treeShape = (n: TodoTreeNode<{ id: string }>): Shape => ({
    [`${n.context ? "~" : ""}${n.todo.id}`]: Object.assign({}, ...n.children.map(treeShape)) as Shape,
  });
  const items = (todos: ReturnType<typeof node>[], through?: string) =>
    plannerDayTrees(trees(todos), NOW, LA, { through }).map((i) => [
      i.day,
      i.state,
      i.todo.id,
      treeShape(i.tree),
    ]);

  it("a Friday parent with a Tuesday step: the whole tree on Friday, the step's branch on Tuesday", () => {
    const todos = [node("trip", FRIDAY), node("sitter", TUESDAY, "trip"), node("pack", null, "trip")];
    expect(items(todos)).toEqual([
      [TUESDAY, "upcoming", "sitter", { "~trip": { sitter: {} } }],
      [FRIDAY, "upcoming", "trip", { trip: { sitter: {}, pack: {} } }],
    ]);
    const [first] = plannerDayTrees(trees(todos), NOW, LA);
    expect(first?.key).toBe(`tree:trip:${TUESDAY}`);
    expect(first && isPlannerTree(first)).toBe(true);
  });

  it("an overdue step's branch sits with the overdue items, first under today", () => {
    const todos = [node("trip", FRIDAY), node("forms", "2026-11-16", "trip")];
    expect(items(todos)).toEqual([
      ["overdue", "overdue", "forms", { "~trip": { forms: {} } }],
      [FRIDAY, "upcoming", "trip", { trip: { forms: {} } }],
    ]);
    const sections = withDueTodos(
      upcomingSections([entry("visit", "2026-11-18T19:00:00.000Z")], NOW, LA),
      plannerDayTrees(trees(todos), NOW, LA),
      NOW,
      LA,
      LA,
    );
    expect(shape(sections)).toEqual([
      ["Today", [`tree:trip:overdue`, "visit"]],
      ["Friday, Nov 27", [`tree:trip:${FRIDAY}`]],
    ]);
  });

  it("an undated tree with no dated step gives nothing; with one, only that step's branch", () => {
    expect(items([node("move", null), node("boxes", null, "move")])).toEqual([]);
    expect(items([node("move", null), node("boxes", null, "move"), node("movers", TUESDAY, "move")])).toEqual(
      [[TUESDAY, "upcoming", "movers", { "~move": { movers: {} } }]],
    );
  });

  it("drops the days after `through`, keeping overdue", () => {
    const todos = [
      node("trip", FRIDAY),
      node("sitter", TUESDAY, "trip"),
      node("forms", "2026-11-16", "trip"),
    ];
    expect(items(todos, "2026-11-25").map(([day]) => day)).toEqual(["overdue", TUESDAY]);
  });

  it("a match's context rows place no tree", () => {
    const matched = todoTrees([node("trip", FRIDAY), node("sitter", TUESDAY, "trip")], {
      now: NOW,
      timeZone: LA,
      matches: (t) => t.id === "sitter",
    });
    expect(plannerDayTrees(matched, NOW, LA).map((i) => i.day)).toEqual([TUESDAY]);
  });
});

describe("plannerDayTrees over splitTrees (todo-links-2)", () => {
  const TUESDAY = "2026-11-24";
  const FRIDAY = "2026-11-27";
  const node = (id: string, dueOn: string | null, parentId: string | null = null, done = false) => ({
    ...todo(id, dueOn, null, done ? { doneAt: "2026-11-17T12:00:00.000Z" } : {}),
    parentId,
    deletedAt: null,
  });
  const split = (todos: ReturnType<typeof node>[]) =>
    plannerDayTrees(splitTrees(todos, { now: NOW, timeZone: LA }), NOW, LA);

  it("a step due on another day than its parent is its own item on its day, led by itself; the parent alone on its own", () => {
    const todos = [
      node("trip", FRIDAY),
      node("sitter", TUESDAY, "trip"),
      node("pack", null, "trip"),
      node("passport", TUESDAY, "trip", true),
    ];
    const items = split(todos);
    expect(items.map((i) => [i.day, i.key, i.todo.id, i.tree.todo.id, i.tree.children.length])).toEqual([
      [TUESDAY, `tree:sitter:${TUESDAY}`, "sitter", "sitter", 0],
      [FRIDAY, `tree:trip:${FRIDAY}`, "trip", "trip", 0],
    ]);
    for (const item of items) {
      expect(item.tree.lead).toBe(item.todo);
      expect(item.tree.context).toBe(false);
    }
  });

  it("an overdue step goes first under today, its parent on its own day", () => {
    const items = split([node("trip", FRIDAY), node("forms", "2026-11-16", "trip")]);
    const sections = withDueTodos(upcomingSections([], NOW, LA), items, NOW, LA, LA);
    expect(shape(sections)).toEqual([
      ["Today", ["tree:forms:overdue"]],
      ["Friday, Nov 27", [`tree:trip:${FRIDAY}`]],
    ]);
  });
});
