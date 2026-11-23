import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { redirect, useLocation } from "react-router";
import { Sheet } from "~/components/ui";
import { TODO_PREFILL_PARAMS } from "~/lib/todos/urls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { sessionContext } from "~/lib/auth/session";
import { createTodo } from "~/lib/todos/todos.sync";
import { TodoForm } from "../TodoForm";
import { todoFromForm } from "../todoFormData";
import {
  loadLinkChoices,
  loadMembers,
  useAssigneeMembers,
  useCloseTodoSheet,
  useLinkChoices,
} from "../todoSheet";
import { newTodoGuard } from "~/lib/todos/todoSheets";

// Shared by web + native. `todos/new`: the add sheet, over the list. It can
// start with a due day (`?dueOn=`), from quick entry's Edit a title, an
// assignee and a time, and from a provider's, medication's or appointment's
// page its link (`?providerId=`, `?medicationId=`, `?eventId=`). A viewer
// lands on the list.

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const decision = newTodoGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const { db } = context.get(sessionContext);
  const eventId = new URL(request.url).searchParams.get(TODO_PREFILL_PARAMS.eventId);
  const [memberRows, linkRows] = await Promise.all([
    loadMembers(db, group.id),
    loadLinkChoices(db, group.id, eventId),
  ]);
  return { memberRows, linkRows };
}

/** A local write; the list's live query shows it, and PowerSync uploads it. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const result = await createTodo(db, group.id, todoFromForm(await request.formData()));
  return result.ok ? { ok: true } : result;
}

/** The sheet closes on a save, so its own loader needn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function NewTodoSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseTodoSheet();
  const group = useGroup();
  const { search } = useLocation();
  const members = useAssigneeMembers(params.groupId, loaderData.memberRows);
  const links = useLinkChoices(params.groupId, loaderData.linkRows);
  const query = new URLSearchParams(search);
  const dueOn = query.get(TODO_PREFILL_PARAMS.dueOn);
  const dueTime = query.get(TODO_PREFILL_PARAMS.dueTime);
  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && close()} title="Add a todo">
      <TodoForm
        // A new URL is a new form.
        key={search}
        members={members}
        meId={group.userId}
        dueOn={dueOn && /^\d{4}-\d{2}-\d{2}$/.test(dueOn) ? dueOn : null}
        prefill={{
          title: query.get(TODO_PREFILL_PARAMS.title),
          assigneeId: query.get(TODO_PREFILL_PARAMS.assigneeId),
          dueTime: dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : null,
          providerId: query.get(TODO_PREFILL_PARAMS.providerId),
          medicationId: query.get(TODO_PREFILL_PARAMS.medicationId),
          eventId: query.get(TODO_PREFILL_PARAMS.eventId),
        }}
        links={links}
        zoneNote={scheduleZoneNote(
          group.recipient?.timeZone ?? null,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        )}
        onDone={close}
        onCancel={close}
      />
    </Sheet>
  );
}
