import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { TimelineOutlet } from "./sheet";

import { dayInZone } from "@caretook/data/schema";
import { useRef } from "react";
import { Outlet, PrefetchPageLinks } from "react-router";
import { Page } from "~/components/ui";
import { QuickEntryBox } from "~/components/quick-entry";
import { appUrls } from "~/lib/app-shell/appUrls";
import { formString } from "~/lib/core/form";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { loadSettings, useMySettings } from "~/lib/app-shell/me";
import { sessionContext } from "~/lib/auth/session";
import { loadSearchPeriods, searchPeriodRange } from "~/lib/care-periods/periodSearch.sync";
import { removeEntry } from "~/lib/timeline/timeline.sync";
import { parseFilters, readDay } from "~/lib/timeline/timelineFilters";
import { jumpBound } from "~/lib/timeline/timelineJump";
import { localTimeZone } from "~/lib/core/format";
import { AddedMedicationToast } from "./AddedMedicationToast";
import { focusAfterSetup, GettingStartedCard } from "./GettingStartedCard";
import { LiveNowBanner } from "./LiveNowBanner";
import { onlySheetChanged } from "./sheetGuard";
import { COLUMN_CAP, TimelineEntryList } from "./TimelineEntryList";
import { FilterChips } from "./TimelineFilters";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineViewMenu } from "./TimelineViewMenu";
import { loadTimelineRows } from "./timelineRows";
import { timelineSearch } from "./timelineSearch";
import { TodayCard } from "./TodayCard";
import { usePeriodSearch } from "./usePeriodSearch";
import { settledSearchIndexStatus, useSearchIndexStatus } from "./useSearchIndexStatus";
import { useTimelineData } from "./useTimelineData";
import { useTimelineView } from "./useTimelineView";
import { useDaySummaryMode } from "./useDaySummaryMode";
import { useEasyMode } from "~/lib/assistant/useEasyMode";
import { EasyTimeline } from "./EasyTimeline";

// Shared by web + native. Reads and writes go to the device's local copy
// (PowerSync), so the timeline works offline and other members' changes
// appear as they sync (`useTimelineData`). Only settings come from the API:
// the loader answers from their cache, and `useMySettings` follows the
// background refresh.

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
 * history up to now, and what's next after it (the Today card's
 * appointment). `?kind=` shows one kind (`?vital=` one vital type, `?symptom=` any of some symptom types), `?author=`
 * one person's entries and `?q=` the entries matching a search (through the
 * device's search index; a reload waits a moment for it). The group itself comes from the group route (which
 * has already turned away a group not on the device).
 */
