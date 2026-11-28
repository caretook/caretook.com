import type { PassMovedDetails } from "@caretook/data";

import {
  careRecipientService,
  medicationPassService,
  medicationService,
  PASS_REWRITE_METADATA,
  passMovedId,
  recipientAllergyService,
  timelineEntryService,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor, outcomes, patchOp, putOp, upload } from "./testing";

// sync.upload for medication passes and the recipient's allergies
// (medications-2 slice 1): rows as a device's SQLite holds them, a retime's
// entry and a delete's schedule rewrites as the device writes them, and
// refusals. Each test makes its own users and group.

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const caretaker = await createUser("caretaker");
  const { group, recipient } = await createGroup(owner, [
    { user: viewer.user, role: "viewer" },
    { user: caretaker.user, role: "caretaker" },
  ]);
  const passes = async () => ok(await medicationPassService.list(viewer.ctx, { groupId: group.id })).data;
  const [morning, evening] = await passes();
  if (!morning || !evening) throw new Error("no default passes");
  return {
    group,
    recipient,
    passes,
    morning,
    evening,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
    caretaker,
  };
};

const SAVED_AT = "2026-11-17T21:45:25.229000Z";
const MOVED_AT = "2026-11-18T09:00:00.000000Z";

const passRow = (groupId: string, recipientId: string, overrides: Record<string, unknown> = {}) => ({
  group_id: groupId,
  recipient_id: recipientId,
  name: "Noon",
  time: "12:00",
  sort_order: 2,
  deleted_at: null,
  created_at: SAVED_AT,
  updated_at: SAVED_AT,
  created_by: "ignored",
  updated_by: "ignored",
  ...overrides,
});

const allergyRow = (groupId: string, recipientId: string, overrides: Record<string, unknown> = {}) => ({
  group_id: groupId,
  recipient_id: recipientId,
  substance: "Penicillin",
  reaction: "Hives",
  severity: "severe",
  deleted_at: null,
  created_at: SAVED_AT,
  updated_at: SAVED_AT,
  ...overrides,
});

