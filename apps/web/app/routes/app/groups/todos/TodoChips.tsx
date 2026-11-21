import type { TodoWho } from "~/lib/todos/todoList";

import { useLocation } from "react-router";
import { ChipGroup } from "~/components/ui";
import { setWho, TODO_WHO, WHO_LABELS } from "~/lib/todos/todoList";

/** Mine / Unassigned / Everyone: links that set `?who=`, so the chip survives reloads. */
export function TodoChips({ who }: { who: TodoWho }) {
  const { search } = useLocation();
  return (
    <ChipGroup
      label="Show todos"
      replace
      preventScrollReset
      links={TODO_WHO.map((id) => ({
        id,
        label: WHO_LABELS[id],
        to: { search: setWho(search, id) },
        current: who === id,
      }))}
    />
  );
}
