import { describe, expect, it } from "vitest";
import { easyTilesZSchema } from "./easyMode";
import { resolveEasyModeSetting, userPreferencesZSchema } from "./userPreferences";

describe("easyTilesZSchema", () => {
  it("takes learned and fixed without tiles, and custom with exactly four", () => {
    expect(easyTilesZSchema.safeParse({ mode: "learned" }).success).toBe(true);
    expect(easyTilesZSchema.safeParse({ mode: "fixed" }).success).toBe(true);
    const four = [
      { kind: "note" },
      { kind: "symptom" },
      { kind: "dose" },
      { kind: "vital", vitalType: "spo2" },
    ];
    expect(easyTilesZSchema.safeParse({ mode: "custom", tiles: four }).success).toBe(true);
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
    for (const value of bad) expect(easyTilesZSchema.safeParse(value).success).toBe(false);
  });
});

describe("the easyMode preference", () => {
  it("follows the group unless set, and takes only its three values", () => {
    expect(resolveEasyModeSetting({})).toBe("group");
    expect(resolveEasyModeSetting(null)).toBe("group");
    expect(resolveEasyModeSetting({ easyMode: "full" })).toBe("full");
    expect(userPreferencesZSchema.safeParse({ easyMode: "easy" }).success).toBe(true);
    expect(userPreferencesZSchema.safeParse({ easyMode: "always" }).success).toBe(false);
  });
});
