import type { Route } from "./+types/entry";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type * as Y from "yjs";
import type { MaterializeInput } from "~/lib/sync/liveEntry";
import type { EntryRow, GroupRow } from "~/lib/sync/timeline";

import { canHaveNoteDocument, noteText } from "@caretook/data/schema";
import { ArrowLeft } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { data, Link, useNavigate } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { EditorAvatars } from "~/components/EditorAvatars";
import { EntryHeader, EntryTime, EntryTitle } from "~/components/EntryHeader";
import { EntryMenu } from "~/components/EntryMenu";
import { EntryTimeChip } from "~/components/EntryTimeChip";
import { LiveNotesEditor } from "~/components/LiveNotesEditor";
import { ShareButton } from "~/components/ShareButton";
import { KIND_META } from "~/lib/entryDisplay";
import { localTimeZone } from "~/lib/format";
import {
  entryUrl,
  isLiveEntryKind,
  NEW_ENTRY,
  savedTitle,
  shouldMaterialize,
  titleField,
} from "~/lib/liveEntry";
import { requireSession } from "~/lib/session";
import { getSync, useLiveQuery, waitForFirstSync } from "~/lib/sync";
import { materializeLiveEntry } from "~/lib/sync/liveEntry";
import {
  myGroupsQuery,
  readRows,
  removeEntry,
  toMyGroup,
  toTimelineEntry,
  updateEntry,
  WRITER_ROLES,
} from "~/lib/sync/timeline";

