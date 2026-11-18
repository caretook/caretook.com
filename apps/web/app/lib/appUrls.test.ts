import { describe, expect, it } from "vitest";
import { appUrls, searchString } from "./appUrls";
import { NEW_ENTRY } from "./liveEntry";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("appUrls", () => {
  it("builds the paths outside a group", () => {
    expect(appUrls.home()).toBe("/app");
    expect(appUrls.settings()).toBe("/app/settings");
  });

  it("builds a group's paths", () => {
    expect(appUrls.groupHome(G)).toBe(`/app/groups/${G}`);
    expect(appUrls.timeline(G)).toBe(`/app/groups/${G}/timeline`);
    expect(appUrls.entry(G, "e1")).toBe(`/app/groups/${G}/entries/e1`);
    expect(appUrls.newEntry(G, "note")).toBe(`/app/groups/${G}/entries/${NEW_ENTRY}?kind=note`);
    expect(appUrls.newEntry(G, "event")).toBe(`/app/groups/${G}/entries/${NEW_ENTRY}?kind=event`);
    expect(appUrls.groupSettings(G)).toBe(`/app/groups/${G}/settings`);
  });

  it("encodes ids as path segments", () => {
    expect(appUrls.groupHome("a/b?c")).toBe("/app/groups/a%2Fb%3Fc");
    expect(appUrls.entry("g", "x y#z")).toBe("/app/groups/g/entries/x%20y%23z");
  });

  it("carries the timeline's search through, in any form", () => {
    expect(appUrls.timeline("g", "?kind=vital")).toBe("/app/groups/g/timeline?kind=vital");
    expect(appUrls.timeline("g", "kind=vital&author=u")).toBe("/app/groups/g/timeline?kind=vital&author=u");
    expect(appUrls.timeline("g", new URLSearchParams({ kind: "note" }))).toBe(
      "/app/groups/g/timeline?kind=note",
    );
    expect(appUrls.timeline("g", { kind: "symptom", author: null })).toBe(
      "/app/groups/g/timeline?kind=symptom",
    );
    expect(appUrls.timeline("g", "")).toBe("/app/groups/g/timeline");
    expect(appUrls.timeline("g", "?")).toBe("/app/groups/g/timeline");
  });

  it("drops an unknown kind for a new entry", () => {
    // @ts-expect-error: only notes and events are drafted on their own page.
    expect(appUrls.newEntry("g", "symptom")).toBe(`/app/groups/g/entries/${NEW_ENTRY}`);
  });
});

describe("searchString", () => {
  it("encodes values", () => {
    expect(searchString({ q: "a b&c" })).toBe("?q=a+b%26c");
  });

  it("drops empty and missing values", () => {
    expect(searchString({ a: "", b: undefined, c: null, d: "1" })).toBe("?d=1");
    expect(searchString("?a=&b=2")).toBe("?b=2");
    expect(searchString(undefined)).toBe("");
  });

  it("keeps repeated parameters and their order", () => {
    expect(searchString("b=1&a=2&b=3")).toBe("?b=1&a=2&b=3");
  });
});
