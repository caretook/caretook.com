import type { AppointmentSeriesCreateInput } from "../db";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok, system } from "../../test/fixtures";
import { entryProviderId, seriesVisitId } from "../db/schema";
import { isError } from "../errors";
import { timelineEntryModel } from "../models";
import {
  appointmentSeriesService,
  entryProviderService,
  noteDocumentService,
  providerService,
  timelineEntryService,
} from ".";

// Every test builds its own group and users. The clock is the appointments
// area's: Wed 2026-11-18 10:00 in Los Angeles.

const NOW = new Date("2026-11-18T18:00:00.000Z");
const WRITERS = ["owner", "admin", "caretaker"] as const;

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const u = {
    owner: await createUser("owner"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
    staff: await createUser("staff", "admin"),
  };
  const { group, recipient } = await createGroup(u.owner, [
    { user: u.admin.user, role: "admin" },
    { user: u.caretaker.user, role: "caretaker" },
    { user: u.viewer.user, role: "viewer" },
  ]);
  const input = (overrides: Partial<AppointmentSeriesCreateInput> = {}): AppointmentSeriesCreateInput => ({
    groupId: group.id,
    kind: "event",
    rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
    startsOn: "2026-11-18",
    startTime: "06:00",
    timeZone: "America/Los_Angeles",
    title: "Dialysis",
    durationMinutes: 240,
    // The device holds the visits: none are written here unless a test asks.
    toppedUpThrough: "2027-02-16",
    ...overrides,
  });
  return { u, group, recipient, input };
};

const visitsOf = async (seriesId: string) => {
  const page = ok(
    await timelineEntryModel.listPage({
      ...system,
      includeDeleted: true,
      filter: { seriesId: { type: "eq", value: seriesId } },
      limit: 500,
    }),
  );
  return [...page.data].sort((a, b) => (a.seriesDay ?? "").localeCompare(b.seriesDay ?? ""));
};

