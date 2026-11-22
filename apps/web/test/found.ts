import { vi } from "vitest";

/**
 * The one timeout for every harness wait (`found`, `waitUntil`, `stopsMoving`) and, in
 * `vitest.config.ts`, for `expect.poll` and `expect.element`. A slow machine is handled here, so tests
 * don't pass their own milliseconds.
 */
export const WAIT_TIMEOUT = 5000;

/**
 * The test clock's start: 2027-06-09 (a Wednesday, away from daylight-saving changes and month ends) at
 * 12:00 in the browser's zone, or at `VITE_TEST_CLOCK=HH:MM`. `test/setup.ts` sets the clock here before
 * each test file's imports and again before each test, and it ticks from there.
 */
export const TEST_NOW: number = (() => {
  const [hour = 12, minute = 0] = (import.meta.env.VITE_TEST_CLOCK ?? "12:00").split(":").map(Number);
  return new Date(2027, 5, 9, hour, minute, 0, 0).getTime();
})();

/**
 * Fake `Date` and the timers at `now` (the test clock's start by default), still advancing. The setup's
 * `afterEach` restores the test clock (`vi.useRealTimers()`), as a test may do itself earlier.
 */
export const fixClock = (now: Date | number = TEST_NOW) => {
  vi.useFakeTimers({
    toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"],
    shouldAdvanceTime: true,
    now,
  });
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

/**
 * Wait until `read` returns something truthy (a throw counts as not yet), and return it. Times out after
 * `WAIT_TIMEOUT`, saying what was being waited for. Deadlines use `performance.now()`, so a test that
 * fakes `Date` can't hang it.
 */
export async function waitUntil<T>(read: () => T | null | undefined | false, message?: string): Promise<T> {
  const deadline = performance.now() + WAIT_TIMEOUT;
  for (;;) {
    try {
      const value = read();
      if (value) return value;
    } catch {
      // Not yet.
    }
    if (performance.now() >= deadline) {
      throw new Error(
        `waitUntil: not true within ${WAIT_TIMEOUT} ms${message ? `: ${message}` : ""} (${read.toString()}).`,
      );
    }
    await tick();
  }
}

/**
 * Wait for an element to exist, then return it. Under load a render, a write or a sheet closing hasn't
 * reached the DOM yet when the next line runs, so a test reads through this instead of
 * `X()!.querySelector(…)!`:
 *
 *   await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
 *   await userEvent.click(await found(PREPARE)); // a getter that returns the element or null
 *
 * The read function may return null, undefined or false for "not there yet" (or throw, which also
 * counts as not there yet). It times out after `WAIT_TIMEOUT`, saying what was being waited for.
 */
export async function found<T extends Element>(
  read: () => T | null | undefined | false,
  options: { timeout?: number; message?: string } = {},
): Promise<T> {
  const { timeout = WAIT_TIMEOUT, message } = options;
  const deadline = performance.now() + timeout;
  for (;;) {
    try {
      const el = read();
      if (el) return el;
    } catch {
      // Not there yet.
    }
    if (performance.now() >= deadline) {
      throw new Error(
        `found: no element within ${timeout} ms${message ? `: ${message}` : ""} (${read.toString()}).`,
      );
    }
    await tick();
  }
}

/**
 * Wait until an element has stopped moving: its top edge is the same for about 400 ms. Late content
 * (quick-entry chips, a settling list) pushes the rows down, and a click or hover before that lands
 * on whatever moved into the spot. Resolves once the element has been still, rejects after `timeout`.
 */
export async function stopsMoving(
  read: () => Element | null | undefined,
  timeout = WAIT_TIMEOUT,
): Promise<void> {
  const deadline = performance.now() + timeout;
  let top = -1;
  let still = 0;
  for (;;) {
    let now = -1;
    try {
      now = read()?.getBoundingClientRect().top ?? -1;
    } catch {
      // Not there yet.
    }
    still = now === top ? still + 1 : 0;
    top = now;
    if (still >= 20) return;
    if (performance.now() >= deadline)
      throw new Error(`stopsMoving: still moving after ${timeout} ms (${read.toString()}).`);
    await tick();
  }
}
