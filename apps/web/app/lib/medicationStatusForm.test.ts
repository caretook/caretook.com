import { describe, expect, it } from "vitest";
import { statusRequestFromForm } from "./medicationStatusForm";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

describe("statusRequestFromForm", () => {
  it("is null for anything that isn't a status action", () => {
    expect(statusRequestFromForm(form({}))).toBeNull();
    expect(statusRequestFromForm(form({ intent: "update" }))).toBeNull();
  });

  it("reads Delete and Restart", () => {
    expect(statusRequestFromForm(form({ intent: "remove" }))).toEqual({ intent: "remove" });
    expect(statusRequestFromForm(form({ intent: "restart" }))).toEqual({
      intent: "status",
      change: { status: "current" },
    });
  });

  it("reads Mark completed: no reason, today unless a day is given", () => {
    expect(statusRequestFromForm(form({ intent: "complete", stopReason: "sideEffects" }))).toEqual({
      intent: "status",
      change: { status: "completed", stoppedOn: undefined, stopNote: null },
    });
    expect(statusRequestFromForm(form({ intent: "complete", stoppedOn: "2026-11-10" }))).toEqual({
      intent: "status",
      change: { status: "completed", stoppedOn: "2026-11-10", stopNote: null },
    });
  });

  it("reads Discontinue with its reason and note", () => {
    expect(
      statusRequestFromForm(
        form({ intent: "discontinue", stopReason: "sideEffects", stopNote: "  dizzy  ", stoppedOn: "" }),
      ),
    ).toEqual({
      intent: "status",
      change: { status: "discontinued", stopReason: "sideEffects", stoppedOn: undefined, stopNote: "dizzy" },
    });
  });

  it("passes a missing or unknown reason on as none, for the write to refuse", () => {
    for (const stopReason of ["", "bored"])
      expect(statusRequestFromForm(form({ intent: "discontinue", stopReason }))).toEqual({
        intent: "status",
        change: { status: "discontinued", stopReason: null, stoppedOn: undefined, stopNote: null },
      });
  });
});
