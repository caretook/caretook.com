import type { FilterMenuProps, SearchFilterBarProps } from "~/components/ui";
import type { UpcomingShow } from "./upcomingFilters";

import { MemberAvatar } from "~/components/members";
import { clearAuthor, setAuthor, setQuery } from "~/lib/timeline/timelineFilters";
import { setTagFilter } from "~/lib/tags/tagFilter";
import { pastTagChip, setShow, upcomingFilterSections } from "./upcomingFilters";

// The Planner tabs' search and filter bars (the header puts each under the
// tabs; it acts on the open tab only): the search box (`?q=`, which the tab
// links never carry), and each tab's own Filter menu. Upcoming: Show and
// Tag (when the group has tags), and the author as an extra chip (set from
// a card's initials). Past: By (the author), and the tag carried from
// Upcoming as a chip. Todos: its own (`todos/TodoFilters`).

type Named = { id: string; name: string };

export type PlannerAuthor = { userId: string; name: string; image: string | null };

/** What every Planner tab's bar takes from its route: the box's text and its URL. */
type BarText = { value: string; urlQuery: string; onChange: (value: string) => void };

const barOf = (text: BarText, filters: (search: string) => FilterMenuProps): SearchFilterBarProps => ({
  searchLabel: "Search the Planner",
  ...text,
  withQuery: setQuery,
  filters,
});

/** Upcoming's bar: the Show section, and the author's chip ("By <name>", not counted). */
export const upcomingFilterBar = (
  text: BarText,
  show: UpcomingShow,
  author: PlannerAuthor | null,
  tags: readonly Named[] = [],
): SearchFilterBarProps =>
  barOf(text, (search) => ({
    label: "Filter the Planner",
    clear: setTagFilter(setShow(search, "all"), null),
    sections: upcomingFilterSections(search, show, tags),
    chips: author
      ? [
          {
            id: "author",
            label: `By ${author.name}`,
            name: `By ${author.name}: clear this filter`,
            search: clearAuthor(search),
            leading: (
              <MemberAvatar
                userId={author.userId}
                name={author.name}
                image={author.image}
                size="xs"
                className="-ml-1.5"
              />
            ),
          },
        ]
      : [],
  }));

/** The default of Past's By section: anyone's events. */
const ANYONE = "anyone";

/**
 * Past's bar: one section, By (Anyone, or a member: `?author=`); its chip
 * reads "By <name>". An author who has left still shows as a choice while on.
 */
export const pastFilterBar = (
  text: BarText,
  members: readonly { userId: string; name: string }[],
  author: { userId: string; name: string } | null,
  tag: Named | null = null,
): SearchFilterBarProps =>
  barOf(text, (search) => {
    const choices =
      author && !members.some((m) => m.userId === author.userId) ? [...members, author] : members;
    return {
      label: "Filter past events",
      clear: setTagFilter(clearAuthor(search), null),
      chips: pastTagChip(search, tag),
      sections: [
        {
          id: "author",
          title: "By",
          current: author?.userId ?? ANYONE,
          defaultId: ANYONE,
          chipLabel: author ? `By ${author.name}` : undefined,
          options: [
            { id: ANYONE, label: "Anyone", search: clearAuthor(search) },
            ...choices.map((m) => ({ id: m.userId, label: m.name, search: setAuthor(search, m.userId) })),
          ],
        },
      ],
    };
  });
