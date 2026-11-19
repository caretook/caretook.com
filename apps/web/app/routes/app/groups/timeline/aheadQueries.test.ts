import { describe, expect, it } from "vitest";
import { windowLinksQuery } from "../../../../lib/sync/providers";
import { upcomingQuery, upcomingWindow } from "../../../../lib/sync/timeline";
import { aheadQueries, seeAllSearch } from "./aheadQueries";

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

  it("the Next strip ignores the filters; the block keeps them", () => {
    const filters = { kind: "event", author: AUTHOR } as const;
    const { next, block, blockLinks } = aheadQueries(GROUP, filters, CUTOFF);
    expect(next).toEqual(upcomingQuery(GROUP, NONE, AT));
    expect(block).toEqual(upcomingQuery(GROUP, filters, AT));
    expect(blockLinks).toEqual(windowLinksQuery(upcomingWindow(GROUP, filters, AT)));
  });

  it("ignores anything else in the filters (the upcoming switch)", () => {
    const withSwitch = { kind: null, author: AUTHOR, upcoming: true };
    expect(aheadQueries(GROUP, withSwitch, CUTOFF).block).toEqual(
      upcomingQuery(GROUP, { kind: null, author: AUTHOR }, AT),
    );
  });
});

describe("seeAllSearch", () => {
  it("carries the author, and a kind Upcoming lists", () => {
    expect(seeAllSearch({ kind: "event", author: AUTHOR })).toEqual({ kind: "event", author: AUTHOR });
    expect(seeAllSearch({ kind: "note", author: null })).toEqual({ kind: "note", author: null });
  });

  it("drops a kind Upcoming doesn't list", () => {
    expect(seeAllSearch({ kind: "vital", author: AUTHOR })).toEqual({ kind: null, author: AUTHOR });
    expect(seeAllSearch(NONE)).toEqual(NONE);
  });
});
