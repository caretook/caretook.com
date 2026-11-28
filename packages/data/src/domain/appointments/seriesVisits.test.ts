import type { SeriesTiming } from "./seriesVisits";

import * as rruleModule from "rrule";
import { describe, expect, it } from "vitest";
import { addDays } from "../core/entryTiming";
import { dayInZone } from "../core/zonedDay";
import { parseRule, ruleText, WEEKDAYS } from "./repeatRule";
import { nextVisits, seriesDays, seriesVisits } from "./seriesVisits";

// The appointments area's clock: Wed 2026-11-18, in Los Angeles.
const LA = "America/Los_Angeles";
const LONDON = "Europe/London";

const series = (rule: string, over: Partial<SeriesTiming> = {}): SeriesTiming => ({
  rule,
  startsOn: "2026-11-18",
  startTime: "09:00",
  allDay: false,
  timeZone: LA,
  durationMinutes: null,
  ...over,
});

const days = (s: SeriesTiming, from: string, to: string) => seriesDays(s, from, to);

describe("seriesVisits: patterns", () => {
  it("daily, and every N days", () => {
    expect(days(series("FREQ=DAILY;INTERVAL=1"), "2026-11-18", "2026-11-21")).toEqual([
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
    ]);
    expect(days(series("FREQ=DAILY;INTERVAL=3"), "2026-11-18", "2026-11-28")).toEqual([
      "2026-11-18",
      "2026-11-21",
      "2026-11-24",
      "2026-11-27",
    ]);
  });

  it("weekly on chosen days, from a first day that isn't one of them", () => {
    // Wed 18th: Mon, Wed, Fri.
    expect(days(series("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR"), "2026-11-18", "2026-11-27")).toEqual([
      "2026-11-18",
      "2026-11-20",
      "2026-11-23",
      "2026-11-25",
      "2026-11-27",
    ]);
    // Tue and Thu from a Wednesday: the Tuesday before isn't a visit.
    expect(days(series("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,TH"), "2026-11-16", "2026-11-24")).toEqual([
      "2026-11-19",
      "2026-11-24",
    ]);
  });

  it("every N weeks counts weeks from the first day's week (Monday first)", () => {
    // The week of Mon 16th is week one; its Tuesday is before the start.
    expect(days(series("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"), "2026-11-18", "2026-12-31")).toEqual([
      "2026-12-01",
      "2026-12-15",
      "2026-12-29",
    ]);
    expect(days(series("FREQ=WEEKLY;INTERVAL=4;BYDAY=WE"), "2026-11-18", "2027-01-31")).toEqual([
      "2026-11-18",
      "2026-12-16",
      "2027-01-13",
    ]);
  });

  it("monthly on a date skips months without it (the 31st)", () => {
    expect(days(series("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31"), "2026-11-18", "2027-05-31")).toEqual([
      "2026-12-31",
      "2027-01-31",
      "2027-03-31",
      "2027-05-31",
    ]);
    expect(days(series("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=18"), "2026-11-18", "2027-04-30")).toEqual([
      "2026-11-18",
      "2027-01-18",
      "2027-03-18",
    ]);
  });

  it("monthly on the last day lands in every month, through a leap February and 30-day months", () => {
    const from31 = { startsOn: "2028-01-31" };
    expect(days(series("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1", from31), "2028-01-01", "2028-06-30")).toEqual(
      ["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30", "2028-05-31", "2028-06-30"],
    );
    // A common year's February.
    expect(
      days(
        series("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1", { startsOn: "2027-01-31" }),
        "2027-01-01",
        "2027-03-31",
      ),
    ).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("the last day every 2 months, with a count and with an end date", () => {
    const from31 = { startsOn: "2028-01-31" };
    expect(days(series("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1", from31), "2028-01-01", "2028-07-31")).toEqual(
      ["2028-01-31", "2028-03-31", "2028-05-31", "2028-07-31"],
    );
    expect(
      days(series("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1;COUNT=3", from31), "2028-01-01", "2028-12-31"),
    ).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]);
    expect(
      days(
        series("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1;UNTIL=20280430", from31),
        "2028-01-01",
        "2028-12-31",
      ),
    ).toEqual(["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30"]);
  });

  it("monthly on the nth weekday, the last, and a 5th that only some months have", () => {
    expect(days(series("FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU"), "2026-11-18", "2027-02-28")).toEqual([
      "2026-12-08",
      "2027-01-12",
      "2027-02-09",
    ]);
    expect(days(series("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR"), "2026-11-18", "2027-01-31")).toEqual([
      "2026-11-27",
      "2026-12-25",
      "2027-01-29",
    ]);
    // Fifth Thursdays: December 2026 and April 2027; not January to March.
    expect(days(series("FREQ=MONTHLY;INTERVAL=1;BYDAY=5TH"), "2026-11-18", "2027-04-30")).toEqual([
      "2026-12-31",
      "2027-04-29",
    ]);
  });
});

