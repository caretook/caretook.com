import { describe, expect, test } from "vitest";
import { NEW_TAB_PHRASES, QUICK_ENTRY_PAGES, readCommand, readGoTo } from "./quickEntryGoTo";

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

describe("readCommand: a whole line that opens a page", () => {
  test.each([
    ["timeline", "timeline"],
    ["todos", "todos"],
    ["to-dos", "todos"],
    ["to dos", "todos"],
    ["todo list", "todos"],
    ["planner", "planner"],
    ["upcoming", "planner"],
    ["calendar", "planner"],
    ["medications", "medications"],
    ["meds", "medications"],
    ["schedule", "medicationSchedule"],
    ["med schedule", "medicationSchedule"],
    ["medication schedule", "medicationSchedule"],
    ["providers", "providers"],
    ["doctors", "providers"],
    ["care periods", "carePeriods"],
    ["profile", "profile"],
    ["allergies", "allergies"],
    ["settings", "settings"],
    ["members", "members"],
    ["tags", "tags"],
    ["search", "search"],
  ] as const)("go to %s", (name, page) => {
    expect(readCommand(`go to ${name}`, LA)).toEqual({ kind: "page", page, newTab: false });
  });

  test("every page row is read", () => {
    expect(QUICK_ENTRY_PAGES.map((row) => readCommand(`go to ${row.phrase}`, LA)?.kind)).toEqual(
      QUICK_ENTRY_PAGES.map(() => "page"),
    );
  });

  test.each([
    ["open meds", "medications"],
    ["Show the planner.", "planner"],
    ["jump to my profile", "profile"],
    ["go to our members", "members"],
    ["open the settings page", "settings"],
    ["  OPEN   care   periods  ", "carePeriods"],
  ] as const)("%s", (line, page) => {
    expect(readCommand(line, LA)).toEqual({ kind: "page", page, newTab: false });
  });
});

describe("readCommand: in a new tab", () => {
  test.each([
    ["open meds in a new tab", "medications"],
    ["go to the planner in new tab", "planner"],
    ["show doctors in a new window", "providers"],
    ["new tab timeline", "timeline"],
    ["new tab go to todos", "todos"],
    ["pop out the planner", "planner"],
    ["pop out open settings", "settings"],
  ] as const)("%s", (line, page) => {
    expect(readCommand(line, LA)).toEqual({ kind: "page", page, newTab: true });
  });

  test("every new-tab wording has a row", () => {
    const lines = NEW_TAB_PHRASES.map(({ phrase, at }) =>
      at === "end" ? `go to meds ${phrase}` : `${phrase} meds`,
    );
    expect(lines.map((line) => readCommand(line, LA))).toEqual(
      lines.map(() => ({ kind: "page", page: "medications", newTab: true })),
    );
  });

  test.each([
    ["go to tuesday in a new tab", "2026-11-17"],
    ["pop out yesterday", "2026-11-18"],
    ["new tab show Nov 3, 2025", "2025-11-03"],
  ])("a day: %s", (line, day) => {
    expect(readCommand(line, LA)).toEqual({ kind: "day", day, ahead: false, newTab: true });
  });
});

describe("readCommand: the day rule is readGoTo's", () => {
  test.each([
    ["go to tuesday", "2026-11-17", false],
    ["go to Nov 3, 2025", "2025-11-03", false],
    ["show yesterday", "2026-11-18", false],
    ["go to tomorrow", "2026-11-20", true],
  ] as const)("%s", (line, day, ahead) => {
    expect(readCommand(line, LA)).toEqual({ kind: "day", day, ahead, newTab: false });
  });
});

describe("readCommand: lines that keep their ordinary reading", () => {
  test.each([
    "go to dr lee at 3",
    "show of hands at church",
    "open wound looks better",
    "went to the pharmacy",
    "open tuesday",
    "go to meds and pharmacy",
    "meds",
    "in a new tab",
    "new tab",
    "pop out",
    "pop out of bed",
    "go to PT tomorrow",
    "go to yesterday 9pm",
    "go to meds\ntags",
    "n: go to meds",
    "go to",
  ])("%s", (line) => {
    expect(readCommand(line, LA)).toBeNull();
  });
});
