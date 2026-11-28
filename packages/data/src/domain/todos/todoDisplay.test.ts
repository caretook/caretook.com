import { describe, expect, it } from "vitest";
import {
  assigneeLabel,
  dayHeading,
  doneText,
  dueText,
  linkLabel,
  shortDay,
  todoRepeatLine,
} from "./todoDisplay";

const LA = "America/Los_Angeles";
// Friday 2026-11-20, 12:00 in Los Angeles.
const NOW = Date.UTC(2026, 10, 20, 20, 0);
const ME = "u-me";
const SAM = "u-sam";
const nameOf = (id: string) => (id === ME ? "you" : id === SAM ? "Sam" : "Former member");

const open = (dueOn: string | null, dueTime: string | null = null) => ({ dueOn, dueTime, doneAt: null });

describe("dueText", () => {
  it.each([
    [open(null), "No due date"],
    [open("2026-11-20"), "Due today"],
    [open("2026-11-20", "17:00"), "Due today 17:00"],
    [open("2026-11-20", "09:00"), "Overdue · since 09:00"],
    [open("2026-11-21"), "Due tomorrow"],
    [open("2026-11-24", "14:00"), "Due Tue 14:00"],
    [open("2026-12-15"), "Due Dec 15"],
    [open("2027-01-15"), "Due Jan 15, 2027"],
    [open("2026-11-19"), "Overdue · 1 day"],
    [open("2026-11-18", "08:00"), "Overdue · 2 days"],
  ])("%j → %s", (todo, text) => {
    expect(dueText(todo, NOW, LA)).toBe(text);
  });

  it("has none for a done todo", () => {
    expect(
      dueText({ dueOn: "2026-11-19", dueTime: null, doneAt: "2026-11-19T10:00:00Z" }, NOW, LA),
    ).toBeNull();
  });
});

describe("doneText", () => {
  it("names who and when, in the recipient's zone", () => {
    expect(doneText({ doneAt: "2026-11-17T18:00:00Z", doneBy: SAM }, nameOf, NOW, LA)).toBe(
      "Done by Sam · Tue",
    );
    expect(doneText({ doneAt: "2026-11-20T18:00:00Z", doneBy: ME }, nameOf, NOW, LA)).toBe(
      "Done by you · today",
    );
    // 01:00Z on the 20th is still the 19th in Los Angeles.
    expect(doneText({ doneAt: "2026-11-20T01:00:00Z", doneBy: SAM }, nameOf, NOW, LA)).toBe(
      "Done by Sam · yesterday",
    );
    expect(doneText({ doneAt: null, doneBy: null }, nameOf, NOW, LA)).toBeNull();
  });
});

describe("assigneeLabel and linkLabel", () => {
  it("is a member's name, a typed name or Unassigned", () => {
    expect(assigneeLabel({ assigneeId: SAM, assigneeName: null }, nameOf)).toEqual({
      type: "member",
      userId: SAM,
      label: "Sam",
    });
    expect(assigneeLabel({ assigneeId: ME, assigneeName: null }, nameOf).label).toBe("you");
    expect(assigneeLabel({ assigneeId: null, assigneeName: "Aunt May" }, nameOf)).toEqual({
      type: "name",
      label: "Aunt May",
    });
    expect(assigneeLabel({ assigneeId: null, assigneeName: null }, nameOf)).toEqual({
      type: "none",
      label: "Unassigned",
    });
  });

  it("greys a removed link", () => {
    expect(linkLabel("Dr Lee", false)).toBe("Dr Lee");
    expect(linkLabel("Dr Lee", true)).toBe("Dr Lee (removed)");
  });
});

describe("days", () => {
  it("words a day near today", () => {
    expect(shortDay("2026-11-20", "2026-11-20")).toBe("today");
    expect(shortDay("2026-11-23", "2026-11-20")).toBe("Mon");
    expect(dayHeading("2026-11-21", "2026-11-20")).toBe("Tomorrow");
    expect(dayHeading("2026-11-23", "2026-11-20")).toBe("Monday, Nov 23");
  });
});

describe("todoRepeatLine", () => {
  const line = (repeatRule: string | null, repeatStartsOn = "2026-11-16") =>
    todoRepeatLine({ repeatRule, repeatStartsOn });

  it("says each pattern", () => {
    expect(line("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO")).toBe("Repeats weekly on Monday");
    expect(line("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH")).toBe("Repeats every 2 weeks on Monday and Thursday");
    expect(line("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR")).toBe(
      "Repeats weekly on Monday, Wednesday and Friday",
    );
    expect(line("FREQ=DAILY;INTERVAL=1")).toBe("Repeats daily");
    expect(line("FREQ=DAILY;INTERVAL=3")).toBe("Repeats every 3 days");
    expect(line("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=18")).toBe("Repeats monthly on the 18th");
    expect(line("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR")).toBe("Repeats monthly on the last Friday");
    expect(line("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1")).toBe("Repeats monthly on the last day");
    expect(line("FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1")).toBe("Repeats every 2 months on the last day");
    expect(line("FREQ=MONTHLY;INTERVAL=3;BYDAY=2TU")).toBe("Repeats every 3 months on the 2nd Tuesday");
  });

  it("says how it ends, with the year only when it's another year's", () => {
    expect(line("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20261221")).toBe(
      "Repeats weekly on Monday · until Dec 21",
    );
    expect(line("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20270201")).toBe(
      "Repeats weekly on Monday · until Feb 1, 2027",
    );
    expect(line("FREQ=DAILY;INTERVAL=1;COUNT=10")).toBe("Repeats daily · 10 times");
    expect(line("FREQ=DAILY;INTERVAL=1;COUNT=1")).toBe("Repeats daily · 1 time");
  });

  it("is null for a todo that doesn't repeat, and 'Repeats' for a rule it can't read", () => {
    expect(line(null)).toBeNull();
    expect(line("FREQ=YEARLY")).toBe("Repeats");
  });
});
