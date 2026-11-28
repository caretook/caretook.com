import type { FakeGoogleCalendar } from "../google";

import { and, eq, isNull, ne } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, createWorld, ok, system } from "../../test/fixtures";
import { getDb, withTransaction } from "../db";
import {
  calendarSyncJobSchema,
  DETAILS_CONSENT_VERSION,
  googleCalendarConnectionSchema,
  googleEventLinkSchema,
  googleOauthStateSchema,
  memberCalendarSettingSchema,
  todoSchema,
  userSchema,
} from "../db/schema";
import { isError } from "../errors";
import {
  fakeGoogleCalendar,
  setCalendarBackgroundRunner,
  setGoogleCalendarClient,
  STATUS_PROPERTY,
  UID_PROPERTY,
} from "../google";
import { openGoogleToken } from "../utils/googleToken";
import * as calendarSettingService from "./calendarSettingService";
import * as calendarSyncService from "./calendarSyncService";
import * as careGroupMemberService from "./careGroupMemberService";
import * as entryProviderService from "./entryProviderService";
import * as googleConnectionService from "./googleConnectionService";
import * as providerService from "./providerService";
import * as todoService from "./todoService";
import * as timelineEntryService from "./timelineEntryService";

// Google Calendar, connect and push (appointments-2 slice 7), against the
// in-memory fake. Pushes run as they do in production: queued in the
// writing service's transaction and started once it commits (the
// background runner is captured here and awaited), with the cron's sweep
// behind them. Names, places and tokens are made up.

let google: FakeGoogleCalendar;
let pending: Promise<unknown>[] = [];
/** Wait for every push started after a commit. */
const settled = async () => {
  while (pending.length) {
    const batch = pending;
    pending = [];
    await Promise.all(batch);
  }
};

beforeAll(() => {
  setCalendarBackgroundRunner((work) => pending.push(work));
});
afterAll(() => {
  setCalendarBackgroundRunner(null);
  setGoogleCalendarClient(undefined);
});
beforeEach(() => {
  google = fakeGoogleCalendar();
  setGoogleCalendarClient(google);
  pending = [];
});

const DAY = 86_400_000;
const inDays = (days: number, hour = 17) => {
  const at = new Date(Date.now() + days * DAY);
  at.setUTCHours(hour, 0, 0, 0);
  return at.toISOString();
};

const setup = async () => {
  const {
    u: { owner, caretaker, viewer },
    group,
    recipient,
  } = await createWorld({ members: ["caretaker", "viewer"] });
  const appointment = ok(
    await timelineEntryService.create(owner.ctx, {
      groupId: group.id,
      kind: "event",
      title: "Dialysis",
      place: "Riverside Clinic",
      occurredAt: inDays(1),
      endsAt: inDays(1, 18),
      timeZone: "America/Los_Angeles",
      details: null,
    }),
  )!;
  const todo = ok(
    await todoService.create(owner.ctx, {
      groupId: group.id,
      title: "Pick up the walker",
      dueOn: inDays(2).slice(0, 10),
    }),
  )!;
  return { owner, caretaker, viewer, group, recipient, appointment, todo };
};

/** Connect `who` through the whole flow (start, consent at the fake, complete). */
const connect = async (
  who: { ctx: { authUser: { id: string } } },
  groupId: string,
  refreshToken?: string,
) => {
  const started = ok(await googleConnectionService.start(who.ctx as never, groupId));
  const state = new URL(started.url).searchParams.get("state")!;
  const code = google.grant(refreshToken ? { refreshToken } : {});
  const done = ok(await googleConnectionService.complete(who.ctx as never, { code, state }));
  await settled();
  const [row] = await getDb()
    .select()
    .from(googleCalendarConnectionSchema)
    .where(eq(googleCalendarConnectionSchema.id, done.connectionId));
  return row!;
};

const summaries = (calendarId: string) => google.events(calendarId).map((e) => e.summary);

