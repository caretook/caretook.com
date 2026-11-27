import type { TodoTreeNode, TreeTodo } from "../../../../lib/todos/todoTreeView";

import { describe, expect, it } from "vitest";
import { EASY_TODOS_CAP, easyTodoTrees } from "./easyTodoTrees";

// Fictional todos; "now" is Monday 2026-11-23 at noon in Los Angeles.
const ZONE = "America/Los_Angeles";
const NOW = new Date("2026-11-23T20:00:00.000Z");
const ME = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7a01";
const SAM = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7a02";

let made = 0;
const todo = (id: string, v: Partial<TreeTodo> = {}): TreeTodo => ({
  id,
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
const mine = (id: string, v: Partial<TreeTodo> = {}) => todo(id, { assigneeId: ME, ...v });

/** A tree as nested ids, context ones marked with `~`. */
type Shape = { [id: string]: Shape };
const shape = (nodes: readonly TodoTreeNode<{ id: string }>[]): Shape =>
  Object.fromEntries(nodes.map((n) => [`${n.context ? "~" : ""}${n.todo.id}`, shape(n.children)]));
const build = (todos: TreeTodo[], cap?: number) =>
  easyTodoTrees(todos, { userId: ME, now: NOW, timeZone: ZONE, cap });

describe("easyTodoTrees", () => {
  it("shows my step under its parent as context, leaving out a sibling that isn't mine", () => {
    const { trees, total, shown } = build([
      todo("birthday"),
      mine("cake", { parentId: "birthday" }),
      todo("invites", { parentId: "birthday", assigneeId: SAM }),
      todo("balloons", { parentId: "birthday" }),
      todo("theirs", { assigneeId: SAM }),
    ]);
    expect(shape(trees)).toEqual({ "~birthday": { cake: {} } });
    expect([total, shown]).toEqual([1, 1]);
  });

  it("keeps a todo of mine whole, its steps that aren't mine too, and counts only mine", () => {
    const { trees, total } = build([
      mine("stay"),
      todo("bag", { parentId: "stay", assigneeId: SAM }),
      mine("ride", { parentId: "stay" }),
    ]);
    expect(shape(trees)).toEqual({ stay: { bag: {}, ride: {} } });
    expect(total).toBe(2);
  });

  it("leaves out my done todos (they aren't open)", () => {
    const { trees, total } = build([
      todo("birthday"),
      mine("cake", { parentId: "birthday", doneAt: "2026-11-23T18:00:00.000Z" }),
    ]);
    expect(trees).toEqual([]);
    expect(total).toBe(0);
  });

  it("caps the card by my todos, not rows: five of mine, then See all", () => {
    const seven = Array.from({ length: 7 }, (_, i) => mine(`t${i}`, { dueOn: `2026-11-2${4 + (i % 5)}` }));
    // A context parent with one of mine (overdue, so first) counts one, not two rows.
    const { trees, total, shown } = build(
      [todo("birthday"), mine("cake", { parentId: "birthday", dueOn: "2026-11-22" }), ...seven],
      EASY_TODOS_CAP,
    );
    expect(total).toBe(8);
    expect(shown).toBe(5);
    expect(trees).toHaveLength(5);
    expect(shape(trees.slice(0, 1))).toEqual({ "~birthday": { cake: {} } });
  });

  it("never cuts a tree: the one reaching the cap shows whole, the next waits", () => {
    const { trees, total, shown } = build(
      [
        mine("a", { dueOn: "2026-11-24" }),
        mine("a1", { parentId: "a" }),
        mine("a2", { parentId: "a" }),
        mine("b", { dueOn: "2026-11-25" }),
        mine("b1", { parentId: "b" }),
        mine("b2", { parentId: "b" }),
        mine("c", { dueOn: "2026-11-26" }),
      ],
      EASY_TODOS_CAP,
    );
    expect(shape(trees)).toEqual({ a: { a1: {}, a2: {} }, b: { b1: {}, b2: {} } });
    expect([total, shown]).toEqual([7, 6]);
  });

  it("with no cap (the easy roles), every one of mine", () => {
    const many = Array.from({ length: 7 }, (_, i) => mine(`t${i}`));
    expect(build(many).trees).toHaveLength(7);
  });
});
