import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

describe("appUrls: care periods", () => {
  it("encodes the period and the add sheet's prefills, dropping dateOnly when false", () => {
    expect(appUrls.period("g", "p 1")).toBe("/app/groups/g/periods/p%201");
    expect(appUrls.editPeriod("g", "p 1")).toBe("/app/groups/g/periods/p%201/edit");
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
});
