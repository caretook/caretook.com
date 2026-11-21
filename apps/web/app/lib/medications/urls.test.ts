import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("medicationUrls", () => {
  it("builds the two tabs (the list with its search), and a medication's page", () => {
    expect(appUrls.medicationSchedule(G)).toBe(`/app/groups/${G}/medications/schedule`);
    expect(appUrls.medicationList(G)).toBe(`/app/groups/${G}/medications/list`);
    expect(appUrls.medicationList("g", "?q=blood&status=current")).toBe(
      "/app/groups/g/medications/list?q=blood&status=current",
    );
    expect(appUrls.medicationList("g", { q: "", status: "completed" })).toBe(
      "/app/groups/g/medications/list?status=completed",
    );
    expect(appUrls.medicationTab("g", "schedule")).toBe("/app/groups/g/medications/schedule");
    expect(appUrls.medicationTab("g", "list", "?type=otc")).toBe("/app/groups/g/medications/list?type=otc");
    expect(appUrls.medication(G, "m1")).toBe(`/app/groups/${G}/medications/m1`);
    expect(appUrls.medication("g", "a/b")).toBe("/app/groups/g/medications/a%2Fb");
    expect(appUrls.medicationsPrint(G)).toBe(`/app/groups/${G}/medications/print`);
    expect(appUrls.medicationPasses(G)).toBe(`/app/groups/${G}/medications/passes`);
  });
});

describe("appUrls.medication", () => {
  it("is a medication's page in its group", () => {
    expect(appUrls.medication("g", "m 1")).toBe("/app/groups/g/medications/m%201");
  });
});

describe("appUrls.newMedication and editMedication", () => {
  it("are sheets over the tab they open from, carrying its search", () => {
    expect(appUrls.newMedication("g", "schedule")).toBe("/app/groups/g/medications/schedule/new");
    expect(appUrls.newMedication("g", "list")).toBe("/app/groups/g/medications/list/new");
    expect(appUrls.newMedication("g", "list", "?q=lis&status=current")).toBe(
      "/app/groups/g/medications/list/new?q=lis&status=current",
    );
    expect(appUrls.editMedication("g", "m 1", "list")).toBe("/app/groups/g/medications/list/m%201/edit");
    expect(appUrls.editMedication("g", "m1", "schedule")).toBe("/app/groups/g/medications/schedule/m1/edit");
    expect(appUrls.editMedication("g", "m1", "list", { q: "", status: "discontinued" })).toBe(
      "/app/groups/g/medications/list/m1/edit?status=discontinued",
    );
  });
});

describe("appUrls.medicationAllergies", () => {
  it("is the allergies sheet over a tab, with the tab's search kept", () => {
    expect(appUrls.medicationAllergies(G, "list")).toBe(`/app/groups/${G}/medications/list/allergies`);
    expect(appUrls.medicationAllergies(G, "list", "?q=met")).toBe(
      `/app/groups/${G}/medications/list/allergies?q=met`,
    );
    expect(appUrls.medicationAllergies(G, "schedule")).toBe(
      `/app/groups/${G}/medications/schedule/allergies`,
    );
  });
});

describe("appUrls.medicationsPrintWeek", () => {
  it("is the weekly sheet, with its start when one is given", () => {
    expect(appUrls.medicationsPrintWeek(G)).toBe(`/app/groups/${G}/medications/print/week`);
    expect(appUrls.medicationsPrintWeek(G, "2026-11-23")).toBe(
      `/app/groups/${G}/medications/print/week?start=2026-11-23`,
    );
  });
});
