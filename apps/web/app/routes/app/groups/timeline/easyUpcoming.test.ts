import type { TreeTodo } from "../../../../lib/todos/todoTreeView";

import { describe, expect, it } from "vitest";
import { isPlannerTree } from "../../../../lib/todos/plannerTodos";
import { upcomingQueries } from "../planner/upcomingQueries";
import { EASY_UPCOMING_CAP, easyUpcomingItems, easyUpcomingQuery } from "./easyUpcoming";

const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const LA = "America/Los_Angeles";
const HOUR = 3_600_000;
const DAY = 86_400_000;
const NO_TODOS: TreeTodo[] = [];
const NOW = new Date("2026-11-18T18:00:42.000Z");

const event = (id: string, startsIn: number, lasts = HOUR) => ({
  id,
  occurredAt: new Date(NOW.getTime() + startsIn).toISOString(),
  endsAt: new Date(NOW.getTime() + startsIn + lasts).toISOString(),
  timeZone: LA,
  allDay: false,
  cancelledAt: null,
});

const ids = (at: Date, entries: ReturnType<typeof event>[]) =>
  easyUpcomingItems(entries, NO_TODOS, at, LA, LA).map((item) => ("id" in item ? item.id : item.key));

describe("easyUpcomingQuery", () => {
  const key = (at: string) => JSON.stringify(easyUpcomingQuery(GROUP, new Date(at)));

  it("stays the same query as the clock ticks, so a tick reruns nothing (B-963)", () => {
    const at = key("2026-11-18T18:00:42.000Z");
    expect(key("2026-11-18T18:01:12.000Z")).toBe(at);
    expect(key("2026-11-18T23:59:59.999Z")).toBe(at);
    expect(key("2026-11-19T00:00:00.000Z")).not.toBe(at);
  });

  it("is the Planner's unfiltered Upcoming query, so the two share one watch", () => {
    expect(easyUpcomingQuery(GROUP, NOW)).toEqual(
      upcomingQueries(GROUP, { kind: null, author: null }, NOW).entries,
    );
  });
});

describe("easyUpcomingItems", () => {
  it("drops an event once it has passed, on the tick, from the same rows", () => {
    const rows = [event("soon", HOUR), event("later", 3 * HOUR)];
    expect(ids(NOW, rows)).toEqual(["soon", "later"]);
    expect(ids(new Date(NOW.getTime() + 2 * HOUR + 1), rows)).toEqual(["later"]);
  });

  it("keeps the horizon at now's, though the query reads a day further", () => {
    const rows = [event("in", 90 * DAY - 1), event("out", 90 * DAY)];
    expect(ids(NOW, rows)).toEqual(["in"]);
  });

  it("lists at most the cap", () => {
    const rows = Array.from({ length: EASY_UPCOMING_CAP + 2 }, (_, i) => event(`e${i}`, (i + 1) * HOUR));
    expect(ids(NOW, rows)).toHaveLength(EASY_UPCOMING_CAP);
  });
});

describe("easyUpcomingItems' todos (todo-subtasks-3)", () => {
  const node = (id: string, dueOn: string | null, parentId: string | null = null): TreeTodo => ({
    id,
    assigneeId: null,
    assigneeName: null,
    dueOn,
    dueTime: null,
    doneAt: null,
    createdAt: "2026-11-10T12:00:00.000Z",
    parentId,
    deletedAt: null,
  });

  it("lists a parent's tree on its day, and a step's branch on the step's, through the horizon", () => {
    const todos = [
      node("trip", "2026-11-20"),
      node("pack", null, "trip"),
      node("tickets", "2026-11-19", "trip"),
      node("later", "2026-12-30"),
    ];
    // No entries: every item is a day tree.
    const items = easyUpcomingItems([], todos, NOW, LA, LA, "2026-11-25").filter((item) =>
      isPlannerTree(item),
    );
    expect(items.map((item) => item.key)).toEqual(["tree:trip:2026-11-19", "tree:trip:2026-11-20"]);
    const [step, whole] = items;
    expect(step?.tree.context).toBe(true);
    expect(step?.tree.children.map((c) => c.todo.id)).toEqual(["tickets"]);
    expect(whole?.tree.children.map((c) => c.todo.id).sort()).toEqual(["pack", "tickets"]);
  });
});