describe("connecting", () => {
  it("makes the member's own Caretook calendar and pushes the window, generic by default", async () => {
    const { owner, group, appointment, todo } = await setup();
    const conn = await connect(owner, group.id);
    expect(google.calendars()).toEqual([
      { id: conn.calendarId, summary: "Caretook: Pat Example", timeZone: "America/Los_Angeles" },
    ]);
    const events = google.events(conn.calendarId);
    expect(events.map((e) => [e.privateProperties[UID_PROPERTY], e.summary])).toEqual([
      [`entry:${appointment.id}`, "Event for Pat Example"],
      [`todo:${todo.id}`, "Todo for Pat Example"],
    ]);
    expect(JSON.stringify(events)).not.toMatch(/Dialysis|Riverside|walker/);
    expect(conn.lastPushedAt).not.toBeNull();
    // The work is done: no job waits.
    expect(
      await getDb().select().from(calendarSyncJobSchema).where(eq(calendarSyncJobSchema.groupId, group.id)),
    ).toEqual([]);
  });

  it("keeps the refresh token sealed to its connection", async () => {
    const { owner, group } = await setup();
    const conn = await connect(owner, group.id, "1//fake-refresh-pat-owner");
    expect(JSON.stringify(conn)).not.toContain("fake-refresh-pat-owner");
    expect(openGoogleToken(conn.refreshTokenSealed!, conn.id)).toBe("1//fake-refresh-pat-owner");
  });

  it("uses each Connect's state once, and only for the member who started it", async () => {
    const { owner, caretaker, group } = await setup();
    const started = ok(await googleConnectionService.start(owner.ctx, group.id));
    const state = new URL(started.url).searchParams.get("state")!;
    const someoneElse = await googleConnectionService.complete(caretaker.ctx, {
      code: google.grant(),
      state,
    });
    expect(isError(someoneElse) && someoneElse.code).toBe("googleConnectionService:badState");
    // Used up by the refused try.
    const again = await googleConnectionService.complete(owner.ctx, { code: google.grant(), state });
    expect(isError(again) && again.code).toBe("googleConnectionService:badState");
    expect(
      await getDb().select().from(googleOauthStateSchema).where(eq(googleOauthStateSchema.groupId, group.id)),
    ).toEqual([]);
  });

  it("refuses a state over 10 minutes old", async () => {
    const { owner, group } = await setup();
    const now = new Date();
    const started = ok(await googleConnectionService.start(owner.ctx, group.id, { now }));
    const state = new URL(started.url).searchParams.get("state")!;
    const late = await googleConnectionService.complete(
      owner.ctx,
      { code: google.grant(), state },
      { now: new Date(now.getTime() + 10 * 60_000) },
    );
    expect(isError(late) && late.code).toBe("googleConnectionService:badState");
  });

  it("is for members only, and needs Google set up", async () => {
    const { group } = await setup();
    const outsider = await createUser("outsider");
    const refused = await googleConnectionService.start(outsider.ctx, group.id);
    expect(isError(refused) && refused.code).toBe("googleConnectionService:notMember");
    const off = await googleConnectionService.start(outsider.ctx, group.id, { client: null });
    expect(isError(off) && off.code).toBe("googleConnectionService:notConfigured");
  });

  it("refuses a grant without lasting access", async () => {
    const { owner, group } = await setup();
    const started = ok(await googleConnectionService.start(owner.ctx, group.id));
    const state = new URL(started.url).searchParams.get("state")!;
    const done = await googleConnectionService.complete(owner.ctx, {
      code: google.grant({ refreshToken: null }),
      state,
    });
    expect(isError(done) && done.code).toBe("googleConnectionService:noRefreshToken");
  });
});

