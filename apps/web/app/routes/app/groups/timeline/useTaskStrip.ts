import { useMemo } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { useDueTasks } from "~/lib/tasks/tasks.sync";
import { taskStrip } from "~/lib/tasks/taskStrip";

/**
 * The Today card's tasks row: the task it names (`taskStrip` over the group's
 * open tasks overdue or due today), live and re-evaluated once a minute, in
 * the recipient's zone. `ready` is false until the device's rows are known
 * (remembered from earlier this session or read; the row shows a
 * skeleton), and `fresh` once they're read live (until then the row is dimmed).
 * `strip` is null before `ready` and while nothing is overdue or due today.
 */
export function useTaskStrip(groupId: string) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { tasks, now, ready, fresh } = useDueTasks(groupId, timeZone);
  const strip = useMemo(
    () => (ready ? taskStrip(tasks, now, timeZone, group.userId) : null),
    [ready, tasks, now, timeZone, group.userId],
  );
  return { strip, ready, fresh };
}
