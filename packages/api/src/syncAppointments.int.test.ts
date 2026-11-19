import type { AuthUser } from "@caretook/data";

import { timelineEntryService } from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { router } from ".";

// sync.upload for appointments and reminders: the new timeline_entry columns
// as a device's SQLite holds them (timestamps as PowerSync text, all_day as
// 1/0). Each test makes its own users and group.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

const HOUR = 3_600_000;
/** A time `ms` from now, as PowerSync's SQLite text. */
const local = (ms: number) => new Date(Date.now() + ms).toISOString().replace(/Z$/, "000Z");
const iso = (text: string) => new Date(text).toISOString();

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  const row = (overrides: Record<string, unknown> = {}) => ({
    group_id: group.id,
    recipient_id: recipient.id,
    kind: "event",
    occurred_at: local(48 * HOUR),
    time_zone: "America/Los_Angeles",
    title: "Cardiology",
    body: null,
    details: null,
    ends_at: null,
    all_day: 0,
    place: null,
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    rescheduled_to: null,
    deleted_at: null,
    ...overrides,
  });
  return {
    group,
    row,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
  };
};

describe("sync.upload: appointment columns", () => {
  it("round-trips every new column on PUT and PATCH, all_day as 1/0", async () => {
    const { owner, viewer, row } = await setup();
    const id = randomUUID();
    const endsAt = local(49 * HOUR);
    const put = {
      op: "PUT" as const,
      table: "timeline_entry",
      id,
      data: row({ ends_at: endsAt, place: "Clinic" }),
    };
    expect((await owner.api.sync.upload({ ops: [put] })).results).toEqual([{ id, status: "applied" }]);
    const stored = ok(await timelineEntryService.getById(viewer.ctx, id))!;
    expect(stored).toMatchObject({ place: "Clinic", allDay: false, cancelledAt: null });
    expect(iso(stored.endsAt!)).toBe(iso(endsAt));

    const cancelledAt = local(0);
    const nextId = randomUUID();
    const next = { op: "PUT" as const, table: "timeline_entry", id: nextId, data: row() };
    const cancel = {
      op: "PATCH" as const,
      table: "timeline_entry",
      id,
      data: {
        cancelled_at: cancelledAt,
        cancelled_by: "forged",
        cancel_reason: "Moved",
        rescheduled_to: nextId,
      },
    };
    expect((await owner.api.sync.upload({ ops: [next, cancel] })).results).toEqual([
      { id: nextId, status: "applied" },
      { id, status: "applied" },
    ]);
    const cancelled = ok(await timelineEntryService.getById(viewer.ctx, id))!;
    expect(cancelled).toMatchObject({
      cancelReason: "Moved",
      rescheduledTo: nextId,
      // Set by the server from the uploader, never the device's value.
      cancelledBy: owner.user.id,
    });
    expect(iso(cancelled.cancelledAt!)).toBe(iso(cancelledAt));

    // All day: the start of its day in its zone, no end.
    const allDayId = randomUUID();
    const midnight = "2026-12-03T08:00:00.000000Z"; // midnight Dec 3 in Los Angeles
    const allDay = {
      op: "PUT" as const,
      table: "timeline_entry",
      id: allDayId,
      data: row({ kind: "note", title: "Hospice intake", occurred_at: midnight, all_day: 1 }),
    };
    expect((await owner.api.sync.upload({ ops: [allDay] })).results).toEqual([
      { id: allDayId, status: "applied" },
    ]);
    expect(ok(await timelineEntryService.getById(viewer.ctx, allDayId))).toMatchObject({ allDay: true });

    // Undo the cancel, and drop all-day.
    const undo = {
      op: "PATCH" as const,
      table: "timeline_entry",
      id,
      data: { cancelled_at: null, cancel_reason: null, rescheduled_to: null },
    };
    const notAllDay = { op: "PATCH" as const, table: "timeline_entry", id: allDayId, data: { all_day: 0 } };
    expect((await owner.api.sync.upload({ ops: [undo, notAllDay] })).results.map((r) => r.status)).toEqual([
      "applied",
      "applied",
    ]);
    expect(ok(await timelineEntryService.getById(viewer.ctx, id))).toMatchObject({
      cancelledAt: null,
      cancelledBy: null,
      rescheduledTo: null,
    });
    expect(ok(await timelineEntryService.getById(viewer.ctx, allDayId))).toMatchObject({ allDay: false });

    // A replay changes nothing.
    expect((await owner.api.sync.upload({ ops: [put] })).results).toEqual([{ id, status: "applied" }]);
  });

  it("acknowledges a future vital, and a note with a place, as rejected", async () => {
    const { owner, viewer, row } = await setup();
    const vitalId = randomUUID();
    const noteId = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "timeline_entry",
          id: vitalId,
          data: row({
            kind: "vital",
            title: null,
            occurred_at: local(3 * HOUR),
            details: JSON.stringify({ readings: [{ type: "heartRate", value: 72 }] }),
          }),
        },
        {
          op: "PUT",
          table: "timeline_entry",
          id: noteId,
          data: row({ kind: "note", title: null, place: "Home" }),
        },
      ],
    });
    expect(res.results).toEqual([
      expect.objectContaining({ id: vitalId, status: "rejected", code: "timelineEntryService:invalid" }),
      expect.objectContaining({ id: noteId, status: "rejected", code: "timelineEntryService:invalid" }),
    ]);
    expect(await timelineEntryService.getById(viewer.ctx, vitalId)).toBeNull();
  });

  it("refuses a viewer's cancel", async () => {
    const { owner, viewer, row } = await setup();
    const id = randomUUID();
    await owner.api.sync.upload({ ops: [{ op: "PUT", table: "timeline_entry", id, data: row() }] });
    const res = await viewer.api.sync.upload({
      ops: [{ op: "PATCH", table: "timeline_entry", id, data: { cancelled_at: local(0) } }],
    });
    expect(res.results[0]).toMatchObject({ status: "rejected", code: "permissions:unauthorized" });
    expect(ok(await timelineEntryService.getById(viewer.ctx, id))).toMatchObject({ cancelledAt: null });
  });
});
