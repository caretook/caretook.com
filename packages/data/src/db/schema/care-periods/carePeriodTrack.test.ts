import { describe, expect, it } from "vitest";
import {
  comparePeriods,
  currentPeriod,
  neighbours,
  periodAt,
  periodDay,
  periodLengthDays,
  periodRange,
  periodSpans,
} from "./carePeriodTrack";

const LA = "America/Los_Angeles";

const period = (id: string, startedAt: string, extra: { createdAt?: string; deletedAt?: string } = {}) => ({
  id,
  startedAt,
  createdAt: extra.createdAt ?? startedAt,
  deletedAt: extra.deletedAt ?? null,
});

const home = period("a", "2026-10-01T07:00:00.000Z");
const er = period("b", "2026-10-20T01:40:00.000Z");
const hospital = period("c", "2026-10-20T09:15:00.000Z");
const back = period("d", "2026-11-12T22:20:00.000Z");

describe("periodSpans", () => {
  it("orders by start and ends each period where the next starts; the latest has no end", () => {
    const spans = periodSpans([back, hospital, home, er]);
    expect(spans.map((s) => [s.period.id, s.startsAt, s.endsAt])).toEqual([
      ["a", home.startedAt, er.startedAt],
      ["b", er.startedAt, hospital.startedAt],
      ["c", hospital.startedAt, back.startedAt],
      ["d", back.startedAt, null],
    ]);
  });

  it("leaves deleted periods off, so the one before runs on", () => {
    const spans = periodSpans([home, { ...er, deletedAt: "2026-10-21T00:00:00.000Z" }, hospital]);
    expect(spans.map((s) => [s.period.id, s.endsAt])).toEqual([
      ["a", hospital.startedAt],
      ["c", null],
    ]);
  });

  it("keeps both periods with the same start, earlier-created first, the first with zero length", () => {
    const one = period("z", "2026-11-01T10:00:00.000Z", { createdAt: "2026-11-01T10:00:05.000Z" });
    const two = period("y", "2026-11-01T10:00:00.000Z", { createdAt: "2026-11-01T10:00:09.000Z" });
    const spans = periodSpans([two, one]);
    expect(spans.map((s) => [s.period.id, s.startsAt, s.endsAt])).toEqual([
      ["z", one.startedAt, one.startedAt],
      ["y", two.startedAt, null],
    ]);
  });

  it("breaks a full tie by id", () => {
    const one = period("b", "2026-11-01T10:00:00.000Z");
    const two = period("a", "2026-11-01T10:00:00.000Z");
    expect(comparePeriods(two, one)).toBeLessThan(0);
    expect(periodSpans([one, two]).map((s) => s.period.id)).toEqual(["a", "b"]);
  });

  it("reads a device's timestamps (microseconds) and Postgres's text", () => {
    const spans = periodSpans([
      period("a", "2026-10-01T07:00:00.000000Z"),
      period("b", "2026-10-02 07:00:00.000+00".replace(" ", "T").replace("+00", "+00:00")),
    ]);
    expect(spans[0]!.endsAt).toBe("2026-10-02T07:00:00.000Z");
  });

  it("is empty with no periods", () => {
    expect(periodSpans([])).toEqual([]);
  });
});

describe("periodAt", () => {
  const spans = periodSpans([home, er, hospital, back]);

  it("includes a period's start and excludes its end", () => {
    expect(periodAt(spans, er.startedAt)?.period.id).toBe("b");
    expect(periodAt(spans, new Date(new Date(er.startedAt).getTime() - 1))?.period.id).toBe("a");
    expect(periodAt(spans, hospital.startedAt)?.period.id).toBe("c");
  });

  it("is the current period from its start on, and nothing before the first", () => {
    expect(periodAt(spans, "2030-01-01T00:00:00.000Z")?.period.id).toBe("d");
    expect(periodAt(spans, "2026-09-01T00:00:00.000Z")).toBeNull();
    expect(periodAt([], "2026-10-05T00:00:00.000Z")).toBeNull();
  });

  it("skips a zero-length period: the later of a tie wins", () => {
    const one = period("z", "2026-11-01T10:00:00.000Z", { createdAt: "2026-11-01T10:00:05.000Z" });
    const two = period("y", "2026-11-01T10:00:00.000Z", { createdAt: "2026-11-01T10:00:09.000Z" });
    expect(periodAt(periodSpans([home, one, two]), "2026-11-01T10:00:00.000Z")?.period.id).toBe("y");
  });
});

