import { describe, expect, it } from "vitest";
import { medicationConditionId } from "../schema";
import { seedRows } from "./medicationConditions";

describe("medication condition seeds", () => {
  it("link three of Grandma Pat's medications to her conditions, with the pair's ids", () => {
    const rows = seedRows();
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.id).toBe(medicationConditionId(row.medicationId, row.conditionId));
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});
