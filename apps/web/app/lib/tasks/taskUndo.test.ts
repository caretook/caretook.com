import { afterEach, describe, expect, it } from "vitest";
import {
  clearTaskUndo,
  offerTaskUndo,
  pruneTaskUndo,
  TASK_UNDO_MS,
  taskUndoFor,
  taskUndoSnapshot,
} from "./taskUndo";

afterEach(() => clearTaskUndo());

const tick = (taskId: string, at: number, groupId = "g") =>
  offerTaskUndo({ groupId, taskId, title: taskId.toUpperCase(), label: `Done: ${taskId.toUpperCase()}` }, at);
const ids = (groupId: string, now: number) => taskUndoFor(groupId, now).map((o) => o.taskId);

describe("taskUndo", () => {
  it("holds three offers newest first, each expiring 10 s after its own tick", () => {
    tick("a", 1000);
    tick("b", 2000);
    tick("c", 3000);
    expect(ids("g", 3000)).toEqual(["c", "b", "a"]);
    expect(taskUndoFor("g", 3000).map((o) => o.label)).toEqual(["Done: C", "Done: B", "Done: A"]);
    expect(ids("g", 1000 + TASK_UNDO_MS - 1)).toEqual(["c", "b", "a"]);
    expect(ids("g", 1000 + TASK_UNDO_MS)).toEqual(["c", "b"]);
    expect(ids("g", 2000 + TASK_UNDO_MS)).toEqual(["c"]);
    expect(ids("g", 3000 + TASK_UNDO_MS)).toEqual([]);
  });

  it("undoing the middle one leaves the other two", () => {
    tick("a", 1000);
    tick("b", 2000);
    tick("c", 3000);
    const middle = taskUndoFor("g", 3000)[1]!;
    clearTaskUndo("stale");
    expect(ids("g", 3000)).toEqual(["c", "b", "a"]);
    clearTaskUndo(middle.key);
    expect(ids("g", 3000)).toEqual(["c", "a"]);
  });

  it("ticking the same task twice keeps one entry, the newer, at the front", () => {
    tick("a", 1000);
    tick("b", 2000);
    tick("a", 5000);
    expect(ids("g", 5000)).toEqual(["a", "b"]);
    // Its expiry is the newer tick's.
    expect(ids("g", 1000 + TASK_UNDO_MS)).toEqual(["a", "b"]);
    expect(taskUndoFor("g", 5000)[0]!.expiresAt).toBe(5000 + TASK_UNDO_MS);
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
    const before = taskUndoSnapshot();
    pruneTaskUndo(2000);
    expect(taskUndoSnapshot()).toBe(before);
    pruneTaskUndo(1000 + TASK_UNDO_MS);
    expect(taskUndoSnapshot().map((o) => o.taskId)).toEqual(["b"]);
    clearTaskUndo();
    expect(taskUndoSnapshot()).toEqual([]);
  });
});
