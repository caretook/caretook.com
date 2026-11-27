import { foldSearchText } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { MEDICATION_NAMES } from "./medicationNameList";
import { MEDICATION_SUGGESTION_LIMIT, medicationNameSuggestions } from "./medicationNames";

const names = (...list: string[]) => list.map((name) => ({ name }));

describe("medicationNameSuggestions", () => {
  it("puts the group's names first, then the curated list, the group's spelling winning a duplicate", () => {
    const group = names("lisinopril", "Folic acid (1 mg)", "Lipo-flavonoid");
    expect(medicationNameSuggestions("li", group)).toEqual([
      "lisinopril",
      "Lipo-flavonoid",
      "Atorvastatin (Lipitor)",
      "Insulin lispro (Humalog)",
      "Lidocaine (Lidoderm)",
      "Linagliptin (Tradjenta)",
      "Liraglutide (Victoza, Saxenda)",
      "Lisinopril (Zestril, Prinivil)",
      "Lithium (Lithobid)",
    ]);
    // A later word's start matches too; the group's spelling comes first.
    expect(medicationNameSuggestions("acid", group)).toEqual(["Folic acid (1 mg)", "Folic acid"]);
  });

  it("lists look-alikes in full, side by side, and a middle of a word doesn't match", () => {
    expect(medicationNameSuggestions("hydr", [])).toEqual([
      "Hydralazine",
      "Hydrochlorothiazide",
      "Hydrocodone-acetaminophen (Norco, Vicodin)",
      "Hydrocortisone (Cortef)",
      "Hydroxychloroquine (Plaquenil)",
      "Hydroxyzine (Vistaril, Atarax)",
    ]);
    expect(medicationNameSuggestions("hydroxy", [])).toEqual([
      "Hydroxychloroquine (Plaquenil)",
      "Hydroxyzine (Vistaril, Atarax)",
    ]);
    // "pril" starts a brand word, but ends lisinopril and enalapril without matching them.
    expect(medicationNameSuggestions("pril", [])).toEqual(["Omeprazole (Prilosec)"]);
  });

  it("folds case and accents, matches each typed word in any order, and drops blanks", () => {
    expect(medicationNameSuggestions("  CAFE ", names("Caféine tablets", "  "))).toEqual(["Caféine tablets"]);
    expect(medicationNameSuggestions("d vit", [])).toEqual([
      "Calcium with vitamin D (Caltrate, Os-Cal)",
      "Vitamin D3",
    ]);
  });

  it("finds a curated name by its brand or its generic", () => {
    expect(medicationNameSuggestions("tylenol", [])).toEqual(["Acetaminophen (Tylenol)"]);
    expect(medicationNameSuggestions("acetamin", [])).toEqual([
      "Acetaminophen (Tylenol)",
      "Hydrocodone-acetaminophen (Norco, Vicodin)",
    ]);
    expect(medicationNameSuggestions("zestril", [])).toEqual(["Lisinopril (Zestril, Prinivil)"]);
  });

  it("puts a group's saved name first, de-duplicated only when its folded text is the curated entry's", () => {
    // Saved as the curated entry (any case or accents): shown once, in the group's spelling.
    expect(medicationNameSuggestions("tylenol", names("acetaminophen (TYLENOL)"))).toEqual([
      "acetaminophen (TYLENOL)",
    ]);
    // Saved under the bare generic: a different name, so both show, the group's first.
    expect(medicationNameSuggestions("acetamin", names("Acetaminophen"))).toEqual([
      "Acetaminophen",
      "Acetaminophen (Tylenol)",
      "Hydrocodone-acetaminophen (Norco, Vicodin)",
    ]);
    // The bare generic has no brand word, so typing the brand offers only the curated entry.
    expect(medicationNameSuggestions("tylenol", names("Acetaminophen"))).toEqual(["Acetaminophen (Tylenol)"]);
  });

  it("caps the list", () => {
    expect(MEDICATION_SUGGESTION_LIMIT).toBe(20);
    const many = names(...Array.from({ length: 25 }, (_, i) => `Med ${i}`));
    expect(medicationNameSuggestions("m", many)).toEqual(many.slice(0, 20).map((m) => m.name));
    expect(medicationNameSuggestions("m", [], { limit: 3 })).toHaveLength(3);
  });

  it("has about 200 curated names, each once, with no strength in them", () => {
    expect(MEDICATION_NAMES.length).toBeGreaterThanOrEqual(190);
    expect(new Set(MEDICATION_NAMES.map(foldSearchText)).size).toBe(MEDICATION_NAMES.length);
    expect(MEDICATION_NAMES.filter((n) => /\d+\s*(mg|mcg|ml|g)\b/i.test(n))).toEqual([]);
  });

  it("keeps the curated list alphabetical by generic, each generic once, at most two brands each", () => {
    const generic = (n: string) => n.replace(/\s*\([^)]*\)$/, "");
    const generics = MEDICATION_NAMES.map(generic);
    expect(generics).toEqual([...generics].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
    expect(new Set(generics.map(foldSearchText)).size).toBe(generics.length);
    const brands = MEDICATION_NAMES.map((n) => /\(([^)]*)\)$/.exec(n)?.[1]?.split(", ") ?? []);
    expect(brands.filter((b) => b.length > 2)).toEqual([]);
  });
});
