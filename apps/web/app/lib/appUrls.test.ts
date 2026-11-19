import { describe, expect, it } from "vitest";
import { appUrls, searchString } from "./appUrls";
import { NEW_ENTRY } from "./liveEntry";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("appUrls", () => {
  it("builds the paths outside a group", () => {
    expect(appUrls.home()).toBe("/app");
    expect(appUrls.settings()).toBe("/app/settings");
  });

  it("builds the account settings subpages, and drops an unknown one", () => {
    expect(appUrls.settings("units")).toBe("/app/settings/units");
    expect(appUrls.settings("timeline")).toBe("/app/settings/timeline");
    expect(appUrls.settings("account")).toBe("/app/settings/account");
    // @ts-expect-error: only the listed subpages exist.
    expect(appUrls.settings("bogus")).toBe("/app/settings");
  });

  it("builds a group's paths", () => {
    expect(appUrls.groupHome(G)).toBe(`/app/groups/${G}`);
    expect(appUrls.timeline(G)).toBe(`/app/groups/${G}/timeline`);
    expect(appUrls.entry(G, "e1")).toBe(`/app/groups/${G}/entries/e1`);
    expect(appUrls.newEntry(G, "note")).toBe(`/app/groups/${G}/entries/${NEW_ENTRY}?kind=note`);
    expect(appUrls.newEntry(G, "event")).toBe(`/app/groups/${G}/entries/${NEW_ENTRY}?kind=event`);
    expect(appUrls.groupSettings(G)).toBe(`/app/groups/${G}/settings`);
    expect(appUrls.providers(G)).toBe(`/app/groups/${G}/providers`);
  });

  it("carries the provider directory's search through", () => {
    expect(appUrls.providers("g", "?q=cardio&type=clinician")).toBe(
      "/app/groups/g/providers?q=cardio&type=clinician",
    );
    expect(appUrls.providers("g", { q: "", past: "1" })).toBe("/app/groups/g/providers?past=1");
  });

  it("builds a provider's page, with the id as a path segment", () => {
    expect(appUrls.provider(G, "p1")).toBe(`/app/groups/${G}/providers/p1`);
    expect(appUrls.provider("g", "a/b")).toBe("/app/groups/g/providers/a%2Fb");
  });

  it("builds a group's settings subpages, and drops an unknown one", () => {
    expect(appUrls.groupSettings(G, "details")).toBe(`/app/groups/${G}/settings/details`);
    expect(appUrls.groupSettings(G, "members")).toBe(`/app/groups/${G}/settings/members`);
    // @ts-expect-error: only the listed subpages exist.
    expect(appUrls.groupSettings(G, "bogus")).toBe(`/app/groups/${G}/settings`);
  });

  it("encodes ids as path segments", () => {
    expect(appUrls.groupHome("a/b?c")).toBe("/app/groups/a%2Fb%3Fc");
    expect(appUrls.entry("g", "x y#z")).toBe("/app/groups/g/entries/x%20y%23z");
  });

  it("carries the timeline's search through, in any form", () => {
    expect(appUrls.timeline("g", "?kind=vital")).toBe("/app/groups/g/timeline?kind=vital");
    expect(appUrls.timeline("g", "kind=vital&author=u")).toBe("/app/groups/g/timeline?kind=vital&author=u");
    expect(appUrls.timeline("g", new URLSearchParams({ kind: "note" }))).toBe(
      "/app/groups/g/timeline?kind=note",
    );
    expect(appUrls.timeline("g", { kind: "symptom", author: null })).toBe(
      "/app/groups/g/timeline?kind=symptom",
    );
    expect(appUrls.timeline("g", "")).toBe("/app/groups/g/timeline");
    expect(appUrls.timeline("g", "?")).toBe("/app/groups/g/timeline");
  });

  it("builds the add sheet's path, carrying the timeline's filters", () => {
    expect(appUrls.newSheet(G, "symptom")).toBe(`/app/groups/${G}/timeline/new/symptom`);
    expect(appUrls.newSheet(G, "vital")).toBe(`/app/groups/${G}/timeline/new/vital`);
    expect(appUrls.newSheet("g", "vital", { type: "heartRate" })).toBe(
      "/app/groups/g/timeline/new/vital?type=heartRate",
    );
    expect(appUrls.newSheet("g", "symptom", { search: "?kind=vital&author=u" })).toBe(
      "/app/groups/g/timeline/new/symptom?kind=vital&author=u",
    );
    expect(appUrls.newSheet("g", "vital", { type: "spo2", search: { kind: "symptom" } })).toBe(
      "/app/groups/g/timeline/new/vital?kind=symptom&type=spo2",
    );
  });

  it("drops the add sheet's unknown or misplaced values", () => {
    // A type from an earlier sheet is replaced, not repeated.
    expect(appUrls.newSheet("g", "vital", { type: "weight", search: "?type=spo2&kind=note" })).toBe(
      "/app/groups/g/timeline/new/vital?kind=note&type=weight",
    );
    expect(appUrls.newSheet("g", "symptom", { search: "?type=spo2" })).toBe(
      "/app/groups/g/timeline/new/symptom",
    );
    // @ts-expect-error: only vital types.
    expect(appUrls.newSheet("g", "vital", { type: "bogus" })).toBe("/app/groups/g/timeline/new/vital");
    expect(appUrls.newSheet("g", "symptom", { type: "spo2" })).toBe("/app/groups/g/timeline/new/symptom");
    // @ts-expect-error: notes and events have a page (`newEntry`), not a sheet.
    expect(appUrls.newSheet("g", "note", { search: "?kind=note" })).toBe("/app/groups/g/timeline?kind=note");
  });

  it("builds the edit sheet's path, carrying the timeline's filters", () => {
    expect(appUrls.editSheet(G, "e1")).toBe(`/app/groups/${G}/timeline/e1/edit`);
    expect(appUrls.editSheet("g", "e 1/x", { search: "?kind=vital&author=u&type=spo2" })).toBe(
      "/app/groups/g/timeline/e%201%2Fx/edit?kind=vital&author=u",
    );
    expect(appUrls.editSheet("g", "e1", { search: { kind: "symptom", author: "" } })).toBe(
      "/app/groups/g/timeline/e1/edit?kind=symptom",
    );
  });

  it("drops an unknown kind for a new entry", () => {
    // @ts-expect-error: only notes and events are drafted on their own page.
    expect(appUrls.newEntry("g", "symptom")).toBe(`/app/groups/g/entries/${NEW_ENTRY}`);
  });

  it("builds the provider sheets' paths, carrying the directory's search", () => {
    expect(appUrls.newProvider("g")).toBe("/app/groups/g/providers/new");
    expect(appUrls.newProvider("g", { type: "pharmacy" })).toBe("/app/groups/g/providers/new?type=pharmacy");
    // The type replaces the list's type filter; the rest is kept.
    expect(appUrls.newProvider("g", { type: "practice", search: "?q=west&type=clinician&past=1" })).toBe(
      "/app/groups/g/providers/new?q=west&type=practice&past=1",
    );
    expect(appUrls.newProvider("g", { search: "?q=west&type=clinician" })).toBe(
      "/app/groups/g/providers/new?q=west&type=clinician",
    );
    // @ts-expect-error: only provider types.
    expect(appUrls.newProvider("g", { type: "bogus" })).toBe("/app/groups/g/providers/new");
    expect(appUrls.editProvider("g", "p 1", { q: "cardio" })).toBe(
      "/app/groups/g/providers/p%201/edit?q=cardio",
    );
  });
});

describe("searchString", () => {
  it("encodes values", () => {
    expect(searchString({ q: "a b&c" })).toBe("?q=a+b%26c");
  });

  it("drops empty and missing values", () => {
    expect(searchString({ a: "", b: undefined, c: null, d: "1" })).toBe("?d=1");
    expect(searchString("?a=&b=2")).toBe("?b=2");
    expect(searchString(undefined)).toBe("");
  });

  it("keeps repeated parameters and their order", () => {
    expect(searchString("b=1&a=2&b=3")).toBe("?b=1&a=2&b=3");
  });
});

describe("appUrls.newGroup", () => {
  it("is a static path the group route never claims", () => {
    expect(appUrls.newGroup()).toBe("/app/groups/new");
  });
});