describe("pushing", () => {
  it("pushes an edited appointment once, after the save commits", async () => {
    const { owner, caretaker, group, appointment } = await setup();
    const conn = await connect(owner, group.id);
    const writes = google.calls.upsertEvent;
    ok(
      await timelineEntryService.update(caretaker.ctx, appointment.id, {
        occurredAt: inDays(1, 19),
        endsAt: inDays(1, 20),
      }),
    );
    await settled();
    expect(google.calls.upsertEvent).toBe(writes + 1);
    const moved = google
      .events(conn.calendarId)
      .find((e) => e.privateProperties[UID_PROPERTY] === `entry:${appointment.id}`);
    expect(moved?.start).toEqual({ dateTime: inDays(1, 19), timeZone: "America/Los_Angeles" });
    // Nothing changed since: the sweep makes no call.
    ok(await calendarSyncService.sweep());
    expect(google.calls.upsertEvent).toBe(writes + 1);
  });

  it("queues one job for many changes in one transaction", async () => {
    const { owner, group, appointment, todo } = await setup();
    await connect(owner, group.id);
    // Google off for a moment, so nothing runs the job before it's looked at.
    setGoogleCalendarClient(null);
    try {
      ok(
        await withTransaction(async (tx) => {
          ok(
            await timelineEntryService.update({ ...owner.ctx, tx }, appointment.id, {
              title: "Dialysis, chair 4",
            }),
          );
          ok(await todoService.update({ ...owner.ctx, tx }, todo.id, { title: "Pick up the walker today" }));
          return true;
        }),
      );
    } finally {
      setGoogleCalendarClient(google);
    }
    const jobs = await getDb()
      .select()
      .from(calendarSyncJobSchema)
      .where(eq(calendarSyncJobSchema.groupId, group.id));
    expect(jobs.map((j) => [j.reason, j.claimedAt])).toEqual([["entry", null]]);
    ok(await calendarSyncService.runDue());
  });

  it("marks a cancelled appointment cancelled, and removes a deleted todo", async () => {
    const { owner, group, appointment, todo } = await setup();
    const conn = await connect(owner, group.id);
    ok(
      await timelineEntryService.update(owner.ctx, appointment.id, { cancelledAt: new Date().toISOString() }),
    );
    ok(await todoService.remove(owner.ctx, todo.id));
    await settled();
    const [event, ...rest] = google.events(conn.calendarId);
    expect(rest).toEqual([]);
    expect(event).toMatchObject({
      summary: "Cancelled: Event for Pat Example",
      privateProperties: { [UID_PROPERTY]: `entry:${appointment.id}`, [STATUS_PROPERTY]: "cancelled" },
    });
    const links = await getDb()
      .select()
      .from(googleEventLinkSchema)
      .where(eq(googleEventLinkSchema.connectionId, conn.id));
    expect(links.map((l) => l.itemUid)).toEqual([`entry:${appointment.id}`]);
  });

  it("pushes no subtask, and deletes an event held for one at the next daily push", async () => {
    const { owner, group, appointment, todo } = await setup();
    // `held` was pushed while it was top-level (as before todo-subtasks-3); `fresh` is made a subtask.
    const held = ok(
      await todoService.create(owner.ctx, {
        groupId: group.id,
        title: "Call the pharmacy",
        dueOn: inDays(1).slice(0, 10),
      }),
    )!;
    const conn = await connect(owner, group.id);
    const uids = () => google.events(conn.calendarId).map((e) => e.privateProperties[UID_PROPERTY]);
    expect(uids()).toContain(`todo:${held.id}`);
    await getDb().update(todoSchema).set({ parentId: todo.id }).where(eq(todoSchema.id, held.id));
    const fresh = ok(
      await todoService.create(owner.ctx, {
        groupId: group.id,
        parentId: todo.id,
        title: "Measure the doorway",
        dueOn: inDays(1).slice(0, 10),
      }),
    )!;
    await settled();
    // Only this test's connection is due: the others' stop syncing here.
    await getDb()
      .update(googleCalendarConnectionSchema)
      .set({ lastError: "revoked" })
      .where(ne(googleCalendarConnectionSchema.id, conn.id));
    ok(await calendarSyncService.sweep({ now: new Date(Date.now() + 25 * 3_600_000) }));
    expect(uids().sort()).toEqual([`entry:${appointment.id}`, `todo:${todo.id}`].sort());
    const links = await getDb()
      .select()
      .from(googleEventLinkSchema)
      .where(eq(googleEventLinkSchema.connectionId, conn.id));
    expect(links.map((l) => l.itemUid).sort()).toEqual([`entry:${appointment.id}`, `todo:${todo.id}`].sort());
    expect(links.map((l) => l.itemUid)).not.toContain(`todo:${fresh.id}`);
  });

  it("pushes a Caretook event 200 days out", async () => {
    const { owner, caretaker, group } = await setup();
    const far = ok(
      await timelineEntryService.create(owner.ctx, {
        groupId: group.id,
        kind: "event",
        title: "Specialist visit",
        occurredAt: inDays(200),
        endsAt: inDays(200, 18),
        timeZone: "America/Los_Angeles",
        details: null,
      }),
    )!;
    const conn = await connect(caretaker, group.id);
    expect(google.events(conn.calendarId).map((e) => e.privateProperties[UID_PROPERTY])).toContain(
      `entry:${far.id}`,
    );
  });

  it("names only live providers, at the details level", async () => {
    const { owner, caretaker, group, appointment } = await setup();
    const provider = async (name: string) => {
      const made = ok(
        await providerService.create(owner.ctx, { groupId: group.id, type: "practice", name }),
      )!;
      ok(
        await entryProviderService.link(owner.ctx, {
          groupId: group.id,
          entryId: appointment.id,
          providerId: made.id,
        }),
      );
      return made;
    };
    const gone = await provider("Harbor Cardiology");
    await provider("Lakeside Nephrology");
    ok(await providerService.remove(owner.ctx, gone.id));
    await settled();

    const conn = await connect(caretaker, group.id);
    ok(
      await calendarSettingService.update(caretaker.ctx, group.id, {
        detailsConsent: true,
        detailsConsentVersion: DETAILS_CONSENT_VERSION,
      }),
    );
    await settled();
    const pushed = google
      .events(conn.calendarId)
      .find((e) => e.privateProperties[UID_PROPERTY] === `entry:${appointment.id}`)!;
    expect(pushed.description).toContain("Lakeside Nephrology");
    expect(JSON.stringify(pushed)).not.toContain("Harbor Cardiology");
  });

  it("rewrites the events when details go on, and back to generic when they go off", async () => {
    const { caretaker, group } = await setup();
    const conn = await connect(caretaker, group.id);
    ok(
      await calendarSettingService.update(caretaker.ctx, group.id, {
        detailsConsent: true,
        detailsConsentVersion: DETAILS_CONSENT_VERSION,
      }),
    );
    await settled();
    expect(summaries(conn.calendarId)).toEqual([
      "Event for Pat Example: Dialysis",
      "Todo for Pat Example: Pick up the walker",
    ]);
    expect(google.events(conn.calendarId)[0]!.location).toBe("Riverside Clinic");

    ok(await calendarSettingService.update(caretaker.ctx, group.id, { detailsConsent: false }));
    await settled();
    expect(summaries(conn.calendarId)).toEqual(["Event for Pat Example", "Todo for Pat Example"]);
    expect(JSON.stringify(google.events(conn.calendarId))).not.toMatch(/Dialysis|Riverside|walker/);
  });

  it("goes generic when the consent wording changed, until the member agrees again", async () => {
    const { caretaker, group } = await setup();
    const conn = await connect(caretaker, group.id);
    ok(
      await calendarSettingService.update(caretaker.ctx, group.id, {
        detailsConsent: true,
        detailsConsentVersion: DETAILS_CONSENT_VERSION,
      }),
    );
    await settled();
    expect(summaries(conn.calendarId)).toContain("Event for Pat Example: Dialysis");

    await getDb()
      .update(memberCalendarSettingSchema)
      .set({ detailsConsentVersion: "2020-01-01" })
      .where(eq(memberCalendarSettingSchema.userId, caretaker.user.id));
    ok(await calendarSyncService.pushConnection(conn, { client: google }));
    expect(summaries(conn.calendarId)).toEqual(["Event for Pat Example", "Todo for Pat Example"]);
    expect(JSON.stringify(google.events(conn.calendarId))).not.toMatch(/Dialysis|Riverside|walker/);

    ok(
      await calendarSettingService.update(caretaker.ctx, group.id, {
        detailsConsent: true,
        detailsConsentVersion: DETAILS_CONSENT_VERSION,
      }),
    );
    await settled();
    expect(summaries(conn.calendarId)).toEqual([
      "Event for Pat Example: Dialysis",
      "Todo for Pat Example: Pick up the walker",
    ]);
  });

  it("goes generic for everyone when the owners forbid details", async () => {
    const { owner, caretaker, group } = await setup();
    const conn = await connect(caretaker, group.id);
    ok(
      await calendarSettingService.update(caretaker.ctx, group.id, {
        detailsConsent: true,
        detailsConsentVersion: DETAILS_CONSENT_VERSION,
      }),
    );
    await settled();
    ok(await calendarSettingService.setDetailsAllowed(owner.ctx, group.id, false));
    await settled();
    expect(summaries(conn.calendarId)).toEqual(["Event for Pat Example", "Todo for Pat Example"]);
  });

  it("keeps a viewer's calendar current too", async () => {
    const { owner, viewer, group, appointment } = await setup();
    const conn = await connect(viewer, group.id);
    ok(await timelineEntryService.remove(owner.ctx, appointment.id));
    await settled();
    expect(summaries(conn.calendarId)).toEqual(["Todo for Pat Example"]);
  });

  it("skips a disabled member's connection, and resumes when they are re-enabled", async () => {
    const { owner, caretaker, group, appointment } = await setup();
    const conn = await connect(caretaker, group.id);
    const setDisabled = (disabledAt: string | null) =>
      getDb().update(userSchema).set({ disabledAt }).where(eq(userSchema.id, caretaker.user.id));
    await setDisabled(new Date().toISOString());
    const writes = google.calls.upsertEvent;
    ok(
      await timelineEntryService.update(owner.ctx, appointment.id, {
        occurredAt: inDays(1, 19),
        endsAt: inDays(1, 20),
      }),
    );
    await settled();
    ok(await calendarSyncService.runDue());
    expect(google.calls.upsertEvent).toBe(writes);
    // The connection stays; re-enabling resumes pushes.
    const [kept] = await getDb()
      .select()
      .from(googleCalendarConnectionSchema)
      .where(eq(googleCalendarConnectionSchema.id, conn.id));
    expect(kept?.disconnectedAt).toBeNull();
    await setDisabled(null);
    ok(
      await timelineEntryService.update(owner.ctx, appointment.id, {
        occurredAt: inDays(1, 21),
        endsAt: inDays(1, 22),
      }),
    );
    await settled();
    expect(google.calls.upsertEvent).toBeGreaterThan(writes);
  });

  it("records a refused token (Reconnect Google) and stops pushing until reconnected", async () => {
    const { owner, group, appointment } = await setup();
    const conn = await connect(owner, group.id, "1//fake-refresh-to-revoke");
    google.revokeAccess("1//fake-refresh-to-revoke");
    ok(await timelineEntryService.update(owner.ctx, appointment.id, { title: "Dialysis, moved" }));
    await settled();
    expect(ok(await googleConnectionService.status(owner.ctx, group.id))).toMatchObject({
      connected: true,
      error: "revoked",
    });
    // Reconnecting keeps the calendar, clears the error and pushes again.
    const again = await connect(owner, group.id);
    expect(again.id).toBe(conn.id);
    expect(again.calendarId).toBe(conn.calendarId);
    expect(again.lastError).toBeNull();
    expect(google.calendars()).toHaveLength(1);
  });

  it("retries a passing failure with backoff, and doesn't stop the connection", async () => {
    const { owner, group, appointment } = await setup();
    await connect(owner, group.id);
    google.failCalls(true);
    ok(await timelineEntryService.update(owner.ctx, appointment.id, { title: "Dialysis, later" }));
    await settled();
    const [retry] = await getDb()
      .select()
      .from(calendarSyncJobSchema)
      .where(eq(calendarSyncJobSchema.groupId, group.id));
    expect(retry).toMatchObject({ attempts: 1, claimedAt: null, lastError: "googleCalendar:failed" });
    expect(new Date(retry!.nextAttemptAt).getTime()).toBeGreaterThan(Date.now() + 30_000);
    expect(ok(await googleConnectionService.status(owner.ctx, group.id))).toMatchObject({ error: null });
    google.failCalls(false);
  });

  it("queues nothing for a group without a connection", async () => {
    const { owner, group, appointment } = await setup();
    ok(await timelineEntryService.update(owner.ctx, appointment.id, { title: "Dialysis, chair 2" }));
    expect(
      await getDb().select().from(calendarSyncJobSchema).where(eq(calendarSyncJobSchema.groupId, group.id)),
    ).toEqual([]);
  });

  it("queues the daily push for a connection not pushed in a day", async () => {
    const { owner, group } = await setup();
    const conn = await connect(owner, group.id);
    // Only this test's connection is due: the others' stop syncing here.
    await getDb()
      .update(googleCalendarConnectionSchema)
      .set({ lastError: "revoked" })
      .where(ne(googleCalendarConnectionSchema.id, conn.id));
    const refreshes = google.calls.refresh;
    const result = ok(await calendarSyncService.sweep({ now: new Date(Date.now() + 25 * 3_600_000) }));
    expect(result).toMatchObject({ configured: true, queuedDaily: 1, pushed: 1 });
    expect(google.calls.refresh).toBe(refreshes + 1);
    const [row] = await getDb()
      .select()
      .from(googleCalendarConnectionSchema)
      .where(eq(googleCalendarConnectionSchema.id, conn.id));
    expect(new Date(row!.lastPushedAt!).getTime()).toBeGreaterThan(Date.now() + 24 * 3_600_000);
  });
});

