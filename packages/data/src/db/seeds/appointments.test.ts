import { describe, expect, it } from "vitest";
import { timelineEntryContentZSchema } from "../schema";
import { seedRows } from "./appointments";

// Seeds write straight to the table, skipping the service, so check them
// against the same rules the API enforces, at any seeding time.
describe("appointment seeds", () => {
  const now = Date.now();
  const groups = seedRows(now);

  it("are valid content for their kind", () => {
    const problems = groups.flatMap(({ rows }) =>
      rows.flatMap((row) => {
        const parsed = timelineEntryContentZSchema.safeParse(row.content);
        return parsed.success
          ? []
          : [{ id: row.id, issues: parsed.error.issues.map((i) => i.path.join(".")) }];
      }),
    );
    expect(problems).toEqual([]);
  });

  it("point a rescheduled event at a live one in its own list", () => {
    for (const { rows } of groups) {
      const ids = new Set(rows.map((r) => r.id));
      for (const row of rows.filter((r) => r.content.rescheduledTo)) {
        expect(row.content.cancelledAt).not.toBeNull();
        expect(ids.has(row.content.rescheduledTo!)).toBe(true);
      }
    }
  });

  it("keep their own ids", () => {
    const ids = groups.flatMap(({ rows }) => rows.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
