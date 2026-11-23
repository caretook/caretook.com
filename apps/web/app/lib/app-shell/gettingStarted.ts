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
  kind: "steps";
  steps: readonly SetupStep[];
  doneCount: number;
  total: number;
  finished: boolean;
}>;

/** A role that can't do the setup steps: a few words on what it can do, and no steps. */
export type RoleWelcome = Readonly<{ kind: "welcome"; text: string; steps: readonly [] }>;

// Each names only what the role may do (care-groups.md); an easy role's pages are the timeline and Planner.
const WELCOMES = new Map([
  [
    "viewer",
    "You can see this care group's timeline, medications, providers and planner, and tick off todos assigned to you.",
  ],
  [
    "easy_helper",
    "You can log notes, events, symptoms, vitals and doses, change what you've logged, and tick off todos assigned to you.",
  ],
  ["easy_viewer", "You can see what's been logged and what's coming up, and tick off todos assigned to you."],
]);

/** Owners can always reach the switch; anyone else needs it on, and is sent to their own Devices page. */
const connectStep = (role: string, connectorsEnabled: boolean): SetupStep[] => {
  if (scopesForRole(role as Parameters<typeof scopesForRole>[0]).length === 0) return [];
  if (role === "owner") return [{ id: "connect", target: "assistants" }];
  return connectorsEnabled ? [{ id: "connect", target: "devices" }] : [];
};

/** The role's setup steps with their states, its welcome, or null for a role this build doesn't know. */
export const gettingStartedSteps = ({
  role,
  facts,
}: {
  role: string | null | undefined;
  facts: SetupFacts;
}): SetupPlan | RoleWelcome | null => {
  const welcome = role ? WELCOMES.get(role) : undefined;
  if (welcome) return { kind: "welcome", text: welcome, steps: [] };
  if (!role || !isWriterRole(role)) return null;
  const counted: SetupStep[] = [
    { id: "profile", done: facts.hasProfileBasics },
    { id: "medication", done: facts.hasMedication },
    { id: "entry", done: facts.hasEntry },
    ...(isManagerRole(role) ? [{ id: "invite" as const, done: facts.hasOtherMembers }] : []),
  ];
  const doneCount = counted.filter((s) => "done" in s && s.done).length;
  return {
    kind: "steps",
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
