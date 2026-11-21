import type { GoogleCalendarSession } from "./client";

import { describe, expect, it } from "vitest";
import { isError } from "../errors";
import { UID_PROPERTY } from "./client";
import { eventUid, fakeGoogleCalendar } from "./fake";

// The in-memory Google Calendar (appointments-2 slice 7) that the push
// tests, and slice 9's pull, run against. Everything is made up.

const connected = async () => {
  const google = fakeGoogleCalendar();
  const { refreshToken } = (await google.exchangeCode({ code: google.grant(), codeVerifier: "v" })) as {
    refreshToken: string;
  };
  const session = (await google.refresh(refreshToken)) as GoogleCalendarSession;
  const { id: calendarId } = (await session.createCalendar({
    summary: "Caretook: Pat",
    timeZone: "UTC",
  })) as {
    id: string;
  };
  return { google, session, calendarId, refreshToken };
};

const event = (id: string, uid: string) => ({
  id,
  summary: "Appointment for Pat",
  description: "",
  location: null,
  start: { dateTime: "2026-11-19T17:00:00.000Z", timeZone: "UTC" },
  end: { dateTime: "2026-11-19T18:00:00.000Z", timeZone: "UTC" },
  transparency: "opaque" as const,
  privateProperties: { [UID_PROPERTY]: uid },
});

describe("fakeGoogleCalendar", () => {
  it("trades a code once, and refuses a revoked token", async () => {
    const google = fakeGoogleCalendar();
    const code = google.grant({ refreshToken: "1//fake-a" });
    expect(await google.exchangeCode({ code, codeVerifier: "v" })).toMatchObject({
      refreshToken: "1//fake-a",
    });
    expect(isError(await google.exchangeCode({ code, codeVerifier: "v" }))).toBe(true);
    google.revokeAccess("1//fake-a");
    const refused = await google.refresh("1//fake-a");
    expect(isError(refused) && refused.code).toBe("googleCalendar:revoked");
  });

  it("replaces an event written twice with the same id, with a new etag", async () => {
    const { google, session, calendarId } = await connected();
    const first = await session.upsertEvent(calendarId, event("ctabc1", "entry:1"));
    const second = await session.upsertEvent(calendarId, { ...event("ctabc1", "entry:1"), summary: "Moved" });
    expect(google.events(calendarId).map((e) => e.summary)).toEqual(["Moved"]);
    expect(first).not.toEqual(second);
  });

  it("lists changes since a sync token, deletions included, and asks for a full sync once tokens expire", async () => {
    const { google, session, calendarId } = await connected();
    await session.upsertEvent(calendarId, event("ctabc1", "entry:1"));
    const full = await session.listChanges(calendarId, null);
    if (isError(full) || full.fullSyncRequired) throw new Error("expected changes");
    expect(full.events.map(eventUid)).toEqual(["entry:1"]);

    google.user.move(calendarId, "ctabc1", { date: "2026-11-20" }, { date: "2026-11-21" });
    const made = google.user.create(calendarId, {
      summary: "Dentist",
      start: { date: "2026-11-22" },
      end: { date: "2026-11-23" },
    });
    google.user.delete(calendarId, "ctabc1");
    const changes = await session.listChanges(calendarId, full.syncToken);
    if (isError(changes) || changes.fullSyncRequired) throw new Error("expected changes");
    expect(changes.events.map((e) => [e.id, e.status, eventUid(e)])).toEqual([
      [made.id, "confirmed", null],
      ["ctabc1", "cancelled", "entry:1"],
    ]);

    google.expireSyncTokens();
    expect(await session.listChanges(calendarId, changes.syncToken)).toEqual({ fullSyncRequired: true });
  });

  it("counts a delete of a gone event as done, and fails every call while Google is down", async () => {
    const { google, session, calendarId } = await connected();
    expect(await session.deleteEvent(calendarId, "never-there")).toBe(true);
    google.failCalls(true);
    const down = await session.upsertEvent(calendarId, event("ctabc2", "entry:2"));
    expect(isError(down) && down.code).toBe("googleCalendar:failed");
  });
});
