// A signed-in session's device, in words, from its user agent: "Chrome on
// macOS". The Devices settings page shows it. A small parser for the browsers
// and systems people use, not a full user-agent library: anything it doesn't
// recognise is "Unknown browser" or "an unknown system".

export type DeviceInfo = { browser: string | null; os: string | null };

// Order matters: Edge, Opera and Samsung Internet also say "Chrome" and
// "Safari"; Chrome also says "Safari".
const BROWSERS: [RegExp, string][] = [
  [/\bEdg(e|A|iOS)?\//, "Edge"],
  [/\b(OPR|Opera)\//, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\b(Firefox|FxiOS)\//, "Firefox"],
  [/\b(HeadlessChrome|Chrome|CriOS|Chromium)\//, "Chrome"],
  [/\bVersion\/[\d.]+.*\bSafari\//, "Safari"],
  [/\b(iPhone|iPad).*AppleWebKit\//, "Safari"],
];

// iPhone and iPad before Mac (iPads also say "like Mac OS X"); Android before Linux.
const SYSTEMS: [RegExp, string][] = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bWindows\b/, "Windows"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bLinux\b/, "Linux"],
];

const first = (ua: string, list: [RegExp, string][]) => list.find(([re]) => re.test(ua))?.[1] ?? null;

/** The browser and system a user agent names, each null when unknown. */
export const deviceInfo = (userAgent: string | null | undefined): DeviceInfo => {
  const ua = userAgent?.trim() ?? "";
  if (!ua) return { browser: null, os: null };
  return { browser: first(ua, BROWSERS), os: first(ua, SYSTEMS) };
};

/** "Chrome on macOS", "Safari on iPhone", "Firefox", "Unknown browser on Linux", or "Unknown device". */
export const deviceLabel = (userAgent: string | null | undefined) => {
  const { browser, os } = deviceInfo(userAgent);
  if (!browser && !os) return "Unknown device";
  if (!os) return browser!;
  return `${browser ?? "Unknown browser"} on ${os}`;
};
