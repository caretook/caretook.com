import type { ListedProvider } from "./providerDirectory";

import { describe, expect, it } from "vitest";
import {
  clearFilters,
  clearTag,
  clearType,
  compareProviders,
  directoryList,
  matchesQuery,
  parseDirectoryFilters,
  queryTokens,
  setQuery,
  setTag,
  setType,
} from "./providerDirectory";

const TAG = "1f0e9d8c-7b6a-4954-8a3b-2c1d0e9f8a7b";
const OTHER_TAG = "2a1b0c9d-8e7f-4a6b-9c5d-4e3f2a1b0c9d";

describe("parseDirectoryFilters", () => {
  it("reads q and type", () => {
    expect(parseDirectoryFilters("?q=%20cardio%20&type=clinician")).toEqual({
      q: "cardio",
      type: "clinician",
      tag: null,
    });
    expect(parseDirectoryFilters("")).toEqual({ q: "", type: null, tag: null });
  });
  it("ignores unknown values", () => {
    expect(parseDirectoryFilters("type=dentist")).toEqual({ q: "", type: null, tag: null });
  });
});

describe("filter changes", () => {
  it("set and clear each filter, keeping the others and unknown parameters", () => {
    expect(setQuery("?type=pharmacy&x=1", "corner")).toBe("?q=corner&type=pharmacy&x=1");
    expect(setQuery("?q=corner&type=pharmacy", "  ")).toBe("?type=pharmacy");
    expect(setType("?q=dr", "clinician")).toBe("?q=dr&type=clinician");
    expect(clearType("?q=dr&type=clinician&x=1")).toBe("?q=dr&x=1");
  });
  it("return the search unchanged when nothing changes", () => {
    expect(setType("?type=clinician&z=2", "clinician")).toBe("?type=clinician&z=2");
    expect(clearType("?z=2")).toBe("?z=2");
    expect(setQuery("?q=dr", " dr ")).toBe("?q=dr");
    // @ts-expect-error: only known types.
    expect(setType("?q=a", "dentist")).toBe("?q=a");
  });
});

let n = 0;
const provider = (p: Partial<ListedProvider> & { name: string }): ListedProvider => ({
  id: `p${++n}`,
  type: "clinician",
  specialty: null,
  practiceId: null,
  status: "current",
  isPrimary: false,
  ...p,
});

describe("compareProviders", () => {
  it("puts primary first, then current, then past, each by name", () => {
    const list = [
      provider({ name: "Zed", status: "past" }),
      provider({ name: "bea" }),
      provider({ name: "Amy", status: "past", isPrimary: true }),
      provider({ name: "Yolanda", isPrimary: true }),
      provider({ name: "Ana" }),
      provider({ name: "Carl", isPrimary: true }),
    ];
    expect(list.sort(compareProviders).map((p) => p.name)).toEqual([
      "Carl",
      "Yolanda",
      "Ana",
      "bea",
      "Amy",
      "Zed",
    ]);
  });
});

describe("matchesQuery", () => {
  const patel = provider({ name: "Dr. Samuel Patel", specialty: "Cardiology" });
  it("matches every word somewhere in the name, specialty or practice, ignoring case and accents", () => {
    expect(matchesQuery(patel, queryTokens("cardio"))).toBe(true);
    expect(matchesQuery(patel, queryTokens("PATEL cardio"))).toBe(true);
    expect(matchesQuery(patel, queryTokens("patel ortho"))).toBe(false);
    expect(matchesQuery(provider({ name: "José Núñez" }), queryTokens("jose nunez"))).toBe(true);
    expect(matchesQuery(provider({ name: "Dr. A" }), queryTokens("westside"), "Westside Family")).toBe(true);
  });
  it("matches everything with no words", () => {
    expect(matchesQuery(patel, queryTokens("   "))).toBe(true);
  });
});