describe("seriesVisits: ends", () => {
  it("COUNT counts from the series' first day, even in a range starting mid-series", () => {
    const s = series("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;COUNT=4");
    expect(days(s, "2026-11-18", "2027-01-01")).toEqual([
      "2026-11-18",
      "2026-11-20",
      "2026-11-23",
      "2026-11-25",
    ]);
    expect(days(s, "2026-11-21", "2027-01-01")).toEqual(["2026-11-23", "2026-11-25"]);
  });

  it("UNTIL is a local date, inclusive", () => {
    expect(days(series("FREQ=DAILY;INTERVAL=1;UNTIL=20261120"), "2026-11-01", "2026-12-01")).toEqual([
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
    ]);
  });

  it("a range before the first day, or reversed, has none; so does an unreadable rule", () => {
    expect(days(series("FREQ=DAILY;INTERVAL=1"), "2026-11-01", "2026-11-17")).toEqual([]);
    expect(days(series("FREQ=DAILY;INTERVAL=1"), "2026-11-20", "2026-11-19")).toEqual([]);
    expect(days(series("FREQ=YEARLY"), "2026-11-18", "2027-11-18")).toEqual([]);
  });
});

describe("seriesVisits: times in the zone", () => {
  it("places each day's time in the series' zone, with its length", () => {
    const visits = seriesVisits(
      series("FREQ=DAILY;INTERVAL=1", { durationMinutes: 240 }),
      "2026-11-18",
      "2026-11-19",
    );
    expect(visits).toEqual([
      { day: "2026-11-18", start: "2026-11-18T17:00:00.000Z", end: "2026-11-18T21:00:00.000Z" },
      { day: "2026-11-19", start: "2026-11-19T17:00:00.000Z", end: "2026-11-19T21:00:00.000Z" },
    ]);
  });

  it("keeps the wall time across Los Angeles' spring forward, and moves a skipped time forward", () => {
    const at = (time: string) =>
      seriesVisits(
        series("FREQ=DAILY;INTERVAL=1", { startsOn: "2027-03-13", startTime: time }),
        "2027-03-13",
        "2027-03-15",
      ).map((v) => v.start);
    expect(at("09:00")).toEqual([
      "2027-03-13T17:00:00.000Z",
      "2027-03-14T16:00:00.000Z",
      "2027-03-15T16:00:00.000Z",
    ]);
    // 2:30 doesn't happen on the 14th: 3:30 PDT.
    expect(at("02:30")).toEqual([
      "2027-03-13T10:30:00.000Z",
      "2027-03-14T10:30:00.000Z",
      "2027-03-15T09:30:00.000Z",
    ]);
  });

  it("takes the first of a repeated time on Los Angeles' fall back", () => {
    const [visit] = seriesVisits(
      series("FREQ=DAILY;INTERVAL=1", { startsOn: "2026-11-01", startTime: "01:30" }),
      "2026-11-01",
      "2026-11-01",
    );
    expect(visit?.start).toBe("2026-11-01T08:30:00.000Z");
  });

  it("keeps the wall time across London's spring forward and fall back", () => {
    const spring = seriesVisits(
      series("FREQ=DAILY;INTERVAL=1", { startsOn: "2027-03-27", startTime: "01:30", timeZone: LONDON }),
      "2027-03-27",
      "2027-03-29",
    ).map((v) => v.start);
    // 1:30 doesn't happen on the 28th: 2:30 BST.
    expect(spring).toEqual([
      "2027-03-27T01:30:00.000Z",
      "2027-03-28T01:30:00.000Z",
      "2027-03-29T00:30:00.000Z",
    ]);
    const autumn = seriesVisits(
      series("FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU,MO", {
        startsOn: "2026-10-24",
        startTime: "06:00",
        timeZone: LONDON,
      }),
      "2026-10-24",
      "2026-10-26",
    ).map((v) => v.start);
    expect(autumn).toEqual([
      "2026-10-24T05:00:00.000Z",
      "2026-10-25T06:00:00.000Z",
      "2026-10-26T06:00:00.000Z",
    ]);
  });

  it("an all-day visit starts at the start of its day and has no end", () => {
    const [visit] = seriesVisits(
      series("FREQ=DAILY;INTERVAL=1", { startTime: null, allDay: true, durationMinutes: 60 }),
      "2026-11-18",
      "2026-11-18",
    );
    expect(visit).toEqual({ day: "2026-11-18", start: "2026-11-18T08:00:00.000Z", end: null });
  });

  it("nextVisits gives the first few on or after a day (the preview)", () => {
    const s = series("FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU");
    expect(nextVisits(s, "2026-11-18", 3).map((v) => v.day)).toEqual([
      "2026-12-08",
      "2027-01-12",
      "2027-02-09",
    ]);
    expect(nextVisits(series("FREQ=DAILY;INTERVAL=1;COUNT=2"), "2026-11-18", 3).map((v) => v.day)).toEqual([
      "2026-11-18",
      "2026-11-19",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Property tests: seeded random rules, zones and ranges, against rrule's own
// expansion of the same RRULE text and the invariants. Hand-rolled seeded
// generator (mulberry32), so a failure reproduces from its seed.
// ---------------------------------------------------------------------------

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ZONES = [LA, LONDON, "Australia/Sydney", "Asia/Kolkata", "America/New_York", "UTC"];

const randomRule = (rand: () => number, startsOn: string) => {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const freq = pick(["daily", "weekly", "monthly"] as const);
  const end = pick(["never", "on", "after"] as const);
  const weekdays = WEEKDAYS.filter(() => rand() < 0.4);
  return ruleText({
    freq,
    interval: int(1, 5),
    weekdays: freq === "weekly" ? (weekdays.length ? weekdays : [pick(WEEKDAYS)]) : [],
    monthly:
      freq !== "monthly"
        ? null
        : rand() < 0.2
          ? { by: "lastDay" }
          : rand() < 0.5
            ? { by: "date", day: int(1, 31) }
            : { by: "weekday", nth: pick([1, 2, 3, 4, 5, -1] as const), weekday: pick(WEEKDAYS) },
    end:
      end === "never"
        ? { type: "never" }
        : end === "on"
          ? { type: "on", until: addDays(startsOn, int(0, 400)) }
          : { type: "after", count: int(1, 30) },
  });
};

/** rrule's own expansion of the RRULE text, as local days. */
const rruleDays = (rule: string, startsOn: string, from: string, to: string) => {
  const rrule = (rruleModule as Partial<typeof rruleModule>).rrulestr
    ? rruleModule
    : (rruleModule as unknown as { default: typeof rruleModule }).default;
  const until = /UNTIL=(\d{8})/.exec(rule)?.[1];
  // RFC 5545: a floating UNTIL is a date-time; the end of its day keeps it inclusive.
  const text = until ? rule.replace(`UNTIL=${until}`, `UNTIL=${until}T235959Z`) : rule;
  const expander = rrule.rrulestr(`DTSTART:${startsOn.replaceAll("-", "")}T000000Z\nRRULE:WKST=MO;${text}`);
  const start = new Date(`${from < startsOn ? startsOn : from}T00:00:00Z`);
  const end = new Date(`${addDays(to, 1)}T00:00:00Z`);
  return expander
    .between(start, end, true)
    .map((d) => d.toISOString().slice(0, 10))
    .filter((d) => d <= to);
};

describe("seriesVisits: properties (seeded)", () => {
  const SEEDS = 400;

  it("agrees with rrule's own expansion and holds the invariants", () => {
    let total = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rand = mulberry32(seed);
      const startsOn = addDays("2026-01-01", Math.floor(rand() * 730));
      const rule = randomRule(rand, startsOn);
      const timeZone = ZONES[Math.floor(rand() * ZONES.length)]!;
      const from = addDays(startsOn, Math.floor(rand() * 400) - 100);
      const to = addDays(from, Math.floor(rand() * 400));
      const startTime = `${String(Math.floor(rand() * 24)).padStart(2, "0")}:${rand() < 0.5 ? "00" : "30"}`;
      const s: SeriesTiming = { rule, startsOn, startTime, allDay: false, timeZone };
      const context = { seed, rule, startsOn, from, to, timeZone };

      const visits = seriesVisits(s, from, to);
      const got = visits.map((v) => v.day);
      total += got.length;
      expect(got, JSON.stringify(context)).toEqual(rruleDays(rule, startsOn, from, to));

      // Sorted, one per local day, inside the range and on or after the first day.
      expect([...got].sort(), JSON.stringify(context)).toEqual(got);
      expect(new Set(got).size, JSON.stringify(context)).toBe(got.length);
      for (const day of got) {
        expect(day >= from && day <= to && day >= startsOn, JSON.stringify(context)).toBe(true);
      }
      // Each visit starts on its day, in the zone (a skipped time moves forward within it).
      for (const v of visits)
        expect(dayInZone(new Date(v.start), timeZone), JSON.stringify(context)).toBe(v.day);

      // COUNT: never more than it, and exactly it over the whole life of the series.
      const parsed = parseRule(rule);
      if (parsed.ok && parsed.rule.end.type === "after") {
        expect(got.length).toBeLessThanOrEqual(parsed.rule.end.count);
        const whole = seriesDays(s, startsOn, addDays(startsOn, 366 * 40));
        expect(whole.length, JSON.stringify(context)).toBeLessThanOrEqual(parsed.rule.end.count);
      }
      if (parsed.ok && parsed.rule.end.type === "on") {
        for (const day of got) expect(day <= (parsed.rule.end as { until: string }).until).toBe(true);
      }
    }
    // The generator makes real series, not empty ranges.
    expect(total).toBeGreaterThan(SEEDS * 5);
  });
});
