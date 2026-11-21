import type { FilterMenuProps } from "~/components/ui";
import type { TodoWho } from "~/lib/todos/todoList";

import { useMemo } from "react";
import { useLocation } from "react-router";
import { FilterMenu, FilterMenuChips } from "~/components/ui";
import { clearWho, DEFAULT_WHO, setWho, TODO_WHO, WHO_LABELS } from "~/lib/todos/todoList";

/**
 * The Todos tab's filter: a row under the tabs with the Filter button at its
 * right end, and the chip of the filter on beneath. One section, "Assigned
 * to": Everyone (the default, no `?who=`: no count, no chip), Mine or
 * Unassigned (`?who=`, so a reload keeps it).
 */
export function TodoFilterRow({ who }: { who: TodoWho }) {
  const { search } = useLocation();
  const filters = useMemo(() => todoFilterMenu(search, who), [search, who]);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-end">
        <FilterMenu {...filters} />
      </div>
      <FilterMenuChips {...filters} />
    </div>
  );
}

/** The Filter menu's data for the list: its one section and where Clear filters goes. */
const todoFilterMenu = (search: string, who: TodoWho): FilterMenuProps => ({
  label: "Filter todos",
  clear: clearWho(search),
  sections: [
    {
      id: "who",
      title: "Assigned to",
      current: who,
      defaultId: DEFAULT_WHO,
      options: TODO_WHO.map((id) => ({
        id,
        label: WHO_LABELS[id],
        search: id === DEFAULT_WHO ? clearWho(search) : setWho(search, id),
      })),
    },
  ],
});
