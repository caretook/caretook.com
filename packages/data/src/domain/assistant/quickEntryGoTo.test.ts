import { describe, expect, test } from "vitest";
import { readGoTo } from "./quickEntryGoTo";

/** Thursday, Nov 19, 2026, 8:00 in Los Angeles (16:00 UTC). */
const NOW = new Date("2026-11-19T16:00:00Z");
const LA = { now: NOW, timeZone: "America/Los_Angeles" };

describe("a whole line that goes to a day", () => {
  test.each([
    ["go to Nov 3", "2026-11-03"],
    ["Go to 11/3", "2026-11-03"],
    ["go to 11/10", "2026-11-10"],
    ["go to 3 Nov", "2026-11-03"],
    ["go to Nov 3, 2025", "2025-11-03"],
    ["go to nov 3 2025.", "2025-11-03"],
    ["go to 3 Nov, 2025", "2025-11-03"],
    ["jump to last Tuesday", "2026-11-17"],
    ["show yesterday", "2026-11-18"],
    ["go to today", "2026-11-19"],
    ["go to the 3rd", "2026-11-03"],
    ["show 2 days ago", "2026-11-17"],
    ["show tuesday", "2026-11-17"],
    ["show this monday", "2026-11-16"],
    ["go to Nov 30", "2025-11-30"],
    ["go to Feb 29, 2024", "2024-02-29"],
    ["  go   to   Nov 3  ", "2026-11-03"],
  ])("%s", (line, day) => {
    expect(readGoTo(line, LA)).toEqual({ day, ahead: false });
  });
});

describe("lines that keep their ordinary reading", () => {
  test.each([
    "go to PT tomorrow",
    "go to Nov 3 appointment",
    "show yesterday's bp to Sam",
    "go to Nov 3, bp 120/80",
    "go to yesterday, bp 120/80",
    "go to yesterday 9pm",
    "show last night",
    "go to tonight",
    "show this morning",
    "show in 2 hours",
    "n: show yesterday",
    "go to Feb 30",
    "go to Feb 29, 2025",
    "go to 11/3 2025",
    "go to the 3rd 2025",
    "go to 11/25/0001",
    "go to Nov 3\nbp 120/80",
    "go to 3",
    "go to",
    "show",
  ])("%s", (line) => {
    expect(readGoTo(line, LA)).toBeNull();
  });
});

describe("the day's direction and zone", () => {
  test.each([
    ["go to tomorrow", "2026-11-20"],
    ["show next tuesday", "2026-11-24"],
    ["show this friday", "2026-11-20"],
    ["go to Nov 3, 2027", "2027-11-03"],
  ])("%s is ahead", (line, day) => {
    expect(readGoTo(line, LA)).toEqual({ day, ahead: true });
  });

  test("yesterday is the viewer's: two zones on different days read different days", () => {
    const now = new Date("2026-11-19T02:00:00Z"); // Nov 18 in Los Angeles, Nov 19 in Tokyo.
    expect(readGoTo("show yesterday", { now, timeZone: "America/Los_Angeles" })?.day).toBe("2026-11-17");
    expect(readGoTo("show yesterday", { now, timeZone: "Asia/Tokyo" })?.day).toBe("2026-11-18");
  });
});
