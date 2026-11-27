import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { LiveNotesEditorHandle } from "~/components/notes";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { EditorAvatars, LiveNotesEditor } from "~/components/notes";
import { BackLink, Message, Notice, Page, TITLE_SUB } from "~/components/ui";
import { START_AT_PARAM } from "~/lib/timeline/urls";
import { WHEN_PARAM, WITH_PROVIDER_PARAM } from "~/lib/live-notes/urls";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { NEW_ENTRY } from "~/lib/live-notes/liveEntry";
import { sessionContext } from "~/lib/auth/session";
import { getSync } from "~/lib/sync";
import { eventDraftFrom } from "~/lib/assistant/quickEntryDraft";
import { EntryCancelledBanner } from "./EntryCancelledBanner";
import { EntryPageHeader } from "./EntryPageHeader";
import { EntryPrintView } from "./EntryPrintView";
import { EntryTodos } from "./EntryTodos";
import { EntryVisitPrep } from "./EntryVisitPrep";
import { entryTiming } from "~/lib/appointments/upcoming";
import { entryHeading, titleState, withEventDraft } from "./entryPage";
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
  const { canLog } = getGroup(context);
  const { db } = context.get(sessionContext);
  const search = new URL(request.url).searchParams;
  return loadEntry(db, {
    groupId: params.groupId,
    entryId: params.entryId,
    kind: search.get("kind"),
    when: search.get(WHEN_PARAM),
    withProvider: search.get(WITH_PROVIDER_PARAM),
    at: search.get(START_AT_PARAM),
    canLog,
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

function EntryPage({ loaderData: loaded, params }: Route.ComponentProps) {
  const { groupId } = params;
  // A new event opened from quick entry starts from its draft (history state, read once).
  const location = useLocation();
  const [eventDraft] = useState(() => eventDraftFrom(location.state as unknown));
  const loaderData = useMemo(() => withEventDraft(loaded, eventDraft), [loaded, eventDraft]);
  const live = useLiveEntry(loaderData, groupId);
  const { entry, canWrite, deleted, saveError } = live;
  const { easyRole } = useGroup();
  // Read once: after sign-out closes the database, this page may render once more before it goes.
  const [db] = useState(getSync);
  const editor = useRef<LiveNotesEditorHandle>(null);
  const printed = useEntryPrint(entry.id, loaderData.initial);
  usePrintOnOpen();
  // A mention in the text links the provider, as the With row does.
  const mentions = useEntryMentions({ groupId, entryId: entry.id, ensureStored: live.ensureStored });

  const label = KIND_META[entry.kind].label;
  // When it was opened is enough: the heading only names an unnamed event's side of now.
  const [openedAt] = useState(() => new Date());
  const timing = entry.kind === "event" ? entryTiming(entry, openedAt) : undefined;
  const heading = entryHeading(label, entry.title, live.isNew && !live.stored, timing);
  const title = titleState({ kind: entry.kind, title: entry.title, saved: live.stored, canWrite, deleted });

  return (
    <Page className="print:p-0">
      <BackLink
        to={live.back.to}
        label={live.back.label}
        // Decided on leaving (B-690): a time edited here counts, and Back to the opener is a history step.
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          live.leave();
        }}
        className="print:hidden"
      />

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
            onUndo={live.canSetUp ? live.uncancel : undefined}
          />
        )}
        <EntryVisitPrep live={live} groupId={groupId} />
        {(saveError || mentions.error) && <Message tone="error">{saveError || mentions.error}</Message>}

        {deleted ? (
          <Notice
            tone="error"
            action={{
              label: `Back to the ${live.back.label === "Planner" ? "Planner" : live.back.label.toLowerCase()}`,
              to: live.back.to,
            }}
          >
            This entry was deleted.
          </Notice>
        ) : (
          <>
            {entry.rescheduledTo && (
              <h2 className={`text-muted ${TITLE_SUB}`} data-earlier-notes>
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
              // Mentions link providers, which only writers do: an Easy helper types plain text.
              providers={canWrite && !live.canSetUp ? undefined : mentions.providers}
              onMention={mentions.onMention}
              onAdd={mentions.onAdd}
              onImport={mentions.onImport}
              // The easy roles can't open a provider's page.
              linkMentions={!easyRole}
              // B-765: the same editor full screen, for a long note; readers too.
              fullScreen={{
                title: heading,
                aside: <EditorAvatars documentId={entry.id} groupId={groupId} viewerId={db.userId} />,
              }}
            />
            {/* Notes and events link todos (planner-3); other kinds have no page here. */}
            {live.stored && canHaveNoteDocument(entry.kind) && (
              <EntryTodos entryId={entry.id} kind={entry.kind} />
            )}
          </>
        )}
      </div>
      {!deleted && live.stored && (
        <EntryPrintView heading={heading} kindLabel={label} entry={entry} {...printed} />
      )}
    </Page>
  );
}
