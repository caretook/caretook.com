import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { canCompleteTodo } from "@caretook/data/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { EditorAvatars, LiveNotesEditor } from "~/components/notes";
import { useTodoTick } from "~/components/todos";
import { BackLink } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { getSync } from "~/lib/sync";
import { removeTodo, skipTodo } from "~/lib/todos/todos.sync";
import { listSearchFromState } from "~/lib/todos/todoSheets";
import { useMentionProviders } from "~/lib/providers/mentionProviders.sync";
import { loadTodo } from "./loadTodo";
import { DELETE_INTENT, SKIP_INTENT, TodoActions } from "./TodoActions";
import { TodoCompletion } from "./TodoCompletion";
import { TodoDetails } from "./TodoDetails";
import { TodoHeader } from "./TodoHeader";
import { TodoLinks } from "./TodoLinks";
import { useTodoNotes } from "./useTodoNotes";
import { useTodoPage } from "./useTodoPage";

// Shared by web + native. A todo's page: who it's for, when it's due, who
// finished it, the complete or reopen button for whoever may complete it,
// and its shared live notes (what the pharmacy said). All local and live,
// like the medication page; the notes are the todo's document (its id is
// the todo's), created on the first real change. Writers edit (the list's
// sheet), reopen and delete from the header.

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.todo.title} · Caretook` : "Caretook" }];
}

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  return loadTodo(db, params.groupId, params.todoId);
}

/**
 * Delete (soft), or skip a repeating todo's occurrence (planner-2: it goes
 * and the next one comes): local writes; the live row shows them, and
 * PowerSync uploads them.
 */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === SKIP_INTENT) {
    const result = await skipTodo(db, params.todoId);
    return result.ok ? { ok: true } : result;
  }
  if (intent !== DELETE_INTENT) return { ok: false, error: "Nothing to do", issues: [] };
  return removeTodo(db, params.todoId);
}

/** Live queries keep the page current, so submissions need no reload. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function Todo(props: Route.ComponentProps) {
  // Another todo is another page (and another document): start fresh.
  return <TodoPage key={props.loaderData.todo.id} {...props} />;
}

function TodoPage({ loaderData, params }: Route.ComponentProps) {
  const { groupId, todoId } = params;
  // Live: a role changed on another device shows without a reload.
  const group = useGroup();
  // Read once: after sign-out closes the database, this page may render once more before it goes.
  const [db] = useState(getSync);
  const location = useLocation();
  const listUrl = appUrls.todos(groupId, listSearchFromState(location.state as unknown));
  const page = useTodoPage(groupId, todoId, loaderData);
  const { todo, deleted } = page;
  const tick = useTodoTick(groupId);
  const mayComplete = canCompleteTodo({ role: group.role, userId: group.userId, todo: todo });
  const { ensureSaved, saveError } = useTodoNotes(todoId, loaderData.hasDocument);
  // The group's providers, for mentions in the notes (chips only: nothing links here).
  const mentionProviders = useMentionProviders(groupId);

  // Deleted from here: back to the list (the page would only say it's gone).
  const navigate = useNavigate();
  const removedHere = useRef(false);
  const deleting = useCallback(() => void (removedHere.current = true), []);
  useEffect(() => {
    if (deleted && removedHere.current) void navigate(listUrl, { replace: true });
  }, [deleted, navigate, listUrl]);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5" data-todo-page={todoId}>
      <BackLink to={listUrl} label="Todos" />

      <TodoHeader
        title={todo.title}
        state={page.state}
        via={todo.via}
        editors={!deleted && <EditorAvatars documentId={todoId} groupId={groupId} viewerId={db.userId} />}
        actions={
          group.canWrite &&
          !deleted && (
            <TodoActions
              groupId={groupId}
              todoId={todoId}
              title={todo.title}
              done={!!todo.doneAt}
              repeats={!!todo.repeatRule}
              busy={tick.busy}
              onReopen={() => void tick.reopen(todo)}
              onDelete={deleting}
            />
          )
        }
      />

      {deleted ? (
        <div role="alert" className="alert" data-todo-deleted>
          <span>This todo was deleted.</span>
          <Link to={listUrl} className="btn btn-sm">
            Back to todos
          </Link>
        </div>
      ) : (
        <>
          <TodoDetails
            todo={todo}
            nameOf={page.nameOf}
            now={page.now}
            timeZone={page.timeZone}
            zoneNote={page.zoneNote}
          />

          <TodoLinks groupId={groupId} todo={todo} loaded={loaderData.linkRows} />

          {mayComplete && (
            <TodoCompletion
              groupId={groupId}
              title={todo.title}
              done={!!todo.doneAt}
              busy={tick.busy}
              error={tick.error}
              onComplete={() => void tick.complete(todo)}
              onReopen={() => void tick.reopen(todo)}
            />
          )}

          <section aria-labelledby="todo-notes-heading" className="space-y-2">
            <div>
              <h2 id="todo-notes-heading" className="font-semibold">
                Notes
              </h2>
              <p className="text-base-content/70 text-sm">
                {group.canWrite
                  ? "Shared with the care group: what the pharmacy said, numbers, what's left to do."
                  : "Shared with the care group. You can view these notes."}
              </p>
            </div>
            {saveError && (
              <p role="alert" className="text-error text-sm">
                {saveError}
              </p>
            )}
            <LiveNotesEditor
              key={todoId}
              label={`Notes on ${todo.title}`}
              db={db}
              documentId={todoId}
              groupId={groupId}
              canWrite={group.canWrite}
              initial={loaderData.initial}
              ensureSaved={ensureSaved}
              providers={mentionProviders}
            />
          </section>
        </>
      )}
    </main>
  );
}
