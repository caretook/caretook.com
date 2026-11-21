import type { AuthUser, MedicationChangeDetails } from "@caretook/data";

import {
  medicationChangeId,
  medicationService,
  noteDocumentService,
  providerService,
  timelineEntryService,
} from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { router } from ".";

// sync.upload for the medication list: rows as a device's SQLite holds them
// (snake_case, JSON as text, dates as "YYYY-MM-DD"), and the change entries
// a device writes with them. Each test makes its own users and group.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  /** The group's change entries for a medication, oldest first. */
  const changesOf = async (medicationId: string) => {
    const page = ok(
      await timelineEntryService.list(viewer.ctx, {
        groupId: group.id,
        kinds: ["medicationChange"],
        limit: 100,
      }),
    );
    return page.data
      .filter((e) => (e.details as MedicationChangeDetails).medicationId === medicationId)
      .reverse();
  };
  return {
    group,
    recipient,
    changesOf,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
  };
};

const SAVED_AT = "2026-11-17T21:45:25.229000Z";
const EDITED_AT = "2026-11-18T09:00:00.000000Z";

const medicationRow = (groupId: string, recipientId: string, overrides: Record<string, unknown> = {}) => ({
  group_id: groupId,
  recipient_id: recipientId,
  name: "Lisinopril",
  strength: "10 mg",
  form: "tablet",
  dose: "1 tablet",
  directions: null,
  reason: "Blood pressure",
  schedule: JSON.stringify({ type: "scheduled", times: ["08:00"] }),
  status: "current",
  started_on: "2026-11-01",
  stopped_on: null,
  stop_reason: null,
  stop_note: null,
  prescriber_id: null,
  pharmacy_id: null,
  last_filled_on: null,
  quantity: null,
  refills_left: 2,
  rx_number: null,
  deleted_at: null,
  created_at: SAVED_AT,
  updated_at: SAVED_AT,
  created_by: "ignored",
  updated_by: "ignored",
  ...overrides,
});

/** The change entry a device writes beside the medication, as its SQLite row. */
const changeRow = (
  groupId: string,
  recipientId: string,
  medicationId: string,
  at: string,
  change: Record<string, unknown>,
) => ({
  op: "PUT" as const,
  table: "timeline_entry",
  id: medicationChangeId(medicationId, at),
  data: {
    group_id: groupId,
    recipient_id: recipientId,
    kind: "medicationChange",
    occurred_at: at,
    time_zone: "America/Los_Angeles",
    title: null,
    body: null,
    details: JSON.stringify({ medicationId, ...change }),
  },
});

