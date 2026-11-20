import { describe, expect, it } from "vitest";
import { dayLabel } from "./dayLabel";

const LA = "America/Los_Angeles";
/** Every case passes its own `now`; nothing here reads the clock. */
const label = (iso: string, now: string, timeZone = LA) => dayLabel(iso, timeZone, new Date(now), "en-US");

describe("dayLabel", () => {
  // Wednesday Nov 18 2026, 10:00 in Los Angeles (PST, UTC-8).
  const now = "2026-11-18T18:00:00.000Z";

  it("says Today for the same calendar day", () => {
    expect(label("2026-11-18T16:30:00.000Z", now)).toBe("Today");
    expect(label(now, now)).toBe("Today");
  });
  it("says Yesterday for the day before", () => {
    expect(label("2026-11-17T20:00:00.000Z", now)).toBe("Yesterday");
  });
  it("says Tomorrow for the day after, then the weekday and date", () => {
    expect(label("2026-11-19T20:00:00.000Z", now)).toBe("Tomorrow");
    // 23:30 tonight in Los Angeles is still Today; 00:30 is Tomorrow.
    expect(label("2026-11-19T07:30:00.000Z", now)).toBe("Today");
    expect(label("2026-11-19T08:30:00.000Z", now)).toBe("Tomorrow");
    expect(label("2026-11-20T20:00:00.000Z", now)).toBe("Friday, Nov 20");
    expect(label("2027-01-01T20:00:00.000Z", "2026-12-31T20:00:00.000Z")).toBe("Tomorrow");
  });
  it("names the weekday and date for older days this year", () => {
    expect(label("2026-11-16T20:00:00.000Z", now)).toBe("Monday, Nov 16");
    expect(label("2026-01-01T20:00:00.000Z", now)).toBe("Thursday, Jan 1");
  });
  it("adds the year when it isn't this one", () => {
    expect(label("2025-11-16T20:00:00.000Z", now)).toBe("Sunday, Nov 16, 2025");
  });
  it("adds the year to Dec 31 from early January, but Yesterday on Jan 1", () => {
    expect(label("2026-12-31T20:00:00.000Z", "2027-01-01T20:00:00.000Z")).toBe("Yesterday");
    expect(label("2026-12-31T20:00:00.000Z", "2027-01-02T20:00:00.000Z")).toBe("Thursday, Dec 31, 2026");
  });
  it("reads the PowerSync timestamp form too", () => {
    expect(label("2026-11-17T21:45:25.229000Z", now)).toBe("Yesterday");
  });

  describe("around midnight in a zone other than UTC", () => {
    // 00:30 on Nov 18 in Los Angeles is 08:30 UTC.
    const justAfterMidnight = "2026-11-18T08:30:00.000Z";

    it("puts 23:59 local on the day before, though it's the same UTC day", () => {
      expect(label("2026-11-18T07:59:00.000Z", justAfterMidnight)).toBe("Yesterday");
    });
    it("puts 00:00 local on today", () => {
      expect(label("2026-11-18T08:00:00.000Z", justAfterMidnight)).toBe("Today");
    });
    it("calls an entry an hour ago Yesterday when midnight fell in between", () => {
      expect(label("2026-11-18T07:45:00.000Z", justAfterMidnight)).toBe("Yesterday");
    });
    it("keeps 23 hours ago as Today late in the evening", () => {
      // 23:30 on Nov 18 in Los Angeles; the entry is from 00:30 that day.
      expect(label(justAfterMidnight, "2026-11-19T07:30:00.000Z")).toBe("Today");
    });
    it("follows the zone it's given, not UTC or the machine's", () => {
      // 2026-11-18T02:00Z is still Nov 17 in Los Angeles and already Nov 18 in Tokyo.
      const iso = "2026-11-18T02:00:00.000Z";
      expect(label(iso, "2026-11-18T03:00:00.000Z", LA)).toBe("Today");
      expect(label(iso, "2026-11-18T09:00:00.000Z", LA)).toBe("Yesterday");
      expect(label(iso, "2026-11-18T09:00:00.000Z", "Asia/Tokyo")).toBe("Today");
      expect(label("2026-11-15T16:00:00.000Z", now, "Asia/Tokyo")).toBe("Monday, Nov 16");
    });
  });

  describe("across a DST change", () => {
    // Los Angeles falls back on Sunday Nov 1 2026 (a 25-hour day) and springs
    // forward on Sunday Mar 8 2026 (a 23-hour day).
    it("counts the 25-hour day as one day", () => {
      // Monday Nov 2, 00:30 PST. Sunday 00:30 PDT was 25 hours earlier: still Yesterday.
      const monday = "2026-11-02T08:30:00.000Z";
      expect(label("2026-11-01T07:30:00.000Z", monday)).toBe("Yesterday");
      // Saturday 23:30 PDT, 26 hours earlier, is two days back.
      expect(label("2026-11-01T06:30:00.000Z", monday)).toBe("Saturday, Oct 31");
      // Sunday 23:30 PST, with the entry at 00:30 PDT that morning (24 hours earlier): Today.
      expect(label("2026-11-01T07:30:00.000Z", "2026-11-02T07:30:00.000Z")).toBe("Today");
    });
    it("counts the 23-hour day as one day", () => {
      // Monday Mar 9, 00:30 PDT. Saturday 23:45 PST was under 24 hours earlier, but two days back.
      const monday = "2026-03-09T07:30:00.000Z";
      expect(label("2026-03-08T07:45:00.000Z", monday)).toBe("Saturday, Mar 7");
      expect(label("2026-03-08T08:15:00.000Z", monday)).toBe("Yesterday");
    });
  });

  it("gives a date, not a relative name, to days after tomorrow", () => {
    expect(label("2026-11-21T20:00:00.000Z", now)).toBe("Saturday, Nov 21");
  });
});
