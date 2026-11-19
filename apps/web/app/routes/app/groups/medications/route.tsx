import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { MedicationRow } from "~/lib/sync/medications";

import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { getGroup, useGroup } from "~/lib/group";
import { medicationList, parseMedicationFilters } from "~/lib/medicationList";
import { sessionContext } from "~/lib/session";
import { useLiveQuery } from "~/lib/sync";
import { medicationsQuery, toMedications } from "~/lib/sync/medications";
import { readRows } from "~/lib/sync/timeline";
import { MedicationSearch, StatusFilter } from "./MedicationFilters";
import { MedicationList } from "./MedicationList";

// Shared by web + native. The group's medication list, read from the
// device's local copy (live, so it works offline and follows other members'
// changes). Search (`?q=`) and the status (`?status=`) live in the URL; the
// list is filtered and ordered on the device (`lib/medicationList.ts`).

export const meta = () => [{ title: "Medications · Caretook" }];

/** Every medication in the group (not deleted): the first render's rows, before the live query takes over. */
export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  return { rows: await readRows<MedicationRow>(db, medicationsQuery(params.groupId)) };
}

/**
 * The live query already follows every change, and the filters are applied
 * on the device, so a new search or filter (same path) or a save doesn't
 * rerun the loader. Anything else (another group) does.
 */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export default function Medications({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const { search } = useLocation();
  const filters = parseMedicationFilters(search);

  const query = medicationsQuery(params.groupId);
  const rows = useLiveQuery<MedicationRow>(query.sql, query.params, loaderData.rows);
  const medications = useMemo(() => toMedications(rows), [rows]);

  // The box filters as you type; the URL follows (see `MedicationSearch`).
  const [text, setText] = useState(filters.q);
  const list = useMemo(
    () => medicationList(medications, { q: text, status: filters.status }),
    [medications, text, filters.status],
  );

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Medications</h1>
          <p className="text-base-content/70 text-sm">
            {group.displayName}
            {!group.canWrite && " · You can view this list"}
          </p>
        </div>
        {/* Writers' "Add medication" goes here (the add sheet). */}
      </header>

      <MedicationSearch value={text} urlQuery={filters.q} onChange={setText} />
      <StatusFilter status={filters.status} />

      <MedicationList total={medications.length} list={list} text={text} status={filters.status} />

      {/* The add and edit sheets render here, over the list. */}
      <Outlet />
    </main>
  );
}