describe("sync.upload: medication", () => {
  it("applies a device's insert, edits and soft delete, and replays safely", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "medication", id, data: medicationRow(group.id, recipient.id) };
    const patch = {
      op: "PATCH" as const,
      table: "medication",
      id,
      data: {
        schedule: JSON.stringify({ type: "scheduled", times: ["20:00", "08:00"] }),
        refills_left: 1,
        last_filled_on: "2026-11-17",
        updated_at: EDITED_AT,
      },
    };

    const res = await owner.api.sync.upload({ ops: [put, patch] });
    expect(res.results).toEqual([
      { id, status: "applied" },
      { id, status: "applied" },
    ]);
    expect(ok(await medicationService.getById(viewer.ctx, id))).toMatchObject({
      name: "Lisinopril",
      recipientId: recipient.id,
      // Uploaded in the old shape (an older build's), stored as slots.
      schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
      startedOn: "2026-11-01",
      refillsLeft: 1,
      lastFilledOn: "2026-11-17",
      createdBy: owner.user.id,
    });
    expect(
      (await owner.api.sync.upload({ ops: [put, patch] })).results.every((r) => r.status === "applied"),
    ).toBe(true);

    const remove = { op: "PATCH" as const, table: "medication", id, data: { deleted_at: EDITED_AT } };
    expect((await owner.api.sync.upload({ ops: [remove] })).results).toEqual([{ id, status: "applied" }]);
    expect(await medicationService.getById(viewer.ctx, id)).toBeNull();
    // A late edit doesn't bring it back; deleting again is a replay.
    const late = { op: "PATCH" as const, table: "medication", id, data: { name: "Back" } };
    expect((await owner.api.sync.upload({ ops: [late] })).results[0]).toMatchObject({
      status: "rejected",
      code: "medicationService:notFound",
    });
    expect(
      (await owner.api.sync.upload({ ops: [{ op: "DELETE", table: "medication", id }] })).results,
    ).toEqual([{ id, status: "applied" }]);
  });

  it("takes the type a device set, none from an older build, and refuses an unknown one; no entry for it", async () => {
    const { owner, viewer, group, recipient, changesOf } = await setup();
    const typed = randomUUID();
    const older = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "medication",
          id: typed,
          data: medicationRow(group.id, recipient.id, { name: "Vitamin D3", type: "supplement" }),
        },
        // A build from before types: no `type` column at all.
        { op: "PUT", table: "medication", id: older, data: medicationRow(group.id, recipient.id) },
        { op: "PATCH", table: "medication", id: older, data: { type: "otc", updated_at: EDITED_AT } },
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
    expect(ok(await medicationService.getById(viewer.ctx, typed))?.type).toBe("supplement");
    expect(ok(await medicationService.getById(viewer.ctx, older))?.type).toBe("otc");
    // Setting the type is not a change the timeline records.
    expect((await changesOf(older)).map((c) => (c.details as MedicationChangeDetails).change)).toEqual([
      "started",
    ]);

    const cleared = await owner.api.sync.upload({
      ops: [{ op: "PATCH", table: "medication", id: typed, data: { type: null, updated_at: EDITED_AT } }],
    });
    expect(cleared.results).toEqual([{ id: typed, status: "applied" }]);
    expect(ok(await medicationService.getById(viewer.ctx, typed))?.type).toBeNull();

    const bad = await owner.api.sync.upload({
      ops: [
        { op: "PATCH", table: "medication", id: older, data: { type: "vitamin", updated_at: EDITED_AT } },
      ],
    });
    expect(bad.results[0]).toMatchObject({ status: "rejected", code: "medicationService:invalid" });
    expect(ok(await medicationService.getById(viewer.ctx, older))?.type).toBe("otc");
  });

  it("handles a medication created and deleted before it uploaded, and a DELETE", async () => {
    const { owner, group, recipient } = await setup();
    const id = randomUUID();
    const data = medicationRow(group.id, recipient.id, { deleted_at: EDITED_AT });
    expect(
      (await owner.api.sync.upload({ ops: [{ op: "PUT", table: "medication", id, data }] })).results,
    ).toEqual([{ id, status: "applied" }]);
    expect(await medicationService.getById(owner.ctx, id)).toBeNull();
    expect(
      ok(await medicationService.getById(owner.ctx, id, { includeDeleted: true }))?.deletedAt,
    ).not.toBeNull();

    const other = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "medication", id: other, data: medicationRow(group.id, recipient.id) },
        { op: "DELETE", table: "medication", id: other },
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(await medicationService.getById(owner.ctx, other)).toBeNull();
  });

  it("stops and restarts a medication from the columns a device changed", async () => {
    const { owner, group, recipient } = await setup();
    const id = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "medication", id, data: medicationRow(group.id, recipient.id) },
        {
          op: "PATCH",
          table: "medication",
          id,
          data: {
            status: "discontinued",
            stopped_on: "2026-11-18",
            stop_reason: "sideEffects",
            updated_at: EDITED_AT,
          },
        },
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(ok(await medicationService.getById(owner.ctx, id))).toMatchObject({
      status: "discontinued",
      stoppedOn: "2026-11-18",
      stopReason: "sideEffects",
    });

    // Discontinued with no reason is refused, with the field it's about.
    const noReason = await owner.api.sync.upload({
      ops: [{ op: "PATCH", table: "medication", id, data: { stop_reason: null } }],
    });
    expect(noReason.results[0]).toMatchObject({
      status: "rejected",
      code: "medicationService:invalid",
      issues: [{ path: "stopReason" }],
    });
  });

  it("never changes a medication's group or recipient, and refuses viewers and other groups", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const other = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "medication", id, data: medicationRow(group.id, recipient.id) };

    expect((await viewer.api.sync.upload({ ops: [put] })).results[0]).toMatchObject({
      status: "rejected",
      code: "permissions:unauthorized",
    });
    expect(await medicationService.getById(owner.ctx, id)).toBeNull();
    await owner.api.sync.upload({ ops: [put] });

    const results = (
      await owner.api.sync.upload({
        ops: [
          { op: "PATCH", table: "medication", id, data: { group_id: other.group.id } },
          { op: "PATCH", table: "medication", id, data: { recipient_id: other.recipient.id } },
          { ...put, data: medicationRow(other.group.id, other.recipient.id) },
        ],
      })
    ).results;
    expect(results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual([
      "medicationService:immutable",
      "medicationService:immutable",
      "medicationService:immutable",
    ]);
    // Someone in another group can't touch it, or learn that it exists.
    expect(
      (
        await other.owner.api.sync.upload({
          ops: [{ op: "PATCH", table: "medication", id, data: { name: "X" } }],
        })
      ).results[0],
    ).toMatchObject({ status: "rejected", code: "medicationService:notFound" });
    expect((await other.owner.api.sync.upload({ ops: [put] })).results[0]).toMatchObject({
      status: "rejected",
      code: "permissions:unauthorized",
    });
    expect(ok(await medicationService.getById(owner.ctx, id))).toMatchObject({
      groupId: group.id,
      name: "Lisinopril",
    });
  });

  it("checks the prescriber and pharmacy a device chose", async () => {
    const { owner, group, recipient } = await setup();
    const pharmacy = ok(
      await providerService.create(owner.ctx, {
        groupId: group.id,
        type: "pharmacy",
        name: "Corner Pharmacy",
      }),
    )!;
    const id = randomUUID();
    const bad = medicationRow(group.id, recipient.id, { prescriber_id: pharmacy.id });
    expect(
      (await owner.api.sync.upload({ ops: [{ op: "PUT", table: "medication", id, data: bad }] })).results[0],
    ).toMatchObject({ status: "rejected", code: "medicationService:badPrescriber" });
    const good = medicationRow(group.id, recipient.id, { pharmacy_id: pharmacy.id });
    expect(
      (await owner.api.sync.upload({ ops: [{ op: "PUT", table: "medication", id, data: good }] })).results,
    ).toEqual([{ id, status: "applied" }]);
  });
});

