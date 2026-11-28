import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { redirect, useLocation } from "react-router";
import { Sheet } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { newPeriodGuard, parsePeriodPrefill } from "~/lib/care-periods/periodSheets";
import { sessionContext } from "~/lib/auth/session";
import { createCarePeriod } from "~/lib/care-periods/carePeriods.sync";
import { PeriodForm } from "../PeriodForm";
import { periodFromForm } from "../periodFormData";
import { loadPlaceRows, useClosePeriodSheet, usePlaceChoices } from "../periodSheet";
import { scheduleZoneNote } from "@caretook/data/schema";

// Shared by web + native. `periods/new`: the add sheet, over the periods
// page. It reads its prefills from the URL (a type, a start, date-only, a
// place). A viewer lands on the periods page.

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const decision = newPeriodGuard({ groupId: group.id, canWrite: group.canWrite });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const { db } = context.get(sessionContext);
  return { placeRows: await loadPlaceRows(db, group.id) };
}

/**
 * A local write (the period, and a place added with it, in one
 * transaction); the page's live query shows it, and PowerSync uploads it.
 */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const { input, newPlace } = periodFromForm(await request.formData(), group.recipient?.timeZone ?? "UTC");
  const result = await createCarePeriod(db, group.id, input, newPlace);
  return result.ok ? { ok: true } : result;
}

/** The sheet closes on a save, so its own loader needn't run again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function NewPeriodSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useClosePeriodSheet();
  const group = useGroup();
  const { search } = useLocation();
  const providers = usePlaceChoices(params.groupId, loaderData.placeRows);
  const timeZone = group.recipient?.timeZone ?? "UTC";
  const zoneNote = scheduleZoneNote(timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);
  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && close()} title="Add a care period">
      <PeriodForm
        // A new URL is a new form.
        key={search}
        prefill={parsePeriodPrefill(search)}
        providers={providers}
        timeZone={timeZone}
        zoneNote={zoneNote}
        onDone={() => close()}
        onCancel={() => close()}
      />
    </Sheet>
  );
}
