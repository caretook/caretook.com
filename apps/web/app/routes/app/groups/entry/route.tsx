import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { LiveNotesEditorHandle } from "~/components/notes";

import { useRef, useState } from "react";
import { Link } from "react-router";
import { EditorAvatars, LiveNotesEditor } from "~/components/notes";
import { LinkedTasks } from "~/components/tasks";
import { BackLink } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { START_AT_PARAM } from "~/lib/timeline/urls";
import { WHEN_PARAM, WITH_PROVIDER_PARAM } from "~/lib/live-notes/urls";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { getGroup } from "~/lib/app-shell/group";
import { NEW_ENTRY } from "~/lib/live-notes/liveEntry";
import { sessionContext } from "~/lib/auth/session";
import { getSync } from "~/lib/sync";
import { EntryCancelledBanner } from "./EntryCancelledBanner";
import { EntryPageHeader } from "./EntryPageHeader";
import { EntryPrintView } from "./EntryPrintView";
import { EntryVisitPrep } from "./EntryVisitPrep";
import { entryHeading, titleState } from "./entryPage";
import { loadEntry } from "./loadEntry";
import { useEntryMentions } from "./useEntryMentions";
import { useEntryPrint, usePrintOnOpen } from "./useEntryPrint";
import { useLiveEntry } from "./useLiveEntry";

// Shared by web + native. A note (or event) is its live document: this page
// is where it's written, by several people at once (Yjs), offline included.
// Everything is local; edits sync through PowerSync like the rest of the
// timeline. `/entries/new?kind=note|event` is a draft: the same route, so the
// editor stays mounted when it's saved (see useLiveEntry).

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.heading} · Caretook` : "Caretook" }];
}

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const { canWrite } = getGroup(context);
  const { db } = context.get(sessionContext);
  const search = new URL(request.url).searchParams;
  return loadEntry(db, {
    groupId: params.groupId,
    entryId: params.entryId,
    kind: search.get("kind"),
    when: search.get(WHEN_PARAM),
    withProvider: search.get(WITH_PROVIDER_PARAM),
    at: search.get(START_AT_PARAM),
    canWrite,
  });
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
  const { groupId } = params;
  const live = useLiveEntry(loaderData, groupId);
  const { entry, canWrite, deleted, saveError } = live;
  // Read once: after sign-out closes the database, this page may render once more before it goes.
  const [db] = useState(getSync);
  const editor = useRef<LiveNotesEditorHandle>(null);
  const timelineUrl = appUrls.timeline(groupId);
  const printed = useEntryPrint(entry.id, loaderData.initial);
  usePrintOnOpen();
  // A mention in the text links the provider, as the With row does.
  const mentions = useEntryMentions({ groupId, entryId: entry.id, ensureStored: live.ensureStored });

  const label = KIND_META[entry.kind].label;
  const heading = entryHeading(label, entry.title, live.isNew && !live.stored);
  const title = titleState({ kind: entry.kind, title: entry.title, saved: live.stored, canWrite, deleted });

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 print:p-0">
      <BackLink to={timelineUrl} label="Timeline" className="print:hidden" />

      <h1 className="sr-only">{heading}</h1>
      <div className="space-y-4 print:hidden">
        <EntryPageHeader
          live={live}
          groupId={groupId}
          heading={heading}
          title={title}
          pickDay={loaderData.pickDay}
          onPickTitle={(next) => {
            live.commitTitle(next);
            editor.current?.focus();
          }}
          editors={!deleted && <EditorAvatars documentId={entry.id} groupId={groupId} viewerId={db.userId} />}
        />
        {!deleted && (
          <EntryCancelledBanner
            groupId={groupId}
            cancelledAt={entry.cancelledAt}
            cancelledBy={entry.cancelledBy}
            cancelReason={entry.cancelReason}
            rescheduledTo={entry.rescheduledTo}
            onUndo={canWrite ? live.uncancel : undefined}
          />
        )}
        <EntryVisitPrep live={live} groupId={groupId} />
        {(saveError || mentions.error) && (
          <p role="alert" className="text-error text-sm">
            {saveError || mentions.error}
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
          <>
            {entry.rescheduledTo && (
              <h2 className="text-base-content/70 text-sm font-semibold" data-earlier-notes>
                Earlier notes (read-only: they carry on in the new event)
              </h2>
            )}
            <LiveNotesEditor
              key={entry.id}
              ref={editor}
              label={`${label} text`}
              db={db}
              documentId={entry.id}
              groupId={groupId}
              // A rescheduled event's notes carried on in the new one: these stay as they were.
              canWrite={canWrite && !entry.rescheduledTo}
              initial={loaderData.initial}
              autofocus={live.isNew && !loaderData.pickDay}
              ensureSaved={live.ensureSaved}
              providers={mentions.providers}
              onMention={mentions.onMention}
            />
            {entry.kind === "event" && live.stored && <LinkedTasks link={{ eventId: entry.id }} />}
          </>
        )}
      </div>
      {!deleted && live.stored && (
        <EntryPrintView heading={heading} kindLabel={label} entry={entry} {...printed} />
      )}
    </main>
  );
}
