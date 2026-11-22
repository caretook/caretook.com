import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("appUrls.groupSettings", () => {
  it("encodes the group and drops an unknown subpage", () => {
    expect(appUrls.groupSettings("g 1", "members")).toBe("/app/groups/g%201/settings/members");
    // @ts-expect-error: only the listed subpages exist.
    expect(appUrls.groupSettings(G, "bogus")).toBe(`/app/groups/${G}/settings`);
  });
});
