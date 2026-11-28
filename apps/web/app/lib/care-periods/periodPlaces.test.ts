import { describe, expect, it } from "vitest";
import { canAddPlace, placeChipLabel, placeName, placeOptions } from "./periodPlaces";

const provider = (
  id: string,
  type: "clinician" | "practice" | "pharmacy" | "other",
  name: string,
  extra = {},
) => ({
  id,
  type,
  name,
  specialty: null,
  practiceId: null,
  status: "current" as const,
  isPrimary: false,
  deletedAt: null,
  ...extra,
});

const providers = [
  provider("1", "clinician", "Dr. Alvarez", { isPrimary: true, practiceId: "2" }),
  provider("2", "practice", "Westside Family Medicine"),
  provider("3", "practice", "Mercy General Hospital", { specialty: "Hospital" }),
  provider("4", "pharmacy", "Cornerstone Pharmacy"),
  provider("5", "practice", "Old Clinic", { deletedAt: "2026-11-01T00:00:00.000Z" }),
];

describe("placeOptions", () => {
  it("lists live providers of any type, practices first", () => {
    expect(placeOptions(providers, "").map((o) => o.label)).toEqual([
      "Mercy General Hospital",
      "Westside Family Medicine",
      "Dr. Alvarez",
      "Cornerstone Pharmacy",
    ]);
  });

  it("matches every typed word, accents and case ignored, and says what each is", () => {
    expect(placeOptions(providers, "mercy HOSP")).toEqual([
      { id: "3", label: "Mercy General Hospital", description: "Hospital" },
    ]);
    expect(placeOptions(providers, "westside").map((o) => o.label)).toEqual([
      "Westside Family Medicine",
      "Dr. Alvarez",
    ]);
    expect(placeOptions(providers, "", 2)).toHaveLength(2);
  });
});

describe("canAddPlace and placeChipLabel", () => {
  it("offers a new place only for a name not already live in the directory", () => {
    expect(canAddPlace(providers, "")).toBe(false);
    expect(canAddPlace(providers, " mercy general hospital ")).toBe(false);
    expect(canAddPlace(providers, "Old Clinic")).toBe(true);
    expect(canAddPlace(providers, "Oak Hills Rehab")).toBe(true);
  });

  it("marks a removed or not-yet-saved place", () => {
    expect(placeChipLabel("Mercy")).toBe("Mercy");
    expect(placeChipLabel("Mercy", { deleted: true })).toBe("Removed place");
    // A scrubbed row has no name left: still the removed wording.
    expect(placeChipLabel("", { deleted: true })).toBe("Removed place");
    expect(placeChipLabel("Oak Hills", { isNew: true })).toBe("Oak Hills (new)");
  });
});

describe("placeName", () => {
  it("names a live place, and a deleted one (scrubbed or not) Removed place", () => {
    expect(placeName({ name: "Mercy", deletedAt: null })).toBe("Mercy");
    expect(placeName({ name: "Mercy", deletedAt: "2026-11-01T00:00:00.000Z" })).toBe("Removed place");
    expect(placeName({ name: "", deletedAt: "2026-11-01T00:00:00.000Z" })).toBe("Removed place");
  });
});
