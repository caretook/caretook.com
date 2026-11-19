import type { RankedHit } from "./searchResults";

import { describe, expect, it } from "vitest";
import {
  compareHits,
  FULL_SECTION_SIZE,
  parseSearchPage,
  resultCountText,
  SECTION_SIZE,
  searchSections,
  sectionLimits,
} from "./searchResults";

const hit = (id: string, over: Partial<RankedHit> = {}): RankedHit => ({
  id,
  type: "entry",
  rank: -1,
  titleMatch: false,
  occurredAt: null,
  ...over,
});

const ids = (hits: readonly RankedHit[]) => hits.map((h) => h.id);

describe("parseSearchPage", () => {
  it("reads the text as typed and the section shown in full", () => {
    expect(parseSearchPage("?q=knee%20pain&all=entry")).toEqual({ q: "knee pain", all: "entry" });
    expect(parseSearchPage("?q= knee ")).toEqual({ q: " knee ", all: null });
    expect(parseSearchPage("")).toEqual({ q: "", all: null });
  });

  it("drops an unknown section, and a section without a search", () => {
    expect(parseSearchPage("?q=knee&all=bogus").all).toBeNull();
    expect(parseSearchPage("?all=entry").all).toBeNull();
    expect(parseSearchPage("?q=%20&all=entry").all).toBeNull();
  });

  it("caps the text at the parser's length", () => {
    expect(parseSearchPage(`?q=${"a".repeat(500)}`).q).toHaveLength(200);
  });
});

describe("sectionLimits", () => {
  it("asks for a few of each, and many of the section shown in full", () => {
    expect(sectionLimits(null)).toEqual({
      provider: SECTION_SIZE,
      medication: SECTION_SIZE,
      entry: SECTION_SIZE,
    });
    expect(sectionLimits("medication").medication).toBe(FULL_SECTION_SIZE);
    expect(sectionLimits("medication").entry).toBe(SECTION_SIZE);
  });
});

describe("compareHits", () => {
  it("puts title matches above text matches, whatever the rank", () => {
    const text = hit("text", { rank: -9 });
    const title = hit("title", { rank: -1, titleMatch: true });
    expect(ids([text, title].sort(compareHits))).toEqual(["title", "text"]);
  });

  it("then orders by rank (lower is better)", () => {
    expect(ids([hit("b", { rank: -1 }), hit("a", { rank: -3 })].sort(compareHits))).toEqual(["a", "b"]);
  });

  it("then puts newer entries first among equals, in either timestamp form", () => {
    const old = hit("old", { occurredAt: "2026-11-01T10:00:00.000Z" });
    const recent = hit("new", { occurredAt: "2026-11-17 10:00:00.000+00" });
    expect(ids([old, recent].sort(compareHits))).toEqual(["new", "old"]);
  });

  it("is stable on the id when everything else is equal", () => {
    expect(ids([hit("b"), hit("a")].sort(compareHits))).toEqual(["a", "b"]);
  });
});

describe("searchSections", () => {
  it("lists providers, medications, then entries, leaving out empty types", () => {
    const sections = searchSections({
      entry: { hits: [hit("e1")], total: 1 },
      provider: { hits: [], total: 0 },
      medication: { hits: [hit("m1", { type: "medication" })], total: 1 },
    });
    expect(sections.map((s) => s.type)).toEqual(["medication", "entry"]);
    expect(sections.map((s) => s.label)).toEqual(["Medications", "Timeline entries"]);
  });

  it("sorts each section best first", () => {
    const [section] = searchSections({
      entry: {
        hits: [
          hit("text-new", { occurredAt: "2026-11-18T00:00:00Z" }),
          hit("title", { titleMatch: true, rank: 0 }),
          hit("text-old", { occurredAt: "2026-11-01T00:00:00Z" }),
        ],
        total: 3,
      },
    });
    expect(ids(section?.hits ?? [])).toEqual(["title", "text-new", "text-old"]);
  });

  it("shows a few per section and counts the rest", () => {
    const hits = Array.from({ length: 8 }, (_, i) => hit(`e${i}`));
    const [section] = searchSections({ entry: { hits, total: 40 } });
    expect(section?.hits).toHaveLength(SECTION_SIZE);
    expect(section).toMatchObject({ total: 40, hidden: 40 - SECTION_SIZE, full: false });
  });

  it("shows the section asked for in full", () => {
    const hits = Array.from({ length: 12 }, (_, i) => hit(`p${i}`, { type: "provider" }));
    const [providers, entries] = searchSections(
      { provider: { hits, total: 12 }, entry: { hits: [hit("e")], total: 1 } },
      { all: "provider" },
    );
    expect(providers).toMatchObject({ full: true, hidden: 0 });
    expect(providers?.hits).toHaveLength(12);
    expect(entries?.full).toBe(false);
  });
});

describe("resultCountText", () => {
  const sections = (totals: Partial<Record<"provider" | "medication" | "entry", number>>) =>
    searchSections(
      Object.fromEntries(Object.entries(totals).map(([type, total]) => [type, { hits: [], total }])),
    );

  it("names each section's total, in page order", () => {
    expect(resultCountText(sections({ entry: 14, medication: 2 }), "x")).toBe("2 medications and 14 entries");
    expect(resultCountText(sections({ entry: 1, medication: 1, provider: 3 }), "x")).toBe(
      "3 providers, 1 medication and 1 entry",
    );
    expect(resultCountText(sections({ provider: 1 }), "x")).toBe("1 provider");
  });

  it("says when nothing matched, naming the search", () => {
    expect(resultCountText([], " knee ")).toBe("No matches for “knee”");
  });
});
