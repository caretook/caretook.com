import { describe, expect, it } from "vitest";
import { NEW_ENTRY } from "../live-notes/liveEntry";
import { appUrls } from "./appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

// The composed object: its keys, and what crosses areas. Each area's builders
// are tested beside its `urls.ts`.

/** Every key of `appUrls`, frozen before the builders moved into the areas' urls.ts files. */
const KEYS = [
  "editMedication",
  "editPeriod",
  "editProvider",
  "editSheet",
  "editTask",
  "entry",
  "groupHome",
  "groupList",
  "groupSettings",
  "home",
  "medication",
  "medicationAllergies",
  "medicationPasses",
  "medications",
  "medicationsPrint",
  "medicationsPrintWeek",
  "newAppointmentWith",
  "newDose",
  "newEntry",
  "newGroup",
  "newMedication",
  "newPeriod",
  "newProvider",
  "newSheet",
  "newTask",
  "newUpcomingEntry",
  "passSheet",
  "pastEvents",
  "period",
  "periods",
  "printEntry",
  "profile",
  "profilePrint",
  "provider",
  "providers",
  "search",
  "settings",
  "task",
  "tasks",
  "timeline",
  "upcoming",
];

describe("appUrls", () => {
  it("has the frozen keys, once each", () => {
    expect(Object.keys(appUrls).sort()).toEqual(KEYS);
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

  it("encodes ids as path segments", () => {
    expect(appUrls.groupHome("a/b?c")).toBe("/app/groups/a%2Fb%3Fc");
    expect(appUrls.entry("g", "x y#z")).toBe("/app/groups/g/entries/x%20y%23z");
  });
});
