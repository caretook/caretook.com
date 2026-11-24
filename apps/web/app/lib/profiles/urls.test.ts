import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("appUrls: profile", () => {
  it("drops an unknown sheet", () => {
    expect(appUrls.profile(G, "basics")).toBe(`/app/groups/${G}/profile/basics`);
    // @ts-expect-error: only the listed sheets exist.
    expect(appUrls.profile(G, "bogus")).toBe(`/app/groups/${G}/profile`);
  });

  it("has the allergies sheet over the profile", () => {
    expect(appUrls.profileAllergies(G)).toBe(`/app/groups/${G}/profile/allergies`);
  });

  it("encodes a condition's id", () => {
    expect(appUrls.condition(G, "c 1")).toBe(`/app/groups/${G}/profile/conditions/c%201`);
  });
});
