import { describe, expect, it } from "vitest";
import {
  FIXED_TILES,
  groupTiles,
  learnedTiles,
  parseSimpleTiles,
  recipientWords,
  tileFromKey,
  tileKey,
  tileLabel,
} from "./simpleTiles";

const now = new Date("2026-11-19T18:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const times = (count: number, entry: { kind: string; vitalTypes?: string[] }, days = 1) =>
  Array.from({ length: count }, () => ({ ...entry, occurredAt: daysAgo(days) }));
const keys = (tiles: ReturnType<typeof learnedTiles>) => tiles.map(tileKey);

describe("learnedTiles", () => {
  it("is the fixed set for a group with nothing logged", () => {
    expect(learnedTiles([], now)).toEqual(FIXED_TILES);
  });

  it("takes the four most-logged, most first, counting each vital type", () => {
    const entries = [
      ...times(5, { kind: "vital", vitalTypes: ["bloodGlucose"] }),
      ...times(3, { kind: "vital", vitalTypes: ["bloodGlucose", "heartRate"] }),
      ...times(4, { kind: "dose" }),
      ...times(2, { kind: "note" }),
      ...times(1, { kind: "symptom" }),
      ...times(9, { kind: "event" }),
      ...times(9, { kind: "medication_change" }),
    ];
    expect(keys(learnedTiles(entries, now))).toEqual([
      "vital:bloodGlucose",
      "dose",
      "vital:heartRate",
      "note",
    ]);
  });

  it("pads fewer than four with the fixed set, in its order", () => {
    const entries = [...times(2, { kind: "vital", vitalTypes: ["weight"] }), ...times(1, { kind: "dose" })];
    expect(keys(learnedTiles(entries, now))).toEqual([
      "vital:weight",
      "dose",
      "symptom",
      "vital:bloodPressure",
    ]);
  });

  it("breaks ties by the fixed set's order", () => {
    const entries = [
      ...times(2, { kind: "note" }),
      ...times(2, { kind: "dose" }),
      ...times(2, { kind: "vital", vitalTypes: ["temperature"] }),
      ...times(2, { kind: "symptom" }),
      ...times(2, { kind: "vital", vitalTypes: ["bloodPressure"] }),
    ];
    expect(keys(learnedTiles(entries, now))).toEqual(["symptom", "vital:bloodPressure", "dose", "note"]);
  });

  it("only counts the last 30 days, and nothing ahead of now", () => {
    const entries = [
      ...times(9, { kind: "vital", vitalTypes: ["sleep"] }, 31),
      ...times(9, { kind: "note" }, -2),
      ...times(1, { kind: "vital", vitalTypes: ["spo2"] }, 29),
    ];
    expect(keys(learnedTiles(entries, now))).toEqual([
      "vital:spo2",
      "symptom",
      "vital:bloodPressure",
      "dose",
    ]);
  });

  it("ignores vital types this build doesn't know", () => {
    expect(keys(learnedTiles(times(3, { kind: "vital", vitalTypes: ["mood"] }), now))).toEqual(
      FIXED_TILES.map(tileKey),
    );
  });
});

describe("groupTiles", () => {
  const entries = times(3, { kind: "vital", vitalTypes: ["sleep"] });
  it("follows the group's choice", () => {
    expect(keys(groupTiles(null, entries, now))[0]).toBe("vital:sleep");
    expect(groupTiles({ mode: "learned" }, entries, now)[0]).toEqual({ kind: "vital", vitalType: "sleep" });
    expect(groupTiles({ mode: "fixed" }, entries, now)).toEqual(FIXED_TILES);
    const custom = [{ kind: "note" }, { kind: "dose" }, { kind: "symptom" }, { kind: "note" }] as const;
    expect(groupTiles({ mode: "custom", tiles: [...custom] }, entries, now)).toEqual(custom);
  });
});

describe("parseSimpleTiles", () => {
  it("reads the synced JSON, and anything unreadable is learned (null)", () => {
    expect(parseSimpleTiles(null)).toBeNull();
    expect(parseSimpleTiles('{"mode":"fixed"}')).toEqual({ mode: "fixed" });
    expect(parseSimpleTiles('{"mode":"custom","tiles":[{"kind":"note"}]}')).toBeNull();
    expect(parseSimpleTiles("not json")).toBeNull();
  });
});

describe("tile keys", () => {
  it("round-trip, and refuse anything else", () => {
    for (const tile of FIXED_TILES) expect(tileFromKey(tileKey(tile))).toEqual(tile);
    expect(tileFromKey("vital:mood")).toBeNull();
    expect(tileFromKey("event")).toBeNull();
  });
});

describe("tile labels", () => {
  const label = (pronouns: string | null) => {
    const words = recipientWords("Grandma June", pronouns);
    return FIXED_TILES.map((tile) => tileLabel(tile, words));
  };

  it("use pronouns we know", () => {
    expect(label("she/her")).toEqual([
      "How she feels",
      "Blood pressure",
      "Her medicines",
      "A note about her day",
    ]);
    expect(label("He/Him")).toEqual([
      "How he feels",
      "Blood pressure",
      "His medicines",
      "A note about his day",
    ]);
    expect(label("they / them")).toEqual([
      "How they feel",
      "Blood pressure",
      "Their medicines",
      "A note about their day",
    ]);
    expect(label("her")).toEqual(label("she/her"));
  });

  it("use the name without pronouns, or with ones the labels can't follow", () => {
    const named = [
      "How Grandma June feels",
      "Blood pressure",
      "Grandma June's medicines",
      "A note about Grandma June's day",
    ];
    expect(label(null)).toEqual(named);
    expect(label("")).toEqual(named);
    expect(label("she/they")).toEqual(named);
    expect(label("ze/zir")).toEqual(named);
  });

  it("name a vital tile by its type", () => {
    expect(tileLabel({ kind: "vital", vitalType: "bloodGlucose" }, { name: "Lou" })).toBe("Blood sugar");
  });
});
