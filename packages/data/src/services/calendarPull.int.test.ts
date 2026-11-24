import type { GoogleCalendarConnection } from "../db/schema";
import type { FakeGoogleCalendar, GoogleEvent } from "../google";

import { and, eq, notInArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createWorld, ok, system } from "../../test/fixtures";
import { getDb } from "../db";
import {
  googleCalendarConnectionSchema,
  googleEventLinkSchema,
  noteDocumentSchema,
  todoSchema,
  timelineEntrySchema,
} from "../db/schema";
import { isError } from "../errors";
import {
  fakeGoogleCalendar,
  googleEventId,
  setCalendarBackgroundRunner,
  setGoogleCalendarClient,
  UID_PROPERTY,
} from "../google";
import { timelineEntryModel } from "../models";
import { openGoogleToken } from "../utils/googleToken";
import * as appointmentSeriesService from "./appointmentSeriesService";
import * as calendarPullService from "./calendarPullService";
import * as calendarSyncService from "./calendarSyncService";
import * as googleConnectionService from "./googleConnectionService";
import * as todoService from "./todoService";
import * as timelineEntryService from "./timelineEntryService";

// Google Calendar pull (appointments-2 slice 9), against the in-memory fake
// playing the member in Google: moves, deletes and new events come back and
// are written as that member; what their role can't do is put back by the
// next push. Pushes run as in production (after the commit, captured here
// and awaited). Names, places and tokens are made up.

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
const HOUR = 3_600_000;
const LA = "America/Los_Angeles";
const inDays = (days: number, hour = 17) => {
  const at = new Date(Date.now() + days * DAY);
  at.setUTCHours(hour, 0, 0, 0);
  return at.toISOString();
};
const plusHours = (iso: string, hours: number) =>
  new Date(new Date(iso).getTime() + hours * HOUR).toISOString();
const timed = (iso: string) => ({ dateTime: iso, timeZone: LA });

const setup = async () => {
  const {
    u: { owner, caretaker, viewer },
    group,
  } = await createWorld({ members: ["caretaker", "viewer"] });
  const appointment = ok(
    await timelineEntryService.create(owner.ctx, {
      groupId: group.id,
      kind: "event",
      title: "Dialysis",
      place: "Riverside Clinic",
      occurredAt: inDays(1),
      endsAt: inDays(1, 18),
      timeZone: LA,
      details: null,
    }),
  )!;
  const todo = ok(
    await todoService.create(owner.ctx, {
      groupId: group.id,
      title: "Pick up the walker",
      dueOn: inDays(3).slice(0, 10),
    }),
  )!;
  return { owner, caretaker, viewer, group, appointment, todo };
};

type Member = { ctx: { authUser: { id: string } } };

/** Connect `who` (start, consent at the fake, complete) and let the first push finish. */
const connect = async (who: Member, groupId: string) => {
  const started = ok(await googleConnectionService.start(who.ctx as never, groupId));
  const state = new URL(started.url).searchParams.get("state")!;
  const done = ok(await googleConnectionService.complete(who.ctx as never, { code: google.grant(), state }));
  await settled();
  return connectionRow(done.connectionId);
};

const connectionRow = async (id: string) => {
  const [row] = await getDb()
    .select()
    .from(googleCalendarConnectionSchema)
    .where(eq(googleCalendarConnectionSchema.id, id));
  return row!;
};

/** Pull the connection now (as the cron would when it's due), then let the pushes it caused finish. */
const pull = async (conn: GoogleCalendarConnection, now = new Date()) => {
  const result = await calendarPullService.pullConnection(await connectionRow(conn.id), {
    client: google,
    now,
  });
  await settled();
  // An overwrite queues the connection's push; run it as the cron would.
  ok(await calendarSyncService.runDue({ client: google, now }));
  if (isError(result)) throw new Error(`pull failed: ${String(result.code)}`);
  return result;
};

/** Google's copy of an item. */
const eventOf = (conn: GoogleCalendarConnection, uid: string): GoogleEvent =>
  google.event(conn.calendarId, googleEventId(uid))!;

const entryRow = async (id: string) => {
  const [row] = await getDb().select().from(timelineEntrySchema).where(eq(timelineEntrySchema.id, id));
  return row!;
};

