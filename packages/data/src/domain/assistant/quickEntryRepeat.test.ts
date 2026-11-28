import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { firstDayFrom } from "../appointments/seriesVisits";
import { readRepeat } from "./quickEntryRepeat";

// Quick entry's repeats (B-254), a row per phrase family. "Today" is
// Thursday, Nov 19, 2026. Each first day is checked against rrule too
// (`firstDayFrom`, which only this test imports): the rule's own first day
// from today, with the first day as its anchor.

const TODAY = "2026-11-19";
const words = (line: string) => line.toLowerCase().split(/\s+/);
const read = (line: string, today = TODAY) => readRepeat(words(line), today);

describe("readRepeat", () => {
  test.each<[string, string, string]>([
    // Daily.
    ["daily", "FREQ=DAILY;INTERVAL=1", TODAY],
    ["every day", "FREQ=DAILY;INTERVAL=1", TODAY],
    ["every other day", "FREQ=DAILY;INTERVAL=2", TODAY],
    ["every 3 days", "FREQ=DAILY;INTERVAL=3", TODAY],
    ["every three days", "FREQ=DAILY;INTERVAL=3", TODAY],
    // Weekdays: the first one from today, today included.
    ["every monday", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", "2026-11-23"],
    ["every thursday", "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH", TODAY],
    ["every mondays", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", "2026-11-23"],
    ["every mon, wed and fri", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR", "2026-11-20"],
    ["every tue & sat", "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,SA", "2026-11-21"],
    ["every mon/wed", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE", "2026-11-23"],
    ["every weekday", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR", TODAY],
    ["every other monday", "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", "2026-11-23"],
    // Weekly: on the days said, else today's.
    ["weekly", "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH", TODAY],
    ["every week", "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH", TODAY],
    ["weekly on tuesday", "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU", "2026-11-24"],
    ["every other week", "FREQ=WEEKLY;INTERVAL=2;BYDAY=TH", TODAY],
    ["every 2 weeks on fri and sat", "FREQ=WEEKLY;INTERVAL=2;BYDAY=FR,SA", "2026-11-20"],
    // Monthly: on the date said, else today's.
    ["monthly", "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=19", TODAY],
    ["every month", "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=19", TODAY],
    ["every month on the 15th", "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15", "2026-12-15"],
    ["monthly on the 25th", "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=25", "2026-11-25"],
    ["on the 1st of every month", "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1", "2026-12-01"],
    ["every 3 months", "FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=19", TODAY],
    // A 31st in a short month: November has none, so December's.
    ["every month on the 31st", "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31", "2026-12-31"],
  ])("%s", (line, rule, firstDay) => {
    const found = read(line)!;
    expect(found).toMatchObject({ rule, firstDay });
    // Every word of the phrase is taken.
    expect([...found.used].sort((a, b) => a - b)).toEqual(words(line).map((_, i) => i));
    expect(firstDayFrom({ rule, startsOn: firstDay }, TODAY)).toBe(firstDay);
  });

  test("a 31st skips every month without one, February included", () => {
    expect(read("every month on the 31st", "2027-02-05")).toMatchObject({ firstDay: "2027-03-31" });
    expect(read("every month on the 30th", "2027-02-05")).toMatchObject({ firstDay: "2027-03-30" });
    expect(read("monthly", "2027-01-31")).toMatchObject({
      rule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31",
      firstDay: "2027-01-31",
    });
  });

  test("hours and minutes are no repeat, nor is a word that only starts like one", () => {
    for (const line of [
      "every 4 hours",
      "every hour",
      "every 30 minutes",
      "every 2 hrs",
      "every time",
      "everyone",
    ])
      expect(read(line)).toBeNull();
  });

  test("the interval is 1 to 99", () => {
    expect(read("every 99 days")).toMatchObject({ rule: "FREQ=DAILY;INTERVAL=99" });
    expect(read("every 1 day")).toMatchObject({ rule: "FREQ=DAILY;INTERVAL=1" });
    expect(read("every 0 days")).toBeNull();
    expect(read("every 100 days")).toBeNull();
    expect(read("every 100 weeks")).toBeNull();
  });

  test("only the phrase's words are taken; a start day moves the first one", () => {
    const found = read("bins out every monday 7am")!;
    expect([...found.used]).toEqual([2, 3]);
    expect(readRepeat(words("every monday"), TODAY, { from: "2026-12-01" })).toMatchObject({
      firstDay: "2026-12-07",
    });
    // A weekly rule with no day takes the start day's.
    expect(readRepeat(words("weekly"), TODAY, { from: "2026-11-21" })).toMatchObject({
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=SA",
      firstDay: "2026-11-21",
    });
    // Words that aren't free aren't read.
    expect(readRepeat(words("every monday"), TODAY, { free: (i) => i !== 0 })).toBeNull();
  });

  test("the parser stays free of rrule and @caretook/data/series", () => {
    for (const file of [
      "../../db/schema/assistant/quickEntry.ts",
      "quickEntryRepeat.ts",
      "quickEntryTime.ts",
      "quickEntryVocabulary.ts",
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
      for (const path of imports) {
        expect(path).not.toMatch(/rrule|series|seriesVisits|seriesEdit|todoRepeat/);
      }
    }
  });
});
