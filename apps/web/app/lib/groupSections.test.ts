import type { GroupSection } from "./groupSections";

import { describe, expect, it } from "vitest";
import { appUrls } from "./appUrls";
import { activeSection, GROUP_SECTIONS, groupSubpath, isTabBarHidden, sectionCurrent } from "./groupSections";

const G = "11111111-1111-4111-8111-111111111111";
const base = appUrls.groupHome(G);
const timeline = GROUP_SECTIONS.find((s) => s.id === "timeline")!;

// A throwaway second section, as a later PRD would append it.
const medications: GroupSection = {
  id: "medications",
  label: "Medications",
  icon: timeline.icon,
  path: (groupId) => `${appUrls.groupHome(groupId)}/medications`,
  match: (subpath) => subpath === "/medications" || subpath.startsWith("/medications/"),
};
const withMeds = [...GROUP_SECTIONS, medications];

describe("GROUP_SECTIONS", () => {
  it("starts with Timeline", () => {
    expect(GROUP_SECTIONS.map((s) => s.id)).toEqual(["timeline"]);
    expect(timeline.path(G)).toBe(appUrls.timeline(G));
  });
  it("has unique ids", () => {
    expect(new Set(GROUP_SECTIONS.map((s) => s.id)).size).toBe(GROUP_SECTIONS.length);
  });
});

describe("groupSubpath", () => {
  it("is the part inside the group", () => {
    expect(groupSubpath(`${base}/timeline`, G)).toBe("/timeline");
    expect(groupSubpath(`${base}/timeline/`, G)).toBe("/timeline");
    expect(groupSubpath(`${base}`, G)).toBe("");
  });
  it("is null outside the group", () => {
    expect(groupSubpath(appUrls.home(), G)).toBeNull();
    expect(groupSubpath(appUrls.settings(), G)).toBeNull();
    expect(groupSubpath(`${appUrls.groupHome("other")}/timeline`, G)).toBeNull();
    expect(groupSubpath(`${base}x/timeline`, G)).toBeNull();
  });
});

describe("activeSection", () => {
  it("is Timeline on the timeline, as its page", () => {
    expect(activeSection(`${base}/timeline`, G)).toEqual({ section: timeline, isPage: true });
  });
  it("is Timeline inside an entry, but not as its page", () => {
    expect(activeSection(`${base}/entries/abc`, G)).toEqual({ section: timeline, isPage: false });
    expect(activeSection(`${base}/entries/new`, G)).toEqual({ section: timeline, isPage: false });
  });
  it("is nothing on a group page outside every section, or outside the group", () => {
    expect(activeSection(`${base}/settings`, G)).toBeNull();
    expect(activeSection(`${base}`, G)).toBeNull();
    expect(activeSection(appUrls.settings(), G)).toBeNull();
  });
  it("picks an appended section by its own match", () => {
    expect(activeSection(`${base}/medications`, G, withMeds)?.section.id).toBe("medications");
    expect(activeSection(`${base}/timeline`, G, withMeds)?.section.id).toBe("timeline");
  });
});

describe("sectionCurrent", () => {
  it('is "page" on the section\'s page, "true" inside it, else undefined', () => {
    expect(sectionCurrent(timeline, `${base}/timeline`, G)).toBe("page");
    expect(sectionCurrent(timeline, `${base}/entries/abc`, G)).toBe("true");
    expect(sectionCurrent(timeline, `${base}/settings`, G)).toBeUndefined();
    expect(sectionCurrent(timeline, `${base}/medications`, G, withMeds)).toBeUndefined();
    expect(sectionCurrent(medications, `${base}/medications`, G, withMeds)).toBe("page");
  });
});

describe("isTabBarHidden", () => {
  it("shows the bar on the timeline and other group pages", () => {
    expect(isTabBarHidden(`${base}/timeline`, G)).toBe(false);
    expect(isTabBarHidden(`${base}/settings`, G)).toBe(false);
  });
  it("hides it on an entry's page and a new entry", () => {
    expect(isTabBarHidden(`${base}/entries/abc`, G)).toBe(true);
    expect(isTabBarHidden(`${base}/entries/new`, G)).toBe(true);
    expect(isTabBarHidden(`${base}/entries`, G)).toBe(true);
  });
  it("hides it outside the group", () => {
    expect(isTabBarHidden(appUrls.home(), G)).toBe(true);
    expect(isTabBarHidden(appUrls.settings(), G)).toBe(true);
  });
});