const ms = (value: string | null | undefined) => (value ? new Date(value).getTime() : null);

describe("pulling", () => {
  it("applies nothing on the first pull after connecting: every event is our own push", async () => {
    const { caretaker, group } = await setup();
    const conn = await connect(caretaker, group.id);
    const result = await pull(conn);
    expect(result).toMatchObject({ status: "pulled", applied: 0, overwritten: 0, fullSync: true });
    expect(result.status === "pulled" && result.ignored).toBe(2);
    const after = await connectionRow(conn.id);
    expect(after.syncToken).not.toBeNull();
    expect(after.lastPulledAt).not.toBeNull();
  });

  it("brings a move back as the member, and its push afterwards is an echo", async () => {
    const { caretaker, group, appointment } = await setup();
    const conn = await connect(caretaker, group.id);
    await pull(conn);

    const uid = `entry:${appointment.id}`;
    const start = plusHours(appointment.occurredAt, 2);
    const end = plusHours(appointment.occurredAt, 3.5);
    google.user.move(conn.calendarId, googleEventId(uid), timed(start), timed(end));
    expect(await pull(conn)).toMatchObject({ applied: 1, overwritten: 0 });

    const row = await entryRow(appointment.id);
    expect(ms(row.occurredAt)).toBe(ms(start));
    expect(ms(row.endsAt)).toBe(ms(end));
    // Written as the caretaker who moved it in Google.
    expect(row.updatedBy).toBe(caretaker.user.id);
    // Our push afterwards comes back as an echo.
    expect(await pull(conn)).toMatchObject({ applied: 0, overwritten: 0 });
    expect(ms((eventOf(conn, uid).start as { dateTime: string }).dateTime)).toBe(ms(start));
  });

  it("cancels an appointment deleted in Google, which stays in Google marked cancelled", async () => {
    const { caretaker, group, appointment } = await setup();
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    const uid = `entry:${appointment.id}`;
    google.user.delete(conn.calendarId, googleEventId(uid));
    expect(await pull(conn)).toMatchObject({ applied: 1 });

    const row = await entryRow(appointment.id);
    expect(row.cancelledAt).not.toBeNull();
    expect(row.cancelledBy).toBe(caretaker.user.id);
    expect(row.cancelReason).toBe(calendarPullService.DELETED_IN_GOOGLE_REASON);
    expect(row.deletedAt).toBeNull();
    const event = eventOf(conn, uid);
    expect(event.status).toBe("confirmed");
    expect(event.summary).toMatch(/^Cancelled: /);
  });

  it("moves the due day of a todo moved in Google", async () => {
    const { caretaker, group, todo } = await setup();
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    const uid = `todo:${todo.id}`;
    const day = inDays(5).slice(0, 10);
    google.user.move(conn.calendarId, googleEventId(uid), { date: day }, { date: inDays(6).slice(0, 10) });
    await pull(conn);
    expect(ok(await todoService.getById(caretaker.ctx as never, todo.id))).toMatchObject({
      dueOn: day,
      dueTime: null,
    });
  });

  it("leaves a past event as it was when its Google event is deleted, and it stays deleted", async () => {
    const { owner, caretaker, group } = await setup();
    const past = ok(
      await timelineEntryService.create(owner.ctx, {
        groupId: group.id,
        kind: "event",
        title: "Cardiology follow-up",
        occurredAt: inDays(-3),
        endsAt: inDays(-3, 18),
        timeZone: LA,
        details: null,
      }),
    )!;
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    const uid = `entry:${past.id}`;
    google.user.delete(conn.calendarId, googleEventId(uid));
    expect(await pull(conn)).toMatchObject({ applied: 0, overwritten: 0, ignored: 1 });

    const row = await entryRow(past.id);
    expect(row).toMatchObject({ cancelledAt: null, cancelReason: null, deletedAt: null });

    // The daily push doesn't bring it back: nothing about the item changed.
    ok(await calendarSyncService.enqueue(undefined, { connectionId: conn.id }, "daily"));
    ok(await calendarSyncService.runDue({ client: google }));
    await settled();
    expect(eventOf(conn, uid).status).toBe("cancelled");

    // Its time corrected in Caretook afterwards (the member's generic event shows no place), it is written again.
    const corrected = plusHours(past.occurredAt, 1);
    ok(
      await timelineEntryService.update(owner.ctx, past.id, {
        occurredAt: corrected,
        endsAt: plusHours(corrected, 1),
      }),
    );
    await settled();
    ok(await calendarSyncService.runDue({ client: google }));
    await settled();
    expect(eventOf(conn, uid).status).toBe("confirmed");
  });

  it("keeps an upcoming todo open when its Google event is deleted, and writes the event back", async () => {
    const { caretaker, group, todo } = await setup();
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    const uid = `todo:${todo.id}`;
    google.user.delete(conn.calendarId, googleEventId(uid));
    expect(await pull(conn)).toMatchObject({ applied: 0, overwritten: 1 });

    const [row] = await getDb().select().from(todoSchema).where(eq(todoSchema.id, todo.id));
    expect(row).toMatchObject({ doneAt: null, doneBy: null, deletedAt: null });
    expect(eventOf(conn, uid).status).toBe("confirmed");
    // The event written back comes in as our own echo.
    expect(await pull(conn)).toMatchObject({ applied: 0, overwritten: 0 });
  });

  it("gives a stored future note no item: nothing is pushed for it, and its plan is ignored", async () => {
    const { caretaker, group, appointment } = await setup();
    const note = ok(
      await timelineEntryModel.create({
        ...system,
        data: {
          groupId: group.id,
          recipientId: (await entryRow(appointment.id)).recipientId,
          kind: "note",
          title: "Call the pharmacy",
          occurredAt: inDays(2),
          timeZone: LA,
        },
      }),
    )!;
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    const uid = `entry:${note.id}`;
    expect(
      (await calendarSyncService.groupItems(group.id, new Date())) as { uid: string }[],
    ).not.toContainEqual(expect.objectContaining({ uid }));
    expect(google.event(conn.calendarId, googleEventId(uid))).toBeNull();
    expect(google.event(conn.calendarId, googleEventId(`entry:${appointment.id}`))).not.toBeNull();
  });

  it("takes a new event made in Google in as an appointment, then tags it, generic", async () => {
    const { caretaker, group } = await setup();
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    const start = inDays(4, 20);
    const made = google.user.create(conn.calendarId, {
      summary: "Eye exam",
      start: timed(start),
      end: timed(plusHours(start, 1)),
    });
    expect(await pull(conn)).toMatchObject({ applied: 1 });

    const [linked] = await getDb()
      .select()
      .from(googleEventLinkSchema)
      .where(
        and(
          eq(googleEventLinkSchema.connectionId, conn.id),
          eq(googleEventLinkSchema.googleEventId, made.id),
        ),
      );
    const entryId = linked!.itemUid.replace(/^entry:/, "");
    const row = await entryRow(entryId);
    expect(row).toMatchObject({ kind: "event", title: "Eye exam", groupId: group.id, timeZone: LA });
    expect(ms(row.occurredAt)).toBe(ms(start));
    expect(row.createdBy).toBe(caretaker.user.id);
    // An empty live-notes document, as an appointment made in Caretook has.
    const docs = await getDb().select().from(noteDocumentSchema).where(eq(noteDocumentSchema.id, entryId));
    expect(docs).toHaveLength(1);

    // The push tagged Google's event (its id kept) with our uid, in generic words.
    const tagged = google.event(conn.calendarId, made.id)!;
    expect(tagged.privateProperties[UID_PROPERTY]).toBe(`entry:${entryId}`);
    expect(tagged.summary).toBe("Event for Pat Example");
    expect(google.events(conn.calendarId)).toHaveLength(3);
    // And it isn't taken in twice.
    expect(await pull(conn)).toMatchObject({ applied: 0 });
    expect(google.events(conn.calendarId)).toHaveLength(3);
  });

  it("moves a series visit on its own (detached)", async () => {
    const { owner, group } = await setup();
    const startsOn = inDays(2).slice(0, 10);
    const series = ok(
      await appointmentSeriesService.create(owner.ctx, {
        groupId: group.id,
        kind: "event",
        rule: "FREQ=DAILY;INTERVAL=1;COUNT=3",
        startsOn,
        startTime: "09:00",
        timeZone: LA,
        title: "Physical therapy",
        durationMinutes: 60,
        toppedUpThrough: null,
      }),
    );
    const conn = await connect(owner, group.id);
    await pull(conn);
    const visits = await getDb()
      .select()
      .from(timelineEntrySchema)
      .where(eq(timelineEntrySchema.seriesId, series.id))
      .orderBy(timelineEntrySchema.occurredAt);
    expect(visits).toHaveLength(3);
    const visit = visits[1]!;
    const start = plusHours(visit.occurredAt, 3);
    google.user.move(
      conn.calendarId,
      googleEventId(`entry:${visit.id}`),
      timed(start),
      timed(plusHours(start, 1)),
    );
    expect(await pull(conn)).toMatchObject({ applied: 1 });
    const row = await entryRow(visit.id);
    expect(row).toMatchObject({ seriesId: series.id, seriesDetached: true });
    expect(ms(row.occurredAt)).toBe(ms(start));
    // The other visits are as they were.
    expect((await entryRow(visits[2]!.id)).seriesDetached).toBe(false);
  });
});

