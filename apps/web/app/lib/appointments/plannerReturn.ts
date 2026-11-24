import type { TimedEntry } from "./upcoming";

import { isUpcoming } from "./upcoming";
import { appointmentUrls } from "./urls";

// Where an event opened from the Planner goes back to (B-690). The Planner's
// Add > Event and its rows (Upcoming and Past) put the opener in the entry
// page's history state; the page's back link (and a delete) then return to
// the Planner instead of the Timeline. History state survives a reload; a
// direct link or bookmark has none, so it keeps the Timeline. Pure;
// unit-tested in web:unit.

/** The opener, as the entry page reads it from history state. */
export type PlannerReturn = {
  /** The opener's URL, path and search: the tab and its filters. */
  from: string;
  /** Added from the Planner's Add menu (a new event), not opened from a row. */
  added: boolean;
  /** The opener's history index, when known: Back to it is a history step, so its scroll comes back. */
  idx: number | null;
};

type ReturnState = { plannerReturn: PlannerReturn };

/** The history state for an entry page opened from the Planner (merged into `extra`, such as "Only this visit"). */
export const plannerReturnState = <T extends object>(ret: PlannerReturn, extra?: T) =>
  ({ ...extra, plannerReturn: ret }) as T & ReturnState;

/** The opener in history state, or null (opened any other way). */
export const plannerReturnFrom = (state: unknown): PlannerReturn | null => {
  if (!state || typeof state !== "object") return null;
  const ret = (state as { plannerReturn?: unknown }).plannerReturn;
  if (!ret || typeof ret !== "object") return null;
  const { from, added, idx } = ret as Record<string, unknown>;
  // Only a path in this app: never another origin.
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) return null;
  return { from, added: added === true, idx: typeof idx === "number" ? idx : null };
};

/**
 * Where to go back to. A new event, once it's saved, goes to the tab its
 * time belongs on now (Past, or Upcoming: in progress and today's all-day
 * count as Upcoming, the Planner's own rule); an unsaved draft and an
 * existing event go back to the exact opener, even after a time edit.
 */
export const plannerReturnUrl = (
  ret: PlannerReturn,
  { groupId, entry, stored, now }: { groupId: string; entry: TimedEntry; stored: boolean; now: Date },
) => {
  if (!ret.added || !stored) return ret.from;
  return isUpcoming(entry, now) ? appointmentUrls.planner(groupId) : appointmentUrls.plannerPast(groupId);
};

/** Whether going back is one step back in history: the page sits right after its opener, and goes there. */
export const backIsHistoryStep = (ret: PlannerReturn, url: string, currentIdx: unknown) =>
  ret.idx !== null && url === ret.from && currentIdx === ret.idx + 1;
