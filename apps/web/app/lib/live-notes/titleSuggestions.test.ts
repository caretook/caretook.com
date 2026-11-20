import { describe, expect, it } from "vitest";
import { suggestTitles, TITLE_SUGGESTION_LIMIT } from "./titleSuggestions";

const NOW = Date.parse("2026-11-17T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const use = (title: string | null, days: number, deletedAt: string | null = null) => ({
  title,
  occurredAt: daysAgo(days),
  deletedAt,
});

describe("suggestTitles", () => {
  it("ranks by how often a title is used", () => {
    const rows = [use("Eye exam", 1), use("Physical therapy", 2), use("Physical therapy", 3)];
    expect(suggestTitles(rows, 5, NOW)).toEqual(["Physical therapy", "Eye exam"]);
  });

  it("weights uses by how recent they are", () => {
    // Two uses two months ago count for less than one this week.
    const rows = [use("Dentist cleaning", 60), use("Dentist cleaning", 61), use("Pharmacy pickup", 2)];
    expect(suggestTitles(rows, 5, NOW)).toEqual(["Pharmacy pickup", "Dentist cleaning"]);
  });

  it("breaks ties with the more recent title", () => {
    const rows = [use("Older", 5), use("Newer", 5)];
    rows[1]!.occurredAt = new Date(Date.parse(rows[1]!.occurredAt) + 1).toISOString();
    expect(suggestTitles(rows, 5, NOW)).toEqual(["Newer", "Older"]);
  });

  it("dedupes case-insensitively, showing the latest spelling", () => {
    const rows = [use("physical therapy", 4), use("Physical Therapy ", 1), use("PHYSICAL  therapy", 9)];
    expect(suggestTitles(rows, 5, NOW)).toEqual(["Physical Therapy"]);
  });

  it("leaves out the default Event, in any case, and blank titles", () => {
    const rows = [
      use("Event", 1),
      use(" event ", 1),
      use("EVENT", 1),
      use(null, 1),
      use("  ", 1),
      use("Visit", 3),
    ];
    expect(suggestTitles(rows, 5, NOW)).toEqual(["Visit"]);
  });

  it("leaves out deleted entries", () => {
    const rows = [use("Fall (no injury)", 1, daysAgo(0)), use("Family visit", 10)];
    expect(suggestTitles(rows, 5, NOW)).toEqual(["Family visit"]);
  });

  it("returns at most the limit (5 by default)", () => {
    const rows = Array.from({ length: 9 }, (_, i) => use(`Title ${i}`, i));
    expect(suggestTitles(rows, undefined, NOW)).toHaveLength(TITLE_SUGGESTION_LIMIT);
    expect(suggestTitles(rows, undefined, NOW)).toEqual([
      "Title 0",
      "Title 1",
      "Title 2",
      "Title 3",
      "Title 4",
    ]);
    expect(suggestTitles(rows, 2, NOW)).toEqual(["Title 0", "Title 1"]);
    expect(suggestTitles(rows, 0, NOW)).toEqual([]);
  });

  it("counts a future event as now, and skips unreadable times", () => {
    const rows = [use("Planned visit", -3), use("Yesterday", 1), { title: "Bad", occurredAt: "nope" }];
    expect(suggestTitles(rows, 5, NOW)).toEqual(["Planned visit", "Yesterday"]);
  });
});
