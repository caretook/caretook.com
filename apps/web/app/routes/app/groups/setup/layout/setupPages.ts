import type { GroupSetupStep } from "../../../../../lib/app-shell/groupSetup";

// The setup steps that have a page, in flow order, and what each page is
// called. Pure, so web:unit tests it. A step without a page yet goes to the
// first (`step/route.tsx`), and the last page's Next finishes on the Timeline.

/** The steps with a page. Each is a static child in `../routes.ts`. */
export const SETUP_PAGES = ["providers"] as const satisfies readonly GroupSetupStep[];
export type SetupPage = (typeof SETUP_PAGES)[number];

const isSetupPage = (value: unknown): value is SetupPage =>
  (SETUP_PAGES as readonly unknown[]).includes(value);

/** Each step's progress label and its page's heading and line under it. */
export const SETUP_STEP_META: Record<GroupSetupStep, { label: string; title: string; description: string }> =
  {
    providers: {
      label: "Providers",
      title: "Who helps with their care?",
      description: "Doctors, clinics, pharmacies and anyone else. Medications and visits can link to them.",
    },
    profile: {
      label: "Allergies and conditions",
      title: "Allergies and conditions",
      description: "What everyone helping should know.",
    },
    medications: {
      label: "Medications",
      title: "Medications",
      description: "What they take, and who prescribed it.",
    },
    period: {
      label: "Care period",
      title: "Where is care happening?",
      description: "At home, in a hospital or somewhere else.",
    },
  };

/** The page a setup path is on (its last segment), or null for anything else. */
export const setupPageAt = (pathname: string): SetupPage | null => {
  const last = pathname.replace(/\/+$/, "").split("/").pop();
  return isSetupPage(last) ? last : null;
};

/** The page after this one, or null when it's the last (Next then finishes on the Timeline). */
export const nextSetupPage = (page: SetupPage): SetupPage | null => {
  const i = SETUP_PAGES.indexOf(page);
  return SETUP_PAGES[i + 1] ?? null;
};
