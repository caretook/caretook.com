import type { GoogleCalendarClient } from "./client";

import { createHash, randomBytes } from "node:crypto";
import { logError } from "../logging";
import { googleCalendarOverride } from "./client";
import { realGoogleCalendar } from "./real";

// Google Calendar (appointments-2, slices 7 and 9), server only: the client
// seam, the fake for tests, the pure push plan and pull interpretation, and
// the background runner the push uses after a commit.

export * from "./client";
export * from "./fake";
export * from "./pullPlan";
export * from "./pushPlan";
export { realGoogleCalendar } from "./real";

let real: GoogleCalendarClient | null | undefined;

/** This process's client: a test's override, else the real one when GOOGLE_CLIENT_ID and _SECRET are set, else null. */
export const getGoogleCalendarClient = (): GoogleCalendarClient | null => {
  const override = googleCalendarOverride();
  if (override !== undefined) return override;
  if (real === undefined) real = realGoogleCalendar();
  return real;
};

/** A fresh PKCE pair (RFC 7636, S256) and an OAuth state value. */
export const newOauthSecrets = () => {
  const codeVerifier = randomBytes(32).toString("base64url");
  return {
    state: randomBytes(32).toString("base64url"),
    codeVerifier,
    codeChallenge: createHash("sha256").update(codeVerifier).digest("base64url"),
  };
};

/**
 * Whether a stored Connect may finish: made for this member, and its 10
 * minutes (GOOGLE_OAUTH_STATE_MINUTES, from `start`) not yet up.
 */
export const oauthStateUsable = (
  pending: { userId: string; expiresAt: string } | null | undefined,
  actorId: string,
  now: Date,
) => !!pending && pending.userId === actorId && new Date(pending.expiresAt).getTime() > now.getTime();

/** How a state value is stored: its SHA-256 only. */
export const hashState = (state: string) => createHash("sha256").update(state).digest("hex");

// ---------------------------------------------------------------------------
// Work after the response (a push right after a save)
// ---------------------------------------------------------------------------

export type CalendarBackgroundRunner = (work: Promise<unknown>) => void;

const fireAndForget: CalendarBackgroundRunner = () => {};
let runner: CalendarBackgroundRunner = fireAndForget;

/**
 * How a push after a save is kept alive: `waitUntil` on Vercel
 * (entry.server.tsx), fire-and-forget elsewhere. The cron sweep picks up
 * anything missed, so nothing depends on it.
 */
export const setCalendarBackgroundRunner = (next: CalendarBackgroundRunner | null) => {
  runner = next ?? fireAndForget;
};

/** Run `work` after the response; a failure is logged, never unhandled. */
export const inCalendarBackground = (work: () => Promise<unknown>) => {
  runner(
    Promise.resolve()
      .then(work)
      .catch((error: unknown) => logError("calendars: background Google work failed", error)),
  );
};
