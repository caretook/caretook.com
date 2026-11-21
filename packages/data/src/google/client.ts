import type { AppError } from "../errors";

// The Google Calendar client (appointments-2, slice 7): the one seam between
// Caretook and Google. `realGoogleCalendar` (real.ts) is over
// `@googleapis/calendar` and `google-auth-library`; `fakeGoogleCalendar`
// (fake.ts) is in memory, for tests, and can play a member editing in Google.
// Every method returns its failure (an AppError with a `googleCalendar:*`
// code), never throws, and never carries a token in an error.

/**
 * The narrowest scope that covers what we do: make our own secondary
 * calendar, and create, change, delete and list (with a sync token) events
 * in it. Google's reference lists `calendar.app.created` for
 * calendars.insert and events.insert, update, delete and list (checked
 * 2026-11-20); it never sees the member's other calendars.
 */
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";

/** Our item's uid and status, in the event's private extended properties. */
export const UID_PROPERTY = "caretookUid";
export const STATUS_PROPERTY = "caretookStatus";

/** A timed event's instant and zone, or an all-day event's day ("YYYY-MM-DD"; the end exclusive). */
export type GoogleEventTime = { dateTime: string; timeZone: string } | { date: string };

/** What Caretook writes as an event. Its `id` is ours (base32hex), so a repeated write never duplicates. */
export type GoogleEventInput = {
  id: string;
  summary: string;
  description: string;
  location: string | null;
  start: GoogleEventTime;
  end: GoogleEventTime;
  /** A cancelled appointment stays visible, marked, and shows as free. */
  transparency: "opaque" | "transparent";
  privateProperties: Record<string, string>;
};

/** An event as Google holds it (what `listChanges` gives; slice 9 reads these). */
export type GoogleEvent = {
  id: string;
  etag: string;
  /** `cancelled` is Google's word for deleted. */
  status: "confirmed" | "tentative" | "cancelled";
  summary: string | null;
  description: string | null;
  location: string | null;
  start: GoogleEventTime | null;
  end: GoogleEventTime | null;
  privateProperties: Record<string, string>;
  updated: string;
};

export type GoogleChanges =
  { events: GoogleEvent[]; syncToken: string; fullSyncRequired?: false } | { fullSyncRequired: true };

/** Calls made with one member's access (a refreshed token). */
export type GoogleCalendarSession = {
  createCalendar: (args: { summary: string; timeZone: string }) => Promise<{ id: string } | AppError>;
  /** Create or replace the event with `event.id` (a deleted one comes back). */
  upsertEvent: (
    calendarId: string,
    event: GoogleEventInput,
  ) => Promise<{ id: string; etag: string } | AppError>;
  /** Delete an event; one already gone counts as deleted. */
  deleteEvent: (calendarId: string, eventId: string) => Promise<true | AppError>;
  /** The events changed since `syncToken` (every event with none), or that a full sync is needed. */
  listChanges: (calendarId: string, syncToken: string | null) => Promise<GoogleChanges | AppError>;
};

export type GoogleCalendarClient = {
  /** Google's consent page for `state`, with PKCE (S256) and offline access. */
  authUrl: (args: { state: string; codeChallenge: string }) => string;
  /** Trade the callback's code (and our PKCE verifier) for tokens; Google may give no refresh token. */
  exchangeCode: (args: {
    code: string;
    codeVerifier: string;
  }) => Promise<{ refreshToken: string | null; scope: string } | AppError>;
  /** A session from a refresh token, or `googleCalendar:revoked` when Google refuses it. */
  refresh: (refreshToken: string) => Promise<GoogleCalendarSession | AppError>;
  /** Revoke a token at Google (disconnect). */
  revoke: (refreshToken: string) => Promise<true | AppError>;
};

// ---------------------------------------------------------------------------
// Which client this process uses
// ---------------------------------------------------------------------------

let override: GoogleCalendarClient | null | undefined;

/**
 * Use `client` in this process instead of the real one (dev tooling and
 * tests); null turns Google off, undefined goes back to the real one.
 */
export const setGoogleCalendarClient = (client: GoogleCalendarClient | null | undefined) => {
  override = client;
};

/** The override, if one is set (`undefined`: none; `getGoogleCalendarClient` in index.ts falls back to the real one). */
export const googleCalendarOverride = () => override;

/** The app's origin, for the OAuth redirect and items' links. */
export const appOrigin = (env: NodeJS.ProcessEnv = process.env) =>
  (env.APP_URL?.trim() || "http://localhost:5173").replace(/\/+$/, "");

/** Where Google sends the member back. */
export const googleRedirectUri = (env: NodeJS.ProcessEnv = process.env) =>
  `${appOrigin(env)}/api/google/callback`;
