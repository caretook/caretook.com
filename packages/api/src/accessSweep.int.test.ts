import type { AuthUser } from "@caretook/data";
import type { CrudOp } from "./sync";
import type { Api } from "./testing";

import {
  careGroupMemberService,
  conditionManagerId,
  entryProviderId,
  entryTodoId,
  getDb,
  medicationConditionId,
  symptomTypeId,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createUser, createWorld, newYDoc, ok, typeParagraph } from "../../data/test/fixtures";
import { UPLOAD_REGISTRY } from "./syncRegistry";
import { clientFor, codeOf, deleteOp, patchOp, putOp, upload } from "./testing";

// Everyone who isn't in a group, at every entry point to its care data
// (test-health-2 slice 2, B-373): someone outside it, a member removed
// through the service whose session (and its cached group role) lives on,
// Caretook support, and a Caretook admin who isn't a member. Staff never see
// care data (docs/domain/admin.md), and removal ends access.
//
// sync.upload: one case per UPLOAD_REGISTRY table (a table with no case
// fails), each with the ops the table takes. Every op is refused, and the
// group's rows in every upload table are as they were; the owner's same ops
// are applied. The oRPC care reads
// and writes: each person is refused. Each test makes its own world.

const AT = "2026-11-17T21:45:25.229000Z";
const LATER = "2026-11-18T09:00:00.000000Z";
const audits = { deleted_at: null, created_at: AT, updated_at: AT };

/** The group's own rows, made by its owner, that the cases aim at. */
type Ids = {
  groupId: string;
  recipientId: string;
  entry: string;
  /** An entry with no document yet. */
  bareEntry: string;
  provider: string;
  otherProvider: string;
  medication: string;
  condition: string;
  otherCondition: string;
  /** Each soft-delete table's existing row. */
  rows: Record<string, string>;
};

/** A soft-delete table's device row. */
type Row = (ids: Ids) => Record<string, unknown>;

/** `fresh`: what a new row changes, where a copy of the first would clash with it (a pass's name). */
const SOFT_DELETE: Record<
  string,
  { row: Row; patch: Record<string, unknown>; fresh?: Record<string, unknown> }
> = {
  timeline_entry: {
    row: (ids) => ({
      group_id: ids.groupId,
      recipient_id: ids.recipientId,
      kind: "symptom",
      occurred_at: AT,
      time_zone: "America/Los_Angeles",
      title: null,
      body: null,
      details: JSON.stringify({ name: "Cough", severity: 2 }),
      ...audits,
    }),
    patch: { details: JSON.stringify({ name: "Cough", severity: 4 }), updated_at: LATER },
  },
  provider: {
    row: (ids) => ({
      group_id: ids.groupId,
      type: "clinician",
      name: "Dr. Fictional",
      specialty: "Cardiology",
      phones: "[]",
      status: "current",
      is_primary: 0,
      ...audits,
    }),
    patch: { name: "Dr. Renamed" },
  },
  medication: {
    row: (ids) => ({
      group_id: ids.groupId,
      recipient_id: ids.recipientId,
      name: "Lisinopril",
      strength: "10 mg",
      form: "tablet",
      dose: "1 tablet",
      schedule: JSON.stringify({ type: "scheduled", times: ["08:00"] }),
      status: "current",
      started_on: "2026-11-01",
      refills_left: 2,
      ...audits,
    }),
    patch: { dose: "2 tablets", updated_at: LATER },
  },
  medication_pass: {
    row: (ids) => ({
      group_id: ids.groupId,
      recipient_id: ids.recipientId,
      name: "Noon",
      time: "12:00",
      sort_order: 2,
      ...audits,
    }),
    patch: { time: "12:30", updated_at: LATER },
    fresh: { name: "Bedtime", time: "21:00" },
  },
  recipient_allergy: {
    row: (ids) => ({
      group_id: ids.groupId,
      recipient_id: ids.recipientId,
      substance: "Penicillin",
      reaction: "Hives",
      severity: "severe",
      ...audits,
    }),
    patch: { reaction: "Rash" },
  },
  recipient_condition: {
    row: (ids) => ({
      group_id: ids.groupId,
      recipient_id: ids.recipientId,
      name: "Type 2 diabetes",
      status: "active",
      since_year: 2016,
      since_month: 3,
      ...audits,
    }),
    patch: { note: "Diet-controlled", updated_at: LATER },
  },
  care_period: {
    row: (ids) => ({
      group_id: ids.groupId,
      recipient_id: ids.recipientId,
      type: "hospital",
      label: "Mercy General",
      started_at: AT,
      date_only: 0,
      ...audits,
    }),
    patch: { label: "4 West" },
  },
  todo: {
    row: (ids) => ({
      group_id: ids.groupId,
      recipient_id: ids.recipientId,
      title: "Call the pharmacy",
      due_on: "2026-11-21",
      ...audits,
    }),
    patch: { title: "Call again", done_at: LATER },
  },
  appointment_series: {
    row: (ids) => ({
      group_id: ids.groupId,
      recipient_id: ids.recipientId,
      kind: "event",
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
      starts_on: "2026-11-23",
      start_time: "09:00",
      all_day: 0,
      time_zone: "America/Los_Angeles",
      title: "Physical therapy",
      duration_minutes: 60,
      provider_ids: "[]",
      topped_up_through: "2026-12-21",
      ...audits,
    }),
    patch: { title: "Physio" },
  },
};

