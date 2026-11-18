import type { UnitChoices } from "./vitals";

import { z } from "zod";
import { UNIT_OPTIONS } from "./vitals";

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

export const userPreferencesZSchema = z.strictObject({
  units: unitChoicesZSchema.partial().optional(),
  timelineView: z.enum(TIMELINE_VIEWS).optional(),
});
export type UserPreferences = z.infer<typeof userPreferencesZSchema>;

/** The user's display units, with defaults for anything unset. */
export const resolveUnits = (prefs: UserPreferences | null | undefined): UnitChoices => ({
  ...DEFAULT_UNITS,
  ...prefs?.units,
});

export const resolveTimelineView = (prefs: UserPreferences | null | undefined): TimelineView =>
  prefs?.timelineView ?? DEFAULT_TIMELINE_VIEW;
