import type { AuthUser } from "@caretook/data";

import { timelineEntryService, todoService } from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { router } from ".";

// sync.upload as the easy roles (easy roles PRD): an offline Easy helper's
// writes follow the same rules once they upload. Each allowed op lands;
// another member's entry and every setup op are refused (acknowledged,
// never retried). Each test makes its own users and group. Fictional data.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

/** A time `ms` from now, as PowerSync's SQLite text. */
const local = (ms: number) => new Date(Date.now() + ms).toISOString().replace(/Z$/, "000Z");

const setup = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  const helper = await createUser("easy-helper");
  const easyViewer = await createUser("easy-viewer");
  const { group, recipient } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: helper.user, role: "easy_helper" },
    { user: easyViewer.user, role: "easy_viewer" },
  ]);
  const entryRow = (overrides: Record<string, unknown> = {}) => ({
    group_id: group.id,
    recipient_id: recipient.id,
    kind: "symptom",
    occurred_at: local(-60_000),
    time_zone: "America/Los_Angeles",
    title: null,
    body: null,
    details: JSON.stringify({ name: "Cough", severity: 2 }),
    deleted_at: null,
    ...overrides,
  });
  return {
    owner,
    caretaker,
    group,
    recipient,
    entryRow,
    helper: { ...helper, api: clientFor(helper.ctx.authUser) },
    easyViewer: { ...easyViewer, api: clientFor(easyViewer.ctx.authUser) },
  };
};

const statuses = (res: { results: { status: string }[] }) => res.results.map((r) => r.status);