/** A soft-delete table's attempts: a new row, an edit, a soft delete either way. */
const softDeleteOps =
  (table: string) =>
  (ids: Ids): CrudOp[] => {
    const { row, patch, fresh } = SOFT_DELETE[table]!;
    const id = ids.rows[table]!;
    return [
      putOp(table, randomUUID(), { ...row(ids), ...fresh }),
      patchOp(table, id, patch),
      patchOp(table, id, { deleted_at: LATER, updated_at: LATER }),
      deleteOp(table, id),
    ];
  };

/**
 * Each upload table's attempts, as the table takes them (any other op is
 * read-only for everyone). Cases in `BARE_GROUP` run on a group with no rows.
 */
const UPLOAD_CASES: Record<string, (ids: Ids) => CrudOp[]> = {
  ...Object.fromEntries(Object.keys(SOFT_DELETE).map((table) => [table, softDeleteOps(table)])),
  note_document: (ids) => [
    putOp("note_document", ids.bareEntry, { group_id: ids.groupId, subject: "entry" }),
  ],
  note_update: (ids) => [
    putOp("note_update", randomUUID(), {
      group_id: ids.groupId,
      document_id: ids.entry,
      data: typeParagraph(newYDoc(), "Not theirs to write"),
    }),
  ],
  timeline_entry_provider: (ids) => [
    putOp("timeline_entry_provider", entryProviderId(ids.entry, ids.otherProvider), {
      group_id: ids.groupId,
      entry_id: ids.entry,
      provider_id: ids.otherProvider,
    }),
    deleteOp("timeline_entry_provider", entryProviderId(ids.entry, ids.provider)),
  ],
  // "No known allergies" and "No known conditions": only while there are none.
  care_recipient: (ids) => [
    patchOp("care_recipient", ids.recipientId, { no_known_allergies_at: LATER }),
    patchOp("care_recipient", ids.recipientId, { no_known_conditions_at: LATER }),
  ],
  medication_condition: (ids) => [
    putOp("medication_condition", medicationConditionId(ids.medication, ids.otherCondition), {
      group_id: ids.groupId,
      medication_id: ids.medication,
      condition_id: ids.otherCondition,
      ...audits,
    }),
    deleteOp("medication_condition", medicationConditionId(ids.medication, ids.condition)),
  ],
  condition_manager: (ids) => {
    const link = conditionManagerId(ids.condition, ids.provider);
    return [
      putOp("condition_manager", conditionManagerId(ids.condition, ids.otherProvider), {
        group_id: ids.groupId,
        condition_id: ids.condition,
        provider_id: ids.otherProvider,
        created_at: LATER,
        updated_at: LATER,
      }),
      patchOp("condition_manager", link, { updated_at: LATER }),
      deleteOp("condition_manager", link),
    ];
  },
  // A new catalog name (rows are only ever added).
  symptom_type: (ids) => [
    putOp("symptom_type", symptomTypeId(ids.groupId, "Sore wrist"), {
      group_id: ids.groupId,
      name: "Sore wrist",
      name_key: "sore wrist",
      created_at: LATER,
      updated_at: LATER,
    }),
  ],
  // Which todos an entry links (planner-3): links are added and removed.
  timeline_entry_todo: (ids) => [
    putOp("timeline_entry_todo", entryTodoId(ids.bareEntry, ids.rows.todo!), {
      group_id: ids.groupId,
      entry_id: ids.bareEntry,
      todo_id: ids.rows.todo,
    }),
    deleteOp("timeline_entry_todo", entryTodoId(ids.entry, ids.rows.todo!)),
  ],
};

const BARE_GROUP = new Set(["care_recipient"]);

