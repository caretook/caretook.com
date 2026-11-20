import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";

import { canCompleteTask } from "@caretook/data/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { EditorAvatars, LiveNotesEditor } from "~/components/notes";
import { useTaskTick } from "~/components/tasks";
import { BackLink } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { getGroup, useGroup } from "~/lib/group";
import { sessionContext } from "~/lib/session";
import { getSync } from "~/lib/sync";
import { removeTask } from "~/lib/sync/tasks";
import { listSearchFromState } from "~/lib/taskSheets";
import { loadTask } from "./loadTask";
import { DELETE_INTENT, TaskActions } from "./TaskActions";
import { TaskCompletion } from "./TaskCompletion";
import { TaskDetails } from "./TaskDetails";
import { TaskHeader } from "./TaskHeader";
import { useTaskNotes } from "./useTaskNotes";
import { useTaskPage } from "./useTaskPage";

// Shared by web + native. A task's page: who it's for, when it's due, who
// finished it, the complete or reopen button for whoever may complete it,
// and its shared live notes (what the pharmacy said). All local and live,
// like the medication page; the notes are the task's document (its id is
// the task's), created on the first real change. Writers edit (the list's
// sheet), reopen and delete from the header.

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.task.title} · Caretook` : "Caretook" }];
}

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  return loadTask(db, params.groupId, params.taskId);
}

/** Delete (soft): a local write; the live row shows it, and PowerSync uploads it. */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  if (form.get("intent") !== DELETE_INTENT) return { ok: false, error: "Nothing to do", issues: [] };
  return removeTask(db, params.taskId);
}

/** Live queries keep the page current, so submissions need no reload. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function Task(props: Route.ComponentProps) {
  // Another task is another page (and another document): start fresh.
  return <TaskPage key={props.loaderData.task.id} {...props} />;
}

function TaskPage({ loaderData, params }: Route.ComponentProps) {
  const { groupId, taskId } = params;
  // Live: a role changed on another device shows without a reload.
  const group = useGroup();
  // Read once: after sign-out closes the database, this page may render once more before it goes.
  const [db] = useState(getSync);
  const location = useLocation();
  const listUrl = appUrls.tasks(groupId, listSearchFromState(location.state as unknown));
  const page = useTaskPage(groupId, taskId, loaderData);
  const { task, deleted } = page;
  const tick = useTaskTick(groupId);
  const mayComplete = canCompleteTask({ role: group.role, userId: group.userId, task });
  const { ensureSaved, saveError } = useTaskNotes(taskId, loaderData.hasDocument);

  // Deleted from here: back to the list (the page would only say it's gone).
  const navigate = useNavigate();
  const removedHere = useRef(false);
  const deleting = useCallback(() => void (removedHere.current = true), []);
  useEffect(() => {
    if (deleted && removedHere.current) void navigate(listUrl, { replace: true });
  }, [deleted, navigate, listUrl]);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5" data-task-page={taskId}>
      <BackLink to={listUrl} label="Tasks" />

      <TaskHeader
        title={task.title}
        state={page.state}
        editors={!deleted && <EditorAvatars documentId={taskId} groupId={groupId} viewerId={db.userId} />}
        actions={
          group.canWrite &&
          !deleted && (
            <TaskActions
              groupId={groupId}
              taskId={taskId}
              title={task.title}
              done={!!task.doneAt}
              busy={tick.busy}
              onReopen={() => void tick.reopen(task)}
              onDelete={deleting}
            />
          )
        }
      />

      {deleted ? (
        <div role="alert" className="alert" data-task-deleted>
          <span>This task was deleted.</span>
          <Link to={listUrl} className="btn btn-sm">
            Back to tasks
          </Link>
        </div>
      ) : (
        <>
          <TaskDetails
            task={task}
            nameOf={page.nameOf}
            now={page.now}
            timeZone={page.timeZone}
            zoneNote={page.zoneNote}
          />

          {mayComplete && (
            <TaskCompletion
              groupId={groupId}
              title={task.title}
              done={!!task.doneAt}
              busy={tick.busy}
              error={tick.error}
              onComplete={() => void tick.complete(task)}
              onReopen={() => void tick.reopen(task)}
            />
          )}

          <section aria-labelledby="task-notes-heading" className="space-y-2">
            <div>
              <h2 id="task-notes-heading" className="font-semibold">
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
              key={taskId}
              label={`Notes on ${task.title}`}
              db={db}
              documentId={taskId}
              groupId={groupId}
              canWrite={group.canWrite}
              initial={loaderData.initial}
              ensureSaved={ensureSaved}
            />
          </section>
        </>
      )}
    </main>
  );
}
