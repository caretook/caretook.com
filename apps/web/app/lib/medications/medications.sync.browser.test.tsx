import type { MedicationRow, RecipientRow } from "./medications.sync";

import { doseSlotId } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../test/device";
import { newId } from "../../../test/fixtures";
import {
  ACETAMINOPHEN,
  GROUP,
  LISINOPRIL,
  RECIPIENT,
  world,
} from "../../routes/app/groups/medications/medicationWorld";
import { readRows } from "../timeline/timeline.sync";
import { addToPassLog } from "./passLogs.sync";
import {
  changeMedicationStatus,
  createMedication,
  groupDosesQuery,
  logDose,
  logDoses,
  medicationEntriesQuery,
  medicationQuery,
  medicationsQuery,
  recipientQuery,
  removeDoses,
  removeMedication,
  removeMedicationEntry,
  toMedicationEntries,
  toMedications,
  updateDose,
  updateMedication,
} from "./medications.sync";
import { dayBounds } from "@caretook/data/domain";

// The medications device module on the test device (medications.mjs's
// device steps, which drove it through `window.caretookModules()`): the list
// query's order, search and parsed schedules, a medication's history newest
// first, the recipient's zone and date of birth; a writer's add, refill edit,
// dose change, discontinue and restart, each writing exactly the change
// entries it should in the same local write; doses logged, edited, found in
// the recipient's day and deleted; and a viewer's writes refused. What the
// server does with these uploads (the same entry ids, one entry each) is
// syncMedications.int.test.ts's; the rows reaching another device are
// roundtrip.mjs's sync matrix (6b).

const ZONE = "America/Los_Angeles";
const device = (role: "caretaker" | "viewer" = "caretaker") =>
  renderWithDevice({
    element: <p>Device</p>,
    url: `/app/groups/${GROUP}/medications`,
    fixtures: world(),
    role,
  });

type Db = Awaited<ReturnType<typeof device>>["db"];
const changes = async (db: Db, id: string) =>
  (
    await db.powersync.getAll<{ id: string; change: string; time_zone: string; details: string }>(
      "SELECT id, json_extract(details, '$.change') AS change, time_zone, details FROM timeline_entry WHERE kind = 'medicationChange' AND deleted_at IS NULL AND json_extract(details, '$.medicationId') = ? ORDER BY occurred_at, created_at",
      [id],
    )
  ).map((r) => ({ ...r, details: JSON.parse(r.details) as Record<string, unknown> }));
const row = async (db: Db, id: string) => (await readRows<MedicationRow>(db, medicationQuery(id)))[0]!;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

describe("reading", () => {
  test("the list: current first, then the rest, each by name, with parsed schedules; search by reason among current ones", async () => {
    const { db } = await device();
    const listed = toMedications(await readRows<MedicationRow>(db, medicationsQuery(GROUP)));
    expect(listed.map((m) => `${m.name}:${m.schedule.type}`)).toEqual([
      "Acetaminophen:asNeeded",
      "Latanoprost:scheduled",
      "Lisinopril:scheduled",
      "Metformin:scheduled",
      "Amoxicillin:scheduled",
      "Oxybutynin:scheduled",
    ]);
    const found = await readRows<MedicationRow>(
      db,
      medicationsQuery(GROUP, { q: "blood", status: "current" }),
    );
    expect(found.map((m) => m.name)).toEqual(["Lisinopril"]);
  });

  test("a medication's changes read newest first; the recipient has their zone and date of birth", async () => {
    const { db } = await device();
    const q = medicationEntriesQuery(LISINOPRIL.id, "medicationChange");
    const history = toMedicationEntries(await db.powersync.getAll(q.sql, q.params));
    expect(
      history.map((e) => {
        const details = e.details as { change: string; after?: { strength?: string } };
        return `${details.change}:${details.after?.strength ?? ""}`;
      }),
    ).toEqual(["changed:10 mg", "started:5 mg"]);
    const [recipient] = await readRows<RecipientRow>(db, recipientQuery(GROUP));
    expect(recipient).toMatchObject({ time_zone: ZONE, date_of_birth: RECIPIENT.row.date_of_birth });
  });
});