// Shared by web + native. A note (or event) is its live document: this page
// is where it's written, by several people at once (Yjs), offline included.
// Everything is local; edits sync through PowerSync like the rest of the
// timeline.
//
// `/entries/new?kind=note|event` is a draft: an id made here, nothing written.
// The first real change saves the entry and its document together (see
// lib/liveEntry.ts), and the URL is replaced with `/entries/:id`. It's the
// same route, so the editor stays mounted and keeps the cursor.

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.heading} · Caretook` : "Caretook" }];
}

const entrySql = "SELECT * FROM timeline_entry WHERE id = ? AND group_id = ? AND deleted_at IS NULL";

/** The entry, its document and pending updates (or a new draft). Anything not on the device, or not allowed, is a 404. */
export async function clientLoader({ request, params }: Route.ClientLoaderArgs) {
  const { groupId, entryId } = params;
  const { db } = await requireSession(request);
  await waitForFirstSync(db);

  const groups = await readRows<GroupRow>(db, myGroupsQuery(db.userId));
  const groupRow = groups.find((g) => g.id === groupId);
  if (!groupRow) throw data("Not found", { status: 404 });
  const group = toMyGroup(groupRow);
  const canWrite = !!group.role && WRITER_ROLES.includes(group.role);

  if (entryId === NEW_ENTRY) {
    const kind = new URL(request.url).searchParams.get("kind");
    if (!isLiveEntryKind(kind) || !canWrite) throw data("Not found", { status: 404 });
    return {
      isNew: true,
      entry: {
        id: crypto.randomUUID(),
        kind,
        title: null as string | null,
        body: null as string | null,
        occurredAt: new Date().toISOString(),
        timeZone: localTimeZone(),
      },
      heading: `New ${KIND_META[kind].label.toLowerCase()}`,
      canWrite,
      hasDocument: false,
      initial: { snapshot: null, updates: [] },
      entryRows: [] as EntryRow[],
    };
  }

  const entryRows = await readRows<EntryRow>(db, { sql: entrySql, params: [entryId, groupId] });
  const entry = entryRows[0] ? toTimelineEntry(entryRows[0]) : null;
  if (!entry || !canHaveNoteDocument(entry.kind)) throw data("Not found", { status: 404 });

  const [doc] = await readRows<{ id: string; snapshot: string | null }>(db, {
    sql: "SELECT id, snapshot FROM note_document WHERE id = ?",
    params: [entryId],
  });
  const updates = doc
    ? await readRows<{ id: string; data: string | null }>(db, {
        sql: "SELECT id, data FROM note_update WHERE document_id = ?",
        params: [entryId],
      })
    : [];

  return {
    isNew: false,
    entry: { ...entry, kind: entry.kind },
    heading: entry.title || KIND_META[entry.kind].label,
    canWrite,
    hasDocument: !!doc,
    initial: { snapshot: doc?.snapshot ?? null, updates },
    // Starting rows for the live query (stable, so it doesn't reset each render).
    entryRows,
  };
}

/**
 * Live queries keep the page current, so submissions need no reload. A
 * draft never reloads in place either: that would make it a new draft.
 */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  const draft = currentUrl.pathname.endsWith(`/entries/${NEW_ENTRY}`);
  if (draft && currentUrl.href === nextUrl.href) return false;
  return defaultShouldRevalidate;
}

export default function Entry(props: Route.ComponentProps) {
  // Another entry is another page: start fresh. The draft keeps its id when saved, so it stays.
  return <EntryPage key={props.loaderData.entry.id} {...props} />;
}

function EntryPage({ loaderData, params }: Route.ComponentProps) {
  const { canWrite, initial } = loaderData;
  const { groupId } = params;
  // Read once: after sign-out closes the database, this page may render once more before it goes.
  const [db] = useState(getSync);
  const navigate = useNavigate();

  // The draft's fields, read when it's saved. The id never changes, so the
  // URL swap from `new` to the entry's own keeps this component and editor.
  const [draft] = useState(loaderData.entry);
  const [isNew] = useState(loaderData.isNew);
  const timelineUrl = `/app/groups/${groupId}/timeline`;

  // The stored entry, live: other members' renames, and deletion.
  const rows = useLiveQuery<EntryRow>(entrySql, [draft.id, groupId], loaderData.entryRows);
  const live = rows[0] ? toTimelineEntry(rows[0]) : null;
  const [seen, setSeen] = useState(!!live);
  if (live && !seen) setSeen(true);
  const deleted = seen && !live;
  const kind = live?.kind ?? draft.kind;
  const title = live ? live.title : draft.title;

  // Saving: once, on the first real change (text or a title).
  const saved = useRef(!isNew && loaderData.hasDocument);
  const titleRef = useRef(draft.title ?? "");
  // A time picked on a draft is the time it's saved with.
  const [draftOccurredAt, setDraftOccurredAt] = useState(draft.occurredAt);
  const occurredAtRef = useRef(draft.occurredAt);
  const saving = useRef<Promise<boolean> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useCallback((): Promise<boolean> => {
    if (saved.current) return Promise.resolve(true);
    saving.current ??= (async () => {
      if (!canHaveNoteDocument(draft.kind)) return false;
      const input: MaterializeInput = {
        id: draft.id,
        groupId,
        kind: draft.kind,
        title: isLiveEntryKind(draft.kind) ? savedTitle(draft.kind, titleRef.current) : draft.title,
        occurredAt: occurredAtRef.current,
        timeZone: draft.timeZone,
      };
      const res = await materializeLiveEntry(getSync(), input);
      saving.current = null;
      if (!res.ok) {
        setSaveError(res.error);
        return false;
      }
      setSaveError(null);
      saved.current = true;
      // Back from here goes to the timeline, and the link is the entry's own.
      if (isNew) void navigate(entryUrl(groupId, draft.id), { replace: true });
      return true;
    })();
    return saving.current;
  }, [draft, groupId, isNew, navigate]);

  // The editor asks on each local change until this says it's saved.
  const ensureSaved = useCallback(
    (doc: Y.Doc) => {
      if (saved.current) return Promise.resolve(true);
      // An existing entry only lacks its document: the text decides.
      const ready = shouldMaterialize({
        saved: false,
        text: noteText(doc),
        title: isNew ? titleRef.current : "",
      });
      return ready ? save() : Promise.resolve(false);
    },
    [save, isNew],
  );

  const commitTitle = (next: string) => {
    titleRef.current = next;
    // A draft's title is saved with it. (An existing entry is renamed, even one still without its document.)
    if (isNew && !saved.current) {
      if (shouldMaterialize({ saved: false, text: "", title: next })) void save();
      return;
    }
    if (!isLiveEntryKind(kind)) return;
    void updateEntry(getSync(), draft.id, { title: savedTitle(kind, next) }).then((res) => {
      setSaveError(res.ok ? null : res.error);
    });
  };

  const changeTime = (next: string) => {
    occurredAtRef.current = next;
    setDraftOccurredAt(next);
    if (!saved.current) return;
    void updateEntry(getSync(), draft.id, { occurredAt: next }).then((res) => {
      setSaveError(res.ok ? null : res.error);
    });
  };

  // Delete (⋯ menu): confirm, soft-delete, back to the timeline.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteEntry = async () => {
    setConfirmDelete(false);
    const res = await removeEntry(getSync(), draft.id);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    void navigate(timelineUrl);
  };

  const label = KIND_META[kind].label;
  const heading = title || (isNew && !live ? `New ${label.toLowerCase()}` : label);
  // Named here, by writers. An unnamed event (saved as "Event") shows an empty field asking for a title.
  const titleEditable = canWrite && isLiveEntryKind(kind) && !deleted;
  const field = isLiveEntryKind(kind) ? titleField(kind, title, !!live) : null;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <Link to={timelineUrl} className="btn btn-ghost btn-sm -ml-3 gap-1">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Timeline
      </Link>

      <h1 className="sr-only">{heading}</h1>
      <EntryHeader
        kind={kind}
        title={
          titleEditable && field ? (
            <EntryTitle value={field.value} placeholder={field.placeholder} onCommit={commitTitle} />
          ) : (
            <p aria-hidden="true" className="text-xl font-semibold break-words">
              {heading}
            </p>
          )
        }
        time={
          canWrite && !deleted ? (
            <EntryTimeChip occurredAt={live?.occurredAt ?? draftOccurredAt} onChange={changeTime} />
          ) : (
            <>
              <EntryTime occurredAt={live?.occurredAt ?? draftOccurredAt} />
              {!canWrite && " · You can view this"}
            </>
          )
        }
        // Once there's an entry to link to (not a draft): Share for everyone, the ⋯ menu for writers.
        actions={
          live && (
            <>
              <ShareButton title={heading} path={entryUrl(groupId, draft.id)} />
              {canWrite && (
                <EntryMenu
                  label={`Actions for this ${label.toLowerCase()}`}
                  onDelete={() => setConfirmDelete(true)}
                />
              )}
            </>
          )
        }
        editors={!deleted && <EditorAvatars documentId={draft.id} groupId={groupId} viewerId={db.userId} />}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete this ${label.toLowerCase()}?`}
        confirmLabel="Delete"
        onConfirm={() => void deleteEntry()}
        onClose={() => setConfirmDelete(false)}
      />
      {saveError && (
        <p role="alert" className="text-error text-sm">
          {saveError}
        </p>
      )}

      {deleted ? (
        <div role="alert" className="alert">
          <span>This entry was deleted.</span>
          <Link to={timelineUrl} className="btn btn-sm">
            Back to the timeline
          </Link>
        </div>
      ) : (
        <LiveNotesEditor
          key={draft.id}
          label={`${label} text`}
          db={db}
          documentId={draft.id}
          groupId={groupId}
          canWrite={canWrite}
          initial={initial}
          autofocus={isNew}
          ensureSaved={ensureSaved}
        />
      )}
    </main>
  );
}
