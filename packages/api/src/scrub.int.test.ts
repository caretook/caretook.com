import type { ScrubRule, ScrubTable } from "@caretook/data/domain";

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
import { SCRUB_SPECS, SCRUB_TABLES, scrubEntryDetails, scrubValue } from "@caretook/data/domain";
import { scheduleHistory } from "@caretook/data/schema";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../../data/src/db/client";
import { createWorld, ok } from "../../data/test/fixtures";
import { clientFor, deleteOp, patchOp, upload } from "./testing";

// A delete scrubs, everywhere (data-rights, slice 1): migration 0051's
// triggers against SCRUB_SPECS. Rows are written raw, every content column
// filled, then deleted through the service and through a sync upload; what
// is left is compared column by column with what was there. One world per
// describe.

type Row = Record<string, unknown>;

const query = async (text: string, params: unknown[] = []) =>
  (await getDb().$client.query(text, params)).rows as Row[];

const insert = async (table: string, row: Row) => {
  const columns = Object.keys(row);
  const values = columns.map((c) => {
    const v = row[c];
    return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  });
  await query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})`,
    values,
  );
};

const rowOf = async (table: string, id: string) =>
  (await query(`SELECT * FROM ${table} WHERE id = $1`, [id]))[0]!;

/** Columns a delete itself writes. */
const TOMBSTONE = ["deleted_at", "updated_at", "updated_by", "search_vector"];

const TZ = "America/Los_Angeles";
const DAY_MS = 24 * 60 * 60_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

const world = async () => {
  const w = await createWorld({ members: ["caretaker"] });
  const by = w.u.owner.user.id;
  const audits = { created_by: by, updated_by: by };
  const owned = { group_id: w.groupId, recipient_id: w.recipient.id, ...audits };
  const practice = randomUUID();
  const clinician = randomUUID();
  const medication = randomUUID();
  await insert("provider", {
    id: practice,
    group_id: w.groupId,
    type: "practice",
    name: "Valley Clinic",
    ...audits,
  });
  await insert("provider", {
    id: clinician,
    group_id: w.groupId,
    type: "clinician",
    name: "Dr. Lee",
    ...audits,
  });
  const medicationContent = (id: string): Row => ({
    id,
    ...owned,
    name: "Lisinopril",
    strength: "10 mg",
    form: "tablet",
    dose: "1 tablet",
    directions: "With water",
    reason: "Blood pressure",
    schedule: { type: "scheduled", slots: [{ time: "09:00" }] },
    status: "current",
    started_on: "2026-11-01",
    stop_reason: "other",
    stop_note: "Felt dizzy",
    prescriber_id: clinician,
    pharmacy_id: practice,
    last_filled_on: "2026-11-10",
    quantity: "30",
    refills_left: 2,
    rx_number: "RX-1001",
    type: "prescription",
  });
  await insert("medication", medicationContent(medication));

  /** A row of `table` with every content column set. */
  const full: Record<ScrubTable, (id: string) => Row> = {
    timeline_entry: (id) => ({
      id,
      ...owned,
      kind: "symptom",
      occurred_at: daysAgo(1),
      time_zone: TZ,
      title: "Bad night",
      body: "Woke up twice",
      place: "Home",
      cancel_reason: "Unwell",
      details: { name: "Headache", severity: 4 },
    }),
    provider: (id) => ({
      id,
      group_id: w.groupId,
      ...audits,
      type: "clinician",
      name: "Dr. Rivera",
      specialty: "Cardiology",
      practice_id: practice,
      phones: [{ label: "Office", number: "555-0100" }],
      email: "rivera@example.com",
      address: "1 Main St",
      website: "https://example.com",
      is_primary: true,
    }),
    medication: medicationContent,
    medication_pass: (id) => ({ id, ...owned, name: "Bedtime", time: "21:00", sort_order: 5 }),
    recipient_allergy: (id) => ({
      id,
      ...owned,
      substance: "Penicillin",
      reaction: "Hives",
      severity: "severe",
    }),
    recipient_condition: (id) => ({
      id,
      ...owned,
      name: "Asthma",
      since_year: 2010,
      since_month: 3,
      note: "Mild",
      diagnosed_by_id: clinician,
    }),
    care_period: (id) => ({
      id,
      ...owned,
      type: "hospital",
      label: "Knee surgery",
      place_provider_id: practice,
      place_detail: "Room 4",
      started_at: daysAgo(3),
    }),
    todo: (id) => ({
      id,
      ...owned,
      title: "Call the pharmacy",
      assignee_id: w.u.caretaker.user.id,
      due_on: "2026-11-21",
      due_time: "17:00",
      provider_id: clinician,
      medication_id: medication,
    }),
    appointment_series: (id) => ({
      id,
      ...owned,
      kind: "event",
      rule: "FREQ=WEEKLY",
      starts_on: "2026-11-01",
      start_time: "09:00",
      time_zone: TZ,
      title: "Physical therapy",
      duration_minutes: 45,
      place: "Valley Clinic",
      provider_ids: [clinician],
    }),
  };
  return { ...w, owned, audits, full, api: clientFor(w.u.owner.ctx.authUser) };
};

const SERVICES: Record<ScrubTable, { remove: (ctx: never, id: string) => Promise<unknown> }> = {
  timeline_entry: timelineEntryService,
  provider: providerService,
  medication: medicationService,
  medication_pass: medicationPassService,
  recipient_allergy: recipientAllergyService,
  recipient_condition: recipientConditionService,
  care_period: carePeriodService,
  todo: todoService,
  appointment_series: appointmentSeriesService,
};

/** What a column of `before` should be once scrubbed (`medicationLive` for an entry's details). */
const expected = (table: ScrubTable, column: string, before: Row) => {
  const rule = (SCRUB_SPECS[table].columns as Record<string, ScrubRule>)[column];
  if (rule === "details")
    return scrubEntryDetails(String(before.kind), before.details, { medicationLive: true });
  const value = rule === undefined ? undefined : scrubValue(rule);
  return value === undefined ? before[column] : value;
};

describe("a soft delete leaves only the tombstone", () => {
  let w: Awaited<ReturnType<typeof world>>;
  beforeAll(async () => {
    w = await world();
  });

  for (const table of SCRUB_TABLES) {
    for (const via of ["the service", "a sync upload"] as const) {
      it(`${table}, through ${via}`, async () => {
        const id = randomUUID();
        await insert(table, w.full[table](id));
        const before = await rowOf(table, id);
        if (via === "the service") ok(await SERVICES[table].remove(w.u.owner.ctx as never, id));
        else expect(await upload(w.api, [deleteOp(table, id)])).toEqual([{ id, status: "applied" }]);

        const after = await rowOf(table, id);
        expect(after.deleted_at).not.toBeNull();
        for (const column of Object.keys(before)) {
          if (TOMBSTONE.includes(column)) continue;
          expect(after[column], `${table}.${column}`).toEqual(expected(table, column, before));
        }
        // Every content column filled was cleared, unless kept.
        for (const [column, rule] of Object.entries(SCRUB_SPECS[table].columns)) {
          if (rule !== "keep" && before[column] !== null && rule !== "details")
            expect(after[column], `${table}.${column} cleared`).not.toEqual(before[column]);
        }
      });
    }
  }
});

describe("a deleted row's document", () => {
  let w: Awaited<ReturnType<typeof world>>;
  beforeAll(async () => {
    w = await world();
  });

  const withDocument = async (table: "timeline_entry" | "provider" | "medication", id: string) => {
    const row =
      table === "timeline_entry"
        ? {
            ...w.full.timeline_entry(id),
            kind: "note",
            title: "Rough day",
            body: null,
            details: null,
            place: null,
          }
        : w.full[table](id);
    await insert(table, row);
    const owner = { timeline_entry: "entry_id", provider: "provider_id", medication: "medication_id" }[table];
    const subject = { timeline_entry: "entry", provider: "provider", medication: "medication" }[table];
    await insert("note_document", {
      id,
      group_id: w.groupId,
      ...w.audits,
      subject,
      [owner]: id,
      snapshot: "AAA=",
      text: "Private words",
      editors: { [w.u.owner.user.id]: daysAgo(0) },
    });
    await insert("note_update", {
      id: randomUUID(),
      group_id: w.groupId,
      document_id: id,
      data: "AAE=",
      ...w.audits,
    });
  };

  for (const table of ["timeline_entry", "provider", "medication"] as const) {
    it(`is emptied, its updates gone, for a ${table}`, async () => {
      const id = randomUUID();
      await withDocument(table, id);
      expect(await upload(w.api, [deleteOp(table, id)])).toEqual([{ id, status: "applied" }]);
      expect(await rowOf("note_document", id)).toMatchObject({ snapshot: null, text: "", editors: {} });
      expect(await query("SELECT id FROM note_update WHERE document_id = $1", [id])).toEqual([]);
    });
  }
});

describe("change entries and the schedule history carve-out", () => {
  let w: Awaited<ReturnType<typeof world>>;
  beforeAll(async () => {
    w = await world();
  });

  const entry = async (kind: string, details: Row, occurredAt = daysAgo(3)) => {
    const id = randomUUID();
    await insert("timeline_entry", { id, ...w.owned, kind, occurred_at: occurredAt, time_zone: TZ, details });
    return id;
  };
  const detailsOf = async (id: string) => (await rowOf("timeline_entry", id)).details;

  it("keeps a live medication's past schedule and dose slots, and strips them once it's deleted", async () => {
    const medication = randomUUID();
    await insert("medication", w.full.medication(medication));
    const before = {
      name: "Old name",
      strength: "5 mg",
      schedule: { type: "scheduled", slots: [{ time: "08:00" }] },
    };
    const after = {
      name: "Lisinopril",
      strength: "10 mg",
      schedule: { type: "scheduled", slots: [{ time: "09:00" }] },
    };
    const change = await entry("medicationChange", {
      medicationId: medication,
      change: "changed",
      fields: ["name", "strength", "schedule"],
      before,
      after,
    });
    const doseDetails = {
      medicationId: medication,
      status: "given",
      amount: "1 tablet",
      note: "With breakfast",
      scheduledFor: "08:00",
    };
    const dose = await entry("dose", doseDetails, daysAgo(5));

    const history = async () => {
      const rows = await query("SELECT id, occurred_at, details FROM timeline_entry WHERE id = $1", [change]);
      const h = scheduleHistory({
        medication: { id: medication, schedule: after.schedule as never, status: "current" },
        changes: rows.map((r) => ({
          id: String(r.id),
          occurredAt: (r.occurred_at as Date).toISOString(),
          details: r.details,
        })),
        timeZone: TZ,
      });
      const day = new Date(Date.now() - 5 * DAY_MS).toISOString().slice(0, 10);
      return h.slotsOn(day).map((s) => s.time);
    };
    expect(await history()).toEqual(["08:00"]);

    expect(
      await upload(w.api, [deleteOp("timeline_entry", dose), deleteOp("timeline_entry", change)]),
    ).toEqual([
      { id: dose, status: "applied" },
      { id: change, status: "applied" },
    ]);
    expect(await detailsOf(dose)).toEqual({
      medicationId: medication,
      status: "given",
      scheduledFor: "08:00",
    });
    expect(await detailsOf(change)).toEqual({
      medicationId: medication,
      change: "changed",
      before: { schedule: before.schedule },
      after: { schedule: after.schedule },
    });
    expect(await history()).toEqual(["08:00"]);

    expect(await upload(w.api, [patchOp("medication", medication, { deleted_at: daysAgo(0) })])).toEqual([
      { id: medication, status: "applied" },
    ]);
    expect(await detailsOf(change)).toEqual({ medicationId: medication, change: "changed" });
    expect(await detailsOf(dose)).toEqual({ medicationId: medication, status: "given" });
  });

  it("strips a deleted medication's live change entries, and leaves its live doses", async () => {
    const medication = randomUUID();
    await insert("medication", w.full.medication(medication));
    const started = await entry("medicationChange", {
      medicationId: medication,
      change: "started",
      after: { name: "Lisinopril", schedule: { type: "asNeeded" } },
    });
    const given = { medicationId: medication, status: "given", amount: "1 tablet", scheduledFor: "09:00" };
    const dose = await entry("dose", given);
    ok(await medicationService.remove(w.u.owner.ctx, medication));
    expect(await detailsOf(started)).toEqual({ medicationId: medication, change: "started" });
    expect(await detailsOf(dose)).toEqual(given);
  });

  it("strips a deleted condition's change entries", async () => {
    const condition = randomUUID();
    await insert("recipient_condition", w.full.recipient_condition(condition));
    const added = await entry("conditionChange", {
      conditionId: condition,
      conditionName: "Asthma",
      change: "added",
      after: { name: "Asthma", note: "Mild", diagnosedBy: "Dr. Lee" },
    });
    ok(await recipientConditionService.remove(w.u.owner.ctx, condition));
    expect(await detailsOf(added)).toEqual({ conditionId: condition, change: "added", conditionName: "" });
  });
});

describe("the migration's backfill and the live triggers", () => {
  let w: Awaited<ReturnType<typeof world>>;
  beforeAll(async () => {
    w = await world();
  });

  it("scrubs rows deleted before the migration", async () => {
    const id = randomUUID();
    const client = await getDb().$client.connect();
    try {
      await client.query("BEGIN");
      await client.query("ALTER TABLE provider DISABLE TRIGGER provider_scrub");
      const row = { ...w.full.provider(id), deleted_at: daysAgo(30) };
      const columns = Object.keys(row);
      await client.query(
        `INSERT INTO provider (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})`,
        columns.map((c) => {
          const v = (row as Row)[c];
          return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
        }),
      );
      await client.query("ALTER TABLE provider ENABLE TRIGGER provider_scrub");
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    expect(await rowOf("provider", id)).toMatchObject({ name: "Dr. Rivera", email: "rivera@example.com" });
    await query("SELECT scrub_deleted_rows()");
    expect(await rowOf("provider", id)).toMatchObject({ name: "", email: null, phones: [] });
  });

  /** How the migration writes a rule's value. */
  const sqlOf = (rule: ScrubRule) => {
    if (rule === "null") return "NULL";
    if (rule === "empty") return "''";
    if (rule === "emptyList") return "'[]'::jsonb";
    if (rule === "details")
      return "scrub_entry_details(NEW.kind, NEW.details, scrub_medication_live(NEW.details))";
    if (typeof rule === "object" && typeof rule.value === "string") return `'${rule.value}'`;
    if (typeof rule === "object") return `'${JSON.stringify(rule.value).replace(/":/g, '": ')}'::jsonb`;
    return null;
  };

  it("match the spec (drift)", async () => {
    for (const table of SCRUB_TABLES) {
      const spec = SCRUB_SPECS[table];
      const [fn] = await query("SELECT pg_get_functiondef($1::regproc) AS def", [`scrub_${table}`]);
      const def = String(fn?.def);
      const assigned = Object.fromEntries(
        [...def.matchAll(/NEW\.(\w+) := ([^;]+);/g)].map((m): [string, string] => [m[1]!, m[2]!]),
      );
      const cleared = Object.fromEntries(
        Object.entries(spec.columns as Record<string, ScrubRule>).flatMap(([c, rule]) =>
          rule === "keep" ? [] : [[c, sqlOf(rule)]],
        ),
      );
      expect(assigned, table).toEqual(cleared);
      expect(def.includes("PERFORM scrub_document(NEW.id)"), `${table}: document`).toBe(spec.document);
      const summaries = "summaries" in spec ? spec.summaries : undefined;
      expect(def.includes("UPDATE timeline_entry SET details"), `${table}: summaries`).toBe(!!summaries);
      if (summaries) expect(def).toContain(`details->>'${summaries.idKey}' = NEW.id::text`);

      const triggers = await query(
        "SELECT tgenabled, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid = $1::regclass AND tgname = $2",
        [table, `${table}_scrub`],
      );
      expect(triggers, table).toHaveLength(1);
      expect(triggers[0]).toMatchObject({ tgenabled: "O" });
      expect(String(triggers[0]!.def)).toContain(`BEFORE INSERT OR UPDATE OF deleted_at ON public.${table}`);
    }
  });

  it("scrub entry details as the spec does", async () => {
    const medicationId = randomUUID();
    const samples: [string, Row][] = [
      ["symptom", { name: "Headache", severity: 4 }],
      [
        "dose",
        { medicationId, status: "given", amount: "2", note: "x", scheduledFor: "08:00", passId: null },
      ],
      [
        "medicationChange",
        {
          medicationId,
          change: "changed",
          fields: ["dose"],
          before: { dose: null, name: "A" },
          after: { dose: "2" },
        },
      ],
      [
        "medicationChange",
        {
          change: "passMoved",
          passId: medicationId,
          passName: "Noon",
          beforeTime: "12:00",
          afterTime: "12:30",
          medicationIds: [],
        },
      ],
      ["conditionChange", { conditionId: medicationId, conditionName: "Asthma", change: "resolved" }],
    ];
    for (const [kind, details] of samples) {
      for (const medicationLive of [true, false]) {
        const [row] = await query("SELECT scrub_entry_details($1, $2::jsonb, $3) AS d", [
          kind,
          JSON.stringify(details),
          medicationLive,
        ]);
        expect(row?.d ?? null, `${kind} ${medicationLive}`).toEqual(
          scrubEntryDetails(kind, details, { medicationLive }),
        );
      }
    }
  });
});
