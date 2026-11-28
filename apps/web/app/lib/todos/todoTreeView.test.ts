import type { TodoTree, TodoTreeNode, TreeTodo } from "./todoTreeView";

import { describe, expect, it } from "vitest";
import { todoSections } from "./todoList";
import { ancestorChain, splitTrees, todoDayOf, todoDayTrees, todoTrees } from "./todoTreeView";

// Fictional todos; "now" is Monday 2026-11-23 at noon in Los Angeles.
const ZONE = "America/Los_Angeles";
const NOW = new Date("2026-11-23T20:00:00.000Z");
const SUNDAY = "2026-11-22";
const TUESDAY = "2026-11-24";
const THURSDAY = "2026-11-26";
const FRIDAY = "2026-11-27";
const DONE = "2026-11-23T18:00:00.000Z";

let made = 0;
const todo = (id: string, v: Partial<TreeTodo> = {}): TreeTodo & { title: string } => ({
  id,
  title: id,
  assigneeId: null,
  assigneeName: null,
  dueOn: null,
  dueTime: null,
  doneAt: null,
  parentId: null,
  deletedAt: null,
  createdAt: `2026-11-01T00:00:${String(made++ % 60).padStart(2, "0")}.000Z`,
  ...v,
});

/** A tree as nested ids, context ones marked with `~`. */
type Shape = { [id: string]: Shape };
const shape = (nodes: readonly TodoTreeNode<{ id: string }>[]): Shape =>
  Object.fromEntries(nodes.map((n) => [`${n.context ? "~" : ""}${n.todo.id}`, shape(n.children)]));
const order = (trees: readonly TodoTree<{ id: string }>[]) => trees.map((t) => t.todo.id);
const build = (todos: TreeTodo[], more: Partial<Parameters<typeof todoTrees>[1]> = {}) =>
  todoTrees(todos, { now: NOW, timeZone: ZONE, ...more });

describe("todoTrees", () => {
  it("nests three levels, siblings in sibling order", () => {
    const trees = build([
      todo("move"),
      todo("pack", { parentId: "move" }),
      todo("boxes", { parentId: "pack", dueOn: FRIDAY }),
      todo("tape", { parentId: "pack", dueOn: THURSDAY }),
      todo("movers", { parentId: "move", dueOn: THURSDAY }),
    ]);
    expect(shape(trees)).toEqual({ move: { movers: {}, pack: { tape: {}, boxes: {} } } });
  });

  it("places a tree by its most urgent open todo: an overdue child puts it first", () => {
    const trees = build([
      todo("call"),
      todo("soon", { dueOn: THURSDAY }),
      todo("trip", { dueOn: FRIDAY }),
      todo("tickets", { parentId: "trip", dueOn: SUNDAY }),
    ]);
    expect(order(trees)).toEqual(["trip", "soon", "call"]);
    expect(trees[0]?.lead?.id).toBe("tickets");
    expect(todoDayOf(trees[0]!.lead!, NOW, ZONE)).toBe("overdue");
  });

  it("keeps a matching grandchild's parent and grandparent as context and drops the rest", () => {
    const trees = build(
      [
        todo("move"),
        todo("pack", { parentId: "move" }),
        todo("boxes", { parentId: "pack", assigneeName: "Aunt May" }),
        todo("tape", { parentId: "pack" }),
        todo("movers", { parentId: "move" }),
        todo("other"),
      ],
      { matches: (t) => t.assigneeName === "Aunt May" },
    );
    expect(shape(trees)).toEqual({ "~move": { "~pack": { boxes: {} } } });
    expect(trees[0]?.lead?.id).toBe("boxes");
  });

  it("keeps a match's whole subtree", () => {
    const trees = build(
      [todo("move"), todo("pack", { parentId: "move" }), todo("tape", { parentId: "pack" })],
      {
        matches: (t) => t.id === "pack",
      },
    );
    expect(shape(trees)).toEqual({ "~move": { pack: { tape: {} } } });
  });

  it("keeps done children in their place and leaves out deleted ones", () => {
    const trees = build([
      todo("move"),
      todo("first", { parentId: "move", doneAt: DONE }),
      todo("second", { parentId: "move" }),
      todo("third", { parentId: "move", doneAt: DONE }),
      todo("gone", { parentId: "move", deletedAt: DONE }),
    ]);
    expect(shape(trees)).toEqual({ move: { first: {}, second: {}, third: {} } });
  });

  it("puts trees with nothing open last", () => {
    const trees = build([todo("finished", { doneAt: DONE, dueOn: SUNDAY }), todo("open")]);
    expect(order(trees)).toEqual(["open", "finished"]);
    expect(trees[1]?.lead).toBeNull();
  });

  it("with rootId gives one todo's descendants", () => {
    const trees = build(
      [
        todo("move"),
        todo("pack", { parentId: "move" }),
        todo("tape", { parentId: "pack" }),
        todo("movers", { parentId: "move", dueOn: FRIDAY }),
        todo("other"),
      ],
      { rootId: "move" },
    );
    expect(shape(trees)).toEqual({ movers: {}, pack: { tape: {} } });
  });
});

