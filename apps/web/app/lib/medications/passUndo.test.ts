import { afterEach, describe, expect, it, vi } from "vitest";
import { clearUndo, offerUndo, subscribeUndo, UNDO_MS, undoFor, undoSnapshot } from "./passUndo";

const round = { groupId: "g", label: "Morning logged", doseIds: ["a", "b"] };

describe("passUndo", () => {
  afterEach(() => clearUndo());

  it("offers Undo for its group until it expires", () => {
    offerUndo(round, 1000);
    expect(undoFor("g", { now: 1000 })?.doseIds).toEqual(["a", "b"]);
    expect(undoFor("g", { now: 1000 + UNDO_MS - 1 })).not.toBeNull();
    expect(undoFor("g", { now: 1000 + UNDO_MS })).toBeNull();
    expect(undoFor("other", { now: 1000 })).toBeNull();
  });

  it("a newer round replaces it, and clearing an older key leaves the newer", () => {
    offerUndo(round, 1000);
    const first = undoSnapshot()!.key;
    offerUndo({ ...round, label: "Evening logged", doseIds: ["c"] }, 2000);
    clearUndo(first);
    expect(undoFor("g", { now: 2000 })?.label).toBe("Evening logged");
    clearUndo();
    expect(undoSnapshot()).toBeNull();
  });

  it("an offer with a place is shown only there", () => {
    offerUndo({ ...round, entryIds: ["n"], place: "quickEntry" }, 1000);
    expect(undoFor("g", { now: 1000 })).toBeNull();
    expect(undoFor("g", { now: 1000, place: "quickEntry" })?.entryIds).toEqual(["n"]);
    expect(undoFor("g", { now: 1000, place: "now" })).toBeNull();
  });

  it("tells subscribers", () => {
    const listener = vi.fn();
    const stop = subscribeUndo(listener);
    offerUndo(round);
    clearUndo();
    stop();
    offerUndo(round);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
