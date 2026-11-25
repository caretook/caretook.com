import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { SyncDb } from "~/lib/sync";

import { NOTE_DOCUMENT_KINDS } from "@caretook/data/schema";
import { redirect, useLocation } from "react-router";
import { Sheet } from "~/components/ui";
import { TODO_PREFILL_PARAMS } from "~/lib/todos/urls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { sessionContext } from "~/lib/auth/session";
import { createTodo } from "~/lib/todos/todos.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
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
// lands on the list. `?entryId=` (planner-3) links any live note or event:
// an event's shows in the picker, a note's is a hidden field, and an id
// that's neither is ignored. Either is saved as a link row with the todo.

type EntryPrefill = { eventId: string | null; entryId: string | null };

/** The link prefills: `eventId` as given (else `entryId` when it's a live event), and `entryId` when it's a live note or event. */
const entryPrefill = async (db: SyncDb, groupId: string, query: URLSearchParams): Promise<EntryPrefill> => {
  const eventId = query.get(TODO_PREFILL_PARAMS.eventId);
  const entryId = query.get(TODO_PREFILL_PARAMS.entryId);
  const [entry] = entryId
    ? await readRows<{ id: string; kind: string | null }>(db, {
        sql: "SELECT id, kind FROM timeline_entry WHERE id = ? AND group_id = ? AND deleted_at IS NULL",
        params: [entryId, groupId],
      })
    : [];
  if (entry?.kind === "event" && !eventId) return { eventId: entry.id, entryId: null };
  const linkable = !!entry && (NOTE_DOCUMENT_KINDS as readonly (string | null)[]).includes(entry.kind);
  return { eventId, entryId: linkable ? entry.id : null };
};

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const decision = newTodoGuard({
    groupId: group.id,
    search: new URL(request.url).search,
    canWrite: group.canWrite,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const { db } = context.get(sessionContext);
  const entry = await entryPrefill(db, group.id, new URL(request.url).searchParams);
  const [memberRows, linkRows] = await Promise.all([
    loadMembers(db, group.id),
    loadLinkChoices(db, group.id, entry.eventId),
  ]);
  return { memberRows, linkRows, entry };
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
          eventId: loaderData.entry.eventId,
          entryId: loaderData.entry.entryId,
          repeatRule: query.get(TODO_PREFILL_PARAMS.repeatRule),
        }}
        links={links}
        zoneNote={scheduleZoneNote(
          group.recipient?.timeZone ?? null,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        )}
        // From the Planner's Upcoming or Past, a save lands on the Todos tab.
        onDone={() => close({ saved: true })}
        onCancel={() => close()}
      />
    </Sheet>
  );
}
