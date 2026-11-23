import { isManagerRole, isWriterRole } from "@caretook/data/permissions";
import { scopesForRole } from "@caretook/data/schema";

// What a new member's setup card lists. Pure: every step's state comes from
// the group's real data on the device; only the dismissal is stored.

/** How long after joining a group its setup card can show. */
export const SETUP_WINDOW_DAYS = 14;
const SETUP_WINDOW_MS = SETUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type SetupFacts = Readonly<{
  /** An allergy or condition is recorded, or "none known" is. */
  hasProfileBasics: boolean;
  hasMedication: boolean;
  /** An entry someone logged (not one written automatically with a medication or condition). */
  hasEntry: boolean;
  hasOtherMembers: boolean;
  connectorsEnabled: boolean;
}>;

export type SetupStep =
  | Readonly<{ id: "profile" | "medication" | "entry" | "invite"; done: boolean }>
  /** A pointer to the guide: never ticked, never counted toward completion. */
  | Readonly<{ id: "connect"; target: "assistants" | "devices" }>;

export type SetupPlan = Readonly<{
  steps: readonly SetupStep[];
  doneCount: number;
  total: number;
  finished: boolean;
}>;

/** Owners can always reach the switch; anyone else needs it on, and is sent to their own Devices page. */
const connectStep = (role: string, connectorsEnabled: boolean): SetupStep[] => {
  if (scopesForRole(role as Parameters<typeof scopesForRole>[0]).length === 0) return [];
  if (role === "owner") return [{ id: "connect", target: "assistants" }];
  return connectorsEnabled ? [{ id: "connect", target: "devices" }] : [];
};

/** The role's setup steps with their states, or null for a role with no checklist. */
export const gettingStartedSteps = ({
  role,
  facts,
}: {
  role: string | null | undefined;
  facts: SetupFacts;
}): SetupPlan | null => {
  if (!role || !isWriterRole(role)) return null;
  const counted: SetupStep[] = [
    { id: "profile", done: facts.hasProfileBasics },
    { id: "medication", done: facts.hasMedication },
    { id: "entry", done: facts.hasEntry },
    ...(isManagerRole(role) ? [{ id: "invite" as const, done: facts.hasOtherMembers }] : []),
  ];
  const doneCount = counted.filter((s) => "done" in s && s.done).length;
  return {
    steps: [...counted, ...connectStep(role, facts.connectorsEnabled)],
    doneCount,
    total: counted.length,
    finished: doneCount === counted.length,
  };
};

/** Whether someone who joined at `joinedAt` is still within the window (its last instant included). */
export const inSetupWindow = (joinedAt: string | null | undefined, now: number) => {
  const joined = joinedAt ? Date.parse(joinedAt) : Number.NaN;
  return Number.isFinite(joined) && now - joined <= SETUP_WINDOW_MS;
};
