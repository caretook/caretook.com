import { describe, expect, it } from "vitest";
import { timelineEntryContentZSchema } from "../schema";
import { occurredAtOf, SEED_ENTRIES } from "./timelineEntries";

// Seeds write straight to the table, skipping the service's validation, so
// check them against the same rules the API enforces.
describe("timeline seed entries", () => {
  it("are valid content for their kind", () => {
    const now = Date.now();
    const problems = SEED_ENTRIES.flatMap((entry, index) => {
      const parsed = timelineEntryContentZSchema.safeParse({
        kind: entry.kind,
        title: entry.title,
        body: entry.body,
        details: entry.details,
        occurredAt: occurredAtOf(entry, now).toISOString(),
        timeZone: "America/Los_Angeles",
      });
      return parsed.success
        ? []
        : [{ index, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }];
    });
    expect(problems).toEqual([]);
  });

  it("places `at` entries at that local time", () => {
    const now = Date.UTC(2026, 10, 17, 20, 0); // 12:00 PM in Los Angeles
    const when = occurredAtOf(
      { at: { daysAgo: 2, time: "07:45" }, author: "member@example.com", kind: "note" },
      now,
    );
    expect(when.toISOString()).toBe("2026-11-15T15:45:00.000Z");
  });
});
