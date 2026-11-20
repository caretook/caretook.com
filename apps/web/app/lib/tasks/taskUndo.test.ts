import { afterEach, describe, expect, it } from "vitest";
import { clearTaskUndo, offerTaskUndo, TASK_UNDO_MS, taskUndoFor, taskUndoSnapshot } from "./taskUndo";

afterEach(() => clearTaskUndo());

describe("taskUndo", () => {
  it("offers one Undo per group for 10 s, the newest tick replacing the last", () => {
    offerTaskUndo({ groupId: "g", taskId: "a", label: "Done: A" }, 1000);
    expect(taskUndoFor("g", 1000)?.taskId).toBe("a");
    expect(taskUndoFor("other", 1000)).toBeNull();
    expect(taskUndoFor("g", 1000 + TASK_UNDO_MS)).toBeNull();
    offerTaskUndo({ groupId: "g", taskId: "b", label: "Done: B" }, 2000);
    expect(taskUndoFor("g", 2000)?.label).toBe("Done: B");
  });

  it("clears only the offer it was given the key of", () => {
    offerTaskUndo({ groupId: "g", taskId: "a", label: "Done: A" }, 1000);
    const key = taskUndoSnapshot()!.key;
    clearTaskUndo("stale");
    expect(taskUndoSnapshot()?.key).toBe(key);
    clearTaskUndo(key);
    expect(taskUndoSnapshot()).toBeNull();
  });
});
