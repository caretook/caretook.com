import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../test/device";
import { TEST_NOW } from "../../../test/found";
import { fx, pgJson, series } from "../../../test/fixtures";
import { applySeriesEdit } from "../appointments/series.sync";
import { updateDose, updateMedication } from "../medications/medications.sync";
import { updateProvider } from "../providers/providers.sync";
import { updateEntry } from "../timeline/timeline.sync";

// What a device edit queues for upload (B-287). The fixtures hold JSON
// columns in the text form Postgres sends down (`pgJson`), so a write that
// rewrote one unchanged in JSON.stringify's form would show here as a PATCH
// carrying it, and on the server overwrite a co-member's newer value.

const SCHEDULE = { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] } as const;
const PHONES = [
  { label: "Office", number: "(555) 010-3300" },
  { label: "Fax", number: "(555) 010-3301" },
];

const device = (fixtures: Parameters<typeof renderWithDevice>[0]["fixtures"]) =>
  renderWithDevice({ element: <p>Device</p>, fixtures });

/** The one write queued to `type`: its columns. */
const onlyWrite = async (d: Awaited<ReturnType<typeof device>>, type: string) => {
  const queued = (await d.queued()).filter((q) => q.type === type);
  expect(queued).toHaveLength(1);
  return queued[0]?.data ?? {};
};

/** The one PATCH queued, its columns' names sorted. */
const patched = async (d: Awaited<ReturnType<typeof device>>) => {
  const queued = await d.queued();
  expect(queued.map((q) => q.op)).toEqual(["PATCH"]);
  return Object.keys(queued[0]!.data ?? {}).sort();
};

describe("a medication edit", () => {
  const medication = () => fx.medication({ name: "Metoprolol", schedule: SCHEDULE, refillsLeft: 3 });

  test("a refill edit queues a PATCH without the schedule", async () => {
    const med = medication();
    const d = await device(med);
    expect((await updateMedication(d.db, med.id, { refillsLeft: 2, lastFilledOn: "2027-06-08" })).ok).toBe(
      true,
    );
    expect(await patched(d)).toEqual(["last_filled_on", "refills_left", "updated_at"]);
  });

  test("a schedule change sends the schedule (with its change entry)", async () => {
    const med = medication();
    const d = await device(med);
    const schedule = { type: "scheduled", slots: [{ time: "09:00" }, { time: "20:00" }] } as const;
    expect((await updateMedication(d.db, med.id, { schedule })).ok).toBe(true);
    const data = await onlyWrite(d, "medication");
    expect(JSON.parse(data.schedule as string)).toEqual(schedule);
  });

  test("a save with nothing changed queues nothing", async () => {
    const med = medication();
    const d = await device(med);
    expect((await updateMedication(d.db, med.id, { name: "Metoprolol", schedule: SCHEDULE })).ok).toBe(true);
    expect(await d.queued()).toEqual([]);
  });
});

describe("a provider edit", () => {
  const provider = () => fx.provider({ name: "Dr. Iris Vale", phones: PHONES });

  test("a name edit queues a PATCH without the phones", async () => {
    const p = provider();
    const d = await device(p);
    expect((await updateProvider(d.db, p.id, { name: "Dr. Iris Vale-Moss" })).ok).toBe(true);
    expect(await patched(d)).toEqual(["name", "updated_at"]);
  });

  test("a phones change sends the phones", async () => {
    const p = provider();
    const d = await device(p);
    const phones = [PHONES[0]!, { label: "Fax", number: "(555) 010-3309" }];
    expect((await updateProvider(d.db, p.id, { phones })).ok).toBe(true);
    const data = await onlyWrite(d, "provider");
    expect(JSON.parse(data.phones as string)).toEqual(phones);
  });

  test("a save with nothing changed queues nothing", async () => {
    const p = provider();
    const d = await device(p);
    expect((await updateProvider(d.db, p.id, { name: "Dr. Iris Vale", phones: PHONES })).ok).toBe(true);
    expect(await d.queued()).toEqual([]);
  });
});

describe("other JSON columns", () => {
  test("an entry's body edit queues a PATCH without its details; so does a dose's time edit", async () => {
    const symptom = fx.symptom({ name: "Dizziness", severity: 2 });
    const med = fx.medication({ name: "Metoprolol", schedule: SCHEDULE });
    const dose = fx.dose({ medicationId: med.id, scheduledFor: "08:00" });
    const d = await device([symptom, med, dose]);
    expect((await updateEntry(d.db, symptom.id, { body: "After standing up" })).ok).toBe(true);
    const occurredAt = new Date(TEST_NOW - 2 * 3_600_000).toISOString();
    expect((await updateDose(d.db, dose.id, { occurredAt })).ok).toBe(true);
    const queued = await d.queued();
    expect(queued.map((q) => [q.op, q.id, Object.keys(q.data ?? {}).sort()])).toEqual([
      ["PATCH", symptom.id, ["body", "updated_at"]],
      ["PATCH", dose.id, ["occurred_at", "updated_at"]],
    ]);
  });

  test("ending a series at a visit queues a PATCH of its rule without its provider ids", async () => {
    const provider = fx.provider({ name: "Dr. Iris Vale" });
    const walks = series({
      title: "Physio",
      rule: "FREQ=DAILY;INTERVAL=1",
      startsOn: "2027-06-10",
      startTime: "06:00",
      durationMinutes: 60,
      providerIds: pgJson([provider.id]),
      toppedUpThrough: "2027-06-12",
    });
    const visits = ["2027-06-10", "2027-06-11", "2027-06-12"].map((day) =>
      fx.event({
        title: "Physio",
        occurredAt: `${day} 13:00:00.000Z`,
        endsAt: `${day} 14:00:00.000Z`,
        seriesId: walks.id,
        seriesDay: day,
      }),
    );
    const d = await device([provider, walks, visits]);
    const ended = await applySeriesEdit(d.db, {
      visitId: visits[1]!.id,
      scope: "later",
      change: { action: "delete" },
      now: new Date(TEST_NOW),
    });
    expect(ended.ok).toBe(true);
    const seriesWrites = (await d.queued()).filter((q) => q.type === "appointment_series");
    expect(seriesWrites.map((q) => [q.op, Object.keys(q.data ?? {}).sort()])).toEqual([
      ["PATCH", ["rule", "updated_at"]],
    ]);
  });
});