describe("currentPeriod and periodDay", () => {
  it("is the latest period, with its day counted in the recipient's zone", () => {
    const spans = periodSpans([home, er, hospital]);
    // Hospital from Oct 20 02:15 (LA); Oct 23 noon LA is day 4.
    expect(currentPeriod(spans, "2026-10-23T19:00:00.000Z", LA)).toMatchObject({
      span: { period: { id: "c" } },
      day: 4,
    });
    expect(currentPeriod([], "2026-10-23T19:00:00.000Z", LA)).toBeNull();
  });

  it("turns day at midnight in the recipient's zone, not the device's or UTC", () => {
    // 23:30 on Oct 1 in LA (06:30 UTC on Oct 2).
    const start = "2026-10-02T06:30:00.000Z";
    expect(periodDay(start, "2026-10-02T06:59:00.000Z", LA)).toBe(1);
    expect(periodDay(start, "2026-10-02T07:00:00.000Z", LA)).toBe(2);
    expect(periodDay(start, "2026-10-02T07:00:00.000Z", "UTC")).toBe(1);
  });

  it("counts calendar days across a DST change", () => {
    // Nov 1 2026: LA falls back. Start Oct 31 at midnight, Nov 2 at midnight is day 3.
    expect(periodDay("2026-10-31T07:00:00.000Z", "2026-11-02T08:00:00.000Z", LA)).toBe(3);
    // Mar 8 2026: LA springs forward.
    expect(periodDay("2026-03-07T08:00:00.000Z", "2026-03-09T07:00:00.000Z", LA)).toBe(3);
  });

  it("is day 1 for a date-only start today, and never less than 1", () => {
    expect(periodDay("2026-11-17T08:00:00.000Z", "2026-11-17T08:00:00.000Z", LA)).toBe(1);
    expect(periodDay("2026-11-17T08:00:00.000Z", "2026-11-16T08:00:00.000Z", LA)).toBe(1);
  });
});

describe("periodLengthDays", () => {
  const spans = periodSpans([home, er, hospital, back]);

  it("counts calendar days from the start's day to the end's day", () => {
    // ER: Oct 19 18:40 LA → Oct 20 02:15 LA.
    expect(periodLengthDays(spans[1]!, "2026-11-17T20:00:00.000Z", LA)).toBe(1);
    // Hospital: Oct 20 → Nov 12.
    expect(periodLengthDays(spans[2]!, "2026-11-17T20:00:00.000Z", LA)).toBe(23);
  });

  it("runs to now for the current period", () => {
    // Nov 12 → Nov 17.
    expect(periodLengthDays(spans[3]!, "2026-11-17T20:00:00.000Z", LA)).toBe(5);
  });
});

describe("periodRange and neighbours", () => {
  const spans = periodSpans([home, er, hospital, back]);

  it("gives a closed period's start and end, and an open one's start", () => {
    expect(periodRange(spans, "c")).toEqual({ from: hospital.startedAt, to: back.startedAt });
    expect(periodRange(spans, "d")).toEqual({ from: back.startedAt, to: null });
    expect(periodRange(spans, "missing")).toBeNull();
  });

  it("steps to the previous and next periods", () => {
    expect(neighbours(spans, "b")).toMatchObject({
      previous: { period: { id: "a" } },
      next: { period: { id: "c" } },
    });
    expect(neighbours(spans, "a").previous).toBeNull();
    expect(neighbours(spans, "d").next).toBeNull();
    expect(neighbours(spans, "missing")).toEqual({ previous: null, next: null });
  });
});
