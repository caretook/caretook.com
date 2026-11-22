import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ProviderRow } from "~/lib/providers/providers.sync";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { EditorAvatars, LiveNotesEditor } from "~/components/notes";
import { LinkedTodos } from "~/components/todos";
import { BackLink, Page, Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { PROVIDER_SHEET_STATE } from "~/lib/providers/providerSheetLink";
import { sessionContext } from "~/lib/auth/session";
import { getSync, useLiveQuery } from "~/lib/sync";
import { providerQuery, toProvider } from "~/lib/providers/providers.sync";
import { useMentionProviders } from "~/lib/providers/mentionProviders.sync";
import { ContactList } from "./ContactList";
import { CopyToGroup } from "./CopyToGroup";
import { LinkedEntries } from "./LinkedEntries";
import { loadProvider } from "./loadProvider";
import { ProviderConditions } from "./ProviderConditions";
import { ProviderHeader } from "./ProviderHeader";
import { ProviderMedications } from "./ProviderMedications";
import { ProviderVisitPrep } from "./ProviderVisitPrep";
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
  const { canWrite, displayName } = useGroup();
  const [copyStatus, setCopyStatus] = useState("");
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
  // The group's providers, for mentions in the notes (chips only: nothing links here).
  const mentionProviders = useMentionProviders(groupId);

  return (
    <Page bands>
      <Section>
        <BackLink to={directoryUrl} label="Providers" />

        <ProviderHeader
          provider={provider}
          editors={
            !deleted && <EditorAvatars documentId={providerId} groupId={groupId} viewerId={db.userId} />
          }
          actions={
            canWrite &&
            !deleted && (
              <>
                <CopyToGroup provider={provider} groupName={displayName} onResult={setCopyStatus} />
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
              </>
            )
          }
        />

        <p role="status" className="text-sm empty:hidden" data-copy-status>
          {copyStatus}
        </p>
      </Section>

      {deleted ? (
        <Section>
          <div role="alert" className="alert">
            <span>This provider was deleted.</span>
            <Link to={directoryUrl} className="btn btn-sm">
              Back to providers
            </Link>
          </div>
        </Section>
      ) : (
        <>
          <ContactList provider={provider} />

          {canWrite && (
            <ProviderVisitPrep groupId={groupId} providerId={providerId} providerName={provider.name} />
          )}

          <LinkedTodos link={{ providerId }} band />

          <Section
            title="Notes"
            id="notes"
            description={
              canWrite
                ? "Shared with the care group: parking, who to ask for, anything worth knowing."
                : "Shared with the care group. You can view these notes."
            }
          >
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
              providers={mentionProviders}
            />
          </Section>

          <LinkedEntries groupId={groupId} providerId={providerId} />

          <ProviderMedications groupId={groupId} providerId={providerId} />

          <ProviderConditions groupId={groupId} providerId={providerId} />
        </>
      )}
    </Page>
  );
}
