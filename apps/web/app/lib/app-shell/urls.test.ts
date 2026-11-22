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
