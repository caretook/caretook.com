import { describe, expect, it } from "vitest";
import { isJumpState, JUMP_LINK_STATE, jumpBound, jumpDayText, jumpNotice } from "./timelineJump";

const LA = "America/Los_Angeles";
const NOW = new Date("2026-11-23T20:00:00.000Z");

describe("the window's bound for a day (jumpBound)", () => {
  it.each([
    ["an ordinary day", "2026-10-20", "2026-10-21T07:00:00.000Z"],
    ["the day clocks go forward (23 hours)", "2026-03-08", "2026-03-09T07:00:00.000Z"],
    ["the day before they go forward", "2026-03-07", "2026-03-08T08:00:00.000Z"],
    ["the day clocks go back (25 hours)", "2026-11-01", "2026-11-02T08:00:00.000Z"],
    ["the day before they go back", "2026-10-31", "2026-11-01T07:00:00.000Z"],
    ["a month's end", "2026-01-31", "2026-02-01T08:00:00.000Z"],
    ["a year's end", "2025-12-31", "2026-01-01T08:00:00.000Z"],
  ])("%s", (_name, day, end) => {
    expect(jumpBound(day, LA, NOW)).toBe(end);
  });

  it("follows the viewer's zone", () => {
    expect(jumpBound("2026-10-20", "Asia/Tokyo", NOW)).toBe("2026-10-20T15:00:00.000Z");
  });

  it("today has no bound: its window is the ordinary history", () => {
    expect(jumpBound("2026-11-23", LA, NOW)).toBeNull();
    // Already the 24th in Tokyo, so the 23rd is a past day there.
    expect(jumpBound("2026-11-23", "Asia/Tokyo", new Date("2026-11-23T16:00:00.000Z"))).toBe(
      "2026-11-23T15:00:00.000Z",
    );
  });
});

describe("the jump notice (jumpNotice)", () => {
  const base = { day: "2026-11-03", filtered: false, locale: "en-US" };

  it("says nothing when the chosen day is the one shown", () => {
    expect(jumpNotice({ ...base, shownDay: "2026-11-03" })).toBeNull();
  });

  it("names the nearest earlier day", () => {
    expect(jumpNotice({ ...base, shownDay: "2026-10-30" })).toBe(
      "No entries on Nov 3, 2026. Showing Oct 30, 2026, the nearest earlier day.",
    );
  });

  it("says when nothing is on or before the day", () => {
    expect(jumpNotice({ ...base, shownDay: null })).toBe("No entries on or before Nov 3, 2026.");
  });

  it("says matching entries under a filter", () => {
    expect(jumpNotice({ ...base, filtered: true, shownDay: "2026-10-30" })).toBe(
      "No matching entries on Nov 3, 2026. Showing Oct 30, 2026, the nearest earlier day.",
    );
    expect(jumpNotice({ ...base, filtered: true, shownDay: null })).toBe(
      "No matching entries on or before Nov 3, 2026.",
    );
  });

  it("names the day itself in any zone", () => {
    expect(jumpDayText("2026-01-01", "en-US")).toBe("Jan 1, 2026");
  });
});

describe("the jump marker", () => {
  it("is only the jump's link state", () => {
    expect(isJumpState(JUMP_LINK_STATE)).toBe(true);
    for (const state of [null, undefined, "timelineJump", {}, { timelineJump: 1 }])
      expect(isJumpState(state)).toBe(false);
  });
});
