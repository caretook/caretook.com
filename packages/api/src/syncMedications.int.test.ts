import type { MedicationChangeDetails } from "@caretook/data";

import {
  doseSlotIdFor,
  dueDoses,
  medicationChangeId,
  medicationService,
  noteDocumentService,
  OWN_DOSE_COPY_METADATA,
  providerService,
  timelineEntryService,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor, sqliteTime, upload } from "./testing";

// sync.upload for the medication list: rows as a device's SQLite holds them
// (snake_case, JSON as text, dates as "YYYY-MM-DD"), and the change entries
// a device writes with them. Each test makes its own users and group.

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
    expect((await upload(owner.api, [put, patch])).every((r) => r.status === "applied")).toBe(true);

    const remove = { op: "PATCH" as const, table: "medication", id, data: { deleted_at: EDITED_AT } };
    expect(await upload(owner.api, [remove])).toEqual([{ id, status: "applied" }]);
    expect(await medicationService.getById(viewer.ctx, id)).toBeNull();
    // A late edit doesn't bring it back; deleting again is a replay.
    const late = { op: "PATCH" as const, table: "medication", id, data: { name: "Back" } };
    expect((await upload(owner.api, [late]))[0]).toMatchObject({
      status: "rejected",
      code: "medicationService:notFound",
    });
    expect(await upload(owner.api, [{ op: "DELETE", table: "medication", id }])).toEqual([
      { id, status: "applied" },
    ]);
  });

  it("takes the type a device set, and none from an older build; no entry for it", async () => {
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
  });

  it("handles a medication created and deleted before it uploaded, and a DELETE", async () => {
    const { owner, group, recipient } = await setup();
    const id = randomUUID();
    const data = medicationRow(group.id, recipient.id, { deleted_at: EDITED_AT });
    expect(await upload(owner.api, [{ op: "PUT", table: "medication", id, data }])).toEqual([
      { id, status: "applied" },
    ]);
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

  it("never changes a medication's group or recipient, and refuses viewers", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const other = await setup();
    const id = randomUUID();
    const put = { op: "PUT" as const, table: "medication", id, data: medicationRow(group.id, recipient.id) };

    expect((await upload(viewer.api, [put]))[0]).toMatchObject({
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
    expect(ok(await medicationService.getById(owner.ctx, id))).toMatchObject({
      groupId: group.id,
      name: "Lisinopril",
    });
  });

  it("takes the pharmacy a device chose", async () => {
    const { owner, group, recipient } = await setup();
    const pharmacy = ok(
      await providerService.create(owner.ctx, {
        groupId: group.id,
        type: "pharmacy",
        name: "Corner Pharmacy",
      }),
    )!;
    const id = randomUUID();
    const good = medicationRow(group.id, recipient.id, { pharmacy_id: pharmacy.id });
    expect(await upload(owner.api, [{ op: "PUT", table: "medication", id, data: good }])).toEqual([
      { id, status: "applied" },
    ]);
    expect(ok(await medicationService.getById(owner.ctx, id))?.pharmacyId).toBe(pharmacy.id);
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
    expect((await upload(owner.api, ops)).every((r) => r.status === "applied")).toBe(true);
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

  it("takes the Dose sheet's quick add (a medication, its Started entry and a dose, offline) as one batch, and a replay", async () => {
    const { owner, viewer, group, recipient, changesOf } = await setup();
    const id = randomUUID();
    const doseId = randomUUID();
    // As `logDoseOfNewMedication` writes them, in its one transaction's order.
    const ops = [
      {
        op: "PUT" as const,
        table: "medication",
        id,
        data: medicationRow(group.id, recipient.id, {
          name: "Ibuprofen",
          strength: null,
          form: null,
          dose: "2 tablets",
          reason: null,
          schedule: JSON.stringify({ type: "asNeeded" }),
          started_on: null,
          refills_left: null,
          type: "otc",
        }),
      },
      changeRow(group.id, recipient.id, id, SAVED_AT, {
        change: "started",
        after: { name: "Ibuprofen", dose: "2 tablets", schedule: { type: "asNeeded" } },
      }),
      {
        op: "PUT" as const,
        table: "timeline_entry",
        id: doseId,
        data: {
          group_id: group.id,
          recipient_id: recipient.id,
          kind: "dose",
          occurred_at: "2026-11-17T21:40:00.000000Z",
          time_zone: "America/Los_Angeles",
          title: null,
          body: null,
          details: JSON.stringify({
            medicationId: id,
            status: "given",
            amount: "2 tablets",
            note: "Headache",
          }),
        },
      },
    ];

    for (let run = 0; run < 2; run++) {
      const res = await owner.api.sync.upload({ ops });
      expect(res.results).toEqual(ops.map((o) => ({ id: o.id, status: "applied" })));
    }
    expect(ok(await medicationService.getById(viewer.ctx, id))).toMatchObject({
      name: "Ibuprofen",
      dose: "2 tablets",
      type: "otc",
      status: "current",
      schedule: { type: "asNeeded" },
    });
    const changes = await changesOf(id);
    expect(changes.map((c) => [c.id, (c.details as MedicationChangeDetails).change])).toEqual([
      [medicationChangeId(id, SAVED_AT), "started"],
    ]);
    expect(ok(await timelineEntryService.getById(viewer.ctx, doseId))).toMatchObject({
      kind: "dose",
      details: { medicationId: id, status: "given", amount: "2 tablets", note: "Headache" },
      createdBy: owner.user.id,
    });
  });
});

describe("sync.upload: doses and medication notes", () => {
  it("applies a device's dose, its edit and its delete", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const medicationId = randomUUID();
    await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "medication", id: medicationId, data: medicationRow(group.id, recipient.id) },
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
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied"]);
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

describe("sync.upload: two members' doses for one slot", () => {
  const TZ = "America/Los_Angeles";

  const doseSetup = async (slots: { time: string }[] = [{ time: "08:00" }]) => {
    const owner = await createUser("owner");
    const caretaker = await createUser("caretaker");
    const { group, recipient } = await createGroup(owner, [{ user: caretaker.user, role: "caretaker" }]);
    const medication = ok(
      await medicationService.create(owner.ctx, {
        groupId: group.id,
        name: "Metformin",
        strength: "500 mg",
        schedule: { type: "scheduled", slots },
      }),
    )!;
    const put = (status: "given" | "skipped", occurredAt: string, note: string, scheduledFor = "08:00") => {
      const details = { medicationId: medication.id, status, scheduledFor, note };
      return {
        op: "PUT" as const,
        table: "timeline_entry",
        id: doseSlotIdFor({ ...details, occurredAt }, { timeZone: TZ })!,
        data: {
          group_id: group.id,
          recipient_id: recipient.id,
          kind: "dose",
          occurred_at: occurredAt,
          time_zone: TZ,
          title: null,
          body: null,
          details: JSON.stringify(details),
          deleted_at: null,
        },
      };
    };
    const doses = async () =>
      ok(await timelineEntryService.list(owner.ctx, { groupId: group.id, kinds: ["dose"], limit: 50 })).data;
    return {
      medication,
      put,
      doses,
      owner: { ...owner, api: clientFor(owner.ctx.authUser) },
      caretaker: { ...caretaker, api: clientFor(caretaker.ctx.authUser) },
    };
  };

  it("keeps one row, the first upload's, for the same answer", async () => {
    const { put, doses, owner, caretaker } = await doseSetup();
    const first = put("given", sqliteTime(-60_000), "from the first phone");
    const second = { ...put("given", first.data.occurred_at, "from the second phone"), id: first.id };

    expect(await upload(caretaker.api, [first])).toEqual([{ id: first.id, status: "applied" }]);
    expect(await upload(owner.api, [second])).toEqual([{ id: first.id, status: "applied" }]);

    const rows = await doses();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: first.id,
      createdBy: caretaker.user.id,
      details: { note: "from the first phone" },
    });
  });

  const undoPatch = (id: string, by: string, metadata?: string) => ({
    op: "PATCH" as const,
    table: "timeline_entry",
    id,
    data: { deleted_at: sqliteTime(0), updated_at: sqliteTime(0), updated_by: by },
    ...(metadata ? { metadata } : {}),
  });

  it("keeps A's dose when B's offline log and Undo upload as a PUT and a flagged PATCH", async () => {
    const { put, doses, owner, caretaker } = await doseSetup();
    const first = put("given", sqliteTime(-60_000), "A's dose");
    await upload(caretaker.api, [first]);

    const results = await upload(owner.api, [
      { ...put("given", first.data.occurred_at, "B's tap"), id: first.id },
      undoPatch(first.id, owner.user.id, OWN_DOSE_COPY_METADATA),
    ]);

    expect(results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(await doses()).toMatchObject([
      { id: first.id, createdBy: caretaker.user.id, deletedAt: null, details: { note: "A's dose" } },
    ]);
  });

  it("keeps A's dose when B's log and Undo upload as one PUT with deleted_at", async () => {
    const { put, doses, owner, caretaker } = await doseSetup();
    const first = put("given", sqliteTime(-60_000), "A's dose");
    await upload(caretaker.api, [first]);
    const undone = { ...put("given", first.data.occurred_at, "B's tap"), id: first.id };

    const results = await upload(owner.api, [
      { ...undone, data: { ...undone.data, deleted_at: sqliteTime(0) } },
    ]);

    expect(results).toEqual([{ id: first.id, status: "applied" }]);
    expect(await doses()).toMatchObject([
      { id: first.id, createdBy: caretaker.user.id, deletedAt: null, details: { note: "A's dose" } },
    ]);
  });

  it("leaves A's row alone on B's offline edit after a duplicate PUT", async () => {
    const { put, doses, owner, caretaker } = await doseSetup();
    const first = put("given", sqliteTime(-60_000), "A's dose");
    await upload(caretaker.api, [first]);
    const edited = JSON.stringify({ ...JSON.parse(first.data.details), note: "B's edit" });

    const results = await upload(owner.api, [
      { ...put("given", first.data.occurred_at, "B's tap"), id: first.id },
      {
        op: "PATCH" as const,
        table: "timeline_entry",
        id: first.id,
        data: { details: edited, updated_at: sqliteTime(0), updated_by: owner.user.id },
        metadata: OWN_DOSE_COPY_METADATA,
      },
    ]);

    expect(results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect((await doses())[0]).toMatchObject({ createdBy: caretaker.user.id, details: { note: "A's dose" } });
  });

  it("removes the shared dose on a deliberate Undo of a row synced to the device", async () => {
    const { put, doses, owner, caretaker } = await doseSetup();
    const first = put("given", sqliteTime(-60_000), "A's dose");
    await upload(caretaker.api, [first]);

    expect(await upload(owner.api, [undoPatch(first.id, owner.user.id)])).toEqual([
      { id: first.id, status: "applied" },
    ]);

    expect(await doses()).toEqual([]);
  });

  it("lets two simultaneous first uploads of one id both succeed, leaving one row", async () => {
    const { put, doses, owner, caretaker } = await doseSetup();
    const first = put("given", sqliteTime(-60_000), "one phone");
    const second = { ...put("given", first.data.occurred_at, "other phone"), id: first.id };

    const results = await Promise.all([upload(caretaker.api, [first]), upload(owner.api, [second])]);

    expect(results.flat().map((r) => r.status)).toEqual(["applied", "applied"]);
    const rows = await doses();
    expect(rows).toHaveLength(1);
    const winner = rows[0]!.createdBy === caretaker.user.id ? "one phone" : "other phone";
    expect(rows[0]).toMatchObject({ details: { note: winner } });
  });

  it("keeps Given and Skipped as two rows, and the earlier reads the slot", async () => {
    const { medication, put, doses, owner, caretaker } = await doseSetup();
    const earlier = sqliteTime(-120_000);
    const given = put("given", earlier, "gave it");
    const skipped = put("skipped", sqliteTime(-60_000), "thought it was missed");
    expect(skipped.id).not.toBe(given.id);

    await upload(caretaker.api, [skipped]);
    await upload(owner.api, [given]);

    const rows = await doses();
    expect(rows).toHaveLength(2);
    const due = dueDoses({
      medications: [{ ...medication, createdAt: "2020-01-01T00:00:00.000Z", startedOn: null }],
      doses: rows.map((row) => ({
        id: row.id,
        occurredAt: new Date(row.occurredAt).toISOString(),
        details: row.details as never,
        createdBy: row.createdBy,
      })),
      now: new Date(),
      timeZone: "UTC",
      windowMinutes: 24 * 60,
    });
    expect(due.slots.find((slot) => slot.dose)?.dose?.id).toBe(given.id);
  });

  it("keeps a slot id for a dose naming a slot the medication no longer has", async () => {
    // Two devices that hadn't synced the edit gave the same dose: the id is
    // what each named when it was given, so they still converge on one row.
    const { put, doses, owner, caretaker } = await doseSetup([{ time: "20:00" }]);
    const occurredAt = sqliteTime(-60_000);
    const first = put("given", occurredAt, "from the first phone");
    const second = put("given", occurredAt, "from the second phone");
    expect(second.id).toBe(first.id);

    await upload(caretaker.api, [first]);
    await upload(owner.api, [second]);

    const rows = await doses();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      createdBy: caretaker.user.id,
      details: { note: "from the first phone" },
    });
  });
});
