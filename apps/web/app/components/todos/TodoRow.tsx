import type { ReactNode } from "react";
import type { TodoTickProgress } from "./TodoTick";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { canCompleteTodo, todoState } from "@caretook/data/schema";
import { ListTodo, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router";
import { TagChips } from "~/components/tags";
import { TodoRepeatMark } from "./TodoRepeatMark";
import { TodoTick } from "./TodoTick";
import { TodoPartOf, TodoProgressMark } from "./TodoTreeMarks";
import { Badge, ViaTag } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { assigneeLabel, doneText, dueText } from "~/lib/todos/todoDisplay";
import { todoPageState } from "~/lib/todos/todoSheets";

/**
 * One todo: its tick (for whoever may complete it), the title (opening the
 * todo's page, for everyone), the due line (red when overdue) or the done
 * line, the repeat mark when it repeats, the assignee chip, and its tags'
 * chips (`tagsOf`; tags PRD). A parent shows "n of m done" (its tick waits
 * on open subtasks); a listed subtask "Part of <parent>" (todo-subtasks-2).
 * The `context` look (todo-subtasks-3) is an ancestor shown only to place a
 * branch: dimmed, no tick, still a link to its page. A tree (`TodoTree`)
 * passes `addSubtask` (its quick add, under the row's text) and `children`
 * (the nested list, below the row and not dimmed with it). The `card` look
 * is a Planner tree's top row, laid out like an event card; the `easy` look
 * easy mode's (the big tick and large text). With no `onTick` (easy mode's
 * Upcoming) no row has a tick.
 */
/**
 * How a row looks per place: `list` (the Todos and todo pages), `card` (a
 * Planner tree's top row, laid out like an event), `easy` (easy mode's big
 * tick and text), `context` (a dimmed ancestor).
 */
export type TodoRowLook = "list" | "card" | "easy" | "context";

export function TodoRow({
  todo,
  nameOf,
  now,
  timeZone,
  onTick,
  busy,
  tagsOf,
  progressOf,
  parentOf,
  look = "list",
  addSubtask,
  children,
}: {
  todo: LocalTodo;
  nameOf: (userId: string) => string;
  now: number;
  timeZone: string;
  /** Ticking a row; without it no row has a tick (a list that only shows, like easy mode's Upcoming). */
  onTick?: (todo: LocalTodo, done: boolean) => void;
  busy: boolean;
  /** A todo's tags (the list's one query), for its chips. */
  tagsOf?: (todoId: string) => readonly { id: string; name: string }[] | undefined;
  /** A parent's subtask progress (the list's one progress query). */
  progressOf?: (todoId: string) => TodoTickProgress | undefined;
  /** A subtask's parent, for "Part of". */
  parentOf?: (parentId: string) => { id: string; title: string } | undefined;
  /** `list` (the default), `card` (the Planner's), `easy` (easy mode's), or `context`: a dimmed ancestor placing a branch, with no tick. */
  look?: TodoRowLook;
  /** The row's quick add (a tree's, with `adding`), under its text. */
  addSubtask?: ReactNode;
  /** What goes under the row in its list item: a tree's next level. */
  children?: ReactNode;
}) {
  const group = useGroup();
  const { search } = useLocation();
  const context = look === "context";
  const mayTick =
    !!onTick && !context && canCompleteTodo({ role: group.role, userId: group.userId, todo: todo });
  const state = todoState(todo, now, timeZone);
  const assignee = assigneeLabel(todo, nameOf);
  const line = todo.doneAt ? doneText(todo, nameOf, now, timeZone) : dueText(todo, now, timeZone);
  const progress = progressOf?.(todo.id);
  const parent = todo.parentId ? parentOf?.(todo.parentId) : undefined;
  const tick = mayTick && (
    <TodoTick
      title={todo.title}
      done={!!todo.doneAt}
      disabled={busy}
      progress={progress}
      showCount={false}
      large={look === "easy"}
      onChange={(done) => onTick?.(todo, done)}
    />
  );
  const assigneeBadge = (className: string, label: ReactNode) => (
    <Badge
      icon={assignee.type === "name" ? UserRound : undefined}
      className={className}
      data-todo-assignee={assignee.type}
    >
      {label}
    </Badge>
  );

  if (look === "card") {
    const overdue = state === "overdue";
    const when = overdue ? "Overdue" : (todo.dueTime ?? "All day");
    return (
      <li>
        {/*
          Laid out like an event card (`UpcomingRow`, B-636): the tick (or a
          todo icon) where an event has its kind icon, its time over the title,
          the due line when overdue, the assignee pill where an event has its
          author. The whole card opens the todo's page; the tick, "Part of" and
          the quick add sit above that link.
        */}
        <div
          className="relative isolate grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 px-3 py-2"
          data-todo={todo.id}
          data-planner-todo={todo.id}
          data-todo-state={state}
          data-todo-look={look}
        >
          <Link
            to={appUrls.todo(group.id, todo.id)}
            state={todoPageState(search)}
            className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
            aria-label={`Open todo ${todo.title}, ${line}`}
            data-planner-todo-open
          />
          <span className="relative z-10 flex size-6 shrink-0 items-center justify-center">
            {tick || <ListTodo className="text-muted size-5" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p
              className={`flex items-center gap-1 text-sm whitespace-nowrap tabular-nums ${overdue ? "text-error-ink font-semibold" : "text-muted"}`}
              data-when-line
            >
              <span data-when>{when}</span>
              <TodoRepeatMark todo={todo} />
              <TodoProgressMark progress={progress} className="text-muted font-normal" />
            </p>
            <p
              className={`font-semibold break-words ${todo.doneAt ? "text-faint line-through" : ""}`}
              data-todo-title
            >
              {todo.title}
            </p>
            <TodoPartOf
              groupId={group.id}
              parent={parent}
              className="text-muted relative z-10 block text-sm"
            />
            <TagChips tags={tagsOf?.(todo.id)} className="mt-0.5" />
            {overdue && line && (
              <p className="text-error-ink text-sm" data-todo-due>
                {line}
              </p>
            )}
            {addSubtask && <div className="relative z-10">{addSubtask}</div>}
          </div>
          {/* A long name wraps inside the side column rather than squeezing the title. */}
          <div className="flex max-w-[8rem] flex-col items-end" data-todo-side>
            {assigneeBadge(
              "mt-auto h-auto max-w-full py-0.5 [&>svg]:shrink-0",
              <span className="min-w-0 break-words">{assignee.label}</span>,
            )}
          </div>
        </div>
        {children}
      </li>
    );
  }

  if (look === "easy") {
    return (
      <li>
        {/*
          Easy mode's (todos slice 6): the big tick, the large title opening its
          page, the due line in large text. No assignee chip or tags: the card is
          mine, and easy mode keeps to what to do and when. Without ticks in the
          list (`onTick`), no gap is kept for one.
        */}
        <div
          className="flex items-center gap-4 py-2"
          data-todo={todo.id}
          data-todo-state={state}
          data-todo-look={look}
        >
          {tick || (onTick && <span className="size-8 shrink-0" aria-hidden="true" />)}
          <div className="min-w-0 flex-1">
            <Link
              to={appUrls.todo(group.id, todo.id)}
              state={todoPageState(search)}
              className={`link link-hover block text-xl font-medium break-words ${todo.doneAt ? "text-faint line-through" : ""}`}
              data-todo-title
            >
              {todo.title}
            </Link>
            <p className={`text-base ${state === "overdue" ? "text-error-ink" : "text-muted"}`}>
              {line && <span data-todo-due>{line}</span>}
              <TodoRepeatMark todo={todo} className="ms-1.5" />
              <TodoProgressMark progress={progress} className="text-muted ms-1.5" />
            </p>
            <TodoPartOf groupId={group.id} parent={parent} className="text-muted block text-base" />
            {addSubtask}
          </div>
        </div>
        {children}
      </li>
    );
  }

  return (
    <li>
      <div
        className={`flex items-start gap-3 py-2.5 ${context ? "opacity-60" : ""}`}
        data-todo={todo.id}
        data-todo-state={state}
        data-todo-look={look}
      >
        {tick || <span className="w-6 shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <Link
            to={appUrls.todo(group.id, todo.id)}
            // The page's way back keeps the list's chip.
            state={todoPageState(search)}
            className={`link-hover block font-medium break-words ${todo.doneAt ? "text-faint line-through" : ""}`}
            data-todo-title
          >
            {todo.title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {line && (
              <span className={state === "overdue" ? "text-error-ink" : "text-muted"} data-todo-due>
                {line}
              </span>
            )}
            <TodoRepeatMark todo={todo} className="text-muted" />
            <TodoProgressMark progress={progress} className="text-muted" />
            {assigneeBadge("whitespace-nowrap", assignee.label)}
            <ViaTag via={todo.via} />
          </p>
          <TodoPartOf groupId={group.id} parent={parent} className="text-muted mt-0.5 block text-sm" />
          <TagChips tags={tagsOf?.(todo.id)} className="mt-1" />
          {addSubtask}
        </div>
      </div>
      {children}
    </li>
  );
}
