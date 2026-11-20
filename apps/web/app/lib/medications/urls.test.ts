import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("medicationUrls", () => {
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
    expect(appUrls.medicationPasses(G)).toBe(`/app/groups/${G}/medications/passes`);
  });
});

describe("appUrls.medication", () => {
  it("is a medication's page in its group", () => {
    expect(appUrls.medication("g", "m 1")).toBe("/app/groups/g/medications/m%201");
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
});

describe("appUrls.medicationAllergies", () => {
  it("is the allergies sheet over the list, with the list's search kept", () => {
    expect(appUrls.medicationAllergies(G)).toBe(`/app/groups/${G}/medications/allergies`);
    expect(appUrls.medicationAllergies(G, "?q=met")).toBe(`/app/groups/${G}/medications/allergies?q=met`);
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
