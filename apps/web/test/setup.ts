import "~/app.css";

import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { closeDevices } from "./device";
import { TEST_NOW } from "./found";

// The page as root.tsx renders it: the body's classes and the document's language.
document.documentElement.lang = "en";
document.body.className = "min-h-dvh bg-base-200 text-base-content";

// Every component test (Vitest's `web:components` project) runs with the
// app's stylesheet (Tailwind and daisyUI), and starts from a clean page:
// the screen unmounts before its database closes, so no watch outlives it.
afterEach(async () => {
  vi.useRealTimers();
  await cleanup();
  await closeDevices();
});

// Every test runs on the same clock: `TEST_NOW` (test/found.ts), 2027-06-09 at
// 12:00 in the browser's zone, moving with real time. A fixed date keeps a test
// from passing on one day and failing on another (month ends, daylight-saving
// changes, weekdays), and a fixed time keeps fixtures minutes and hours before
// now on the same day (B-225). Module-level fixtures read the clock as they
// load, so it is set here, before the test file's imports, and set again
// before each test, so one test's time can't leak into the next. It is a fixed
// offset on the real clock (not fake timers), so milliseconds keep moving (ids
// built from `updated_at` stay unique) and a test's own `vi.useFakeTimers` /
// `fixClock` takes over and restores to this clock; `afterEach` restores it in
// case the test didn't. The harness's deadlines use `performance.now()`, which
// neither this nor a faked `Date` moves. `VITE_TEST_CLOCK=00:30 pnpm
// test:components …` runs at another time of day.
const RealDate = Date;
let offset = TEST_NOW - RealDate.now();
globalThis.Date = new Proxy(RealDate, {
  apply: () => new RealDate(RealDate.now() + offset).toString(),
  construct: (target, args: ConstructorParameters<DateConstructor>, newTarget) =>
    Reflect.construct(target, args.length ? args : [target.now() + offset], newTarget) as object,
  get: (target, key) =>
    key === "now" ? (): number => target.now() + offset : (Reflect.get(target, key, target) as unknown),
});

beforeEach(() => {
  offset = TEST_NOW - RealDate.now();
});
