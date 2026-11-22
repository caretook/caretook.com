import { describe, expect, it } from "vitest";
import { timelineEntryContentZSchema } from "../schema";
import { USERS } from "./users";
import { MORE_USERS } from "./moreGroups";
import { seedRows, TEDDER_ENTRIES, TEDDER_SERIES, TEDDER_TODOS, TEDDER_USERS } from "./tedderFamily";

// Seeds write straight to the tables, skipping the services' validation, so
// check them against the same rules the API enforces.
const NOW = Date.UTC(2026, 10, 17, 20, 0);
const DAY = 24 * 60 * 60 * 1000;

describe("Tedder Family seed", () => {
  it("writes valid timeline entries, doses and change entries", () => {
    const rows = seedRows(NOW);
    const all = [
      ...rows.entries.map((e) => e.row),
      ...rows.doses.map((d) => d.row),
      ...rows.medications.flatMap((m) => (m.changeEntry ? [m.changeEntry] : [])),
    ];
    for (const { id: _id, groupId: _g, recipientId: _r, ...content } of all) {
      const parsed = timelineEntryContentZSchema.safeParse(content);
      expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
    }
  });

  it("has a long, quiet history with gaps of days", () => {
    const days = new Set(
      seedRows(NOW).entries.map((e) => Math.floor((NOW - Date.parse(e.row.occurredAt)) / DAY)),
    );
    expect(Math.max(...days)).toBeGreaterThan(150);
    // Fewer than half the days have an entry.
    expect(days.size).toBeLessThan(90);
    expect(TEDDER_ENTRIES.length).toBeLessThan(200);
  });

  it("has one repeating series and mostly undated todos", () => {
    expect(TEDDER_SERIES).toHaveLength(1);
    const dated = TEDDER_TODOS.filter((t) => t.dueIn !== undefined);
    expect(dated.length).toBeLessThanOrEqual(2);
    expect(TEDDER_TODOS.length - dated.length).toBeGreaterThan(dated.length);
  });

  it("logs no dose in the future", () => {
    for (const { row } of seedRows(NOW).doses) expect(Date.parse(row.occurredAt)).toBeLessThanOrEqual(NOW);
  });

  it("uses its own users only", () => {
    const others = new Set([...USERS, ...MORE_USERS].map((u) => u.email));
    for (const u of TEDDER_USERS) expect(others.has(u.email)).toBe(false);
  });

  it("gives every row its own id", () => {
    const r = seedRows(NOW);
    const ids = [
      ...r.entries.map((e) => e.row.id),
      ...r.doses.map((d) => d.row.id),
      ...r.medications.flatMap((m) => [m.row.id, m.changeEntry?.id ?? ""]),
      ...r.providers.map((p) => p.id),
      ...r.passes.map((p) => p.id),
      ...r.appointments.map((a) => a.id),
      ...r.series.flatMap((s) => [s.row.id, ...s.visits.map((v) => v.id)]),
      ...r.todos.map((t) => t.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
