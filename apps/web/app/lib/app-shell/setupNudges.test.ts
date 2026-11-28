import type { SetupNudgeFacts, SetupNudgeInput } from "./setupNudges";

import { describe, expect, it } from "vitest";
import {
  nextSetupNudge,
  onSetupPage,
  SETUP_NUDGE_FOLLOW_UP_MS,
  SETUP_NUDGE_INTERVAL_MS,
  SETUP_NUDGE_ORDER,
} from "./setupNudges";

// Fictional ids and times.
const GROUP = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b01";
const ME = "2b0c4d6e-1a3f-4c5b-9d7e-000000000001";
const OTHER = "2b0c4d6e-1a3f-4c5b-9d7e-000000000002";
const NOW = Date.UTC(2027, 5, 9, 19, 0);

const facts = (over: Partial<SetupNudgeFacts> = {}): SetupNudgeFacts => ({
  hasProvider: false,
  hasProfileBasics: false,
  hasMedication: false,
  hasCarePeriod: false,
  earliestMemberId: ME,
  hasEntry: false,
  ...over,
});
const FLOW_DONE = { hasProvider: true, hasProfileBasics: true, hasMedication: true, hasCarePeriod: true };

/** The creator, settings known, the setup pages opened, a new session. */
const input = (over: Partial<SetupNudgeInput> = {}): SetupNudgeInput => ({
  groupId: GROUP,
  userId: ME,
  role: "owner",
  facts: facts(),
  settingsKnown: true,
  settings: { groupSetup: { [GROUP]: { opened: true } }, setupDismissed: [] },
  onSetupPage: false,
  now: NOW,
  lastShownAt: null,
  shownThisSession: false,
  followUpAt: null,
  ...over,
});
const retiring = (...retired: ("help" | "entry")[]) => ({
  settings: { groupSetup: { [GROUP]: { opened: true as const, retired } }, setupDismissed: [] },
});

describe("nextSetupNudge", () => {
  it("offers help first, then entry: the order onboarding-3 extends", () => {
    expect(SETUP_NUDGE_ORDER.map((n) => n.id)).toEqual(["help", "entry"]);
    expect(nextSetupNudge(input())).toEqual({ nudge: "help" });
    expect(nextSetupNudge(input(retiring("help")))).toEqual({ nudge: "entry" });
    expect(nextSetupNudge(input(retiring("help", "entry")))).toEqual({ nudge: null, checkAt: null });
  });

  it("shows the session's first nudge at once, whenever the device last showed one", () => {
    expect(nextSetupNudge(input({ lastShownAt: NOW - 60_000 }))).toEqual({ nudge: "help" });
  });

  it("after the session's first, one an hour from the last", () => {
    const shown = { shownThisSession: true, lastShownAt: NOW - 10 * 60_000 };
    expect(nextSetupNudge(input(shown))).toEqual({
      nudge: null,
      checkAt: NOW - 10 * 60_000 + SETUP_NUDGE_INTERVAL_MS,
    });
    expect(nextSetupNudge(input({ ...shown, now: shown.lastShownAt + SETUP_NUDGE_INTERVAL_MS }))).toEqual({
      nudge: "help",
    });
    expect(nextSetupNudge(input({ shownThisSession: true, lastShownAt: null }))).toEqual({ nudge: "help" });
  });

  it("after Don't ask again, the next follows 30 s later, ahead of the hourly slot", () => {
    const followUpAt = NOW + SETUP_NUDGE_FOLLOW_UP_MS;
    const after = { ...retiring("help"), shownThisSession: true, lastShownAt: NOW, followUpAt };
    expect(nextSetupNudge(input(after))).toEqual({ nudge: null, checkAt: followUpAt });
    expect(nextSetupNudge(input({ ...after, now: followUpAt }))).toEqual({ nudge: "entry" });
  });

  it("skips a nudge whose work is done, by anyone: another member logged an entry", () => {
    expect(nextSetupNudge(input({ facts: facts(FLOW_DONE) }))).toEqual({ nudge: "entry" });
    expect(nextSetupNudge(input({ facts: facts({ hasEntry: true }) }))).toEqual({ nudge: "help" });
    expect(nextSetupNudge(input({ facts: facts({ ...FLOW_DONE, hasEntry: true }) }))).toEqual({
      nudge: null,
      checkAt: null,
    });
  });

  it("shows nothing before the setup pages were opened, but the old card's dismissal counts", () => {
    const none = { nudge: null, checkAt: null };
    expect(nextSetupNudge(input({ settings: { groupSetup: {}, setupDismissed: [] } }))).toEqual(none);
    expect(
      nextSetupNudge(input({ settings: { groupSetup: { [OTHER]: { opened: true } }, setupDismissed: [] } })),
    ).toEqual(none);
    expect(nextSetupNudge(input({ settings: { groupSetup: {}, setupDismissed: [GROUP] } }))).toEqual({
      nudge: "help",
    });
  });

  it("shows nothing on a setup page, with unknown settings, or before the facts", () => {
    const none = { nudge: null, checkAt: null };
    expect(nextSetupNudge(input({ onSetupPage: true }))).toEqual(none);
    expect(nextSetupNudge(input({ settingsKnown: false }))).toEqual(none);
    expect(nextSetupNudge(input({ facts: null }))).toEqual(none);
  });

  it("shows nothing to anyone who doesn't set the group up", () => {
    const none = { nudge: null, checkAt: null };
    expect(nextSetupNudge(input({ role: "caretaker" }))).toEqual(none);
    expect(nextSetupNudge(input({ facts: facts({ earliestMemberId: OTHER }) }))).toEqual(none);
  });
});

describe("onSetupPage", () => {
  it("matches the group's setup pages only", () => {
    expect(onSetupPage(`/app/groups/${GROUP}/setup/providers`, GROUP)).toBe(true);
    expect(onSetupPage(`/app/groups/${GROUP}/setup`, GROUP)).toBe(true);
    expect(onSetupPage(`/app/groups/${GROUP}/timeline`, GROUP)).toBe(false);
    expect(onSetupPage(`/app/groups/${GROUP}/setupx`, GROUP)).toBe(false);
    expect(onSetupPage(`/app/groups/${OTHER}/setup/providers`, GROUP)).toBe(false);
  });
});
