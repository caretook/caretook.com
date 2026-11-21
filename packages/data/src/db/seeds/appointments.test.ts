import { describe, expect, it } from "vitest";
import { timelineEntryContentZSchema } from "../schema";
import { DEV_FAMILY_APPOINTMENTS, SECOND_GROUP_APPOINTMENTS, seedRows } from "./appointments";

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

  it("give Dev Family about eight upcoming items over three weeks, and two past cancelled events", () => {
    const [devFamily] = groups;
    const upcoming = devFamily!.rows.filter((r) => new Date(r.content.occurredAt).getTime() > now);
    expect(upcoming.length).toBeGreaterThanOrEqual(8);
    expect(upcoming.every((r) => new Date(r.content.occurredAt).getTime() < now + 22 * 86_400_000)).toBe(
      true,
    );
    const pastCancelled = devFamily!.rows.filter(
      (r) => new Date(r.content.occurredAt).getTime() < now && r.content.cancelledAt,
    );
    expect(pastCancelled).toHaveLength(2);
    expect(devFamily!.rows.some((r) => r.content.allDay)).toBe(true);
    expect(devFamily!.rows.some((r) => r.content.endsAt)).toBe(true);
    expect(devFamily!.rows.every((r) => r.content.kind === "event")).toBe(true);
    expect(devFamily!.links.length).toBeGreaterThanOrEqual(2);
  });

  it("point a rescheduled event at a live one in its own list", () => {
    for (const { rows } of groups) {
      const ids = new Set(rows.map((r) => r.id));
      for (const row of rows.filter((r) => r.content.rescheduledTo)) {
        expect(row.content.cancelledAt).not.toBeNull();
        expect(ids.has(row.content.rescheduledTo!)).toBe(true);
      }
    }
    expect(groups[0]!.rows.filter((r) => r.content.rescheduledTo)).toHaveLength(1);
  });

  it("keep their own ids, and give Dev Family 2 one appointment", () => {
    const ids = groups.flatMap(({ rows }) => rows.map((r) => r.id));
    expect(new Set(ids).size).toBe(DEV_FAMILY_APPOINTMENTS.length + SECOND_GROUP_APPOINTMENTS.length);
    expect(groups[1]!.rows).toHaveLength(1);
  });
});
