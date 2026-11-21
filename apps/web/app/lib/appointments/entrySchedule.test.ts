import { describe, expect, it } from "vitest";
import {
  atTimeOfDay,
  defaultEnd,
  END_BEFORE_START,
  endError,
  scheduleText,
  scheduleToSave,
  startError,
  withAllDay,
  withEnd,
  withStart,
} from "./entrySchedule";

const LA = "America/Los_Angeles";
const NY = "America/New_York";
// 2026-11-19 10:30 in Los Angeles.
const timed = { occurredAt: "2026-11-19T18:30:00.000Z", endsAt: null, allDay: false };

describe("withAllDay", () => {
  it("on: the start of its day in the entry's zone, and no end", () => {
    const withEndTime = { ...timed, endsAt: "2026-11-19T19:15:00.000Z" };
    expect(withAllDay(withEndTime, true, LA)).toEqual({
      occurredAt: "2026-11-19T08:00:00.000Z",
      endsAt: null,
      allDay: true,
    });
    // The same instant is already the 19th in New York, starting at 05:00 UTC.
    expect(withAllDay(timed, true, NY).occurredAt).toBe("2026-11-19T05:00:00.000Z");
  });

  it("off: 9:00 that day", () => {
    const allDay = withAllDay(timed, true, LA);
    expect(withAllDay(allDay, false, LA)).toEqual({
      occurredAt: "2026-11-19T17:00:00.000Z",
      endsAt: null,
      allDay: false,
    });
  });

  it("unchanged when it's already so", () => {
    expect(withAllDay(timed, false, LA)).toBe(timed);
  });
});

describe("atTimeOfDay", () => {
  it("is DST-safe", () => {
    // 2026-11-01: Los Angeles falls back at 2:00; 9:00 is PST (UTC-8).
    expect(atTimeOfDay("2026-11-01T07:30:00.000Z", LA, { hour: 9, minute: 0 })).toBe(
      "2026-11-01T17:00:00.000Z",
    );
    // 2026-03-08: springs forward; 9:00 is PDT (UTC-7).
    expect(atTimeOfDay("2026-03-08T09:00:00.000Z", LA, { hour: 9, minute: 0 })).toBe(
      "2026-03-08T16:00:00.000Z",
    );
  });
});

describe("withStart and withEnd", () => {
  it("a timed start is taken as it is", () => {
    expect(withStart(timed, "2026-11-20T17:00:00.000Z", LA).occurredAt).toBe("2026-11-20T17:00:00.000Z");
  });

  it("an all-day start keeps to the start of the day picked", () => {
    const allDay = withAllDay(timed, true, LA);
    expect(withStart(allDay, "2026-11-21T20:00:00.000Z", LA).occurredAt).toBe("2026-11-21T08:00:00.000Z");
  });

  it("an all-day item takes no end", () => {
    const allDay = withAllDay(timed, true, LA);
    expect(withEnd(allDay, "2026-11-19T20:00:00.000Z")).toBe(allDay);
    expect(withEnd(timed, "2026-11-19T19:15:00.000Z").endsAt).toBe("2026-11-19T19:15:00.000Z");
  });

  it("an end defaults to an hour after the start", () => {
    expect(defaultEnd(timed)).toBe("2026-11-19T19:30:00.000Z");
  });
});

describe("endError", () => {
  it("an end at or before the start is an error", () => {
    expect(endError({ ...timed, endsAt: timed.occurredAt })).toBe(END_BEFORE_START);
    expect(endError({ ...timed, endsAt: "2026-11-19T18:00:00.000Z" })).toBe(END_BEFORE_START);
    expect(endError({ ...timed, endsAt: "2026-11-19T18:31:00.000Z" })).toBeNull();
    expect(endError(timed)).toBeNull();
  });
});

describe("scheduleToSave", () => {
  it("nothing when unchanged (the same instant in another form counts as unchanged)", () => {
    expect(scheduleToSave({ ...timed, occurredAt: "2026-11-19T10:30:00-08:00" }, timed)).toBeNull();
  });

  it("nothing while the end is before the start", () => {
    expect(scheduleToSave({ ...timed, endsAt: "2026-11-19T18:00:00.000Z" }, timed)).toBeNull();
  });

  it("the edited schedule otherwise", () => {
    const edited = { ...timed, endsAt: "2026-11-19T19:15:00.000Z" };
    expect(scheduleToSave(edited, timed)).toBe(edited);
    expect(scheduleToSave(timed, edited)).toBe(timed);
  });
});

describe("scheduleText", () => {
  const now = new Date("2026-11-19T16:00:00.000Z"); // 8:00 in Los Angeles
  const where = { locale: "en-US", timeZone: LA };

  it("a day and a time, or a range", () => {
    const text = (s: string) => s.replace(/\u202f/g, " ");
    expect(text(scheduleText({ id: "a", timeZone: LA, ...timed }, now, where))).toBe("Today, 10:30 AM");
    expect(
      text(
        scheduleText(
          {
            id: "a",
            timeZone: LA,
            occurredAt: "2026-11-20T18:30:00.000Z",
            endsAt: "2026-11-20T19:15:00.000Z",
          },
          now,
          where,
        ),
      ),
    ).toBe("Tomorrow, 10:30 AM–11:15 AM");
  });

  it("all day, by the entry's own zone", () => {
    expect(
      scheduleText(
        { id: "a", timeZone: LA, occurredAt: "2026-11-23T08:00:00.000Z", allDay: true },
        now,
        where,
      ),
    ).toBe("Monday, Nov 23 · All day");
  });
});

describe("startError (a note is past-only)", () => {
  const now = new Date("2026-11-19T18:30:00.000Z");
  const at = (ms: number) => ({ ...timed, occurredAt: new Date(now.getTime() + ms).toISOString() });

  it("refuses a note ahead of now plus the device's skew, not an event", () => {
    expect(startError("note", at(6 * 60_000), now)).toBe("Can't be in the future");
    expect(startError("note", at(5 * 60_000), now)).toBeNull();
    expect(startError("note", at(-86_400_000), now)).toBeNull();
    expect(startError("event", at(86_400_000), now)).toBeNull();
  });

  it("keeps a note's edit from saving while it's ahead", () => {
    const far = { ...timed, occurredAt: "2099-01-01T18:30:00.000Z" };
    expect(scheduleToSave(far, timed, "note")).toBeNull();
    expect(scheduleToSave(far, timed)).toBe(far);
  });
});
