import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { TimelineOutlet } from "./sheet";

import { Outlet, PrefetchPageLinks } from "react-router";
import { QuickEntryBox } from "~/components/quick-entry";
import { appUrls } from "~/lib/app-shell/appUrls";
import { formString } from "~/lib/core/form";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { loadSettings } from "~/lib/app-shell/me";
import { sessionContext } from "~/lib/auth/session";
import { loadSearchPeriods, searchPeriodRange } from "~/lib/care-periods/periodSearch.sync";
import { removeEntry } from "~/lib/timeline/timeline.sync";
import { parseFilters } from "~/lib/timeline/timelineFilters";
import { InviteSomeoneCard } from "./InviteSomeoneCard";
import { LatestVitals } from "./LatestVitals";
import { LiveNowBanner } from "./LiveNowBanner";
import { MedicationStrip } from "./MedicationStrip";
import { TaskStrip } from "./TaskStrip";
import { NextStrip } from "./NextStrip";
import { seeAllSearch } from "./aheadQueries";
import { onlySheetChanged } from "./sheetGuard";
import { COLUMN_CAP, TimelineEntryList } from "./TimelineEntryList";
import { FilterChips } from "./TimelineFilters";
import { TimelineHeader } from "./TimelineHeader";
import { loadTimelineRows } from "./timelineRows";
import { timelineSearch } from "./timelineSearch";
import { usePeriodSearch } from "./usePeriodSearch";
import { settledSearchIndexStatus, useSearchIndexStatus } from "./useSearchIndexStatus";
import { useTimelineData } from "./useTimelineData";
import { useTimelineView } from "./useTimelineView";
import { useDaySummaryMode } from "./useDaySummaryMode";
import { useSimpleMode } from "~/lib/assistant/useSimpleMode";
import { SimpleModeToggle } from "./SimpleModeToggle";
import { SimpleTimeline } from "./SimpleTimeline";
import { useSimpleModeUrl } from "./useSimpleModeUrl";

// Shared by web + native. Reads and writes go to the device's local copy
// (PowerSync), so the timeline works offline and other members' changes
// appear as they sync (`useTimelineData`). Only settings come from the API
// (cached offline).

/**
 * The page title. Shared by `meta` and the loader, which keeps the loader in
 * the route's own chunk: split out, it costs the route about 0.6 KB gzipped in
 * extra chunks, and the loader is the first thing the route runs anyway.
 */
const pageTitle = (groupName?: string) => `${groupName || "Timeline"} · Caretook`;

/** No care periods read: only a search offers them (`?period=`). */
const NO_SEARCH_PERIODS: never[] = [];

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.title ?? pageTitle() }];
}

/**
 * The first screenful, read locally so the page renders complete: the
 * history up to now, and what's ahead of it (the Next strip, and the
 * Upcoming block with `?upcoming=1`). `?kind=` shows one kind (`?vital=` one vital type), `?author=`
 * one person's entries and `?q=` the entries matching a search (through the
 * device's search index; a reload waits a moment for it). The group itself comes from the group route (which
 * has already turned away a group not on the device).
 */
export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const filters = parseFilters(new URL(request.url).search);
  const [status, searchPeriods] = await Promise.all([
    filters.q ? settledSearchIndexStatus() : Promise.resolve("ready" as const),
    filters.q ? loadSearchPeriods(db, params.groupId) : NO_SEARCH_PERIODS,
  ]);
  const range = searchPeriodRange(searchPeriods, filters.period);
  const { match } = timelineSearch(params.groupId, filters.q, status, range);
  const [rows, settings] = await Promise.all([
    loadTimelineRows(db, params.groupId, {
      kind: filters.kind,
      author: filters.author,
      vital: filters.vital,
      match,
    }),
    loadSettings(request, db.userId),
  ]);
  return { userId: db.userId, title: pageTitle(group.name), ...filters, searchPeriods, ...rows, ...settings };
}

