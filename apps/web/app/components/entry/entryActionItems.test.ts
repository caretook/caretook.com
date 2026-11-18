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

  it("drops Edit when there's nothing to edit with", () => {
    expect(entryActionItems("symptom", { canEdit: false })).toEqual(["delete"]);
  });
});
