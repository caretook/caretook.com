import { addDays, dayInZone, startOfDay } from "@caretook/data/domain";

// Jumping to a day on the timeline (`?day=`, read and written by
// `timelineFilters.ts`): what the day means for the window, and what the list
// says about it. A day is the viewer's calendar day, as the day headings are.
// Pure; web:unit tests it.

/** A link's state that asks the timeline to scroll to the jumped-to day (a plain `?day=` link doesn't). */
export const JUMP_LINK_STATE = { timelineJump: true } as const;

/** Whether a location's state carries the jump marker. */
export const isJumpState = (state: unknown) =>
  typeof state === "object" && state !== null && (state as { timelineJump?: unknown }).timelineJump === true;

/**
 * The history window's exclusive upper bound for `day`: the moment the next
 * day starts in `timeZone` (DST-safe). Null for today, whose window is the
 * ordinary history.
 */
export const jumpBound = (day: string, timeZone: string, now: Date): string | null =>
  day >= dayInZone(now, timeZone) ? null : startOfDay(addDays(day, 1), timeZone).toISOString();

/** "Nov 3, 2026": a day key as the jump notice names it, whatever the viewer's zone. */
export const jumpDayText = (day: string, locale?: string) =>
  new Date(`${day}T12:00:00.000Z`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * What the list says when the chosen day isn't the day shown: `shownDay` is
 * the window's first day, or null with nothing on or before the chosen one.
 * Null when the chosen day is the one shown.
 */
export const jumpNotice = ({
  day,
  shownDay,
  filtered,
  locale,
}: {
  day: string;
  shownDay: string | null;
  /** A kind, author or vital filter is on, so the day may hold entries it hides. */
  filtered: boolean;
  locale?: string;
}) => {
  if (shownDay === day) return null;
  const entries = filtered ? "matching entries" : "entries";
  const chosen = jumpDayText(day, locale);
  if (shownDay === null) return `No ${entries} on or before ${chosen}.`;
  return `No ${entries} on ${chosen}. Showing ${jumpDayText(shownDay, locale)}, the nearest earlier day.`;
};
