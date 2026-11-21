import { describe, expect, it } from "vitest";
import { assigneeText, doneByLine, dueLines, todoBadge } from "./todoPage";

const LA = "America/Los_Angeles";
// Thursday, Nov 19 2026, 10:00 in Los Angeles.
const NOW = new Date("2026-11-19T18:00:00Z");
const ME = "u-me";
const nameOf = (id: string) => (id === ME ? "you" : id === "u-sam" ? "Sam Okafor" : "Former member");

const open = { dueOn: null, dueTime: null, doneAt: null };

describe("todoBadge", () => {
  it("is Done or Overdue, else none", () => {
    expect(todoBadge("done")).toEqual({ label: "Done", tone: "done" });
    expect(todoBadge("overdue")).toEqual({ label: "Overdue", tone: "overdue" });
    for (const state of ["today", "upcoming", "undated"] as const) expect(todoBadge(state)).toBeNull();
  });
});

describe("assigneeText", () => {
  it("names a member, a typed name outside the group, or nobody", () => {
    expect(assigneeText({ assigneeId: "u-sam", assigneeName: null }, nameOf)).toBe("Sam Okafor");
    expect(assigneeText({ assigneeId: ME, assigneeName: null }, nameOf)).toBe("you");
    expect(assigneeText({ assigneeId: null, assigneeName: "Aunt May" }, nameOf)).toBe(
      "Aunt May (not in the group)",
    );
    expect(assigneeText({ assigneeId: null, assigneeName: null }, nameOf)).toBe("Unassigned (anyone)");
  });
});

describe("dueLines", () => {
  it("gives the day in full, with the time, and the list's due line while open", () => {
    expect(dueLines({ ...open, dueOn: "2026-11-21", dueTime: "17:00" }, NOW, LA)).toEqual({
      day: "Saturday, Nov 21 at 17:00",
      status: "Due Sat 17:00",
    });
    expect(dueLines({ ...open, dueOn: "2026-11-17" }, NOW, LA)).toEqual({
      day: "Tuesday, Nov 17",
      status: "Overdue · 2 days",
    });
  });

  it("adds the year for another year's day, drops the status once done, and says when there's no day", () => {
    expect(dueLines({ ...open, dueOn: "2027-01-04" }, NOW, LA).day).toBe("Monday, Jan 4, 2027");
    expect(dueLines({ ...open, dueOn: "2026-11-17", doneAt: "2026-11-18T17:00:00Z" }, NOW, LA)).toEqual({
      day: "Tuesday, Nov 17",
      status: null,
    });
    expect(dueLines(open, NOW, LA)).toEqual({ day: "No due date", status: null });
  });
});

describe("doneByLine", () => {
  it("says who finished it and when, in the recipient's zone", () => {
    expect(doneByLine({ doneAt: "2026-11-19T17:05:00Z", doneBy: "u-sam" }, nameOf, NOW, LA)).toBe(
      "Done by Sam Okafor · today at 09:05",
    );
    // 02:30 UTC on the 19th is still the 18th in Los Angeles.
    expect(doneByLine({ doneAt: "2026-11-19T02:30:00Z", doneBy: ME }, nameOf, NOW, LA)).toBe(
      "Done by you · yesterday at 18:30",
    );
    expect(doneByLine({ doneAt: "2026-11-19T17:05:00Z", doneBy: null }, nameOf, NOW, LA)).toBe(
      "Done by someone · today at 09:05",
    );
    expect(doneByLine({ doneAt: null, doneBy: null }, nameOf, NOW, LA)).toBeNull();
  });
});
