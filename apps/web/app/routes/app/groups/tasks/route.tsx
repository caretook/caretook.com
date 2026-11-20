import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { LocalTask, TaskRow } from "~/lib/tasks/tasks.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { Plus } from "lucide-react";
import { useCallback } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { TaskUndoStatus, useTaskTick } from "~/components/tasks";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { tasksQuery, toTasks } from "~/lib/tasks/tasks.sync";
import { membersQuery, readRows } from "~/lib/timeline/timeline.sync";
import { defaultWho, parseWho } from "~/lib/tasks/taskList";
import { DoneTasks } from "./DoneTasks";
import { TaskChips } from "./TaskChips";
import { TaskSections } from "./TaskSections";
import { listSearch, onlyTaskSheetChanged, TASK_SHEET_STATE } from "~/lib/tasks/taskSheets";
import { DONE_PAGE, useTaskList } from "./useTaskList";

// Shared by web + native. The group's tasks, read from the device's local
// copy (live, so it works offline and follows other members' changes):
// the open ones the Mine / Unassigned / Everyone chip shows (`?who=`), in
// sections by due, then Done. A tick completes a task on the device, with
// Undo. The add and edit sheets render over it.

export const meta = () => [{ title: "Tasks · Caretook" }];

const EMPTY: Record<string, string> = {
  mine: "Nothing assigned to you.",
  unassigned: "No unassigned tasks.",
  everyone: "No open tasks.",
};

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [openRows, memberRows] = await Promise.all([
    readRows<TaskRow>(db, tasksQuery(params.groupId)),
    readRows<MemberRow>(db, membersQuery(params.groupId)),
  ]);
  const who = parseWho(new URL(request.url).search) ?? defaultWho(toTasks(openRows), group.userId);
  const doneRows = await readRows<TaskRow>(
    db,
    tasksQuery(params.groupId, { done: true, who, userId: group.userId, limit: DONE_PAGE }),
  );
  return { openRows, doneRows, memberRows };
}

/**
 * The live queries follow every change and the chip is applied on the
 * device, so a chip change (same path) or a sheet opening and closing over
 * the list doesn't rerun the loader. Anything else (another group) does.
 */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  if (currentUrl.pathname === nextUrl.pathname) return false;
  if (nextParams.groupId && onlyTaskSheetChanged(nextParams.groupId, currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
}

export default function Tasks({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const { search } = useLocation();
  const list = useTaskList(params.groupId, loaderData);
  const { complete, reopen, busy, error } = useTaskTick(params.groupId);
  const onTick = useCallback(
    (task: LocalTask, done: boolean) => void (done ? complete(task) : reopen(task)),
    [complete, reopen],
  );
  const row = { nameOf: list.nameOf, now: list.now, timeZone: list.timeZone, onTick, busy };

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Tasks</h1>
          <p className="text-base-content/70 text-sm">{group.displayName}</p>
        </div>
        {group.canWrite && (
          <Link
            to={appUrls.newTask(params.groupId, {}, listSearch(search))}
            state={TASK_SHEET_STATE}
            // Loaded ahead, so the sheet opens offline too.
            prefetch="render"
            preventScrollReset
            className="btn btn-primary btn-sm shrink-0"
            data-add-task
          >
            <Plus className="size-4" aria-hidden="true" />
            Add task
          </Link>
        )}
      </header>

      <TaskChips who={list.who} />
      <TaskUndoStatus groupId={params.groupId} />
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}

      <TaskSections sections={list.sections} empty={EMPTY[list.who] ?? EMPTY.everyone!} {...row} />
      <DoneTasks tasks={list.done} more={list.moreDone} onMore={list.showMoreDone} {...row} />

      {/* The add and edit sheets render here, over the list. */}
      <Outlet />
    </main>
  );
}
