import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { LiveNotesEditorHandle } from "~/components/notes";

import { useRef, useState } from "react";
import { Link } from "react-router";
import { EditorAvatars, LiveNotesEditor } from "~/components/notes";
import { BackLink } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { KIND_META } from "~/lib/entryDisplay";
import { getGroup } from "~/lib/group";
import { NEW_ENTRY } from "~/lib/liveEntry";
import { sessionContext } from "~/lib/session";
import { getSync } from "~/lib/sync";
import { EntryPageHeader } from "./EntryPageHeader";
import { entryHeading, titleState } from "./entryPage";
import { loadEntry } from "./loadEntry";
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
    when: search.get("when"),
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

  const label = KIND_META[entry.kind].label;
  const heading = entryHeading(label, entry.title, live.isNew && !live.stored);
  const title = titleState({ kind: entry.kind, title: entry.title, saved: live.stored, canWrite, deleted });

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <BackLink to={timelineUrl} label="Timeline" />

      <h1 className="sr-only">{heading}</h1>
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
          key={entry.id}
          ref={editor}
          label={`${label} text`}
          db={db}
          documentId={entry.id}
          groupId={groupId}
          canWrite={canWrite}
          initial={loaderData.initial}
          autofocus={live.isNew && !loaderData.pickDay}
          ensureSaved={live.ensureSaved}
        />
      )}
    </main>
  );
}
