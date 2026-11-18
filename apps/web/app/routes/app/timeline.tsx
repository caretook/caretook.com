import type { Route } from "./+types/timeline";
import type { TimelineEntryKind, TimelineView, VitalType } from "@caretook/data/schema";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";
import type { TimelineEntry } from "~/lib/rpc";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryRow, GroupRow, MemberRow, ReadingRow } from "~/lib/sync/timeline";

import { DEFAULT_UNITS, unitChoicesZSchema } from "@caretook/data/schema";
import { useCallback, useMemo, useState } from "react";
import { data, useFetcher, useNavigate } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { EntryForm } from "~/components/EntryForm";
import { EntrySheet } from "~/components/EntrySheet";
import { LatestVitals } from "~/components/LatestVitals";
import { QuickAddBar } from "~/components/QuickAddBar";
import { KindFilter, ViewToggle } from "~/components/TimelineFilters";
import { TimelineEntryCard } from "~/components/TimelineEntryCard";
import { TimelineEntryRow } from "~/components/TimelineEntryRow";
import { isEntryKind, KIND_META } from "~/lib/entryDisplay";
import { entryContentFromForm, entryUpdateFromForm } from "~/lib/entryForm";
import { formString } from "~/lib/form";
import { entryUrl, isLiveEntryKind, newEntryUrl } from "~/lib/liveEntry";
import { dayKey, formatDay } from "~/lib/format";
import { cacheSettings, loadSettings } from "~/lib/me";
import { rpc } from "~/lib/rpc";
import { requireSession } from "~/lib/session";
import { getSync, useLiveQuery, waitForFirstSync } from "~/lib/sync";
import { groupDocumentsQuery, toPreviews } from "~/lib/sync/notes";
import {
  createEntry,
  entriesQuery,
  membersQuery,
  myGroupsQuery,
  readingsQuery,
  readRows,
  removeEntry,
  toLatestVitals,
  toMember,
  toMyGroup,
  toTimelineEntries,
  updateEntry,
  WRITER_ROLES,
} from "~/lib/sync/timeline";

// Shared by web + native. Reads and writes go to the device's local copy
// (PowerSync), so the timeline works offline and other members' changes
// appear as they sync. Only settings come from the API (cached offline).

const PAGE_SIZE = 30;

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData ? `${loaderData.groupRow.name ?? "Timeline"} · Caretook` : "Timeline · Caretook" },
  ];
}

/** `?kind=symptom` shows one kind; anything else shows them all. */
const kindFilter = (request: Request) => {
  const kind = new URL(request.url).searchParams.get("kind");
  return isEntryKind(kind) ? kind : null;
};

/**
 * The first screenful, read locally so the page renders complete; live
 * queries in the component take over from there. A group that isn't on the
 * device (not a member, or removed) is a 404.
 */
export async function clientLoader({ request, params }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  const { db } = await requireSession(request);
  await waitForFirstSync(db);
  const kind = kindFilter(request);

  const groups = await readRows<GroupRow>(db, myGroupsQuery(db.userId));
  const groupRow = groups.find((g) => g.id === groupId);
  if (!groupRow) throw data("Not found", { status: 404 });

  const [entryRows, memberRows, readingRows, documentRows, settings] = await Promise.all([
    readRows<EntryRow>(db, entriesQuery(groupId, kind, PAGE_SIZE)),
    readRows<MemberRow>(db, membersQuery(groupId)),
    readRows<ReadingRow>(db, readingsQuery(groupId)),
    readRows<NoteDocRow>(db, groupDocumentsQuery(groupId)),
    loadSettings(request, db.userId),
  ]);
  return {
    userId: db.userId,
    groupRow,
    groups,
    entryRows,
    memberRows,
    readingRows,
    documentRows,
    ...settings,
    kind,
  };
}

/** Writes go to the local database; live queries show them at once and PowerSync uploads them. */
export async function clientAction({ request, params }: Route.ClientActionArgs): Promise<ActionResult> {
  const form = await request.formData();
  const intent = formString(form, "intent");
  const id = formString(form, "id");
  // The units the form displayed, so vitals convert back the way they were typed.
  const units = parseUnits(formString(form, "units"));
  const db = getSync();
  if (intent === "create") return createEntry(db, params.groupId, entryContentFromForm(form, units));
  if (intent === "update") return updateEntry(db, id, entryUpdateFromForm(form, units));
  if (intent === "remove") return removeEntry(db, id);
  throw new Error(`Unknown intent: ${intent}`);
}

