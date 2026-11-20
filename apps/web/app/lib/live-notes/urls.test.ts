import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";
import { NEW_ENTRY } from "../live-notes/liveEntry";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("liveNoteUrls", () => {
  it("drops an unknown kind for a new entry", () => {
    // @ts-expect-error: only notes and events are drafted on their own page.
    expect(appUrls.newEntry("g", "symptom")).toBe(`/app/groups/g/entries/${NEW_ENTRY}`);
  });
});

describe("appUrls.printEntry", () => {
  it("is the entry's page, opened to print", () => {
    expect(appUrls.printEntry(G, "e1")).toBe(`/app/groups/${G}/entries/e1?print=1`);
  });
});