describe("the Google horizon", () => {
  const linkOf = async (conn: GoogleCalendarConnection, googleEventId: string) => {
    const [row] = await getDb()
      .select()
      .from(googleEventLinkSchema)
      .where(
        and(
          eq(googleEventLinkSchema.connectionId, conn.id),
          eq(googleEventLinkSchema.googleEventId, googleEventId),
        ),
      );
    return row;
  };

  it("takes an event made in Google 200 days out, a later move of it, and keeps it at the next push", async () => {
    const { caretaker, group } = await setup();
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    const start = inDays(200, 20);
    const made = google.user.create(conn.calendarId, {
      summary: "Knee surgery consult",
      start: timed(start),
      end: timed(plusHours(start, 1)),
    });
    expect(await pull(conn)).toMatchObject({ applied: 1 });
    const linked = await linkOf(conn, made.id);
    const entryId = linked!.itemUid.replace(/^entry:/, "");
    expect(await entryRow(entryId)).toMatchObject({ kind: "event", title: "Knee surgery consult" });

    const movedTo = inDays(210, 20);
    google.user.move(conn.calendarId, made.id, timed(movedTo), timed(plusHours(movedTo, 1)));
    expect(await pull(conn)).toMatchObject({ applied: 1 });
    expect(ms((await entryRow(entryId)).occurredAt)).toBe(ms(movedTo));

    ok(await calendarSyncService.enqueue(undefined, { connectionId: conn.id }, "daily"));
    ok(await calendarSyncService.runDue({ client: google }));
    await settled();
    expect(google.event(conn.calendarId, made.id)!.status).toBe("confirmed");
    expect(await linkOf(conn, made.id)).toBeDefined();
  });

  it("leaves an instance of a Google repeat 200 days out for later", async () => {
    const { caretaker, group } = await setup();
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    const start = inDays(200, 20);
    const instance = google.user.create(conn.calendarId, {
      summary: "Weekly infusion",
      start: timed(start),
      end: timed(plusHours(start, 1)),
      recurring: true,
    });
    expect(await pull(conn)).toMatchObject({ applied: 0, overwritten: 0, ignored: 1 });
    expect(await linkOf(conn, instance.id)).toBeUndefined();
  });
});

