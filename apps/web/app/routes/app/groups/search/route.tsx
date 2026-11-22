import { Page, PageHeader } from "~/components/ui";
import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { getGroup, useGroup } from "~/lib/app-shell/group";
import { loadSettings } from "~/lib/app-shell/me";
import { findPeriodChoice } from "~/lib/care-periods/periodSearch";
import { recordSearch } from "~/lib/search/recentSearches";
import { parseSearchPage } from "~/lib/search/searchResults";
import { sessionContext } from "~/lib/auth/session";
import { loadSearchPeriods, useSearchPeriods } from "~/lib/care-periods/periodSearch.sync";
import { loadSearch } from "./loadSearch";
import { PeriodField } from "./PeriodField";
import { RecentSearches } from "./RecentSearches";
import { SearchField } from "./SearchField";
import { SearchResults } from "./SearchResults";
import { useSearchPage } from "./useSearchPage";

// Shared by web + native. Search one care group's entries, providers,
// medications and todos on the device (`lib/search/search.sync.ts`), offline too. The text
// (`?q=`) and the section shown in full (`?all=`) live in the URL, so Back
// from a result comes back to the same results. A search that's used
// (the field left with it, or one of its results opened) joins this
// device's recent searches, which the empty page offers with a tip. A
// search can be narrowed to one care period (`?period=`).

export const meta = () => [{ title: "Search · Caretook" }];

/** The first results (and the units entries show in, and the care periods to search within), read before the page renders. */
export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const query = parseSearchPage(new URL(request.url).search);
  const [data, settings, periodRows] = await Promise.all([
    loadSearch(db, params.groupId, query),
    loadSettings(request, db.userId),
    loadSearchPeriods(db, params.groupId),
  ]);
  return { data, units: settings.units, periodRows };
}

/**
 * The page searches again on the device as the text changes, so a new
 * search (the same path) doesn't rerun the loader. Anything else does.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export default function SearchPage({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const { q, period, data, preparing, unavailable } = useSearchPage(params.groupId, loaderData.data);
  const periods = useSearchPeriods(params.groupId, loaderData.periodRows, group.recipient?.timeZone ?? "UTC");
  const currentPeriod = findPeriodChoice(periods, period);
  return (
    <Page data-search-page>
      <PageHeader title="Search" />
      <SearchField
        groupId={params.groupId}
        urlQuery={q}
        period={currentPeriod?.id ?? null}
        label={`Search ${group.displayName}`}
        onUsed={(text) => recordSearch(group.userId, text)}
      />
      {q.trim() && periods.length > 0 && (
        <PeriodField
          groupId={params.groupId}
          q={q}
          all={data.all}
          choices={periods}
          current={currentPeriod}
        />
      )}
      {/* Opening a result (any link in them, or an easy role's sheet) uses the search they're for. */}
      <div
        className="space-y-4"
        onClickCapture={(e) => {
          if ((e.target as Element).closest("a, [data-opens-sheet]")) recordSearch(group.userId, data.q);
        }}
      >
        <SearchResults
          data={data}
          groupId={params.groupId}
          canWrite={group.canWrite}
          units={loaderData.units}
          preparing={preparing}
          unavailable={unavailable}
        />
      </div>
      {!q.trim() && <RecentSearches groupId={params.groupId} userId={group.userId} />}
    </Page>
  );
}
