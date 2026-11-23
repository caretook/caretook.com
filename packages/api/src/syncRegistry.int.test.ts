import type { AuthUser } from "@caretook/data";

import {
  appointmentSeriesService,
  carePeriodService,
  medicationPassService,
  medicationService,
  providerService,
  recipientAllergyService,
  recipientConditionService,
  timelineEntryService,
  todoService,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { clientFor, deleteOp, outcomes, patchOp, putOp, upload } from "./testing";

// The upload registry (sync-safety slice 1): one answer per situation on
// every soft-delete table, and lookups by the registry's own keys only.
// Rows as a device's SQLite holds them. Each test makes its own users and group.

const AT = "2026-11-17T21:45:25.229000Z";

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  return {
    group,
    recipient,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
  };
};

type Ctx = { authUser: AuthUser };
type Read = (ctx: Ctx, id: string) => Promise<unknown>;

/** A soft-delete table: a device's row, a content PATCH, and a read that includes deleted rows. */
type Case = {
  table: string;
  row: (groupId: string, recipientId: string) => Record<string, unknown>;
  patch: Record<string, unknown>;
  read: Read;
  /** What a viewer's content PATCH gets, when the service has a more specific reason. */
  patchCode?: string;
  /** The viewer's new row, where a copy of the first would clash with it (a pass's name). */
  fresh?: Record<string, unknown>;
};

const audits = {
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
  created_by: "ignored",
  updated_by: "ignored",
};

const CASES: Case[] = [
  {
    table: "timeline_entry",
    row: (group_id, recipient_id) => ({
      group_id,
      recipient_id,
      kind: "symptom",
      occurred_at: AT,
      time_zone: "America/Los_Angeles",
      title: null,
      body: null,
      details: JSON.stringify({ name: "Cough", severity: 2 }),
      ...audits,
    }),
    patch: { details: JSON.stringify({ name: "Cough", severity: 4 }) },
    read: (ctx, id) => timelineEntryService.getById(ctx, id, { includeDeleted: true }),
  },
  {
    table: "provider",
    row: (group_id) => ({
      group_id,
      type: "clinician",
      name: "Dr. Fictional",
      specialty: "Cardiology",
      practice_id: null,
      phones: JSON.stringify([{ label: "Office", number: "(555) 010-3300" }]),
      email: null,
      address: null,
      website: null,
      status: "current",
      is_primary: 0,
      ...audits,
    }),
    patch: { name: "Dr. Renamed" },
    read: (ctx, id) => providerService.getById(ctx, id, { includeDeleted: true }),
  },
  {
    table: "medication",
    row: (group_id, recipient_id) => ({
      group_id,
      recipient_id,
      name: "Lisinopril",
      strength: "10 mg",
      form: "tablet",
      dose: "1 tablet",
      directions: null,
      reason: null,
      schedule: JSON.stringify({ type: "scheduled", times: ["08:00"] }),
      status: "current",
      started_on: "2026-11-01",
      refills_left: 2,
      ...audits,
    }),
    patch: { dose: "2 tablets", updated_at: "2026-11-18T09:00:00.000000Z" },
    read: (ctx, id) => medicationService.getById(ctx, id, { includeDeleted: true }),
  },
  {
    table: "medication_pass",
    row: (group_id, recipient_id) => ({
      group_id,
      recipient_id,
      name: "Noon",
      time: "12:00",
      sort_order: 2,
      ...audits,
    }),
    fresh: { name: "Bedtime", time: "21:00" },
    patch: { time: "12:30", updated_at: "2026-11-18T09:00:00.000000Z" },
    read: (ctx, id) => medicationPassService.getById(ctx, id, { includeDeleted: true }),
  },
  {
    table: "recipient_allergy",
    row: (group_id, recipient_id) => ({
      group_id,
      recipient_id,
      substance: "Penicillin",
      reaction: "Hives",
      severity: "severe",
      ...audits,
    }),
    patch: { reaction: "Rash" },
    read: (ctx, id) => recipientAllergyService.getById(ctx, id, { includeDeleted: true }),
  },
  {
    table: "recipient_condition",
    row: (group_id, recipient_id) => ({
      group_id,
      recipient_id,
      name: "Type 2 diabetes",
      status: "active",
      since_year: 2016,
      since_month: 3,
      note: null,
      diagnosed_by_id: null,
      ...audits,
    }),
    patch: { note: "Diet-controlled", updated_at: "2026-11-18T09:00:00.000000Z" },
    read: (ctx, id) => recipientConditionService.getById(ctx, id, { includeDeleted: true }),
  },
  {
    table: "care_period",
    row: (group_id, recipient_id) => ({
      group_id,
      recipient_id,
      type: "hospital",
      label: "Mercy General",
      place_provider_id: null,
      place_detail: null,
      started_at: AT,
      date_only: 0,
      ...audits,
    }),
    patch: { label: "4 West" },
    read: (ctx, id) => carePeriodService.getById(ctx, id, { includeDeleted: true }),
  },
  {
    table: "todo",
    row: (group_id, recipient_id) => ({
      group_id,
      recipient_id,
      title: "Call the pharmacy",
      assignee_id: null,
      assignee_name: null,
      due_on: "2026-11-21",
      due_time: null,
      done_at: null,
      done_by: null,
      provider_id: null,
      medication_id: null,
      event_id: null,
      ...audits,
    }),
    patch: { title: "Mine now" },
    patchCode: "todoService:completionOnly",
    read: (ctx, id) => todoService.getById(ctx, id, { includeDeleted: true }),
  },
  {
    table: "appointment_series",
    row: (group_id, recipient_id) => ({
      group_id,
      recipient_id,
      kind: "event",
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      starts_on: "2026-11-23",
      start_time: "09:00",
      all_day: 0,
      time_zone: "America/Los_Angeles",
      title: "Physical therapy",
      duration_minutes: 60,
      place: null,
      provider_ids: "[]",
      topped_up_through: "2026-12-21",
      ...audits,
    }),
    patch: { title: "Physio" },
    read: (ctx, id) => appointmentSeriesService.getById(ctx, id, { includeDeleted: true }),
  },
];

