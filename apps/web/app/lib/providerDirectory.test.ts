import type { ListedProvider } from "./providerDirectory";

import { describe, expect, it } from "vitest";
import {
  clearType,
  compareProviders,
  directoryList,
  matchesQuery,
  parseDirectoryFilters,
  queryTokens,
  setPast,
  setQuery,
  setType,
} from "./providerDirectory";

describe("parseDirectoryFilters", () => {
  it("reads q, type and past", () => {
    expect(parseDirectoryFilters("?q=%20cardio%20&type=clinician&past=1")).toEqual({
      q: "cardio",
      type: "clinician",
      past: true,
    });
    expect(parseDirectoryFilters("")).toEqual({ q: "", type: null, past: false });
  });
  it("ignores unknown values", () => {
    expect(parseDirectoryFilters("type=dentist&past=yes")).toEqual({ q: "", type: null, past: false });
  });
});

describe("filter changes", () => {
  it("set and clear each filter, keeping the others and unknown parameters", () => {
    expect(setQuery("?type=pharmacy&x=1", "corner")).toBe("?q=corner&type=pharmacy&x=1");
    expect(setQuery("?q=corner&type=pharmacy", "  ")).toBe("?type=pharmacy");
    expect(setType("?q=dr", "clinician")).toBe("?q=dr&type=clinician");
    expect(clearType("?q=dr&type=clinician&past=1")).toBe("?q=dr&past=1");
    expect(setPast("?type=other", true)).toBe("?type=other&past=1");
    expect(setPast("?past=1", false)).toBe("");
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
