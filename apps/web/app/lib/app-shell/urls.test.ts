import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

describe("appUrls.settings", () => {
  it("drops an unknown subpage", () => {
    expect(appUrls.settings("units")).toBe("/app/settings/units");
    expect(appUrls.settings("not-saved")).toBe("/app/settings/not-saved");
    // @ts-expect-error: only the listed subpages exist.
    expect(appUrls.settings("bogus")).toBe("/app/settings");
  });
});

describe("appUrls.setup", () => {
  const groupId = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b01";
  it("opens a step, the first by default or for an unknown one", () => {
    expect(appUrls.setup(groupId, "medications")).toBe(`/app/groups/${groupId}/setup/medications`);
    expect(appUrls.setup(groupId)).toBe(`/app/groups/${groupId}/setup/providers`);
    // @ts-expect-error: only the setup steps exist.
    expect(appUrls.setup(groupId, "bogus")).toBe(`/app/groups/${groupId}/setup/providers`);
  });
});
