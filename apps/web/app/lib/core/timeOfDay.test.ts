import { describe, expect, test } from "vitest";
import { currentHourIn, currentHourTime, minuteOptions, steppedMinute } from "./timeOfDay";

const AT = new Date("2027-06-09T19:40:00Z");

describe("currentHourTime", () => {
  test("is this hour in the zone asked for, not the device's", () => {
    expect(currentHourTime("America/Los_Angeles", AT)).toBe("12:00");
    expect(currentHourTime("America/New_York", AT)).toBe("15:00");
    expect(currentHourTime("Asia/Tokyo", AT)).toBe("04:00");
  });

  test("midnight is hour 0", () => {
    expect(currentHourIn("UTC", new Date("2027-06-09T00:05:00Z"))).toBe(0);
    expect(currentHourTime("UTC", new Date("2027-06-09T00:05:00Z"))).toBe("00:00");
  });
});

describe("minuteOptions", () => {
  test("offers the quarters", () => {
    expect(minuteOptions("30")).toEqual(["00", "15", "30", "45"]);
    expect(minuteOptions("")).toEqual(["00", "15", "30", "45"]);
  });

  test("keeps an off-grid minute, in order", () => {
    expect(minuteOptions("10")).toEqual(["00", "10", "15", "30", "45"]);
  });
});

describe("steppedMinute", () => {
  test.each([
    [0, 1, 15],
    [10, 1, 15],
    [15, 1, 30],
    [45, 1, 0],
    [50, 1, 0],
    [0, -1, 45],
    [10, -1, 0],
    [15, -1, 0],
    [50, -1, 45],
  ] as const)("from :%i by %i goes to :%i", (minute, sign, expected) => {
    expect(steppedMinute(minute, sign, 15)).toBe(expected);
  });
});
