import type {
  GoogleCalendarClient,
  GoogleCalendarSession,
  GoogleEvent,
  GoogleEventInput,
  GoogleEventTime,
} from "./client";

import { newError } from "../errors";
import { UID_PROPERTY } from "./client";

// An in-memory Google Calendar for tests (appointments-2, slice 7): OAuth
// codes, refresh tokens, calendars and events, with a change log behind
// sync tokens. `user` plays the member editing in Google (slice 9's pull),
// and `revokeAccess` plays them removing Caretook's access. Everything is
// made up; nothing leaves the process.

type StoredEvent = GoogleEvent & { seq: number };
type StoredCalendar = {
  id: string;
  summary: string;
  timeZone: string;
  refreshToken: string;
  events: Map<string, StoredEvent>;
};

export type FakeGoogleCalendar = GoogleCalendarClient & {
  /** Make a code the callback can trade (as Google's consent page would). */
  grant: (opts?: { refreshToken?: string | null; scope?: string }) => string;
  /** The member removes Caretook's access in their Google account. */
  revokeAccess: (refreshToken: string) => void;
  /** Make the next calls fail as if Google were down (`googleCalendar:failed`), or stop. */
  failCalls: (on: boolean) => void;
  /** Google forgets the sync tokens it gave (the next `listChanges` with one needs a full sync). */
  expireSyncTokens: () => void;
  calendars: () => { id: string; summary: string; timeZone: string }[];
  /** A calendar's live (not deleted) events, by start. */
  events: (calendarId: string) => GoogleEvent[];
  /** Any event, deleted ones included. */
  event: (calendarId: string, eventId: string) => GoogleEvent | null;
  /** Calls made, by method. */
  calls: Record<
    "createCalendar" | "upsertEvent" | "deleteEvent" | "listChanges" | "revoke" | "refresh",
    number
  >;
  revoked: () => string[];
  /** The member, in Google. */
  user: {
    move: (calendarId: string, eventId: string, start: GoogleEventTime, end: GoogleEventTime) => GoogleEvent;
    delete: (calendarId: string, eventId: string) => void;
    create: (
      calendarId: string,
      event: { summary: string; start: GoogleEventTime; end: GoogleEventTime },
    ) => GoogleEvent;
  };
};

/** A synchronous handler as an async method (the fake answers at once). */
const later =
  <A extends unknown[], R>(fn: (...args: A) => R) =>
  (...args: A): Promise<R> =>
    Promise.resolve(fn(...args));

const startKey = (time: GoogleEventTime | null) =>
  !time ? "" : "date" in time ? `${time.date}T00:00:00.000Z` : new Date(time.dateTime).toISOString();

