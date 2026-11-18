import type { GroupSection } from "./groupSections";

import { describe, expect, it } from "vitest";
import { activeSection, GROUP_SECTIONS, groupSubpath, isTabBarHidden, sectionCurrent } from "./groupSections";

const G = "11111111-1111-4111-8111-111111111111";
const timeline = GROUP_SECTIONS.find((s) => s.id === "timeline")!;

// A throwaway second section, as a later PRD would append it.
const medications: GroupSection = {
  id: "medications",
  label: "Medications",
  icon: timeline.icon,
  path: (groupId) => `/app/groups/${groupId}/medications`,
  match: (subpath) => subpath === "/medications" || subpath.startsWith("/medications/"),
};
const withMeds = [...GROUP_SECTIONS, medications];

describe("GROUP_SECTIONS", () => {
  it("starts with Timeline", () => {
    expect(GROUP_SECTIONS.map((s) => s.id)).toEqual(["timeline"]);
    expect(timeline.path(G)).toBe(`/app/groups/${G}/timeline`);
  });
  it("has unique ids", () => {
    expect(new Set(GROUP_SECTIONS.map((s) => s.id)).size).toBe(GROUP_SECTIONS.length);
  });
});

describe("groupSubpath", () => {
  it("is the part inside the group", () => {
    expect(groupSubpath(`/app/groups/${G}/timeline`, G)).toBe("/timeline");
    expect(groupSubpath(`/app/groups/${G}/timeline/`, G)).toBe("/timeline");
    expect(groupSubpath(`/app/groups/${G}`, G)).toBe("");
  });
  it("is null outside the group", () => {
    expect(groupSubpath("/app", G)).toBeNull();
    expect(groupSubpath("/app/settings", G)).toBeNull();
    expect(groupSubpath(`/app/groups/other/timeline`, G)).toBeNull();
    expect(groupSubpath(`/app/groups/${G}x/timeline`, G)).toBeNull();
  });
});

describe("activeSection", () => {
  it("is Timeline on the timeline, as its page", () => {
    expect(activeSection(`/app/groups/${G}/timeline`, G)).toEqual({ section: timeline, isPage: true });
  });
  it("is Timeline inside an entry, but not as its page", () => {
    expect(activeSection(`/app/groups/${G}/entries/abc`, G)).toEqual({ section: timeline, isPage: false });
    expect(activeSection(`/app/groups/${G}/entries/new`, G)).toEqual({ section: timeline, isPage: false });
  });
  it("is nothing on a group page outside every section, or outside the group", () => {
    expect(activeSection(`/app/groups/${G}/settings`, G)).toBeNull();
    expect(activeSection(`/app/groups/${G}`, G)).toBeNull();
    expect(activeSection("/app/settings", G)).toBeNull();
  });
  it("picks an appended section by its own match", () => {
    expect(activeSection(`/app/groups/${G}/medications`, G, withMeds)?.section.id).toBe("medications");
    expect(activeSection(`/app/groups/${G}/timeline`, G, withMeds)?.section.id).toBe("timeline");
  });
});

describe("sectionCurrent", () => {
  it('is "page" on the section\'s page, "true" inside it, else undefined', () => {
    expect(sectionCurrent(timeline, `/app/groups/${G}/timeline`, G)).toBe("page");
    expect(sectionCurrent(timeline, `/app/groups/${G}/entries/abc`, G)).toBe("true");
    expect(sectionCurrent(timeline, `/app/groups/${G}/settings`, G)).toBeUndefined();
    expect(sectionCurrent(timeline, `/app/groups/${G}/medications`, G, withMeds)).toBeUndefined();
    expect(sectionCurrent(medications, `/app/groups/${G}/medications`, G, withMeds)).toBe("page");
  });
});

describe("isTabBarHidden", () => {
  it("shows the bar on the timeline and other group pages", () => {
    expect(isTabBarHidden(`/app/groups/${G}/timeline`, G)).toBe(false);
    expect(isTabBarHidden(`/app/groups/${G}/settings`, G)).toBe(false);
  });
  it("hides it on an entry's page and a new entry", () => {
    expect(isTabBarHidden(`/app/groups/${G}/entries/abc`, G)).toBe(true);
    expect(isTabBarHidden(`/app/groups/${G}/entries/new`, G)).toBe(true);
    expect(isTabBarHidden(`/app/groups/${G}/entries`, G)).toBe(true);
  });
  it("hides it outside the group", () => {
    expect(isTabBarHidden("/app", G)).toBe(true);
    expect(isTabBarHidden("/app/settings", G)).toBe(true);
  });
});