describe("sync.upload: medication change entries", () => {
  it("ends as one entry when the device's change entry follows the medication", async () => {
    const { owner, group, recipient, changesOf } = await setup();
    const id = randomUUID();
    const ops = [
      { op: "PUT" as const, table: "medication", id, data: medicationRow(group.id, recipient.id) },
      changeRow(group.id, recipient.id, id, SAVED_AT, { change: "started", after: { name: "Lisinopril" } }),
      { op: "PATCH" as const, table: "medication", id, data: { dose: "2 tablets", updated_at: EDITED_AT } },
      changeRow(group.id, recipient.id, id, EDITED_AT, {
        change: "changed",
        fields: ["dose"],
        before: { dose: "1 tablet" },
        after: { dose: "2 tablets" },
      }),
    ];

    const res = await owner.api.sync.upload({ ops });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied", "applied"]);
    const changes = await changesOf(id);
    expect(changes.map((c) => c.id)).toEqual([
      medicationChangeId(id, SAVED_AT),
      medicationChangeId(id, EDITED_AT),
    ]);
    // The service's copy stands: it has every tracked field, not the device's shorter summary.
    expect(changes[0]).toMatchObject({
      createdBy: owner.user.id,
      details: { change: "started", after: { name: "Lisinopril", strength: "10 mg", dose: "1 tablet" } },
    });
    expect(changes[1]?.details).toMatchObject({
      change: "changed",
      fields: ["dose"],
      after: { dose: "2 tablets" },
    });

    // The whole batch again changes nothing.
    expect((await owner.api.sync.upload({ ops })).results.every((r) => r.status === "applied")).toBe(true);
    expect(await changesOf(id)).toHaveLength(2);
  });

  it("ends as one entry when the device's change entry comes before the medication", async () => {
    const { owner, group, recipient, changesOf } = await setup();
    const id = randomUUID();
    const entry = changeRow(group.id, recipient.id, id, SAVED_AT, {
      change: "started",
      after: { name: "Lisinopril" },
    });
    const put = { op: "PUT" as const, table: "medication", id, data: medicationRow(group.id, recipient.id) };

    const res = await owner.api.sync.upload({ ops: [entry, put] });
    // Nobody writes a change entry by hand: the service writes it with the medication.
    expect(res.results[0]).toMatchObject({
      status: "rejected",
      code: "timelineEntryService:systemWrittenKind",
    });
    expect(res.results[1]).toEqual({ id, status: "applied" });
    const changes = await changesOf(id);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.id).toBe(entry.id);
  });

  it("writes no entry for a refill edit, and drops a change entry whose medication was refused", async () => {
    const { owner, viewer, group, recipient, changesOf } = await setup();
    const id = randomUUID();
    await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "medication", id, data: medicationRow(group.id, recipient.id) },
        {
          op: "PATCH",
          table: "medication",
          id,
          data: { refills_left: 0, quantity: "30 tablets", updated_at: EDITED_AT },
        },
      ],
    });
    expect(await changesOf(id)).toHaveLength(1);

    const refused = randomUUID();
    const res = await viewer.api.sync.upload({
      ops: [
        { op: "PUT", table: "medication", id: refused, data: medicationRow(group.id, recipient.id) },
        changeRow(group.id, recipient.id, refused, SAVED_AT, { change: "started" }),
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(await changesOf(refused)).toHaveLength(0);
  });

  it("lets a device delete a change entry, as a correction", async () => {
    const { owner, group, recipient, changesOf } = await setup();
    const id = randomUUID();
    await owner.api.sync.upload({
      ops: [{ op: "PUT", table: "medication", id, data: medicationRow(group.id, recipient.id) }],
    });
    const entryId = medicationChangeId(id, SAVED_AT);
    const res = await owner.api.sync.upload({
      ops: [{ op: "PATCH", table: "timeline_entry", id: entryId, data: { deleted_at: EDITED_AT } }],
    });
    expect(res.results).toEqual([{ id: entryId, status: "applied" }]);
    expect(await changesOf(id)).toHaveLength(0);
    expect(ok(await medicationService.getById(owner.ctx, id))).toMatchObject({ status: "current" });
  });

  // medications.mjs's offline form steps (check-migration slice 9): what the
  // add sheet, the edit sheet and Discontinue queue offline, uploaded together.
  it("takes an offline add with a new prescriber, an edit and a discontinue as one batch: the prescriber linked, one entry each", async () => {
    const { owner, group, recipient, changesOf } = await setup();
    const id = randomUUID();
    const prescriberId = randomUUID();
    const STOPPED_AT = "2026-11-18T10:00:00.000000Z";
    const ops = [
      {
        op: "PUT" as const,
        table: "provider",
        id: prescriberId,
        data: {
          group_id: group.id,
          type: "clinician",
          name: "Dr. Ada Moss",
          specialty: null,
          practice_id: null,
          phones: "[]",
          email: null,
          address: null,
          website: null,
          status: "current",
          is_primary: 0,
          deleted_at: null,
          created_by: "ignored",
        },
      },
      {
        op: "PUT" as const,
        table: "medication",
        id,
        data: medicationRow(group.id, recipient.id, { name: "Albuterol", prescriber_id: prescriberId }),
      },
      changeRow(group.id, recipient.id, id, SAVED_AT, { change: "started", after: { name: "Albuterol" } }),
      { op: "PATCH" as const, table: "medication", id, data: { dose: "2 puffs", updated_at: EDITED_AT } },
      changeRow(group.id, recipient.id, id, EDITED_AT, {
        change: "changed",
        fields: ["dose"],
        before: { dose: "1 tablet" },
        after: { dose: "2 puffs" },
      }),
      {
        op: "PATCH" as const,
        table: "medication",
        id,
        data: {
          status: "discontinued",
          stopped_on: "2026-11-18",
          stop_reason: "ineffective",
          updated_at: STOPPED_AT,
        },
      },
      changeRow(group.id, recipient.id, id, STOPPED_AT, {
        change: "stopped",
        stopStatus: "discontinued",
        stopReason: "ineffective",
      }),
    ];

    const res = await owner.api.sync.upload({ ops });
    expect(res.results.map((r) => r.status)).toEqual(Array(ops.length).fill("applied"));
    expect(ok(await medicationService.getById(owner.ctx, id))).toMatchObject({
      name: "Albuterol",
      dose: "2 puffs",
      status: "discontinued",
      stopReason: "ineffective",
      prescriberId,
    });
    expect(ok(await providerService.getById(owner.ctx, prescriberId))).toMatchObject({
      name: "Dr. Ada Moss",
      type: "clinician",
    });
    const changes = await changesOf(id);
    expect(changes.map((c) => (c.details as MedicationChangeDetails).change)).toEqual([
      "started",
      "changed",
      "stopped",
    ]);
    expect(changes.map((c) => c.id)).toEqual(
      [SAVED_AT, EDITED_AT, STOPPED_AT].map((at) => medicationChangeId(id, at)),
    );
  });
});

