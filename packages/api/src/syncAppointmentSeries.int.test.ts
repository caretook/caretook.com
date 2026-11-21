import type { AuthUser } from "@caretook/data";

import {
  appointmentSeriesService,
  entryProviderId,
  entryProviderService,
  noteDocumentService,
  providerService,
  seriesVisitId,
  timelineEntryService,
} from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { router } from ".";

// sync.upload for repeating series (appointments-2): rows as a device's
// SQLite holds them (snake_case, JSON as text, booleans as 1/0). Each test
// makes its own users and group.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  const other = await createGroup(owner);
  return {
    group,
    recipient,
    other,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
  };
};

const AT = "2026-11-18T18:00:00.000000Z";

const seriesRow = (groupId: string, recipientId: string, overrides: Record<string, unknown> = {}) => ({
  group_id: groupId,
  recipient_id: recipientId,
  kind: "event",
  rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
  starts_on: "2026-11-18",
  start_time: "06:00",
  all_day: 0,
  time_zone: "America/Los_Angeles",
  title: "Dialysis",
  duration_minutes: 240,
  place: null,
  provider_ids: "[]",
  topped_up_through: "2027-02-16",
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
  created_by: "ignored",
  updated_by: "ignored",
  ...overrides,
});

const put = (id: string, data: Record<string, unknown>) => ({
  op: "PUT" as const,
  table: "appointment_series",
  id,
  data,
});

