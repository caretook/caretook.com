import { describe, expect, it } from "vitest";
import { easyRoleRedirect } from "./easyModeLock";

const G = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b01";
const base = `/app/groups/${G}`;
const timeline = `${base}/timeline`;
const go = (pathname: string, easyRole = true) => easyRoleRedirect({ groupId: G, pathname, easyRole });

describe("easyRoleRedirect", () => {
  it("keeps an easy role on the timeline, its sheets and their notes' and events' pages", () => {
    for (const path of [
      timeline,
      `${timeline}/new/symptom`,
      `${timeline}/new/dose`,
      `${timeline}/abc/edit`,
      `${base}/entries/abc`,
      `${base}/entries/new`,
    ])
      expect(go(path), path).toBeNull();
  });

  it("sends an easy role from every other group route to the timeline", () => {
    for (const path of [
      base,
      `${base}/settings`,
      `${base}/settings/members`,
      `${base}/providers`,
      `${base}/providers/p1`,
      `${base}/medications`,
      `${base}/planner`,
      `${base}/search`,
      `${base}/profile`,
      `${base}/periods`,
      `${base}/timelines`,
      `${base}/entriesx`,
    ])
      expect(go(path), path).toBe(timeline);
  });

  it("never moves a member with a regular role", () => {
    expect(go(`${base}/settings`, false)).toBeNull();
    expect(go(`${base}/providers`, false)).toBeNull();
  });
});
