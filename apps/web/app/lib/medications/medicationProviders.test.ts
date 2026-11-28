import type { PickableProvider } from "./medicationProviders";

import { describe, expect, it } from "vitest";
import { canAddProvider, chosenLabel, fitsRole, providerOptions } from "./medicationProviders";

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
  provider("alv", "clinician", "Dr. Elena Alvarez", { specialty: "Family medicine", practiceId: "prac" }),
  provider("pat", "clinician", "Dr. Samuel Patel", { specialty: "Cardiology" }),
  provider("old", "clinician", "Dr. Old Gone", { deletedAt: "2026-11-01T00:00:00Z" }),
  provider("past", "clinician", "Dr. Past Person", { status: "past" }),
  provider("rx", "pharmacy", "Cornerstone Pharmacy"),
  provider("aide", "other", "Rosa (home health aide)"),
];

describe("fitsRole", () => {
  it("lets clinicians and practices prescribe, and pharmacies fill", () => {
    expect(["clinician", "practice", "pharmacy", "other"].map((t) => fitsRole("prescriber", t))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(["clinician", "practice", "pharmacy", "other"].map((t) => fitsRole("pharmacy", t))).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });
});

describe("providerOptions", () => {
  it("offers live providers that fit the role, current before past", () => {
    expect(providerOptions(GROUP, "prescriber", "").map((o) => o.id)).toEqual(["alv", "pat", "prac", "past"]);
    expect(providerOptions(GROUP, "pharmacy", "").map((o) => o.id)).toEqual(["rx"]);
  });

  it("matches every typed word in the name, specialty or practice", () => {
    expect(providerOptions(GROUP, "prescriber", "cardio").map((o) => o.id)).toEqual(["pat"]);
    expect(providerOptions(GROUP, "prescriber", "westside").map((o) => o.id)).toEqual(["alv", "prac"]);
  });

  it("says what each one is", () => {
    const [alvarez] = providerOptions(GROUP, "prescriber", "alvarez");
    expect(alvarez).toEqual({
      id: "alv",
      label: "Dr. Elena Alvarez",
      description: "Family medicine · Westside Family Medicine",
    });
    expect(providerOptions(GROUP, "prescriber", "past")[0]?.description).toBe("Clinician · Past");
  });

  it("lists at most the limit", () => {
    expect(providerOptions(GROUP, "prescriber", "", 2)).toHaveLength(2);
  });
});

describe("canAddProvider", () => {
  it("offers a typed name no live provider in the role has", () => {
    expect(canAddProvider(GROUP, "prescriber", "Dr. Ada Moss")).toBe(true);
    expect(canAddProvider(GROUP, "prescriber", " dr. samuel PATEL ")).toBe(false);
    expect(canAddProvider(GROUP, "prescriber", "")).toBe(false);
  });
  it("ignores deleted providers and other roles", () => {
    expect(canAddProvider(GROUP, "prescriber", "Dr. Old Gone")).toBe(true);
    expect(canAddProvider(GROUP, "pharmacy", "Dr. Samuel Patel")).toBe(true);
    expect(canAddProvider(GROUP, "pharmacy", "cornerstone pharmacy")).toBe(false);
  });
});

describe("chosenLabel", () => {
  it("marks a removed or a new provider", () => {
    expect(chosenLabel("Dr. A")).toBe("Dr. A");
    expect(chosenLabel("Dr. A", { deleted: true })).toBe("Dr. A (removed)");
    expect(chosenLabel("Dr. A", { isNew: true })).toBe("Dr. A (new)");
  });
});
