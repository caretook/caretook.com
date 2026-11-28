import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { CarePeriodRow } from "~/lib/care-periods/carePeriods.sync";
import type { PeriodPrefillValues } from "~/lib/care-periods/periodSheets";

import { useCallback, useId, useMemo, useState } from "react";
import { PeriodForm, PeriodList } from "~/components/care-periods";
import { Card, TITLE_SUB } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { carePeriodsQuery, createCarePeriod, toPeriodSpans } from "~/lib/care-periods/carePeriods.sync";
import { periodFromForm } from "~/lib/care-periods/periodFormData";
import { loadPlaceRows, usePlaceChoices } from "~/lib/care-periods/placeChoices";
import { useNow } from "~/lib/live-notes/editors.sync";
import { useLiveQuery } from "~/lib/sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { scheduleZoneNote } from "@caretook/data/schema";

// Shared by web + native. The setup flow's period step: the care period form
// on the page (with "Add as a new place"), posting here, written on the
// device as the periods page's add sheet writes it (offline too), then a
// fresh form; below it, the track so far, live, as the periods page lists it.

/**
 * The step's own defaults: care at home, from today (a date, since a
 * creator rarely knows the hour care began). The add sheet's come from its URL.
 */
const SETUP_PERIOD_PREFILL: PeriodPrefillValues = {
  type: "home",
  startedAt: null,
  dateOnly: true,
  placeProviderId: null,
};

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [rows, placeRows] = await Promise.all([
    readRows<CarePeriodRow>(db, carePeriodsQuery(group.id)),
    loadPlaceRows(db, group.id),
  ]);
  return { rows, placeRows };
}

/** As the add sheet saves: the period, and a place added with it, in one transaction. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { input, newPlace } = periodFromForm(await request.formData(), group.recipient?.timeZone ?? "UTC");
  const result = await createCarePeriod(db, group.id, input, newPlace);
  return result.ok ? { ok: true } : result;
}

/** The track and the places are live, so a save needn't reload them. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function SetupPeriod({ loaderData }: Route.ComponentProps) {
  const { id: groupId, recipient } = useGroup();
  const query = carePeriodsQuery(groupId);
  const rows = useLiveQuery<CarePeriodRow>(query.sql, query.params, loaderData.rows);
  const spans = useMemo(() => toPeriodSpans(rows), [rows]);
  const providers = usePlaceChoices(groupId, loaderData.placeRows);
  const places = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  // Once a minute, so "day N" turns over at midnight.
  const tick = useNow(60_000);
  const now = useMemo(() => new Date(tick), [tick]);
  const timeZone = recipient?.timeZone ?? "UTC";
  const zoneNote = scheduleZoneNote(timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);
  // Each save starts a new form.
  const [formKey, setFormKey] = useState(0);
  const added = useCallback(() => setFormKey((k) => k + 1), []);
  const addedId = useId();
  return (
    <>
      <Card title="Add a care period">
        <PeriodForm
          key={formKey}
          prefill={SETUP_PERIOD_PREFILL}
          providers={providers}
          timeZone={timeZone}
          zoneNote={zoneNote}
          onDone={added}
        />
      </Card>
      {spans.length > 0 && (
        <section aria-labelledby={addedId} className="space-y-2" data-setup-added="">
          <h2 id={addedId} className={TITLE_SUB}>
            Added
          </h2>
          <PeriodList groupId={groupId} spans={spans} places={places} timeZone={timeZone} now={now} />
        </section>
      )}
    </>
  );
}
