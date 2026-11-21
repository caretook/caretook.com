import { afterEach, describe, expect, it } from "vitest";
import {
  clearTodoUndo,
  offerTodoUndo,
  pruneTodoUndo,
  TODO_UNDO_MS,
  todoUndoFor,
  todoUndoSnapshot,
} from "./todoUndo";

afterEach(() => clearTodoUndo());

const tick = (todoId: string, at: number, groupId = "g") =>
  offerTodoUndo({ groupId, todoId, title: todoId.toUpperCase(), label: `Done: ${todoId.toUpperCase()}` }, at);
const ids = (groupId: string, now: number) => todoUndoFor(groupId, now).map((o) => o.todoId);

describe("todoUndo", () => {
  it("holds three offers newest first, each expiring 10 s after its own tick", () => {
    tick("a", 1000);
    tick("b", 2000);
    tick("c", 3000);
    expect(ids("g", 3000)).toEqual(["c", "b", "a"]);
    expect(todoUndoFor("g", 3000).map((o) => o.label)).toEqual(["Done: C", "Done: B", "Done: A"]);
    expect(ids("g", 1000 + TODO_UNDO_MS - 1)).toEqual(["c", "b", "a"]);
    expect(ids("g", 1000 + TODO_UNDO_MS)).toEqual(["c", "b"]);
    expect(ids("g", 2000 + TODO_UNDO_MS)).toEqual(["c"]);
    expect(ids("g", 3000 + TODO_UNDO_MS)).toEqual([]);
  });

  it("undoing the middle one leaves the other two", () => {
    tick("a", 1000);
    tick("b", 2000);
    tick("c", 3000);
    const middle = todoUndoFor("g", 3000)[1]!;
    clearTodoUndo("stale");
    expect(ids("g", 3000)).toEqual(["c", "b", "a"]);
    clearTodoUndo(middle.key);
    expect(ids("g", 3000)).toEqual(["c", "a"]);
  });

  it("ticking the same todo twice keeps one entry, the newer, at the front", () => {
    tick("a", 1000);
    tick("b", 2000);
    tick("a", 5000);
    expect(ids("g", 5000)).toEqual(["a", "b"]);
    // Its expiry is the newer tick's.
    expect(ids("g", 1000 + TODO_UNDO_MS)).toEqual(["a", "b"]);
    expect(todoUndoFor("g", 5000)[0]!.expiresAt).toBe(5000 + TODO_UNDO_MS);
  });

  it("filters the list by group", () => {
    tick("a", 1000, "g");
    tick("x", 2000, "other");
    tick("b", 3000, "g");
    expect(ids("g", 3000)).toEqual(["b", "a"]);
    expect(ids("other", 3000)).toEqual(["x"]);
    expect(ids("none", 3000)).toEqual([]);
  });

  it("prunes expired offers, and the snapshot only changes when the list does", () => {
    tick("a", 1000);
    tick("b", 5000);
    const before = todoUndoSnapshot();
    pruneTodoUndo(2000);
    expect(todoUndoSnapshot()).toBe(before);
    pruneTodoUndo(1000 + TODO_UNDO_MS);
    expect(todoUndoSnapshot().map((o) => o.todoId)).toEqual(["b"]);
    clearTodoUndo();
    expect(todoUndoSnapshot()).toEqual([]);
  });
});
