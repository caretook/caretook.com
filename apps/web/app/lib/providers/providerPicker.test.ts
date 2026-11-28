import type { PickableProvider } from "./providerPicker";

import { describe, expect, it } from "vitest";
import { canAddPicked, chosenLabel, fitsCondition, pickerOptions } from "./providerPicker";

// The shared picker rules as a condition's pickers use them (conditions
// slice 3): anyone but a pharmacy, without the providers already chosen, and
// no second "Add" for a name already waiting to be added. The medication
// form's roles are medicationProviders.test.ts's.

const provider = (
  id: string,
  type: PickableProvider["type"],
  name: string,
  more: Partial<PickableProvider> = {},
): PickableProvider => ({
  id,
  type,
  name,
  specialty: null,
  practiceId: null,
  status: "current",
  isPrimary: false,
  deletedAt: null,
  ...more,
});

const GROUP = [
  provider("prac", "practice", "Westside Family Medicine"),
  provider("lee", "clinician", "Dr. Mei Lee", { specialty: "Cardiology" }),
  provider("aide", "other", "Rosa Diaz", { specialty: "Home health aide" }),
  provider("rx", "pharmacy", "Corner Pharmacy"),
  provider("gone", "clinician", "Dr. Old Hart", { deletedAt: "2026-11-01T00:00:00Z" }),
];

describe("pickerOptions for a condition", () => {
  it("offers anyone but a pharmacy, live ones only, leaving out those already chosen", () => {
    expect(pickerOptions(GROUP, fitsCondition, "").map((o) => o.label)).toEqual([
      "Dr. Mei Lee",
      "Rosa Diaz",
      "Westside Family Medicine",
    ]);
    expect(pickerOptions(GROUP, fitsCondition, "", { exclude: ["lee"] }).map((o) => o.id)).toEqual([
      "aide",
      "prac",
    ]);
    expect(pickerOptions(GROUP, fitsCondition, "cardio")).toEqual([
      { id: "lee", label: "Dr. Mei Lee", description: "Cardiology" },
    ]);
  });

  it("neither names nor matches a deleted practice", () => {
    const group = [
      provider("old", "practice", "Harbor Clinic", { deletedAt: "2026-11-01T00:00:00Z" }),
      provider("ada", "clinician", "Dr. Ada Moss", { specialty: "Neurology", practiceId: "old" }),
    ];
    expect(pickerOptions(group, fitsCondition, "")).toEqual([
      { id: "ada", label: "Dr. Ada Moss", description: "Neurology" },
    ]);
    expect(pickerOptions(group, fitsCondition, "harbor")).toEqual([]);
  });
});

describe("canAddPicked", () => {
  it("offers a new name unless a live one fits it or it's already waiting to be added", () => {
    expect(canAddPicked(GROUP, fitsCondition, "Dr. Ada Moss")).toBe(true);
    expect(canAddPicked(GROUP, fitsCondition, " dr. mei lee ")).toBe(false);
    // A deleted one, or a pharmacy, doesn't count.
    expect(canAddPicked(GROUP, fitsCondition, "Dr. Old Hart")).toBe(true);
    expect(canAddPicked(GROUP, fitsCondition, "Corner Pharmacy")).toBe(true);
    expect(canAddPicked(GROUP, fitsCondition, "Dr. Ada Moss", ["dr. ada moss"])).toBe(false);
    expect(canAddPicked(GROUP, fitsCondition, "  ")).toBe(false);
  });

  it("labels a chosen one new or removed, never naming a removed one", () => {
    expect([
      chosenLabel("A", { isNew: true }),
      chosenLabel("A", { deleted: true }),
      chosenLabel("", { deleted: true }),
      chosenLabel("A"),
    ]).toEqual(["A (new)", "Removed provider", "Removed provider", "A"]);
  });
});
