import { describe, expect, it } from "vitest";
import { simpleTilesZSchema } from "./simpleMode";
import { resolveSimpleModeSetting, userPreferencesZSchema } from "./userPreferences";

describe("simpleTilesZSchema", () => {
  it("takes learned and fixed without tiles, and custom with exactly four", () => {
    expect(simpleTilesZSchema.safeParse({ mode: "learned" }).success).toBe(true);
    expect(simpleTilesZSchema.safeParse({ mode: "fixed" }).success).toBe(true);
    const four = [
      { kind: "note" },
      { kind: "symptom" },
      { kind: "dose" },
      { kind: "vital", vitalType: "spo2" },
    ];
    expect(simpleTilesZSchema.safeParse({ mode: "custom", tiles: four }).success).toBe(true);
  });

  it("refuses the wrong number of tiles, tiles on learned, and unknown kinds or vital types", () => {
    const bad = [
      { mode: "custom", tiles: [{ kind: "note" }] },
      { mode: "custom" },
      { mode: "learned", tiles: [] },
      {
        mode: "custom",
        tiles: [{ kind: "note" }, { kind: "note" }, { kind: "note" }, { kind: "medicationChange" }],
      },
      { mode: "custom", tiles: [{ kind: "note" }, { kind: "note" }, { kind: "note" }, { kind: "vital" }] },
      {
        mode: "custom",
        tiles: [{ kind: "note" }, { kind: "note" }, { kind: "note" }, { kind: "vital", vitalType: "mood" }],
      },
      { mode: "sometimes" },
    ];
    for (const value of bad) expect(simpleTilesZSchema.safeParse(value).success).toBe(false);
  });
});

describe("the simpleMode preference", () => {
  it("follows the group unless set, and takes only its three values", () => {
    expect(resolveSimpleModeSetting({})).toBe("group");
    expect(resolveSimpleModeSetting(null)).toBe("group");
    expect(resolveSimpleModeSetting({ simpleMode: "full" })).toBe("full");
    expect(userPreferencesZSchema.safeParse({ simpleMode: "simple" }).success).toBe(true);
    expect(userPreferencesZSchema.safeParse({ simpleMode: "always" }).success).toBe(false);
  });
});
