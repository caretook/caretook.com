import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { GroupRow } from "~/lib/timeline/timeline.sync";

import type { ProvidersOutlet } from "./providerSheet";

import { Import, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { directoryList, parseDirectoryFilters } from "~/lib/providers/providerDirectory";
import { IMPORT_ACTION } from "~/lib/providers/importWording";
import { PROVIDER_SHEET_STATE } from "~/lib/providers/providerSheetLink";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery } from "~/lib/sync";
import { providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { myGroupsQuery, readRows } from "~/lib/timeline/timeline.sync";
import { ProviderSearch, TypeFilter } from "./DirectoryFilters";
import { DirectoryResults } from "./DirectoryResults";
import { onlyProviderSheetChanged } from "./providerSheetGuard";

// Shared by web + native. The group's provider directory, read from the
// device's local copy (live, so it works offline and follows other members'
// changes). Search (`?q=`), the type (`?type=`) and past providers (`?past=1`)
// live in the URL; the list is filtered and ordered on the device
// (`lib/providers/providerDirectory.ts`).

export const meta = () => [{ title: "Providers · Caretook" }];

/**
 * Every provider in the group (not deleted), and the user's groups (for
 * "Import from another group"): the first render's rows, before the live
 * queries take over.
 */
export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const [rows, groups] = await Promise.all([
    readRows<ProviderRow>(db, providersQuery(params.groupId)),
    readRows<GroupRow>(db, myGroupsQuery(db.userId)),
  ]);
  return { rows, groups };
}

/**
 * The live query already follows every change, and the filters are applied
 * on the device, so a new search or filter (same path), a save in a sheet,
 * or opening and closing a sheet over the list doesn't rerun the loader.
 * Anything else (another group) does.
 */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  if (currentUrl.pathname === nextUrl.pathname) return false;
  if (nextParams.groupId && onlyProviderSheetChanged(nextParams.groupId, currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
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
  const mine = myGroupsQuery(group.userId);
  const groups = useLiveQuery<GroupRow>(mine.sql, mine.params, loaderData.groups);
  const canImport = group.canWrite && groups.some((g) => g.id !== groupId);

  // The box filters as you type; the URL follows (see `ProviderSearch`).
  const [text, setText] = useState(filters.q);
  const list = useMemo(
    () => directoryList(providers, { q: text, type: filters.type }),
    [providers, text, filters.type],
  );

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Providers</h1>
          <p className="text-base-content/70 text-sm">
            {group.displayName}
            {!group.canWrite && " · You can view this directory"}
          </p>
        </div>
        {group.canWrite && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {canImport && (
              <Link
                to={appUrls.importProviders(groupId, search)}
                state={PROVIDER_SHEET_STATE}
                prefetch="render"
                preventScrollReset
                className="btn btn-ghost btn-sm"
                data-import-providers
              >
                <Import className="size-4" aria-hidden="true" />
                {IMPORT_ACTION}
              </Link>
            )}
            <Link
              to={appUrls.newProvider(groupId, { search })}
              state={PROVIDER_SHEET_STATE}
              // Loaded ahead, so the sheet opens offline too.
              prefetch="render"
              preventScrollReset
              className="btn btn-primary btn-sm"
              data-add-provider
            >
              <Plus className="size-4" aria-hidden="true" />
              Add provider
            </Link>
          </div>
        )}
      </header>

      <ProviderSearch value={text} urlQuery={filters.q} onChange={setText} />
      <TypeFilter type={filters.type} />

      <DirectoryResults
        total={providers.length}
        list={list}
        practiceNames={practiceNames}
        text={text}
        type={filters.type}
        past={filters.past}
      />

      <Outlet context={{ providers } satisfies ProvidersOutlet} />
    </main>
  );
}
