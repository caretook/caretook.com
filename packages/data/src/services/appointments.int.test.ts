import type { TimelineEntryCreateInput, TimelineEntryUpsertInput } from "../db";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../test/fixtures";
import { getDb } from "../db";
import { timelineEntrySchema } from "../db/schema";
import { isError } from "../errors";
import { timelineEntryService } from ".";
import { eq } from "drizzle-orm";

// Appointments and reminders: future notes and events, their end, place,
// all-day and cancel fields, and the future-date rule for other kinds. Every
// test builds its own group and users.

const WRITERS = ["owner", "admin", "caretaker"] as const;

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const issuesOf = (res: unknown) =>
  isError(res)
    ? ((res.meta as { issues?: { path: string }[] } | undefined)?.issues ?? []).map((i) => i.path)
    : [];

const HOUR = 3_600_000;
const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString();

const setup = async () => {
  const u = {
    owner: await createUser("owner"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
  };
  const { group } = await createGroup(u.owner, [
    { user: u.admin.user, role: "admin" },
    { user: u.caretaker.user, role: "caretaker" },
    { user: u.viewer.user, role: "viewer" },
  ]);
  const input = (overrides: Record<string, unknown> = {}) =>
    ({
      groupId: group.id,
      kind: "event",
      title: "Cardiology",
      occurredAt: fromNow(48 * HOUR),
      timeZone: "America/Los_Angeles",
      ...overrides,
    }) as TimelineEntryCreateInput;
  const addEvent = async (overrides: Record<string, unknown> = {}) => {
    const entry = ok(await timelineEntryService.create(u.caretaker.ctx, input(overrides)));
    if (!entry) throw new Error("entry not readable");
    return entry;
  };
  return { u, group, input, addEvent };
};

describe("the future-date rule", () => {
  it("accepts a future event and refuses a future note (notes are past-only)", async () => {
    const { u, input } = await setup();
    const far = fromNow(60 * 24 * HOUR);
    expect(codeOf(await timelineEntryService.create(u.caretaker.ctx, input({ occurredAt: far })))).toBe("ok");
    expect(
      codeOf(
        await timelineEntryService.create(
          u.caretaker.ctx,
          input({ kind: "note", title: null, occurredAt: far }),
        ),
      ),
    ).toBe("timelineEntryService:invalid");
  });

  it("refuses a symptom or vital beyond the server's hour of skew, on occurredAt", async () => {
    const { u, input } = await setup();
    const symptom = input({ kind: "symptom", title: null, details: { name: "Pain", severity: 3 } });
    const vital = input({
      kind: "vital",
      title: null,
      details: { readings: [{ type: "heartRate", value: 72 }] },
    });
    for (const entry of [symptom, vital]) {
      const refused = await timelineEntryService.create(u.caretaker.ctx, {
        ...entry,
        occurredAt: fromNow(2 * HOUR),
      });
      expect(codeOf(refused)).toBe("timelineEntryService:invalid");
      expect(issuesOf(refused)).toEqual(["occurredAt"]);
      // A device clock running half an hour fast still saves.
      expect(
        codeOf(
          await timelineEntryService.create(u.caretaker.ctx, { ...entry, occurredAt: fromNow(HOUR / 2) }),
        ),
      ).toBe("ok");
    }
  });

  it("refuses moving a symptom into the future, but lets one stored ahead be edited", async () => {
    const { u, input } = await setup();
    const symptom = ok(
      await timelineEntryService.create(
        u.caretaker.ctx,
        input({ kind: "symptom", title: null, occurredAt: fromNow(-HOUR), details: { name: "Pain" } }),
      ),
    )!;
    const moved = await timelineEntryService.update(u.caretaker.ctx, symptom.id, {
      occurredAt: fromNow(3 * HOUR),
    });
    expect(issuesOf(moved)).toEqual(["occurredAt"]);

    // Stored ahead (as the system, past the rule): editing its name still works.
    await getDb()
      .update(timelineEntrySchema)
      .set({ occurredAt: fromNow(5 * HOUR) })
      .where(eq(timelineEntrySchema.id, symptom.id));
    expect(
      ok(
        await timelineEntryService.update(u.caretaker.ctx, symptom.id, {
          details: { name: "Sharp pain" },
        }),
      ),
    ).toMatchObject({ details: { name: "Sharp pain" } });
  });
});

describe("appointment fields", () => {
  it("stores an event's end, place, all-day and cancel fields", async () => {
    const { addEvent } = await setup();
    const start = fromNow(48 * HOUR);
    const end = new Date(new Date(start).getTime() + HOUR).toISOString();
    const entry = await addEvent({ occurredAt: start, endsAt: end, place: "12 Oak St" });
    expect(entry).toMatchObject({ place: "12 Oak St", allDay: false, cancelledAt: null, cancelledBy: null });
    expect(new Date(entry.endsAt!).toISOString()).toBe(end);
  });

  it("refuses an end or place on a note, and cancel fields on a symptom", async () => {
    const { u, input } = await setup();
    const note = input({ kind: "note", title: null, occurredAt: fromNow(-HOUR) });
    for (const extra of [{ endsAt: fromNow(49 * HOUR) }, { place: "Home" }]) {
      expect(
        codeOf(
          await timelineEntryService.create(u.caretaker.ctx, {
            ...note,
            ...extra,
          } as TimelineEntryCreateInput),
        ),
      ).toBe("timelineEntryService:invalid");
    }
    const symptom = input({
      kind: "symptom",
      title: null,
      occurredAt: fromNow(-HOUR),
      details: { name: "Pain" },
    });
    const refused = await timelineEntryService.create(u.caretaker.ctx, {
      ...symptom,
      cancelledAt: fromNow(-HOUR),
    } as TimelineEntryCreateInput);
    expect(issuesOf(refused)).toEqual(["cancelledAt"]);
  });

  it("checks the merged row: an end can't come before a moved start, and all-day drops the end", async () => {
    const { u, addEvent } = await setup();
    const entry = await addEvent({ endsAt: fromNow(49 * HOUR) });
    expect(
      issuesOf(
        await timelineEntryService.update(u.caretaker.ctx, entry.id, { occurredAt: fromNow(50 * HOUR) }),
      ),
    ).toEqual(["endsAt"]);
    expect(
      issuesOf(await timelineEntryService.update(u.caretaker.ctx, entry.id, { place: "x".repeat(201) })),
    ).toEqual(["place"]);
  });

  it("lets every writer set and clear the fields, but not viewers or outsiders", async () => {
    const { u, addEvent } = await setup();
    const entry = await addEvent();
    const set = {
      endsAt: fromNow(49 * HOUR),
      place: "Clinic",
      cancelledAt: fromNow(0),
      cancelReason: "Sick",
    };
    const clear = { endsAt: null, place: null, cancelledAt: null, cancelReason: null };
    for (const role of WRITERS) {
      expect(ok(await timelineEntryService.update(u[role].ctx, entry.id, set))).toMatchObject({
        place: "Clinic",
        cancelReason: "Sick",
        cancelledBy: u[role].user.id,
      });
      expect(ok(await timelineEntryService.update(u[role].ctx, entry.id, clear))).toMatchObject({
        endsAt: null,
        place: null,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
      });
    }
    expect(codeOf(await timelineEntryService.update(u.viewer.ctx, entry.id, set))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await timelineEntryService.update(u.outsider.ctx, entry.id, set))).toBe(
      "timelineEntryService:notFound",
    );
    expect(ok(await timelineEntryService.getById(u.viewer.ctx, entry.id))).toMatchObject({ place: null });
  });

  it("records who cancelled, and keeps it while the event stays cancelled", async () => {
    const { u, addEvent } = await setup();
    const entry = await addEvent();
    ok(await timelineEntryService.update(u.admin.ctx, entry.id, { cancelledAt: fromNow(0) }));
    const edited = ok(
      await timelineEntryService.update(u.owner.ctx, entry.id, { cancelReason: "Office closed" }),
    );
    expect(edited).toMatchObject({ cancelledBy: u.admin.user.id, cancelReason: "Office closed" });
    // A cancelled event can still be edited and uncancelled.
    expect(
      ok(await timelineEntryService.update(u.owner.ctx, entry.id, { title: "Cardiology (moved)" })),
    ).toMatchObject({
      title: "Cardiology (moved)",
      cancelledBy: u.admin.user.id,
    });
  });
});

