import type { LocalTodo } from "~/lib/todos/todos.sync";

import { ListChecks } from "lucide-react";
import { Link } from "react-router";
import { TodoTree, TodoUndoStatus, useTodoTick } from "~/components/todos";
import { ICON_LG, LINK, Message, Skeleton } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { EASY_BLOCK, EASY_HEADING, STALE } from "./layout";
import { useEasyTodos } from "./useEasyTodos";

/**
 * Easy mode's "My todos" card (todos PRD): my open todos as trees in the
 * shared `TodoTree`'s easy look (todo-subtasks-3), overdue and today first,
 * trees until five of mine show (a tree is never cut), each with a big tick
 * (Undo for about 10 s) and its title opening its page, and "See all" to the
 * Todos list on Mine. A step of mine shows under its ancestors, dimmed
 * context rows; a parent reads "n of m done" (its tick waits on open
 * subtasks). The easy roles, who have no Todos list, get every one of theirs
 * and no "See all". Viewers get it too (they may complete what they were
 * given). Nothing when I have none. Not a tile: the tiles open entry forms.
 * No quick add: the card never added todos.
 *
 * It never pops in (the tile cache): todos remembered from earlier this
 * session paint at once, dimmed (`data-stale`, ticks off) until the device
 * confirms them; on a first visit a skeleton holds its place.
 */
export function EasyTodos({
  nameOf,
  className = "",
}: {
  /** A member's name, for a context row's assignee and a done step's line. */
  nameOf: (userId: string) => string;
  className?: string;
}) {
  const group = useGroup();
  const { trees, count, total, shown, ready, fresh, now, timeZone, progressOf } = useEasyTodos(group.id);
  const { complete, reopen, busy, error } = useTodoTick(group.id);
  if (!ready)
    return (
      <div className={`h-32 ${className}`} aria-hidden="true" data-easy-skeleton="todos">
        <Skeleton lines={5} />
      </div>
    );
  if (!shown) return null;

  const tick = (todo: LocalTodo, done: boolean) => void (done ? complete(todo) : reopen(todo));
  return (
    <section
      aria-label="My todos"
      className={`space-y-3 ${EASY_BLOCK} ${fresh ? "" : STALE} ${className}`}
      data-easy-todos=""
      data-stale={fresh ? undefined : ""}
    >
      <h2 className={EASY_HEADING}>
        <ListChecks aria-hidden="true" className={`text-primary ${ICON_LG}`} />
        My todos
      </h2>
      {trees.length > 0 && (
        <TodoTree
          trees={trees}
          look="easy"
          className="space-y-1"
          nameOf={nameOf}
          now={now}
          timeZone={timeZone}
          onTick={tick}
          busy={busy || !fresh}
          progressOf={progressOf}
        />
      )}
      <TodoUndoStatus groupId={group.id} className="text-base" />
      <Message tone="error" className="text-base!">
        {error}
      </Message>
      {!group.easyRole && (
        <p className="text-xl">
          <Link to={appUrls.todos(group.id, "?who=mine")} className={LINK} data-easy-todos-all="">
            {total > count ? `See all ${total} todos` : "See all"}
          </Link>
        </p>
      )}
    </section>
  );
}
