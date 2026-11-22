import { describe, expect, test } from "vitest";

import { ACCENTS } from "../../components/ui/accents";
import { KIND_META, TODO_CHIP } from "./entryDisplay";

describe("KIND_META's colours", () => {
  test("every kind has an accent or neutral, and a look", () => {
    for (const [kind, meta] of Object.entries(KIND_META)) {
      expect([...ACCENTS, "neutral"], kind).toContain(meta.accent);
      expect(["solid", "soft"], kind).toContain(meta.look);
    }
  });

  test("a dose and a medication change share an accent in different looks", () => {
    expect(KIND_META.dose.accent).toBe(KIND_META.medicationChange.accent);
    expect(KIND_META.dose.look).not.toBe(KIND_META.medicationChange.look);
  });

  test("a note is neutral and quick entry's to-do is soft orange", () => {
    expect(KIND_META.note.accent).toBe("neutral");
    expect(TODO_CHIP).toEqual({ accent: "orange", look: "soft" });
  });
});
