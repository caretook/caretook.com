import { describe, expect, it } from "vitest";
import {
  DEVICE_FUTURE_SKEW_MS,
  endOfDay,
  FUTURE_KINDS,
  isStartOfDay,
  isTooFarAhead,
  SERVER_FUTURE_SKEW_MS,
} from "./entryTiming";

const now = new Date("2026-11-18T18:00:00.000Z");
const plus = (ms: number) => new Date(now.getTime() + ms).toISOString();

describe("the future-date rule", () => {
  it("lets only notes and events be dated in the future", () => {
    expect(FUTURE_KINDS).toEqual(["note", "event"]);
    expect(isTooFarAhead("note", plus(30 * 86_400_000), now, DEVICE_FUTURE_SKEW_MS)).toBe(false);
    expect(isTooFarAhead("event", plus(30 * 86_400_000), now, DEVICE_FUTURE_SKEW_MS)).toBe(false);
  });

  it("refuses symptoms, vitals, doses and medication changes past the skew", () => {
    for (const kind of ["symptom", "vital", "dose", "medicationChange"]) {
      expect(isTooFarAhead(kind, plus(DEVICE_FUTURE_SKEW_MS + 1), now, DEVICE_FUTURE_SKEW_MS)).toBe(true);
    }
  });

  it("allows exactly the skew, and any past time", () => {
    expect(isTooFarAhead("vital", plus(DEVICE_FUTURE_SKEW_MS), now, DEVICE_FUTURE_SKEW_MS)).toBe(false);
    expect(isTooFarAhead("vital", plus(2 * 60_000), now, DEVICE_FUTURE_SKEW_MS)).toBe(false);
    expect(isTooFarAhead("vital", plus(-86_400_000), now, DEVICE_FUTURE_SKEW_MS)).toBe(false);
  });

  it("gives the server an hour, so a fast device clock doesn't lose a vital", () => {
    expect(SERVER_FUTURE_SKEW_MS).toBe(3_600_000);
    expect(isTooFarAhead("vital", plus(30 * 60_000), now, SERVER_FUTURE_SKEW_MS)).toBe(false);
    expect(isTooFarAhead("vital", plus(61 * 60_000), now, SERVER_FUTURE_SKEW_MS)).toBe(true);
  });

  it("leaves an unparseable time to the schema", () => {
    expect(isTooFarAhead("vital", "not a time", now, 0)).toBe(false);
  });
});

describe("days in a zone", () => {
  it("knows the start of a day", () => {
    expect(isStartOfDay("2026-11-18T08:00:00.000Z", "America/Los_Angeles")).toBe(true);
    expect(isStartOfDay("2026-11-18T08:00:00.001Z", "America/Los_Angeles")).toBe(false);
    expect(isStartOfDay("2026-11-18T00:00:00.000Z", "America/Los_Angeles")).toBe(false);
    expect(isStartOfDay("2026-11-18T00:00:00.000Z", "UTC")).toBe(true);
  });

  it("ends a day at the next midnight, 23 or 25 hours long across DST", () => {
    // Berlin leaves summer time on Oct 25, 2026: that day is 25 hours.
    expect(new Date(endOfDay("2026-10-25T10:00:00.000Z", "Europe/Berlin")).toISOString()).toBe(
      "2026-10-25T23:00:00.000Z",
    );
    // Los Angeles springs forward on Mar 8, 2026: that day is 23 hours.
    expect(new Date(endOfDay("2026-03-08T12:00:00.000Z", "America/Los_Angeles")).toISOString()).toBe(
      "2026-03-09T07:00:00.000Z",
    );
  });

  it("finds a day's start where DST skips midnight", () => {
    // Santiago springs forward at midnight on Sep 6, 2026: the day begins at 01:00 (-03).
    const end = endOfDay("2026-09-05T15:00:00.000Z", "America/Santiago");
    expect(new Date(end).toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(isStartOfDay(new Date(end).toISOString(), "America/Santiago")).toBe(true);
  });
});