describe("the daily catch-up", () => {
  // Pushes started after a commit use the real clock, so each story starts in
  // the past and its catch-up runs at about the real now.
  const hoursAfter = (at: Date, hours: number) => new Date(at.getTime() + hours * HOUR);
  const makeAt = (conn: GoogleCalendarConnection, summary: string, iso: string, recurring = false) =>
    google.user.create(conn.calendarId, {
      summary,
      start: timed(iso),
      end: timed(plusHours(iso, 1)),
      recurring,
    });
  const linkOf = async (conn: GoogleCalendarConnection, eventId: string) => {
    const [row] = await getDb()
      .select()
      .from(googleEventLinkSchema)
      .where(
        and(
          eq(googleEventLinkSchema.connectionId, conn.id),
          eq(googleEventLinkSchema.googleEventId, eventId),
        ),
      );
    return row;
  };
  const entriesTitled = (groupId: string, title: string) =>
    getDb()
      .select()
      .from(timelineEntrySchema)
      .where(and(eq(timelineEntrySchema.groupId, groupId), eq(timelineEntrySchema.title, title)));
  const dueNow = (conn: GoogleCalendarConnection) =>
    getDb()
      .update(googleCalendarConnectionSchema)
      .set({ lastCatchUpAt: null })
      .where(eq(googleCalendarConnectionSchema.id, conn.id));

  it("takes an event once it comes inside the horizon, once, and lists at most daily", async () => {
    const { caretaker, group } = await setup();
    const conn = await connect(caretaker, group.id);
    const first = new Date(Date.now() - 40 * DAY);
    const made = makeAt(conn, "Far-off scan", new Date(first.getTime() + 400 * DAY).toISOString());

    expect(await pull(conn, first)).toMatchObject({ applied: 0 });
    expect(await linkOf(conn, made.id)).toBeUndefined();
    expect(ms((await connectionRow(conn.id)).lastCatchUpAt)).toBe(first.getTime());

    const later = new Date();
    expect(await pull(conn, later)).toMatchObject({ applied: 1 });
    const linked = await linkOf(conn, made.id);
    expect(linked?.itemUid).toMatch(/^entry:/);
    expect(await entriesTitled(group.id, "Far-off scan")).toHaveLength(1);

    const lists = google.calls.listWindow;
    expect(await pull(conn, hoursAfter(later, 1))).toMatchObject({ applied: 0 });
    expect(google.calls.listWindow).toBe(lists);

    expect(await pull(conn, hoursAfter(later, 25))).toMatchObject({ applied: 0 });
    expect(google.calls.listWindow).toBe(lists + 1);
    expect(await entriesTitled(group.id, "Far-off scan")).toHaveLength(1);
  });

  it("takes a weekly Google repeat only inside 90 days, and one more a week later", async () => {
    const { caretaker, group } = await setup();
    const conn = await connect(caretaker, group.id);
    const first = new Date(Date.now() - 7 * DAY);
    // Weekly from day 5: days 82 and 89 are inside 90, day 96 is inside only after a week.
    const days = Array.from({ length: 14 }, (_, week) => 5 + week * 7);
    for (const day of days)
      makeAt(conn, "Weekly infusion", new Date(first.getTime() + day * DAY).toISOString(), true);

    await pull(conn, first);
    expect(await entriesTitled(group.id, "Weekly infusion")).toHaveLength(days.filter((d) => d < 90).length);
    await pull(conn, new Date());
    expect(await entriesTitled(group.id, "Weekly infusion")).toHaveLength(days.filter((d) => d < 97).length);
  });

  it("leaves a linked event's item and the sync token alone", async () => {
    const { caretaker, group, appointment } = await setup();
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    const start = plusHours(appointment.occurredAt, 2);
    google.user.move(
      conn.calendarId,
      googleEventId(`entry:${appointment.id}`),
      timed(start),
      timed(plusHours(start, 1)),
    );
    // The change list has already passed this move, so only the catch-up could see it.
    const session = ok(
      await google.refresh(openGoogleToken((await connectionRow(conn.id)).refreshTokenSealed!, conn.id)!),
    );
    const current = ok(await session.listChanges(conn.calendarId, null));
    if (current.fullSyncRequired) throw new Error("expected a token");
    await getDb()
      .update(googleCalendarConnectionSchema)
      .set({ syncToken: current.syncToken, lastCatchUpAt: null })
      .where(eq(googleCalendarConnectionSchema.id, conn.id));

    const lists = google.calls.listWindow;
    expect(await pull(conn)).toMatchObject({ applied: 0, overwritten: 0 });
    expect(google.calls.listWindow).toBe(lists + 1);
    expect(ms((await entryRow(appointment.id)).occurredAt)).toBe(ms(appointment.occurredAt));
    expect((await connectionRow(conn.id)).syncToken).toBe(current.syncToken);
  });

  it("overwrites a viewer's unlinked event, as a pull does", async () => {
    const { viewer, group } = await setup();
    const conn = await connect(viewer, group.id);
    const first = new Date(Date.now() - 40 * DAY);
    const made = makeAt(conn, "Viewer's far event", new Date(first.getTime() + 400 * DAY).toISOString());
    expect(await pull(conn, first)).toMatchObject({ overwritten: 0 });

    expect(await pull(conn, new Date())).toMatchObject({ applied: 0, overwritten: 1 });
    expect(google.event(conn.calendarId, made.id)!.status).toBe("cancelled");
    expect(await entriesTitled(group.id, "Viewer's far event")).toHaveLength(0);
  });

  it("keeps the pull's changes and token when the window list fails, and runs again next pull", async () => {
    const { caretaker, group, appointment } = await setup();
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    await dueNow(conn);
    const start = plusHours(appointment.occurredAt, 1);
    google.user.move(
      conn.calendarId,
      googleEventId(`entry:${appointment.id}`),
      timed(start),
      timed(plusHours(start, 1)),
    );
    const before = (await connectionRow(conn.id)).syncToken;
    google.failCalls(true, "listWindow");
    expect(await pull(conn)).toMatchObject({ status: "pulled", applied: 1 });
    google.failCalls(false, "listWindow");

    const after = await connectionRow(conn.id);
    expect(ms((await entryRow(appointment.id)).occurredAt)).toBe(ms(start));
    expect(after.syncToken).not.toBe(before);
    expect(after.lastCatchUpAt).toBeNull();

    const lists = google.calls.listWindow;
    await pull(conn);
    expect(google.calls.listWindow).toBe(lists + 1);
    expect((await connectionRow(conn.id)).lastCatchUpAt).not.toBeNull();
  });
});

