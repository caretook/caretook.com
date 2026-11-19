import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";
import type { TimelineOutlet } from "./sheet";

import { Outlet, PrefetchPageLinks } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { formString } from "~/lib/form";
import { getGroup, useGroup } from "~/lib/group";
import { loadSettings } from "~/lib/me";
import { sessionContext } from "~/lib/session";
import { removeEntry } from "~/lib/sync/timeline";
import { parseFilters } from "~/lib/timelineFilters";
import { InviteSomeoneCard } from "./InviteSomeoneCard";
import { LatestVitals } from "./LatestVitals";
import { LiveNowBanner } from "./LiveNowBanner";
import { QuickAddBar } from "./QuickAddBar";
import { onlySheetChanged } from "./sheetGuard";
import { TimelineEntryList } from "./TimelineEntryList";
import { KindFilter } from "./TimelineFilters";
import { TimelineHeader } from "./TimelineHeader";
import { loadTimelineRows } from "./timelineRows";
import { useTimelineData } from "./useTimelineData";
import { useTimelineView } from "./useTimelineView";

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

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData?.title ?? pageTitle() }];
}

/**
 * The first screenful, read locally so the page renders complete. `?kind=`
 * shows one kind. The group itself comes from the group route (which has
 * already turned away a group not on the device).
 */
export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { kind } = parseFilters(new URL(request.url).search);
  const [rows, settings] = await Promise.all([
    loadTimelineRows(db, params.groupId, kind),
    loadSettings(request, db.userId),
  ]);
  return { userId: db.userId, title: pageTitle(group.name), kind, ...rows, ...settings };
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
 * the loader (that would reset "Show older"), and neither does opening or
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
  const { userId, units, kind } = loaderData;
  const { groupId } = params;
  const { canWrite } = useGroup();
  const data = useTimelineData({ groupId, userId, kind, initial: loaderData });
  const [view, setView] = useTimelineView(userId, loaderData.timelineView);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <TimelineHeader view={view} onViewChange={setView} />
      <InviteSomeoneCard />
      <LatestVitals vitals={data.latestVitals} units={units} />
      <LiveNowBanner documents={data.liveDocuments} groupId={groupId} nameOf={data.nameOf} />
      {canWrite && <QuickAddBar groupId={groupId} />}
      <KindFilter kind={kind} />
      <TimelineEntryList
        data={data}
        view={view}
        units={units}
        groupId={groupId}
        canWrite={canWrite}
        kind={kind}
      />

      {/* The sheets (`new/:kind`, `:entryId/edit`), over the timeline. */}
      <Outlet context={{ units } satisfies TimelineOutlet} />
      {/* The edit sheet's route module, fetched now so a row opens it offline (one link for every row). */}
      {canWrite && <PrefetchPageLinks page={appUrls.editSheet(groupId, "prefetch")} />}
    </main>
  );
}