describe("sync.upload: medication_pass", () => {
  it("applies a device's new pass, rename and reorder, and replays safely", async () => {
    const { owner, group, recipient, passes } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "medication_pass", id, data: passRow(group.id, recipient.id) };
    const patch = {
      op: "PATCH" as const,
      table: "medication_pass",
      id,
      data: { name: "Lunch", sort_order: "0", updated_at: MOVED_AT },
    };
    const res = await owner.api.sync.upload({ ops: [put, patch] });
    expect(res.results).toEqual([
      { id, status: "applied" },
      { id, status: "applied" },
    ]);
    // Sort order 0 ties with Morning's: the time breaks it.
    expect((await passes()).map((p) => p.name)).toEqual(["Morning", "Lunch", "Evening"]);
    expect((await upload(owner.api, [put, patch])).every((r) => r.status === "applied")).toBe(true);
  });

  it("retimes a pass with its passMoved entry, so the device's own copy is a no-op", async () => {
    const { owner, viewer, group, recipient, morning } = await setup();
    const medication = ok(
      await medicationService.create(owner.ctx, {
        groupId: group.id,
        name: "Metformin",
        schedule: { type: "scheduled", slots: [{ passId: morning.id }] },
      }),
    );
    const details: PassMovedDetails = {
      change: "passMoved",
      passId: morning.id,
      passName: "Morning",
      beforeTime: "08:00",
      afterTime: "08:30",
      medicationIds: [medication!.id],
    };
    const entryId = passMovedId(morning.id, MOVED_AT);
    const ops = [
      {
        op: "PATCH" as const,
        table: "medication_pass",
        id: morning.id,
        data: { time: "08:30", updated_at: MOVED_AT },
      },
      {
        op: "PUT" as const,
        table: "timeline_entry",
        id: entryId,
        data: {
          group_id: group.id,
          recipient_id: recipient.id,
          kind: "medicationChange",
          occurred_at: MOVED_AT,
          time_zone: "America/Los_Angeles",
          title: null,
          body: null,
          details: JSON.stringify(details),
        },
      },
    ];
    expect((await upload(owner.api, ops)).map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(ok(await medicationPassService.getById(viewer.ctx, morning.id))).toMatchObject({ time: "08:30" });
    const entry = ok(await timelineEntryService.getById(viewer.ctx, entryId));
    expect(entry).toMatchObject({ kind: "medicationChange", details, createdBy: owner.user.id });
    // Replayed: the same one entry.
    expect((await upload(owner.api, ops)).map((r) => r.status)).toEqual(["applied", "applied"]);
    const page = ok(
      await timelineEntryService.list(viewer.ctx, { groupId: group.id, kinds: ["medicationChange"] }),
    );
    expect(page.data.filter((e) => e.id === entryId)).toHaveLength(1);
  });

  it("deletes a pass, rewriting schedules; the device's own rewrite then changes nothing", async () => {
    const { owner, viewer, group, morning, evening } = await setup();
    const medication = ok(
      await medicationService.create(owner.ctx, {
        groupId: group.id,
        name: "Metformin",
        schedule: {
          type: "scheduled",
          slots: [{ passId: morning.id, amount: "1000 mg" }, { passId: evening.id }],
        },
      }),
    );
    const rewritten = {
      type: "scheduled",
      slots: [{ passId: evening.id }, { time: "08:00", amount: "1000 mg" }],
    };
    const ops = [
      {
        op: "PATCH" as const,
        table: "medication_pass",
        id: morning.id,
        data: { deleted_at: MOVED_AT, updated_at: MOVED_AT },
      },
      {
        op: "PATCH" as const,
        table: "medication",
        id: medication!.id,
        data: { schedule: JSON.stringify(rewritten), updated_at: MOVED_AT },
      },
    ];
    expect((await upload(owner.api, ops)).map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(ok(await medicationService.getById(viewer.ctx, medication!.id))?.schedule).toEqual(rewritten);
    const changes = ok(
      await timelineEntryService.list(viewer.ctx, { groupId: group.id, kinds: ["medicationChange"] }),
    ).data;
    // Only the medication's "started" entry: the delete wrote none.
    expect(changes).toHaveLength(1);
    expect((await upload(owner.api, ops)).map((r) => r.status)).toEqual(["applied", "applied"]);
  });

  it("deletes a pass, keeping another member's schedule edit made meanwhile; the device's flagged rewrite drops its schedule (B-1006)", async () => {
    const { owner, viewer, caretaker, group, morning, evening } = await setup();
    const medication = ok(
      await medicationService.create(owner.ctx, {
        groupId: group.id,
        name: "Metformin",
        schedule: {
          type: "scheduled",
          slots: [{ passId: morning.id, amount: "1000 mg" }, { passId: evening.id }],
        },
      }),
    );
    // The owner's device, offline, still holds this schedule when it deletes Morning.
    const stale = {
      type: "scheduled",
      slots: [{ passId: evening.id }, { time: "08:00", amount: "1000 mg" }],
    };
    // Meanwhile, online, the caretaker sets the evening amount.
    ok(
      await medicationService.update(caretaker.ctx, medication!.id, {
        schedule: {
          type: "scheduled",
          slots: [
            { passId: morning.id, amount: "1000 mg" },
            { passId: evening.id, amount: "500 mg" },
          ],
        },
      }),
    );
    const remove = {
      op: "PATCH" as const,
      table: "medication_pass",
      id: morning.id,
      data: { deleted_at: MOVED_AT, updated_at: MOVED_AT },
    };
    expect((await upload(owner.api, [remove])).map((r) => r.status)).toEqual(["applied"]);
    const schedule = async () => ok(await medicationService.getById(viewer.ctx, medication!.id))?.schedule;
    // The server turned Morning into a time of its own, onto the caretaker's schedule.
    const kept = {
      type: "scheduled",
      slots: [
        { passId: evening.id, amount: "500 mg" },
        { time: "08:00", amount: "1000 mg" },
      ],
    };
    expect(await schedule()).toEqual(kept);
    // The device's own rewrite, flagged, from its stale copy: the schedule is dropped, the edit stays.
    const rewrite = {
      op: "PATCH" as const,
      table: "medication",
      id: medication!.id,
      data: { schedule: JSON.stringify(stale), updated_at: MOVED_AT, updated_by: "ignored" },
      metadata: PASS_REWRITE_METADATA,
    };
    expect((await upload(owner.api, [rewrite])).map((r) => r.status)).toEqual(["applied"]);
    expect(await schedule()).toEqual(kept);
    // Unflagged, a schedule PATCH is a member's edit and applies as ever.
    expect((await upload(owner.api, [{ ...rewrite, metadata: undefined }])).map((r) => r.status)).toEqual([
      "applied",
    ]);
    expect(await schedule()).toEqual(stale);
  });

  it("refuses a viewer and a moved group", async () => {
    const { owner, viewer, group, recipient, morning } = await setup();
    expect(
      await outcomes(viewer.api, [
        putOp("medication_pass", randomUUID(), passRow(group.id, recipient.id)),
        patchOp("medication_pass", morning.id, { name: "Breakfast" }),
      ]),
    ).toEqual(["permissions:unauthorized", "permissions:unauthorized"]);
    expect(
      await outcomes(owner.api, [patchOp("medication_pass", morning.id, { group_id: randomUUID() })]),
    ).toEqual(["medicationPassService:immutable"]);
  });
});

describe("sync.upload: recipient_allergy", () => {
  it("applies a device's allergy, edit and soft delete; refuses a viewer", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const id = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "recipient_allergy", id, data: allergyRow(group.id, recipient.id) },
        { op: "PATCH", table: "recipient_allergy", id, data: { severity: "moderate", reaction: "" } },
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(ok(await recipientAllergyService.getById(viewer.ctx, id))).toMatchObject({
      substance: "Penicillin",
      reaction: null,
      severity: "moderate",
      createdBy: owner.user.id,
    });

    const refused = await viewer.api.sync.upload({
      ops: [
        { op: "PUT", table: "recipient_allergy", id: randomUUID(), data: allergyRow(group.id, recipient.id) },
        { op: "PATCH", table: "recipient_allergy", id, data: { group_id: randomUUID() } },
      ],
    });
    expect(refused.results.map((r) => r.status)).toEqual(["rejected", "rejected"]);

    const removed = await owner.api.sync.upload({
      ops: [{ op: "PATCH", table: "recipient_allergy", id, data: { deleted_at: MOVED_AT } }],
    });
    expect(removed.results).toEqual([{ id, status: "applied" }]);
    expect(ok(await recipientAllergyService.getById(viewer.ctx, id))).toBeNull();
    // A replayed delete is fine.
    expect(await upload(owner.api, [{ op: "DELETE", table: "recipient_allergy", id }])).toEqual([
      { id, status: "applied" },
    ]);
  });
});