describe("splitTrees", () => {
  const NEXT_WEEK = "2026-11-30";
  const split = (todos: TreeTodo[], matches?: (t: TreeTodo) => boolean) =>
    splitTrees(todos, { now: NOW, timeZone: ZONE, ...(matches ? { matches } : {}) });

  it("places a subtask by its own due: an overdue step under Overdue, its parent next week", () => {
    const trees = split([
      todo("hospital", { dueOn: NEXT_WEEK }),
      todo("forms", { parentId: "hospital", dueOn: SUNDAY }),
    ]);
    expect(shape(trees)).toEqual({ forms: {}, hospital: {} });
    for (const tree of trees) expect(tree.lead).toBe(tree.todo);
    expect(todoSections(trees, NOW, ZONE).map((s) => [s.key, s.trees.map((t) => t.todo.id)])).toEqual([
      ["overdue", ["forms"]],
      [NEXT_WEEK, ["hospital"]],
    ]);
  });

  it("leaves out done and deleted todos", () => {
    const trees = split([
      todo("move"),
      todo("boxes", { parentId: "move", doneAt: DONE }),
      todo("tape", { parentId: "move", deletedAt: DONE }),
      todo("finished", { doneAt: DONE }),
    ]);
    expect(order(trees)).toEqual(["move"]);
  });

  it("keeps a match without its ancestors: under Mine, a parent assigned to you lists alone", () => {
    const mine = (t: TreeTodo) => t.assigneeId === "me";
    const trees = split(
      [
        todo("party", { assigneeId: "me" }),
        todo("cake", { parentId: "party", assigneeId: "aunt" }),
        todo("trip"),
        todo("tickets", { parentId: "trip", assigneeId: "me", dueOn: FRIDAY }),
      ],
      mine,
    );
    expect(shape(trees)).toEqual({ tickets: {}, party: {} });
    expect(trees.every((t) => !t.context)).toBe(true);
  });

  it("orders by todoOrder: overdue, by day and time, undated last", () => {
    const trees = split([
      todo("later", { dueOn: FRIDAY }),
      todo("undated"),
      todo("soon", { parentId: "later", dueOn: THURSDAY, dueTime: "15:00" }),
      todo("sooner", { parentId: "later", dueOn: THURSDAY, dueTime: "09:00" }),
      todo("late", { parentId: "soon", dueOn: SUNDAY }),
    ]);
    expect(order(trees)).toEqual(["late", "sooner", "soon", "later", "undated"]);
  });
});

describe("ancestorChain", () => {
  const rows = [todo("trip"), todo("packing", { parentId: "trip" }), todo("socks", { parentId: "packing" })];
  const byId = new Map(rows.map((t) => [t.id, t]));
  const parentOf = (id: string) => byId.get(id);
  const chain = (t: TreeTodo) => ancestorChain(t, parentOf).map((p) => p.id);

  it("walks a split row's parents up the rows read: nothing for a top-level todo", () => {
    expect(chain(rows[0]!)).toEqual([]);
    expect(chain(rows[1]!)).toEqual(["trip"]);
    expect(chain(rows[2]!)).toEqual(["packing", "trip"]);
  });

  it("stops at a parent the rows don't have, and at MAX_TODO_DEPTH on a loop", () => {
    expect(chain(todo("lost", { parentId: "gone" }))).toEqual([]);
    const loop = new Map([
      ["a", todo("a", { parentId: "b" })],
      ["b", todo("b", { parentId: "a" })],
    ]);
    expect(ancestorChain(todo("x", { parentId: "a" }), (id) => loop.get(id))).toHaveLength(3);
  });
});

