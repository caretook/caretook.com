import type { SearchablePeriod } from "./periodSearch";

import { describe, expect, it } from "vitest";
import {
  choiceText,
  duringChipName,
  duringText,
  findPeriodChoice,
  periodChoices,
  periodWhere,
  rangeUntilNow,
} from "./periodSearch";
import { periodSpans } from "@caretook/data/domain";

const LA = "America/Los_Angeles";
const NOW = new Date("2026-11-19T20:00:00Z");

const period = (id: string, startedAt: string, over: Partial<SearchablePeriod> = {}): SearchablePeriod => ({
  id,
  startedAt,
  createdAt: startedAt,
  deletedAt: null,
  type: "home",
  label: null,
  ...over,
});

const spans = periodSpans([
  period("home", "2026-10-01T17:00:00Z"),
  period("hospital", "2026-11-03T22:20:00Z", { type: "hospital", placeName: "Mercy General" }),
  period("rehab", "2026-11-08T18:00:00Z", { type: "rehab", placeName: "Oak Hills" }),
  period("gone", "2026-11-10T18:00:00Z", { deletedAt: "2026-11-11T00:00:00Z" }),
  period("home2", "2026-11-13T19:00:00Z"),
  period("cousin", "2025-06-01T19:00:00Z", { type: "other", label: "Cousin's house" }),
]);

describe("periodChoices", () => {
  const choices = periodChoices(spans, LA, NOW);

  it("lists the live periods newest first", () => {
    expect(choices.map((c) => c.id)).toEqual(["home2", "rehab", "hospital", "home", "cousin"]);
  });

  it("names a period at its place, else by its title", () => {
    expect(choices.map((c) => c.name)).toEqual([
      "Home",
      "Rehab at Oak Hills",
      "Hospital at Mercy General",
      "Home",
      "Cousin's house",
    ]);
    expect(periodWhere(period("x", NOW.toISOString(), { type: "hospital", label: "Cardiac unit" }))).toBe(
      "Hospital · Cardiac unit",
    );
  });

  it("gives each its dates in the zone, the current one up to now", () => {
    expect(choices.map((c) => c.dates)).toEqual([
      "Nov 13 – now",
      "Nov 8 – Nov 13",
      "Nov 3 – Nov 8",
      "Oct 1 – Nov 3",
      "Jun 1, 2025 – Oct 1",
    ]);
  });

  it("gives each its range from the track: a deleted period's time is the one before's", () => {
    const rehab = findPeriodChoice(choices, "rehab")!;
    expect(rehab.range).toEqual({ from: "2026-11-08T18:00:00.000Z", to: "2026-11-13T19:00:00.000Z" });
    expect(findPeriodChoice(choices, "home2")!.range).toEqual({ from: "2026-11-13T19:00:00.000Z", to: null });
  });

  it("finds nothing for a period that isn't on the track", () => {
    expect(findPeriodChoice(choices, "gone")).toBeNull();
    expect(findPeriodChoice(choices, null)).toBeNull();
    expect(findPeriodChoice([], "rehab")).toBeNull();
  });

  it("words a choice and its chip", () => {
    const rehab = findPeriodChoice(choices, "rehab")!;
    expect(choiceText(rehab)).toBe("Rehab at Oak Hills · Nov 8 – Nov 13");
    expect(duringText(rehab)).toBe("During Rehab at Oak Hills");
    expect(duringChipName(rehab)).toBe("During Rehab at Oak Hills, Nov 8 – Nov 13: search every date");
  });
});

describe("rangeUntilNow", () => {
  it("ends the current period's range at now, and leaves an ended one alone", () => {
    expect(rangeUntilNow({ from: "2026-11-13T19:00:00.000Z", to: null }, NOW)).toEqual({
      from: "2026-11-13T19:00:00.000Z",
      to: NOW.toISOString(),
    });
    const ended = { from: "2026-11-08T18:00:00.000Z", to: "2026-11-13T19:00:00.000Z" };
    expect(rangeUntilNow(ended, NOW)).toEqual(ended);
  });
});
