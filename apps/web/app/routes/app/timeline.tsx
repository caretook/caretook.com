import type { Route } from "./+types/timeline";
import type { TimelineEntryKind, TimelineView, VitalType } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/api";
import type { TimelineEntry } from "~/lib/rpc";

import { DEFAULT_UNITS, unitChoicesZSchema } from "@caretook/data/schema";
import { useCallback, useState } from "react";
import { data, useFetcher } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { EntryForm } from "~/components/EntryForm";
import { EntrySheet } from "~/components/EntrySheet";
import { LatestVitals } from "~/components/LatestVitals";
import { QuickAddBar } from "~/components/QuickAddBar";
import { KindFilter, ViewToggle } from "~/components/TimelineFilters";
import { TimelineEntryCard } from "~/components/TimelineEntryCard";
import { TimelineEntryRow } from "~/components/TimelineEntryRow";
import { load, toActionResult } from "~/lib/api";
import { isEntryKind, KIND_META } from "~/lib/entryDisplay";
import { entryContentFromForm, entryUpdateFromForm } from "~/lib/entryForm";
import { formString } from "~/lib/form";
import { dayKey, formatDay } from "~/lib/format";
import { rpc } from "~/lib/rpc";

// Shared by web + native: client-only data (clientLoader/clientAction over oRPC).

const PAGE_SIZE = 30;
const WRITERS = ["owner", "admin", "caretaker"];

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.group.name} · Caretook` : "Timeline · Caretook" }];
}

/** `?kind=symptom` shows one kind; anything else shows them all. */
const kindFilter = (request: Request) => {
  const kind = new URL(request.url).searchParams.get("kind");
  return isEntryKind(kind) ? kind : null;
};

export async function clientLoader({ request, params }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  const kind = kindFilter(request);
  const kinds = kind ? [kind] : undefined;
  const [groups, page, members, me, latestVitals] = await Promise.all([
    load(request, rpc.careGroup.listMine()),
    load(request, rpc.timeline.list({ groupId, kinds, limit: PAGE_SIZE })),
    load(request, rpc.careGroup.members({ groupId })),
    load(request, rpc.me.get()),
    load(request, rpc.timeline.latestVitals({ groupId })),
  ]);
  const group = groups.find((g) => g.id === groupId);
  if (!group) throw data("Not found", { status: 404 });
  return { group, page, members, units: me.units, timelineView: me.timelineView, latestVitals, kind };
}

export async function clientAction({ request, params }: Route.ClientActionArgs): Promise<ActionResult> {
  const form = await request.formData();
  const intent = formString(form, "intent");
  const id = formString(form, "id");
  // The units the form displayed, so vitals convert back the way they were typed.
  const units = parseUnits(formString(form, "units"));
  try {
    if (intent === "create")
      await rpc.timeline.create({ groupId: params.groupId, ...entryContentFromForm(form, units) });
    else if (intent === "update") await rpc.timeline.update({ id, data: entryUpdateFromForm(form, units) });
    else if (intent === "remove") await rpc.timeline.remove({ id });
    else throw new Error(`Unknown intent: ${intent}`);
    return { ok: true };
  } catch (e) {
    return toActionResult(e);
  }
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
  const { group, page, members, units, latestVitals, kind } = loaderData;
  const canWrite = !!group.role && WRITERS.includes(group.role);
  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.name ?? "Former member";

  // The layout is a per-user setting. It switches at once; saving it is best
  // effort (if it fails, the next visit shows the old layout).
  const [view, setView] = useState<TimelineView>(loaderData.timelineView);
  const changeView = (next: TimelineView) => {
    setView(next);
    rpc.me.updatePreferences({ timelineView: next }).catch(() => undefined);
  };

  // Older pages loaded with "Show older". Reset whenever the loader reruns
  // (after any change, or a new filter), so the list never shows stale entries.
  const [firstPage, setFirstPage] = useState(page);
  const [older, setOlder] = useState<TimelineEntry[]>([]);
  const [cursor, setCursor] = useState(page.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  if (page !== firstPage) {
    setFirstPage(page);
    setOlder([]);
    setCursor(page.nextCursor);
  }

  const loadOlder = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const next = await rpc.timeline.list({
        groupId: params.groupId,
        kinds: kind ? [kind] : undefined,
        limit: PAGE_SIZE,
        cursor,
      });
      setOlder((prev) => [...prev, ...next.data]);
      setCursor(next.nextCursor);
    } catch {
      setLoadError("Couldn't load older entries. Try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  // One sheet for adding and editing. `key` remounts the form each time it
  // opens, so it starts empty, with "When" set to now.
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = (next: SheetContent) => {
    setSheet({ ...next, key: Date.now() });
    setSheetOpen(true);
  };
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // One delete confirm for the whole list.
  const [deleting, setDeleting] = useState<TimelineEntry | null>(null);
  const remover = useFetcher();
  const removingId = remover.state !== "idle" ? remover.formData?.get("id") : null;

  const entries = [...page.data, ...older];
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

      {canWrite && <QuickAddBar onAdd={(k, vitalType) => openSheet({ mode: "add", kind: k, vitalType })} />}

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
                  onEdit={canWrite ? () => openSheet({ mode: "edit", entry }) : undefined}
                  onDelete={canWrite ? () => setDeleting(entry) : undefined}
                />
              ))}
            </ol>
          </section>
        ))}

        {loadError && (
          <p role="alert" className="text-error text-sm">
            {loadError}
          </p>
        )}
        {cursor && (
          <button
            type="button"
            className="btn btn-block"
            disabled={loadingMore}
            onClick={() => void loadOlder()}
          >
            {loadingMore ? "Loading…" : "Show older entries"}
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
