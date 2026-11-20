import { describe, expect, test } from "vitest";
import { canDictate } from "./canDictate";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const IPADOS_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("canDictate", () => {
  test("an iPhone, an iPad and an Android phone (coarse pointer) can", () => {
    expect(canDictate({ userAgent: IPHONE, maxTouchPoints: 5 }, true)).toBe(true);
    expect(canDictate({ userAgent: IPAD, maxTouchPoints: 5 }, true)).toBe(true);
    expect(canDictate({ userAgent: ANDROID, maxTouchPoints: 5 }, true)).toBe(true);
  });

  test("an iPad with the desktop-class user agent can, by its touch points", () => {
    expect(canDictate({ userAgent: IPADOS_DESKTOP, maxTouchPoints: 5 }, true)).toBe(true);
  });

  test("a desktop and a touch Windows laptop can't", () => {
    expect(canDictate({ userAgent: CHROME_MAC, maxTouchPoints: 0 }, false)).toBe(false);
    expect(canDictate({ userAgent: CHROME_MAC, maxTouchPoints: 0 }, true)).toBe(false);
    expect(canDictate({ userAgent: WINDOWS, maxTouchPoints: 10 }, true)).toBe(false);
  });

  test("a phone with a fine pointer (a mouse or stylus is the main input) can't", () => {
    expect(canDictate({ userAgent: ANDROID, maxTouchPoints: 5 }, false)).toBe(false);
  });
});
