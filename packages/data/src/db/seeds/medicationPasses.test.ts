import { describe, expect, it } from "vitest";
import { medicationPassContentZSchema } from "../schema";
import { seedPassRows } from "./medicationPasses";

describe("seeded passes", () => {
  it("are valid, with unique ids", () => {
    const rows = seedPassRows();
    for (const row of rows) expect(medicationPassContentZSchema.safeParse(row).success).toBe(true);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});
