import { describe, expect, it } from "vitest";
import { conditionManagerId } from "../schema";
import { seedRows } from "./conditionManagers";

describe("condition provider seeds", () => {
  it("give each condition's providers the pair's id", () => {
    const rows = seedRows();
    for (const row of rows) expect(row.id).toBe(conditionManagerId(row.conditionId, row.providerId));
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});
