import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { canTagRecord } from "@caretook/data/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { EditorAvatars, LiveNotesEditor } from "~/components/notes";
import { QuickTags, useRecordTags } from "~/components/tags";
import { useTodoTick } from "~/components/todos";
import { BackLink, Message, Notice, Page, Section } from "~/components/ui";
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
import { TodoParentLink, TodoSubtasks } from "./TodoSubtasks";
import { useTodoNotes } from "./useTodoNotes";
import { useTodoPage } from "./useTodoPage";
import { useTodoSubtasks } from "./useTodoSubtasks";
import { canCompleteTodo } from "@caretook/data/domain";

// Shared by web + native. A todo's page: who it's for, when it's due, who
// finished it, the complete or reopen button for whoever may complete it,
// and its shared live notes (what the pharmacy said). All local and live,
// like the medication page; the notes are the todo's document (its id is
// the todo's), created on the first real change. Writers edit (the list's
// sheet), reopen and delete from the header. The easy roles read it (their
// own todos they tick) and go back to the timeline: their pages hold no
// links onward to the Todos list, providers or medications.

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
  const listUrl = group.easyRole
    ? appUrls.timeline(groupId)
    : appUrls.todos(groupId, listSearchFromState(location.state as unknown));
  const listLabel = group.easyRole ? "Timeline" : "Todos";
  const page = useTodoPage(groupId, todoId, loaderData);
  const { todo, deleted } = page;
  const tree = useTodoSubtasks(todo, loaderData);
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

  // Tags (tags-2): every chip for every role; × and Add tag for a writer (`QuickTags`).
  const tags = useRecordTags("todo", todoId);
  const mayTag = canTagRecord(group.role, { target: "todo", createdBy: todo.createdBy }, group.userId);

  return (
    <Page bands data-todo-page={todoId}>
      <Section>
        <BackLink to={listUrl} label={listLabel} />

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
                subtasks={tree.descendants.length}
                busy={tick.busy}
                onReopen={() => void tick.reopen(todo)}
                onDelete={deleting}
              />
            )
          }
          tags={
            !deleted &&
            (mayTag || tags.length > 0) && (
              <QuickTags
                target="todo"
                recordId={todoId}
                label={todo.title}
                createdBy={todo.createdBy}
                max={null}
                tags={tags}
              />
            )
          }
        />
        {!deleted && <TodoParentLink groupId={groupId} parent={tree.parent} />}
      </Section>

      {deleted ? (
        <Section>
          <Notice
            tone="error"
            action={{ label: `Back to ${listLabel.toLowerCase()}`, to: listUrl }}
            data-todo-deleted=""
          >
            This todo was deleted.
          </Notice>
        </Section>
      ) : (
        <>
          <TodoDetails
            todo={todo}
            nameOf={page.nameOf}
            now={page.now}
            timeZone={page.timeZone}
            zoneNote={page.zoneNote}
          />

          <TodoSubtasks
            todo={todo}
            ancestors={tree.ancestors}
            chain={tree.chain}
            subtasks={tree.subtasks}
            descendants={tree.descendants}
            progress={tree.progress}
            progressOf={tree.progressOf}
            nameOf={page.nameOf}
            now={page.now}
            timeZone={page.timeZone}
          />

          <TodoLinks groupId={groupId} todo={todo} loaded={loaderData.linkRows} linkPages={!group.easyRole} />

          {mayComplete && (
            <TodoCompletion
              groupId={groupId}
              todoId={todoId}
              title={todo.title}
              done={!!todo.doneAt}
              busy={tick.busy}
              error={tick.error}
              progress={tree.subtasks.length ? tree.progress : undefined}
              onComplete={() => void tick.complete(todo)}
              onReopen={() => void tick.reopen(todo)}
            />
          )}

          <Section
            title="Notes"
            id="notes"
            description={
              group.canWrite
                ? "Shared with the care group: what the pharmacy said, numbers, what's left to do."
                : "Shared with the care group. You can view these notes."
            }
          >
            {saveError && <Message tone="error">{saveError}</Message>}
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
              linkMentions={!group.easyRole}
            />
          </Section>
        </>
      )}
    </Page>
  );
}