describe("sync.upload: appointment_series", () => {
  it("applies PUT (idempotent), an edit PATCH, and DELETE (soft, replayable)", async () => {
    const { group, recipient, owner } = await setup();
    const id = randomUUID();
    const create = put(id, seriesRow(group.id, recipient.id));
    const patch = {
      op: "PATCH" as const,
      table: "appointment_series",
      id,
      data: { rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,TH;COUNT=12", start_time: "07:30" },
    };
    expect((await owner.api.sync.upload({ ops: [create, patch] })).results).toEqual([
      { id, status: "applied" },
      { id, status: "applied" },
    ]);
    expect(ok(await appointmentSeriesService.getById(owner.ctx, id))).toMatchObject({
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,TH;COUNT=12",
      startTime: "07:30",
      allDay: false,
      toppedUpThrough: "2027-02-16",
      createdBy: owner.user.id,
    });
    expect(
      (await owner.api.sync.upload({ ops: [create, patch] })).results.every((r) => r.status === "applied"),
    ).toBe(true);

    const del = { op: "DELETE" as const, table: "appointment_series", id };
    expect((await owner.api.sync.upload({ ops: [del] })).results).toEqual([{ id, status: "applied" }]);
    expect(await appointmentSeriesService.getById(owner.ctx, id)).toBeNull();
    expect((await owner.api.sync.upload({ ops: [del] })).results).toEqual([{ id, status: "applied" }]);
  });

  it("soft-removes on a PATCH of deleted_at, and on a PUT of a series deleted before it uploaded", async () => {
    const { group, recipient, owner } = await setup();
    const [a, b] = [randomUUID(), randomUUID()];
    const remove = { op: "PATCH" as const, table: "appointment_series", id: a, data: { deleted_at: AT } };
    const ops = [
      put(a, seriesRow(group.id, recipient.id)),
      remove,
      put(b, seriesRow(group.id, recipient.id, { deleted_at: AT })),
    ];
    expect((await owner.api.sync.upload({ ops })).results.map((r) => r.status)).toEqual([
      "applied",
      "applied",
      "applied",
    ]);
    for (const id of [a, b])
      expect(
        ok(await appointmentSeriesService.getById(owner.ctx, id, { includeDeleted: true }))!.deletedAt,
      ).not.toBeNull();
  });

  it("refuses a changed group, recipient or kind (immutable), a bad rule, and a viewer", async () => {
    const { group, recipient, other, owner, viewer } = await setup();
    const id = randomUUID();
    ok(await owner.api.sync.upload({ ops: [put(id, seriesRow(group.id, recipient.id))] }));

    const res = await owner.api.sync.upload({
      ops: [
        { op: "PATCH", table: "appointment_series", id, data: { group_id: other.group.id } },
        { op: "PATCH", table: "appointment_series", id, data: { kind: "note" } },
        put(id, seriesRow(group.id, recipient.id, { kind: "note", title: null, duration_minutes: null })),
        put(id, seriesRow(other.group.id, other.recipient.id)),
        { op: "PATCH", table: "appointment_series", id, data: { rule: "FREQ=WEEKLY;INTERVAL=1" } },
      ],
    });
    expect(res.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual([
      "appointmentSeriesService:immutable",
      "appointmentSeriesService:immutable",
      // A note series is refused outright: series are events only.
      "appointmentSeriesService:invalid",
      "appointmentSeriesService:immutable",
      "appointmentSeriesService:invalid",
    ]);

    const fresh = randomUUID();
    const refused = await viewer.api.sync.upload({ ops: [put(fresh, seriesRow(group.id, recipient.id))] });
    expect(refused.results).toEqual([{ id: fresh, status: "rejected", code: "permissions:unauthorized" }]);
  });

  it("takes a series and its visits, documents and links from one batch, and again on a replay", async () => {
    const { group, recipient, owner } = await setup();
    const clinic = ok(
      await providerService.create(owner.ctx, {
        groupId: group.id,
        type: "practice",
        name: "Mercy dialysis",
      }),
    )!;
    const id = randomUUID();
    const days = [
      ["2026-11-18", "2026-11-18T14:00:00.000000Z"],
      ["2026-11-20", "2026-11-20T14:00:00.000000Z"],
      ["2026-11-23", "2026-11-23T14:00:00.000000Z"],
    ] as const;
    const visitOps = days.flatMap(([day, at]) => {
      const visitId = seriesVisitId(id, day);
      return [
        {
          op: "PUT" as const,
          table: "timeline_entry",
          id: visitId,
          data: {
            group_id: group.id,
            recipient_id: recipient.id,
            kind: "event",
            occurred_at: at,
            time_zone: "America/Los_Angeles",
            title: "Dialysis",
            body: null,
            details: null,
            ends_at: at.replace("T14", "T18"),
            all_day: 0,
            series_id: id,
            series_day: day,
            series_detached: 0,
            deleted_at: null,
          },
        },
        {
          op: "PUT" as const,
          table: "note_document",
          id: visitId,
          data: { group_id: group.id, subject: "entry", entry_id: visitId },
        },
        {
          op: "PUT" as const,
          table: "timeline_entry_provider",
          id: entryProviderId(visitId, clinic.id),
          data: { group_id: group.id, entry_id: visitId, provider_id: clinic.id },
        },
      ];
    });
    const ops = [
      put(id, seriesRow(group.id, recipient.id, { provider_ids: JSON.stringify([clinic.id]) })),
      ...visitOps,
    ];

    for (let round = 0; round < 2; round++) {
      const { results } = await owner.api.sync.upload({ ops });
      expect(results.filter((r) => r.status !== "applied")).toEqual([]);
    }
    expect(ok(await appointmentSeriesService.getById(owner.ctx, id))).toMatchObject({
      providerIds: [clinic.id],
    });
    for (const [day] of days) {
      const visitId = seriesVisitId(id, day);
      expect(ok(await timelineEntryService.getById(owner.ctx, visitId))).toMatchObject({
        seriesId: id,
        seriesDay: day,
        seriesDetached: false,
      });
      expect(ok(await noteDocumentService.getById(owner.ctx, visitId))).toBeTruthy();
      expect(ok(await entryProviderService.listForEntry(owner.ctx, visitId)).data).toHaveLength(1);
    }

    // A detached visit (changed on its own) uploads its flag.
    const visitId = seriesVisitId(id, "2026-11-20");
    const detach = {
      op: "PATCH" as const,
      table: "timeline_entry",
      id: visitId,
      data: {
        occurred_at: "2026-11-20T16:00:00.000000Z",
        ends_at: "2026-11-20T20:00:00.000000Z",
        series_detached: 1,
      },
    };
    expect((await owner.api.sync.upload({ ops: [detach] })).results).toEqual([
      { id: visitId, status: "applied" },
    ]);
    expect(ok(await timelineEntryService.getById(owner.ctx, visitId))).toMatchObject({
      seriesDetached: true,
    });
  });
});