describe("sync.upload as an Easy helper", () => {
  it("lands their own entry, its edit and its delete", async () => {
    const { helper, owner, entryRow } = await setup();
    const id = randomUUID();
    const res = await helper.api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry", id, data: entryRow() },
        {
          op: "PATCH",
          table: "timeline_entry",
          id,
          data: { details: JSON.stringify({ name: "Cough", severity: 4 }) },
        },
      ],
    });
    expect(statuses(res)).toEqual(["applied", "applied"]);
    expect(ok(await timelineEntryService.getById(owner.ctx, id))).toMatchObject({
      createdBy: helper.user.id,
      details: { name: "Cough", severity: 4 },
    });
    expect(
      statuses(
        await helper.api.sync.upload({
          ops: [{ op: "PATCH", table: "timeline_entry", id, data: { deleted_at: local(0) } }],
        }),
      ),
    ).toEqual(["applied"]);
    expect(await timelineEntryService.getById(owner.ctx, id)).toBeNull();
  });

  it("refuses another member's entry, edit or delete, and leaves it as it was", async () => {
    const { helper, caretaker, group, entryRow } = await setup();
    const theirs = ok(
      await timelineEntryService.create(caretaker.ctx, {
        groupId: group.id,
        kind: "note",
        title: "Slept well",
        occurredAt: new Date(Date.now() - 60_000).toISOString(),
        timeZone: "America/Los_Angeles",
      }),
    )!;
    const res = await helper.api.sync.upload({
      ops: [
        { op: "PATCH", table: "timeline_entry", id: theirs.id, data: { title: "Slept badly" } },
        {
          op: "PUT",
          table: "timeline_entry",
          id: theirs.id,
          data: entryRow({ kind: "note", title: "Mine now", details: null }),
        },
        { op: "PATCH", table: "timeline_entry", id: theirs.id, data: { deleted_at: local(0) } },
        { op: "DELETE", table: "timeline_entry", id: theirs.id },
      ],
    });
    expect(res.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual(
      Array<string>(4).fill("permissions:unauthorized"),
    );
    expect(ok(await timelineEntryService.getById(caretaker.ctx, theirs.id))).toMatchObject({
      title: "Slept well",
      deletedAt: null,
    });
  });

  it("refuses setup: a medication, a provider, a care period, a todo and an appointment's cancellation", async () => {
    const { helper, group, recipient, entryRow } = await setup();
    const res = await helper.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "medication",
          id: randomUUID(),
          data: {
            group_id: group.id,
            recipient_id: recipient.id,
            name: "Lisinopril",
            type: "prescription",
            schedule: JSON.stringify({ type: "asNeeded" }),
            status: "current",
            deleted_at: null,
          },
        },
        {
          op: "PUT",
          table: "provider",
          id: randomUUID(),
          data: {
            group_id: group.id,
            type: "clinician",
            name: "Dr. Offline",
            status: "current",
            deleted_at: null,
          },
        },
        {
          op: "PUT",
          table: "care_period",
          id: randomUUID(),
          data: {
            group_id: group.id,
            recipient_id: recipient.id,
            type: "hospital",
            label: "Mercy General",
            started_at: local(-3_600_000),
            date_only: 0,
            deleted_at: null,
          },
        },
        {
          op: "PUT",
          table: "todo",
          id: randomUUID(),
          data: { group_id: group.id, recipient_id: recipient.id, title: "Call", deleted_at: null },
        },
        {
          op: "PUT",
          table: "timeline_entry",
          id: randomUUID(),
          data: entryRow({ kind: "event", title: "Dentist", details: null, cancelled_at: local(0) }),
        },
      ],
    });
    expect(res.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual([
      ...Array<string>(4).fill("permissions:unauthorized"),
      "timelineEntryService:loggerOnly",
    ]);
  });

  it("refuses clearing a writer's cancellation or reschedule of their own event, and lands an edit", async () => {
    const { helper, caretaker, owner, group } = await setup();
    const event = (title: string, by = helper.ctx) =>
      timelineEntryService.create(by, {
        groupId: group.id,
        kind: "event",
        title,
        occurredAt: new Date(Date.now() - 60_000).toISOString(),
        timeZone: "America/Los_Angeles",
      });
    const mine = ok(await event("Physio"))!;
    const later = ok(await event("Physio, again", caretaker.ctx))!;
    const cancelledAt = new Date(Date.now() - 30_000).toISOString();
    ok(
      await timelineEntryService.update(caretaker.ctx, mine.id, {
        cancelledAt,
        cancelReason: "Therapist away",
        rescheduledTo: later.id,
      }),
    );

    const res = await helper.api.sync.upload({
      ops: [
        {
          op: "PATCH",
          table: "timeline_entry",
          id: mine.id,
          data: { cancelled_at: null, cancel_reason: null, rescheduled_to: null },
        },
        { op: "PATCH", table: "timeline_entry", id: mine.id, data: { rescheduled_to: null } },
        { op: "PATCH", table: "timeline_entry", id: mine.id, data: { title: "Physio visit", body: "Shoes" } },
      ],
    });
    expect(res.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual([
      "timelineEntryService:loggerOnly",
      "timelineEntryService:loggerOnly",
      "applied",
    ]);
    expect(ok(await timelineEntryService.getById(owner.ctx, mine.id))).toMatchObject({
      title: "Physio visit",
      body: "Shoes",
      cancelledAt: new Date(cancelledAt),
      cancelReason: "Therapist away",
      rescheduledTo: later.id,
    });
  });

  it("ticks a todo assigned to them, and is refused another member's", async () => {
    const { helper, owner, caretaker, group } = await setup();
    const own = ok(
      await todoService.create(owner.ctx, {
        groupId: group.id,
        title: "Water the plants",
        assigneeId: helper.user.id,
      }),
    )!;
    const theirs = ok(
      await todoService.create(owner.ctx, {
        groupId: group.id,
        title: "Call the pharmacy",
        assigneeId: caretaker.user.id,
      }),
    )!;
    const tick = (id: string) => ({
      op: "PATCH" as const,
      table: "todo",
      id,
      data: { done_at: local(-1000), done_by: helper.user.id },
    });
    expect(statuses(await helper.api.sync.upload({ ops: [tick(own.id), tick(theirs.id)] }))).toEqual([
      "applied",
      "rejected",
    ]);
    expect(ok(await todoService.getById(owner.ctx, own.id))).toMatchObject({ doneBy: helper.user.id });
    expect(ok(await todoService.getById(owner.ctx, theirs.id))).toMatchObject({ doneAt: null });
  });
});

describe("sync.upload as an Easy viewer", () => {
  it("refuses an entry and lands a tick on their own todo", async () => {
    const { easyViewer, owner, group, entryRow } = await setup();
    const own = ok(
      await todoService.create(owner.ctx, {
        groupId: group.id,
        title: "Read the mail",
        assigneeId: easyViewer.user.id,
      }),
    )!;
    const res = await easyViewer.api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry", id: randomUUID(), data: entryRow() },
        {
          op: "PATCH",
          table: "todo",
          id: own.id,
          data: { done_at: local(-1000), done_by: easyViewer.user.id },
        },
      ],
    });
    expect(statuses(res)).toEqual(["rejected", "applied"]);
  });
});
