import { describe, expect, it } from "vitest";
import { NEW_GROUP_LINK_STATE, openedNewGroupFromApp } from "./newGroupLink";

describe("openedNewGroupFromApp", () => {
  it("is true only for the New care group link's state", () => {
    expect(openedNewGroupFromApp(NEW_GROUP_LINK_STATE)).toBe(true);
    expect(openedNewGroupFromApp(null)).toBe(false);
    expect(openedNewGroupFromApp(undefined)).toBe(false);
    expect(openedNewGroupFromApp({ sheetOverTimeline: true })).toBe(false);
  });
});
