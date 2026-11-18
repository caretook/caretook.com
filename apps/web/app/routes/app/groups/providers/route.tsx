import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { LocalProvider, ProviderRow } from "~/lib/sync/providers";

import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { getGroup, useGroup } from "~/lib/group";
import { directoryList, parseDirectoryFilters, PROVIDER_TYPE_META, setPast } from "~/lib/providerDirectory";
import { sessionContext } from "~/lib/session";
import { useLiveQuery } from "~/lib/sync";
import { providersQuery, toProviders } from "~/lib/sync/providers";
import { readRows } from "~/lib/sync/timeline";
import { ProviderSearch, TypeFilter } from "./DirectoryFilters";
import { ProviderListItem } from "./ProviderListItem";

// Shared by web + native. The group's provider directory, read from the
// device's local copy (live, so it works offline and follows other members'
// changes). Search (`?q=`), the type (`?type=`) and past providers (`?past=1`)
// live in the URL; the list is filtered and ordered on the device
// (`lib/providerDirectory.ts`).

export const meta = () => [{ title: "Providers · Caretook" }];

/** Every provider in the group (not deleted): the first render's rows, before the live query takes over. */
export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  return { rows: await readRows<ProviderRow>(db, providersQuery(params.groupId)) };
}

/**
 * The live query already follows every change, and the filters are applied
 * on the device, so a new search or filter (same path) doesn't rerun the
 * loader. Anything else (another group) does.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

const countLabel = (n: number) => `${n} ${n === 1 ? "provider" : "providers"}`;

function ProviderList({
  providers,
  practiceNames,
  label,
}: {
  providers: LocalProvider[];
  practiceNames: Map<string, string>;
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border"
    >
      {providers.map((p) => (
        <ProviderListItem
          key={p.id}
          provider={p}
          practiceName={p.practiceId ? (practiceNames.get(p.practiceId) ?? null) : null}
        />
      ))}
    </ul>
  );
}

export default function Providers({ loaderData, params }: Route.ComponentProps) {
  const { groupId } = params;
  const group = useGroup();
  const { search } = useLocation();
  const filters = parseDirectoryFilters(search);

  const query = providersQuery(groupId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, loaderData.rows);
  const providers = useMemo(() => toProviders(rows), [rows]);
  const practiceNames = useMemo(() => new Map(providers.map((p) => [p.id, p.name])), [providers]);

  // The box filters as you type; the URL follows (see `ProviderSearch`).
  const [text, setText] = useState(filters.q);
  const list = useMemo(
    () => directoryList(providers, { q: text, type: filters.type }),
    [providers, text, filters.type],
  );
  const shown = list.current.length + (filters.past ? list.past.length : 0);
  const filtered = !!text.trim() || !!filters.type;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <header className="min-w-0">
        <h1 className="text-lg font-semibold">Providers</h1>
        <p className="text-base-content/70 text-sm">
          {group.displayName}
          {!group.canWrite && " · You can view this directory"}
        </p>
      </header>

      <ProviderSearch value={text} urlQuery={filters.q} onChange={setText} />
      <TypeFilter type={filters.type} />

      {/* Announces how many match after each search or filter. */}
      <p role="status" className="sr-only">
        {providers.length === 0 ? "" : countLabel(shown)}
      </p>

      <section aria-labelledby="providers-heading" className="space-y-4">
        <h2 id="providers-heading" className="sr-only">
          {filters.type ? PROVIDER_TYPE_META[filters.type].plural : "All providers"}
        </h2>

        {providers.length === 0 ? (
          <p className="text-base-content/70">No providers yet.</p>
        ) : (
          list.current.length === 0 &&
          !(filters.past && list.past.length > 0) && (
            <p className="text-base-content/70" data-empty>
              {text.trim()
                ? `No ${filters.type ? PROVIDER_TYPE_META[filters.type].plural.toLowerCase() : "providers"} match “${text.trim()}”.`
                : filtered
                  ? `No current ${filters.type ? PROVIDER_TYPE_META[filters.type].plural.toLowerCase() : "providers"}.`
                  : "No current providers."}
            </p>
          )
        )}

        {list.current.length > 0 && (
          <ProviderList providers={list.current} practiceNames={practiceNames} label="Current providers" />
        )}

        {list.past.length > 0 &&
          (filters.past ? (
            <section aria-labelledby="past-heading" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 id="past-heading" className="text-base-content/70 text-sm font-semibold">
                  Past providers
                </h3>
                <Link
                  to={{ search: setPast(search, false) }}
                  replace
                  preventScrollReset
                  className="btn btn-ghost btn-sm"
                >
                  Hide past
                </Link>
              </div>
              <ProviderList providers={list.past} practiceNames={practiceNames} label="Past providers" />
            </section>
          ) : (
            <Link
              to={{ search: setPast(search, true) }}
              replace
              preventScrollReset
              className="btn btn-ghost btn-sm"
              data-show-past
            >
              Show past ({list.past.length})
            </Link>
          ))}
      </section>
    </main>
  );
}
