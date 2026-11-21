import { describe, expect, it } from "vitest";
import {
  cancelledLabel,
  nextStripText,
  nowLabel,
  rescheduledLabel,
  timeRange,
  upcomingTitle,
  upcomingWhen,
} from "./upcomingLabels";

const LA = "America/Los_Angeles";
const where = { locale: "en-US", timeZone: LA };
const now = new Date("2026-11-18T18:00:00.000Z"); // Wed Nov 18, 10:00 in Los Angeles
const base = { id: "e1", timeZone: LA };

describe("timeRange", () => {
  it("gives the start, the start and end, or All day", () => {
    expect(timeRange({ ...base, occurredAt: "2026-11-19T18:30:00.000Z" }, where)).toBe("10:30 AM");
    expect(
      timeRange(
        { ...base, occurredAt: "2026-11-19T18:30:00.000Z", endsAt: "2026-11-19T19:15:00.000Z" },
        where,
      ),
    ).toBe("10:30 AM–11:15 AM");
    expect(timeRange({ ...base, occurredAt: "2026-11-19T08:00:00.000Z", allDay: true }, where)).toBe(
      "All day",
    );
  });
});

describe("nowLabel", () => {
  it("says until when", () => {
    expect(
      nowLabel(
        { ...base, occurredAt: "2026-11-18T17:30:00.000Z", endsAt: "2026-11-18T19:15:00.000Z" },
        where,
      ),
    ).toBe("Now · until 11:15 AM");
    expect(nowLabel({ ...base, occurredAt: "2026-11-18T17:30:00.000Z" }, where)).toBe("Now");
  });
});

describe("cancelledLabel and rescheduledLabel", () => {
  it("labels a cancelled event, and nothing else", () => {
    expect(cancelledLabel({ cancelledAt: "2026-11-18T17:00:00.000Z" })).toBe("Cancelled");
    expect(cancelledLabel({ cancelledAt: null })).toBeNull();
    expect(cancelledLabel({})).toBeNull();
  });

  it("names the new day", () => {
    expect(rescheduledLabel({ occurredAt: "2026-12-01T18:00:00.000Z" }, where)).toBe(
      "Rescheduled to Tue, Dec 1",
    );
  });
});

describe("upcomingTitle and upcomingWhen", () => {
  it("falls back to Appointment", () => {
    expect(upcomingTitle({ kind: "event", title: "Dr. Alvarez" })).toBe("Dr. Alvarez");
    expect(upcomingTitle({ kind: "event", title: " " })).toBe("Appointment");
  });

  it("gives the day and time, the day for all day, or Now", () => {
    expect(upcomingWhen({ ...base, occurredAt: "2026-11-19T18:30:00.000Z" }, now, where)).toBe(
      "Tomorrow 10:30 AM",
    );
    expect(upcomingWhen({ ...base, occurredAt: "2026-11-18T22:00:00.000Z" }, now, where)).toBe(
      "Today 2:00 PM",
    );
    expect(upcomingWhen({ ...base, occurredAt: "2026-11-20T08:00:00.000Z", allDay: true }, now, where)).toBe(
      "Friday, Nov 20",
    );
    expect(
      upcomingWhen(
        { ...base, occurredAt: "2026-11-18T17:30:00.000Z", endsAt: "2026-11-18T19:15:00.000Z" },
        now,
        where,
      ),
    ).toBe("Now · until 11:15 AM");
  });
});

describe("nextStripText", () => {
  const next = { ...base, kind: "event", title: "Dr. Alvarez", occurredAt: "2026-11-19T18:30:00.000Z" };

  it("names the next item, when, and how many more", () => {
    expect(nextStripText({ next, more: 3 }, now, where)).toBe(
      "Next: Dr. Alvarez · Tomorrow 10:30 AM · +3 more",
    );
    expect(nextStripText({ next, more: 0 }, now, where)).toBe("Next: Dr. Alvarez · Tomorrow 10:30 AM");
  });

  it("is null when nothing is upcoming", () => {
    expect(nextStripText({ next: null, more: 0 }, now, where)).toBeNull();
  });
});
