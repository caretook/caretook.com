import { describe, expect, it } from "vitest";
import { addDays, dayBounds, dayInZone, startOfDay, timeInZone, zonedInstant } from "./zonedDay";

const LA = "America/Los_Angeles";
const NY = "America/New_York";

describe("zonedDay", () => {
  it("reads the day and time in the zone, not the device's", () => {
    const now = new Date("2026-11-19T04:30:00Z");
    expect(dayInZone(now, LA)).toBe("2026-11-18");
    expect(timeInZone(now, LA)).toBe("20:30");
    expect(dayInZone(now, NY)).toBe("2026-11-18");
    expect(timeInZone(now, NY)).toBe("23:30");
  });

  it("adds days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("places a wall time on an ordinary day", () => {
    expect(zonedInstant("2026-11-19", "08:00", LA).toISOString()).toBe("2026-11-19T16:00:00.000Z");
    expect(zonedInstant("2026-11-19", "08:00", NY).toISOString()).toBe("2026-11-19T13:00:00.000Z");
  });

  it("moves a skipped spring-forward time on by the gap", () => {
    expect(zonedInstant("2026-03-08", "08:00", LA).toISOString()).toBe("2026-03-08T15:00:00.000Z");
    // 2:30 doesn't happen in Los Angeles that night: 3:30 PDT.
    expect(zonedInstant("2026-03-08", "02:30", LA).toISOString()).toBe("2026-03-08T10:30:00.000Z");
  });

  it("takes the first of a repeated fall-back time", () => {
    expect(zonedInstant("2026-11-01", "01:30", LA).toISOString()).toBe("2026-11-01T08:30:00.000Z");
    expect(zonedInstant("2026-11-01", "08:00", LA).toISOString()).toBe("2026-11-01T16:00:00.000Z");
  });

  it("bounds 23- and 25-hour days", () => {
    const spring = dayBounds(new Date("2026-03-08T20:00:00Z"), LA);
    expect(spring.to.getTime() - spring.from.getTime()).toBe(23 * 3_600_000);
    const fall = dayBounds(new Date("2026-11-01T20:00:00Z"), LA);
    expect(fall.to.getTime() - fall.from.getTime()).toBe(25 * 3_600_000);
    expect(startOfDay("2026-11-01", LA).toISOString()).toBe("2026-11-01T07:00:00.000Z");
  });
});