export const fakeGoogleCalendar = (): FakeGoogleCalendar => {
  // Ids and tokens unique to this fake, so two fakes in one test run never share a token.
  const run = Math.random().toString(36).slice(2, 8);
  let counter = 0;
  let seq = 0;
  let syncEpoch = 0;
  let failing = false;
  const codes = new Map<string, { refreshToken: string | null; scope: string; verifier?: string }>();
  const live = new Set<string>();
  const revokedTokens: string[] = [];
  const calendars = new Map<string, StoredCalendar>();
  const calls: FakeGoogleCalendar["calls"] = {
    createCalendar: 0,
    upsertEvent: 0,
    deleteEvent: 0,
    listChanges: 0,
    revoke: 0,
    refresh: 0,
  };
  const next = (prefix: string) => `${prefix}${run}-${++counter}`;
  const down = () => newError({ code: "googleCalendar:failed", meta: { status: 503 } });

  const store = (calendar: StoredCalendar, event: Omit<StoredEvent, "seq" | "etag" | "updated">) => {
    const stored: StoredEvent = {
      ...event,
      etag: `"etag-${++seq}"`,
      updated: new Date(Date.UTC(2026, 10, 18) + seq * 1000).toISOString(),
      seq,
    };
    calendar.events.set(stored.id, stored);
    return stored;
  };
  const view = ({ seq: _seq, ...event }: StoredEvent): GoogleEvent => ({
    ...event,
    privateProperties: { ...event.privateProperties },
  });

  const calendarFor = (refreshToken: string, calendarId: string) => {
    const calendar = calendars.get(calendarId);
    return calendar && calendar.refreshToken === refreshToken ? calendar : null;
  };

  const session = (refreshToken: string): GoogleCalendarSession => {
    const guard = () => {
      if (failing) return down();
      if (!live.has(refreshToken)) return newError({ code: "googleCalendar:revoked", meta: { status: 401 } });
      return null;
    };
    return {
      createCalendar: later(({ summary, timeZone }) => {
        calls.createCalendar++;
        const refused = guard();
        if (refused) return refused;
        const id = `${next("cal")}@group.calendar.google.com`;
        calendars.set(id, { id, summary, timeZone, refreshToken, events: new Map() });
        return { id };
      }),
      upsertEvent: later((calendarId, event: GoogleEventInput) => {
        calls.upsertEvent++;
        const refused = guard();
        if (refused) return refused;
        const calendar = calendarFor(refreshToken, calendarId);
        if (!calendar) return newError({ code: "googleCalendar:notFound", meta: { status: 404 } });
        const stored = store(calendar, {
          id: event.id,
          status: "confirmed",
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: event.start,
          end: event.end,
          privateProperties: { ...event.privateProperties },
        });
        return { id: stored.id, etag: stored.etag };
      }),
      deleteEvent: later((calendarId, eventId) => {
        calls.deleteEvent++;
        const refused = guard();
        if (refused) return refused;
        const calendar = calendarFor(refreshToken, calendarId);
        if (!calendar) return newError({ code: "googleCalendar:notFound", meta: { status: 404 } });
        const existing = calendar.events.get(eventId);
        if (existing && existing.status !== "cancelled")
          store(calendar, { ...existing, status: "cancelled" });
        return true;
      }),
      listChanges: later((calendarId, syncToken) => {
        calls.listChanges++;
        const refused = guard();
        if (refused) return refused;
        const calendar = calendarFor(refreshToken, calendarId);
        if (!calendar) return newError({ code: "googleCalendar:notFound", meta: { status: 404 } });
        let after = 0;
        if (syncToken) {
          const match = /^sync-(\d+)-(\d+)$/.exec(syncToken);
          if (!match || Number(match[1]) !== syncEpoch) return { fullSyncRequired: true };
          after = Number(match[2]);
        }
        const events = [...calendar.events.values()]
          .filter((e) => e.seq > after && (syncToken || e.status !== "cancelled"))
          .sort((a, b) => a.seq - b.seq)
          .map(view);
        return { events, syncToken: `sync-${syncEpoch}-${seq}` };
      }),
    };
  };

  const userCalendar = (calendarId: string) => {
    const calendar = calendars.get(calendarId);
    if (!calendar) throw new Error(`fake Google: no calendar ${calendarId}`);
    return calendar;
  };
  const userEvent = (calendarId: string, eventId: string) => {
    const calendar = userCalendar(calendarId);
    const event = calendar.events.get(eventId);
    if (!event) throw new Error(`fake Google: no event ${eventId}`);
    return { calendar, event };
  };

  return {
    authUrl: ({ state, codeChallenge }) =>
      `https://accounts.google.example/o/oauth2/auth?state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}`,
    exchangeCode: later(({ code }) => {
      if (failing) return down();
      const granted = codes.get(code);
      if (!granted) return newError({ code: "googleCalendar:failed", meta: { status: 400 } });
      codes.delete(code);
      if (granted.refreshToken) live.add(granted.refreshToken);
      return { refreshToken: granted.refreshToken, scope: granted.scope };
    }),
    refresh: later((refreshToken) => {
      calls.refresh++;
      if (failing) return down();
      if (!live.has(refreshToken)) return newError({ code: "googleCalendar:revoked", meta: { status: 400 } });
      return session(refreshToken);
    }),
    revoke: later((refreshToken) => {
      calls.revoke++;
      if (failing) return down();
      live.delete(refreshToken);
      revokedTokens.push(refreshToken);
      return true;
    }),

    grant: ({ refreshToken, scope } = {}) => {
      const code = next("code-");
      codes.set(code, {
        refreshToken: refreshToken === undefined ? next("1//fake-refresh-") : refreshToken,
        scope: scope ?? "https://www.googleapis.com/auth/calendar.app.created",
      });
      return code;
    },
    revokeAccess: (refreshToken) => {
      live.delete(refreshToken);
    },
    failCalls: (on) => {
      failing = on;
    },
    expireSyncTokens: () => {
      syncEpoch++;
    },
    calendars: () => [...calendars.values()].map(({ id, summary, timeZone }) => ({ id, summary, timeZone })),
    events: (calendarId) =>
      [...userCalendar(calendarId).events.values()]
        .filter((e) => e.status !== "cancelled")
        .sort((a, b) => startKey(a.start).localeCompare(startKey(b.start)) || a.id.localeCompare(b.id))
        .map(view),
    event: (calendarId, eventId) => {
      const event = calendars.get(calendarId)?.events.get(eventId);
      return event ? view(event) : null;
    },
    calls,
    revoked: () => [...revokedTokens],
    user: {
      move: (calendarId, eventId, start, end) => {
        const { calendar, event } = userEvent(calendarId, eventId);
        return view(store(calendar, { ...event, start, end }));
      },
      delete: (calendarId, eventId) => {
        const { calendar, event } = userEvent(calendarId, eventId);
        store(calendar, { ...event, status: "cancelled" });
      },
      create: (calendarId, { summary, start, end }) => {
        const calendar = userCalendar(calendarId);
        return view(
          store(calendar, {
            id: next("gevt"),
            status: "confirmed",
            summary,
            description: null,
            location: null,
            start,
            end,
            privateProperties: {},
          }),
        );
      },
    },
  };
};

/** The uid an event carries (ours), or null for one the member made in Google. */
export const eventUid = (event: Pick<GoogleEvent, "privateProperties">) =>
  event.privateProperties[UID_PROPERTY] ?? null;
