import type { TimelineEntryKind } from "@caretook/data/schema";
import type { FilterExtraChip, FilterSection } from "../../../../components/ui/filterModel";
import type { TimelineFilters } from "../../../../lib/timeline/timelineFilters";
import { SUBTASKS_PARAM, todoViewOf, todoViewSection } from "../../../../lib/todos/todoView";
import type { TodoView } from "../../../../lib/todos/todoView";

import { TAG_PARAM, tagFromParams } from "@caretook/data/schema";
import { matchingText } from "../../../../lib/core/textFilter";
import { setTagFilter, tagFilterSection } from "../../../../lib/tags/tagFilter";
import {
  AUTHOR_PARAM,
  KIND_PARAM,
  parseFilters,
  QUERY_PARAM,
} from "../../../../lib/timeline/timelineFilters";

// Upcoming's and Past's filters: the timeline's `?kind=event` and `?author=`
// (read and changed through `lib/timeline/timelineFilters`), for todos
// only, `?show=todos`, and the tag (`?tag=`, events and todos alike; tags
// PRD: a section on Upcoming, a chip carried to Past), and the todo view
// (`?subtasks=own`, todo-links-2: a section on Upcoming, carried to Past and
// back like the tag, though Past shows no todos).
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
 * `view` is the todos' (`todoViewOf`): in their tree, or on their own.
 */
export const parseUpcomingFilters = (
  search: string,
): UpcomingFilters & {
  kind: TimelineEntryKind | null;
  show: UpcomingShow;
  todosOnly: boolean;
  /** `?tag=` as written: whether the group has it is the screen's to check (`activeTag`). */
  tag: string | null;
  view: TodoView;
} => {
  const { kind, author } = parseFilters(search);
  const params = new URLSearchParams(search);
  const todosOnly = params.get(SHOW_PARAM) === "todos";
  const show: UpcomingShow = todosOnly ? "todos" : kind === "event" ? "event" : "all";
  return {
    kind: show === "event" ? "event" : null,
    author,
    show,
    todosOnly,
    tag: tagFromParams(params),
    view: todoViewOf(search),
  };
};

/** The Past tab's filters: past events only, so the author and the tag. */
export const parsePastFilters = (search: string): UpcomingFilters & { kind: null; tag: string | null } => ({
  kind: null,
  author: parseFilters(search).author,
  tag: tagFromParams(new URLSearchParams(search)),
});

type Named = { id: string; name: string };

/**
 * Upcoming's Filter menu sections: Show (All, Events, Todos), then Tag
 * when the group has tags (`tagFilterSection`), then Subtasks (the todo
 * lists' one view section, `todoViewSection`; todo-links-2).
 */
export const upcomingFilterSections = (
  search: string,
  show: UpcomingShow,
  tags: readonly Named[],
  view: TodoView = todoViewOf(search),
): FilterSection[] => {
  const tag = tagFilterSection(search, tags);
  return [
    {
      id: "show",
      title: "Show",
      current: show,
      defaultId: "all",
      options: UPCOMING_SHOWS.map((s) => ({
        id: s,
        label: UPCOMING_SHOW_LABELS[s],
        search: setShow(search, s),
      })),
    },
    ...(tag ? [tag] : []),
    todoViewSection(search, view),
  ];
};

/** Past's tag chip (carried from Upcoming; Past has no Tag section): the tag's name, ✕ drops `?tag=`. */
export const pastTagChip = (search: string, tag: Named | null): FilterExtraChip[] =>
  tag
    ? [
        {
          id: "tag",
          label: tag.name,
          name: `${tag.name}: clear this filter`,
          search: setTagFilter(search, null),
        },
      ]
    : [];

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
 * The search a link carries to the Planner tab (Upcoming: what it shows, the
 * author, the tag and the todo view) or to Past (the author, the tag and the
 * view, so going back to Upcoming keeps it), never anything else.
 */
export const tabSearch = (search: string, tab: "planner" | "past") => {
  const { show, author } = parseUpcomingFilters(search);
  return {
    [KIND_PARAM]: tab === "planner" && show === "event" ? "event" : null,
    [SHOW_PARAM]: tab === "planner" && show === "todos" ? "todos" : null,
    [AUTHOR_PARAM]: author,
    [TAG_PARAM]: tagFromParams(new URLSearchParams(search)),
    [SUBTASKS_PARAM]: todoViewOf(search) === "own" ? "own" : null,
  };
};

/** What an empty Upcoming list says, naming what is on (the author, the search box's text). */
export const emptyUpcomingText = (
  show: UpcomingShow,
  authorName?: string | null,
  q = "",
  tagName?: string | null,
) => {
  const what = show === "event" ? "events" : show === "todos" ? "todos" : "events or todos";
  return `No upcoming ${what}${authorName ? ` by ${authorName}` : ""}${tagged(tagName)}${matchingText(q)}.`;
};

const tagged = (tagName?: string | null) => (tagName ? ` tagged “${tagName}”` : "");

/** What an empty Past tab says, naming what is on. */
export const emptyPastText = (authorName?: string | null, q = "", tagName?: string | null) =>
  authorName || q.trim() || tagName
    ? `No past events${authorName ? ` by ${authorName}` : ""}${tagged(tagName)}${matchingText(q)}.`
    : "No past events yet.";

/** The search box's text from the URL (`?q=`, the timeline's parameter), normalized. */
export const plannerQueryOf = (search: string) => parseFilters(search).q;

/** The Past tab's end, once there's nothing older. */
export const PAST_END_TEXT = "That's the first event";

/** Whether a navigation changed only the search box's text (the live queries follow it; the loader needn't run). */
export const onlyQueryChanged = (current: URL, next: URL) => {
  if (current.pathname !== next.pathname) return false;
  const rest = (url: URL) => {
    const params = new URLSearchParams(url.search);
    params.delete(QUERY_PARAM);
    params.sort();
    return params.toString();
  };
  return rest(current) === rest(next);
};
