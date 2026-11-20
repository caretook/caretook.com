import { CARE_PERIOD_TYPES } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import {
  currentLineText,
  dateText,
  dayText,
  lengthText,
  markerSentence,
  markerText,
  menuNowText,
  nowText,
  PERIOD_TYPE_META,
  periodName,
  periodTitle,
  periodTypeMeta,
  startText,
  timeText,
  untilText,
} from "./periodDisplay";

const LA = "America/Los_Angeles";
const NOW = new Date("2026-11-17T20:00:00.000Z");

describe("period types", () => {
  it("has a label, short name, 'now' wording and icon for every type", () => {
    for (const type of CARE_PERIOD_TYPES) {
      const meta = PERIOD_TYPE_META[type];
      expect(meta.label).toBeTruthy();
      expect(meta.short).toBeTruthy();
      expect(meta.now).toBeTruthy();
      expect(meta.icon).toBeTruthy();
    }
    expect(PERIOD_TYPE_META.emergency.label).toBe("Emergency room or observation");
    expect(PERIOD_TYPE_META.rehab.label).toBe("Rehab or skilled nursing");
    expect(new Set(CARE_PERIOD_TYPES.map((t) => PERIOD_TYPE_META[t].icon)).size).toBe(
      CARE_PERIOD_TYPES.length,
    );
  });

  it("reads a type from a newer build as Other", () => {
    expect(periodTypeMeta("spaceStation")).toBe(PERIOD_TYPE_META.other);
  });
});

describe("names and lines", () => {
  it("names a period by its type, or Other by its label", () => {
    expect(periodName({ type: "hospital", label: "Cardiac unit" })).toBe("Hospital");
    expect(periodName({ type: "other", label: "Daughter's house" })).toBe("Daughter's house");
    expect(periodName({ type: "other", label: null })).toBe("Other");
    expect(periodTitle({ type: "hospital", label: "Cardiac unit" })).toBe("Hospital · Cardiac unit");
    expect(periodTitle({ type: "home", label: null })).toBe("Home");
    expect(periodTitle({ type: "other", label: "Daughter's house" })).toBe("Daughter's house");
  });

  it("says where the recipient is now", () => {
    expect(nowText({ type: "hospital", label: null })).toBe("In hospital");
    expect(nowText({ type: "home", label: null })).toBe("At home");
    expect(nowText({ type: "other", label: "Daughter's house" })).toBe("Daughter's house");
    expect(dayText(4)).toBe("day 4");
    expect(menuNowText({ type: "hospital", label: "4 West" }, 4)).toBe("Now: In hospital · day 4");
  });

  it("builds the current-period line from the place, else the label", () => {
    const hospital = { type: "hospital", label: "Cardiac unit" };
    expect(currentLineText(hospital, { placeName: "Mercy General", day: 4 })).toBe(
      "In hospital · Mercy General · day 4",
    );
    expect(currentLineText(hospital, { day: 4 })).toBe("In hospital · Cardiac unit · day 4");
    expect(currentLineText({ type: "home", label: null }, { day: 1 })).toBe("At home · day 1");
    expect(currentLineText({ type: "other", label: "Daughter's house" }, { day: 2 })).toBe(
      "Daughter's house · day 2",
    );
  });
});

describe("times, days and lengths", () => {
  it("shows times and days in the recipient's zone", () => {
    expect(timeText("2026-11-12T22:20:00.000Z", LA)).toBe("14:20");
    expect(timeText("2026-11-12T22:20:00.000Z", "UTC")).toBe("22:20");
    expect(dateText("2026-11-12T22:20:00.000Z", LA, NOW)).toBe("Nov 12");
    expect(dateText("2025-11-12T22:20:00.000Z", LA, NOW)).toBe("Nov 12, 2025");
    // 01:00 UTC on Nov 13 is still Nov 12 in Los Angeles.
    expect(dateText("2026-11-13T01:00:00.000Z", LA, NOW)).toBe("Nov 12");
  });

  it("shows a start with its time, or a date-only one without", () => {
    expect(startText("2026-11-12T22:20:00.000Z", false, LA, NOW)).toBe("Nov 12, 14:20");
    expect(startText("2026-11-12T08:00:00.000Z", true, LA, NOW)).toBe("Nov 12");
    expect(untilText("2026-11-14T08:00:00.000Z", LA, NOW)).toBe("until Nov 14");
    expect(untilText(null, LA, NOW)).toBe("now");
  });

  it("says how long", () => {
    expect([0, 1, 2, 13, 14, 20, 59, 60, 400, 800].map(lengthText)).toEqual([
      "Less than a day",
      "1 day",
      "2 days",
      "13 days",
      "2 weeks",
      "2 weeks",
      "8 weeks",
      "2 months",
      "13 months",
      "2 years",
    ]);
  });
});

describe("timeline markers", () => {
  const hospital = {
    type: "hospital",
    label: "Cardiac unit",
    dateOnly: false,
    startedAt: "2026-11-12T22:20:00.000Z",
  };

  it("reads a move, with the place, the detail and the time", () => {
    const marker = {
      from: { type: "home", label: null },
      to: hospital,
      placeName: "Mercy General",
      placeDetail: "Room 412",
    };
    expect(markerText(marker, LA)).toBe("Home → Hospital · Mercy General, room 412 · 14:20");
    expect(markerSentence(marker, LA)).toBe("Moved from Home to Hospital, Mercy General, room 412, at 14:20");
  });

  it("reads the first period as Started, and a date-only start without a time", () => {
    const marker = {
      from: null,
      to: { type: "home", label: null, dateOnly: true, startedAt: "2026-09-22T07:00:00.000Z" },
    };
    expect(markerText(marker, LA)).toBe("Started: Home");
    expect(markerSentence(marker, LA)).toBe("Started: Home");
  });

  it("falls back to the label without a place, and names Other by its label", () => {
    expect(markerText({ from: { type: "home", label: null }, to: hospital }, LA)).toBe(
      "Home → Hospital · Cardiac unit · 14:20",
    );
    expect(
      markerText(
        {
          from: { type: "hospital", label: null },
          to: { ...hospital, type: "other", label: "Daughter's house" },
        },
        LA,
      ),
    ).toBe("Hospital → Daughter's house · 14:20");
  });
});
