import type { GroupSection } from "./groupSections";

import { describe, expect, it } from "vitest";
import { appUrls } from "./appUrls";
import { activeSection, GROUP_SECTIONS, groupSubpath, isTabBarHidden, sectionCurrent } from "./groupSections";

const G = "11111111-1111-4111-8111-111111111111";
const base = appUrls.groupHome(G);
const timeline = GROUP_SECTIONS.find((s) => s.id === "timeline")!;
const providers = GROUP_SECTIONS.find((s) => s.id === "providers")!;
const medications = GROUP_SECTIONS.find((s) => s.id === "medications")!;
const planner = GROUP_SECTIONS.find((s) => s.id === "planner")!;

// A throwaway extra section, as a later PRD would append it.
const assistant: GroupSection = {
  id: "assistant",
  label: "Assistant",
  icon: timeline.icon,
  path: (groupId) => `${appUrls.groupHome(groupId)}/assistant`,
  match: (subpath) => subpath === "/assistant" || subpath.startsWith("/assistant/"),
};
const withMore = [...GROUP_SECTIONS, assistant];

describe("GROUP_SECTIONS", () => {
  it("is Timeline, then Providers, then Medications, then Planner", () => {
    expect(GROUP_SECTIONS.map((s) => s.id)).toEqual(["timeline", "providers", "medications", "planner"]);
    expect(GROUP_SECTIONS.map((s) => s.label)).toEqual(["Timeline", "Providers", "Medications", "Planner"]);
    expect(timeline.path(G)).toBe(appUrls.timeline(G));
    expect(providers.path(G)).toBe(appUrls.providers(G));
    expect(medications.path(G)).toBe(appUrls.medicationSchedule(G));
    expect(planner.path(G)).toBe(appUrls.planner(G));
  });

  it("puts the Past tab, the Todos tab, and a todo's page and sheets in Planner", () => {
    for (const path of [
      appUrls.planner(G),
      appUrls.plannerPast(G),
      appUrls.todos(G),
      appUrls.newTodo(G),
      appUrls.todo(G, "t1"),
      appUrls.editTodo(G, "t1"),
    ])
      expect(activeSection(path, G)?.section.id, path).toBe("planner");
    expect(sectionCurrent(planner, appUrls.planner(G), G)).toBe("page");
    expect(sectionCurrent(planner, appUrls.plannerPast(G), G)).toBe("true");
    expect(sectionCurrent(planner, appUrls.todos(G), G)).toBe("true");
    expect(sectionCurrent(planner, appUrls.todo(G, "t1"), G)).toBe("true");
    expect(sectionCurrent(timeline, appUrls.plannerPast(G), G)).toBeUndefined();
  });

  it("has nothing for the old Upcoming and Tasks paths", () => {
    for (const sub of ["/upcoming", "/upcoming/past", "/tasks", "/tasks/new", "/tasks/t1"])
      expect(activeSection(`${base}${sub}`, G), sub).toBeNull();
    expect(activeSection(`${base}/plannerx`, G)).toBeNull();
    expect(activeSection(`${base}/todosx`, G)).toBeNull();
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
  it("is Providers on the directory, and inside it below /providers", () => {
    expect(activeSection(`${base}/providers`, G)).toEqual({ section: providers, isPage: true });
    expect(activeSection(`${base}/providers/abc`, G)).toEqual({ section: providers, isPage: false });
    expect(activeSection(`${base}/providersx`, G)).toBeNull();
  });
  it("is nothing on a group page outside every section, or outside the group", () => {
    expect(activeSection(`${base}/settings`, G)).toBeNull();
    expect(activeSection(`${base}`, G)).toBeNull();
    expect(activeSection(appUrls.settings(), G)).toBeNull();
  });
  it("is Medications on Schedule (its page), and inside it on the list, a sheet and a medication's page", () => {
    expect(activeSection(`${base}/medications/schedule`, G)).toEqual({ section: medications, isPage: true });
    for (const inside of ["list", "list/new", "schedule/allergies", "list/abc/edit", "abc", "print"])
      expect(activeSection(`${base}/medications/${inside}`, G)).toEqual({
        section: medications,
        isPage: false,
      });
    expect(activeSection(`${base}/medicationsx`, G)).toBeNull();
  });
  it("picks an appended section by its own match", () => {
    expect(activeSection(`${base}/assistant`, G, withMore)?.section.id).toBe("assistant");
    expect(activeSection(`${base}/timeline`, G, withMore)?.section.id).toBe("timeline");
  });
});

describe("sectionCurrent", () => {
  it('is "page" on the section\'s page, "true" inside it, else undefined', () => {
    expect(sectionCurrent(timeline, `${base}/timeline`, G)).toBe("page");
    expect(sectionCurrent(timeline, `${base}/entries/abc`, G)).toBe("true");
    expect(sectionCurrent(timeline, `${base}/settings`, G)).toBeUndefined();
    expect(sectionCurrent(timeline, `${base}/medications`, G)).toBeUndefined();
    expect(sectionCurrent(medications, `${base}/medications/schedule`, G)).toBe("page");
    expect(sectionCurrent(medications, `${base}/medications/list`, G)).toBe("true");
    expect(sectionCurrent(medications, `${base}/medications/abc`, G)).toBe("true");
    expect(sectionCurrent(providers, `${base}/medications`, G)).toBeUndefined();
    expect(sectionCurrent(assistant, `${base}/assistant`, G, withMore)).toBe("page");
    expect(sectionCurrent(providers, `${base}/providers`, G)).toBe("page");
    expect(sectionCurrent(timeline, `${base}/providers`, G)).toBeUndefined();
  });
});

describe("isTabBarHidden", () => {
  it("shows the bar on the timeline and other group pages", () => {
    expect(isTabBarHidden(`${base}/timeline`, G)).toBe(false);
    expect(isTabBarHidden(`${base}/settings`, G)).toBe(false);
    expect(isTabBarHidden(`${base}/providers`, G)).toBe(false);
    expect(isTabBarHidden(`${base}/medications`, G)).toBe(false);
    expect(isTabBarHidden(`${base}/medications/abc`, G)).toBe(false);
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
