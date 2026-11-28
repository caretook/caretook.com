import type { GroupSetupFacts } from "./groupSetup";
import type { GroupSetup, SetupNudge } from "@caretook/data/schema";

import { groupHome } from "../core/urls";
import { groupSetupFinished, setsUpGroup, setupOpened } from "./groupSetup";

// The setup nudges' scheduler (onboarding-2): which toast nudge, if any, is
// due now for the person who sets the group up, or when to look again.
// Pure: the group layout's `useSetupNudges` feeds it the device's facts, the
// account's setup record and this device's own timing (the last time it
// showed a nudge, in local storage; whether this browser session has shown
// one, in session storage), and shows what it returns.

/** At most one nudge an hour on a device, after the session's first. */
export const SETUP_NUDGE_INTERVAL_MS = 60 * 60_000;
/** After Don't ask again, the next nudge follows this soon. */
export const SETUP_NUDGE_FOLLOW_UP_MS = 30_000;
/** How long a nudge's toast stays (two buttons take longer to read than a done action's). */
export const SETUP_NUDGE_TIMEOUT = 15_000;

/** What the nudges need to know about the group: the setup pages' facts, and whether anyone logged an entry. */
export type SetupNudgeFacts = GroupSetupFacts & Readonly<{ hasEntry: boolean }>;

/**
 * The nudges in the order they're offered, each with when its work is done
 * (by anyone). `onboarding-3` appends invite and connect.
 */
export const SETUP_NUDGE_ORDER: readonly { id: SetupNudge; done: (facts: SetupNudgeFacts) => boolean }[] = [
  { id: "help", done: groupSetupFinished },
  { id: "entry", done: (facts) => facts.hasEntry },
];

/** Whether `pathname` is one of the group's setup pages (no nudge shows over them). */
export const onSetupPage = (pathname: string, groupId: string) => {
  const base = `${groupHome(groupId)}/setup`;
  return pathname === base || pathname.startsWith(`${base}/`);
};

export type SetupNudgeInput = Readonly<{
  groupId: string;
  userId: string;
  role: string | null | undefined;
  /** The device's facts, or null until it has answered. */
  facts: SetupNudgeFacts | null;
  /** Whether the server has answered for the settings on this device (`settingsKnown`). */
  settingsKnown: boolean;
  settings: Readonly<{ groupSetup: GroupSetup; setupDismissed: readonly string[] }>;
  /** A setup page is open. */
  onSetupPage: boolean;
  now: number;
  /** When this device last showed a nudge (ms), or null. */
  lastShownAt: number | null;
  /** This browser session has shown a nudge. */
  shownThisSession: boolean;
  /** After a Don't ask again: when the next nudge may follow (ms), or null. */
  followUpAt: number | null;
}>;

/** The nudge to show now, or none and when to look again (null: only when something changes). */
export type SetupNudgePlan = { nudge: SetupNudge } | { nudge: null; checkAt: number | null };

const NONE: SetupNudgePlan = { nudge: null, checkAt: null };

/**
 * The nudge due now, the first in `SETUP_NUDGE_ORDER` that's neither done
 * nor retired for this group. Only for the person who sets the group up,
 * with known settings, once the setup pages were opened (or the old setup
 * card dismissed), and never over a setup page. The session's first nudge
 * shows at once; after that one an hour, or a retirement's follow-up.
 */
export const nextSetupNudge = (input: SetupNudgeInput): SetupNudgePlan => {
  const { groupId, facts, settings, now } = input;
  if (!facts || !input.settingsKnown || input.onSetupPage) return NONE;
  if (!setsUpGroup({ userId: input.userId, role: input.role, facts })) return NONE;
  if (!setupOpened(settings.groupSetup, groupId) && !settings.setupDismissed.includes(groupId)) return NONE;
  const retired = settings.groupSetup[groupId]?.retired ?? [];
  const due = SETUP_NUDGE_ORDER.find((n) => !retired.includes(n.id) && !n.done(facts));
  if (!due) return NONE;
  if (!input.shownThisSession) return { nudge: due.id };
  const slots = [
    input.lastShownAt === null ? now : input.lastShownAt + SETUP_NUDGE_INTERVAL_MS,
    ...(input.followUpAt === null ? [] : [input.followUpAt]),
  ];
  const checkAt = Math.min(...slots);
  return checkAt <= now ? { nudge: due.id } : { nudge: null, checkAt };
};
