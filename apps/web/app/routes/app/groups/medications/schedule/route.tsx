import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { CreateResult } from "~/lib/core/api";

import { Outlet } from "react-router";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { loadDueDoses, useDueDoses } from "~/lib/medications/dueDoses.sync";
import { onlyMedicationSheetChanged } from "~/lib/medications/medicationSheets";
import { logDose } from "~/lib/medications/medications.sync";
import { todayDoseFromForm } from "../todayDose";
import { TodaySection } from "../TodaySection";

// Shared by web + native. The Medications page's Schedule tab (where the
// section opens): today's doses by pass, read from the device's local copy
// (live, so it works offline and follows other members' changes), logged in
// a tap. The header above it is the layout's.

/** Today's doses: the first render's rows, before the live queries take over. */
export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  return { due: await loadDueDoses(db, params.groupId) };
}

/** Today's doses (Given, Skipped, Refused, an as-needed Log): local writes, logged now; the dose's id, for its Undo. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<CreateResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const dose = todayDoseFromForm(await request.formData());
  if (!dose) return { ok: false, error: "Nothing to do", issues: [] };
  const result = await logDose(db, group.id, dose);
  return result.ok ? { ok: true, id: result.id } : result;
}

/**
 * The live queries already follow every change, so a dose logged here, a
 * save in a sheet, or opening and closing a sheet over this tab doesn't
 * rerun the loader. Anything else (another group) does.
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
  if (nextParams.groupId && onlyMedicationSheetChanged(nextParams.groupId, currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
}

export default function MedicationSchedule({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const { due, passes } = useDueDoses(params.groupId, loaderData.due);
  return (
    <>
      <TodaySection
        due={due}
        passes={passes}
        groupId={params.groupId}
        userId={group.userId}
        canWrite={group.canWrite}
      />
      {/* The add, edit and allergies sheets render here, over Schedule. */}
      <Outlet />
    </>
  );
}
