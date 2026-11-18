import type { Route } from "./+types/entry-notes";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";
import type { EntryRow, GroupRow } from "~/lib/sync/timeline";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { ArrowLeft } from "lucide-react";
import { data, Link, useFetcher } from "react-router";
import { KindIcon } from "~/components/KindIcon";
import { LiveNotesEditor } from "~/components/LiveNotesEditor";
import { KIND_META } from "~/lib/entryDisplay";
import { formatDay, formatTime } from "~/lib/format";
import { requireSession } from "~/lib/session";
import { getSync, useLiveQuery, waitForFirstSync } from "~/lib/sync";
import { ensureNoteDocument } from "~/lib/sync/notes";
import { myGroupsQuery, readRows, toMyGroup, toTimelineEntry, WRITER_ROLES } from "~/lib/sync/timeline";

// Shared by web + native. A note's or event's live document, edited by
// several people at once (Yjs), offline included. Everything is local:
// edits sync through PowerSync like the rest of the timeline.

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `Live notes · ${loaderData.heading} · Caretook` : "Live notes · Caretook" }];
}

const entrySql = "SELECT * FROM timeline_entry WHERE id = ? AND group_id = ? AND deleted_at IS NULL";
const documentSql = "SELECT id, snapshot FROM note_document WHERE id = ?";
// Watched while the page is open: the entry can be deleted, and the document added.
const liveEntrySql = "SELECT id FROM timeline_entry WHERE id = ? AND group_id = ? AND deleted_at IS NULL";
const liveDocumentSql = "SELECT id FROM note_document WHERE id = ?";

/** The entry, its document and pending updates. Anything not on the device (or not allowed) is a 404. */
export async function clientLoader({ request, params }: Route.ClientLoaderArgs) {
  const { groupId, entryId } = params;
  const { db } = await requireSession(request);
  await waitForFirstSync(db);

  const groups = await readRows<GroupRow>(db, myGroupsQuery(db.userId));
  const groupRow = groups.find((g) => g.id === groupId);
  if (!groupRow) throw data("Not found", { status: 404 });

  const [entryRow] = await readRows<EntryRow>(db, { sql: entrySql, params: [entryId, groupId] });
  const entry = entryRow ? toTimelineEntry(entryRow) : null;
  if (!entry || !canHaveNoteDocument(entry.kind)) throw data("Not found", { status: 404 });

  const [doc] = await readRows<{ id: string; snapshot: string | null }>(db, {
    sql: documentSql,
    params: [entryId],
  });
  const updates = doc
    ? await readRows<{ id: string; data: string | null }>(db, {
        sql: "SELECT id, data FROM note_update WHERE document_id = ?",
        params: [entryId],
      })
    : [];

  const group = toMyGroup(groupRow);
  return {
    entry,
    heading: entry.title || KIND_META[entry.kind].label,
    canWrite: !!group.role && WRITER_ROLES.includes(group.role),
    initial: doc ? { snapshot: doc.snapshot, updates } : null,
    // Starting rows for the live queries (stable, so they don't reset each render).
    entryIds: [{ id: entry.id }],
    documentIds: doc ? [{ id: doc.id }] : [],
  };
}

/** "Start live notes" on an entry that has none yet. */
export async function clientAction({ params }: Route.ClientActionArgs): Promise<ActionResult> {
  return ensureNoteDocument(getSync(), params.entryId);
}

/** The live queries below keep the page current; a submission needs no reload. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod ? false : defaultShouldRevalidate;
}

export default function EntryNotes({ loaderData, params }: Route.ComponentProps) {
  const { entry, heading, canWrite, initial } = loaderData;
  const { groupId, entryId } = params;
  const db = getSync();
  const starter = useFetcher<ActionResult>();

  const deleted = useLiveQuery(liveEntrySql, [entryId, groupId], loaderData.entryIds).length === 0;
  const hasDocument = useLiveQuery(liveDocumentSql, [entryId], loaderData.documentIds).length > 0;

  const timelineUrl = `/app/groups/${groupId}/timeline`;
  const label = `Live notes for ${heading}`;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <Link to={timelineUrl} className="btn btn-ghost btn-sm -ml-3 gap-1">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Timeline
      </Link>

      <header className="flex items-start gap-3">
        <KindIcon kind={entry.kind} />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold break-words">{heading}</h1>
          <p className="text-base-content/70 text-sm">
            <time dateTime={entry.occurredAt}>
              {formatDay(entry.occurredAt)}, {formatTime(entry.occurredAt)}
            </time>
            {!canWrite && " · You can view these notes"}
          </p>
          {entry.body && entry.kind === "event" && (
            <p className="text-base-content/80 mt-1 break-words whitespace-pre-wrap">{entry.body}</p>
          )}
        </div>
      </header>

      {deleted ? (
        <div role="alert" className="alert">
          <span>This entry was deleted, so its live notes are gone too.</span>
          <Link to={timelineUrl} className="btn btn-sm">
            Back to the timeline
          </Link>
        </div>
      ) : hasDocument ? (
        <LiveNotesEditor
          key={entryId}
          label={label}
          db={db}
          documentId={entryId}
          groupId={groupId}
          canWrite={canWrite}
          initial={initial ?? { snapshot: null, updates: [] }}
        />
      ) : canWrite ? (
        <starter.Form method="post" className="rounded-box border-base-300 bg-base-100 space-y-3 border p-4">
          <p>
            Live notes are a shared document on this {KIND_META[entry.kind].label.toLowerCase()}. Everyone in
            the group can watch them as they&apos;re written, and caretakers can write together.
          </p>
          {starter.data && !starter.data.ok && (
            <p role="alert" className="text-error">
              {starter.data.error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={starter.state !== "idle"}>
            Start live notes
          </button>
        </starter.Form>
      ) : (
        <p className="text-base-content/70">No live notes on this entry yet.</p>
      )}
    </main>
  );
}