describe("todoDayTrees", () => {
  const hospital = [
    todo("hospital", { dueOn: FRIDAY }),
    todo("bag", { parentId: "hospital", dueOn: TUESDAY }),
    todo("sitter", { parentId: "hospital", dueOn: THURSDAY }),
    todo("charger", { parentId: "bag" }),
    todo("list", { parentId: "hospital" }),
  ];

  it("gives a Friday parent its whole tree on Friday, its Tuesday step's branch on Tuesday", () => {
    const trees = build(hospital);
    expect(shape(todoDayTrees(trees, FRIDAY, NOW, ZONE))).toEqual({
      hospital: { bag: { charger: {} }, sitter: {}, list: {} },
    });
    const tuesday = todoDayTrees(trees, TUESDAY, NOW, ZONE);
    expect(shape(tuesday)).toEqual({ "~hospital": { bag: { charger: {} } } });
    expect(tuesday[0]?.lead?.id).toBe("bag");
    expect(shape(todoDayTrees(trees, THURSDAY, NOW, ZONE))).toEqual({ "~hospital": { sitter: {} } });
  });

  it("puts an overdue step's branch under Overdue, not on its day", () => {
    const trees = build([...hospital, todo("forms", { parentId: "hospital", dueOn: SUNDAY })]);
    expect(shape(todoDayTrees(trees, "overdue", NOW, ZONE))).toEqual({ "~hospital": { forms: {} } });
    expect(todoDayTrees(trees, SUNDAY, NOW, ZONE)).toEqual([]);
  });

  it("puts an overdue top-level todo's whole tree under Overdue", () => {
    const trees = build([
      todo("renew", { dueOn: SUNDAY }),
      todo("photo", { parentId: "renew", dueOn: FRIDAY }),
    ]);
    expect(shape(todoDayTrees(trees, "overdue", NOW, ZONE))).toEqual({ renew: { photo: {} } });
    expect(shape(todoDayTrees(trees, FRIDAY, NOW, ZONE))).toEqual({ "~renew": { photo: {} } });
  });

  it("shows an undated parent's dated step as a branch on its day, and nothing on a day with nothing due", () => {
    const trees = build([
      todo("move"),
      todo("movers", { parentId: "move", dueOn: THURSDAY }),
      todo("tape", { parentId: "move" }),
    ]);
    expect(shape(todoDayTrees(trees, THURSDAY, NOW, ZONE))).toEqual({ "~move": { movers: {} } });
    expect(todoDayTrees(trees, FRIDAY, NOW, ZONE)).toEqual([]);
  });

  it("leaves out a done step", () => {
    const trees = build([todo("move"), todo("movers", { parentId: "move", dueOn: THURSDAY, doneAt: DONE })]);
    expect(todoDayTrees(trees, THURSDAY, NOW, ZONE)).toEqual([]);
  });

  it("under a filter, a match due the same day as its unmatched parent leads at its own time (B-974)", () => {
    const trees = build(
      [
        todo("hospital", { dueOn: FRIDAY, dueTime: "09:00" }),
        todo("bag", { parentId: "hospital", dueOn: FRIDAY, dueTime: "15:00" }),
        todo("list", { parentId: "hospital", dueOn: FRIDAY, dueTime: "08:00" }),
      ],
      { matches: (t) => t.id === "bag" },
    );
    const friday = todoDayTrees(trees, FRIDAY, NOW, ZONE);
    expect(shape(friday)).toEqual({ "~hospital": { bag: {} } });
    expect(friday[0]?.lead?.id).toBe("bag");
    // A context row due that day with no match due then places nothing.
    const other = build(
      [todo("trip", { dueOn: FRIDAY }), todo("sitter", { parentId: "trip", dueOn: TUESDAY })],
      { matches: (t) => t.id === "sitter" },
    );
    expect(todoDayTrees(other, FRIDAY, NOW, ZONE)).toEqual([]);
  });
});
