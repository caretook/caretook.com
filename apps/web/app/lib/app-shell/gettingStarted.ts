import type { GROUP_ROLE_NAMES } from "@caretook/data/permissions";

import { isGroupRoleName } from "@caretook/data/permissions";

// The Timeline's welcome (onboarding-2): a few words on what your role can
// do, for a member who didn't set the group up. The setter gets the setup
// pages instead (`groupSetup.ts`), so no card on the Timeline. Pure; only
// the dismissal is stored (`setupDismissed`).

/** How long after joining a group its welcome can show. */
export const SETUP_WINDOW_DAYS = 14;
const SETUP_WINDOW_MS = SETUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;

type GroupRoleName = (typeof GROUP_ROLE_NAMES)[number];

// Each names only what the role may do (care-groups.md); an easy role's pages are the timeline and Planner.
const WELCOMES: Record<GroupRoleName, string> = {
  owner:
    "You can add and change all of this care group's care information, and manage its members and settings.",
  admin: "You can add and change this care group's care information, and invite and manage its members.",
  caretaker:
    "You can log on the timeline and add and change medications, providers, the planner and the profile.",
  viewer:
    "You can see this care group's timeline, medications, providers and planner, and tick off todos assigned to you.",
  easy_helper:
    "You can log notes, events, symptoms, vitals and doses, change what you've logged, and tick off todos assigned to you.",
  easy_viewer: "You can see what's been logged and what's coming up, and tick off todos assigned to you.",
};

/** The welcome's text, or null for the setter, no role or one this build doesn't know. */
export const timelineWelcome = ({
  role,
  setsUp,
}: {
  role: string | null | undefined;
  /** Whether this person sets the group up (`setsUpGroup`). */
  setsUp: boolean;
}): string | null => (setsUp || !isGroupRoleName(role) ? null : WELCOMES[role]);

/** Whether someone who joined at `joinedAt` is still within the window (its last instant included). */
export const inSetupWindow = (joinedAt: string | null | undefined, now: number) => {
  const joined = joinedAt ? Date.parse(joinedAt) : Number.NaN;
  return Number.isFinite(joined) && now - joined <= SETUP_WINDOW_MS;
};
