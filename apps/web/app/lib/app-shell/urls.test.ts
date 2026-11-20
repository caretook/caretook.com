import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

describe("appShellUrls", () => {
  it("builds the paths outside a group", () => {
    expect(appUrls.home()).toBe("/app");
    expect(appUrls.settings()).toBe("/app/settings");
  });

  it("builds the account settings subpages, and drops an unknown one", () => {
    expect(appUrls.settings("units")).toBe("/app/settings/units");
    expect(appUrls.settings("timeline")).toBe("/app/settings/timeline");
    expect(appUrls.settings("account")).toBe("/app/settings/account");
    expect(appUrls.settings("contact")).toBe("/app/settings/contact");
    expect(appUrls.settings("devices")).toBe("/app/settings/devices");
    // @ts-expect-error: only the listed subpages exist.
    expect(appUrls.settings("bogus")).toBe("/app/settings");
  });
});

describe("appUrls.groupList", () => {
  it("is /app, asked to show the list", () => {
    expect(appUrls.groupList()).toBe("/app?groups=1");
  });
});
