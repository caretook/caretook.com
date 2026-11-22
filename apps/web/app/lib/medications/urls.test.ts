import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

describe("appUrls: medications", () => {
  it("carries the list's search, in any form, and drops empty values", () => {
    expect(appUrls.medicationList("g", "?q=blood&status=current")).toBe(
      "/app/groups/g/medications/list?q=blood&status=current",
    );
    expect(appUrls.medicationList("g", { q: "", status: "completed" })).toBe(
      "/app/groups/g/medications/list?status=completed",
    );
    expect(appUrls.medicationTab("g", "list", "?type=otc")).toBe("/app/groups/g/medications/list?type=otc");
  });

  it("encodes a medication's id", () => {
    expect(appUrls.medication("g", "a/b")).toBe("/app/groups/g/medications/a%2Fb");
    expect(appUrls.medication("g", "m 1")).toBe("/app/groups/g/medications/m%201");
  });

  it("opens sheets over the tab they open from, carrying its search", () => {
    expect(appUrls.newMedication("g", "list", "?q=lis&status=current")).toBe(
      "/app/groups/g/medications/list/new?q=lis&status=current",
    );
    expect(appUrls.editMedication("g", "m 1", "schedule")).toBe(
      "/app/groups/g/medications/schedule/m%201/edit",
    );
    expect(appUrls.editMedication("g", "m1", "list", { q: "", status: "discontinued" })).toBe(
      "/app/groups/g/medications/list/m1/edit?status=discontinued",
    );
    expect(appUrls.medicationAllergies("g", "list", "?q=met")).toBe(
      "/app/groups/g/medications/list/allergies?q=met",
    );
  });

  it("puts the Passes tab and its add-pass sheet under the Medications page", () => {
    expect(appUrls.medicationPasses("g")).toBe("/app/groups/g/medications/passes");
    expect(appUrls.newPass("g")).toBe("/app/groups/g/medications/passes/new");
  });

  it("starts the weekly sheet on a day only when one is given", () => {
    expect(appUrls.medicationsPrintWeek("g")).toBe("/app/groups/g/medications/print/week");
    expect(appUrls.medicationsPrintWeek("g", "2026-11-23")).toBe(
      "/app/groups/g/medications/print/week?start=2026-11-23",
    );
  });
});
