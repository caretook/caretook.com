import { describe, expect, it } from "vitest";
import { appUrls, searchString, withoutSheetParams } from "./appUrls";
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

  it("builds the medication list with its search, and a medication's page", () => {
    expect(appUrls.medications(G)).toBe(`/app/groups/${G}/medications`);
    expect(appUrls.medications("g", "?q=blood&status=current")).toBe(
      "/app/groups/g/medications?q=blood&status=current",
    );
    expect(appUrls.medications("g", { q: "", status: "completed" })).toBe(
      "/app/groups/g/medications?status=completed",
    );
    expect(appUrls.medication(G, "m1")).toBe(`/app/groups/${G}/medications/m1`);
    expect(appUrls.medication("g", "a/b")).toBe("/app/groups/g/medications/a%2Fb");
    expect(appUrls.medicationsPrint(G)).toBe(`/app/groups/${G}/medications/print`);
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

describe("appUrls.newDose", () => {
  const M = "11111111-2222-4333-8444-555555555555";
  it("is the Dose sheet over the timeline, carrying its filters", () => {
    expect(appUrls.newDose(G)).toBe(`/app/groups/${G}/timeline/new/dose`);
    expect(appUrls.newDose(G, { search: "?kind=dose&type=spo2" })).toBe(
      `/app/groups/${G}/timeline/new/dose?kind=dose`,
    );
  });

  it("can start on a medication and a slot, replacing ones already in the search", () => {
    expect(appUrls.newDose(G, { medicationId: M, slot: "08:00", search: "?medication=x&slot=09:00" })).toBe(
      `/app/groups/${G}/timeline/new/dose?medication=${M}&slot=08%3A00`,
    );
  });

  it("is dropped from the timeline a sheet closes to", () => {
    expect(appUrls.timeline(G, withoutSheetParams(`?kind=dose&medication=${M}&slot=08:00`))).toBe(
      `/app/groups/${G}/timeline?kind=dose`,
    );
  });
});

describe("appUrls.medication", () => {
  it("is a medication's page in its group", () => {
    expect(appUrls.medication("g", "m 1")).toBe("/app/groups/g/medications/m%201");
  });
});

describe("appUrls.upcoming", () => {
  const G = "11111111-1111-4111-8111-111111111111";
  const A = "22222222-2222-4222-8222-222222222222";

  it("is the group's Upcoming section, carrying the timeline's filters", () => {
    expect(appUrls.upcoming(G)).toBe(`/app/groups/${G}/upcoming`);
    expect(appUrls.upcoming(G, { kind: "event", author: A })).toBe(
      `/app/groups/${G}/upcoming?kind=event&author=${A}`,
    );
    expect(appUrls.upcoming(G, { kind: null, author: null })).toBe(`/app/groups/${G}/upcoming`);
    expect(appUrls.upcoming(G, "?author=" + A)).toBe(`/app/groups/${G}/upcoming?author=${A}`);
  });

  it("has a Past tab", () => {
    expect(appUrls.pastEvents(G)).toBe(`/app/groups/${G}/upcoming/past`);
    expect(appUrls.pastEvents(G, { author: A })).toBe(`/app/groups/${G}/upcoming/past?author=${A}`);
  });

  it("adds appointments and reminders through the time picker first", () => {
    expect(appUrls.newUpcomingEntry(G, "event")).toBe(`/app/groups/${G}/entries/new?kind=event&when=pick`);
    expect(appUrls.newUpcomingEntry(G, "note")).toBe(`/app/groups/${G}/entries/new?kind=note&when=pick`);
  });
});

describe("appUrls.newMedication and editMedication", () => {
  it("are sheets over the list, carrying its search and status filter", () => {
    expect(appUrls.newMedication("g")).toBe("/app/groups/g/medications/new");
    expect(appUrls.newMedication("g", "?q=lis&status=current")).toBe(
      "/app/groups/g/medications/new?q=lis&status=current",
    );
    expect(appUrls.editMedication("g", "m 1")).toBe("/app/groups/g/medications/m%201/edit");
    expect(appUrls.editMedication("g", "m1", { q: "", status: "discontinued" })).toBe(
      "/app/groups/g/medications/m1/edit?status=discontinued",
    );
  });

  it("builds the search page, with its text and the section shown in full", () => {
    expect(appUrls.search(G)).toBe(`/app/groups/${G}/search`);
    expect(appUrls.search(G, "")).toBe(`/app/groups/${G}/search`);
    expect(appUrls.search(G, "knee pain")).toBe(`/app/groups/${G}/search?q=knee+pain`);
    expect(appUrls.search(G, "knee", { all: "entry" })).toBe(`/app/groups/${G}/search?q=knee&all=entry`);
  });

  it("drops a full section without a search, or of an unknown type", () => {
    expect(appUrls.search(G, " ", { all: "entry" })).toBe(`/app/groups/${G}/search?q=+`);
    // @ts-expect-error: only the search's item types exist.
    expect(appUrls.search(G, "knee", { all: "bogus" })).toBe(`/app/groups/${G}/search?q=knee`);
  });
});

describe("appUrls: care periods", () => {
  it("builds the periods page, a period's page and the add sheet with its prefills", () => {
    expect(appUrls.periods("g")).toBe("/app/groups/g/periods");
    expect(appUrls.period("g", "p 1")).toBe("/app/groups/g/periods/p%201");
    expect(appUrls.newPeriod("g")).toBe("/app/groups/g/periods/new");
    expect(
      appUrls.newPeriod("g", {
        type: "hospital",
        startedAt: "2026-11-12T22:20:00.000Z",
        dateOnly: false,
        place: "p1",
      }),
    ).toBe("/app/groups/g/periods/new?type=hospital&startedAt=2026-11-12T22%3A20%3A00.000Z&place=p1");
    expect(appUrls.newPeriod("g", { dateOnly: true })).toBe("/app/groups/g/periods/new?dateOnly=1");
  });

  it("builds a period's edit sheet", () => {
    expect(appUrls.editPeriod("g", "p 1")).toBe("/app/groups/g/periods/p%201/edit");
  });
});