describe("sync.upload: care_recipient (No known allergies)", () => {
  const noKnownOf = async (recipientId: string, ctx: Parameters<typeof careRecipientService.getById>[0]) =>
    ok(await careRecipientService.getById(ctx, recipientId))?.noKnownAllergiesAt ?? null;

  it("sets No known allergies, and refuses other columns, other ops and viewers", async () => {
    const { owner, viewer, recipient } = await setup();
    const set = await owner.api.sync.upload({
      ops: [
        { op: "PATCH", table: "care_recipient", id: recipient.id, data: { no_known_allergies_at: MOVED_AT } },
      ],
    });
    expect(set.results).toEqual([{ id: recipient.id, status: "applied" }]);
    expect(await noKnownOf(recipient.id, viewer.ctx)).toMatch(/^2026-11-18/);

    const refused = await owner.api.sync.upload({
      ops: [
        { op: "PATCH", table: "care_recipient", id: recipient.id, data: { name: "Someone else" } },
        {
          op: "PATCH",
          table: "care_recipient",
          id: recipient.id,
          data: { no_known_allergies_at: null, name: "Someone else" },
        },
        { op: "PUT", table: "care_recipient", id: recipient.id, data: { no_known_allergies_at: null } },
        { op: "DELETE", table: "care_recipient", id: recipient.id },
      ],
    });
    expect(refused.results.map((r) => r.status === "rejected" && r.code)).toEqual([
      "sync:readOnlyTable",
      "sync:readOnlyTable",
      "sync:readOnlyTable",
      "sync:readOnlyTable",
    ]);
    expect(ok(await careRecipientService.getById(viewer.ctx, recipient.id))?.name).toBe(recipient.name);

    const byViewer = await viewer.api.sync.upload({
      ops: [
        { op: "PATCH", table: "care_recipient", id: recipient.id, data: { no_known_allergies_at: null } },
      ],
    });
    expect(byViewer.results[0]?.status).toBe("rejected");
    expect(await noKnownOf(recipient.id, viewer.ctx)).not.toBeNull();
  });
});
