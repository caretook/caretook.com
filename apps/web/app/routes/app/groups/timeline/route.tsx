import type { Route } from "./+types/route";
import type { TimelineView } from "@caretook/data/schema";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";
import type { TimelineEntry } from "~/lib/rpc";
import type { NoteDocRow } from "~/lib/sync/notes";
import type { EntryRow, MemberRow, ReadingRow } from "~/lib/sync/timeline";
import type { TimelineOutlet } from "./sheet";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { useMemo, useState } from "react";
import { Outlet, PrefetchPageLinks, useFetcher, useLocation, useNavigate } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { appUrls } from "~/lib/appUrls";
import { isEntryKind, KIND_META } from "~/lib/entryDisplay";
import { formString } from "~/lib/form";
import { dayKey, dayLabel, localTimeZone } from "~/lib/format";
import { getGroup, useGroup } from "~/lib/group";
import { isLiveEntryKind } from "~/lib/liveEntry";
import { liveDotLabel } from "~/lib/liveNow";
import { loadSettings, saveSettings } from "~/lib/me";
import { sessionContext } from "~/lib/session";
import { parseFilters } from "~/lib/timelineFilters";
import { useLiveQuery } from "~/lib/sync";
import { useLiveDocuments } from "~/lib/sync/editors";
import { groupDocumentsQuery, toPreviews } from "~/lib/sync/notes";
import {
  entriesQuery,
  membersQuery,
  readingsQuery,
  readRows,
  removeEntry,
  toLatestVitals,
  toMember,
  toTimelineEntries,
} from "~/lib/sync/timeline";
import { LatestVitals } from "./LatestVitals";
import { LiveNowBanner } from "./LiveNowBanner";
import { QuickAddBar } from "./QuickAddBar";
import { SHEET_LINK_STATE } from "./sheet";
import { onlySheetChanged } from "./sheetGuard";
import { KindFilter, ViewToggle } from "./TimelineFilters";
import { TimelineEntryCard } from "./TimelineEntryCard";
import { TimelineEntryRow } from "./TimelineEntryRow";

// Shared by web + native. Reads and writes go to the device's local copy
// (PowerSync), so the timeline works offline and other members' changes
// appear as they sync. Only settings come from the API (cached offline).

