import { describe, expect, it } from "vitest";
import { dayKeyIn, groupByDay } from "./timelineDays";

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
