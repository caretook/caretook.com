import type { Route } from "./+types/timeline";
import type { ActionResult } from "~/lib/api";
import type { TimelineEntry } from "~/lib/rpc";

import { useState } from "react";
import { data } from "react-router";
import { EntryForm } from "~/components/EntryForm";
import { TimelineEntryCard } from "~/components/TimelineEntryCard";
import { load, toActionResult } from "~/lib/api";
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

export async function clientLoader({ request, params }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  const [groups, page, members] = await Promise.all([
    load(request, rpc.careGroup.listMine()),
    load(request, rpc.timeline.list({ groupId, limit: PAGE_SIZE })),
    load(request, rpc.careGroup.members({ groupId })),
  ]);
  const group = groups.find((g) => g.id === groupId);
  if (!group) throw data("Not found", { status: 404 });
  return { group, page, members };
}

export async function clientAction({ request, params }: Route.ClientActionArgs): Promise<ActionResult> {
  const form = await request.formData();
  const intent = formString(form, "intent");
  const id = formString(form, "id");
  try {
    if (intent === "create")
      await rpc.timeline.create({ groupId: params.groupId, ...entryContentFromForm(form) });
    else if (intent === "update") await rpc.timeline.update({ id, data: entryUpdateFromForm(form) });
    else if (intent === "remove") await rpc.timeline.remove({ id });
    else throw new Error(`Unknown intent: ${intent}`);
    return { ok: true };
  } catch (e) {
    return toActionResult(e);
  }
}

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

export default function Timeline({ loaderData, params }: Route.ComponentProps) {
  const { group, page, members } = loaderData;
  const canWrite = !!group.role && WRITERS.includes(group.role);
  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.name ?? "Former member";

  // Older pages loaded with "Show older". Reset whenever the loader reruns
  // (after any change), so the list never shows stale entries.
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
      const next = await rpc.timeline.list({ groupId: params.groupId, limit: PAGE_SIZE, cursor });
      setOlder((prev) => [...prev, ...next.data]);
      setCursor(next.nextCursor);
    } catch {
      setLoadError("Couldn't load older entries. Try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  const entries = [...page.data, ...older];
  const days = byDay(entries);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">{group.recipient?.displayName ?? group.name}</h1>
        <p className="text-base-content/70 text-sm">
          {group.name}
          {group.role === "viewer" && " · You can view this timeline"}
        </p>
      </header>

      {canWrite && (
        <section aria-labelledby="add-entry" className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 id="add-entry" className="card-title text-lg">
              Add to the timeline
            </h2>
            <EntryForm />
          </div>
        </section>
      )}

      <section aria-labelledby="timeline-heading" className="space-y-6">
        <h2 id="timeline-heading" className="sr-only">
          Timeline
        </h2>
        {days.length === 0 && <p className="text-base-content/70">Nothing on the timeline yet.</p>}
        {days.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`} className="space-y-2">
            <h3
              id={`day-${day.key}`}
              className="text-base-content/70 text-sm font-semibold uppercase tracking-wide"
            >
              {day.label}
            </h3>
            <ol className="space-y-2">
              {day.entries.map((entry) => (
                <TimelineEntryCard
                  key={entry.id}
                  entry={entry}
                  authorName={nameOf(entry.createdBy)}
                  canWrite={canWrite}
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
    </main>
  );
}
