import type { calendar_v3 } from "@googleapis/calendar";
import type {
  GoogleCalendarClient,
  GoogleCalendarSession,
  GoogleEvent,
  GoogleEventInput,
  GoogleEventTime,
} from "./client";

import { calendar } from "@googleapis/calendar";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { newError } from "../errors";
import { GOOGLE_CALENDAR_SCOPE, googleRedirectUri } from "./client";

// The real Google Calendar client (appointments-2, slice 7), used only when
// GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. Errors become
// `googleCalendar:*` codes with Google's HTTP status alone: a gaxios error
// holds the request, Authorization header included, so it's never kept as
// a cause or logged. Tests use the fake; `pnpm calendar:google-smoke`
// (slice 9) checks this one against a real account.

type HttpFailure = {
  status?: number;
  code?: string | number;
  response?: { status?: number; data?: unknown };
};

const statusOf = (error: unknown) => {
  const e = error as HttpFailure;
  return e?.response?.status ?? e?.status ?? (typeof e?.code === "number" ? e.code : undefined);
};

/** Google's OAuth error (`invalid_grant`: revoked or expired), from a token call. */
const oauthErrorOf = (error: unknown) => {
  const data = (error as HttpFailure)?.response?.data as { error?: unknown } | undefined;
  return typeof data?.error === "string" ? data.error : undefined;
};

const failure = (error: unknown) => {
  const status = statusOf(error);
  if (status === 401 || oauthErrorOf(error) === "invalid_grant")
    return newError({ code: "googleCalendar:revoked", meta: { status } });
  if (status === 404 || status === 410)
    return newError({ code: "googleCalendar:notFound", meta: { status } });
  return newError({ code: "googleCalendar:failed", meta: { status } });
};

const call = async <T>(run: () => Promise<T>) => {
  try {
    return await run();
  } catch (error) {
    return failure(error);
  }
};

const toTime = (time: calendar_v3.Schema$EventDateTime | undefined): GoogleEventTime | null => {
  if (time?.date) return { date: time.date };
  if (time?.dateTime) return { dateTime: time.dateTime, timeZone: time.timeZone ?? "UTC" };
  return null;
};

const fromGoogle = (event: calendar_v3.Schema$Event): GoogleEvent => ({
  id: event.id ?? "",
  etag: event.etag ?? "",
  status: event.status === "cancelled" || event.status === "tentative" ? event.status : "confirmed",
  summary: event.summary ?? null,
  description: event.description ?? null,
  location: event.location ?? null,
  start: toTime(event.start),
  end: toTime(event.end),
  privateProperties: { ...(event.extendedProperties?.private ?? {}) },
  updated: event.updated ?? "",
});

const toGoogle = (event: GoogleEventInput): calendar_v3.Schema$Event => ({
  id: event.id,
  status: "confirmed",
  summary: event.summary,
  description: event.description,
  location: event.location,
  start: event.start,
  end: event.end,
  transparency: event.transparency,
  extendedProperties: { private: event.privateProperties },
});

const session = (auth: OAuth2Client): GoogleCalendarSession => {
  const api = calendar({ version: "v3", auth });
  return {
    createCalendar: ({ summary, timeZone }) =>
      call(async () => {
        const res = await api.calendars.insert({ requestBody: { summary, timeZone } });
        return { id: res.data.id ?? "" };
      }),
    upsertEvent: (calendarId, event) =>
      call(async () => {
        const requestBody = toGoogle(event);
        try {
          const res = await api.events.update({ calendarId, eventId: event.id, requestBody });
          return { id: res.data.id ?? event.id, etag: res.data.etag ?? "" };
        } catch (error) {
          if (statusOf(error) !== 404) throw error;
          const res = await api.events.insert({ calendarId, requestBody });
          return { id: res.data.id ?? event.id, etag: res.data.etag ?? "" };
        }
      }),
    deleteEvent: async (calendarId, eventId) => {
      const res = await call(async () => {
        await api.events.delete({ calendarId, eventId });
        return true as const;
      });
      return typeof res === "object" && res.code === "googleCalendar:notFound" ? true : res;
    },
    listChanges: async (calendarId, syncToken) => {
      const events: GoogleEvent[] = [];
      let pageToken: string | undefined;
      try {
        for (let page = 0; page < 100; page++) {
          const res = await api.events.list({
            calendarId,
            showDeleted: true,
            singleEvents: true,
            maxResults: 250,
            ...(syncToken ? { syncToken } : {}),
            ...(pageToken ? { pageToken } : {}),
          });
          events.push(...(res.data.items ?? []).map(fromGoogle));
          if (res.data.nextPageToken) {
            pageToken = res.data.nextPageToken;
            continue;
          }
          return { events, syncToken: res.data.nextSyncToken ?? "" };
        }
        return newError({ code: "googleCalendar:failed", meta: { reason: "tooManyPages" } });
      } catch (error) {
        // A sync token Google no longer honours: start again without one.
        if (syncToken && statusOf(error) === 410) return { fullSyncRequired: true as const };
        return failure(error);
      }
    },
  };
};

/** The real client, or null when GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET isn't set. */
export const realGoogleCalendar = (env: NodeJS.ProcessEnv = process.env): GoogleCalendarClient | null => {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const redirectUri = googleRedirectUri(env);
  const oauth = () => new OAuth2Client({ clientId, clientSecret, redirectUri });

  return {
    authUrl: ({ state, codeChallenge }) =>
      oauth().generateAuthUrl({
        access_type: "offline",
        // Always ask, so Google gives a refresh token on a reconnect too.
        prompt: "consent",
        scope: [GOOGLE_CALENDAR_SCOPE],
        state,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
      }),
    exchangeCode: ({ code, codeVerifier }) =>
      call(async () => {
        const { tokens } = await oauth().getToken({ code, codeVerifier, redirect_uri: redirectUri });
        return { refreshToken: tokens.refresh_token ?? null, scope: tokens.scope ?? "" };
      }),
    refresh: (refreshToken) =>
      call(async () => {
        const auth = oauth();
        auth.setCredentials({ refresh_token: refreshToken });
        // Fails here (invalid_grant) when the member revoked access in Google.
        await auth.getAccessToken();
        return session(auth);
      }),
    revoke: (refreshToken) =>
      call(async () => {
        await oauth().revokeToken(refreshToken);
        return true as const;
      }),
  };
};
