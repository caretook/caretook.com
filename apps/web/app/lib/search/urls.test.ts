import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("searchUrls", () => {
  it("encodes the search, drops an empty one, and shows a section in full", () => {
    expect(appUrls.search(G, "")).toBe(`/app/groups/${G}/search`);
    expect(appUrls.search(G, "knee pain")).toBe(`/app/groups/${G}/search?q=knee+pain`);
    expect(appUrls.search(G, "knee", { all: "entry" })).toBe(`/app/groups/${G}/search?q=knee&all=entry`);
  });

  it("drops a full section without a search, or of an unknown type", () => {
    expect(appUrls.search(G, " ", { all: "entry" })).toBe(`/app/groups/${G}/search?q=+`);
    // @ts-expect-error: only the search's item types exist.
    expect(appUrls.search(G, "knee", { all: "bogus" })).toBe(`/app/groups/${G}/search?q=knee`);
  });

  it("carries the search's care period, only with a search", () => {
    const P = "3f2b8c1e-5d1a-4c2e-9a77-0b6f3c1e0042";
    expect(appUrls.search(G, "knee", { period: P })).toBe(`/app/groups/${G}/search?q=knee&period=${P}`);
    expect(appUrls.search(G, "knee", { all: "entry", period: P })).toBe(
      `/app/groups/${G}/search?q=knee&all=entry&period=${P}`,
    );
    expect(appUrls.search(G, " ", { period: P })).toBe(`/app/groups/${G}/search?q=+`);
    expect(appUrls.search(G, "", { period: P })).toBe(`/app/groups/${G}/search`);
    expect(appUrls.search(G, "knee", { period: null })).toBe(`/app/groups/${G}/search?q=knee`);
  });

  it("carries the tag, with or without a search; with one, a full section needs no text", () => {
    const T = "9a77e3f1-5d1a-4c2e-0b6f-3c1e2b8c0bbb";
    expect(appUrls.search(G, "knee", { tag: T })).toBe(`/app/groups/${G}/search?q=knee&tag=${T}`);
    expect(appUrls.search(G, "", { tag: T })).toBe(`/app/groups/${G}/search?tag=${T}`);
    expect(appUrls.search(G, "", { all: "todo", tag: T })).toBe(`/app/groups/${G}/search?all=todo&tag=${T}`);
    expect(appUrls.search(G, "knee", { tag: null })).toBe(`/app/groups/${G}/search?q=knee`);
  });
});
