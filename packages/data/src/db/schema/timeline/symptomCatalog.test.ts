import { describe, expect, it } from "vitest";
import {
  DEFAULT_SYMPTOMS,
  SIMILAR_SYMPTOMS_MAX,
  SYMPTOM_NAME_MAX,
  similarSymptoms,
  symptomKey,
  symptomName,
  symptomTypeId,
} from "./symptomCatalog";
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

describe("similarSymptoms (the check before a new name)", () => {
  const catalog = (...names: string[]) => names.map((name) => ({ id: name, name }));
  const similar = (name: string, rows: { name: string }[]) =>
    similarSymptoms(name, rows).similar.map((r) => r.name);

  it("finds the exact match in any case or spacing, and offers nothing else", () => {
    const rows = catalog("Nausea", "Knee pain", "Pain");
    expect(similarSymptoms("  knee   PAIN ", rows)).toEqual({ exact: rows[1], similar: [] });
  });

  it("offers the same words in another order", () => {
    expect(similar("pain knee", catalog("Knee pain", "Nausea"))).toEqual(["Knee pain"]);
    expect(similar("Knee-pain", catalog("Knee pain"))).toEqual(["Knee pain"]);
  });

  it("offers one name's words inside the other's, either way", () => {
    expect(similar("Left knee pain", catalog("Knee pain", "Nausea"))).toEqual(["Knee pain"]);
    expect(similar("Knee pain", catalog("Left knee pain", "Fever"))).toEqual(["Left knee pain"]);
    expect(similar("Lower back pain", catalog(...DEFAULT_SYMPTOMS, "Back pain"))).toEqual(["Back pain"]);
  });

  it("needs two words or more inside: one word isn't enough", () => {
    expect(similar("Knee pain", catalog(...DEFAULT_SYMPTOMS))).toEqual([]);
    expect(similar("Pain", catalog("Back pain", "Fever"))).toEqual([]);
    // Reordered words and typos still match whatever the length.
    expect(similar("pain knee", catalog(...DEFAULT_SYMPTOMS, "Knee pain"))).toEqual(["Knee pain"]);
    expect(similar("Painn", catalog(...DEFAULT_SYMPTOMS))).toEqual(["Pain"]);
  });

  it("offers a small typo", () => {
    expect(similar("Nausia", catalog("Nausea", "Fever"))).toEqual(["Nausea"]);
    expect(similar("Head ache", catalog("Headache"))).toEqual(["Headache"]);
    expect(similar("Dizzyness", catalog("Dizziness"))).toEqual(["Dizziness"]);
    expect(similar("Shortness of breth", catalog("Shortness of breath"))).toEqual(["Shortness of breath"]);
  });

  it("offers nothing for unrelated names, and no typo match for very short ones", () => {
    expect(similar("Hiccups", catalog(...DEFAULT_SYMPTOMS))).toEqual([]);
    expect(similar("Sore elbow", catalog("Nausea", "Knee pain", "Fever"))).toEqual([]);
    expect(similar("Flu", catalog("Fall"))).toEqual([]);
    expect(similarSymptoms("   ", catalog("Pain"))).toEqual({ exact: null, similar: [] });
  });

  it("still finds an archived row exactly, but never offers one as similar", () => {
    const rows = [
      { id: "a", name: "Knee pain", archived: true },
      { id: "b", name: "Nausea", archived: false },
      { id: "c", name: "Left knee pain" },
    ];
    expect(similarSymptoms("knee PAIN", rows)).toEqual({ exact: rows[0], similar: [] });
    expect(similar("pain knee", rows)).toEqual([]);
    expect(similar("Knee pains", rows)).toEqual([]);
    expect(similar("Sharp left knee pain", rows)).toEqual(["Left knee pain"]);
    expect(similar("Nausia", rows)).toEqual(["Nausea"]);
  });

  it("offers at most three, the closest first, then A to Z", () => {
    const rows = catalog("Back pain", "Chest pain", "Neck pain", "Pain knee", "Knee pains");
    expect(SIMILAR_SYMPTOMS_MAX).toBe(3);
    // Reordered words, then the typo; one word inside ("Back pain") doesn't count.
    expect(similar("Knee pain", rows)).toEqual(["Pain knee", "Knee pains"]);
    const sharp = catalog("Sharp knee pain", "Sharp back pain", "Sharp neck pain", "Sharp chest pain");
    // Two words inside each, A to Z, capped at three.
    expect(similar("Sharp pain", sharp)).toEqual(["Sharp back pain", "Sharp chest pain", "Sharp knee pain"]);
    // Reordered words and a typo come before the words inside.
    const mixed = catalog("Sharp knee pain", "Sharp back pain", "Pain sharp", "Sharp paine");
    expect(similar("Sharp pain", mixed)).toEqual(["Pain sharp", "Sharp paine", "Sharp back pain"]);
  });
});
