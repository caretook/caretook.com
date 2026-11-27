import type { TodoTree, TodoTreeNode, TreeTodo } from "./todoTreeView";

import { describe, expect, it } from "vitest";
import { todoDayOf, todoDayTrees, todoTrees } from "./todoTreeView";

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
});