export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { search: urlSearch } = new URL(request.url);
  const filters = parseFilters(urlSearch);
  // A jump (`?day=`) is the viewer's day; its window ends where the next day starts.
  const now = new Date();
  const zone = localTimeZone();
  const day = readDay(urlSearch, dayInZone(now, zone));
  const before = day ? jumpBound(day, zone, now) : null;
  const [status, searchPeriods] = await Promise.all([
    filters.q ? settledSearchIndexStatus() : Promise.resolve("ready" as const),
    filters.q ? loadSearchPeriods(db, params.groupId) : NO_SEARCH_PERIODS,
  ]);
  const range = searchPeriodRange(searchPeriods, filters.period);
  const { match } = timelineSearch(params.groupId, filters.q, status, range);
  const [rows, settings] = await Promise.all([
    loadTimelineRows(
      db,
      params.groupId,
      { kind: filters.kind, author: filters.author, vital: filters.vital, symptoms: filters.symptoms, match },
      before,
    ),
    loadSettings(request, db.userId),
  ]);
  return {
    userId: db.userId,
    title: pageTitle(group.name),
    ...filters,
    day,
    searchPeriods,
    ...rows,
    ...settings,
  };
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
  const { userId, kind, author, q, vital, symptoms, day } = loaderData;
  const { groupId } = params;
  // The loader's settings come from the cache; a background refresh publishes any change.
  const settings = useMySettings(userId, loaderData);
  const { units } = settings;
  const group = useGroup();
  const { canWrite, canLog } = group;
  const mode = useEasyMode(userId, groupId, group, settings.easyMode);
  const period = usePeriodSearch(groupId, loaderData.period, loaderData.searchPeriods);
  const search = timelineSearch(groupId, q, useSearchIndexStatus(), period.range);
  const filters = { kind, author, vital, symptoms, match: search.match };
  const data = useTimelineData({ groupId, userId, filters, day, initial: loaderData });
  const [view, setView] = useTimelineView(userId, settings.timelineView);
  const [summaryMode, setSummaryMode] = useDaySummaryMode(userId, settings.daySummary);
  // The empty Today's "Add an entry": the quick-entry field, in view and focused (a phone's keyboard comes up).
  const quickField = useRef<HTMLTextAreaElement>(null);
  const addEntry = () => {
    const el = quickField.current;
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  };
  // A dismissed setup card's focus: the quick-entry box, else the "Timeline" heading.
  const header = useRef<HTMLDivElement>(null);
  const afterSetup = () => focusAfterSetup(quickField.current, header.current?.querySelector("h1"));

  const sheets = (
    <>
      {/* The sheets (`new/:kind`, `:entryId/edit`), over the timeline. */}
      <Outlet context={{ units, easy: mode.easy } satisfies TimelineOutlet} />
      {/* "Added Ibuprofen · Add details", once the Dose sheet's quick add closes it. */}
      <AddedMedicationToast groupId={groupId} />
      {/* The edit sheet's route module, fetched now so a row opens it offline (one link for every row). */}
      {canLog && <PrefetchPageLinks page={appUrls.editSheet(groupId, "prefetch")} />}
      {/* The pass sheet's too, so a pass log opens it offline. */}
      {canLog && <PrefetchPageLinks page={appUrls.passSheet(groupId, "prefetch")} />}
    </>
  );
  // The search, Filter button and chips: the same in both views (View options at the end in the full one).
  const chips = (
    <div className={COLUMN_CAP}>
      <FilterChips
        kind={kind}
        author={author ? { userId: author, name: data.nameOf(author), image: data.imageOf(author) } : null}
        q={q}
        vital={vital}
        vitalTypes={data.latestVitals.map((v) => v.reading.type)}
        symptoms={symptoms}
        period={period}
        trailing={
          !mode.easy && (
            <TimelineViewMenu
              view={view}
              onViewChange={setView}
              summaryMode={summaryMode}
              onSummaryModeChange={setSummaryMode}
            />
          )
        }
      />
    </div>
  );
  if (mode.easy)
    return (
      <EasyTimeline
        data={data}
        units={units}
        mode={mode}
        summaryMode={summaryMode}
        chips={chips}
        filters={{ kind, author, vital, symptoms, search: { q, state: search.state } }}
      >
        {sheets}
      </EasyTimeline>
    );

  return (
    <Page className="lg:max-w-none">
      <div className={COLUMN_CAP} ref={header}>
        <TimelineHeader easyMode={mode} />
      </div>
      <GettingStartedCard className={COLUMN_CAP} onAddEntry={addEntry} onDismissed={afterSetup} />
      <TodayCard
        groupId={groupId}
        canWrite={canWrite}
        latestVitals={data.latestVitals}
        next={data.next}
        now={data.now}
        units={units}
      />
      <LiveNowBanner documents={data.liveDocuments} groupId={groupId} nameOf={data.nameOf} />
      {canWrite && (
        <div className={COLUMN_CAP}>
          <QuickEntryBox groupId={groupId} units={units} fieldRef={quickField} />
        </div>
      )}
      {chips}
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
        symptoms={symptoms}
        search={{ q, state: search.state }}
        onAddEntry={addEntry}
      />
      {sheets}
    </Page>
  );
}
