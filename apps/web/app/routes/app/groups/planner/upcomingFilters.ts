import type { TimelineEntryKind } from "@caretook/data/schema";
import type { TimelineFilters } from "../../../../lib/timeline/timelineFilters";

import { AUTHOR_PARAM, KIND_PARAM, parseFilters } from "../../../../lib/timeline/timelineFilters";

// Upcoming's and Past's filters: the timeline's `?kind=event` and `?author=`
// (read and changed through `lib/timeline/timelineFilters`) and, for todos
// only, `?show=todos`.
// Pure, so web:unit tests it.

/** What Upcoming lists: everything (default), events only, or todos only. */
export const UPCOMING_SHOWS = ["all", "event", "todos"] as const;
export type UpcomingShow = (typeof UPCOMING_SHOWS)[number];

/** What the Filter menu calls each choice. */
export const UPCOMING_SHOW_LABELS: Record<UpcomingShow, string> = {
  all: "All",
  event: "Events",
  todos: "Todos",
};

/**
 * Todos only is not a timeline kind, so it has its own parameter:
 * `?show=todos`. Events are the timeline's `?kind=event`. The two exclude
 * each other (`?show=todos` wins if both are written).
 */
export const SHOW_PARAM = "show";

/** The timeline's author filter (the Planner has no `?upcoming=` switch). */
type UpcomingFilters = Pick<TimelineFilters, "author">;

/**
 * Upcoming's filters: what it shows, and the author. `kind` is what the
 * entry queries filter by (events, or none), `todosOnly` leaves out every
 * entry. A kind Upcoming doesn't list (`?kind=vital`, `?kind=note`) reads as All.
 */
export const parseUpcomingFilters = (
  search: string,
): UpcomingFilters & { kind: TimelineEntryKind | null; show: UpcomingShow; todosOnly: boolean } => {
  const { kind, author } = parseFilters(search);
  const todosOnly = new URLSearchParams(search).get(SHOW_PARAM) === "todos";
  const show: UpcomingShow = todosOnly ? "todos" : kind === "event" ? "event" : "all";
  return { kind: show === "event" ? "event" : null, author, show, todosOnly };
};

/** The Past tab's filters: past events only, so just the author. */
export const parsePastFilters = (search: string): UpcomingFilters & { kind: null } => ({
  kind: null,
  author: parseFilters(search).author,
});

/** `search` showing `show`: the other choice's parameter goes, the rest is kept. */
export const setShow = (search: string, show: UpcomingShow) => {
  const params = new URLSearchParams(search);
  params.delete(KIND_PARAM);
  params.delete(SHOW_PARAM);
  const out = new URLSearchParams();
  if (show === "event") out.set(KIND_PARAM, "event");
  if (show === "todos") out.set(SHOW_PARAM, "todos");
  for (const [key, value] of params) out.append(key, value);
  const text = out.toString();
  return text ? `?${text}` : "";
};

/**
 * The search a link carries to the Planner tab (Upcoming: what it shows and
 * the author) or to Past (the author only), never anything else.
 */
export const tabSearch = (search: string, tab: "planner" | "past") => {
  const { show, author } = parseUpcomingFilters(search);
  return {
    [KIND_PARAM]: tab === "planner" && show === "event" ? "event" : null,
    [SHOW_PARAM]: tab === "planner" && show === "todos" ? "todos" : null,
    [AUTHOR_PARAM]: author,
  };
};

/** What an empty Upcoming list says, naming what is on. */
export const emptyUpcomingText = (show: UpcomingShow, authorName?: string | null) => {
  const what = show === "event" ? "appointments" : show === "todos" ? "todos" : "appointments or todos";
  return authorName ? `No upcoming ${what} by ${authorName}.` : `No upcoming ${what}.`;
};

/** What an empty Past tab says. */
export const emptyPastText = (authorName?: string | null) =>
  authorName ? `No past events by ${authorName}.` : "No past events yet.";

/** The Past tab's end, once there's nothing older. */
export const PAST_END_TEXT = "That's the first event";
