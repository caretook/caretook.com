import type { MenuEntry } from "~/components/ui";
import type { FilterMenuProps } from "~/components/ui";
import type { UpcomingShow } from "./upcomingFilters";

import { CalendarPlus, ListTodo } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router";
import { MemberAvatar } from "~/components/members";
import { FilterMenu, FilterMenuChips, PageHeader, TabNav } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import { clearAuthor } from "~/lib/timeline/timelineFilters";
import { listSearch, TODO_SHEET_STATE } from "~/lib/todos/todoSheets";
import { plannerReturnState } from "~/lib/appointments/plannerReturn";
import { setShow, tabSearch, UPCOMING_SHOW_LABELS, UPCOMING_SHOWS } from "./upcomingFilters";
import { usePlannerOpener } from "./usePlannerOpener";

type PlannerView = "upcoming" | "past";
type PlannerAuthor = { userId: string; name: string; image: string | null };

/** The Filter menu and chips of Upcoming (Show, and the author) or Past (the author's chip alone). */
const plannerFilters = (
  search: string,
  view: PlannerView,
  show: UpcomingShow,
  author: PlannerAuthor | null,
): FilterMenuProps => ({
  label: "Filter the Planner",
  clear: setShow(search, "all"),
  sections:
    view === "past"
      ? []
      : [
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
        ],
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
});

/**
 * The Planner section's header, the same on its tabs: the "Planner" heading;
 * for writers the header's `+`, a menu named "Add" (Appointment, a draft that
 * picks the time first, `?when=pick`; Todo, the add sheet, which closes back
 * to the tab it was opened from); then the tabs, Upcoming, Past and Todos
 * (`TabNav`), links that carry the filters each reads (Upcoming: what it
 * shows and the author; Past: the author; Todos: its `?who=` chip).
 *
 * `view` is the Planner list on screen (none on Todos, which has its own
 * filter row). On Upcoming the Filter menu (one section, "Show": All, Events,
 * Todos) sits beside the tabs, its chips beneath; Past has no menu. With an
 * author filter on, a last chip ("By <name>") clears only the author; it
 * isn't counted.
 */
export function PlannerHeader({
  view,
  show = "all",
  author = null,
}: {
  view?: PlannerView;
  show?: UpcomingShow;
  author?: PlannerAuthor | null;
}) {
  const { id: groupId, canWrite, easyRole } = useGroup();
  const { search } = useLocation();
  const section = sectionAccent("planner", { easy: easyRole });
  const filters = useMemo(
    () => (view ? plannerFilters(search, view, show, author) : null),
    [search, view, show, author],
  );
  const eventOpener = usePlannerOpener(true);
  const upcoming = appUrls.planner(groupId);
  const tabs = [
    {
      label: "Upcoming",
      to: appUrls.planner(groupId, tabSearch(search, view === "past" ? "past" : "planner")),
      // Past's path is under this one, so only the exact path counts.
      match: (pathname: string) => pathname.replace(/\/+$/, "") === upcoming,
    },
    { label: "Past", to: appUrls.plannerPast(groupId, tabSearch(search, "past")) },
    { label: "Todos", to: appUrls.todos(groupId, listSearch(search)) },
  ];
  const add: MenuEntry[] = [
    {
      id: "appointment",
      label: "Event",
      icon: CalendarPlus,
      href: appUrls.newPlannerEntry(groupId, "event"),
      // Its back link returns to the Planner: Upcoming or Past by its time once saved (B-690).
      state: plannerReturnState(eventOpener),
    },
    {
      id: "todo",
      label: "Todo",
      icon: ListTodo,
      // On the Todos tab its chip is kept for the list under the sheet.
      href: appUrls.newTodo(groupId, {}, listSearch(search)),
      state: TODO_SHEET_STATE,
    },
  ];

  return (
    <div className="space-y-3">
      <PageHeader title="Planner" add={canWrite && { label: "Add", items: add }} {...section} />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <TabNav
            label="Upcoming, past or todos"
            tabs={tabs}
            accent={section?.accent}
            className="min-w-0 flex-1 sm:flex-none"
          />
          {view === "upcoming" && filters && <FilterMenu {...filters} />}
        </div>
        {filters && <FilterMenuChips {...filters} />}
      </div>
    </div>
  );
}
