import { describe, expect, it } from "vitest";
import { deviceLabel } from "./deviceLabel";

// Real user agents, shortened only where noted.
const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  headlessLinux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  firefoxIpad:
    "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15",
  webviewIpad:
    "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  operaWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
  firefoxLinux: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  firefoxWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  chromebook:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

describe("deviceLabel", () => {
  it("names the browser and system, what it knows of them, or Unknown device", () => {
    for (const [ua, label] of [
      [UA.chromeMac, "Chrome on macOS"],
      [UA.headlessLinux, "Chrome on Linux"],
      [UA.safariMac, "Safari on macOS"],
      [UA.safariIphone, "Safari on iPhone"],
      [UA.chromeIphone, "Chrome on iPhone"],
      [UA.firefoxIpad, "Firefox on iPad"],
      [UA.webviewIpad, "Safari on iPad"],
      [UA.chromeAndroid, "Chrome on Android"],
      [UA.samsung, "Samsung Internet on Android"],
      [UA.edgeWindows, "Edge on Windows"],
      [UA.operaWindows, "Opera on Windows"],
      [UA.firefoxLinux, "Firefox on Linux"],
      [UA.firefoxWindows, "Firefox on Windows"],
      [UA.chromebook, "Chrome on ChromeOS"],
      ["SomeBot/1.0 (Windows NT 10.0)", "Unknown browser on Windows"],
      ["Mozilla/5.0 Firefox/133.0", "Firefox"],
      ["curl/8.7.1", "Unknown device"],
      ["  ", "Unknown device"],
    ] as const) {
      expect(deviceLabel(ua), ua).toBe(label);
    }
    expect(deviceLabel(null)).toBe("Unknown device");
    expect(deviceLabel(undefined)).toBe("Unknown device");
  });
});
