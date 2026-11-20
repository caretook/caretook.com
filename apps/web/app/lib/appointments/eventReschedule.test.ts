import { describe, expect, it } from "vitest";
import { canReschedule, keepOldByDefault, scheduleOf, withMovedStart } from "./eventReschedule";

const LA = "America/Los_Angeles";
const NOW = new Date("2026-11-19T18:00:00.000Z");

describe("scheduleOf", () => {
  it("takes the start, end and all day, with no end when all day", () => {
    expect(
      scheduleOf({ occurredAt: "2026-11-20T18:30:00.000Z", endsAt: "2026-11-20T19:15:00.000Z" }),
    ).toEqual({ occurredAt: "2026-11-20T18:30:00.000Z", endsAt: "2026-11-20T19:15:00.000Z", allDay: false });
    expect(
      scheduleOf({
        occurredAt: "2026-11-20T08:00:00.000Z",
        endsAt: "2026-11-20T09:00:00.000Z",
        allDay: true,
      }),
    ).toEqual({ occurredAt: "2026-11-20T08:00:00.000Z", endsAt: null, allDay: true });
  });
});

describe("withMovedStart", () => {
  it("moves the end with the start, keeping the event's length", () => {
    const schedule = scheduleOf({
      occurredAt: "2026-11-20T18:30:00.000Z",
      endsAt: "2026-11-20T19:15:00.000Z",
    });
    expect(withMovedStart(schedule, "2026-12-01T17:00:00.000Z", LA)).toEqual({
      occurredAt: "2026-12-01T17:00:00.000Z",
      endsAt: "2026-12-01T17:45:00.000Z",
      allDay: false,
    });
  });

  it("leaves an event without an end without one", () => {
    const schedule = scheduleOf({ occurredAt: "2026-11-20T18:30:00.000Z" });
    expect(withMovedStart(schedule, "2026-12-01T17:00:00.000Z", LA)).toEqual({
      occurredAt: "2026-12-01T17:00:00.000Z",
      endsAt: null,
      allDay: false,
    });
  });

  it("keeps an all-day event at the start of the day picked, in its zone", () => {
    const schedule = scheduleOf({ occurredAt: "2026-11-20T08:00:00.000Z", allDay: true });
    expect(withMovedStart(schedule, "2026-12-01T21:00:00.000Z", LA)).toEqual({
      occurredAt: "2026-12-01T08:00:00.000Z",
      endsAt: null,
      allDay: true,
    });
  });
});

describe("keepOldByDefault", () => {
  const event = (occurredAt: string, extra = {}) => ({ id: "e", occurredAt, timeZone: LA, ...extra });

  it("is on for an event still to come, or under way", () => {
    expect(keepOldByDefault(event("2026-11-20T18:00:00.000Z"), NOW)).toBe(true);
    expect(
      keepOldByDefault(event("2026-11-19T17:30:00.000Z", { endsAt: "2026-11-19T18:30:00.000Z" }), NOW),
    ).toBe(true);
  });

  it("is off for a past event (a new time is usually a correction)", () => {
    expect(keepOldByDefault(event("2026-11-18T18:00:00.000Z"), NOW)).toBe(false);
  });

  it("is on for a cancelled event, past or not", () => {
    expect(keepOldByDefault(event("2026-11-18T18:00:00.000Z", { cancelledAt: NOW.toISOString() }), NOW)).toBe(
      true,
    );
  });
});

describe("canReschedule", () => {
  it("is events only, and not one already rescheduled to another", () => {
    expect(canReschedule({ kind: "event" })).toBe(true);
    expect(canReschedule({ kind: "event", rescheduledTo: null })).toBe(true);
    expect(canReschedule({ kind: "event", rescheduledTo: "x" })).toBe(false);
    expect(canReschedule({ kind: "note" })).toBe(false);
  });
});