const PAGE_SIZE = 30;

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.groupName || "Timeline"} · Caretook` : "Timeline · Caretook" }];
}

/** `?kind=symptom` shows one kind; anything else shows them all. */
const kindFilter = (request: Request) => parseFilters(new URL(request.url).search).kind;

/**
 * The first screenful, read locally so the page renders complete; live
 * queries in the component take over from there. The group itself comes from
 * the group route (which has already turned away a group not on the device).
 */
export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const kind = kindFilter(request);

  const [entryRows, memberRows, readingRows, documentRows, settings] = await Promise.all([
    readRows<EntryRow>(db, entriesQuery(groupId, kind, PAGE_SIZE)),
    readRows<MemberRow>(db, membersQuery(groupId)),
    readRows<ReadingRow>(db, readingsQuery(groupId)),
    readRows<NoteDocRow>(db, groupDocumentsQuery(groupId)),
    loadSettings(request, db.userId),
  ]);
  return {
    userId: db.userId,
    groupName: group.name,
    entryRows,
    memberRows,
    readingRows,
    documentRows,
    ...settings,
    kind,
  };
}

/**
 * Deletes go to the local database; live queries show them at once and
 * PowerSync uploads them. (Adding and editing are the sheets':
 * `new/route.tsx` and `edit/route.tsx`.)
 */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  const intent = formString(form, "intent");
  const id = formString(form, "id");
  if (intent === "remove") return removeEntry(db, id);
  throw new Error(`Unknown intent: ${intent}`);
}

/**
 * Live queries already reflect every write, so a submission doesn't rerun
 * the loader (that would reset "Show older"), and neither does opening or
 * closing a sheet over the timeline. Other navigation (a new filter) does.
 */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  if (nextParams.groupId && onlySheetChanged(nextParams.groupId, currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
}

/** Consecutive entries grouped by the viewer's calendar day. */
const byDay = (entries: TimelineEntry[]) => {
  const days: { key: string; label: string; entries: TimelineEntry[] }[] = [];
  const timeZone = localTimeZone();
  const now = new Date();
  for (const entry of entries) {
    const key = dayKey(entry.occurredAt);
    const last = days.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, label: dayLabel(entry.occurredAt, timeZone, now), entries: [entry] });
  }
  return days;
};

export default function Timeline({ loaderData, params }: Route.ComponentProps) {
  const { userId, units, kind } = loaderData;
  const { groupId } = params;

  // "Show older" grows the local query's limit. A new filter starts over.
  const [paging, setPaging] = useState({ kind, limit: PAGE_SIZE });
  const limit = paging.kind === kind ? paging.limit : PAGE_SIZE;

  const group = useGroup();

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

  const { canWrite } = group;
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? "Former member";

  // Notes and events other members are writing in now: the Live now banner and the rows' live dots.
  const liveDocuments = useLiveDocuments(
    groupId,
    userId,
    (row) => row.title?.trim() || (isEntryKind(row.kind) ? KIND_META[row.kind].label : "Entry"),
  );
  const liveLabels = new Map(
    liveDocuments.map((d) => [d.id, liveDotLabel(d.editors.map((e) => nameOf(e.userId)))]),
  );

  // The layout is a per-user setting. It switches at once; offline, it's
  // saved on the next online visit (see `saveSettings`).
  const [view, setView] = useState<TimelineView>(loaderData.timelineView);
  const changeView = (next: TimelineView) => {
    setView(next);
    saveSettings(userId, { timelineView: next }).catch(() => undefined);
  };

  // The sheets' links (`new/:kind`, `:entryId/edit`) carry the filters, and come back to them.
  const { search } = useLocation();
  const navigate = useNavigate();
  const editUrl = (entry: TimelineEntry) => appUrls.editSheet(groupId, entry.id, { search });
  const openEdit = (entry: TimelineEntry) =>
    void navigate(editUrl(entry), { state: SHEET_LINK_STATE, preventScrollReset: true });

  // One delete confirm for the whole list.
  const [deleting, setDeleting] = useState<TimelineEntry | null>(null);
  const remover = useFetcher();
  const removingId = remover.state !== "idle" ? remover.formData?.get("id") : null;

  // The query asks for one extra row: if it came back, there's more to show.
  const hasOlder = entryRows.length > limit;
  // A note's or event's text is its live document: its preview is the body.
  const entries = toTimelineEntries(entryRows.slice(0, limit)).map((entry) =>
    isLiveEntryKind(entry.kind) ? { ...entry, body: previews.get(entry.id) || null } : entry,
  );
  const days = byDay(entries);
  const Entry = view === "cards" ? TimelineEntryCard : TimelineEntryRow;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{group.displayName}</h1>
          <p className="text-base-content/70 text-sm">
            {group.name}
            {group.role === "viewer" && " · You can view this timeline"}
          </p>
        </div>
        <ViewToggle view={view} onChange={changeView} />
      </header>

      <LatestVitals vitals={latestVitals} units={units} />

      <LiveNowBanner documents={liveDocuments} groupId={groupId} nameOf={nameOf} />

      {canWrite && (
        <QuickAddBar
          newEntryUrl={(k) => appUrls.newEntry(groupId, k)}
          newSheetUrl={(k, type) => appUrls.newSheet(groupId, k, { type, search })}
          sheetLinkState={SHEET_LINK_STATE}
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
              className="bg-base-200/95 text-base-content sticky top-0 z-10 -mx-1 px-1 py-2 text-base font-semibold backdrop-blur lg:text-lg"
            >
              {day.label}
            </h3>
            <ol
              className={
                view === "cards"
                  ? "space-y-2"
                  : "rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border"
              }
            >
              {day.entries.map((entry) => (
                <Entry
                  key={entry.id}
                  entry={entry}
                  authorName={nameOf(entry.createdBy)}
                  units={units}
                  removing={removingId === entry.id}
                  // Notes and events open their page, for viewers too; symptoms and vitals open the edit sheet.
                  open={
                    canHaveNoteDocument(entry.kind)
                      ? { to: appUrls.entry(groupId, entry.id) }
                      : canWrite
                        ? { to: editUrl(entry), edit: true, state: SHEET_LINK_STATE }
                        : undefined
                  }
                  onEdit={canWrite && !canHaveNoteDocument(entry.kind) ? () => openEdit(entry) : undefined}
                  onDelete={canWrite ? () => setDeleting(entry) : undefined}
                  liveLabel={liveLabels.get(entry.id)}
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

      {/* The sheets (`new/:kind`, `:entryId/edit`), over the timeline. */}
      <Outlet context={{ units } satisfies TimelineOutlet} />
      {/* The edit sheet's route module, fetched now so a row opens it offline (one link for every row). */}
      {canWrite && <PrefetchPageLinks page={appUrls.editSheet(groupId, "prefetch")} />}

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
