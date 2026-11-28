import type { GroupSetup } from "@caretook/data/schema";

// The setup rules for a care group (onboarding-2): who sets it up, which of
// the setup pages' steps are done, whether the flow is finished, and whether
// opening the group should go to its setup pages. Pure: every step's state
// comes from the group's synced data on the device (`gettingStarted.sync.ts`
// reads it); only the account's choices are stored (`preferences.groupSetup`
// and the old `setupDismissed`).

/** The setup pages' steps, in flow order (`/app/groups/:groupId/setup/<step>`). */
export const GROUP_SETUP_STEPS = ["providers", "profile", "medications", "period"] as const;
export type GroupSetupStep = (typeof GROUP_SETUP_STEPS)[number];
export const isGroupSetupStep = (value: unknown): value is GroupSetupStep =>
  (GROUP_SETUP_STEPS as readonly unknown[]).includes(value);

/** What the device knows about the group that the setup rules need. */
export type GroupSetupFacts = Readonly<{
  /** A live provider. */
  hasProvider: boolean;
  /** An allergy or condition is recorded, or "none known" is. */
  hasProfileBasics: boolean;
  /** A live medication. */
  hasMedication: boolean;
  /** A live care period. */
  hasCarePeriod: boolean;
  /**
   * The group's earliest member (by when they joined), whoever they are now.
   * `care_group.created_by` isn't used: `/join` groups record the system
   * user and staff groups the staff member.
   */
  earliestMemberId: string | null;
}>;

const DONE: Record<GroupSetupStep, (facts: GroupSetupFacts) => boolean> = {
  providers: (f) => f.hasProvider,
  profile: (f) => f.hasProfileBasics,
  medications: (f) => f.hasMedication,
  period: (f) => f.hasCarePeriod,
};

/**
 * Whether this person sets the group up: its earliest member, while an
 * owner. That is the creator, the `/join` sign-up and the owner a staff
 * member invited; everyone else gets the welcome, never the setup pages.
 */
export const setsUpGroup = ({
  userId,
  role,
  facts,
}: {
  userId: string;
  role: string | null | undefined;
  facts: Pick<GroupSetupFacts, "earliestMemberId">;
}) => role === "owner" && facts.earliestMemberId === userId;

/** Each step with whether it's done, in flow order. */
export const groupSetupSteps = (facts: GroupSetupFacts) =>
  GROUP_SETUP_STEPS.map((id) => ({ id, done: DONE[id](facts) }));

/** Whether every step is done. */
export const groupSetupFinished = (facts: GroupSetupFacts) =>
  GROUP_SETUP_STEPS.every((id) => DONE[id](facts));

/** The first step not done yet, or null when the flow is finished. */
export const firstUnfinishedStep = (facts: GroupSetupFacts): GroupSetupStep | null =>
  GROUP_SETUP_STEPS.find((id) => !DONE[id](facts)) ?? null;

/** Whether the account has opened this group's setup pages (on any device). */
export const setupOpened = (groupSetup: GroupSetup | undefined, groupId: string) =>
  groupSetup?.[groupId]?.opened === true;

/**
 * Where opening the group should go first, or null to open it as asked: the
 * first unfinished step, only when the settings are known (a new or wiped
 * device never redirects again), this person sets the group up, the flow
 * isn't finished, and the account has neither opened it nor dismissed the
 * old setup card for this group.
 */
export const setupRedirectStep = ({
  groupId,
  userId,
  role,
  facts,
  settingsKnown,
  settings,
}: {
  groupId: string;
  userId: string;
  role: string | null | undefined;
  facts: GroupSetupFacts;
  settingsKnown: boolean;
  settings: Readonly<{ groupSetup: GroupSetup; setupDismissed: readonly string[] }>;
}): GroupSetupStep | null => {
  if (!settingsKnown || !setsUpGroup({ userId, role, facts })) return null;
  if (setupOpened(settings.groupSetup, groupId) || settings.setupDismissed.includes(groupId)) return null;
  return firstUnfinishedStep(facts);
};