describe("sync.upload: a viewer on every soft-delete table", () => {
  it.each(CASES)(
    "$table: PUT, PATCH and DELETE are refused as not allowed, and nothing changes",
    async ({ table, row, patch, read, patchCode, fresh: freshRow }) => {
      const { group, recipient, owner, viewer } = await setup();
      const id = randomUUID();
      expect(await outcomes(owner.api, [putOp(table, id, row(group.id, recipient.id))])).toEqual(["applied"]);
      const before = ok(await read(owner.ctx, id));
      expect(before).toBeTruthy();

      const fresh = randomUUID();
      expect(
        await outcomes(viewer.api, [
          putOp(table, fresh, { ...row(group.id, recipient.id), ...freshRow }),
          patchOp(table, id, patch),
          patchOp(table, id, { deleted_at: AT }),
          deleteOp(table, id),
        ]),
      ).toEqual([
        "permissions:unauthorized",
        patchCode ?? "permissions:unauthorized",
        "permissions:unauthorized",
        "permissions:unauthorized",
      ]);

      expect(ok(await read(owner.ctx, id))).toEqual(before);
      expect(await read(owner.ctx, fresh)).toBeNull();
    },
  );

  it("todo: a viewer's tick of their own todo is still applied", async () => {
    const { group, recipient, owner, viewer } = await setup();
    const id = randomUUID();
    const row = { ...CASES.find((c) => c.table === "todo")!.row(group.id, recipient.id) };
    expect(await outcomes(owner.api, [putOp("todo", id, { ...row, assignee_id: viewer.user.id })])).toEqual([
      "applied",
    ]);
    expect(
      await outcomes(viewer.api, [patchOp("todo", id, { done_at: AT, done_by: viewer.user.id })]),
    ).toEqual(["applied"]);
    expect(ok(await todoService.getById(owner.ctx, id))).toMatchObject({ doneBy: viewer.user.id });
  });

  it("a missing row is the table's notFound, and a deleted row's DELETE is applied", async () => {
    const { group, recipient, owner } = await setup();
    for (const { table, row, patch } of CASES) {
      const id = randomUUID();
      const missing = randomUUID();
      expect(
        await outcomes(owner.api, [
          putOp(table, id, row(group.id, recipient.id)),
          deleteOp(table, id),
          deleteOp(table, id),
          patchOp(table, missing, patch),
          deleteOp(table, missing),
        ]),
        table,
      ).toEqual([
        "applied",
        "applied",
        "applied",
        expect.stringMatching(/:notFound$/),
        expect.stringMatching(/:notFound$/),
      ]);
    }
  });
});

describe("sync.upload: the table lookup", () => {
  it.each(["constructor", "__proto__", "toString", "hasOwnProperty", "no_such_table"])(
    "rejects %s as a read-only table",
    async (table) => {
      const { group, recipient, owner } = await setup();
      const id = randomUUID();
      const data = { group_id: group.id, recipient_id: recipient.id };
      expect(
        await upload(owner.api, [putOp(table, id, data), patchOp(table, id, data), deleteOp(table, id)]),
      ).toEqual([
        { id, status: "rejected", code: "sync:readOnlyTable" },
        { id, status: "rejected", code: "sync:readOnlyTable" },
        { id, status: "rejected", code: "sync:readOnlyTable" },
      ]);
    },
  );
});

describe("sync.upload: a PATCH's columns", () => {
  it.each(CASES)(
    "$table: server-set columns alone are applied; a column in no list is refused",
    async ({ table, row, read }) => {
      const { group, recipient, owner } = await setup();
      const id = randomUUID();
      expect(await outcomes(owner.api, [putOp(table, id, row(group.id, recipient.id))])).toEqual(["applied"]);
      const before = ok(await read(owner.ctx, id));

      expect(
        await outcomes(owner.api, [
          patchOp(table, id, { updated_at: "2026-11-19T09:00:00.000000Z", updated_by: owner.user.id }),
          patchOp(table, id, { created_by: owner.user.id }),
          patchOp(table, id, { not_a_column: "x" }),
        ]),
      ).toEqual(["applied", "applied", "sync:unknownColumn"]);
      expect(ok(await read(owner.ctx, id))).toEqual(before);
    },
  );
});
