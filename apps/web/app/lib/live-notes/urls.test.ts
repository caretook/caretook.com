import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";
import { NEW_ENTRY } from "../live-notes/liveEntry";

describe("appUrls.newEntry", () => {
  it("drops an unknown kind", () => {
    // @ts-expect-error: only notes and events are drafted on their own page.
    expect(appUrls.newEntry("g", "symptom")).toBe(`/app/groups/g/entries/${NEW_ENTRY}`);
  });
});
