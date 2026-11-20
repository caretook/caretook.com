import type { TaskWho } from "~/lib/taskList";

import { useLocation } from "react-router";
import { ChipGroup } from "~/components/ui";
import { setWho, TASK_WHO, WHO_LABELS } from "~/lib/taskList";

/** Mine / Unassigned / Everyone: links that set `?who=`, so the chip survives reloads. */
export function TaskChips({ who }: { who: TaskWho }) {
  const { search } = useLocation();
  return (
    <ChipGroup
      label="Show tasks"
      replace
      preventScrollReset
      links={TASK_WHO.map((id) => ({
        id,
        label: WHO_LABELS[id],
        to: { search: setWho(search, id) },
        current: who === id,
      }))}
    />
  );
}
