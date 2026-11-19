import { describe, expect, it } from "vitest";
import { timelineLinksQuery } from "./providers";
import { entriesQuery, entryWindow, historyQuery, upcomingQuery, upcomingWindow } from "./timeline";

const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const AUTHOR = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c00a1";
const one = (sql: string) => sql.replace(/\s+/g, " ").trim();
const TAIL = "ORDER BY occurred_at DESC, id DESC LIMIT ?";
// The history's end (`historyWindow`): notes and events once they've started.
const CUTOFF = "2026-11-18T18:01:00.000Z";
const CUTOFF_LOCAL = "2026-11-18T18:01:00.000000Z";
const ENDS = "AND (NOT kind IN ('note', 'event') OR occurred_at <= ?)";
/** A window's parameters with the cutoff before the limit. */
const withCutoff = (params: readonly unknown[]) => [...params.slice(0, -1), CUTOFF_LOCAL, params.at(-1)];

// Each case: the filters, the window's conditions, and its parameters in order (limit 30 asks for 31).
const CASES = [
  {
    name: "neither filter",
    filters: { kind: null, author: null },
    // Without a kind, only the kinds the timeline shows (doses and medication changes wait for medications slice 4).
    where: "group_id = ? AND deleted_at IS NULL AND kind IN ('note', 'symptom', 'event', 'vital')",
    params: [GROUP, 31],
  },
  {
    name: "a kind",
    filters: { kind: "symptom", author: null },
    where: "group_id = ? AND deleted_at IS NULL AND kind = ?",
    params: [GROUP, "symptom", 31],
  },
  {
    name: "an author",
    filters: { kind: null, author: AUTHOR },
    where:
      "group_id = ? AND deleted_at IS NULL AND kind IN ('note', 'symptom', 'event', 'vital') AND created_by = ?",
    params: [GROUP, AUTHOR, 31],
  },
  {
    name: "both",
    filters: { kind: "note", author: AUTHOR },
    where: "group_id = ? AND deleted_at IS NULL AND kind = ? AND created_by = ?",
    params: [GROUP, "note", AUTHOR, 31],
  },
] as const;

describe("the timeline's window (entryWindow)", () => {
  for (const { name, filters, where, params } of CASES) {
    it(`${name}: the condition and its parameters, in order`, () => {
      const window = entryWindow(GROUP, filters, 30);
      expect(one(window.sql)).toBe(`FROM timeline_entry WHERE ${where} ${TAIL}`);
      expect(window.params).toEqual(params);
    });

    it(`${name}: entriesQuery selects that window`, () => {
      const query = entriesQuery(GROUP, filters, 30);
      expect(one(query.sql)).toBe(`SELECT * FROM timeline_entry WHERE ${where} ${TAIL}`);
      expect(query.params).toEqual(params);
    });

    it(`${name}: historyQuery selects that window, ending at the cutoff`, () => {
      const query = historyQuery(GROUP, filters, 30, CUTOFF);
      expect(one(query.sql)).toBe(`SELECT * FROM timeline_entry WHERE ${where} ${ENDS} ${TAIL}`);
      expect(query.params).toEqual(withCutoff(params));
    });

    it(`${name}: timelineLinksQuery reads the links of the history's entries`, () => {
      const query = timelineLinksQuery(GROUP, filters, 30, CUTOFF);
      expect(one(query.sql)).toBe(
        "SELECT l.entry_id, l.provider_id, p.name, p.deleted_at " +
          "FROM timeline_entry_provider l JOIN provider p ON p.id = l.provider_id " +
          `WHERE l.entry_id IN (SELECT id FROM timeline_entry WHERE ${where} ${ENDS} ${TAIL}) ` +
          "ORDER BY l.entry_id, l.created_at, l.id",
      );
      expect(query.params).toEqual(withCutoff(params));
    });
  }

  it("one placeholder per parameter", () => {
    for (const { filters } of CASES) {
      const query = timelineLinksQuery(GROUP, filters, 30, CUTOFF);
      expect(query.sql.split("?").length - 1).toBe(query.params.length);
    }
  });

  it("the limit grows with the page", () => {
    expect(entryWindow(GROUP, { kind: null, author: null }, 60).params).toEqual([GROUP, 61]);
  });
});

describe("upcomingQuery (the Next strip and the Upcoming block)", () => {
  it("selects upcomingWindow's rows", () => {
    const now = new Date("2026-11-18T18:01:00.000Z");
    const filters = { kind: "event", author: AUTHOR } as const;
    const window = upcomingWindow(GROUP, filters, now);
    const query = upcomingQuery(GROUP, filters, now);
    expect(query.sql).toBe(`SELECT * ${window.sql}`);
    expect(query.params).toEqual(window.params);
  });
});