/**
 * Deletes go to the local database; live queries show them at once and
 * PowerSync uploads them. (Adding and editing are the sheets':
 * `new/route.tsx` and `edit/route.tsx`.)
 */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  const intent = formString(form, "intent");
  if (intent === "remove") return removeEntry(db, formString(form, "id"));
  throw new Error(`Unknown intent: ${intent}`);
}

/**
 * Live queries already reflect every write, so a submission doesn't rerun
 * the loader (that would reset the loaded pages), and neither does opening or
 * closing a sheet over the timeline. Other navigation (a new filter) does.
 */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  if (nextParams.groupId && onlySheetChanged(nextParams.groupId, currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
}

export default function Timeline({ loaderData, params }: Route.ComponentProps) {
  const { userId, units, kind, author, q, upcoming, vital } = loaderData;
  const { groupId } = params;
  const group = useGroup();
  const { canWrite } = group;
  const mode = useSimpleMode(userId, groupId, group, loaderData.simpleMode);
  useSimpleModeUrl(groupId, mode.simple, loaderData);
  const period = usePeriodSearch(groupId, loaderData.period, loaderData.searchPeriods);
  const search = timelineSearch(groupId, q, useSearchIndexStatus(), period.range);
  const filters = { kind, author, vital, match: search.match };
  const data = useTimelineData({ groupId, userId, filters, initial: loaderData });
  const [view, setView] = useTimelineView(userId, loaderData.timelineView);
  const [summaryMode, setSummaryMode] = useDaySummaryMode(userId, loaderData.daySummary);

  const sheets = (
    <>
      {/* The sheets (`new/:kind`, `:entryId/edit`), over the timeline. */}
      <Outlet context={{ units, simple: mode.simple } satisfies TimelineOutlet} />
      {/* The edit sheet's route module, fetched now so a row opens it offline (one link for every row). */}
      {canWrite && <PrefetchPageLinks page={appUrls.editSheet(groupId, "prefetch")} />}
      {/* The pass sheet's too, so a pass log opens it offline. */}
      {canWrite && <PrefetchPageLinks page={appUrls.passSheet(groupId, "prefetch")} />}
    </>
  );
  if (mode.simple)
    return (
      <SimpleTimeline data={data} units={units} mode={mode} summaryMode={summaryMode}>
        {sheets}
      </SimpleTimeline>
    );

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 lg:max-w-none">
      <TimelineHeader
        view={view}
        onViewChange={setView}
        summaryMode={summaryMode}
        onSummaryModeChange={setSummaryMode}
        simpleToggle={<SimpleModeToggle mode={mode} />}
      />
      <InviteSomeoneCard />
      <LatestVitals vitals={data.latestVitals} units={units} />
      <NextStrip next={data.next} now={data.now} groupId={groupId} showing={upcoming} />
      <LiveNowBanner documents={data.liveDocuments} groupId={groupId} nameOf={data.nameOf} />
      <MedicationStrip groupId={groupId} canWrite={canWrite} />
      <TaskStrip groupId={groupId} />
      {canWrite && (
        <div className={COLUMN_CAP}>
          <QuickEntryBox groupId={groupId} units={units} />
        </div>
      )}
      <div className={COLUMN_CAP}>
        <FilterChips
          kind={kind}
          author={author ? { name: data.nameOf(author), image: data.imageOf(author) } : null}
          q={q}
          vital={vital}
          vitalTypes={data.latestVitals.map((v) => v.reading.type)}
          period={period}
        />
      </div>
      <TimelineEntryList
        data={data}
        view={view}
        summaryMode={summaryMode}
        units={units}
        groupId={groupId}
        canWrite={canWrite}
        kind={kind}
        author={author}
        vital={vital}
        search={{ q, state: search.state }}
        upcoming={
          upcoming
            ? { items: data.upcoming, seeAll: appUrls.upcoming(groupId, seeAllSearch({ kind, author })) }
            : null
        }
      />
      {sheets}
    </main>
  );
}
