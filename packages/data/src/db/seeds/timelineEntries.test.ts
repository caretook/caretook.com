import { describe, expect, it } from "vitest";
import { timelineEntryContentZSchema } from "../schema";
import { occurredAtOf, SEED_ENTRIES, seedContentOf } from "./timelineEntries";

// Seeds write straight to the table, skipping the service's validation, so
// check them against the same rules the API enforces.
describe("timeline seed entries", () => {
  it("are valid content for their kind", () => {
    const now = Date.now();
    const problems = SEED_ENTRIES.flatMap((entry, index) => {
      const { title, body, details } = seedContentOf(entry);
      const parsed = timelineEntryContentZSchema.safeParse({
        kind: entry.kind,
        title,
        body,
        details,
        occurredAt: occurredAtOf(entry, now).toISOString(),
        timeZone: "America/Los_Angeles",
      });
      return parsed.success
        ? []
        : [{ index, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }];
    });
    expect(problems).toEqual([]);
  });

  it("put every note's text in its live document, not its body", () => {
    const notes = SEED_ENTRIES.filter((e) => e.kind === "note").map(seedContentOf);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.body === null && !!n.documentText?.trim())).toBe(true);
    const others = SEED_ENTRIES.filter((e) => e.kind !== "note").map(seedContentOf);
    expect(others.every((n) => n.documentText === null)).toBe(true);
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
