import type { PickerProvider } from "./withProviders";

import { describe, expect, it } from "vitest";
import { canAddNamed, chipLabel, pickerOptions } from "./withProviders";

const p = (id: string, name: string, extra: Partial<PickerProvider> = {}): PickerProvider => ({
  id,
  type: "clinician",
  name,
  specialty: null,
  practiceId: null,
  status: "current",
  isPrimary: false,
  deletedAt: null,
  ...extra,
});

const clinic = p("c", "Westside Family Medicine", { type: "practice" });
const alvarez = p("a", "Dr. Elena Alvarez", { specialty: "Primary care", practiceId: "c", isPrimary: true });
const patel = p("b", "Dr. Samuel Patel", { specialty: "Cardiology" });
const pharmacy = p("d", "Cornerstone Pharmacy", { type: "pharmacy" });
const past = p("e", "Dr. Old Doc", { status: "past" });
const gone = p("f", "Dr. Gone", { deletedAt: "2026-11-01T00:00:00.000Z" });
const all = [patel, pharmacy, past, gone, clinic, alvarez];

describe("pickerOptions", () => {
  it("lists live providers in display order, primary first and past last", () => {
    expect(pickerOptions(all, new Set(), "").map((o) => o.id)).toEqual(["a", "d", "b", "c", "e"]);
  });

  it("leaves out linked and deleted providers", () => {
    const ids = pickerOptions(all, new Set(["a", "d"]), "").map((o) => o.id);
    expect(ids).not.toContain("a");
    expect(ids).not.toContain("d");
    expect(ids).not.toContain("f");
  });

  it("matches every word in the name, specialty or practice name, ignoring case", () => {
    expect(pickerOptions(all, new Set(), "cardio").map((o) => o.id)).toEqual(["b"]);
    expect(pickerOptions(all, new Set(), "WESTSIDE").map((o) => o.id)).toEqual(["a", "c"]);
    expect(pickerOptions(all, new Set(), "dr samuel").map((o) => o.id)).toEqual(["b"]);
    expect(pickerOptions(all, new Set(), "nobody")).toEqual([]);
  });

  it("describes each: specialty or type, practice, past", () => {
    const byId = Object.fromEntries(pickerOptions(all, new Set(), "").map((o) => [o.id, o.description]));
    expect(byId.a).toBe("Primary care · Westside Family Medicine");
    expect(byId.d).toBe("Pharmacy");
    expect(byId.e).toBe("Clinician · Past");
  });

  it("stops at the limit", () => {
    expect(pickerOptions(all, new Set(), "", 2)).toHaveLength(2);
  });
});

describe("canAddNamed", () => {
  it("offers a new name, not an empty one or one that's there (any case)", () => {
    expect(canAddNamed(all, "Dr. New")).toBe(true);
    expect(canAddNamed(all, "  ")).toBe(false);
    expect(canAddNamed(all, "dr. samuel patel ")).toBe(false);
  });

  it("offers a deleted provider's name again", () => {
    expect(canAddNamed(all, "Dr. Gone")).toBe(true);
  });
});

describe("chipLabel", () => {
  it("marks a deleted provider removed", () => {
    expect(chipLabel(patel)).toBe("Dr. Samuel Patel");
    expect(chipLabel(gone)).toBe("Dr. Gone (removed)");
  });
});
