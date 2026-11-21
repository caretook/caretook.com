import type { TodoState } from "@caretook/data/schema";
import type { ReactNode } from "react";

import { ListTodo } from "lucide-react";
import { ViaTag } from "~/components/ui";
import { taskBadge } from "./taskPage";

/**
 * The task's header, in regions like `MedicationHeader`'s:
 *
 *   [icon] [title, Done or Overdue badge, via] [editors] [actions]
 *
 * - `via`: the member's AI assistant it was added through ("via Claude"), when it was.
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Edit (the edit sheet) and ⋯ with Reopen and Delete, for writers.
 *
 * Empty regions take no space.
 */
export function TaskHeader({
  title,
  state,
  editors,
  actions,
  via,
}: {
  title: string;
  state: TodoState;
  via?: string | null;
  editors?: ReactNode;
  actions?: ReactNode;
}) {
  const badge = taskBadge(state);
  return (
    <header className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`grid size-9 shrink-0 place-items-center rounded-full ${state === "done" ? "bg-base-200 text-base-content/60" : "bg-primary/15 text-primary"}`}
      >
        <ListTodo className="size-5" />
      </span>
      <div data-region="title" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 pt-1">
        <h1 className="text-xl font-semibold wrap-break-word" data-task-title>
          {title}
        </h1>
        {badge && (
          <span
            className={`badge badge-sm ${badge.tone === "overdue" ? "badge-error badge-soft" : "badge-ghost"}`}
            data-task-badge={badge.tone}
          >
            {badge.label}
          </span>
        )}
        <ViaTag via={via} />
      </div>
      {editors && (
        <div data-region="editors" className="flex shrink-0 items-center -space-x-1.5 pt-1">
          {editors}
        </div>
      )}
      {actions && (
        <div data-region="actions" className="flex shrink-0 items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}
