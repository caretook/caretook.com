import { describe, expect, test } from "vitest";

import { ACCENTS } from "../../components/ui/accents";
import { conditionChangeRow, KIND_META, removedChangeText, TODO_CHIP } from "./entryDisplay";

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

describe("removed names", () => {
  const C = "11111111-2222-4333-8444-555555555555";

  test("a change whose summary is gone reads as its removed name, changed", () => {
    expect(removedChangeText("Removed medication")).toBe("Removed medication changed");
  });

  test("a live condition's change keeps its heading and lines", () => {
    const row = conditionChangeRow({
      conditionId: C,
      change: "resolved",
      conditionName: "Type 2 diabetes",
    } as never);
    expect(row.heading).toContain("Type 2 diabetes");
    expect(row.removed).toBeUndefined();
  });

  test("a deleted condition's scrubbed change reads Removed condition changed, with no lines", () => {
    const scrubbed = { conditionId: C, change: "added", conditionName: "" } as never;
    expect(conditionChangeRow(scrubbed)).toEqual({
      heading: "Removed condition changed",
      lines: [],
      removed: true,
    });
    // A scrub that drops the name altogether reads the same.
    expect(conditionChangeRow({ conditionId: C, change: "edited" } as never).heading).toBe(
      "Removed condition changed",
    );
  });
});
