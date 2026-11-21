import { describe, expect, it } from "vitest";
import { upcomingQuery } from "../../../../lib/timeline/timeline.sync";
import { aheadQueries } from "./aheadQueries";

const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const AUTHOR = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c00a1";
const CUTOFF = "2026-11-18T18:01:00.000Z";
const AT = new Date(CUTOFF);
const NONE = { kind: null, author: null };

describe("aheadQueries", () => {
  it("starts what's ahead at the history's cutoff", () => {
    const { next } = aheadQueries(GROUP, NONE, CUTOFF);
    expect(next).toEqual(upcomingQuery(GROUP, NONE, AT));
    expect(next.params).toContain("2026-11-18T18:01:00.000000Z");
  });

  it("ignores the kind and author filters", () => {
    const filters = { kind: "event", author: AUTHOR } as const;
    expect(aheadQueries(GROUP, filters, CUTOFF).next).toEqual(upcomingQuery(GROUP, NONE, AT));
  });
});

describe("aheadQueries with a search", () => {
  const match = { sql: "timeline_entry.id IN (SELECT 1)", params: ["fall*", GROUP] };

  it("keeps the search", () => {
    const filters = { kind: "event", author: AUTHOR, match } as const;
    const { next } = aheadQueries(GROUP, filters, CUTOFF);
    expect(next).toEqual(upcomingQuery(GROUP, { kind: null, author: null, match }, AT));
    expect(next.sql).toContain("(timeline_entry.id IN (SELECT 1))");
    expect(next.params.slice(0, 4)).toEqual([GROUP, "event", "fall*", GROUP]);
  });

  it("no search is no condition", () => {
    expect(aheadQueries(GROUP, { ...NONE, match: null }, CUTOFF)).toEqual(aheadQueries(GROUP, NONE, CUTOFF));
  });
});
