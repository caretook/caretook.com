import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

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
