import { z } from "zod";

// The calendars area's shared rules (appointments-2), client-safe: the lead
// times a reminder can use, what a member's sharing level is, and the
// consent a member gives before details leave Caretook. The settings page,
// the services and the feed, reminders and Google all use them.

/**
 * When a reminder goes, before an item starts: the evening before (18:00),
 * the morning of (7:00), or 120, 60 or 30 minutes before. Worked out in the
 * member's own zone.
 */
export const REMINDER_LEADS = ["eveningBefore", "morningOf", 120, 60, 30] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];

/** A member picks at most this many leads. */
export const MAX_REMINDER_LEADS = 3;

/** The preset: the evening before and 1 h before. */
export const DEFAULT_REMINDER_LEADS: readonly ReminderLead[] = ["eveningBefore", 60];

export const reminderLeadZSchema = z.union([
  z.literal("eveningBefore"),
  z.literal("morningOf"),
  z.literal(120),
  z.literal(60),
  z.literal(30),
]);

/** Up to three different leads, kept in `REMINDER_LEADS` order. */
export const reminderLeadsZSchema = z
  .array(reminderLeadZSchema)
  .max(MAX_REMINDER_LEADS)
  .refine((leads) => new Set(leads).size === leads.length, "Pick each time once")
  .transform((leads) => REMINDER_LEADS.filter((lead) => leads.includes(lead)));

/** What a per-appointment override does: no reminders for it, or extra leads for it. */
export const REMINDER_OVERRIDE_MODES = ["mute", "extra"] as const;
export type ReminderOverrideMode = (typeof REMINDER_OVERRIDE_MODES)[number];

// ---------------------------------------------------------------------------
// Sharing: generic by default, details by consent and the owners' allowance
// ---------------------------------------------------------------------------

export const SHARE_LEVELS = ["generic", "details"] as const;
export type ShareLevel = (typeof SHARE_LEVELS)[number];

/**
 * How much of an item leaves Caretook for a member (their emails, feed and
 * Google calendar): details only when they've consented and the group's
 * owners allow it, else generic.
 */
export const shareLevel = ({
  memberConsent,
  groupAllowsDetails,
}: {
  memberConsent: boolean;
  groupAllowsDetails: boolean;
}): ShareLevel => (memberConsent && groupAllowsDetails ? "details" : "generic");

/**
 * The consent a member gives by turning details on. Bump the version when
 * the wording changes in substance: a recorded consent names the version
 * the member saw.
 */
export const DETAILS_CONSENT_VERSION = "2026-11-20";
export const DETAILS_CONSENT_TEXT =
  "Include titles, places and providers in my reminder emails, calendar feed and Google Calendar. They then go to my inbox and my calendar provider, under their terms. Notes never leave Caretook.";

/**
 * Whether a member's recorded consent counts: agreed, and to the current
 * wording. Everything that decides a share level asks this, never the time
 * alone, so a bumped version makes older consents generic at the next read.
 */
export const hasDetailsConsent = ({
  consentAt,
  consentVersion,
}: {
  consentAt: string | null | undefined;
  consentVersion: string | null | undefined;
}) => !!consentAt && consentVersion === DETAILS_CONSENT_VERSION;

/** What a member's own calendar settings change sends (`calendars.settings.update`). Left out keeps it. */
export const calendarSettingsChangeZSchema = z.strictObject({
  remindersOn: z.boolean().optional(),
  reminderLeads: reminderLeadsZSchema.optional(),
  /** On records the consent, only with the current `detailsConsentVersion`; off clears it. */
  detailsConsent: z.boolean().optional(),
  /** The version of the wording the device showed when the member turned details on. */
  detailsConsentVersion: z.string().max(40).optional(),
});
export type CalendarSettingsChange = z.input<typeof calendarSettingsChangeZSchema>;
