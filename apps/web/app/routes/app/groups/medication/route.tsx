import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { StatusIntent } from "~/lib/medications/medicationStatusForm";
import type { MedicationRow } from "~/lib/medications/medications.sync";

import { Pencil } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AllergiesRegion, MedicationStatusActions } from "~/components/medications";
import { EditorAvatars, LiveNotesEditor } from "~/components/notes";
import { LinkedTasks } from "~/components/tasks";
import { BackLink } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { medicationTitle } from "~/lib/medications/medicationDisplay";
import { MEDICATION_SHEET_STATE } from "~/lib/medications/medicationSheets";
import { statusRequestFromForm } from "~/lib/medications/medicationStatusForm";
import { sessionContext } from "~/lib/auth/session";
import { getSync, useLiveQuery } from "~/lib/sync";
import { useAllergies } from "~/lib/medications/allergies.sync";
import { useSchedulePasses } from "~/lib/medications/medicationPasses.sync";
import {
  changeMedicationStatus,
  medicationQuery,
  removeMedication,
  toMedication,
} from "~/lib/medications/medications.sync";
import { loadMedication } from "./loadMedication";
import { MedicationDetails, MedicationRefills } from "./MedicationDetails";
import { MedicationHeader } from "./MedicationHeader";
import { MedicationHistory } from "./MedicationHistory";
import { MedicationProviders } from "./MedicationProviders";
import { useMedicationNotes } from "./useMedicationNotes";

// Shared by web + native. A medication's page: what it is and how it's
// taken, its prescriber and pharmacy, refills, its shared live notes ("crush
// into applesauce"), and its history (doses and changes, newest first). All
// local and live, like the provider page; the notes are the medication's
// document (its id is the medication's), created on the first real change.

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${medicationTitle(loaderData.medication)} · Caretook` : "Caretook" }];
}

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  return loadMedication(db, params.groupId, params.medicationId);
}

/**
 * The header's status actions (Mark completed, Discontinue, Restart,
 * Delete): local writes, with their change entries; the page's live queries
 * show them, and PowerSync uploads them.
 */
export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const status = statusRequestFromForm(await request.formData());
  if (!status) return { ok: false, error: "Nothing to do", issues: [] };
  if (status.intent === "remove") return removeMedication(db, params.medicationId);
  return changeMedicationStatus(db, params.medicationId, status.change);
}

/** Live queries keep the page current, so submissions need no reload. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function Medication(props: Route.ComponentProps) {
  // Another medication is another page (and another document): start fresh.
  return <MedicationPage key={props.loaderData.medication.id} {...props} />;
}

function MedicationPage({ loaderData, params }: Route.ComponentProps) {
  const { groupId, medicationId } = params;
  // Live: a role changed on another device shows without a reload.
  const { canWrite } = useGroup();
  // Read once: after sign-out closes the database, this page may render once more before it goes.
  const [db] = useState(getSync);
  const listUrl = appUrls.medications(groupId);

  // The medication, live: other members' edits, and deletion.
  const query = medicationQuery(medicationId);
  const rows = useLiveQuery<MedicationRow>(query.sql, query.params, loaderData.medicationRows);
  const live = rows[0] ? toMedication(rows[0]) : null;
  const medication = live ?? loaderData.medication;
  const deleted = !live || !!live.deletedAt || live.groupId !== groupId;
  const passes = useSchedulePasses(groupId, loaderData.passRows);

  const { state: allergies } = useAllergies(groupId, loaderData.allergies);
  const { ensureSaved, saveError } = useMedicationNotes(medicationId, loaderData.hasDocument);
  const title = medicationTitle(medication);
  const navigate = useNavigate();
  // Deleted from here: back to the list (the page would only say it's gone).
  // Keyed on the live row, not the write's result: the row can show the
  // delete first, which unmounts the actions before they hear the result.
  const removedHere = useRef(false);
  const statusSent = useCallback((intent: StatusIntent) => {
    if (intent === "remove") removedHere.current = true;
  }, []);
  useEffect(() => {
    if (deleted && removedHere.current) void navigate(listUrl, { replace: true });
  }, [deleted, navigate, listUrl]);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <BackLink to={listUrl} label="Medications" />

      <MedicationHeader
        medication={medication}
        editors={
          !deleted && <EditorAvatars documentId={medicationId} groupId={groupId} viewerId={db.userId} />
        }
        actions={
          canWrite && (
            <>
              <Link
                to={appUrls.editMedication(groupId, medicationId)}
                // Closing the sheet comes back here.
                state={MEDICATION_SHEET_STATE}
                prefetch="render"
                className="btn btn-ghost btn-sm gap-1"
                data-edit-medication
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Link>
              <MedicationStatusActions
                medication={medication}
                recipientTimeZone={loaderData.recipientTimeZone}
                layout="menu"
                onSubmit={statusSent}
              />
            </>
          )
        }
      />

      {deleted ? (
        <div role="alert" className="alert">
          <span>This medication was deleted.</span>
          <Link to={listUrl} className="btn btn-sm">
            Back to medications
          </Link>
        </div>
      ) : (
        <>
          <AllergiesRegion groupId={groupId} state={allergies} canWrite={canWrite} />

          <MedicationDetails
            medication={medication}
            passes={passes}
            recipientTimeZone={loaderData.recipientTimeZone}
          />

          <MedicationProviders
            groupId={groupId}
            prescriberId={medication.prescriberId}
            pharmacyId={medication.pharmacyId}
            initialRows={loaderData.providerRows}
          />

          <MedicationRefills medication={medication} />

          <LinkedTasks link={{ medicationId }} />

          <section aria-labelledby="medication-notes-heading" className="space-y-2">
            <div>
              <h2 id="medication-notes-heading" className="font-semibold">
                Notes
              </h2>
              <p className="text-base-content/70 text-sm">
                {canWrite
                  ? "Shared with the care group: how to give it, what to watch for, refill tips."
                  : "Shared with the care group. You can view these notes."}
              </p>
            </div>
            {saveError && (
              <p role="alert" className="text-error text-sm">
                {saveError}
              </p>
            )}
            <LiveNotesEditor
              key={medicationId}
              label={`Notes on ${title}`}
              db={db}
              documentId={medicationId}
              groupId={groupId}
              canWrite={canWrite}
              initial={loaderData.initial}
              ensureSaved={ensureSaved}
            />
          </section>

          <MedicationHistory
            groupId={groupId}
            medicationId={medicationId}
            initialRows={loaderData.historyRows}
            initialMembers={loaderData.memberRows}
            passes={passes}
          />
        </>
      )}
    </main>
  );
}
