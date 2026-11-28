import {
  entryProviderId,
  entryProviderService,
  noteDocumentService,
  timelineEntryService,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../data/test/fixtures";
import { clientFor, sqliteTime, upload } from "./testing";
import { encodeNoteDoc } from "@caretook/data/domain";

// sync.upload for appointments and reminders: the new timeline_entry columns
// as a device's SQLite holds them (timestamps as PowerSync text, all_day as
// 1/0). Each test makes its own users and group.

const HOUR = 3_600_000;
const iso = (text: string) => new Date(text).toISOString();

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  const row = (overrides: Record<string, unknown> = {}) => ({
    group_id: group.id,
    recipient_id: recipient.id,
    kind: "event",
    occurred_at: sqliteTime(48 * HOUR),
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
    const endsAt = sqliteTime(49 * HOUR);
    const put = {
      op: "PUT" as const,
      table: "timeline_entry",
      id,
      data: row({ ends_at: endsAt, place: "Clinic" }),
    };
    expect(await upload(owner.api, [put])).toEqual([{ id, status: "applied" }]);
    const stored = ok(await timelineEntryService.getById(viewer.ctx, id))!;
    expect(stored).toMatchObject({ place: "Clinic", allDay: false, cancelledAt: null });
    expect(iso(stored.endsAt!)).toBe(iso(endsAt));

    const cancelledAt = sqliteTime(0);
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
    expect(await upload(owner.api, [next, cancel])).toEqual([
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
      data: row({ kind: "event", title: "Hospice intake", occurred_at: midnight, all_day: 1 }),
    };
    expect(await upload(owner.api, [allDay])).toEqual([{ id: allDayId, status: "applied" }]);
    expect(ok(await timelineEntryService.getById(viewer.ctx, allDayId))).toMatchObject({ allDay: true });

    // Undo the cancel, and drop all-day.
    const undo = {
      op: "PATCH" as const,
      table: "timeline_entry",
      id,
      data: { cancelled_at: null, cancel_reason: null, rescheduled_to: null },
    };
    const notAllDay = { op: "PATCH" as const, table: "timeline_entry", id: allDayId, data: { all_day: 0 } };
    expect((await upload(owner.api, [undo, notAllDay])).map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(ok(await timelineEntryService.getById(viewer.ctx, id))).toMatchObject({
      cancelledAt: null,
      cancelledBy: null,
      rescheduledTo: null,
    });
    expect(ok(await timelineEntryService.getById(viewer.ctx, allDayId))).toMatchObject({ allDay: false });

    // A replay changes nothing.
    expect(await upload(owner.api, [put])).toEqual([{ id, status: "applied" }]);
  });

  it("refuses a viewer's cancel", async () => {
    const { owner, viewer, row } = await setup();
    const id = randomUUID();
    await owner.api.sync.upload({ ops: [{ op: "PUT", table: "timeline_entry", id, data: row() }] });
    const res = await viewer.api.sync.upload({
      ops: [{ op: "PATCH", table: "timeline_entry", id, data: { cancelled_at: sqliteTime(0) } }],
    });
    expect(res.results[0]).toMatchObject({ status: "rejected", code: "permissions:unauthorized" });
    expect(ok(await timelineEntryService.getById(viewer.ctx, id))).toMatchObject({ cancelledAt: null });
  });
});

describe("sync.upload: a reschedule that keeps the old event", () => {
  /** An event with notes and a provider, uploaded by the owner. */
  const withEvent = async () => {
    const ctx = await setup();
    const { owner, group, row } = ctx;
    const oldId = randomUUID();
    const providerId = randomUUID();
    const doc = newYDoc();
    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry", id: oldId, data: row({ place: "Valley Heart, Suite 200" }) },
        {
          op: "PUT",
          table: "provider",
          id: providerId,
          data: {
            group_id: group.id,
            type: "clinician",
            name: "Dr. Moved",
            status: "current",
            is_primary: 0,
          },
        },
        {
          op: "PUT",
          table: "note_document",
          id: oldId,
          data: { group_id: group.id, subject: "entry", entry_id: oldId },
        },
        {
          op: "PUT",
          table: "note_update",
          id: randomUUID(),
          data: { group_id: group.id, document_id: oldId, data: typeParagraph(doc, "Bring the cuff log") },
        },
        {
          op: "PUT",
          table: "timeline_entry_provider",
          id: entryProviderId(oldId, providerId),
          data: { group_id: group.id, entry_id: oldId, provider_id: providerId },
        },
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(Array(5).fill("applied"));
    return { ...ctx, oldId, providerId, doc };
  };

  /** The ops a device's `rescheduleEvent` queues, in its transaction's order. */
  const rescheduleOps = (
    { group, row, oldId, providerId, doc }: Awaited<ReturnType<typeof withEvent>>,
    newId: string,
  ) => [
    {
      op: "PUT" as const,
      table: "timeline_entry",
      id: newId,
      data: row({ occurred_at: sqliteTime(96 * HOUR), place: "Valley Heart, Suite 200" }),
    },
    {
      op: "PUT" as const,
      table: "note_document",
      id: newId,
      data: { group_id: group.id, subject: "entry", entry_id: newId },
    },
    {
      op: "PUT" as const,
      table: "note_update",
      id: randomUUID(),
      data: { group_id: group.id, document_id: newId, data: encodeNoteDoc(doc) },
    },
    {
      op: "PUT" as const,
      table: "timeline_entry_provider",
      id: entryProviderId(newId, providerId),
      data: { group_id: group.id, entry_id: newId, provider_id: providerId },
    },
    {
      op: "PATCH" as const,
      table: "timeline_entry",
      id: oldId,
      data: { cancelled_at: sqliteTime(0), rescheduled_to: newId },
    },
  ];

  it("applies the new event, its notes and providers, then the old one cancelled and linking to it", async () => {
    const event = await withEvent();
    const { owner, viewer, oldId, providerId } = event;
    const newId = randomUUID();
    const res = await owner.api.sync.upload({ ops: rescheduleOps(event, newId) });
    expect(res.results.map((r) => r.status)).toEqual(Array(5).fill("applied"));

    expect(ok(await timelineEntryService.getById(viewer.ctx, newId))).toMatchObject({
      kind: "event",
      title: "Cardiology",
      place: "Valley Heart, Suite 200",
      cancelledAt: null,
    });
    expect(ok(await noteDocumentService.currentText(viewer.ctx, newId))).toBe("Bring the cuff log");
    expect(
      ok(await entryProviderService.listForEntry(viewer.ctx, newId)).data.map((l) => l.providerId),
    ).toEqual([providerId]);
    expect(ok(await timelineEntryService.getById(viewer.ctx, oldId))).toMatchObject({
      rescheduledTo: newId,
      cancelledBy: owner.user.id,
    });
    // The old notes stay as they were.
    expect(ok(await noteDocumentService.currentText(viewer.ctx, oldId))).toBe("Bring the cuff log");
  });

  it("refuses every one of a viewer's reschedule writes", async () => {
    const event = await withEvent();
    const { viewer, oldId } = event;
    const newId = randomUUID();
    const res = await viewer.api.sync.upload({ ops: rescheduleOps(event, newId) });
    expect(res.results.map((r) => r.status)).toEqual(Array(5).fill("rejected"));
    expect(await timelineEntryService.getById(viewer.ctx, newId)).toBeNull();
    expect(ok(await timelineEntryService.getById(viewer.ctx, oldId))).toMatchObject({
      cancelledAt: null,
      rescheduledTo: null,
    });
  });
});
