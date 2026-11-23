import { EmptyState, Page, PageHeader } from "~/components/ui";
import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { CarePeriodRow } from "~/lib/care-periods/carePeriods.sync";

import { useMemo } from "react";
import { Outlet } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import { PERIOD_SHEET_STATE, onlyPeriodSheetChanged } from "~/lib/care-periods/periodSheets";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery } from "~/lib/sync";
import { carePeriodsQuery, toPeriodSpans } from "~/lib/care-periods/carePeriods.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { useNow } from "~/lib/live-notes/editors.sync";
import { PeriodList } from "./PeriodList";
import { loadPlaceRows, usePlaceChoices } from "./periodSheet";

// Shared by web + native. A group's care periods: where the recipient's care
// has happened, newest first, read from the device's local copy (live, so it
// works offline and follows other members' changes). Writers add a period
// here, for now or for any time in the past. Not a group section: it's
// reached from the timeline's line, the group menu and period pages.

export const meta = () => [{ title: "Care periods · Caretook" }];

/** The group's periods and the providers they name: the first render's rows, before the live queries take over. */
export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const [rows, placeRows] = await Promise.all([
    readRows<CarePeriodRow>(db, carePeriodsQuery(params.groupId)),
    loadPlaceRows(db, params.groupId),
  ]);
  return { rows, placeRows };
}

/** Live queries follow every change, so a save in a sheet, or opening and closing one, doesn't rerun the loader. */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  if (nextParams.groupId && onlyPeriodSheetChanged(nextParams.groupId, currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
}

export default function Periods({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const query = carePeriodsQuery(params.groupId);
  const rows = useLiveQuery<CarePeriodRow>(query.sql, query.params, loaderData.rows);
  const spans = useMemo(() => toPeriodSpans(rows), [rows]);
  const providers = usePlaceChoices(params.groupId, loaderData.placeRows);
  const places = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  // Once a minute, so "day N" and the current length turn over at midnight.
  const tick = useNow(60_000);
  const now = useMemo(() => new Date(tick), [tick]);
  const timeZone = group.recipient?.timeZone ?? "UTC";

  return (
    <Page>
      <PageHeader
        title="Care periods"
        {...sectionAccent("periods", { easy: group.easyRole })}
        description={
          <>
            Where {group.recipient?.displayName || group.displayName}’s care has been
            {!group.canWrite && " · You can view this list"}
          </>
        }
        add={
          group.canWrite && {
            label: "Add period",
            to: appUrls.newPeriod(params.groupId),
            state: PERIOD_SHEET_STATE,
            // Loaded ahead, so the sheet opens offline too.
            prefetch: "render",
            preventScrollReset: true,
            "data-add-period": "",
          }
        }
      />

      {spans.length ? (
        <PeriodList groupId={params.groupId} spans={spans} places={places} timeZone={timeZone} now={now} />
      ) : (
        <EmptyState {...sectionAccent("periods", { easy: group.easyRole })} data-periods-empty="">
          No care periods yet.
          {group.canWrite && " Add where care is now, or where it was before."}
        </EmptyState>
      )}

      {/* The add sheet renders here, over the list. */}
      <Outlet />
    </Page>
  );
}
