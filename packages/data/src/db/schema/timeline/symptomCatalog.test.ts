import { describe, expect, it } from "vitest";
import { DEFAULT_SYMPTOMS, SYMPTOM_NAME_MAX, symptomKey, symptomName, symptomTypeId } from "./symptomCatalog";
import { TIMELINE_LIMITS } from "./timelineEntry";
import { symptomTypeNameZSchema, symptomTypeRow } from "./symptomType";

// The catalog's pure rules (symptom-catalog slice 1). Prior art: repeatRule.test.ts.

const GROUP = "0b6f3f1c-4c2e-4d7a-9a51-6e2d8c1f7a10";
const OTHER = "0b6f3f1c-4c2e-4d7a-9a51-6e2d8c1f7a11";

describe("symptomKey", () => {
  it("folds case and spaces, and nothing else", () => {
    expect(symptomKey("  Knee   Pain ")).toBe("knee pain");
    expect(symptomKey("knee pain")).toBe(symptomKey("KNEE\tPAIN"));
    expect(symptomKey("knee ache")).not.toBe(symptomKey("knee pain"));
    expect(symptomKey("Nauseous")).not.toBe(symptomKey("Nausea"));
  });

  it("keeps the name's own spelling for display, with single spaces", () => {
    expect(symptomName("  Knee   Pain ")).toBe("Knee Pain");
  });
});

describe("symptomTypeId", () => {
  it("is a stable version 5 UUID across case and spacing", () => {
    const id = symptomTypeId(GROUP, "Nausea");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(symptomTypeId(GROUP, "  nAUSEA ")).toBe(id);
    expect(symptomTypeId(GROUP.toUpperCase(), "nausea")).toBe(id);
    // Fixed: stored ids depend on it never changing.
    expect(id).toBe(symptomTypeId("0b6f3f1c-4c2e-4d7a-9a51-6e2d8c1f7a10", "nausea"));
  });

  it("differs by group and by name", () => {
    expect(symptomTypeId(OTHER, "Nausea")).not.toBe(symptomTypeId(GROUP, "Nausea"));
    expect(symptomTypeId(GROUP, "Fever")).not.toBe(symptomTypeId(GROUP, "Nausea"));
  });
});

describe("DEFAULT_SYMPTOMS", () => {
  it("is the 23 names, each its own key and within the name limit", () => {
    expect(DEFAULT_SYMPTOMS).toHaveLength(23);
    expect(new Set(DEFAULT_SYMPTOMS.map(symptomKey)).size).toBe(23);
    expect(DEFAULT_SYMPTOMS).toContain("Fall");
    for (const name of DEFAULT_SYMPTOMS) expect(symptomName(name)).toBe(name);
  });
});

describe("a catalog row", () => {
  it("takes the entry's name limit", () => {
    expect(SYMPTOM_NAME_MAX).toBe(TIMELINE_LIMITS.symptomName);
    expect(symptomTypeNameZSchema.safeParse("x".repeat(SYMPTOM_NAME_MAX)).success).toBe(true);
    expect(symptomTypeNameZSchema.safeParse("x".repeat(SYMPTOM_NAME_MAX + 1)).success).toBe(false);
    expect(symptomTypeNameZSchema.safeParse("   ").success).toBe(false);
  });

  it("carries the derived id, the stored name and the key", () => {
    expect(symptomTypeRow(GROUP, " Knee  pain")).toEqual({
      id: symptomTypeId(GROUP, "knee pain"),
      groupId: GROUP,
      name: "Knee pain",
      nameKey: "knee pain",
    });
  });
});
