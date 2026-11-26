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

const PERIOD = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const ids = (hits: readonly RankedHit[]) => hits.map((h) => h.id);

describe("parseSearchPage", () => {
  it("reads the text as typed and the section shown in full", () => {
    expect(parseSearchPage("?q=knee%20pain&all=entry")).toEqual({
      q: "knee pain",
      all: "entry",
      period: null,
      tag: null,
    });
    expect(parseSearchPage("?q= knee ")).toEqual({ q: " knee ", all: null, period: null, tag: null });
    expect(parseSearchPage("")).toEqual({ q: "", all: null, period: null, tag: null });
  });

  it("drops an unknown section, and a section without a search", () => {
    expect(parseSearchPage("?q=knee&all=todo").all).toBe("todo");
    expect(parseSearchPage("?q=knee&all=bogus").all).toBeNull();
    expect(parseSearchPage("?all=entry").all).toBeNull();
    expect(parseSearchPage("?q=%20&all=entry").all).toBeNull();
  });

  it("reads a care period only with a search, and only a row id", () => {
    expect(parseSearchPage(`?q=knee&period=${PERIOD.toUpperCase()}`).period).toBe(PERIOD);
    expect(parseSearchPage(`?period=${PERIOD}`).period).toBeNull();
    expect(parseSearchPage(`?q=%20&period=${PERIOD}`).period).toBeNull();
    expect(parseSearchPage("?q=knee&period=rehab").period).toBeNull();
  });

  it("reads a tag (lower-case, only an id), with or without a search; with one, a full section needs no text", () => {
    const TAG = "9a77e3f1-5d1a-4c2e-0b6f-3c1e2b8c0bbb";
    expect(parseSearchPage(`?tag=${TAG.toUpperCase()}`)).toEqual({
      q: "",
      all: null,
      period: null,
      tag: TAG,
    });
    expect(parseSearchPage(`?q=knee&tag=${TAG}`).tag).toBe(TAG);
    expect(parseSearchPage("?tag=urgent").tag).toBeNull();
    expect(parseSearchPage(`?tag=${TAG}&all=todo`).all).toBe("todo");
    expect(parseSearchPage(`?tag=${TAG}&period=${PERIOD}`).period).toBeNull();
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
      todo: SECTION_SIZE,
      entry: SECTION_SIZE,
      condition: SECTION_SIZE,
    });
    expect(sectionLimits("condition").condition).toBe(FULL_SECTION_SIZE);
    expect(sectionLimits("medication").medication).toBe(FULL_SECTION_SIZE);
    expect(sectionLimits("medication").entry).toBe(SECTION_SIZE);
    expect(sectionLimits("todo").todo).toBe(FULL_SECTION_SIZE);
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

  it("puts todos after medications and before entries", () => {
    const sections = searchSections({
      entry: { hits: [hit("e1")], total: 1 },
      todo: { hits: [hit("t1", { type: "todo" })], total: 1 },
      medication: { hits: [hit("m1", { type: "medication" })], total: 1 },
      provider: { hits: [hit("p1", { type: "provider" })], total: 1 },
    });
    expect(sections.map((s) => s.type)).toEqual(["provider", "medication", "todo", "entry"]);
    expect(sections.map((s) => s.label)).toEqual(["Providers", "Medications", "Todos", "Timeline entries"]);
  });

  it("puts conditions after medications and before todos", () => {
    const sections = searchSections({
      entry: { hits: [hit("e1")], total: 1 },
      todo: { hits: [hit("t1", { type: "todo" })], total: 1 },
      condition: { hits: [hit("c1", { type: "condition" })], total: 1 },
      medication: { hits: [hit("m1", { type: "medication" })], total: 1 },
    });
    expect(sections.map((s) => s.type)).toEqual(["medication", "condition", "todo", "entry"]);
    expect(sections.map((s) => s.label)).toEqual(["Medications", "Conditions", "Todos", "Timeline entries"]);
    expect(resultCountText(sections, "x")).toBe("1 medication, 1 condition, 1 todo and 1 entry");
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
  const sections = (totals: Partial<Record<"provider" | "medication" | "todo" | "entry", number>>) =>
    searchSections(
      Object.fromEntries(Object.entries(totals).map(([type, total]) => [type, { hits: [], total }])),
    );

  it("names each section's total, in page order", () => {
    expect(resultCountText(sections({ entry: 14, medication: 2 }), "x")).toBe("2 medications and 14 entries");
    expect(resultCountText(sections({ entry: 1, medication: 1, provider: 3 }), "x")).toBe(
      "3 providers, 1 medication and 1 entry",
    );
    expect(resultCountText(sections({ provider: 1 }), "x")).toBe("1 provider");
    expect(resultCountText(sections({ entry: 2, todo: 1 }), "x")).toBe("1 todo and 2 entries");
    expect(resultCountText(sections({ todo: 3 }), "x")).toBe("3 todos");
  });

  it("says when nothing matched, naming the search", () => {
    expect(resultCountText([], " knee ")).toBe("No matches for “knee”");
  });

  it("names the tag: with text, and with none", () => {
    expect(resultCountText([], "knee", "Urgent")).toBe("No matches for “knee” tagged “Urgent”");
    expect(resultCountText([], " ", "Urgent")).toBe("Nothing is tagged “Urgent”");
    expect(resultCountText(sections({ todo: 2 }), "", "Urgent")).toBe("2 todos");
  });
});