describe("sync.upload: doses and medication notes", () => {
  it("applies a device's dose, its edit and its delete, and refuses another group's medication", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const other = await setup();
    const medicationId = randomUUID();
    const theirs = randomUUID();
    await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "medication", id: medicationId, data: medicationRow(group.id, recipient.id) },
      ],
    });
    await other.owner.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "medication",
          id: theirs,
          data: medicationRow(other.group.id, other.recipient.id),
        },
      ],
    });

    const doseRow = (medication: string, details: Record<string, unknown> = {}) => ({
      group_id: group.id,
      recipient_id: recipient.id,
      kind: "dose",
      occurred_at: "2026-11-18T16:05:00.000000Z",
      time_zone: "America/Los_Angeles",
      title: null,
      body: null,
      details: JSON.stringify({ medicationId: medication, status: "given", amount: "1 tablet", ...details }),
    });
    const id = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry", id, data: doseRow(medicationId, { scheduledFor: "08:00" }) },
        {
          op: "PATCH",
          table: "timeline_entry",
          id,
          data: { details: JSON.stringify({ medicationId, status: "skipped", note: "Asleep" }) },
        },
        { op: "PUT", table: "timeline_entry", id: randomUUID(), data: doseRow(theirs) },
      ],
    });
    expect(res.results.map((r) => (r.status === "rejected" ? r.code : r.status))).toEqual([
      "applied",
      "applied",
      "timelineEntryService:medicationNotInGroup",
    ]);
    expect(ok(await timelineEntryService.getById(viewer.ctx, id))).toMatchObject({
      kind: "dose",
      details: { medicationId, status: "skipped", note: "Asleep" },
      createdBy: owner.user.id,
    });

    await owner.api.sync.upload({
      ops: [{ op: "PATCH", table: "timeline_entry", id, data: { deleted_at: EDITED_AT } }],
    });
    expect(await timelineEntryService.getById(viewer.ctx, id)).toBeNull();
  });

  it("keeps a Given all round's pass and round ids, and its Undo removes exactly those doses", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const meds = [randomUUID(), randomUUID(), randomUUID()];
    await owner.api.sync.upload({
      ops: meds.map((id) => ({
        op: "PUT" as const,
        table: "medication",
        id,
        data: medicationRow(group.id, recipient.id),
      })),
    });
    const passId = randomUUID();
    const passLogId = randomUUID();
    const dose = (medicationId: string, status = "given") => ({
      group_id: group.id,
      recipient_id: recipient.id,
      kind: "dose",
      occurred_at: "2026-11-18T16:05:00.000000Z",
      time_zone: "America/Los_Angeles",
      title: null,
      body: null,
      details: JSON.stringify({ medicationId, status, scheduledFor: "08:00", passId, passLogId }),
    });
    // One refused earlier, then Given all for the other two, in the same round.
    const ids = meds.map(() => randomUUID());
    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry", id: ids[0]!, data: dose(meds[0]!, "refused") },
        { op: "PUT", table: "timeline_entry", id: ids[1]!, data: dose(meds[1]!) },
        { op: "PUT", table: "timeline_entry", id: ids[2]!, data: dose(meds[2]!) },
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
    for (const id of ids)
      expect(ok(await timelineEntryService.getById(viewer.ctx, id))).toMatchObject({
        details: { passId, passLogId, scheduledFor: "08:00" },
      });

    // Undo: the device soft-deletes exactly Given all's two.
    await owner.api.sync.upload({
      ops: ids.slice(1).map((id) => ({
        op: "PATCH" as const,
        table: "timeline_entry",
        id,
        data: { deleted_at: EDITED_AT },
      })),
    });
    expect(await timelineEntryService.getById(viewer.ctx, ids[0]!)).not.toBeNull();
    for (const id of ids.slice(1)) expect(await timelineEntryService.getById(viewer.ctx, id)).toBeNull();
  });

  it("creates a medication's document from a device", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const id = randomUUID();
    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "medication", id, data: medicationRow(group.id, recipient.id) },
        {
          op: "PUT",
          table: "note_document",
          id,
          data: {
            group_id: group.id,
            subject: "medication",
            medication_id: id,
            entry_id: null,
            provider_id: null,
          },
        },
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(ok(await noteDocumentService.getById(viewer.ctx, id))).toMatchObject({
      subject: "medication",
      medicationId: id,
    });
  });
});