describe("a writer's medication", () => {
  test("adding writes its Started entry with it, in the recipient's zone; an old-style schedule is stored as sorted slots", async () => {
    const { db } = await device();
    const made = await createMedication(db, GROUP, {
      name: "Sertraline",
      strength: "25 mg",
      form: "tablet",
      dose: "1 tablet",
      reason: "Mood",
      schedule: { type: "scheduled", times: ["20:00", "08:00"] } as never,
    });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const entries = await changes(db, made.id);
    expect(entries.map((e) => [e.change, e.time_zone])).toEqual([["started", ZONE]]);
    expect(JSON.parse((await row(db, made.id)).schedule ?? "null")).toEqual({
      type: "scheduled",
      slots: [{ time: "08:00" }, { time: "20:00" }],
    });
  });

  test("a refill edit writes no entry; a dose change, a discontinue (with a reason, dated today in the recipient's zone) and a restart write one each", async () => {
    const { db } = await device();
    const id = LISINOPRIL.id;
    expect((await updateMedication(db, id, { refillsLeft: 2, quantity: "30 tablets" })).ok).toBe(true);
    expect((await changes(db, id)).map((e) => e.change)).toEqual(["started", "changed"]);
    expect(await row(db, id)).toMatchObject({ refills_left: 2, quantity: "30 tablets" });

    expect((await updateMedication(db, id, { dose: "2 tablets" })).ok).toBe(true);
    const dose = (await changes(db, id)).at(-1)!;
    expect(dose.details).toMatchObject({
      change: "changed",
      before: { dose: "1 tablet" },
      after: { dose: "2 tablets" },
    });

    const noReason = await changeMedicationStatus(db, id, { status: "discontinued" } as never);
    expect(noReason.ok).toBe(false);
    expect(!noReason.ok && noReason.issues.some((i) => i.path === "stopReason")).toBe(true);
    expect((await row(db, id)).status).toBe("current");

    const stopped = await changeMedicationStatus(db, id, {
      status: "discontinued",
      stopReason: "sideEffects",
      stopNote: "Nausea",
    });
    expect(stopped.ok).toBe(true);
    expect(await row(db, id)).toMatchObject({
      status: "discontinued",
      stop_reason: "sideEffects",
      stopped_on: today(),
    });
    expect((await changeMedicationStatus(db, id, { status: "current" })).ok).toBe(true);
    expect(await row(db, id)).toMatchObject({ status: "current", stopped_on: null });
    expect((await changes(db, id)).map((e) => e.change)).toEqual([
      "started",
      "changed",
      "changed",
      "stopped",
      "resumed",
    ]);
  });

  test("deleting is soft: it leaves the list and keeps its change entries", async () => {
    const { db } = await device();
    expect((await removeMedication(db, LISINOPRIL.id)).ok).toBe(true);
    expect((await row(db, LISINOPRIL.id)).deleted_at).toBeTruthy();
    const listed = await readRows<MedicationRow>(db, medicationsQuery(GROUP));
    expect(listed.some((m) => m.id === LISINOPRIL.id)).toBe(false);
    expect(await changes(db, LISINOPRIL.id)).toHaveLength(2);
  });
});

describe("doses", () => {
  test("a dose is logged, edited, found among the recipient's day's doses, and deleted; one for a medication not on the device is refused", async () => {
    const { db } = await device();
    const logged = await logDose(db, GROUP, {
      medicationId: ACETAMINOPHEN.id,
      status: "given",
      amount: "2 tablets",
    });
    expect(logged.ok).toBe(true);
    if (!logged.ok) return;
    expect((await updateDose(db, logged.id, { status: "skipped", note: "Asleep" })).ok).toBe(true);
    const { from, to } = dayBounds(new Date(), ZONE);
    const q = groupDosesQuery(GROUP, from, to);
    const day = toMedicationEntries(await db.powersync.getAll(q.sql, q.params));
    expect(day.find((e) => e.id === logged.id)?.details).toMatchObject({ status: "skipped", note: "Asleep" });

    expect((await removeMedicationEntry(db, logged.id)).ok).toBe(true);
    const after = toMedicationEntries(await db.powersync.getAll(q.sql, q.params));
    expect(after.some((e) => e.id === logged.id)).toBe(false);

    const stray = await logDose(db, GROUP, { medicationId: newId(), status: "given" });
    expect(stray.ok).toBe(false);
  });
});

