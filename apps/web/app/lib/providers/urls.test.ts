import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("providerUrls", () => {
  it("carries the provider directory's search through", () => {
    expect(appUrls.providers("g", "?q=cardio&type=clinician")).toBe(
      "/app/groups/g/providers?q=cardio&type=clinician",
    );
    expect(appUrls.providers("g", { q: "", past: "1" })).toBe("/app/groups/g/providers?past=1");
  });

  it("builds a provider's page, with the id as a path segment", () => {
    expect(appUrls.provider(G, "p1")).toBe(`/app/groups/${G}/providers/p1`);
    expect(appUrls.provider("g", "a/b")).toBe("/app/groups/g/providers/a%2Fb");
  });

  it("builds the provider sheets' paths, carrying the directory's search", () => {
    expect(appUrls.newProvider("g")).toBe("/app/groups/g/providers/new");
    expect(appUrls.newProvider("g", { type: "pharmacy" })).toBe("/app/groups/g/providers/new?type=pharmacy");
    // The type replaces the list's type filter; the rest is kept.
    expect(appUrls.newProvider("g", { type: "practice", search: "?q=west&type=clinician&past=1" })).toBe(
      "/app/groups/g/providers/new?q=west&type=practice&past=1",
    );
    expect(appUrls.newProvider("g", { search: "?q=west&type=clinician" })).toBe(
      "/app/groups/g/providers/new?q=west&type=clinician",
    );
    // @ts-expect-error: only provider types.
    expect(appUrls.newProvider("g", { type: "bogus" })).toBe("/app/groups/g/providers/new");
    expect(appUrls.editProvider("g", "p 1", { q: "cardio" })).toBe(
      "/app/groups/g/providers/p%201/edit?q=cardio",
    );
  });
});
