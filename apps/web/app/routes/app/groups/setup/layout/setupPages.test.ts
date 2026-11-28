import { describe, expect, it } from "vitest";
import { nextSetupPage, SETUP_PAGES, setupPageAt } from "./setupPages";

const groupId = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b01";

describe("setupPageAt", () => {
  it("reads the step a setup path is on", () => {
    expect(setupPageAt(`/app/groups/${groupId}/setup/providers`)).toBe("providers");
    expect(setupPageAt(`/app/groups/${groupId}/setup/providers/`)).toBe("providers");
  });

  it("is null off a page", () => {
    expect(setupPageAt(`/app/groups/${groupId}/setup`)).toBeNull();
    expect(setupPageAt(`/app/groups/${groupId}/setup/bogus`)).toBeNull();
  });
});

describe("nextSetupPage", () => {
  it("is null on the last page, so Next finishes", () => {
    expect(nextSetupPage(SETUP_PAGES[SETUP_PAGES.length - 1] ?? "providers")).toBeNull();
  });
});
