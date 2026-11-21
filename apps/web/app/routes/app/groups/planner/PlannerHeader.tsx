import type { MenuEntry } from "~/components/ui";
import type { UpcomingKind } from "./upcomingFilters";

import { CalendarPlus, ListTodo, NotebookPen, Plus, X } from "lucide-react";
import { Link, useLocation } from "react-router";
import { ChipGroup, Menu, PageHeader, UserAvatar } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { clearAuthor, clearKind, setKind } from "~/lib/timeline/timelineFilters";
import { listSearch, TODO_SHEET_STATE } from "~/lib/todos/todoSheets";
import { tabSearch, UPCOMING_KIND_LABELS, UPCOMING_KINDS } from "./upcomingFilters";

const TAB = "border-b-2 px-1 pb-2 text-sm font-medium";

export type PlannerTab = "planner" | "todos" | "past";

/**
 * The Planner section's header, the same on its three tabs: the "Planner"
 * heading; for writers one "Add" menu (Appointment and Reminder, drafts
 * that pick the time first, `?when=pick`; Todo, the add sheet, which closes
 * back to the tab it was opened from); then the tabs, links that carry the
 * filters each reads (Planner: kind and author; Past: the author; Todos:
 * its `?who=` chip).
 */
export function PlannerHeader({ tab }: { tab: PlannerTab }) {
  const { id: groupId, canWrite } = useGroup();
  const { search } = useLocation();
  const tabs = [
    { id: "planner", label: "Planner", to: appUrls.planner(groupId, tabSearch(search, "planner")) },
    { id: "todos", label: "Todos", to: appUrls.todos(groupId, listSearch(search)) },
    { id: "past", label: "Past", to: appUrls.plannerPast(groupId, tabSearch(search, "past")) },
  ] as const;
  const add: MenuEntry[] = [
    {
      id: "appointment",
      label: "Appointment",
      icon: CalendarPlus,
      href: appUrls.newPlannerEntry(groupId, "event"),
    },
    { id: "reminder", label: "Reminder", icon: NotebookPen, href: appUrls.newPlannerEntry(groupId, "note") },
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
      <nav
        aria-label="Planner, todos or past"
        className="border-base-300 flex gap-4 border-b"
        data-planner-tabs
      >
        {tabs.map((t) => (
          <Link
            key={t.id}
            to={t.to}
            aria-current={t.id === tab ? "page" : undefined}
            className={`${TAB} ${t.id === tab ? "border-primary text-base-content" : "text-base-content/70 hover:text-base-content border-transparent"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/**
 * The filter chips: All, Appointments, Reminders (`?kind=`; left out on the
 * Past tab, which lists events only), and with an author filter on, a last
 * chip that names them and clears it.
 */
export function PlannerFilterChips({
  kind,
  author,
  kinds = true,
}: {
  kind: UpcomingKind | null;
  author: { name: string; image: string | null } | null;
  kinds?: boolean;
}) {
  const { search } = useLocation();
  const links = [
    ...(kinds
      ? [
          { id: "all", label: "All", to: { search: clearKind(search) }, current: !kind },
          ...UPCOMING_KINDS.map((k) => ({
            id: k,
            label: UPCOMING_KIND_LABELS[k],
            to: { search: setKind(search, k) },
            current: kind === k,
          })),
        ]
      : []),
    ...(author
      ? [
          {
            id: "author",
            label: `By ${author.name}`,
            name: `By ${author.name}: clear this filter`,
            to: { search: clearAuthor(search) },
            current: true,
            leading: <UserAvatar name={author.name} image={author.image} size="xs" className="-ml-1.5" />,
            trailing: <X className="size-3.5" aria-hidden="true" />,
          },
        ]
      : []),
  ];
  if (links.length === 0) return null;
  return <ChipGroup label="Show items" replace preventScrollReset links={links} />;
}
