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
