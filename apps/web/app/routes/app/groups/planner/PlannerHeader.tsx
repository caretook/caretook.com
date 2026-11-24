import type { MenuEntry, SearchFilterBarProps } from "~/components/ui";

import { CalendarPlus, ListTodo } from "lucide-react";
import { useLocation } from "react-router";
import { PageHeader, SearchFilterBar, TabNav } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import { listSearch, PLANNER_TODO_STATE, TODO_SHEET_STATE } from "~/lib/todos/todoSheets";
import { plannerReturnState } from "~/lib/appointments/plannerReturn";
import { tabSearch } from "./upcomingFilters";
import { usePlannerOpener } from "./usePlannerOpener";

type PlannerView = "upcoming" | "past";

/**
 * The Planner section's header, the same on its tabs: the "Planner" heading;
 * for writers the header's `+`, a menu named "Add" (Appointment, a draft that
 * picks the time first, `?when=pick`; Todo, the add sheet, which closes back
 * to the tab it was opened from); then the tabs, Upcoming, Past and Todos
 * (`TabNav`), links that carry the filters each reads (Upcoming: what it
 * shows and the author; Past: the author; Todos: its `?who=` chip).
 *
 * `view` is the Planner list on screen (none on Todos). `bar` is the open
 * tab's search and filter bar (`plannerFilters`, `todos/TodoFilters`): it
 * sits under the tabs and acts on that tab only.
 */
export function PlannerHeader({ view, bar }: { view?: PlannerView; bar?: SearchFilterBarProps }) {
  const { id: groupId, canWrite, easyRole } = useGroup();
  const { search } = useLocation();
  const section = sectionAccent("planner", { easy: easyRole });
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
      // On the Todos tab its chip is kept for the list under the sheet. From
      // Upcoming or Past a save lands on Todos; Cancel goes back to the tab.
      href: appUrls.newTodo(groupId, {}, listSearch(search)),
      state: view ? PLANNER_TODO_STATE : TODO_SHEET_STATE,
    },
  ];

  return (
    <div className="space-y-3">
      <PageHeader title="Planner" add={canWrite && { label: "Add", items: add }} {...section} />
      <TabNav label="Upcoming, past or todos" tabs={tabs} accent={section?.accent} />
      {bar && <SearchFilterBar {...bar} />}
    </div>
  );
}
