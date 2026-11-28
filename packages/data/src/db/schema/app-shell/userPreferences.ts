import type { EasyModeSetting } from "./easyMode";
import type { UnitChoices } from "../timeline/vitals";

import { z } from "zod";
import { DEFAULT_EASY_MODE_SETTING, EASY_MODE_SETTINGS } from "./easyMode";
import { UNIT_OPTIONS } from "../timeline/vitals";

// Per-user settings, stored as jsonb on `user.preferences`. Every field is
// optional so new settings need no migration; read them through the
// resolvers below, which fill in defaults. Client-safe.

export const DEFAULT_UNITS: UnitChoices = {
  temperature: "f",
  weight: "lb",
  glucose: "mg/dL",
  volume: "mL",
};

export const unitChoicesZSchema = z.strictObject({
  temperature: z.enum(UNIT_OPTIONS.temperature),
  weight: z.enum(UNIT_OPTIONS.weight),
  glucose: z.enum(UNIT_OPTIONS.glucose),
  volume: z.enum(UNIT_OPTIONS.volume),
});

/** How the timeline lists entries: dense rows, or one card per entry. */
export const TIMELINE_VIEWS = ["rows", "cards"] as const;
export type TimelineView = (typeof TIMELINE_VIEWS)[number];
export const DEFAULT_TIMELINE_VIEW: TimelineView = "rows";

/** How the providers list shows each provider: a dense row, or the fuller item. Its own setting, same choices. */
export type ProvidersView = TimelineView;
export const DEFAULT_PROVIDERS_VIEW: ProvidersView = "rows";

/** The line under each timeline day: nothing, only what stands out, or everything. */
export const DAY_SUMMARY_MODES = ["off", "highlights", "full"] as const;
export type DaySummaryMode = (typeof DAY_SUMMARY_MODES)[number];
export const DEFAULT_DAY_SUMMARY_MODE: DaySummaryMode = "highlights";

/** The most care groups whose setup card one account remembers dismissing. */
export const MAX_SETUP_DISMISSED = 500;

/** The setup nudges a group's creator can retire (Don't ask again); later topics add to the end. */
export const SETUP_NUDGES = ["help", "entry"] as const;
export type SetupNudge = (typeof SETUP_NUDGES)[number];

/** The most care groups whose setup one account remembers. */
export const MAX_GROUP_SETUP = 500;

/** One group's setup, as the account that set it up left it: the setup pages opened, and the nudges retired. */
const groupSetupEntryZSchema = z.strictObject({
  opened: z.literal(true).optional(),
  retired: z.array(z.enum(SETUP_NUDGES)).max(SETUP_NUDGES.length).optional(),
});
export type GroupSetupEntry = z.infer<typeof groupSetupEntryZSchema>;
/** Per care group id. */
export type GroupSetup = Record<string, GroupSetupEntry>;

const groupSetupZSchema = z
  .record(z.uuid(), groupSetupEntryZSchema)
  .refine((setup) => Object.keys(setup).length <= MAX_GROUP_SETUP, {
    message: `At most ${MAX_GROUP_SETUP} groups`,
  });

export const userPreferencesZSchema = z.strictObject({
  units: unitChoicesZSchema.partial().optional(),
  timelineView: z.enum(TIMELINE_VIEWS).optional(),
  providersView: z.enum(TIMELINE_VIEWS).optional(),
  /** Easy mode: your own choice, easy or full (easyMode.ts). */
  easyMode: z.enum(EASY_MODE_SETTINGS).optional(),
  daySummary: z.enum(DAY_SUMMARY_MODES).optional(),
  /** The care groups whose setup card you dismissed. Only ever grows (`mergeSetupDismissed`). */
  setupDismissed: z.array(z.uuid()).max(MAX_SETUP_DISMISSED).optional(),
  /** Each care group's setup record (opened, retired nudges). Only ever grows (`mergeGroupSetup`). */
  groupSetup: groupSetupZSchema.optional(),
});
export type UserPreferences = z.infer<typeof userPreferencesZSchema>;

/** The user's display units, with defaults for anything unset. */
export const resolveUnits = (prefs: UserPreferences | null | undefined): UnitChoices => ({
  ...DEFAULT_UNITS,
  ...prefs?.units,
});

export const resolveTimelineView = (prefs: UserPreferences | null | undefined): TimelineView =>
  prefs?.timelineView ?? DEFAULT_TIMELINE_VIEW;

export const resolveProvidersView = (prefs: UserPreferences | null | undefined): ProvidersView =>
  prefs?.providersView ?? DEFAULT_PROVIDERS_VIEW;

/** Anything but a known setting (a stored `group` from before the easy roles) reads as the default. */
export const resolveEasyModeSetting = (prefs: UserPreferences | null | undefined): EasyModeSetting => {
  const stored: unknown = prefs?.easyMode;
  return EASY_MODE_SETTINGS.find((s) => s === stored) ?? DEFAULT_EASY_MODE_SETTING;
};

export const resolveDaySummaryMode = (prefs: UserPreferences | null | undefined): DaySummaryMode =>
  prefs?.daySummary ?? DEFAULT_DAY_SUMMARY_MODE;

export const resolveSetupDismissed = (prefs: UserPreferences | null | undefined): string[] =>
  prefs?.setupDismissed ?? [];

/**
 * Two lists of dismissed groups as one, so a dismissal made offline on one
 * device never undoes another device's. Keeps the newest within the cap.
 */
export const mergeSetupDismissed = (
  base: readonly string[] | null | undefined,
  added: readonly string[] | null | undefined,
): string[] => [...new Set([...(base ?? []), ...(added ?? [])])].slice(-MAX_SETUP_DISMISSED);

export const resolveGroupSetup = (prefs: UserPreferences | null | undefined): GroupSetup =>
  prefs?.groupSetup ?? {};

/**
 * Two setup records as one, so a change made offline on one device never
 * undoes another device's: every group from both, `opened` once either has
 * it, and both lists of retired nudges. Nothing is ever unset. Keeps the
 * newest groups within the cap (a group keeps its first place).
 */
export const mergeGroupSetup = (
  base: Readonly<GroupSetup> | null | undefined,
  added: Readonly<GroupSetup> | null | undefined,
): GroupSetup => {
  const merged: GroupSetup = {};
  for (const setup of [base ?? {}, added ?? {}])
    for (const [groupId, entry] of Object.entries(setup)) {
      const before = merged[groupId] ?? {};
      const retired = [...new Set([...(before.retired ?? []), ...(entry.retired ?? [])])];
      merged[groupId] = {
        ...((before.opened || entry.opened) && { opened: true as const }),
        ...(retired.length > 0 && { retired }),
      };
    }
  return Object.fromEntries(Object.entries(merged).slice(-MAX_GROUP_SETUP));
};