/** The owner's group, with a row of every upload table for the cases to aim at (none when `bare`). */
const groupWithRows = async ({ bare = false } = {}) => {
  const world = await createWorld({ members: ["admin"], extras: ["outsider", "staff"] });
  const { u, group, recipient } = world;
  const owner = clientFor(u.owner.ctx.authUser);
  const ids: Ids = {
    groupId: group.id,
    recipientId: recipient.id,
    entry: randomUUID(),
    bareEntry: randomUUID(),
    provider: randomUUID(),
    otherProvider: randomUUID(),
    medication: randomUUID(),
    condition: randomUUID(),
    otherCondition: randomUUID(),
    rows: Object.fromEntries(Object.keys(SOFT_DELETE).map((table) => [table, randomUUID()])),
  };
  const note = (id: string) =>
    putOp("timeline_entry", id, {
      ...SOFT_DELETE.timeline_entry!.row(ids),
      kind: "note",
      details: null,
    });
  const provider = (id: string, name: string) =>
    putOp("provider", id, { ...SOFT_DELETE.provider!.row(ids), name });
  const condition = (id: string, name: string) =>
    putOp("recipient_condition", id, { ...SOFT_DELETE.recipient_condition!.row(ids), name });
  const seed: CrudOp[] = [
    ...Object.entries(SOFT_DELETE).map(([table, { row }]) => putOp(table, ids.rows[table]!, row(ids))),
    note(ids.entry),
    putOp("note_document", ids.entry, { group_id: ids.groupId, subject: "entry" }),
    putOp("note_update", randomUUID(), {
      group_id: ids.groupId,
      document_id: ids.entry,
      data: typeParagraph(newYDoc(), "Slept well"),
    }),
    note(ids.bareEntry),
    putOp("timeline_entry", randomUUID(), {
      ...SOFT_DELETE.timeline_entry!.row(ids),
      kind: "vital",
      details: JSON.stringify({ readings: [{ type: "heartRate", value: 72 }] }),
    }),
    provider(ids.provider, "Dr. Lee"),
    provider(ids.otherProvider, "Dr. Park"),
    putOp("timeline_entry_provider", entryProviderId(ids.entry, ids.provider), {
      group_id: ids.groupId,
      entry_id: ids.entry,
      provider_id: ids.provider,
    }),
    putOp("medication", ids.medication, { ...SOFT_DELETE.medication!.row(ids), name: "Metformin" }),
    condition(ids.condition, "Hypertension"),
    condition(ids.otherCondition, "Asthma"),
    putOp("medication_condition", medicationConditionId(ids.medication, ids.condition), {
      group_id: ids.groupId,
      medication_id: ids.medication,
      condition_id: ids.condition,
      ...audits,
    }),
    putOp("condition_manager", conditionManagerId(ids.condition, ids.provider), {
      group_id: ids.groupId,
      condition_id: ids.condition,
      provider_id: ids.provider,
      ...audits,
    }),
    putOp("timeline_entry_todo", entryTodoId(ids.entry, ids.rows.todo!), {
      group_id: ids.groupId,
      entry_id: ids.entry,
      todo_id: ids.rows.todo,
    }),
  ];
  const seeded = bare ? [] : await upload(owner, seed);
  expect(seeded.filter((r) => r.status !== "applied")).toEqual([]);
  return { ...world, owner, ids };
};

/** The four people outside the group, each with an API client (and its auth user). */
const strangers = async (world: Awaited<ReturnType<typeof groupWithRows>>) => {
  const { u, group, membershipOf } = world;
  // A member's session caches their group roles: it still says "admin" after removal.
  const former: AuthUser = { ...u.admin.ctx.authUser, groupRoles: { [group.id]: "admin" } };
  ok(await careGroupMemberService.remove(u.owner.ctx, (await membershipOf(u.admin)).id));
  const support = await createUser("support", "support");
  const people: Record<string, AuthUser> = {
    outsider: u.outsider.ctx.authUser,
    "removed member": former,
    support: support.ctx.authUser,
    "staff admin": u.staff.ctx.authUser,
  };
  return Object.entries(people).map(([who, authUser]) => ({ who, api: clientFor(authUser) }));
};

/** Every upload table's rows for the group, as Postgres holds them. */
const groupRows = async (groupId: string) => {
  const rows: Record<string, unknown[]> = {};
  for (const table of UPLOAD_REGISTRY.keys()) {
    const { rows: found } = await getDb().$client.query(
      `SELECT * FROM "${table}" WHERE group_id = $1 ORDER BY id`,
      [groupId],
    );
    rows[table] = found;
  }
  return rows;
};

