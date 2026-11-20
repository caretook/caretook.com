import { describe, expect, it } from "vitest";
import { settledDays } from "./offscreenRows";

const day = (key: string, n: number) => ({ key, entries: Array.from({ length: n }) });

describe("settledDays", () => {
  it("leaves the days holding the last rows drawn, and settles every day before them", () => {
    const days = [day("d1", 10), day("d2", 10), day("d3", 10), day("d4", 10), day("d5", 10)];
    expect([...settledDays(days, 30)]).toEqual(["d2", "d1"]);
  });

  it("keeps a day drawn when any of its rows is among the last ones", () => {
    const days = [day("d1", 5), day("d2", 20), day("d3", 25)];
    // d2's last rows are among the last 30: it stays drawn; d1 settles.
    expect([...settledDays(days, 30)]).toEqual(["d1"]);
  });

  it("settles nothing while everything loaded fits in one page", () => {
    expect(settledDays([day("d1", 12), day("d2", 18)], 30).size).toBe(0);
    expect(settledDays([], 30).size).toBe(0);
  });

  it("counts empty days (an empty Today) as nothing", () => {
    expect([...settledDays([day("today", 0), day("d1", 30), day("d2", 30)], 30)]).toEqual(["d1", "today"]);
  });
});