/**
 * Live queries already reflect every write, so a submission doesn't rerun
 * the loader (that would reset "Show older"). Navigation (a new filter) does.
 */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod ? false : defaultShouldRevalidate;
}

const parseUnits = (json: string) => {
  try {
    const parsed = unitChoicesZSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : DEFAULT_UNITS;
  } catch {
    return DEFAULT_UNITS;
  }
};

/** Consecutive entries grouped by the viewer's calendar day. */
const byDay = (entries: TimelineEntry[]) => {
  const days: { key: string; label: string; entries: TimelineEntry[] }[] = [];
  for (const entry of entries) {
    const key = dayKey(entry.occurredAt);
    const last = days.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, label: formatDay(entry.occurredAt), entries: [entry] });
  }
  return days;
};

/** What the entry sheet is showing: a new entry of some kind, or an edit. */
type SheetContent =
  { mode: "add"; kind: TimelineEntryKind; vitalType?: VitalType } | { mode: "edit"; entry: TimelineEntry };
type SheetState = SheetContent & { key: number };

export default function Timeline({ loaderData, params }: Route.ComponentProps) {
  const { userId, units, kind } = loaderData;
  const { groupId } = params;

  // "Show older" grows the local query's limit. A new filter starts over.
  const [paging, setPaging] = useState({ kind, limit: PAGE_SIZE });
  const limit = paging.kind === kind ? paging.limit : PAGE_SIZE;

  const groupsQuery = myGroupsQuery(userId);
  const groupRows = useLiveQuery<GroupRow>(groupsQuery.sql, groupsQuery.params, loaderData.groups);
  const groupRow = groupRows.find((g) => g.id === groupId) ?? loaderData.groupRow;
  const group = toMyGroup(groupRow);

  const entriesSql = entriesQuery(groupId, kind, limit);
  const entryRows = useLiveQuery<EntryRow>(entriesSql.sql, entriesSql.params, loaderData.entryRows);
  const membersSql = membersQuery(groupId);
  const members = useLiveQuery<MemberRow>(membersSql.sql, membersSql.params, loaderData.memberRows).map(
    toMember,
  );
  const readingsSql = readingsQuery(groupId);
  const latestVitals = toLatestVitals(
    useLiveQuery<ReadingRow>(readingsSql.sql, readingsSql.params, loaderData.readingRows),
  );

  // Live documents, with previews rebuilt locally (they include unsynced edits).
  const documentsSql = groupDocumentsQuery(groupId);
  const documentRows = useLiveQuery<NoteDocRow>(
    documentsSql.sql,
    documentsSql.params,
    loaderData.documentRows,
  );
  const previews = useMemo(() => toPreviews(documentRows), [documentRows]);
  const navigate = useNavigate();
  const openEntry = (entry: TimelineEntry) => void navigate(entryUrl(groupId, entry.id));

  const canWrite = !!group.role && WRITER_ROLES.includes(group.role);
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? "Former member";

  // The layout is a per-user setting. It switches at once; saving it is best
  // effort (if it fails, the next visit shows the old layout).
  const [view, setView] = useState<TimelineView>(loaderData.timelineView);
  const changeView = (next: TimelineView) => {
    setView(next);
    cacheSettings(userId, { timelineView: next });
    rpc.me.updatePreferences({ timelineView: next }).catch(() => undefined);
  };

  // One sheet for adding and editing. `key` remounts the form each time it
  // opens, so it starts empty, with "When" set to now.
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = (next: SheetContent) => {
    setSheet({ ...next, key: Date.now() });
    setSheetOpen(true);
  };
  const closeSheet = useCallback(() => setSheetOpen(false), [setSheetOpen]);

  // One delete confirm for the whole list.
  const [deleting, setDeleting] = useState<TimelineEntry | null>(null);
  const remover = useFetcher();
  const removingId = remover.state !== "idle" ? remover.formData?.get("id") : null;

  // The query asks for one extra row: if it came back, there's more to show.
  const hasOlder = entryRows.length > limit;
  // A note's text is its live document: its preview is the note's body.
  const entries = toTimelineEntries(entryRows.slice(0, limit)).map((entry) =>
    entry.kind === "note" ? { ...entry, body: previews.get(entry.id) || null } : entry,
  );
  const days = byDay(entries);
  const Entry = view === "cards" ? TimelineEntryCard : TimelineEntryRow;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{group.recipient?.displayName ?? group.name}</h1>
          <p className="text-base-content/70 text-sm">
            {group.name}
            {group.role === "viewer" && " · You can view this timeline"}
          </p>
        </div>
        <ViewToggle view={view} onChange={changeView} />
      </header>

      <LatestVitals vitals={latestVitals} units={units} />

      {canWrite && (
        <QuickAddBar
          onAdd={(k, vitalType) => openSheet({ mode: "add", kind: k, vitalType })}
          hrefFor={(k) => (isLiveEntryKind(k) ? newEntryUrl(groupId, k) : undefined)}
        />
      )}

      <KindFilter kind={kind} />

      <section aria-labelledby="timeline-heading" className="space-y-4">
        <h2 id="timeline-heading" className="sr-only">
          Timeline
        </h2>
        {days.length === 0 && (
          <p className="text-base-content/70">
            {kind
              ? `No ${KIND_META[kind].plural.toLowerCase()} on the timeline yet.`
              : "Nothing on the timeline yet."}
          </p>
        )}
        {days.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`}>
            <h3
              id={`day-${day.key}`}
              className="bg-base-200/95 text-base-content/70 sticky top-0 z-10 -mx-1 px-1 py-2 text-xs font-semibold tracking-wide uppercase backdrop-blur"
            >
              {day.label}
            </h3>
            <ol
              className={
                view === "cards"
                  ? "space-y-2"
                  : "rounded-box border-base-300 bg-base-100 divide-base-200 divide-y border"
              }
            >
              {day.entries.map((entry) => (
                <Entry
                  key={entry.id}
                  entry={entry}
                  authorName={nameOf(entry.createdBy)}
                  units={units}
                  removing={removingId === entry.id}
                  onEdit={
                    !canWrite
                      ? undefined
                      : isLiveEntryKind(entry.kind)
                        ? () => openEntry(entry) // edited in its own editor
                        : () => openSheet({ mode: "edit", entry })
                  }
                  onDelete={canWrite ? () => setDeleting(entry) : undefined}
                  // Events still show their live notes separately (until slice 2).
                  liveNotes={
                    entry.kind === "event" && previews.has(entry.id)
                      ? { preview: previews.get(entry.id) ?? "", url: entryUrl(groupId, entry.id) }
                      : null
                  }
                  onLiveNotes={canWrite && entry.kind === "event" ? () => openEntry(entry) : undefined}
                />
              ))}
            </ol>
          </section>
        ))}

        {hasOlder && (
          <button
            type="button"
            className="btn btn-block"
            onClick={() => setPaging({ kind, limit: limit + PAGE_SIZE })}
          >
            Show older entries
          </button>
        )}
      </section>

      {canWrite && sheet && (
        <EntrySheet
          isOpen={sheetOpen}
          onOpenChange={setSheetOpen}
          title={
            sheet.mode === "edit"
              ? `Edit ${KIND_META[sheet.entry.kind].label.toLowerCase()}`
              : "Add to the timeline"
          }
        >
          {sheet.mode === "edit" ? (
            <EntryForm
              key={sheet.key}
              entry={sheet.entry}
              units={units}
              onDone={closeSheet}
              onCancel={closeSheet}
            />
          ) : (
            <EntryForm
              key={sheet.key}
              units={units}
              initialKind={sheet.kind}
              initialVitalType={sheet.vitalType}
              onDone={closeSheet}
              onCancel={closeSheet}
            />
          )}
        </EntrySheet>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete this entry?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void remover.submit({ intent: "remove", id: deleting.id }, { method: "post" });
          setDeleting(null);
        }}
      />
    </main>
  );
}
