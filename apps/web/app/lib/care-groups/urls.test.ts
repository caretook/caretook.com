import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("careGroupUrls", () => {
  it("builds a group's settings subpages, and drops an unknown one", () => {
    expect(appUrls.groupSettings(G, "details")).toBe(`/app/groups/${G}/settings/details`);
    expect(appUrls.groupSettings(G, "members")).toBe(`/app/groups/${G}/settings/members`);
    expect(appUrls.groupSettings(G, "assistants")).toBe(`/app/groups/${G}/settings/assistants`);
    // @ts-expect-error: only the listed subpages exist.
    expect(appUrls.groupSettings(G, "bogus")).toBe(`/app/groups/${G}/settings`);
  });
});

describe("appUrls.newGroup", () => {
  it("is a static path the group route never claims", () => {
    expect(appUrls.newGroup()).toBe("/app/groups/new");
  });
});
