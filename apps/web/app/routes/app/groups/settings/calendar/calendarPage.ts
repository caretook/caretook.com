import type { ActionResult } from "~/lib/core/api";
import type { CalendarSettings } from "~/lib/calendars/calendarSettings";

// The Calendar & reminders page's pure parts (calendars, appointments-2):
// its cards, their wording, and what the details card shows. The server
// stays the authority.

/** What every card gets from the page. */
export type CalendarCardProps = {
  groupId: string;
  userId: string;
  /** The member's settings: the server's, or this device's copy offline; null offline with none. */
  settings: CalendarSettings | null;
  /** Whether the page loaded with a connection. */
  online: boolean;
};

/**
 * One card's form posts to the page's action with its own `intent`; the
 * card adds its handler to `CARD_ACTIONS` (cardActions.ts).
 */
export type CardAction = (args: { groupId: string; form: FormData }) => Promise<ActionResult>;

export const OFFLINE_CALENDAR =
  "Needs a connection to load these settings. A change you make here is sent when you're back online.";

/** The generic default, said before the switch. */
export const detailsExplained = (recipient: string) =>
  `Emails, your calendar feed and Google Calendar say only "Event for ${recipient}", the time and a link back to Caretook.`;

export const DETAILS_FORBIDDEN = "Your group's owners keep details private.";

/** Under the switch when the member agreed to an older wording. */
export const detailsStaleNote = (agreedOn: string) =>
  `The wording has changed since you agreed on ${agreedOn}. Turn this on to agree again.`;

/** What the details card shows: the switch (and whether it's on and usable), or why not. */
export const detailsCardState = ({
  settings,
  allowed,
}: {
  settings: CalendarSettings | null;
  /** The owners' switch from the device; null until it has synced (the server's copy then). */
  allowed: boolean | null;
}) => {
  if (!settings) return { kind: "unknown" as const };
  const groupAllows = allowed ?? settings.groupAllowsDetails;
  return {
    kind: "switch" as const,
    on: groupAllows && settings.detailsConsent,
    disabled: !groupAllows,
    note: groupAllows ? null : DETAILS_FORBIDDEN,
    /** Agreed to an older wording; while the owners forbid details, there's nothing to agree to. */
    stale: groupAllows && settings.detailsConsentStale,
  };
};
