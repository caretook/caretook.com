import { describe, expect, it } from "vitest";
import { assigneeLabel, dayHeading, doneText, dueText, linkLabel, shortDay } from "./todoDisplay";

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
