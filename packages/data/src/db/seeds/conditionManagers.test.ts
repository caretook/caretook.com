import { describe, expect, it } from "vitest";
import { conditionManagerId } from "../schema";
import { diagnosedByRows, seedRows } from "./conditionManagers";

describe("condition provider seeds", () => {
  it("name who diagnosed three of Grandma Pat's conditions and who manages two, with the pair's ids", () => {
    expect(diagnosedByRows()).toHaveLength(3);
    const rows = seedRows();
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.id).toBe(conditionManagerId(row.conditionId, row.providerId));
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});
