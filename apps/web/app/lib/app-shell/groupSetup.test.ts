import type { GroupSetupFacts } from "./groupSetup";

import { describe, expect, it } from "vitest";
import {
  firstUnfinishedStep,
  groupSetupFinished,
  groupSetupSteps,
  setsUpGroup,
  setupRedirectStep,
} from "./groupSetup";

// Fictional ids. A group's `created_by` is never an input: the rules see only
// who joined first, so a `/join` group (created by the system user) and a
// staff group (created by the staff member) set up like any other.
const GROUP = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b01";
const ME = "2b0c4d6e-1a3f-4c5b-9d7e-000000000001";
const OTHER = "2b0c4d6e-1a3f-4c5b-9d7e-000000000002";

const facts = (over: Partial<GroupSetupFacts> = {}): GroupSetupFacts => ({
  hasProvider: false,
  hasProfileBasics: false,
  hasMedication: false,
  hasCarePeriod: false,
  earliestMemberId: ME,
  ...over,
});
const ALL_DONE = facts({
  hasProvider: true,
  hasProfileBasics: true,
  hasMedication: true,
  hasCarePeriod: true,
});

describe("setsUpGroup", () => {
  it.each([
    ["the creator (the first member, an owner)", "owner", ME, true],
    ["a /join sign-up (the first member of a group the system user created)", "owner", ME, true],
    ["a staff group's invited owner (its first member; the staff member isn't one)", "owner", ME, true],
    ["a second owner (someone joined first)", "owner", OTHER, false],
    ["an invited caretaker", "caretaker", OTHER, false],
    ["an invited admin", "admin", OTHER, false],
    ["a viewer", "viewer", OTHER, false],
    ["the first member, no longer an owner", "caretaker", ME, false],
    ["the first member, now an admin", "admin", ME, false],
    ["the first member, now an Easy helper", "easy_helper", ME, false],
    ["the first member, now an Easy viewer", "easy_viewer", ME, false],
    ["the first member, with a role this build doesn't know", "steward", ME, false],
    ["the first member, with no role", null, ME, false],
    ["anyone, before the members have synced", "owner", null, false],
  ] as const)("%s: %s", (_, role, earliestMemberId, expected) => {
    expect(setsUpGroup({ userId: ME, role, facts: facts({ earliestMemberId }) })).toBe(expected);
  });
});

describe("the steps", () => {
  it("are providers, profile, medications and period, each done from its fact", () => {
    expect(groupSetupSteps(facts({ hasProvider: true, hasCarePeriod: true }))).toEqual([
      { id: "providers", done: true },
      { id: "profile", done: false },
      { id: "medications", done: false },
      { id: "period", done: true },
    ]);
    expect(
      groupSetupSteps(facts({ hasProfileBasics: true, hasMedication: true })).map((s) => s.done),
    ).toEqual([false, true, true, false]);
  });

  it("are finished only when all four are done", () => {
    expect(groupSetupFinished(facts())).toBe(false);
    expect(
      groupSetupFinished(facts({ hasProvider: true, hasProfileBasics: true, hasMedication: true })),
    ).toBe(false);
    expect(groupSetupFinished(ALL_DONE)).toBe(true);
  });

  it("start at the first one not done", () => {
    expect(firstUnfinishedStep(facts())).toBe("providers");
    expect(firstUnfinishedStep(facts({ hasProvider: true }))).toBe("profile");
    expect(firstUnfinishedStep(facts({ hasProvider: true, hasProfileBasics: true }))).toBe("medications");
    expect(firstUnfinishedStep({ ...ALL_DONE, hasCarePeriod: false })).toBe("period");
    expect(firstUnfinishedStep(ALL_DONE)).toBeNull();
  });
});

describe("setupRedirectStep", () => {
  const ask = (over: Partial<Parameters<typeof setupRedirectStep>[0]> = {}) =>
    setupRedirectStep({
      groupId: GROUP,
      userId: ME,
      role: "owner",
      facts: facts(),
      settingsKnown: true,
      settings: { groupSetup: {}, setupDismissed: [] },
      ...over,
    });

  it("sends the person who sets it up to the first unfinished step", () => {
    expect(ask()).toBe("providers");
    expect(ask({ facts: facts({ hasProvider: true }) })).toBe("profile");
  });

  it("never once the group is opened", () => {
    expect(ask({ settings: { groupSetup: { [GROUP]: { opened: true } }, setupDismissed: [] } })).toBeNull();
  });

  it("still for another group's opened record or retired nudges", () => {
    expect(ask({ settings: { groupSetup: { [OTHER]: { opened: true } }, setupDismissed: [] } })).toBe(
      "providers",
    );
    expect(ask({ settings: { groupSetup: { [GROUP]: { retired: ["help"] } }, setupDismissed: [] } })).toBe(
      "providers",
    );
  });

  it("never once the old setup card was dismissed for the group", () => {
    expect(ask({ settings: { groupSetup: {}, setupDismissed: [GROUP] } })).toBeNull();
  });

  it("never when the flow is finished", () => {
    expect(ask({ facts: ALL_DONE })).toBeNull();
  });

  it("never on settings the device doesn't know yet", () => {
    expect(ask({ settingsKnown: false })).toBeNull();
  });

  it("never for someone who doesn't set the group up", () => {
    expect(ask({ facts: facts({ earliestMemberId: OTHER }) })).toBeNull();
    expect(ask({ role: "caretaker", facts: facts({ earliestMemberId: OTHER }) })).toBeNull();
    expect(ask({ role: "viewer", facts: facts({ earliestMemberId: OTHER }) })).toBeNull();
  });
});
