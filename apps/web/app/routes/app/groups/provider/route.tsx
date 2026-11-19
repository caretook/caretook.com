import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ProviderRow } from "~/lib/sync/providers";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { EditorAvatars, LiveNotesEditor } from "~/components/notes";
import { BackLink } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { getGroup, useGroup } from "~/lib/group";
import { PROVIDER_SHEET_STATE } from "~/routes/app/groups/providers/providerSheet";
import { sessionContext } from "~/lib/session";
import { getSync, useLiveQuery } from "~/lib/sync";
import { providerQuery, toProvider } from "~/lib/sync/providers";
import { ContactList } from "./ContactList";
import { LinkedEntries } from "./LinkedEntries";
import { loadProvider } from "./loadProvider";
import { ProviderHeader } from "./ProviderHeader";
import { useProviderNotes } from "./useProviderNotes";

// Shared by web + native. A provider's page: who they are, every way to
// reach them, and their shared live notes ("park on level 2, ask for
// Rosa"), written by several people at once (Yjs), offline included. All
// local, like the entry page; the notes are the provider's document (its id
// is the provider's), created on the first real change.

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.provider.name} · Caretook` : "Caretook" }];
}

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  return loadProvider(db, params.groupId, params.providerId);
}

/** Live queries keep the page current, so submissions need no reload. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function Provider(props: Route.ComponentProps) {
  // Another provider is another page (and another document): start fresh.
  return <ProviderPage key={props.loaderData.provider.id} {...props} />;
}

function ProviderPage({ loaderData, params }: Route.ComponentProps) {
  const { groupId, providerId } = params;
  // Live: a role changed on another device shows without a reload.
  const { canWrite } = useGroup();
  // Read once: after sign-out closes the database, this page may render once more before it goes.
  const [db] = useState(getSync);
  const directoryUrl = appUrls.providers(groupId);

  // The provider, live: other members' edits, and deletion.
  const query = providerQuery(providerId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, loaderData.providerRows);
  const live = rows[0] ? toProvider(rows[0]) : null;
  const provider = live ?? loaderData.provider;
  const deleted = !live || !!live.deletedAt || live.groupId !== groupId;

  const { ensureSaved, saveError } = useProviderNotes(providerId, loaderData.hasDocument);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <BackLink to={directoryUrl} label="Providers" />

      <ProviderHeader
        provider={provider}
        editors={!deleted && <EditorAvatars documentId={providerId} groupId={groupId} viewerId={db.userId} />}
        actions={
          canWrite &&
          !deleted && (
            <Link
              to={appUrls.editProvider(groupId, providerId)}
              // Closing the sheet goes back here.
              state={PROVIDER_SHEET_STATE}
              prefetch="render"
              className="btn btn-ghost btn-sm gap-1"
              data-edit-provider
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Link>
          )
        }
      />

      {deleted ? (
        <div role="alert" className="alert">
          <span>This provider was deleted.</span>
          <Link to={directoryUrl} className="btn btn-sm">
            Back to providers
          </Link>
        </div>
      ) : (
        <>
          <ContactList provider={provider} />

          <section aria-labelledby="provider-notes-heading" className="space-y-2">
            <div>
              <h2 id="provider-notes-heading" className="font-semibold">
                Notes
              </h2>
              <p className="text-base-content/70 text-sm">
                {canWrite
                  ? "Shared with the care group: parking, who to ask for, anything worth knowing."
                  : "Shared with the care group. You can view these notes."}
              </p>
            </div>
            {saveError && (
              <p role="alert" className="text-error text-sm">
                {saveError}
              </p>
            )}
            <LiveNotesEditor
              key={providerId}
              label={`Notes on ${provider.name}`}
              db={db}
              documentId={providerId}
              groupId={groupId}
              canWrite={canWrite}
              initial={loaderData.initial}
              ensureSaved={ensureSaved}
            />
          </section>

          <LinkedEntries groupId={groupId} providerId={providerId} />
        </>
      )}
    </main>
  );
}
