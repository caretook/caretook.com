import { describe, expect, it } from "vitest";
import { medicationPassContentZSchema } from "../schema";
import { DEV_GROUP_ID } from "./careGroups";
import { seedPassRows } from "./medicationPasses";
import { SECOND_GROUP_ID } from "./secondGroup";

describe("seeded passes", () => {
  it("gives both seeded groups Morning 08:00 and Evening 20:00, valid and with unique ids", () => {
    const rows = seedPassRows();
    for (const groupId of [DEV_GROUP_ID, SECOND_GROUP_ID])
      expect(rows.filter((r) => r.groupId === groupId).map((r) => [r.name, r.time, r.sortOrder])).toEqual([
        ["Morning", "08:00", 0],
        ["Evening", "20:00", 1],
      ]);
    for (const row of rows) expect(medicationPassContentZSchema.safeParse(row).success).toBe(true);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});
