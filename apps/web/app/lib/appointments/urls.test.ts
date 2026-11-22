import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("appUrls.planner", () => {
  const G = "11111111-1111-4111-8111-111111111111";
  const A = "22222222-2222-4222-8222-222222222222";

  it("is the group's Planner, carrying the timeline's filters", () => {
    expect(appUrls.planner(G)).toBe(`/app/groups/${G}/planner`);
    expect(appUrls.planner(G, { kind: "event", author: A })).toBe(
      `/app/groups/${G}/planner?kind=event&author=${A}`,
    );
    expect(appUrls.planner(G, { kind: null, author: null })).toBe(`/app/groups/${G}/planner`);
    expect(appUrls.planner(G, "?author=" + A)).toBe(`/app/groups/${G}/planner?author=${A}`);
  });

  it("has a Past tab", () => {
    expect(appUrls.plannerPast(G)).toBe(`/app/groups/${G}/planner/past`);
    expect(appUrls.plannerPast(G, { author: A })).toBe(`/app/groups/${G}/planner/past?author=${A}`);
  });

  it("adds an appointment through the time picker first, and a note without it", () => {
    expect(appUrls.newPlannerEntry(G, "event")).toBe(`/app/groups/${G}/entries/new?kind=event&when=pick`);
    expect(appUrls.newPlannerEntry(G, "note")).toBe(`/app/groups/${G}/entries/new?kind=note`);
  });
});

describe("appUrls.newAppointmentWith", () => {
  it("is a new appointment, day first, with the provider to link", () => {
    expect(appUrls.newAppointmentWith(G, "p1")).toBe(
      `/app/groups/${G}/entries/new?kind=event&when=pick&provider=p1`,
    );
  });
});
