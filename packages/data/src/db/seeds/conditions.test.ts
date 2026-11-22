import { describe, expect, it } from "vitest";
import { recipientConditionContentZSchema } from "../schema";
import { seedRows } from "./conditions";

// Seeds write straight to the table, skipping the service's validation, so
// check them against the same rules the API enforces.

describe("condition seeds", () => {
  it("are valid conditions with their own ids", () => {
    const rows = seedRows();
    for (const { id: _id, groupId: _g, recipientId: _r, ...content } of rows)
      expect(recipientConditionContentZSchema.safeParse(content).success).toBe(true);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});
