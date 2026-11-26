import type { TodoState } from "@caretook/data/schema";
import type { ReactNode } from "react";

import { ListTodo } from "lucide-react";
import { Badge, DetailHeader, STATUS_TONE, ViaTag } from "~/components/ui";
import { todoBadge } from "./todoPage";

/**
 * The todo's header (`DetailHeader`): its title with a Done or Overdue badge
 * and the via tag.
 *
 * - `via`: the member's AI assistant it was added through ("via Claude"), when it was.
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Edit (the edit sheet) and ⋯ with Tags, Reopen and Delete, for writers.
 * - `tags`: its tags' chips, under the title (every role; tags PRD).
 */
export function TodoHeader({
  title,
  state,
  editors,
  actions,
  via,
  tags,
}: {
  title: string;
  state: TodoState;
  via?: string | null;
  editors?: ReactNode;
  actions?: ReactNode;
  tags?: ReactNode;
}) {
  const badge = todoBadge(state);
  return (
    <DetailHeader
      icon={ListTodo}
      tone={state === "done" ? "muted" : "primary"}
      title={title}
      titleProps={{ "data-todo-title": "" }}
      badges={
        (badge || via?.trim()) && (
          <>
            {badge && (
              <Badge tone={STATUS_TONE[badge.tone]} data-todo-badge={badge.tone}>
                {badge.label}
              </Badge>
            )}
            <ViaTag via={via} />
          </>
        )
      }
      details={tags}
      detailsProps={{ "data-todo-tags": "" }}
      editors={editors}
      actions={actions}
    />
  );
}
