import type { MenuEntry } from "~/components/ui";
import type { FilterMenuProps } from "~/components/ui";
import type { UpcomingShow } from "./upcomingFilters";

import { CalendarPlus, ListTodo, Plus } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router";
import {
  ChipGroup,
  FilterMenu,
  FilterMenuChips,
  Menu,
  PageHeader,
  TabNav,
  UserAvatar,
} from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { clearAuthor } from "~/lib/timeline/timelineFilters";
import { listSearch, TODO_SHEET_STATE } from "~/lib/todos/todoSheets";
import { setShow, tabSearch, UPCOMING_SHOW_LABELS, UPCOMING_SHOWS } from "./upcomingFilters";

/**
 * The Planner section's header, the same on its tabs: the "Planner"
 * heading; for writers one "Add" menu (Appointment, a draft
 * that picks the time first, `?when=pick`; Todo, the add sheet, which closes
 * back to the tab it was opened from); then the two tabs, Planner and Todos
 * (`TabNav`; Planner stays current on Past), links that carry the filters
 * each reads (Planner: what it shows and the author; Todos: its `?who=` chip).
 */
export function PlannerHeader() {
  const { id: groupId, canWrite } = useGroup();
  const { search } = useLocation();
  const tabs = [
    { label: "Planner", to: appUrls.planner(groupId, tabSearch(search, "planner")) },
    { label: "Todos", to: appUrls.todos(groupId, listSearch(search)) },
  ];
  const add: MenuEntry[] = [
    {
      id: "appointment",
      label: "Appointment",
      icon: CalendarPlus,
      href: appUrls.newPlannerEntry(groupId, "event"),
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
      <PageHeader
        title="Planner"
        actions={
          canWrite && (
            <Menu label="Add" items={add} className="btn btn-primary btn-sm" width="sm">
              <Plus className="size-4" aria-hidden="true" />
              Add
            </Menu>
          )
        }
      />
      <TabNav label="Planner or todos" tabs={tabs} />
    </div>
  );
}

/**
 * The Planner and Past views' filter row. At its left, two link chips,
 * Upcoming and Past (a nav named "Upcoming or past"; the current one
 * marked), each carrying the author filter. On Upcoming, the Filter menu at
 * the row's right end (one section, "Show": All, Events, Todos) with its
 * chips beneath; on Past, no menu. With an author filter on, a last chip
 * ("By <name>") clears only the author; it isn't counted.
 */
export function PlannerFilterRow({
  view,
  show = "all",
  author,
}: {
  view: "upcoming" | "past";
  show?: UpcomingShow;
  author: { name: string; image: string | null } | null;
}) {
  const { id: groupId } = useGroup();
  const { search } = useLocation();
  const filters = useMemo<FilterMenuProps>(
    () => ({
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
              leading: <UserAvatar name={author.name} image={author.image} size="xs" className="-ml-1.5" />,
            },
          ]
        : [],
    }),
    [search, view, show, author],
  );
  const views = [
    {
      id: "upcoming",
      label: "Upcoming",
      to: appUrls.planner(groupId, tabSearch(search, view === "past" ? "past" : "planner")),
      current: view === "upcoming",
    },
    {
      id: "past",
      label: "Past",
      to: appUrls.plannerPast(groupId, tabSearch(search, "past")),
      current: view === "past",
    },
  ];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <ChipGroup label="Upcoming or past" links={views} />
        {view === "upcoming" && <FilterMenu {...filters} />}
      </div>
      <FilterMenuChips {...filters} />
    </div>
  );
}
