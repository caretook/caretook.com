import type { SetupFacts } from "./gettingStarted";

import { describe, expect, it } from "vitest";
import { gettingStartedSteps, inSetupWindow, SETUP_WINDOW_DAYS } from "./gettingStarted";

const NONE: SetupFacts = {
  hasProfileBasics: false,
  hasMedication: false,
  hasEntry: false,
  hasOtherMembers: false,
  connectorsEnabled: false,
};
const ALL: SetupFacts = {
  hasProfileBasics: true,
  hasMedication: true,
  hasEntry: true,
  hasOtherMembers: true,
  connectorsEnabled: true,
};
const ids = (role: string, facts = NONE) => gettingStartedSteps({ role, facts })?.steps.map((s) => s.id);

describe("gettingStartedSteps", () => {
  it("gives managers the invite step and caretakers none", () => {
    expect(ids("owner")).toEqual(["profile", "medication", "entry", "invite", "connect"]);
    expect(ids("admin")).toEqual(["profile", "medication", "entry", "invite"]);
    expect(ids("caretaker")).toEqual(["profile", "medication", "entry"]);
  });

  it.each(["viewer", "easy_helper", "easy_viewer"])("gives %s a welcome and no steps", (role) => {
    for (const facts of [NONE, ALL]) {
      const plan = gettingStartedSteps({ role, facts });
      expect(plan?.kind).toBe("welcome");
      expect(plan?.steps).toEqual([]);
    }
  });

  it("offers each welcome only what the role can do", () => {
    const text = (role: string) => {
      const plan = gettingStartedSteps({ role, facts: NONE });
      return plan?.kind === "welcome" ? plan.text : "";
    };
    expect(text("easy_helper")).toContain("log");
    expect(text("viewer")).not.toMatch(/\blog\b|\badd\b/i);
    expect(text("easy_viewer")).not.toMatch(/\blog\b|\badd\b|medication|provider/i);
    for (const role of ["viewer", "easy_helper", "easy_viewer"])
      expect(text(role)).toContain("todos assigned to you");
  });

  it("gives nothing to an unknown role or none", () => {
    expect(gettingStartedSteps({ role: "someone_new", facts: ALL })).toBeNull();
    expect(gettingStartedSteps({ role: "constructor", facts: ALL })).toBeNull();
    expect(gettingStartedSteps({ role: null, facts: ALL })).toBeNull();
  });

  it("ticks each step from its fact", () => {
    const plan = gettingStartedSteps({ role: "admin", facts: { ...NONE, hasMedication: true } });
    expect(plan?.steps).toContainEqual({ id: "medication", done: true });
    expect(plan?.steps).toContainEqual({ id: "profile", done: false });
    expect(plan).toMatchObject({ doneCount: 1, total: 4, finished: false });
  });

  it("sends an owner to Assistants whatever the switch says", () => {
    for (const connectorsEnabled of [false, true]) {
      const plan = gettingStartedSteps({ role: "owner", facts: { ...NONE, connectorsEnabled } });
      expect(plan?.steps).toContainEqual({ id: "connect", target: "assistants" });
    }
  });

  it.each(["admin", "caretaker"])("sends %s to Devices only with the switch on", (role) => {
    expect(ids(role)).not.toContain("connect");
    const plan = gettingStartedSteps({ role, facts: { ...NONE, connectorsEnabled: true } });
    expect(plan?.steps).toContainEqual({ id: "connect", target: "devices" });
  });

  it("never counts the connect step toward completion", () => {
    const facts = { ...ALL, connectorsEnabled: false };
    expect(gettingStartedSteps({ role: "owner", facts })).toMatchObject({
      doneCount: 4,
      total: 4,
      finished: true,
    });
    expect(gettingStartedSteps({ role: "caretaker", facts: ALL })).toMatchObject({
      doneCount: 3,
      total: 3,
      finished: true,
    });
  });
});

describe("inSetupWindow", () => {
  const joined = "2027-06-01T12:00:00.000Z";
  const at = Date.parse(joined);
  const windowMs = SETUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  it("holds through the window's last instant and not after", () => {
    expect(inSetupWindow(joined, at)).toBe(true);
    expect(inSetupWindow(joined, at + windowMs)).toBe(true);
    expect(inSetupWindow(joined, at + windowMs + 1)).toBe(false);
  });

  it("holds when the device's clock is behind the join", () => {
    expect(inSetupWindow(joined, at - 60_000)).toBe(true);
  });

  it("is false without a readable date", () => {
    expect(inSetupWindow(null, at)).toBe(false);
    expect(inSetupWindow("not a date", at)).toBe(false);
  });
});
