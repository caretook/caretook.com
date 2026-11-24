import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { MedicationRow } from "~/lib/medications/medications.sync";

import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { AllergiesRegion } from "~/components/medications";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { loadAllergies, useAllergies } from "~/lib/medications/allergies.sync";
import { useDueDoses } from "~/lib/medications/dueDoses.sync";
import { medicationList, parseMedicationFilters } from "~/lib/medications/medicationList";
import { loadSchedulePasses, useSchedulePasses } from "~/lib/medications/medicationPasses.sync";
import { onlyMedicationSheetChanged } from "~/lib/medications/medicationSheets";
import { medicationsQuery, toMedications } from "~/lib/medications/medications.sync";
import { useLiveQuery } from "~/lib/sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { MedicationFilterRow } from "../MedicationFilters";
import { MedicationList } from "../MedicationList";

// Shared by web + native. The Medications page's list tab: the recipient's
// allergies, then the group's medications, read from the device's local copy
// (live, so it works offline and follows other members' changes). Search
// (`?q=`), the status (`?status=`) and the type (`?type=`) live in the URL
// (the search box, then one Filter menu for status and type);
// the list is filtered and ordered on the device
// (`lib/medications/medicationList.ts`). The header above it is the layout's.

/** Every medication in the group (not deleted), the passes and the allergies: the first render's rows. */
export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const [rows, passRows, allergies] = await Promise.all([
    readRows<MedicationRow>(db, medicationsQuery(params.groupId)),
    loadSchedulePasses(db, params.groupId),
    loadAllergies(db, params.groupId),
  ]);
  return { rows, passRows, allergies };
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

export default function MedicationListTab({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const { search } = useLocation();
  const filters = parseMedicationFilters(search);

  const query = medicationsQuery(params.groupId);
  const rows = useLiveQuery<MedicationRow>(query.sql, query.params, loaderData.rows);
  const medications = useMemo(() => toMedications(rows), [rows]);
  const passes = useSchedulePasses(params.groupId, loaderData.passRows);
  const { state: allergies } = useAllergies(params.groupId, loaderData.allergies);
  // Today's doses, for an as-needed Log's "Log anyway?" (read as Schedule does).
  const { due, ready: dueReady } = useDueDoses(params.groupId);

  // The box filters as you type; the URL follows (see `MedicationSearch`).
  const [text, setText] = useState(filters.q);
  const list = useMemo(
    () => medicationList(medications, { q: text, status: filters.status, type: filters.type }),
    [medications, text, filters.status, filters.type],
  );

  return (
    <>
      <AllergiesRegion groupId={params.groupId} state={allergies} canWrite={group.canWrite} />

      <MedicationFilterRow
        value={text}
        urlQuery={filters.q}
        onChange={setText}
        status={filters.status}
        type={filters.type}
      />

      <MedicationList
        total={medications.length}
        list={list}
        passes={passes}
        text={text}
        status={filters.status}
        type={filters.type}
        due={due}
        dueReady={dueReady}
      />

      {/* The add, edit and allergies sheets render here, over the list. */}
      <Outlet />
    </>
  );
}
