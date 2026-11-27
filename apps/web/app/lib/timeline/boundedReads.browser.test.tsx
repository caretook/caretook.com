import type { DoseChoiceRow } from "../medications/medicationTimeline.sync";
import type { ReadingRow } from "./timeline.sync";

import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../test/device";
import { at, fx, TEST_GROUP } from "../../../test/fixtures";
import { doseChoicesQuery } from "../medications/medicationTimeline.sync";
import { readingsQuery, toLatestVitals } from "./timeline.sync";

// The timeline's latest vitals and the Dose sheet's choices read what they
// show, on the device's own SQLite (B-313): the newest reading of each type,
// not every reading in the group; each medication's last dose from one pass
// over the doses, not a pass per medication. What they answer is what the
// unbounded queries answered.

const hoursAgo = (h: number) => at(new Date(Date.now() - h * 3_600_000));
const GROUP = TEST_GROUP.id;

/** The queries as they were, for comparison: every reading, and a dose scan per medication. */
const EVERY_READING = `SELECT e.id AS entry_id, e.occurred_at, r.value AS reading
  FROM timeline_entry e, json_each(e.details, '$.readings') r
  WHERE e.group_id = ? AND e.kind = 'vital' AND e.deleted_at IS NULL
  ORDER BY e.occurred_at DESC, e.id DESC`;
const DOSES_PER_MEDICATION = `SELECT m.id, m.name, m.strength, m.dose,
    (SELECT MAX(e.occurred_at) FROM timeline_entry e
      WHERE e.group_id = m.group_id AND e.kind = 'dose' AND e.deleted_at IS NULL
        AND json_extract(e.details, '$.status') = 'given'
        AND json_extract(e.details, '$.medicationId') = m.id) AS last_given
  FROM medication m
  WHERE m.group_id = ? AND m.deleted_at IS NULL AND m.status = 'current' AND m.name IS NOT NULL
  ORDER BY last_given IS NULL, last_given DESC, m.name COLLATE NOCASE, m.id`;

const open = (fixtures: Parameters<typeof renderWithDevice>[0]["fixtures"]) =>
  renderWithDevice({ element: <p>Device</p>, fixtures });

describe("bounded local reads", () => {
  test("latest vitals: one row per type, the same newest readings", async () => {
    const heart = (h: number, value: number) =>
      fx.vital({ occurredAt: hoursAgo(h), readings: [{ type: "heartRate", value }] });
    const both = fx.vital({
      occurredAt: hoursAgo(3),
      readings: [
        { type: "bloodPressure", systolic: 124, diastolic: 80 },
        { type: "heartRate", value: 70 },
      ],
    } as never);
    const removed = fx.vital({
      occurredAt: hoursAgo(1),
      deletedAt: hoursAgo(1),
      readings: [{ type: "heartRate", value: 99 }],
    });
    const device = await open([
      heart(2, 66),
      both,
      heart(5, 61),
      heart(8, 64),
      removed,
      fx.vital({
        occurredAt: hoursAgo(9),
        readings: [{ type: "bloodPressure", systolic: 130, diastolic: 85 }],
      } as never),
      fx.vital({ occurredAt: hoursAgo(4), readings: [{ type: "notAVital", value: 1 }] } as never),
    ]);

    const every = await device.query<ReadingRow>(EVERY_READING, [GROUP]);
    const { sql, params } = readingsQuery(GROUP);
    const newest = await device.query<ReadingRow>(sql, params);

    expect(every).toHaveLength(7);
    // heartRate, bloodPressure and the unknown type (which `toLatestVitals` skips, as before).
    expect(newest).toHaveLength(3);
    expect(toLatestVitals(newest)).toEqual(toLatestVitals(every));
    expect(toLatestVitals(newest).map((v) => [v.reading.type, v.entryId])).toEqual([
      ["heartRate", every[0]!.entry_id],
      ["bloodPressure", both.id],
    ]);
  });

  test("dose choices: one pass over the doses, the same choices in the same order", async () => {
    const meds = ["Metformin", "lisinopril", "Atorvastatin", "Zinc"].map((name) => fx.medication({ name }));
    const [metformin, lisinopril, atorvastatin] = meds;
    const dose = (medicationId: string, h: number, v: Record<string, unknown> = {}) =>
      fx.dose({ medicationId, occurredAt: hoursAgo(h), ...v });
    const device = await open([
      meds,
      fx.medication({ name: "Old pill", status: "stopped" }),
      dose(metformin!.id, 5),
      dose(metformin!.id, 30),
      dose(lisinopril!.id, 2, { status: "skipped" }),
      dose(lisinopril!.id, 10),
      dose(atorvastatin!.id, 1, { deletedAt: hoursAgo(1) }),
      dose(atorvastatin!.id, 50),
    ]);

    const before = await device.query<DoseChoiceRow>(DOSES_PER_MEDICATION, [GROUP]);
    const { sql, params } = doseChoicesQuery(GROUP);
    const after = await device.query<DoseChoiceRow>(sql, params);
    expect(after).toEqual(before);
    expect(after.map((r) => r.name)).toEqual(["Metformin", "lisinopril", "Atorvastatin", "Zinc"]);

    // The plan: the per-medication scan was a correlated subquery; it's gone.
    const plan = async (q: string, p: unknown[]) =>
      (await device.query<{ detail: string }>(`EXPLAIN QUERY PLAN ${q}`, p)).map((r) => r.detail).join("\n");
    expect(await plan(DOSES_PER_MEDICATION, [GROUP])).toMatch(/CORRELATED/);
    expect(await plan(sql, params)).not.toMatch(/CORRELATED/);
  });
});
