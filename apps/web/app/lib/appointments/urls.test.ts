import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

const G = "11111111-1111-4111-8111-111111111111";
const A = "22222222-2222-4222-8222-222222222222";

describe("appUrls.planner", () => {
  it("carries the timeline's filters, in any form, and drops empty ones", () => {
    expect(appUrls.planner(G, { kind: "event", author: A })).toBe(
      `/app/groups/${G}/planner?kind=event&author=${A}`,
    );
    expect(appUrls.planner(G, { kind: null, author: null })).toBe(`/app/groups/${G}/planner`);
    expect(appUrls.planner(G, "?author=" + A)).toBe(`/app/groups/${G}/planner?author=${A}`);
    expect(appUrls.plannerPast(G, { author: A })).toBe(`/app/groups/${G}/planner/past?author=${A}`);
  });

  it("adds an appointment through the time picker first, and a note without it", () => {
    expect(appUrls.newPlannerEntry(G, "event")).toBe(`/app/groups/${G}/entries/new?kind=event&when=pick`);
    expect(appUrls.newPlannerEntry(G, "note")).toBe(`/app/groups/${G}/entries/new?kind=note`);
  });
});
