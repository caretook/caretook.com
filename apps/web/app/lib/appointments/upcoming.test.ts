import type { TimedEntry } from "./upcoming";

import { describe, expect, it } from "vitest";
import {
  entryTiming,
  historyCutoff,
  listedDay,
  nextUp,
  upcomingItems,
  upcomingOrder,
  upcomingOrderIn,
} from "./upcoming";

const LA = "America/Los_Angeles";
const at = (iso: string) => new Date(iso);
let n = 0;
const entry = (occurredAt: string, extra: Partial<TimedEntry> = {}): TimedEntry => ({
  id: `e${String(++n).padStart(3, "0")}`,
  occurredAt,
  timeZone: LA,
  ...extra,
});

describe("entryTiming", () => {
  const now = at("2026-11-18T18:00:00.000Z");

  it("is upcoming after now, past at exactly now or before", () => {
    expect(entryTiming(entry("2026-11-18T18:00:00.001Z"), now)).toBe("upcoming");
    expect(entryTiming(entry("2026-11-18T18:00:00.000Z"), now)).toBe("past");
    expect(entryTiming(entry("2026-11-18T17:00:00.000Z"), now)).toBe("past");
  });

  it("is now between the start and the end; past when the end equals now", () => {
    const end = { endsAt: "2026-11-18T18:30:00.000Z" };
    expect(entryTiming(entry("2026-11-18T17:30:00.000Z", end), now)).toBe("now");
    expect(entryTiming(entry("2026-11-18T18:00:00.000Z", end), now)).toBe("now");
    expect(entryTiming(entry("2026-11-18T17:00:00.000Z", { endsAt: now.toISOString() }), now)).toBe("past");
    expect(entryTiming(entry("2026-11-18T19:00:00.000Z", { endsAt: "2026-11-18T20:00:00.000Z" }), now)).toBe(
      "upcoming",
    );
  });

  it("keeps an all-day item upcoming through the end of its day in its zone", () => {
    // Nov 18 in Los Angeles starts at 08:00 UTC and ends at 08:00 UTC on Nov 19.
    const today = entry("2026-11-18T08:00:00.000Z", { allDay: true });
    expect(entryTiming(today, at("2026-11-19T07:59:59.999Z"))).toBe("upcoming");
    expect(entryTiming(today, at("2026-11-19T08:00:00.000Z"))).toBe("past");
    // Past midnight UTC, still Nov 18 in Los Angeles.
    expect(entryTiming(today, at("2026-11-19T01:00:00.000Z"))).toBe("upcoming");
  });

  it("follows a DST change in the entry's zone, not the viewer's", () => {
    // Oct 25, 2026 in Berlin is 25 hours: 22:00 UTC Oct 24 to 23:00 UTC Oct 25.
    const day = entry("2026-10-24T22:00:00.000Z", { allDay: true, timeZone: "Europe/Berlin" });
    expect(entryTiming(day, at("2026-10-25T22:30:00.000Z"))).toBe("upcoming");
    expect(entryTiming(day, at("2026-10-25T23:00:00.000Z"))).toBe("past");
  });
});

describe("upcomingOrder", () => {
  it("puts the soonest day first, all-day items first in their day, then by start and id", () => {
    const tomorrow10 = entry("2026-11-19T18:00:00.000Z");
    const tomorrowAllDay = entry("2026-11-19T08:00:00.000Z", { allDay: true });
    const tomorrow9 = entry("2026-11-19T17:00:00.000Z");
    const today = entry("2026-11-18T22:00:00.000Z");
    const tieA = { ...entry("2026-11-20T18:00:00.000Z"), id: "a" };
    const tieB = { ...entry("2026-11-20T18:00:00.000Z"), id: "b" };
    const sorted = [tieB, tomorrow10, tieA, tomorrowAllDay, today, tomorrow9].sort(upcomingOrder);
    expect(sorted).toEqual([today, tomorrowAllDay, tomorrow9, tomorrow10, tieA, tieB]);
  });

  it("places a day by the entry's own zone", () => {
    // 23:00 on Nov 19 in Los Angeles (07:00 UTC Nov 20) is before an all-day Nov 20.
    const late = entry("2026-11-20T07:00:00.000Z");
    const allDay = entry("2026-11-20T08:00:00.000Z", { allDay: true });
    expect([allDay, late].sort(upcomingOrder)).toEqual([late, allDay]);
  });
});