describe("appointmentSeriesService: roles", () => {
  it("lets writers create, edit and soft-delete; viewers read only; outsiders and staff see nothing", async () => {
    const { u, group, recipient, input } = await setup();

    for (const role of WRITERS) {
      const created = ok(await appointmentSeriesService.create(u[role].ctx, input({ title: `By ${role}` })));
      expect(created).toMatchObject({
        groupId: group.id,
        recipientId: recipient.id,
        kind: "event",
        startsOn: "2026-11-18",
        providerIds: [],
        createdBy: u[role].user.id,
      });
      const updated = ok(
        await appointmentSeriesService.update(u[role].ctx, created.id, { title: "Dialysis" }),
      );
      expect(updated).toMatchObject({ title: "Dialysis", updatedBy: u[role].user.id });
      expect(ok(await appointmentSeriesService.getById(u.viewer.ctx, created.id))).toMatchObject({
        title: "Dialysis",
      });
      ok(await appointmentSeriesService.remove(u[role].ctx, created.id));
      expect(await appointmentSeriesService.getById(u.owner.ctx, created.id)).toBeNull();
      expect(
        ok(await appointmentSeriesService.getById(u.owner.ctx, created.id, { includeDeleted: true }))!
          .deletedAt,
      ).not.toBeNull();
    }

    const series = ok(await appointmentSeriesService.create(u.owner.ctx, input()));
    expect(codeOf(await appointmentSeriesService.create(u.viewer.ctx, input()))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await appointmentSeriesService.update(u.viewer.ctx, series.id, { title: "x" }))).toBe(
      "permissions:unauthorized",
    );
    expect(codeOf(await appointmentSeriesService.remove(u.viewer.ctx, series.id))).toBe(
      "appointmentSeriesService:notFound",
    );
    for (const who of ["outsider", "staff"] as const) {
      expect(await appointmentSeriesService.getById(u[who].ctx, series.id)).toBeNull();
      expect(ok(await appointmentSeriesService.list(u[who].ctx, { groupId: group.id })).data).toEqual([]);
      expect(codeOf(await appointmentSeriesService.create(u[who].ctx, input()))).toBe(
        "permissions:unauthorized",
      );
      expect(codeOf(await appointmentSeriesService.update(u[who].ctx, series.id, { title: "x" }))).toBe(
        "appointmentSeriesService:notFound",
      );
    }
    expect(
      ok(await appointmentSeriesService.list(u.viewer.ctx, { groupId: group.id })).data.map((s) => s.id),
    ).toEqual([series.id]);
  });

  it("validates the merged series on update", async () => {
    const { u, input } = await setup();
    const series = ok(await appointmentSeriesService.create(u.owner.ctx, input()));
    const res = await appointmentSeriesService.update(u.owner.ctx, series.id, {
      rule: "FREQ=WEEKLY;INTERVAL=1",
    });
    expect(codeOf(res)).toBe("appointmentSeriesService:invalid");
    expect(codeOf(await appointmentSeriesService.update(u.owner.ctx, series.id, { allDay: true }))).toBe(
      "appointmentSeriesService:invalid",
    );
    expect(
      ok(
        await appointmentSeriesService.update(u.owner.ctx, series.id, {
          rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=3",
        }),
      ),
    ).toMatchObject({ rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=3" });
  });
});

describe("appointmentSeriesService: visits", () => {
  it("writes visits through today + 90 for a series without them: links, documents, ids", async () => {
    const { u, group, input } = await setup();
    const clinic = ok(
      await providerService.create(u.caretaker.ctx, {
        groupId: group.id,
        type: "practice",
        name: "Mercy dialysis",
      }),
    )!;
    const series = ok(
      await appointmentSeriesService.create(
        u.caretaker.ctx,
        input({ toppedUpThrough: null, providerIds: [clinic.id], place: "2nd floor" }),
        { now: NOW },
      ),
    );
    expect(series.toppedUpThrough).toBe("2027-02-16");

    const visits = await visitsOf(series.id);
    expect(visits[0]).toMatchObject({
      id: seriesVisitId(series.id, "2026-11-18"),
      kind: "event",
      title: "Dialysis",
      place: "2nd floor",
      seriesDay: "2026-11-18",
      seriesDetached: false,
      createdBy: u.caretaker.user.id,
    });
    expect(new Date(visits[0]!.occurredAt).toISOString()).toBe("2026-11-18T14:00:00.000Z");
    expect(new Date(visits[0]!.endsAt!).toISOString()).toBe("2026-11-18T18:00:00.000Z");
    expect(visits.map((v) => v.seriesDay).slice(0, 4)).toEqual([
      "2026-11-18",
      "2026-11-20",
      "2026-11-23",
      "2026-11-25",
    ]);
    expect(visits.at(-1)!.seriesDay).toBe("2027-02-15");
    expect(visits).toHaveLength(39);

    const links = ok(await entryProviderService.listForEntry(u.viewer.ctx, visits[0]!.id));
    expect(links.data.map((l) => l.id)).toEqual([entryProviderId(visits[0]!.id, clinic.id)]);
    expect(ok(await noteDocumentService.getById(u.viewer.ctx, visits[5]!.id))).toMatchObject({
      subject: "entry",
    });

    // A replay of the same series adds nothing.
    ok(
      await appointmentSeriesService.upsert(
        u.caretaker.ctx,
        { ...input({ toppedUpThrough: null, providerIds: [clinic.id], place: "2nd floor" }), id: series.id },
        { now: NOW },
      ),
    );
    expect(await visitsOf(series.id)).toHaveLength(39);
  });

  it("writes no visits for a device's series, and accepts the device's own visits, replayed without duplicates", async () => {
    const { u, group, recipient, input } = await setup();
    const id = randomUUID();
    ok(await appointmentSeriesService.upsert(u.caretaker.ctx, { ...input(), id }, { now: NOW }));
    ok(await appointmentSeriesService.upsert(u.caretaker.ctx, { ...input(), id }, { now: NOW }));
    expect(ok(await appointmentSeriesService.list(u.owner.ctx, { groupId: group.id })).data).toHaveLength(1);
    expect(await visitsOf(id)).toEqual([]);

    const visit = (day: string, at: string, visitId = seriesVisitId(id, day)) => ({
      id: visitId,
      groupId: group.id,
      recipientId: recipient.id,
      kind: "event" as const,
      title: "Dialysis",
      occurredAt: at,
      timeZone: "America/Los_Angeles",
      details: null,
      seriesId: id,
      seriesDay: day,
    });
    // The first visit keeps the draft's own id: any id is accepted.
    const draftId = randomUUID();
    for (let round = 0; round < 2; round++) {
      ok(
        await timelineEntryService.upsert(
          u.caretaker.ctx,
          visit("2026-11-18", "2026-11-18T14:00:00.000Z", draftId),
        ),
      );
      ok(await timelineEntryService.upsert(u.caretaker.ctx, visit("2026-11-20", "2026-11-20T14:00:00.000Z")));
    }
    expect((await visitsOf(id)).map((v) => [v.id, v.seriesDay])).toEqual([
      [draftId, "2026-11-18"],
      [seriesVisitId(id, "2026-11-20"), "2026-11-20"],
    ]);

    // Another row on a day the series has already: refused, not a duplicate.
    const twin = await timelineEntryService.upsert(
      u.caretaker.ctx,
      visit("2026-11-20", "2026-11-20T15:00:00.000Z", randomUUID()),
    );
    expect(codeOf(twin)).toBe("timelineEntryService:seriesDayTaken");
  });

  it("refuses a provider or recipient from another group, and a visit of another group's series", async () => {
    const { u, group, input } = await setup();
    const other = await createGroup(u.owner);
    const elsewhere = ok(
      await providerService.create(u.owner.ctx, {
        groupId: other.group.id,
        type: "practice",
        name: "Elsewhere",
      }),
    )!;
    expect(
      codeOf(await appointmentSeriesService.create(u.owner.ctx, input({ providerIds: [elsewhere.id] }))),
    ).toBe("appointmentSeriesService:providerNotInGroup");
    expect(
      codeOf(await appointmentSeriesService.create(u.owner.ctx, input({ recipientId: other.recipient.id }))),
    ).toBe("appointmentSeriesService:recipientNotInGroup");

    const theirs = ok(await appointmentSeriesService.create(u.owner.ctx, input({ groupId: other.group.id })));
    const res = await timelineEntryService.create(u.owner.ctx, {
      groupId: group.id,
      kind: "event",
      title: "Dialysis",
      occurredAt: "2026-11-18T14:00:00.000Z",
      timeZone: "America/Los_Angeles",
      seriesId: theirs.id,
      seriesDay: "2026-11-18",
    });
    expect(codeOf(res)).toBe("timelineEntryService:seriesNotInGroup");

    // A note can't be a visit of an appointment series.
    const mine = ok(await appointmentSeriesService.create(u.owner.ctx, input()));
    const note = await timelineEntryService.create(u.owner.ctx, {
      groupId: group.id,
      kind: "note",
      occurredAt: "2026-11-18T14:00:00.000Z",
      timeZone: "America/Los_Angeles",
      seriesId: mine.id,
      seriesDay: "2026-11-18",
    });
    expect(codeOf(note)).toBe("timelineEntryService:seriesNotInGroup");
  });

  it("keeps a series' group, recipient and kind, and a deleted series deleted", async () => {
    const { u, input } = await setup();
    const other = await createGroup(u.owner);
    const id = randomUUID();
    ok(await appointmentSeriesService.upsert(u.owner.ctx, { ...input(), id }));
    expect(
      codeOf(
        await appointmentSeriesService.upsert(u.owner.ctx, {
          ...input({ kind: "note", title: null, durationMinutes: null }),
          id,
        }),
      ),
    ).toBe("appointmentSeriesService:immutable");
    expect(
      codeOf(
        await appointmentSeriesService.upsert(u.owner.ctx, { ...input({ groupId: other.group.id }), id }),
      ),
    ).toBe("appointmentSeriesService:immutable");
    ok(await appointmentSeriesService.remove(u.owner.ctx, id));
    const replay = ok(
      await appointmentSeriesService.upsert(u.owner.ctx, { ...input({ title: "Late edit" }), id }),
    )!;
    expect(replay).toMatchObject({ title: "Dialysis" });
    expect(replay.deletedAt).not.toBeNull();
  });
});

describe("appointmentSeriesService.topUp", () => {
  // The series' own zone (Los Angeles) is at 2026-11-18 on NOW, so the
  // target is 2027-02-16. The test database is shared with other tests'
  // series, so each run loops until nothing is left to do.
  const TARGET = "2027-02-16";
  const topUpAll = async (now = NOW) => {
    const total = { checked: 0, toppedUp: 0, visits: 0, failed: 0 };
    for (let i = 0; i < 20; i++) {
      const res = ok(await appointmentSeriesService.topUp(now, { limit: 100 }));
      total.checked += res.checked;
      total.toppedUp += res.toppedUp;
      total.visits += res.visits;
      total.failed += res.failed;
      if (!res.checked) break;
    }
    return total;
  };

  const days = async (seriesId: string) =>
    (await visitsOf(seriesId)).filter((v) => !v.deletedAt).map((v) => v.seriesDay);

  /** A visit as a device (or an earlier run) made it. */
  const visit = (
    s: { id: string; groupId: string; recipientId: string },
    day: string,
    visitId = seriesVisitId(s.id, day),
  ) => ({
    id: visitId,
    groupId: s.groupId,
    recipientId: s.recipientId,
    kind: "event" as const,
    title: "Dialysis",
    occurredAt: `${day}T14:00:00.000Z`,
    timeZone: "America/Los_Angeles",
    details: null,
    seriesId: s.id,
    seriesDay: day,
  });

  it("adds the missing days after topped_up_through, with documents and provider links, and a second run writes nothing", async () => {
    const { u, group, input } = await setup();
    const provider = ok(
      await providerService.create(u.owner.ctx, { groupId: group.id, type: "practice", name: "Clinic" }),
    )!;
    const series = ok(
      await appointmentSeriesService.create(
        u.owner.ctx,
        input({ startsOn: "2026-11-16", toppedUpThrough: "2026-11-20", providerIds: [provider.id] }),
      ),
    );

    const first = await topUpAll();
    expect(first).toMatchObject({ toppedUp: 1, failed: 0 });
    const got = await days(series.id);
    // Mon, Wed, Fri from 2026-11-23 through 2027-02-15; nothing at or before the old edge.
    expect(got[0]).toBe("2026-11-23");
    expect(got.at(-1)).toBe("2027-02-15");
    expect(got).toHaveLength(37);
    expect(got.every((d) => d! > "2026-11-20" && d! <= TARGET)).toBe(true);

    const rows = await visitsOf(series.id);
    expect(rows[0]).toMatchObject({
      id: seriesVisitId(series.id, "2026-11-23"),
      kind: "event",
      title: "Dialysis",
    });
    expect(new Date(rows[0]!.occurredAt).toISOString()).toBe("2026-11-23T14:00:00.000Z");
    expect(new Date(rows[0]!.endsAt!).toISOString()).toBe("2026-11-23T18:00:00.000Z");
    expect(
      ok(await entryProviderService.listForEntry(u.owner.ctx, rows[0]!.id)).data.map((l) => l.providerId),
    ).toEqual([provider.id]);
    expect(ok(await appointmentSeriesService.getById(u.owner.ctx, series.id))).toMatchObject({
      toppedUpThrough: TARGET,
    });
    expect(ok(await noteDocumentService.getById(u.owner.ctx, rows[0]!.id))).toBeTruthy();

    const second = await topUpAll();
    expect(second).toMatchObject({ toppedUp: 0, visits: 0, failed: 0 });
    expect(await days(series.id)).toEqual(got);
  });

  it("skips days that already have a live or deleted visit, and converges with a device's ids", async () => {
    const { u, group, recipient, input } = await setup();
    const series = ok(
      await appointmentSeriesService.create(
        u.owner.ctx,
        input({ startsOn: "2026-11-16", toppedUpThrough: "2026-11-20" }),
      ),
    );
    const s = { id: series.id, groupId: group.id, recipientId: recipient.id };
    // A draft-id visit (the first visit's pattern), a device-made v5 visit, and a deleted one.
    const draftId = randomUUID();
    ok(await timelineEntryService.create(u.owner.ctx, visit(s, "2026-11-23", draftId)));
    ok(await timelineEntryService.create(u.owner.ctx, visit(s, "2026-11-25")));
    ok(await timelineEntryService.create(u.owner.ctx, visit(s, "2026-11-27")));
    ok(await timelineEntryService.remove(u.owner.ctx, seriesVisitId(series.id, "2026-11-27")));

    await topUpAll();
    const rows = await visitsOf(series.id);
    const on = (day: string) => rows.filter((r) => r.seriesDay === day);
    expect(on("2026-11-23").map((r) => r.id)).toEqual([draftId]);
    expect(on("2026-11-25").map((r) => r.id)).toEqual([seriesVisitId(series.id, "2026-11-25")]);
    expect(on("2026-11-27")).toHaveLength(1);
    expect(on("2026-11-27")[0]!.deletedAt).not.toBeNull();
    // Every other day has exactly one live visit.
    expect(new Set(rows.map((r) => r.seriesDay)).size).toBe(rows.length);
    expect(rows).toHaveLength(37);
  });

  it("stops at COUNT and UNTIL, and ignores deleted series", async () => {
    const { u, input } = await setup();
    const counted = ok(
      await appointmentSeriesService.create(
        u.owner.ctx,
        input({
          rule: "FREQ=DAILY;INTERVAL=1;COUNT=3",
          startsOn: "2026-11-18",
          toppedUpThrough: "2026-11-17",
        }),
      ),
    );
    const until = ok(
      await appointmentSeriesService.create(
        u.owner.ctx,
        input({
          rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20261207",
          startsOn: "2026-11-16",
          toppedUpThrough: "2026-11-17",
        }),
      ),
    );
    const gone = ok(
      await appointmentSeriesService.create(u.owner.ctx, input({ toppedUpThrough: "2026-11-17" })),
    );
    ok(await appointmentSeriesService.remove(u.owner.ctx, gone.id));

    await topUpAll();
    expect(await days(counted.id)).toEqual(["2026-11-18", "2026-11-19", "2026-11-20"]);
    expect(await days(until.id)).toEqual(["2026-11-23", "2026-11-30", "2026-12-07"]);
    expect(await visitsOf(gone.id)).toEqual([]);
    expect(ok(await appointmentSeriesService.getById(u.owner.ctx, until.id))).toMatchObject({
      toppedUpThrough: TARGET,
    });
    expect(
      ok(await appointmentSeriesService.getById(u.owner.ctx, gone.id, { includeDeleted: true })),
    ).toMatchObject({ toppedUpThrough: "2026-11-17" });
  });

  it("leaves a series that is already 90 days ahead alone, and follows the clock", async () => {
    const { u, input } = await setup();
    const series = ok(await appointmentSeriesService.create(u.owner.ctx, input({ toppedUpThrough: TARGET })));
    await topUpAll();
    expect(await visitsOf(series.id)).toEqual([]);

    // Three days later the edge moves and the new days arrive.
    const later = new Date("2026-11-21T18:00:00.000Z");
    await topUpAll(later);
    expect(await days(series.id)).toEqual(["2027-02-17", "2027-02-19"]);
    expect(ok(await appointmentSeriesService.getById(u.owner.ctx, series.id))).toMatchObject({
      toppedUpThrough: "2027-02-19",
    });
  });

  it("starts no earlier than today after a gap, so no past visits are invented", async () => {
    const { u, input } = await setup();
    const series = ok(
      await appointmentSeriesService.create(
        u.owner.ctx,
        input({ startsOn: "2026-10-01", toppedUpThrough: "2026-10-20" }),
      ),
    );
    await topUpAll();
    const got = await days(series.id);
    expect(got[0]).toBe("2026-11-18");
    expect(got.every((d) => d! >= "2026-11-18")).toBe(true);
  });

  it("goes past failing series instead of stalling on them", async () => {
    await topUpAll(); // drain other tests' series first
    const { u, group, input } = await setup();
    const bad = ok(
      await appointmentSeriesService.create(u.owner.ctx, input({ toppedUpThrough: "2000-01-01" })),
    );
    const good = ok(
      await appointmentSeriesService.create(u.owner.ctx, input({ toppedUpThrough: "2026-11-17" })),
    );
    // An unreadable provider list makes the bad series' visits fail to write.
    const { getDb, appointmentSeriesSchema } = await import("../db");
    const { eq } = await import("drizzle-orm");
    await getDb()
      .update(appointmentSeriesSchema)
      .set({ rule: "FREQ=DAILY;INTERVAL=1", providerIds: [randomUUID()] })
      .where(eq(appointmentSeriesSchema.id, bad.id));
    void group;
    const res = ok(await appointmentSeriesService.topUp(NOW, { limit: 1 }));
    expect(res).toMatchObject({ failed: 1, toppedUp: 1 });
    expect((await days(good.id)).length).toBeGreaterThan(0);
  });
});
