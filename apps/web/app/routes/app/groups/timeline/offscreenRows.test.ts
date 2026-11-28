import { describe, expect, it } from "vitest";
import { OFFSCREEN_ROWS, offscreenRowsClass, settledDays } from "./offscreenRows";
import { isWebKit } from "./webkit";

const day = (key: string, n: number) => ({ key, entries: Array.from({ length: n }) });
/** Today, in the tests' made-up calendar: every `d…` day sorts before it. */
const TODAY = "2031-05-20";
const d = (n: number) => `2031-05-${String(20 - n).padStart(2, "0")}`;

describe("settledDays", () => {
  it("leaves the days holding the last rows drawn, and settles every day before them", () => {
    const days = [day(d(1), 10), day(d(2), 10), day(d(3), 10), day(d(4), 10), day(d(5), 10)];
    expect([...settledDays(days, TODAY, 30)]).toEqual([d(2), d(1)]);
  });

  it("keeps a day drawn when any of its rows is among the last ones", () => {
    const days = [day(d(1), 5), day(d(2), 20), day(d(3), 25)];
    // d2's last rows are among the last 30: it stays drawn; d1 settles.
    expect([...settledDays(days, TODAY, 30)]).toEqual([d(1)]);
  });

  it("settles nothing while everything loaded fits in one page", () => {
    expect(settledDays([day(d(1), 12), day(d(2), 18)], TODAY, 30).size).toBe(0);
    expect(settledDays([], TODAY, 30).size).toBe(0);
  });

  it("never settles Today or a later day, however many rows come after them (B-1046)", () => {
    const days = [day("2031-05-22", 2), day("2031-05-21", 3), day(TODAY, 8), day(d(1), 30), day(d(2), 30)];
    expect([...settledDays(days, TODAY, 30)]).toEqual([d(1)]);
    // An empty Today (the writer's heading) too.
    expect([...settledDays([day(TODAY, 0), day(d(1), 30), day(d(2), 30)], TODAY, 30)]).toEqual([d(1)]);
  });
});

describe("offscreenRowsClass", () => {
  it("is OFFSCREEN_ROWS off WebKit and nothing on WebKit (B-1046)", () => {
    expect(offscreenRowsClass(false)).toBe(OFFSCREEN_ROWS);
    expect(offscreenRowsClass(true)).toBe("");
  });
});

describe("isWebKit", () => {
  const ua = {
    iPhoneSafari:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    iPhoneChrome:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
    iPhonePwa:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    macChrome:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
    android:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  };

  it("is true for Safari, every iOS browser, the installed PWA and an iPad in desktop mode", () => {
    for (const userAgent of [ua.iPhoneSafari, ua.iPhoneChrome, ua.iPhonePwa, ua.mac])
      expect(isWebKit({ userAgent })).toBe(true);
    expect(isWebKit({ userAgent: ua.mac, maxTouchPoints: 5 })).toBe(true);
  });

  it("is false for Chromium and Firefox", () => {
    for (const userAgent of [ua.macChrome, ua.macFirefox, ua.android, ua.edge])
      expect(isWebKit({ userAgent, maxTouchPoints: 0 })).toBe(false);
  });
});
