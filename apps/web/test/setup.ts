import "~/app.css";

import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { closeDevices } from "./device";

// The page as root.tsx renders it: the body's classes and the document's language.
document.documentElement.lang = "en";
document.body.className = "min-h-dvh bg-base-200 text-base-content";

// Every component test (Vitest's `web:components` project) runs with the
// app's stylesheet (Tailwind and daisyUI), and starts from a clean page:
// the screen unmounts before its database closes, so no watch outlives it.
afterEach(async () => {
  await cleanup();
  await closeDevices();
});

// Every test starts at the same time of day: today at 12:00 (the browser's
// zone), still moving with real time. Fixtures put entries minutes and hours
// before now, which would land on yesterday for a run just after midnight
// (B-225), and every module-level fixture reads the clock as it loads, so the
// clock is set here, before the test file's imports. Only `Date` is faked; a
// test that fakes timers itself (`fixClock`, `vi.useFakeTimers`) takes over
// and the next test gets this clock back. `VITE_TEST_CLOCK=00:30 pnpm
// test:components …` runs at another time of day.
const startOfTestDay = () => {
  const [hour = 12, minute = 0] = (import.meta.env.VITE_TEST_CLOCK ?? "12:00").split(":").map(Number);
  const now = new Date();
  now.setHours(hour, minute, 0, 0);
  return now;
};
const fixTestDay = () => {
  if (!vi.isFakeTimers())
    vi.useFakeTimers({ toFake: ["Date"], now: startOfTestDay(), shouldAdvanceTime: true });
};
fixTestDay();
beforeEach(fixTestDay);
