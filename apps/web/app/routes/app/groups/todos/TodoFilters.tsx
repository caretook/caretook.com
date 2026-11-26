import type { FilterMenuProps, SearchFilterBarProps } from "~/components/ui";
import type { TodoWho } from "~/lib/todos/todoList";

import { clearWho, DEFAULT_WHO, setTodoQuery, setWho, TODO_WHO, WHO_LABELS } from "~/lib/todos/todoList";

/**
 * The Todos tab's search and filter bar (the Planner's header puts it under
 * the tabs): the search box, and the Filter menu with one section, "Assigned
 * to": Everyone (the default, no `?who=`: no count, no chip), Mine or
 * Unassigned (`?who=`, so a reload keeps it).
 */
export const todoFilterBar = ({
  who,
  value,
  urlQuery,
  onChange,
}: {
  who: TodoWho;
  value: string;
  urlQuery: string;
  onChange: (value: string) => void;
}): SearchFilterBarProps => ({
  searchLabel: "Search todos",
  value,
  urlQuery,
  onChange,
  withQuery: setTodoQuery,
  filters: (search) => todoFilterMenu(search, who),
});

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
