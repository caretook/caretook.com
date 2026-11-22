import { describe, expect, it } from "vitest";
import { easyRoleRedirect } from "./easyModeLock";

const G = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b01";
const base = `/app/groups/${G}`;
const timeline = `${base}/timeline`;
const TODO = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1c02";
const go = (pathname: string, easyRole = true) => easyRoleRedirect({ groupId: G, pathname, easyRole });

const ALLOWED = [
  timeline,
  `${timeline}/new/symptom`,
  `${timeline}/new/dose`,
  `${timeline}/abc/edit`,
  `${base}/entries/abc`,
  `${base}/entries/new`,
  `${base}/planner`,
  `${base}/planner/`,
  `${base}/todos/${TODO}`,
  `${base}/todos/${TODO}/`,
  `${base}/search`,
];

const REFUSED = [
  base,
  `${base}/settings`,
  `${base}/settings/members`,
  `${base}/providers`,
  `${base}/providers/p1`,
  `${base}/medications`,
  `${base}/medications/schedule`,
  `${base}/medications/m1`,
  `${base}/profile`,
  `${base}/profile/conditions/c1`,
  `${base}/periods`,
  `${base}/planner/past`,
  `${base}/plannerx`,
  `${base}/todos`,
  `${base}/todos/`,
  `${base}/todos/new`,
  `${base}/todos/${TODO}/edit`,
  `${base}/search/x`,
  `${base}/searches`,
  `${base}/timelines`,
  `${base}/entriesx`,
];

describe("easyRoleRedirect", () => {
  it("keeps an easy role on the timeline and its sheets, entries, the Planner, a todo's page and search", () => {
    for (const path of ALLOWED) expect(go(path), path).toBeNull();
  });

  it("sends an easy role from every other group route to the timeline", () => {
    for (const path of REFUSED) expect(go(path), path).toBe(timeline);
  });

  it("never moves a member with a regular role", () => {
    for (const path of [...ALLOWED, ...REFUSED]) expect(go(path, false), path).toBeNull();
  });
});
