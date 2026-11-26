import { describe, expect, it } from "vitest";
import { SPECIALTY_SUGGESTIONS } from "./specialties";

describe("SPECIALTY_SUGGESTIONS", () => {
  it("has a non-empty list for each type", () => {
    expect(Object.keys(SPECIALTY_SUGGESTIONS).sort()).toEqual(["clinician", "other", "pharmacy", "practice"]);
    for (const list of Object.values(SPECIALTY_SUGGESTIONS)) expect(list.length).toBeGreaterThan(0);
  });

  it("lists each suggestion once per type, ignoring case and spaces", () => {
    for (const list of Object.values(SPECIALTY_SUGGESTIONS)) {
      const folded = list.map((s) => s.trim().toLowerCase());
      expect(new Set(folded).size).toBe(list.length);
      for (const s of list) expect(s).toBe(s.trim());
    }
  });

  it("starts the clinician list with the common specialties", () => {
    expect(SPECIALTY_SUGGESTIONS.clinician).toEqual(
      expect.arrayContaining(["Primary care", "Cardiology", "Oncology", "Neurology", "Physical therapy"]),
    );
  });
});
