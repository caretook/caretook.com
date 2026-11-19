import { describe, expect, it } from "vitest";
import { allergyActionFromForm } from "./allergyActions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("allergyActionFromForm", () => {
  it("reads an add and an edit, with an unknown severity as not known", () => {
    expect(
      allergyActionFromForm(
        form({ intent: "create", substance: "Penicillin", reaction: "Hives", severity: "severe" }),
      ),
    ).toEqual({ intent: "create", substance: "Penicillin", reaction: "Hives", severity: "severe" });
    expect(
      allergyActionFromForm(form({ intent: "update", allergyId: "a1", substance: "Sulfa", severity: "bad" })),
    ).toEqual({ intent: "update", allergyId: "a1", substance: "Sulfa", reaction: "", severity: "unknown" });
  });

  it("reads a remove and No known allergies", () => {
    expect(allergyActionFromForm(form({ intent: "remove", allergyId: "a1" }))).toEqual({
      intent: "remove",
      allergyId: "a1",
    });
    expect(allergyActionFromForm(form({ intent: "noKnown", on: "1" }))).toEqual({
      intent: "noKnown",
      on: true,
    });
    expect(allergyActionFromForm(form({ intent: "noKnown", on: "0" }))).toEqual({
      intent: "noKnown",
      on: false,
    });
  });

  it("refuses anything else", () => {
    expect(allergyActionFromForm(form({ intent: "update", substance: "Sulfa" }))).toBeNull();
    expect(allergyActionFromForm(form({ intent: "remove" }))).toBeNull();
    expect(allergyActionFromForm(form({ intent: "other", allergyId: "a1" }))).toBeNull();
  });
});