describe("directoryList", () => {
  const westside = provider({ name: "Westside Family Medicine", type: "practice", isPrimary: true });
  const alvarez = provider({
    name: "Dr. Elena Alvarez",
    specialty: "Internal medicine",
    practiceId: westside.id,
    isPrimary: true,
  });
  const patel = provider({ name: "Dr. Samuel Patel", specialty: "Cardiology" });
  const pharmacy = provider({ name: "Cornerstone Pharmacy", type: "pharmacy", isPrimary: true });
  const whitford = provider({ name: "Dr. Alan Whitford", specialty: "Orthopedics", status: "past" });
  const all = [whitford, patel, pharmacy, alvarez, westside];

  it("lists current providers in display order and past ones apart", () => {
    const list = directoryList(all, { q: "", type: null });
    expect(list.current.map((p) => p.name)).toEqual([
      "Cornerstone Pharmacy",
      "Dr. Elena Alvarez",
      "Westside Family Medicine",
      "Dr. Samuel Patel",
    ]);
    expect(list.past).toEqual([whitford]);
  });

  it("finds clinicians by their practice's name, and by specialty", () => {
    expect(directoryList(all, { q: "westside", type: null }).current).toEqual([alvarez, westside]);
    expect(directoryList(all, { q: "cardio", type: null }).current).toEqual([patel]);
    expect(directoryList(all, { q: "ortho", type: null })).toEqual({ current: [], past: [whitford] });
  });

  it("filters by type, with the search", () => {
    expect(directoryList(all, { q: "", type: "pharmacy" }).current).toEqual([pharmacy]);
    expect(directoryList(all, { q: "westside", type: "clinician" }).current).toEqual([alvarez]);
  });
});

describe("the tag filter (tags PRD)", () => {
  it("reads one tag id, lowercased, and anything else as no tag", () => {
    expect(parseDirectoryFilters(`?tag=${TAG.toUpperCase()}`).tag).toBe(TAG);
    expect(parseDirectoryFilters("?tag=urgent").tag).toBeNull();
    expect(parseDirectoryFilters("?tag=").tag).toBeNull();
  });

  it("sets and clears the tag after q and type, keeping the rest", () => {
    expect(setTag("?q=dr&type=clinician&x=1", TAG)).toBe(`?q=dr&type=clinician&tag=${TAG}&x=1`);
    expect(setTag(`?tag=${TAG}`, OTHER_TAG)).toBe(`?tag=${OTHER_TAG}`);
    expect(setTag("?q=dr", "not-an-id")).toBe("?q=dr");
    expect(clearTag(`?q=dr&tag=${TAG}&type=practice`)).toBe("?q=dr&type=practice");
    expect(setType(`?tag=${TAG}`, "pharmacy")).toBe(`?type=pharmacy&tag=${TAG}`);
    expect(setQuery(`?tag=${TAG}`, "corner")).toBe(`?q=corner&tag=${TAG}`);
  });

  it("a change that changes nothing returns the search as it was", () => {
    const search = `?tag=${TAG}&q=dr`;
    expect(setTag(search, TAG)).toBe(search);
    expect(clearTag("?q=dr")).toBe("?q=dr");
  });

  it("Clear filters drops the type and the tag, keeping the search", () => {
    expect(clearFilters(`?q=dr&type=clinician&tag=${TAG}&x=1`)).toBe("?q=dr&x=1");
  });

  it("narrows the list to the providers carrying the tag, with the type and search", () => {
    const patel = provider({ name: "Dr. Samuel Patel", specialty: "Cardiology" });
    const lee = provider({ name: "Dr. Mina Lee", specialty: "Cardiology", status: "past" });
    const corner = provider({ name: "Cornerstone Pharmacy", type: "pharmacy" });
    const all = [patel, lee, corner];
    const tags = new Map([
      [patel.id, [{ id: TAG, name: "Heart" }]],
      [
        lee.id,
        [
          { id: OTHER_TAG, name: "Move" },
          { id: TAG, name: "Heart" },
        ],
      ],
      [corner.id, [{ id: OTHER_TAG, name: "Move" }]],
    ]);
    expect(directoryList(all, { q: "", type: null, tag: TAG }, tags)).toEqual({
      current: [patel],
      past: [lee],
    });
    expect(directoryList(all, { q: "", type: "pharmacy", tag: OTHER_TAG }, tags).current).toEqual([corner]);
    expect(directoryList(all, { q: "mina", type: null, tag: TAG }, tags).past).toEqual([lee]);
    expect(directoryList(all, { q: "", type: null, tag: TAG }, new Map())).toEqual({ current: [], past: [] });
    // No tag: every provider, tags or not.
    expect(directoryList(all, { q: "", type: null, tag: null }, tags).current).toHaveLength(2);
  });
});
