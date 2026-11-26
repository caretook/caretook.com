import type { TodoTickProgress } from "./TodoTick";

import { Link } from "react-router";
import { LINK } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";

/**
 * The marks a list row shows for the todo tree (todo-subtasks-2), beside its
 * due line: a parent's "n of m done" (`subtaskProgress`, from the list's one
 * progress query) and a listed subtask's "Part of <parent>", linking up.
 * Each is nothing when it doesn't apply.
 */
export function TodoProgressMark({
  progress,
  className = "",
}: {
  progress: TodoTickProgress | undefined;
  className?: string;
}) {
  if (!progress?.total) return null;
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`} data-todo-progress>
      {progress.done} of {progress.total} done
    </span>
  );
}

/** "Part of <parent>" on a subtask that lists on its own; the title opens the parent's page. */
export function TodoPartOf({
  groupId,
  parent,
  className = "",
}: {
  groupId: string;
  parent: { id: string; title: string } | undefined;
  className?: string;
}) {
  if (!parent) return null;
  return (
    <span className={`min-w-0 break-words ${className}`} data-todo-part-of>
      Part of{" "}
      <Link to={appUrls.todo(groupId, parent.id)} className={LINK}>
        {parent.title}
      </Link>
    </span>
  );
}