describe("what the member can't do", () => {
  it("puts a viewer's move back on the next push, and removes their new event", async () => {
    const { viewer, group, appointment } = await setup();
    const conn = await connect(viewer, group.id);
    await pull(conn);
    const uid = `entry:${appointment.id}`;
    google.user.move(
      conn.calendarId,
      googleEventId(uid),
      timed(plusHours(appointment.occurredAt, 2)),
      timed(plusHours(appointment.occurredAt, 3)),
    );
    const made = google.user.create(conn.calendarId, {
      summary: "Dentist",
      start: timed(inDays(4)),
      end: timed(inDays(4, 18)),
    });
    expect(await pull(conn)).toMatchObject({ applied: 0, overwritten: 2 });

    // Caretook is unchanged, and Google has our version back.
    const row = await entryRow(appointment.id);
    expect(ms(row.occurredAt)).toBe(ms(appointment.occurredAt));
    expect(row.updatedBy).not.toBe(viewer.user.id);
    expect(ms((eventOf(conn, uid).start as { dateTime: string }).dateTime)).toBe(ms(appointment.occurredAt));
    expect(google.event(conn.calendarId, made.id)!.status).toBe("cancelled");
    expect(google.events(conn.calendarId)).toHaveLength(2);
    // The put-back events come back as echoes.
    expect(await pull(conn)).toMatchObject({ applied: 0, overwritten: 0 });
  });

  it("puts back a viewer's deleted todos, even one assigned to them, and completes neither", async () => {
    const { owner, viewer, group, todo } = await setup();
    const theirs = ok(
      await todoService.create(owner.ctx, {
        groupId: group.id,
        title: "Pick up groceries",
        dueOn: inDays(3).slice(0, 10),
        assigneeId: viewer.user.id,
      }),
    )!;
    const conn = await connect(viewer, group.id);
    await pull(conn);
    google.user.delete(conn.calendarId, googleEventId(`todo:${todo.id}`));
    google.user.delete(conn.calendarId, googleEventId(`todo:${theirs.id}`));
    expect(await pull(conn)).toMatchObject({ applied: 0, overwritten: 2 });

    const done = async (id: string) =>
      (await getDb().select().from(todoSchema).where(eq(todoSchema.id, id)))[0]!.doneBy;
    expect(await done(todo.id)).toBeNull();
    expect(await done(theirs.id)).toBeNull();
    expect(eventOf(conn, `todo:${todo.id}`).status).toBe("confirmed");
    expect(eventOf(conn, `todo:${theirs.id}`).status).toBe("confirmed");
  });
});

