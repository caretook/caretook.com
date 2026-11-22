import { describe, expect, it } from "vitest";
import { todoContentZSchema, todoState } from "../schema";
import { nextOccurrence } from "../schema/appointments/todoRepeat";
import { seedRows } from "./todos";

// Seeds write straight to the table, skipping the service's validation, so
// check them against the same rules the API enforces.

const NOW = Date.UTC(2026, 10, 17, 20, 0);
const ZONE = "America/Los_Angeles";
const SOMEONE = "0b6f3c1e-5d1a-4c2e-9a77-000000000001";

describe("todo seeds", () => {
  it("are valid todos", () => {
    for (const { assignee, author: _author, doneBy, ...row } of seedRows(NOW)) {
      const content = {
        ...row,
        assigneeId: assignee ? SOMEONE : null,
        doneBy: doneBy ? SOMEONE : null,
      };
      expect(todoContentZSchema.safeParse(content).success).toBe(true);
    }
  });

  it("cover every state, with their own ids", () => {
    const rows = seedRows(NOW);
    const states = new Set(rows.map((r) => todoState(r, NOW, ZONE)));
    expect([...states].sort()).toEqual(["done", "overdue", "today", "undated", "upcoming"]);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it("chain repeating todos to a seeded first one, the next of a done one being seeded too", () => {
    const rows = seedRows(NOW);
    const ids = new Set(rows.map((r) => r.id));
    const chained = rows.filter((r) => r.repeatId);
    expect(chained.length).toBeGreaterThan(0);
    for (const r of chained) expect(ids.has(r.repeatId!)).toBe(true);
    for (const done of chained.filter((r) => r.doneAt)) {
      const next = nextOccurrence({ ...done, assigneeId: null }, "2026-11-17");
      expect(rows.find((r) => r.id === next?.id)?.dueOn).toBe(next?.dueOn);
    }
  });
});
