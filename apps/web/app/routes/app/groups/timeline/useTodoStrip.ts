import { useMemo } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { useDueTodos } from "~/lib/todos/todos.sync";
import { todoStrip } from "~/lib/todos/todoStrip";

/**
 * The Today card's todos row: the todo it names (`todoStrip` over the group's
 * open todos overdue or due today), live and re-evaluated once a minute, in
 * the recipient's zone. `ready` is false until the device's rows are known
 * (remembered from earlier this session or read; the row shows a
 * skeleton), and `fresh` once they're read live (until then the row is dimmed).
 * `strip` is null before `ready` and while nothing is overdue or due today;
 * `todos` are those overdue or due today, and `timeZone` the recipient's.
 */
export function useTodoStrip(groupId: string) {
  const group = useGroup();
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { todos, now, ready, fresh } = useDueTodos(groupId, timeZone);
  const strip = useMemo(
    () => (ready ? todoStrip(todos, now, timeZone, group.userId) : null),
    [ready, todos, now, timeZone, group.userId],
  );
  return { strip, todos, timeZone, ready, fresh };
}
