import type { CarePeriodRow } from "./carePeriods.sync";

import { describe, expect, it } from "vitest";
import { carePeriodsQuery, toCarePeriod, toPeriodSpans } from "./carePeriods.sync";

const row = (overrides: Partial<CarePeriodRow> = {}): CarePeriodRow => ({
  id: "p1",
  group_id: "g",
  recipient_id: "r",
  type: "hospital",
  label: "Cardiac unit",
  place_provider_id: null,
  place_detail: "Room 412",
  started_at: "2026-11-12T22:20:00.000000Z",
  date_only: 0,
  deleted_at: null,
  created_at: "2026-11-12T22:21:00.000000Z",
  updated_at: "2026-11-12T22:21:00.000000Z",
  created_by: "u",
  updated_by: "u",
  ...overrides,
});

describe("care periods on the device", () => {
  it("reads a local row: PowerSync's timestamps as ISO, date_only as a boolean", () => {
    expect(toCarePeriod(row({ date_only: 1 }))).toMatchObject({
      id: "p1",
      groupId: "g",
      type: "hospital",
      startedAt: "2026-11-12T22:20:00.000Z",
      dateOnly: true,
      deletedAt: null,
    });
  });

  it("shows a type from a newer build as Other, and skips a half-synced row", () => {
    expect(toCarePeriod(row({ type: "spaceStation" }))?.type).toBe("other");
    expect(toCarePeriod(row({ group_id: null }))).toBeNull();
    expect(toCarePeriod(row({ started_at: null }))).toBeNull();
  });

  it("makes the track from rows, leaving deleted ones off", () => {
    const spans = toPeriodSpans([
      row({ id: "b", started_at: "2026-11-15T08:00:00.000000Z" }),
      row({ id: "a" }),
      row({ id: "c", started_at: "2026-11-14T08:00:00.000000Z", deleted_at: "2026-11-16T00:00:00.000000Z" }),
    ]);
    expect(spans.map((s) => [s.period.id, s.endsAt])).toEqual([
      ["a", "2026-11-15T08:00:00.000Z"],
      ["b", null],
    ]);
  });

  it("queries the group's periods in track order, deleted ones only when asked for", () => {
    expect(carePeriodsQuery("g").sql).toMatch(/deleted_at IS NULL[\s\S]*ORDER BY started_at, created_at, id/);
    expect(carePeriodsQuery("g", { includeDeleted: true }).sql).not.toMatch(/deleted_at IS NULL/);
    expect(carePeriodsQuery("g").params).toEqual(["g"]);
  });
});
