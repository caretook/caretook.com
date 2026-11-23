import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { CarePeriodRow } from "~/lib/care-periods/carePeriods.sync";

import { useEffect } from "react";
import { redirect } from "react-router";
import { Sheet } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { periodTitle } from "~/lib/care-periods/periodDisplay";
import { editPeriodGuard, parsePeriodPrefill } from "~/lib/care-periods/periodSheets";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery } from "~/lib/sync";
import { carePeriodQuery, toCarePeriod, updateCarePeriod } from "~/lib/care-periods/carePeriods.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { PeriodForm } from "../PeriodForm";
import { periodFromForm } from "../periodFormData";
import { loadPlaceRows, useClosePeriodSheet, usePlaceChoices } from "../periodSheet";

// Shared by web + native. `periods/:periodId/edit`: the edit sheet, over the
// periods page (opened from a period's page, which it goes back to). The same
// form as adding; a moved start moves the end of the period before it. A
// viewer, and a period that's missing, deleted or in another group, land on
// the periods page.

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const periodRows = await readRows<CarePeriodRow>(db, carePeriodQuery(params.periodId));
  const decision = editPeriodGuard({
    groupId: group.id,
    canWrite: group.canWrite,
    period: periodRows[0] ? toCarePeriod(periodRows[0]) : null,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  return { period: decision.sheet, periodRows, placeRows: await loadPlaceRows(db, group.id) };
}

/**
 * A local write (the edit, and a place added with it, in one transaction);
 * the pages' live queries show it, and PowerSync uploads it.
 */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { input, newPlace } = periodFromForm(await request.formData(), group.recipient?.timeZone ?? "UTC");
  const result = await updateCarePeriod(db, params.periodId, input, newPlace);
  return result.ok ? { ok: true } : result;
}

/** The sheet closes on a save, so its own loader needn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function EditPeriodSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useClosePeriodSheet();
  const group = useGroup();
  const providers = usePlaceChoices(params.groupId, loaderData.placeRows);
  const timeZone = group.recipient?.timeZone ?? "UTC";
  const zoneNote = scheduleZoneNote(timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Deleted while open (on another device): the page it came from is gone too, so the list.
  const query = carePeriodQuery(params.periodId);
  const rows = useLiveQuery<CarePeriodRow>(query.sql, query.params, loaderData.periodRows);
  const live = rows[0] ? toCarePeriod(rows[0]) : null;
  const gone = !live || !!live.deletedAt;
  useEffect(() => {
    if (gone) close(true);
  }, [gone, close]);

  return (
    <Sheet
      guardChanges
      isOpen
      onOpenChange={(open) => !open && close()}
      title={`Edit ${periodTitle(loaderData.period)}`}
    >
      <PeriodForm
        key={loaderData.period.id}
        period={loaderData.period}
        prefill={parsePeriodPrefill("")}
        providers={providers}
        timeZone={timeZone}
        zoneNote={zoneNote}
        onDone={() => close()}
        onCancel={() => close()}
      />
    </Sheet>
  );
}
