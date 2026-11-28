import type { LocalTodo, TodoRow } from "~/lib/todos/todos.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";
import type { ReactNode } from "react";

import { Link2, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  TodoQuickAdd,
  TodoRepeatMark,
  TodoTick,
  TodoUndoStatus,
  useQuickAddChains,
  useTodoTick,
} from "~/components/todos";
import { Badge, Button, ComboBox, IconButton, Message, TITLE_SECTION } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { useNow } from "~/lib/live-notes/editors.sync";
import { getSync, useLiveQuery } from "~/lib/sync";
import { useLiveRows } from "~/lib/sync/useLiveRows";
import { membersQuery } from "~/lib/timeline/timeline.sync";
import { todoPickerOptions } from "~/lib/todos/entryTodoPicker";
import { entryTodosQuery, linkTodo, unlinkTodo } from "~/lib/todos/entryTodos.sync";
import { todosQuery, toTodos } from "~/lib/todos/todos.sync";
import {
  canCompleteTodo,
  doneOrder,
  isTodoWriter,
  todoOrder,
  todoState,
  assigneeLabel,
  doneText,
  dueText,
} from "@caretook/data/domain";

const NO_TODOS: TodoRow[] = [];
const NO_MEMBERS: MemberRow[] = [];

/** How many done todos the section shows, newest first. */
export const ENTRY_DONE_LIMIT = 20;

const KIND_WORD = { note: "note", event: "event" } as const;

/**
 * A stored note's or event's Todos (planner-3, replacing `LinkedTodos`
 * here): its linked open todos in list order, each with its tick (for
 * whoever may complete it; Undo for about 10 s), then the done ones, newest
 * first (at most 20), with who did them and when. Writers get the full
 * quick add (a todo linked to this entry; todo-links-6), each open row's
 * compact one (a subtask, linked here too), Link a todo (a picker over the
 * group's open todos not linked here) and each row's Remove (the link
 * only; the todo stays). All local, so it works offline. Hidden from
 * readers while nothing is linked.
 */
export function EntryTodos({ entryId, kind }: { entryId: string; kind: "note" | "event" }) {
  const group = useGroup();
  const writer = isTodoWriter(group.role);
  const timeZone = group.recipient?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = useNow(60_000);
  const query = entryTodosQuery(entryId);
  const rows = useLiveQuery<TodoRow>(query.sql, query.params, NO_TODOS);
  const mq = membersQuery(group.id);
  const { rows: members, fresh: membersAnswered } = useLiveRows<MemberRow>(mq.sql, mq.params, NO_MEMBERS);
  // The todos wait for the members' first answer, so an assignee is never "Former member" just because the names haven't loaded.
  const todos = useMemo(() => (membersAnswered ? toTodos(rows) : []), [membersAnswered, rows]);
  const open = useMemo(
    () =>
      todoOrder(
        todos.filter((t) => !t.doneAt),
        now,
        timeZone,
      ),
    [todos, now, timeZone],
  );
  const done = useMemo(() => doneOrder(todos.filter((t) => t.doneAt)).slice(0, ENTRY_DONE_LIMIT), [todos]);
  const nameOf = useCallback(
    (userId: string) =>
      userId === group.userId ? "you" : (members.find((m) => m.user_id === userId)?.name ?? "Former member"),
    [members, group.userId],
  );
  const chainOf = useQuickAddChains(open);
  const { complete, reopen, busy, error: tickError } = useTodoTick(group.id);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const linkButton = useRef<HTMLButtonElement>(null);
  // Picking or Escape puts focus back on Link a todo once the picker has gone.
  const refocus = useRef(false);
  useEffect(() => {
    if (picking || !refocus.current) return;
    refocus.current = false;
    linkButton.current?.focus();
  }, [picking]);

  if (!writer && todos.length === 0) return null;

  const report = (res: { ok: boolean; error?: string }) => setError(res.ok ? null : (res.error ?? null));
  const closePicker = (focusLink: boolean) => {
    setPicking(false);
    refocus.current = focusLink;
  };
  const link = async (todoId: string) => {
    closePicker(true);
    report(await linkTodo(getSync(), entryId, todoId));
  };
  const unlink = async (todoId: string) => report(await unlinkTodo(getSync(), entryId, todoId));
  const tick = (todo: LocalTodo, isDone: boolean) => void (isDone ? complete(todo) : reopen(todo));

  const row = (todo: LocalTodo) => (
    <EntryTodoRow
      quickAdd={
        todo.doneAt ? undefined : (
          <TodoQuickAdd
            parent={todo}
            ancestors={chainOf(todo)}
            link={{ entryId }}
            form="compact"
            className="mt-1"
          />
        )
      }
      key={todo.id}
      todo={todo}
      nameOf={nameOf}
      now={now}
      timeZone={timeZone}
      busy={busy}
      onTick={tick}
      onRemove={writer ? (t) => void unlink(t.id) : undefined}
      kind={kind}
    />
  );
  const list = "rounded-box border-base-300 bg-base-100 divide-base-200 divide-y border px-3";

  return (
    <section aria-labelledby={`entry-todos-${entryId}`} className="space-y-2" data-entry-todos="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`entry-todos-${entryId}`} className={TITLE_SECTION}>
          Todos
        </h2>
        {writer && (
          <Button
            ref={linkButton}
            variant="ghost"
            size="sm"
            icon={Link2}
            onClick={() => setPicking((p) => !p)}
            expanded={picking}
            data-entry-todos-link=""
          >
            Link a todo
          </Button>
        )}
      </div>
      {writer && picking && (
        <TodoPicker
          groupId={group.id}
          linked={todos}
          now={now}
          timeZone={timeZone}
          onPick={(id) => void link(id)}
          onClose={(reason) => closePicker(reason === "escape")}
        />
      )}
      {open.length > 0 && (
        <ul className={list} aria-label="Open todos">
          {open.map(row)}
        </ul>
      )}
      {writer && todos.length === 0 && !picking && (
        <p className="text-muted text-sm">No todos linked to this {KIND_WORD[kind]}.</p>
      )}
      <TodoQuickAdd link={{ entryId }} form="full" />
      {done.length > 0 && (
        <ul className={list} aria-label="Done todos" data-entry-todos-done="">
          {done.map(row)}
        </ul>
      )}
      <TodoUndoStatus groupId={group.id} />
      {(tickError || error) && <Message tone="error">{tickError || error}</Message>}
    </section>
  );
}

