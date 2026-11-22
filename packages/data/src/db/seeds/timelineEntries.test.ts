import { describe, expect, it } from "vitest";
import { timelineEntryContentZSchema } from "../schema";
import { SECOND_GROUP_ENTRIES } from "./secondGroup";
import { occurredAtOf, SEED_ENTRIES as DEV_FAMILY_ENTRIES, seedContentOf } from "./timelineEntries";

// Every seeded group's entries: Dev Family's, then Dev Family 2's.
const SEED_ENTRIES = [...DEV_FAMILY_ENTRIES, ...SECOND_GROUP_ENTRIES];

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
  });

  it("give every event a live document, and no body", () => {
    const events = SEED_ENTRIES.filter((e) => e.kind === "event").map(seedContentOf);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.body === null && typeof e.documentText === "string")).toBe(true);
    // Some events have notes in their document.
    expect(events.some((e) => !!e.documentText?.trim())).toBe(true);
  });

  it("give symptoms and vitals no document", () => {
    const others = SEED_ENTRIES.filter((e) => e.kind !== "note" && e.kind !== "event").map(seedContentOf);
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
