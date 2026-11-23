import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { GroupRow } from "~/lib/timeline/timeline.sync";

import type { ProvidersOutlet } from "./providerSheet";

import { Import } from "lucide-react";
import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Button, Page, PageHeader } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { directoryList, parseDirectoryFilters } from "~/lib/providers/providerDirectory";
import { IMPORT_ACTION } from "~/lib/providers/importWording";
import { PROVIDER_SHEET_STATE } from "~/lib/providers/providerSheetLink";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery } from "~/lib/sync";
import { providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { myGroupsQuery, readRows } from "~/lib/timeline/timeline.sync";
import { DirectoryFilterRow } from "./DirectoryFilters";
import { DirectoryResults } from "./DirectoryResults";
import { onlyProviderSheetChanged } from "./providerSheetGuard";

// Shared by web + native. The group's provider directory, read from the
// device's local copy (live, so it works offline and follows other members'
// changes). Search (`?q=`) and the type (`?type=`) live in the URL; the list is
// filtered and ordered on the device (`lib/providers/providerDirectory.ts`).

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
    <Page>
      <PageHeader
        title="Providers"
        actions={
          canImport && (
            <Button
              size="sm"
              icon={Import}
              label={IMPORT_ACTION}
              to={appUrls.importProviders(groupId, search)}
              state={PROVIDER_SHEET_STATE}
              prefetch="render"
              preventScrollReset
              data-import-providers=""
            />
          )
        }
        add={
          group.canWrite && {
            label: "Add provider",
            to: appUrls.newProvider(groupId, { search }),
            state: PROVIDER_SHEET_STATE,
            // Loaded ahead, so the sheet opens offline too.
            prefetch: "render",
            preventScrollReset: true,
            "data-add-provider": "",
          }
        }
      />

      <DirectoryFilterRow value={text} urlQuery={filters.q} onChange={setText} type={filters.type} />

      <DirectoryResults
        total={providers.length}
        list={list}
        practiceNames={practiceNames}
        text={text}
        type={filters.type}
      />

      <Outlet context={{ providers } satisfies ProvidersOutlet} />
    </Page>
  );
}
