import "~/app.css";

import { afterEach } from "vitest";
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

// Every test file runs at the same time of day: today at 12:00 (the browser's
// zone), moving with real time. Fixtures put entries minutes and hours before
// now, which would land on yesterday for a run just after midnight (B-225),
// and module-level fixtures read the clock as they load, so it is set here,
// before the test file's imports. It is a fixed offset on the real clock (not
// fake timers), so milliseconds keep moving (ids built from `updated_at`
// stay unique) and a test's own `vi.useFakeTimers` / `fixClock` takes over and
// restores to this clock. `VITE_TEST_CLOCK=00:30 pnpm test:components …`
// runs at another time of day.
const startOfTestDay = () => {
  const [hour = 12, minute = 0] = (import.meta.env.VITE_TEST_CLOCK ?? "12:00").split(":").map(Number);
  const now = new Date();
  now.setHours(hour, minute, 0, 0);
  return now.getTime();
};
const RealDate = Date;
const offset = startOfTestDay() - RealDate.now();
globalThis.Date = new Proxy(RealDate, {
  apply: () => new RealDate(RealDate.now() + offset).toString(),
  construct: (target, args: ConstructorParameters<DateConstructor>, newTarget) =>
    Reflect.construct(target, args.length ? args : [target.now() + offset], newTarget) as object,
  get: (target, key) =>
    key === "now" ? (): number => target.now() + offset : (Reflect.get(target, key, target) as unknown),
});
