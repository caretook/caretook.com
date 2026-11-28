import type { FilterMenuProps, SearchFilterBarProps } from "~/components/ui";
import type { TodoWho } from "~/lib/todos/todoList";
import type { TodoView } from "~/lib/todos/todoView";

import { setTagFilter, tagFilterSection } from "../../../../lib/tags/tagFilter";
import {
  clearWho,
  DEFAULT_WHO,
  setTodoQuery,
  setWho,
  TODO_WHO,
  WHO_LABELS,
} from "../../../../lib/todos/todoList";
import { setTodoView, todoViewOf, todoViewSection } from "../../../../lib/todos/todoView";

/**
 * The Todos tab's search and filter bar (the Planner's header puts it under
 * the tabs): the search box, and the Filter menu: "Assigned to": Everyone
 * (the default, no `?who=`: no count, no chip), Mine or Unassigned
 * (`?who=`, so a reload keeps it); then, when the group has tags, "Tag"
 * (Any, or one tag: `?tag=`; tags PRD); then "Subtasks" (In their tree,
 * or On their own: `?subtasks=own`; todo-links-2). Pure (relative imports),
 * so web:unit tests it.
 */
export const todoFilterBar = ({
  who,
  view,
  tags,
  value,
  urlQuery,
  onChange,
}: {
  who: TodoWho;
  view: TodoView;
  tags: readonly { id: string; name: string }[];
  value: string;
  urlQuery: string;
  onChange: (value: string) => void;
}): SearchFilterBarProps => ({
  searchLabel: "Search todos",
  value,
  urlQuery,
  onChange,
  withQuery: setTodoQuery,
  filters: (search) => todoFilterMenu(search, who, tags, view),
});

/** The Filter menu's data for the list: its sections and where Clear filters goes. */
export const todoFilterMenu = (
  search: string,
  who: TodoWho,
  tags: readonly { id: string; name: string }[],
  view: TodoView = todoViewOf(search),
): FilterMenuProps => {
  const tag = tagFilterSection(search, tags);
  return {
    label: "Filter todos",
    clear: setTodoView(setTagFilter(clearWho(search), null), "tree"),
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
      ...(tag ? [tag] : []),
      todoViewSection(search, view),
    ],
  };
};
