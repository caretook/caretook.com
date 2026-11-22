import {
  appointmentSeriesService,
  noteDocumentService,
  seriesVisitId,
  timelineEntryService,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor } from "./testing";

// sync.upload for a series edit (appointments-2, slice 2): "This and later"
// reaches the server as ordinary ops in one batch (the new series, the old
// one ended, the visits moved), as the device's applySeriesEdit queues them.

const AT = "2026-11-18T18:00:00.000000Z";
const LA = "America/Los_Angeles";

const setup = async () => {
  const owner = await createUser("owner");
  const { group, recipient } = await createGroup(owner);
  return { group, recipient, owner: { ...owner, api: clientFor(owner.ctx.authUser) } };
};

const seriesPut = (id: string, groupId: string, recipientId: string, over: Record<string, unknown> = {}) => ({
  op: "PUT" as const,
  table: "appointment_series",
  id,
  data: {
    group_id: groupId,
    recipient_id: recipientId,
    kind: "event",
    rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
    starts_on: "2027-03-01",
    start_time: "06:00",
    all_day: 0,
    time_zone: LA,
    title: "Dialysis",
    duration_minutes: 240,
    place: null,
    provider_ids: "[]",
    topped_up_through: "2027-03-05",
    deleted_at: null,
    created_at: AT,
    updated_at: AT,
    ...over,
  },
});

const visitOps = (seriesId: string, groupId: string, recipientId: string, day: string, at: string) => {
  const id = seriesVisitId(seriesId, day);
  return [
    {
      op: "PUT" as const,
      table: "timeline_entry",
      id,
      data: {
        group_id: groupId,
        recipient_id: recipientId,
        kind: "event",
        occurred_at: at,
        time_zone: LA,
        title: "Dialysis",
        body: null,
        details: null,
        ends_at: null,
        all_day: 0,
        series_id: seriesId,
        series_day: day,
        series_detached: 0,
        deleted_at: null,
      },
    },
    {
      op: "PUT" as const,
      table: "note_document",
      id,
      data: { group_id: groupId, subject: "entry", entry_id: id },
    },
  ];
};

describe("sync.upload: a series split", () => {
  it("ends the old series, starts the new one, and moves later visits keeping their ids and documents", async () => {
    const { group, recipient, owner } = await setup();
    const old = randomUUID();
    // Mon 1, Wed 3, Fri 5 Mar 2027 at 6:00 in Los Angeles (14:00 UTC).
    const days = ["2027-03-01", "2027-03-03", "2027-03-05"];
    const made = await owner.api.sync.upload({
      ops: [
        seriesPut(old, group.id, recipient.id),
        ...days.flatMap((d) => visitOps(old, group.id, recipient.id, d, `${d}T14:00:00.000000Z`)),
      ],
    });
    expect(made.results.filter((r) => r.status !== "applied")).toEqual([]);

    // "This and later" from Wed 3 Mar: 7:00 from then on.
    const next = randomUUID();
    const moved = days.slice(1).map((d) => seriesVisitId(old, d));
    const split = [
      seriesPut(next, group.id, recipient.id, { starts_on: "2027-03-03", start_time: "07:00" }),
      {
        op: "PATCH" as const,
        table: "appointment_series",
        id: old,
        data: { rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20270302" },
      },
      ...moved.map((id, i) => ({
        op: "PATCH" as const,
        table: "timeline_entry",
        id,
        data: { series_id: next, occurred_at: `${days[i + 1]}T15:00:00.000000Z` },
      })),
    ];
    const { results } = await owner.api.sync.upload({ ops: split });
    expect(results.filter((r) => r.status !== "applied")).toEqual([]);

    expect(ok(await appointmentSeriesService.getById(owner.ctx, old))).toMatchObject({
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20270302",
    });
    expect(ok(await appointmentSeriesService.getById(owner.ctx, next))).toMatchObject({
      startsOn: "2027-03-03",
      startTime: "07:00",
      deletedAt: null,
    });
    for (const [i, id] of moved.entries()) {
      expect(ok(await timelineEntryService.getById(owner.ctx, id))).toMatchObject({
        seriesId: next,
        seriesDay: days[i + 1],
        seriesDetached: false,
      });
      expect(ok(await noteDocumentService.getById(owner.ctx, id))).toBeTruthy();
    }
    // The first visit stays on the old series, as it was.
    expect(ok(await timelineEntryService.getById(owner.ctx, seriesVisitId(old, days[0]!)))).toMatchObject({
      seriesId: old,
    });

    // A replay of the same batch lands the same way.
    const replay = await owner.api.sync.upload({ ops: split });
    expect(replay.results.filter((r) => r.status !== "applied")).toEqual([]);
  });

  it("refuses moving a past visit onto another series", async () => {
    const { group, recipient, owner } = await setup();
    const old = randomUUID();
    const next = randomUUID();
    const day = "2026-01-05";
    const made = await owner.api.sync.upload({
      ops: [
        seriesPut(old, group.id, recipient.id, { starts_on: day, topped_up_through: day }),
        ...visitOps(old, group.id, recipient.id, day, `${day}T14:00:00.000000Z`),
        seriesPut(next, group.id, recipient.id, { starts_on: "2027-03-01" }),
      ],
    });
    expect(made.results.filter((r) => r.status !== "applied")).toEqual([]);

    const id = seriesVisitId(old, day);
    const { results } = await owner.api.sync.upload({
      ops: [{ op: "PATCH", table: "timeline_entry", id, data: { series_id: next } }],
    });
    expect(results).toMatchObject([{ id, status: "rejected", code: "timelineEntryService:pastVisit" }]);
    expect(ok(await timelineEntryService.getById(owner.ctx, id))).toMatchObject({ seriesId: old });

    // Changing it on its own is still fine.
    const detach = await owner.api.sync.upload({
      ops: [
        { op: "PATCH", table: "timeline_entry", id, data: { series_detached: 1, title: "Dialysis (late)" } },
      ],
    });
    expect(detach.results).toEqual([{ id, status: "applied" }]);
  });
});