describe("slot ids", () => {
  // 08:05 on Jan 15 2026 in Los Angeles.
  const AT = "2026-01-15T16:05:00.000Z";
  const PASS = "6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
  const slotDose = (medicationId: string = LISINOPRIL.id) => ({
    medicationId,
    status: "given" as const,
    scheduledFor: "08:00",
    occurredAt: AT,
  });
  const slotId = (medicationId: string = LISINOPRIL.id) =>
    doseSlotId(medicationId, "2026-01-15", "08:00", "given");
  const liveDoses = async (db: Db) =>
    db.powersync.getAll<{ id: string }>(
      "SELECT id FROM timeline_entry WHERE kind = 'dose' AND deleted_at IS NULL AND occurred_at LIKE '2026-01-15%'",
    );

  test("logDose takes the slot's id; with it live (Log anyway) or deleted (after Undo), a random one", async () => {
    const { db } = await device();
    const first = await logDose(db, GROUP, slotDose());
    expect(first).toEqual({ ok: true, id: slotId() });

    const extra = await logDose(db, GROUP, slotDose());
    expect(extra.ok && extra.id).not.toBe(slotId());
    expect(await liveDoses(db)).toHaveLength(2);

    expect((await removeDoses(db, [slotId()])).ok).toBe(true);
    const again = await logDose(db, GROUP, slotDose());
    expect(again.ok && again.id).not.toBe(slotId());
    expect(await liveDoses(db)).toHaveLength(2);
  });

  test("a dose naming no slot takes a random id; a different answer for the slot its own", async () => {
    const { db } = await device();
    const unnamed = await logDose(db, GROUP, { ...slotDose(), scheduledFor: null });
    expect(unnamed.ok && unnamed.id[14]).toBe("4");
    const skipped = await logDose(db, GROUP, { ...slotDose(), status: "skipped" });
    expect(skipped.ok && skipped.id).toBe(doseSlotId(LISINOPRIL.id, "2026-01-15", "08:00", "skipped"));
  });

  test("two taps at once both save: the second takes a random id", async () => {
    const { db } = await device();
    const [a, b] = await Promise.all([logDose(db, GROUP, slotDose()), logDose(db, GROUP, slotDose())]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(new Set([a.id, b.id]).size).toBe(2);
    expect([a.id, b.id]).toContain(slotId());
  });

  test("logDoses: slot ids, one row per id in a batch; Given all, Undo, Given all leaves one live dose per slot", async () => {
    const { db } = await device();
    const batch = [slotDose(), slotDose(ACETAMINOPHEN.id)];
    const first = await logDoses(db, GROUP, batch);
    expect(first.ok && first.ids).toEqual([slotId(), slotId(ACETAMINOPHEN.id)]);
    expect((await removeDoses(db, first.ok ? first.ids : [])).ok).toBe(true);
    const second = await logDoses(db, GROUP, batch);
    expect(second.ok).toBe(true);
    expect(second.ok && second.ids.some((id) => first.ok && first.ids.includes(id))).toBe(false);
    expect(await liveDoses(db)).toHaveLength(2);

    const twice = await logDoses(db, GROUP, [
      { ...slotDose(), occurredAt: "2026-01-16T16:05:00.000Z" },
      { ...slotDose(), occurredAt: "2026-01-16T16:05:00.000Z" },
    ]);
    expect(twice.ok && new Set(twice.ids).size).toBe(2);
  });

  test("the pass sheet's added dose takes the slot's id, in the log's round", async () => {
    const { db } = await device();
    const added = await addToPassLog(
      db,
      GROUP,
      { passLogId: PASS, passId: PASS, scheduledFor: "08:00", occurredAt: AT },
      { medicationId: LISINOPRIL.id, amount: "1 tablet" },
    );
    expect(added).toEqual({ ok: true, id: doseSlotId(LISINOPRIL.id, "2026-01-15", PASS, "given") });
  });
});

describe("a viewer's device", () => {
  test("refuses every write and changes nothing", async () => {
    const { db } = await device("viewer");
    const results = [
      await createMedication(db, GROUP, { name: "Nope", schedule: { type: "asNeeded" } }),
      await updateMedication(db, LISINOPRIL.id, { dose: "9 tablets" }),
      await removeMedication(db, LISINOPRIL.id),
      await logDose(db, GROUP, { medicationId: LISINOPRIL.id, status: "given" }),
    ];
    expect(results.map((r) => r.ok)).toEqual([false, false, false, false]);
    expect(await row(db, LISINOPRIL.id)).toMatchObject({ dose: "1 tablet", deleted_at: null });
    expect(await db.powersync.getAll("SELECT id FROM ps_crud")).toEqual([]);
  });
});
