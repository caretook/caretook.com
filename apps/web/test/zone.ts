// Zones in a component test. The device's is the browser context's (vitest.config.ts):
// America/Los_Angeles in `web:components`, America/New_York in `web:components:ny`
// and the release tier's second-zone jobs. The recipient's stays the fixtures'
// (TEST_TIME_ZONE), so in New York the two differ: a world that models the
// recipient's day (pass times, a care period's start) builds its moments with
// `recipientTime`, and a test that reads a time the screen shows in the viewer's
// zone builds what it expects with `deviceTime`.
//
// A second-zone failure too big to fix where it's found is skipped in New York
// only, naming its filed item, never through the shared quarantine (which has no
// zone, so it would drop the Los Angeles run too):
//
//   test.skipIf(inSecondZone("B-123"))("…", …)

import { TEST_TIME_ZONE } from "./fixtures";
import { addDays, dayInZone, zonedInstant } from "@caretook/data/domain";

/** `SECOND_ZONE` in scripts/ci/zones.mjs (untyped, so not imported here; keep the two the same). */
export const SECOND_ZONE = "America/New_York";

/** The device's IANA zone. */
export const deviceZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** True in the second zone, for a New York-only skip; `item` is the filed backlog item it names. */
export const inSecondZone = (item: `B-${number}`): boolean => item.length > 0 && deviceZone() === SECOND_ZONE;

const pad = (n: number) => String(n).padStart(2, "0");

/** `hour`:`minute` in the recipient's zone, `daysBack` days before today there (now: the clock's). */
export const recipientTime = (daysBack: number, hour = 0, minute = 0, now = new Date()): Date =>
  zonedInstant(
    addDays(dayInZone(now, TEST_TIME_ZONE), -daysBack),
    `${pad(hour)}:${pad(minute)}`,
    TEST_TIME_ZONE,
  );

/** A moment as the screen shows it in the device's zone: "9:30 AM" (en-US), or "09:30" with `hour12: false`. */
export const deviceTime = (when: Date | string | number, { hour12 = true } = {}): string =>
  new Intl.DateTimeFormat("en-US", {
    hour: hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12,
  }).format(new Date(when));