/** One linked todo: tick, title (opening its page), due or done line, repeat mark, assignee, an open one's quick add, and a writer's Remove. */
function EntryTodoRow({
  todo,
  quickAdd,
  nameOf,
  now,
  timeZone,
  busy,
  onTick,
  onRemove,
  kind,
}: {
  todo: LocalTodo;
  /** Its compact subtask quick add (open rows). */
  quickAdd?: ReactNode;
  nameOf: (userId: string) => string;
  now: number;
  timeZone: string;
  busy: boolean;
  onTick: (todo: LocalTodo, done: boolean) => void;
  onRemove?: (todo: LocalTodo) => void;
  kind: "note" | "event";
}) {
  const group = useGroup();
  const state = todoState(todo, now, timeZone);
  const assignee = assigneeLabel(todo, nameOf);
  const line = todo.doneAt ? doneText(todo, nameOf, now, timeZone) : dueText(todo, now, timeZone);
  return (
    <li className="flex items-start gap-3 py-2.5" data-todo={todo.id} data-todo-state={state}>
      {canCompleteTodo({ role: group.role, userId: group.userId, todo }) ? (
        <TodoTick
          title={todo.title}
          done={!!todo.doneAt}
          disabled={busy}
          onChange={(isDone) => onTick(todo, isDone)}
        />
      ) : (
        <span className="w-6 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <Link
          to={appUrls.todo(group.id, todo.id)}
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
          <Badge
            icon={assignee.type === "name" ? UserRound : undefined}
            className="whitespace-nowrap"
            data-todo-assignee={assignee.type}
          >
            {assignee.label}
          </Badge>
        </p>
        {quickAdd}
      </div>
      {onRemove && (
        <IconButton
          label={`Remove “${todo.title}” from this ${KIND_WORD[kind]}`}
          icon={X}
          onPress={() => onRemove(todo)}
          data-entry-todo-remove=""
        />
      )}
    </li>
  );
}

/** Link a todo: a combo box over the group's open todos not linked here, live. */
function TodoPicker({
  groupId,
  linked,
  now,
  timeZone,
  onPick,
  onClose,
}: {
  groupId: string;
  linked: readonly LocalTodo[];
  now: number;
  timeZone: string;
  onPick: (todoId: string) => void;
  onClose: (reason: "blur" | "escape") => void;
}) {
  const query = todosQuery(groupId);
  const rows = useLiveQuery<TodoRow>(query.sql, query.params, NO_TODOS);
  const todos = useMemo(() => toTodos(rows), [rows]);
  const [text, setText] = useState("");
  const linkedIds = useMemo(() => new Set(linked.map((t) => t.id)), [linked]);
  const options = useMemo(
    () => todoPickerOptions(todos, linkedIds, text, now, timeZone),
    [todos, linkedIds, text, now, timeZone],
  );
  return (
    <div className="w-full max-w-sm">
      <ComboBox
        label="Find a todo to link"
        placeholder="Search open todos"
        options={options}
        inputValue={text}
        onInputChange={setText}
        onSelect={onPick}
        emptyText={text.trim() ? "No open todos match" : "No open todos to link"}
        onClose={onClose}
        focusOnMount
      />
    </div>
  );
}
