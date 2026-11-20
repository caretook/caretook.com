import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { CarePeriodRow } from "~/lib/care-periods/carePeriods.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";

import { neighbours } from "@caretook/data/schema";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { EditorAvatars, LiveNotesEditor } from "~/components/notes";
import { BackLink } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { periodTitle } from "~/lib/care-periods/periodDisplay";
import { sessionContext } from "~/lib/auth/session";
import { getSync, useLiveQuery } from "~/lib/sync";
import { carePeriodsQuery, removeCarePeriod, toPeriodSpans } from "~/lib/care-periods/carePeriods.sync";
import { useNow } from "~/lib/live-notes/editors.sync";
import { providerQuery, toProvider } from "~/lib/providers/providers.sync";
import { loadPeriod } from "./loadPeriod";
import { DELETE_INTENT, PeriodActions } from "./PeriodActions";
import { PeriodDates } from "./PeriodDates";
import { PeriodHeader } from "./PeriodHeader";
import { PeriodNeighbours } from "./PeriodNeighbours";
import { deleteConfirmText } from "./periodPage";
import { PeriodPlace } from "./PeriodPlace";
import { useCarePeriodNotes } from "./useCarePeriodNotes";

// Shared by web + native. A care period's page: where care was, from when to
// when and for how long, the place with its contact actions, the periods
// before and after, and the period's shared live notes (discharge
// instructions, visiting hours). All local and live, like the medication
// page; the notes are the period's document (its id is the period's),
// created on the first real change.

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${periodTitle(loaderData.period)} · Caretook` : "Caretook" }];
}

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  return loadPeriod(db, params.groupId, params.periodId);
}

/** Delete (soft): a local write; the period before it runs on, and PowerSync uploads it. */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  if (form.get("intent") !== DELETE_INTENT) return { ok: false, error: "Nothing to do", issues: [] };
  return removeCarePeriod(db, params.periodId);
}

/** Live queries keep the page current, so submissions need no reload. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function Period(props: Route.ComponentProps) {
  // Another period is another page (and another document): start fresh.
  return <PeriodPage key={props.loaderData.period.id} {...props} />;
}

function PeriodPage({ loaderData, params }: Route.ComponentProps) {
  const { groupId, periodId } = params;
  // Live: a role changed on another device shows without a reload.
  const group = useGroup();
  const { canWrite } = group;
  const timeZone = group.recipient?.timeZone ?? "UTC";
  // Read once: after sign-out closes the database, this page may render once more before it goes.
  const [db] = useState(getSync);
  const listUrl = appUrls.periods(groupId);
  // Once a minute, so "day N" and the length turn over at midnight.
  const tick = useNow(60_000);
  const now = useMemo(() => new Date(tick), [tick]);

  // The track, live: other members' edits move this period's end and its neighbours.
  const track = carePeriodsQuery(groupId);
  const trackRows = useLiveQuery<CarePeriodRow>(track.sql, track.params, loaderData.trackRows);
  const { span, previous, next } = useMemo(() => {
    const spans = toPeriodSpans(trackRows);
    return { span: spans.find((s) => s.period.id === periodId) ?? null, ...neighbours(spans, periodId) };
  }, [trackRows, periodId]);
  // Gone from the track: deleted, here or on another device.
  const deleted = !span;
  const period = span?.period ?? loaderData.period;

  const placeQuery = providerQuery(period.placeProviderId ?? "");
  const placeRows = useLiveQuery<ProviderRow>(placeQuery.sql, placeQuery.params, loaderData.placeRows);
  const place =
    period.placeProviderId && placeRows[0]?.id === period.placeProviderId ? toProvider(placeRows[0]) : null;

  const { ensureSaved, saveError } = useCarePeriodNotes(periodId, loaderData.hasDocument);
  const title = periodTitle(period);
  const navigate = useNavigate();
  // Deleted from here: back to the list (the page would only say it's gone).
  const onDeleted = useCallback(() => void navigate(listUrl, { replace: true }), [navigate, listUrl]);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5" data-period-page={period.id}>
      <BackLink to={listUrl} label="Care periods" />

      <PeriodHeader
        period={period}
        current={!!span && span.endsAt === null}
        editors={!deleted && <EditorAvatars documentId={periodId} groupId={groupId} viewerId={db.userId} />}
        actions={
          canWrite &&
          !deleted && (
            <PeriodActions
              groupId={groupId}
              periodId={periodId}
              title={title}
              deleteMessage={deleteConfirmText({ previous, next }, timeZone, now)}
              onDeleted={onDeleted}
            />
          )
        }
      />

      {deleted ? (
        <div role="alert" className="alert" data-period-deleted>
          <span>This care period was deleted.</span>
          <Link to={listUrl} className="btn btn-sm">
            Back to care periods
          </Link>
        </div>
      ) : (
        <>
          <PeriodDates span={span} next={next} timeZone={timeZone} now={now} />

          <PeriodPlace groupId={groupId} place={place} detail={period.placeDetail} />

          <section aria-labelledby="period-notes-heading" className="space-y-2">
            <div>
              <h2 id="period-notes-heading" className="font-semibold">
                Notes
              </h2>
              <p className="text-base-content/70 text-sm">
                {canWrite
                  ? "Shared with the care group: discharge instructions, visiting hours, the unit's phone."
                  : "Shared with the care group. You can view these notes."}
              </p>
            </div>
            {saveError && (
              <p role="alert" className="text-error text-sm">
                {saveError}
              </p>
            )}
            <LiveNotesEditor
              key={periodId}
              label={`Notes on ${title}`}
              db={db}
              documentId={periodId}
              groupId={groupId}
              canWrite={canWrite}
              initial={loaderData.initial}
              ensureSaved={ensureSaved}
            />
          </section>

          <PeriodNeighbours groupId={groupId} previous={previous} next={next} timeZone={timeZone} now={now} />
        </>
      )}
    </main>
  );
}
