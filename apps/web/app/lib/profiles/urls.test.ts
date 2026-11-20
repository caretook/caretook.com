import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("profileUrls", () => {
  it("builds the recipient's profile and its sheets, and drops an unknown sheet", () => {
    expect(appUrls.profile(G)).toBe(`/app/groups/${G}/profile`);
    expect(appUrls.profile(G, "basics")).toBe(`/app/groups/${G}/profile/basics`);
    expect(appUrls.profile(G, "contact")).toBe(`/app/groups/${G}/profile/contact`);
    expect(appUrls.profile(G, "insurance")).toBe(`/app/groups/${G}/profile/insurance`);
    expect(appUrls.profile(G, "emergency")).toBe(`/app/groups/${G}/profile/emergency`);
    // @ts-expect-error: only the listed sheets exist.
    expect(appUrls.profile(G, "bogus")).toBe(`/app/groups/${G}/profile`);
  });

  it("builds the recipient's emergency sheet", () => {
    expect(appUrls.profilePrint(G)).toBe(`/app/groups/${G}/profile/print`);
  });
});