describe("sync.upload: no one outside the group writes to it", () => {
  it("has a case for every table in the registry, and none for a table that isn't", () => {
    expect(Object.keys(UPLOAD_CASES).sort()).toEqual([...UPLOAD_REGISTRY.keys()].sort());
  });

  it.each([...UPLOAD_REGISTRY.keys()])(
    "%s: every op is refused for each of the four, and nothing changes",
    async (table) => {
      const attempts = UPLOAD_CASES[table];
      expect(attempts, `no upload case for ${table}`).toBeDefined();
      const world = await groupWithRows({ bare: BARE_GROUP.has(table) });
      const people = await strangers(world);
      const before = await groupRows(world.ids.groupId);
      for (const { who, api } of people) {
        const ops = attempts!(world.ids);
        const results = await upload(api, ops);
        expect(
          results.map((r) => r.status),
          `${who}: ${JSON.stringify(results)}`,
        ).toEqual(ops.map(() => "rejected"));
        expect(await groupRows(world.ids.groupId), who).toEqual(before);
      }
      // The same ops from the owner are applied: the refusals are about who, not the rows.
      const own = await upload(world.owner, attempts!(world.ids));
      expect(own.filter((r) => r.status !== "applied")).toEqual([]);
    },
  );
});

describe("the care reads and writes over oRPC: no one outside the group", () => {
  type Call = (api: Api, ids: Ids) => Promise<unknown>;

  /** The reads, as a member and the four would make them. A list read answers nothing rather than a refusal. */
  const READS: Record<string, Call> = {
    "timeline.list": (api, ids) => api.timeline.list({ groupId: ids.groupId, includeDeleted: true }),
    "timeline.latestVitals": (api, ids) => api.timeline.latestVitals({ groupId: ids.groupId }),
    "search.query": (api, ids) => api.search.query({ groupId: ids.groupId, q: "Lisinopril" }),
    "careGroup.recipient": (api, ids) => api.careGroup.recipient({ groupId: ids.groupId }),
    "careGroup.recipientDetails": (api, ids) => api.careGroup.recipientDetails({ groupId: ids.groupId }),
    "careGroup.members": (api, ids) => api.careGroup.members({ groupId: ids.groupId }),
  };

  const WRITES: Record<string, Call> = {
    "timeline.create": (api, ids) =>
      api.timeline.create({
        groupId: ids.groupId,
        kind: "note",
        title: "Not theirs to write",
        occurredAt: "2026-11-17T12:00:00-08:00",
        timeZone: "America/Los_Angeles",
      }),
    "timeline.update": (api, ids) =>
      api.timeline.update({ id: ids.rows.timeline_entry!, data: { title: "Not theirs" } }),
    "timeline.remove": (api, ids) => api.timeline.remove({ id: ids.rows.timeline_entry! }),
    "careGroup.updateRecipient": (api, ids) =>
      api.careGroup.updateRecipient({ groupId: ids.groupId, preferredName: "Not theirs" }),
    "careGroup.updateRecipientDetails": (api, ids) =>
      api.careGroup.updateRecipientDetails({ groupId: ids.groupId, email: "someone@example.com" }),
  };

  /** A refusal's code, or "nothing" for an answer with nothing in it (an empty list or page). */
  const answerOf = (call: Promise<unknown>) =>
    call.then(
      (value) => {
        const items = Array.isArray(value) ? value : (value as { data?: unknown[] } | null)?.data;
        return Array.isArray(items) && items.length === 0 ? "nothing" : `answered ${JSON.stringify(value)}`;
      },
      () => codeOf(call),
    );

  it("a member gets something from every read", async () => {
    const world = await groupWithRows();
    for (const [name, read] of Object.entries(READS)) {
      const answer = await answerOf(read(world.owner, world.ids));
      expect(answer, name).toMatch(/^answered /);
      expect(answer, name).not.toMatch(/^answered (\[\]|\{"data":\[\])/);
    }
  });

  it("refuses each of the four on every read and write, and nothing changes", async () => {
    const world = await groupWithRows();
    const people = await strangers(world);
    const before = await groupRows(world.ids.groupId);
    const calls = { ...READS, ...WRITES };
    const answers: Record<string, Record<string, string>> = {};
    for (const { who, api } of people) {
      const mine: Record<string, string> = {};
      for (const [name, run] of Object.entries(calls)) mine[name] = await answerOf(run(api, world.ids));
      answers[who] = mine;
    }
    const refused: unknown = expect.stringMatching(/^(NOT_FOUND|FORBIDDEN|nothing)$/);
    const expected = Object.fromEntries(Object.keys(calls).map((name) => [name, refused]));
    expect(answers).toEqual(Object.fromEntries(people.map(({ who }) => [who, expected])));
    expect(await groupRows(world.ids.groupId)).toEqual(before);
  });
});
