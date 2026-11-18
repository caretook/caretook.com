import type { Route } from "./+types/route";
import type { ReactNode } from "react";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type * as Y from "yjs";
import type { ContactAction } from "~/lib/contactActions";
import type { LocalProvider, ProviderRow } from "~/lib/sync/providers";

import { noteText } from "@caretook/data/schema";
import { ArrowLeft, Pencil } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { data, Link } from "react-router";
import { ACTION_ICONS, actionLinkProps } from "~/components/ContactActions";
import { EditorAvatars } from "~/components/EditorAvatars";
import { LiveNotesEditor } from "~/components/LiveNotesEditor";
import { ProviderTypeIcon } from "~/components/ProviderTypeIcon";
import { appUrls } from "~/lib/appUrls";
import { allActions, callAction } from "~/lib/contactActions";
import { getGroup, useGroup } from "~/lib/group";
import { shouldMaterialize } from "~/lib/liveEntry";
import { PROVIDER_TYPE_META } from "~/lib/providerDirectory";
import { PROVIDER_SHEET_STATE } from "~/routes/app/groups/providers/providerSheet";
import { sessionContext } from "~/lib/session";
import { getSync, useLiveQuery } from "~/lib/sync";
import { createProviderDocument, providerQuery, toProvider } from "~/lib/sync/providers";
import { readRows } from "~/lib/sync/timeline";

// Shared by web + native. A provider's page: who they are, every way to
// reach them, and their shared live notes ("park on level 2, ask for
// Rosa"), written by several people at once (Yjs), offline included. All
// local, like the entry page; the notes are the provider's document (its id
// is the provider's), created on the first real change.

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.provider.name} · Caretook` : "Caretook" }];
}

const NO_ROWS: ProviderRow[] = [];

/**
 * The provider, their notes document and its pending updates. A provider
 * that isn't on the device, is deleted, or is in another group is a 404 with
 * no names. (The group route has already turned away a non-member.)
 */
export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  const { groupId, providerId } = params;
  getGroup(context);
  const { db } = context.get(sessionContext);

  const providerRows = await readRows<ProviderRow>(db, providerQuery(providerId));
  const provider = providerRows[0] ? toProvider(providerRows[0]) : null;
  if (!provider || provider.groupId !== groupId || provider.deletedAt) {
    throw data("Not found", { status: 404 });
  }

  const [doc] = await readRows<{ id: string; snapshot: string | null }>(db, {
    sql: "SELECT id, snapshot FROM note_document WHERE id = ? AND group_id = ?",
    params: [providerId, groupId],
  });
  const updates = doc
    ? await readRows<{ id: string; data: string | null }>(db, {
        sql: "SELECT id, data FROM note_update WHERE document_id = ?",
        params: [providerId],
      })
    : [];

  return {
    provider,
    hasDocument: !!doc,
    initial: { snapshot: doc?.snapshot ?? null, updates },
    // Starting rows for the live query (stable, so it doesn't reset each render).
    providerRows,
  };
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

  // The notes document: made on the first real change (text), like a draft entry's.
  const saved = useRef(loaderData.hasDocument);
  const [saveError, setSaveError] = useState<string | null>(null);
  const ensureSaved = useCallback(
    async (doc: Y.Doc) => {
      if (saved.current) return true;
      if (!shouldMaterialize({ saved: false, text: noteText(doc), title: "" })) return false;
      const res = await createProviderDocument(getSync(), providerId);
      if (!res.ok) {
        setSaveError(res.error);
        return false;
      }
      setSaveError(null);
      saved.current = true;
      return true;
    },
    [providerId],
  );

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <Link to={directoryUrl} className="btn btn-ghost btn-sm -ml-3 gap-1">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Providers
      </Link>

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
        </>
      )}
    </main>
  );
}

/**
 * The provider's header, in regions like `EntryHeader`'s:
 *
 *   [icon] [name, badges ......] [editors] [actions]
 *          [type · specialty · practice]
 *
 * - `editors`: who is editing the notes now (avatars).
 * - `actions`: Edit, for writers (empty until the edit sheet lands).
 *
 * Empty regions take no space.
 */
function ProviderHeader({
  provider,
  editors,
  actions,
}: {
  provider: LocalProvider;
  editors?: ReactNode;
  actions?: ReactNode;
}) {
  const past = provider.status === "past";
  return (
    <header className="flex items-start gap-3">
      <ProviderTypeIcon type={provider.type} past={past} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div data-region="title" className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-xl font-semibold break-words" data-provider-name>
            {provider.name}
          </h1>
          {provider.isPrimary && !past && <span className="badge badge-primary badge-sm">Primary</span>}
          {past && <span className="badge badge-ghost badge-sm">Past</span>}
        </div>
        <p data-region="details" className="text-base-content/70 text-sm">
          {[PROVIDER_TYPE_META[provider.type].label, provider.specialty].filter(Boolean).join(" · ")}
          {provider.practiceId && (
            <>
              {" · "}
              <PracticeLink groupId={provider.groupId} practiceId={provider.practiceId} />
            </>
          )}
        </p>
      </div>
      {editors && (
        <div data-region="editors" className="flex shrink-0 items-center -space-x-1.5 pt-1">
          {editors}
        </div>
      )}
      {actions && (
        <div data-region="actions" className="flex shrink-0 items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}

/** The clinician's practice, linking to its page; greyed and unlinked once it's deleted. */
function PracticeLink({ groupId, practiceId }: { groupId: string; practiceId: string }) {
  const query = providerQuery(practiceId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, NO_ROWS);
  const practice = rows[0] ? toProvider(rows[0]) : null;
  if (!practice || practice.groupId !== groupId) return null;
  if (practice.deletedAt) {
    return (
      <span className="text-base-content/50 whitespace-nowrap" data-practice>
        {practice.name} (removed)
      </span>
    );
  }
  return (
    <Link to={appUrls.provider(groupId, practice.id)} className="link whitespace-nowrap" data-practice>
      {practice.name}
    </Link>
  );
}

const CAPTIONS: Record<Exclude<ContactAction["kind"], "call">, string> = {
  email: "Email",
  map: "Address",
  website: "Website",
};

/**
 * Every way to reach the provider, each with what it is under its value:
 * each number with its label, then email, address (maps) and website.
 */
const contactRows = (provider: LocalProvider) => [
  ...provider.phones.flatMap((phone) => {
    const action = callAction(provider.name, phone);
    return action ? [{ action, caption: phone.label.trim() || "Phone" }] : [];
  }),
  ...allActions(provider).flatMap((action) =>
    action.kind === "call" ? [] : [{ action, caption: CAPTIONS[action.kind] }],
  ),
];

/** The contact list: one link per way to reach them, named for what it does ("Call Dr. Alvarez, office"). */
function ContactList({ provider }: { provider: LocalProvider }) {
  const rows = contactRows(provider);
  if (rows.length === 0) return null;
  return (
    <ul
      aria-label="Contact"
      className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border"
      data-contact-list
    >
      {rows.map(({ action, caption }) => {
        const Icon = ACTION_ICONS[action.kind];
        return (
          <li key={`${action.kind}:${action.href}`}>
            <a
              href={action.href}
              data-action={action.kind}
              className="hover:bg-base-200/50 flex items-center gap-3 px-3 py-2.5"
              {...actionLinkProps(action)}
            >
              <Icon className="text-base-content/70 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="sr-only">{action.label}: </span>
                <span className="block break-words whitespace-pre-line">{action.value}</span>
                <span aria-hidden="true" className="text-base-content/70 block text-sm">
                  {caption}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
