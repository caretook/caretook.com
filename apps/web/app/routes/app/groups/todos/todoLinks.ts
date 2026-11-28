import type { TimedEntry } from "../../../../lib/appointments/upcoming";

import { timeRange } from "../../../../lib/appointments/upcomingLabels";
import { dayLabel } from "@caretook/data/domain";

// The todo sheet's links, their pure parts (web:unit tests it, so imports
// stay relative): when an event is, and what a chosen link's chip says. The
// choices come from the shared "Link to" box (`LinkToBox`, todo-links).

/** How far back the sheet's loader reads events: the last 30 days'. */
export const RECENT_EVENT_DAYS = 30;

type Where = { locale?: string; timeZone?: string };

// --- Events ------------------------------------------------------------------

/** An event as a link shows it. */
export type PickableEvent = TimedEntry & {
  kind: string;
  title: string | null;
  deletedAt: string | null;
};

/** When an event is, in a line: "Tomorrow 10:30 AM–11:15 AM", "Friday, Nov 21 · All day". */
export const eventWhen = (event: PickableEvent, now: Date, where: Where = {}) => {
  const zone = where.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  // An all-day event's day is its own zone's.
  const day = dayLabel(event.occurredAt, event.allDay ? event.timeZone : zone, now, where.locale);
  return event.allDay ? `${day} · All day` : `${day} ${timeRange(event, where)}`;
};

// --- Chips -------------------------------------------------------------------

/** What a link to a deleted provider or medication reads: a delete scrubs its name (data-rights). */
export const REMOVED_ITEM = "Removed item";

/** A chosen link's chip: its name, greyed "Removed item" once deleted; "Cancelled" kept on an appointment. */
export const chosenLinkChip = (
  chosen: { label: string; deleted?: boolean; cancelled?: boolean } | null,
  fallback: string,
): { label: string; muted: boolean } => {
  if (!chosen) return { label: fallback, muted: true };
  if (chosen.deleted) return { label: REMOVED_ITEM, muted: true };
  if (chosen.cancelled) return { label: `${chosen.label} (cancelled)`, muted: true };
  return { label: chosen.label, muted: false };
};
