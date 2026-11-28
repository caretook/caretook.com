import { describe, expect, it } from "vitest";
import { dayKeyIn, dayStartAt, groupByDay, shortDayLabel, withMarkers } from "./timelineDays";

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

  it("keeps each zone's formatter apart", () => {
    expect(dayKeyIn("2026-11-18T02:00:00Z", "UTC")).toBe("2026-11-18");
    expect(dayKeyIn("2026-11-18T02:00:00Z", LA)).toBe("2026-11-17");
    expect(dayKeyIn("2026-11-18T12:00:00Z", "Asia/Tokyo")).toBe("2026-11-18");
    expect(dayKeyIn("2026-11-18T16:00:00Z", "Asia/Tokyo")).toBe("2026-11-19");
  });
});

describe("dayStartAt", () => {
  it("is now for today, in the zone", () => {
    expect(dayStartAt("2026-11-18", LA, NOW)).toBe(NOW.toISOString());
    // Late on the 17th in LA is already the 18th in UTC: today there is the 18th.
    const late = new Date("2026-11-18T06:30:00Z");
    expect(dayStartAt("2026-11-17", LA, late)).toBe(late.toISOString());
    expect(dayStartAt("2026-11-18", "UTC", late)).toBe(late.toISOString());
  });

  it("is 12:00 that day in the zone for any other day", () => {
    expect(dayStartAt("2026-11-16", LA, NOW)).toBe("2026-11-16T20:00:00.000Z");
    expect(dayStartAt("2026-11-16", "UTC", NOW)).toBe("2026-11-16T12:00:00.000Z");
    expect(dayStartAt("2026-11-16", "Asia/Kolkata", NOW)).toBe("2026-11-16T06:30:00.000Z");
  });

  it("holds across a DST change", () => {
    // LA moved back to PST (UTC-8) on Nov 1 2026, and forward to PDT (UTC-7) on Mar 8 2026.
    expect(dayStartAt("2026-11-01", LA, NOW)).toBe("2026-11-01T20:00:00.000Z");
    expect(dayStartAt("2026-10-31", LA, NOW)).toBe("2026-10-31T19:00:00.000Z");
    expect(dayStartAt("2026-03-08", LA, NOW)).toBe("2026-03-08T19:00:00.000Z");
    expect(dayStartAt("2026-03-07", LA, NOW)).toBe("2026-03-07T20:00:00.000Z");
    // London moved back on Oct 25 2026.
    expect(dayStartAt("2026-10-25", "Europe/London", NOW)).toBe("2026-10-25T12:00:00.000Z");
    expect(dayStartAt("2026-10-24", "Europe/London", NOW)).toBe("2026-10-24T11:00:00.000Z");
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

describe("shortDayLabel", () => {
  it("gives a past day its short weekday, month and day", () => {
    expect(shortDayLabel("2026-11-16", LA, NOW, "en-US")).toBe("Mon, Nov 16");
    expect(shortDayLabel("2026-11-11", LA, NOW, "en-US")).toBe("Wed, Nov 11");
  });

  it("adds the year for another year", () => {
    expect(shortDayLabel("2025-12-31", LA, NOW, "en-US")).toBe("Wed, Dec 31, 2025");
    expect(shortDayLabel("2027-01-04", LA, NOW, "en-US")).toBe("Mon, Jan 4, 2027");
  });

  it("keeps Today, Yesterday and Tomorrow, as calendar days in the zone", () => {
    expect(shortDayLabel("2026-11-18", LA, NOW, "en-US")).toBe("Today");
    expect(shortDayLabel("2026-11-17", LA, NOW, "en-US")).toBe("Yesterday");
    expect(shortDayLabel("2026-11-19", LA, NOW, "en-US")).toBe("Tomorrow");
    // 02:00 UTC on the 18th is still the 17th in Los Angeles: its today, not UTC's.
    const late = new Date("2026-11-18T02:00:00Z");
    expect(shortDayLabel("2026-11-17", LA, late)).toBe("Today");
    expect(shortDayLabel("2026-11-17", "UTC", late)).toBe("Yesterday");
  });

  it("is what groupByDay gives each day beside its full label", () => {
    const days = groupByDay([at("2026-11-18T17:00:00Z"), at("2026-11-15T20:00:00Z")], LA, NOW, "en-US");
    expect(days.map((d) => [d.label, d.short])).toEqual([
      ["Today", "Today"],
      ["Sunday, Nov 15", "Sun, Nov 15"],
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
