import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("searchUrls", () => {
  it("builds the search page, with its text and the section shown in full", () => {
    expect(appUrls.search(G)).toBe(`/app/groups/${G}/search`);
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
});
