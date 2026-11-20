import { describe, expect, it } from "vitest";
import { taskContentZSchema, taskState } from "../schema";
import { seedRows } from "./tasks";

// Seeds write straight to the table, skipping the service's validation, so
// check them against the same rules the API enforces.

const NOW = Date.UTC(2026, 10, 17, 20, 0);
const ZONE = "America/Los_Angeles";
const SOMEONE = "0b6f3c1e-5d1a-4c2e-9a77-000000000001";

describe("task seeds", () => {
  it("are valid tasks", () => {
    for (const { assignee, author: _author, doneBy, ...row } of seedRows(NOW)) {
      const content = {
        ...row,
        assigneeId: assignee ? SOMEONE : null,
        doneBy: doneBy ? SOMEONE : null,
      };
      expect(taskContentZSchema.safeParse(content).success).toBe(true);
    }
  });

  it("cover every state, a typed name and an unassigned task", () => {
    const rows = seedRows(NOW);
    const states = new Set(rows.map((r) => taskState(r, NOW, ZONE)));
    expect([...states].sort()).toEqual(["done", "overdue", "today", "undated", "upcoming"]);
    expect(rows.some((r) => r.assigneeName === "Aunt May")).toBe(true);
    expect(rows.some((r) => !r.assignee && !r.assigneeName && !r.doneAt)).toBe(true);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it("link a provider, an upcoming appointment and a current medication, after the first nine", () => {
    const rows = seedRows(NOW);
    const linked = rows.filter((r) => r.providerId || r.medicationId || r.eventId);
    expect(linked.map((r) => r.id)).toEqual([
      "0b6f3c1e-5d1a-4c2e-9a77-3f1d2be01010",
      "0b6f3c1e-5d1a-4c2e-9a77-3f1d2be01011",
      "0b6f3c1e-5d1a-4c2e-9a77-3f1d2be01012",
    ]);
    expect(linked.map((r) => [!!r.providerId, !!r.eventId, !!r.medicationId])).toEqual([
      [true, false, false],
      [false, true, false],
      [false, false, true],
    ]);
  });
});
