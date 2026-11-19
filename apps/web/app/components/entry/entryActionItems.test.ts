import { describe, expect, it } from "vitest";
import { entryActionItems } from "./entryActionItems";

describe("entryActionItems", () => {
  it("gives symptoms and vitals Edit, then Delete", () => {
    expect(entryActionItems("symptom", { canEdit: true })).toEqual(["edit", "delete"]);
    expect(entryActionItems("vital", { canEdit: true })).toEqual(["edit", "delete"]);
  });

  it("never gives notes or events Edit (they're edited on their page)", () => {
    expect(entryActionItems("note", { canEdit: true })).toEqual(["delete"]);
    expect(entryActionItems("event", { canEdit: true })).toEqual(["delete"]);
    expect(entryActionItems("note", { canEdit: false })).toEqual(["delete"]);
  });

  it("gives doses Edit, then Delete, and medication changes Delete only", () => {
    expect(entryActionItems("dose", { canEdit: true })).toEqual(["edit", "delete"]);
    expect(entryActionItems("medicationChange", { canEdit: true })).toEqual(["delete"]);
  });

  it("drops Edit when there's nothing to edit with", () => {
    expect(entryActionItems("symptom", { canEdit: false })).toEqual(["delete"]);
  });

  it("gives an event Cancel before Delete, or Undo cancel once it's cancelled", () => {
    expect(entryActionItems("event", { canEdit: false, canCancel: true })).toEqual(["cancel", "delete"]);
    expect(entryActionItems("event", { canEdit: false, canCancel: true, cancelled: true })).toEqual([
      "uncancel",
      "delete",
    ]);
  });

  it("gives Cancel to events only", () => {
    for (const kind of ["note", "symptom", "vital", "dose", "medicationChange"] as const)
      expect(entryActionItems(kind, { canEdit: false, canCancel: true })).not.toContain("cancel");
    expect(entryActionItems("symptom", { canEdit: true, canCancel: true })).toEqual(["edit", "delete"]);
  });

  it("gives no Cancel when the caller can't cancel (no handler)", () => {
    expect(entryActionItems("event", { canEdit: false, cancelled: true })).toEqual(["delete"]);
  });
});