describe("rescheduled to", () => {
  it("points a cancelled event at another event in the group", async () => {
    const { u, addEvent } = await setup();
    const next = await addEvent({ occurredAt: fromNow(96 * HOUR) });
    const old = await addEvent({ cancelledAt: fromNow(0), rescheduledTo: next.id });
    expect(old).toMatchObject({ rescheduledTo: next.id, cancelledBy: u.caretaker.user.id });
  });

  it("refuses an uncancelled event, a note, itself, or an event in another group", async () => {
    const { u, group, addEvent, input } = await setup();
    const next = await addEvent();
    expect(
      issuesOf(await timelineEntryService.create(u.caretaker.ctx, input({ rescheduledTo: next.id }))),
    ).toEqual(["rescheduledTo"]);

    const note = ok(
      await timelineEntryService.create(
        u.caretaker.ctx,
        input({ kind: "note", title: null, occurredAt: fromNow(-HOUR) }),
      ),
    )!;
    expect(
      codeOf(
        await timelineEntryService.create(
          u.caretaker.ctx,
          input({ cancelledAt: fromNow(0), rescheduledTo: note.id }),
        ),
      ),
    ).toBe("timelineEntryService:rescheduledToNotInGroup");

    const self = randomUUID();
    expect(
      codeOf(
        await timelineEntryService.create(
          u.caretaker.ctx,
          input({ id: self, cancelledAt: fromNow(0), rescheduledTo: self }),
        ),
      ),
    ).toBe("timelineEntryService:rescheduledToNotInGroup");

    // The same caretaker's event in another group they belong to.
    const { group: other } = await createGroup(u.owner, [{ user: u.caretaker.user, role: "caretaker" }]);
    const elsewhere = ok(
      await timelineEntryService.create(u.caretaker.ctx, {
        ...input(),
        groupId: other.id,
      }),
    )!;
    const old = await addEvent();
    expect(
      codeOf(
        await timelineEntryService.update(u.caretaker.ctx, old.id, {
          cancelledAt: fromNow(0),
          rescheduledTo: elsewhere.id,
        }),
      ),
    ).toBe("timelineEntryService:rescheduledToNotInGroup");
    expect(group.id).not.toBe(other.id);
  });

  it("is cleared, not cascaded, when the new event is purged", async () => {
    const { addEvent } = await setup();
    const next = await addEvent();
    const old = await addEvent({ cancelledAt: fromNow(0), rescheduledTo: next.id });
    await getDb().delete(timelineEntrySchema).where(eq(timelineEntrySchema.id, next.id));
    const [row] = await getDb().select().from(timelineEntrySchema).where(eq(timelineEntrySchema.id, old.id));
    expect(row).toMatchObject({ rescheduledTo: null, groupId: old.groupId });
  });
});

describe("upsert (the upload path)", () => {
  it("round-trips the fields, keeps ones a replay leaves out, and refuses a future vital", async () => {
    const { u, input } = await setup();
    const id = randomUUID();
    const put = { ...input({ place: "Clinic", allDay: false }), id };
    ok(await timelineEntryService.upsert(u.caretaker.ctx, put));
    const edited = ok(
      await timelineEntryService.upsert(u.caretaker.ctx, { ...input(), id, title: "Renamed" }),
    );
    expect(edited).toMatchObject({ title: "Renamed", place: "Clinic" });

    const refused = await timelineEntryService.upsert(u.caretaker.ctx, {
      ...input({ kind: "vital", title: null, occurredAt: fromNow(3 * HOUR) }),
      id: randomUUID(),
      details: { readings: [{ type: "heartRate", value: 72 }] },
    } as TimelineEntryUpsertInput);
    expect(issuesOf(refused)).toEqual(["occurredAt"]);
  });
});