describe("upcomingOrderIn", () => {
  // Viewer in Los Angeles. 9 AM Friday Nov 20 in Tokyo is 4 PM Thursday here;
  // 11 PM Wednesday in Honolulu is 1 AM Thursday here; noon Thursday here is
  // between them; all day Thursday here comes first.
  const tokyo = entry("2026-11-20T00:00:00.000Z", { timeZone: "Asia/Tokyo" });
  const honolulu = entry("2026-11-19T09:00:00.000Z", { timeZone: "Pacific/Honolulu" });
  const noon = entry("2026-11-19T20:00:00.000Z");
  const allDay = entry("2026-11-19T08:00:00.000Z", { allDay: true });

  it("sorts by the viewer's day, so a day's entries are in instant order", () => {
    expect([tokyo, noon, allDay, honolulu].sort(upcomingOrderIn(LA))).toEqual([
      allDay,
      honolulu,
      noon,
      tokyo,
    ]);
  });

  it("differs from each entry's own day where the zones disagree", () => {
    // 9 AM Thursday in Tokyo is 4 PM Wednesday here, before 8 PM Wednesday here.
    const tokyoEarly = entry("2026-11-19T00:00:00.000Z", { timeZone: "Asia/Tokyo" });
    const evening = entry("2026-11-19T04:00:00.000Z");
    expect([evening, tokyoEarly].sort(upcomingOrderIn(LA))).toEqual([tokyoEarly, evening]);
    expect([tokyoEarly, evening].sort(upcomingOrder)).toEqual([evening, tokyoEarly]);
  });

  it("uses the same day a list groups by (listedDay)", () => {
    expect([tokyo, honolulu, noon, allDay].map((e) => listedDay(e, LA).key)).toEqual([
      "2026-11-19",
      "2026-11-19",
      "2026-11-19",
      "2026-11-19",
    ]);
    // An all-day entry keeps its own day wherever the viewer is.
    expect(listedDay(allDay, "Asia/Tokyo")).toEqual({ key: "2026-11-19", zone: LA });
    expect(listedDay(tokyo, "Asia/Tokyo")).toEqual({ key: "2026-11-20", zone: "Asia/Tokyo" });
    expect(listedDay(tokyo)).toEqual({ key: "2026-11-20", zone: "Asia/Tokyo" });
  });
});

describe("nextUp", () => {
  const now = at("2026-11-18T18:00:00.000Z");

  it("is the first item still to come, and how many more", () => {
    const later = entry("2026-11-20T18:00:00.000Z");
    const soon = entry("2026-11-18T19:00:00.000Z");
    const past = entry("2026-11-17T18:00:00.000Z");
    expect(nextUp([later, past, soon], now)).toEqual({ next: soon, more: 1 });
  });

  it("skips cancelled items, and counts an item in progress", () => {
    const cancelled = entry("2026-11-18T18:30:00.000Z", { cancelledAt: "2026-11-17T00:00:00.000Z" });
    const inProgress = entry("2026-11-18T17:30:00.000Z", { endsAt: "2026-11-18T18:15:00.000Z" });
    const later = entry("2026-11-19T18:00:00.000Z");
    expect(nextUp([cancelled, later, inProgress], now)).toEqual({ next: inProgress, more: 1 });
  });

  it("is nothing when nothing is upcoming", () => {
    expect(nextUp([entry("2026-11-17T18:00:00.000Z")], now)).toEqual({ next: null, more: 0 });
    expect(nextUp([], now)).toEqual({ next: null, more: 0 });
  });

  it("upcomingItems keeps cancelled ones (shown struck through)", () => {
    const cancelled = entry("2026-11-19T18:00:00.000Z", { cancelledAt: "2026-11-17T00:00:00.000Z" });
    expect(upcomingItems([cancelled, entry("2026-11-17T00:00:00.000Z")], now)).toEqual([cancelled]);
  });
});

describe("historyCutoff", () => {
  it("is the end of the current minute", () => {
    expect(historyCutoff(at("2026-11-18T18:00:20.500Z"))).toBe("2026-11-18T18:01:00.000Z");
    expect(historyCutoff(at("2026-11-18T18:00:00.000Z"))).toBe("2026-11-18T18:01:00.000Z");
    expect(historyCutoff(at("2026-11-18T18:59:59.999Z"))).toBe("2026-11-18T19:00:00.000Z");
  });
});
