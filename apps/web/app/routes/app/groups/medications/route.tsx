import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { MedicationRow } from "~/lib/medications/medications.sync";

import { Clock, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { AllergiesRegion } from "~/components/medications";
import { PageHeader } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { medicationList, parseMedicationFilters } from "~/lib/medications/medicationList";
import { MEDICATION_SHEET_STATE, onlyMedicationSheetChanged } from "~/lib/medications/medicationSheets";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery } from "~/lib/sync";
import { loadAllergies, useAllergies } from "~/lib/medications/allergies.sync";
import { loadDueDoses, useDueDoses } from "~/lib/medications/dueDoses.sync";
import { logDose, medicationsQuery, toMedications } from "~/lib/medications/medications.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { MedicationSearch, StatusFilter, TypeFilter } from "./MedicationFilters";
import { MedicationList } from "./MedicationList";
import { PrintMenu } from "./PrintMenu";
import { todayDoseFromForm } from "./todayDose";
import { TodaySection } from "./TodaySection";

// Shared by web + native. The group's medication list, read from the
// device's local copy (live, so it works offline and follows other members'
// changes), with Today above it (what's due, logged in a tap). Search
// (`?q=`) and the status (`?status=`) live in the URL; the list is filtered
// and ordered on the device (`lib/medications/medicationList.ts`).

export const meta = () => [{ title: "Medications · Caretook" }];

/** Every medication in the group (not deleted), and Today's: the first render's rows, before the live queries take over. */
export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const [rows, due, allergies] = await Promise.all([
    readRows<MedicationRow>(db, medicationsQuery(params.groupId)),
    loadDueDoses(db, params.groupId),
    loadAllergies(db, params.groupId),
  ]);
  return { rows, due, allergies };
}

/** Today's doses (Given, Skipped, Refused, an as-needed Log): local writes, logged now. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const dose = todayDoseFromForm(await request.formData());
  if (!dose) return { ok: false, error: "Nothing to do", issues: [] };
  const result = await logDose(db, group.id, dose);
  return result.ok ? { ok: true } : result;
}

/**
 * The live query already follows every change, and the filters are applied
 * on the device, so a new search or filter (same path), a save in a sheet,
 * or opening and closing a sheet over the list doesn't rerun the loader.
 * Anything else (another group) does.
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

export default function Medications({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const { search } = useLocation();
  const filters = parseMedicationFilters(search);

  const query = medicationsQuery(params.groupId);
  const rows = useLiveQuery<MedicationRow>(query.sql, query.params, loaderData.rows);
  const medications = useMemo(() => toMedications(rows), [rows]);
  const { due, passes } = useDueDoses(params.groupId, loaderData.due);
  const { state: allergies } = useAllergies(params.groupId, loaderData.allergies);

  // The box filters as you type; the URL follows (see `MedicationSearch`).
  const [text, setText] = useState(filters.q);
  const list = useMemo(
    () => medicationList(medications, { q: text, status: filters.status, type: filters.type }),
    [medications, text, filters.status, filters.type],
  );

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <PageHeader
        title="Medications"
        actions={
          <>
            {group.canWrite && (
              <Link
                to={appUrls.newMedication(params.groupId, search)}
                state={MEDICATION_SHEET_STATE}
                // Loaded ahead, so the sheet opens offline too.
                prefetch="render"
                preventScrollReset
                aria-label="Add medication"
                title="Add medication"
                className="btn btn-primary btn-sm btn-square"
                data-add-medication
              >
                <Plus className="size-4" aria-hidden="true" />
              </Link>
            )}
            <Link
              to={appUrls.medicationPasses(params.groupId)}
              prefetch="render"
              className="btn btn-ghost btn-sm gap-1.5"
              data-passes-link
            >
              <Clock className="size-4" aria-hidden="true" />
              Passes
            </Link>
            <PrintMenu groupId={params.groupId} />
          </>
        }
      />

      <AllergiesRegion groupId={params.groupId} state={allergies} canWrite={group.canWrite} />

      <TodaySection
        due={due}
        passes={passes}
        groupId={params.groupId}
        userId={group.userId}
        canWrite={group.canWrite}
      />

      <MedicationSearch value={text} urlQuery={filters.q} onChange={setText} />
      <StatusFilter status={filters.status} />
      <TypeFilter type={filters.type} />

      <MedicationList
        total={medications.length}
        list={list}
        passes={passes}
        text={text}
        status={filters.status}
        type={filters.type}
      />

      {/* The add, edit and allergies sheets render here, over the list. */}
      <Outlet />
    </main>
  );
}