describe("disconnecting", () => {
  it("revokes the token, forgets it and stops pushing; the calendar stays in Google", async () => {
    const { owner, group, appointment } = await setup();
    const conn = await connect(owner, group.id, "1//fake-refresh-disconnect");
    const before = google.events(conn.calendarId);
    expect(ok(await googleConnectionService.disconnect(owner.ctx, group.id))).toEqual({
      groupId: group.id,
      connected: false,
    });
    expect(google.revoked()).toEqual(["1//fake-refresh-disconnect"]);

    ok(await timelineEntryService.update(owner.ctx, appointment.id, { title: "Dialysis, chair 9" }));
    await settled();
    expect(google.events(conn.calendarId)).toEqual(before);
    const [row] = await getDb()
      .select()
      .from(googleCalendarConnectionSchema)
      .where(eq(googleCalendarConnectionSchema.id, conn.id));
    expect(row).toMatchObject({ refreshTokenSealed: null, syncToken: null });
    expect(row!.disconnectedAt).not.toBeNull();
    expect(ok(await googleConnectionService.status(owner.ctx, group.id))).toEqual({
      connected: false,
      configured: true,
    });
    const twice = await googleConnectionService.disconnect(owner.ctx, group.id);
    expect(isError(twice) && twice.code).toBe("googleConnectionService:notConnected");
  });

  it("happens when a member leaves or is removed, and their token is revoked after the removal commits", async () => {
    const { owner, caretaker, viewer, group } = await setup();
    await connect(caretaker, group.id, "1//fake-refresh-leaver");
    await connect(viewer, group.id, "1//fake-refresh-removed");
    ok(await careGroupMemberService.leave(caretaker.ctx, group.id));
    const [membership] = ok(
      await careGroupMemberService.list(system, {
        filter: { groupId: { type: "eq", value: group.id }, userId: { type: "eq", value: viewer.user.id } },
      }),
    ).data;
    ok(await careGroupMemberService.remove(owner.ctx, membership!.id));
    await settled();
    expect(google.revoked().sort()).toEqual(["1//fake-refresh-leaver", "1//fake-refresh-removed"]);
    const live = await getDb()
      .select()
      .from(googleCalendarConnectionSchema)
      .where(
        and(
          eq(googleCalendarConnectionSchema.groupId, group.id),
          isNull(googleCalendarConnectionSchema.disconnectedAt),
        ),
      );
    expect(live).toEqual([]);
  });

  it("is left alone when the removal fails", async () => {
    const { owner, group } = await setup();
    await connect(owner, group.id, "1//fake-refresh-last-owner");
    // The last owner can't leave: the removal is refused, and nothing is disconnected.
    const refused = await careGroupMemberService.leave(owner.ctx, group.id);
    expect(isError(refused)).toBe(true);
    await settled();
    expect(google.revoked()).toEqual([]);
    expect(ok(await googleConnectionService.status(owner.ctx, group.id))).toMatchObject({ connected: true });
  });

  it("leaves a disabled member's connection out of the daily push, so it can't starve the others", async () => {
    const { owner, caretaker, group } = await setup();
    const mine = await connect(owner, group.id);
    const theirs = await connect(caretaker, group.id);
    const db = getDb();
    await db
      .update(googleCalendarConnectionSchema)
      .set({ lastError: "revoked" })
      .where(
        and(ne(googleCalendarConnectionSchema.id, mine.id), ne(googleCalendarConnectionSchema.id, theirs.id)),
      );
    await db
      .update(googleCalendarConnectionSchema)
      .set({ lastPushedAt: new Date(Date.now() - 3 * 24 * 3_600_000).toISOString() })
      .where(eq(googleCalendarConnectionSchema.id, theirs.id));
    await db
      .update(googleCalendarConnectionSchema)
      .set({ lastPushedAt: new Date(Date.now() - 2 * 24 * 3_600_000).toISOString() })
      .where(eq(googleCalendarConnectionSchema.id, mine.id));
    await db
      .update(userSchema)
      .set({ disabledAt: new Date().toISOString() })
      .where(eq(userSchema.id, caretaker.user.id));
    const result = ok(await calendarSyncService.sweep());
    expect(result).toMatchObject({ configured: true, queuedDaily: 1 });
    await db.update(userSchema).set({ disabledAt: null }).where(eq(userSchema.id, caretaker.user.id));
  });
});