describe("the sync token and the schedule", () => {
  it("recovers when Google asks for a full sync", async () => {
    const { caretaker, group, appointment } = await setup();
    const conn = await connect(caretaker, group.id);
    expect(await pull(conn)).toMatchObject({ fullSync: true });
    expect(await pull(conn)).toMatchObject({ fullSync: false, changes: 0 });

    google.expireSyncTokens();
    const start = plusHours(appointment.occurredAt, 1);
    google.user.move(
      conn.calendarId,
      googleEventId(`entry:${appointment.id}`),
      timed(start),
      timed(plusHours(start, 1)),
    );
    expect(await pull(conn)).toMatchObject({ fullSync: true, applied: 1 });
    expect(ms((await entryRow(appointment.id)).occurredAt)).toBe(ms(start));
    expect(await pull(conn)).toMatchObject({ fullSync: false, applied: 0 });
  });

  it("pulls each connection at most every 5 minutes", async () => {
    const { caretaker, owner, group } = await setup();
    const mine = await connect(caretaker, group.id);
    const theirs = await connect(owner, group.id);
    const now = new Date(Date.now() + 60 * DAY);
    // Other tests' connections share the database: keep them out of this sweep.
    await getDb()
      .update(googleCalendarConnectionSchema)
      .set({ lastPulledAt: new Date(now.getTime() + 365 * DAY).toISOString() })
      .where(notInArray(googleCalendarConnectionSchema.id, [mine.id, theirs.id]));
    const pulledAt = async (at: Date) => {
      const summary = ok(await calendarPullService.pullDue({ client: google, now: at }));
      await settled();
      const rows = await Promise.all([connectionRow(mine.id), connectionRow(theirs.id)]);
      return { pulled: summary.pulled, at: rows.map((c) => ms(c.lastPulledAt)) };
    };

    expect(await pulledAt(now)).toEqual({ pulled: 2, at: [now.getTime(), now.getTime()] });
    expect(await pulledAt(new Date(now.getTime() + 4 * 60_000))).toEqual({
      pulled: 0,
      at: [now.getTime(), now.getTime()],
    });
    const later = new Date(now.getTime() + 5 * 60_000);
    expect(await pulledAt(later)).toEqual({ pulled: 2, at: [later.getTime(), later.getTime()] });
  });

  it("stops a connection whose token Google refuses, and skips it after", async () => {
    const { caretaker, group } = await setup();
    const conn = await connect(caretaker, group.id);
    const [sealedRow] = await getDb()
      .select()
      .from(googleCalendarConnectionSchema)
      .where(eq(googleCalendarConnectionSchema.id, conn.id));
    google.revokeAccess(openGoogleToken(sealedRow!.refreshTokenSealed!, conn.id)!);
    expect(await pull(conn)).toEqual({ status: "stopped", error: "revoked" });
    expect((await connectionRow(conn.id)).lastError).toBe("revoked");
  });

  it("keeps the sync token through a passing failure, and takes the change on the next pull", async () => {
    const { caretaker, group, appointment } = await setup();
    const conn = await connect(caretaker, group.id);
    await pull(conn);
    const token = (await connectionRow(conn.id)).syncToken;
    const start = plusHours(appointment.occurredAt, 1);
    google.user.move(
      conn.calendarId,
      googleEventId(`entry:${appointment.id}`),
      timed(start),
      timed(plusHours(start, 1)),
    );
    google.failCalls(true);
    const failed = await calendarPullService.pullConnection(await connectionRow(conn.id), { client: google });
    expect(isError(failed) && failed.code).toBe("googleCalendar:failed");
    google.failCalls(false);
    const after = await connectionRow(conn.id);
    expect(after).toMatchObject({ syncToken: token, lastError: null });
    expect(await pull(conn)).toMatchObject({ applied: 1 });
  });

  it("does nothing without Google set up", async () => {
    expect(await calendarPullService.pullDue({ client: null })).toMatchObject({
      configured: false,
      pulled: 0,
    });
  });
});
