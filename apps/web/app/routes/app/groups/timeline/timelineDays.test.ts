import { describe, expect, it } from "vitest";
import { dayKeyIn, groupByDay, withMarkers } from "./timelineDays";

const LA = "America/Los_Angeles";
// Wednesday, Nov 18 2026, 10:00 in Los Angeles.
const NOW = new Date("2026-11-18T18:00:00Z");
const at = (iso: string, id = iso) => ({ id, occurredAt: iso });

describe("dayKeyIn", () => {
  it("keys the calendar day in the zone, not in UTC", () => {
    // 02:00 UTC on the 18th is still the 17th in Los Angeles.
    expect(dayKeyIn("2026-11-18T02:00:00Z", LA)).toBe("2026-11-17");
    expect(dayKeyIn("2026-11-18T02:00:00Z", "UTC")).toBe("2026-11-18");
  });
});

describe("groupByDay", () => {
  it("is empty for no entries", () => {
    expect(groupByDay([], LA, NOW)).toEqual([]);
  });

  it("groups consecutive entries of a day, newest first as given, with their labels", () => {
    const entries = [
      at("2026-11-18T17:00:00Z", "a"),
      at("2026-11-18T09:00:00Z", "b"), // 01:00 on the 18th in LA
      at("2026-11-18T07:00:00Z", "c"), // 23:00 on the 17th in LA
      at("2026-11-15T20:00:00Z", "d"),
    ];
    const days = groupByDay(entries, LA, NOW, "en-US");
    expect(days.map((d) => [d.key, d.label, d.entries.map((e) => e.id)])).toEqual([
      ["2026-11-18", "Today", ["a", "b"]],
      ["2026-11-17", "Yesterday", ["c"]],
      ["2026-11-15", "Sunday, Nov 15", ["d"]],
    ]);
  });

  it("adds the year for another year", () => {
    const [day] = groupByDay([at("2025-12-31T20:00:00Z")], LA, NOW, "en-US");
    expect(day?.label).toBe("Wednesday, Dec 31, 2025");
  });

  it("keeps the given order: a day that comes back starts a new section", () => {
    const entries = [
      at("2026-11-18T17:00:00Z", "a"),
      at("2026-11-16T17:00:00Z", "b"),
      at("2026-11-18T16:00:00Z", "c"),
    ];
    expect(groupByDay(entries, LA, NOW).map((d) => d.entries.map((e) => e.id))).toEqual([
      ["a"],
      ["b"],
      ["c"],
    ]);
  });
});

describe("withMarkers", () => {
  const marker = (id: string, iso: string) => ({ id, at: iso });
  it("is the days unchanged with no markers", () => {
    const days = groupByDay(
      [at("2026-11-18T17:00:00Z", "a"), at("2026-11-15T20:00:00Z", "b")],
      LA,
      NOW,
      "en-US",
    );
    const placed = withMarkers(days, [], LA, NOW, "en-US");
    expect(placed.map((d) => [d.key, d.label, d.entries.map((i) => i.key)])).toEqual(
      days.map((d) => [d.key, d.label, d.entries.map((e) => e.id)]),
    );
  });

  it("places a marker between the entries around its moment, an entry at the same moment above it", () => {
    const days = groupByDay(
      [at("2026-11-18T17:00:00Z", "a"), at("2026-11-18T16:00:00Z", "b"), at("2026-11-18T15:00:00Z", "c")],
      LA,
      NOW,
    );
    const placed = withMarkers(days, [marker("m", "2026-11-18T16:00:00Z")], LA, NOW);
    expect(placed).toHaveLength(1);
    expect(placed[0]!.entries.map((i) => i.key)).toEqual(["a", "b", "marker-m", "c"]);
    expect(placed[0]!.entries[2]).toMatchObject({ type: "marker", marker: { id: "m" } });
  });

  it("gives a day with only a marker its own section, in day order", () => {
    const days = groupByDay(
      [at("2026-11-18T17:00:00Z", "a"), at("2026-11-14T20:00:00Z", "b")],
      LA,
      NOW,
      "en-US",
    );
    const placed = withMarkers(days, [marker("m", "2026-11-16T20:00:00Z")], LA, NOW, "en-US");
    expect(placed.map((d) => [d.key, d.entries.map((i) => i.key)])).toEqual([
      ["2026-11-18", ["a"]],
      ["2026-11-16", ["marker-m"]],
      ["2026-11-14", ["b"]],
    ]);
    expect(placed[1]!.label).toBe("Monday, Nov 16");
  });

  it("puts markers older than every entry after them, and markers alone into days", () => {
    const days = groupByDay([at("2026-11-18T17:00:00Z", "a")], LA, NOW);
    const placed = withMarkers(
      days,
      [marker("m2", "2026-11-18T09:00:00Z"), marker("m1", "2026-11-10T20:00:00Z")],
      LA,
      NOW,
    );
    expect(placed.map((d) => [d.key, d.entries.map((i) => i.key)])).toEqual([
      ["2026-11-18", ["a", "marker-m2"]],
      ["2026-11-10", ["marker-m1"]],
    ]);
    expect(withMarkers([], [marker("m", "2026-11-18T09:00:00Z")], LA, NOW)).toHaveLength(1);
  });
});
