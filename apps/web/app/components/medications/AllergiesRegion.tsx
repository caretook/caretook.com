import type { AllergyState } from "~/lib/allergies";

import { ShieldAlert } from "lucide-react";
import { Link } from "react-router";
import { allergyText, NO_KNOWN_ALLERGIES, ALLERGIES_NOT_RECORDED } from "~/lib/allergies";
import { appUrls } from "~/lib/appUrls";
import { MEDICATION_SHEET_STATE } from "~/lib/medicationSheets";

/**
 * The recipient's allergies, at the top of the medication list and each
 * medication's page: "Allergies: Penicillin (hives, severe) · Sulfa", "No
 * known allergies", or "Allergies not recorded". Writers get "Add allergies"
 * (nothing recorded yet) or "Edit", which opens the allergies sheet; closing
 * it comes back here. Viewers get the text only.
 */
export function AllergiesRegion({
  groupId,
  state,
  canWrite,
}: {
  groupId: string;
  state: AllergyState;
  canWrite: boolean;
}) {
  const recorded = state.kind === "recorded";
  const severe = recorded && state.allergies.some((a) => a.severity === "severe");
  return (
    <section
      aria-label="Allergies"
      className={`rounded-box flex items-start gap-2.5 border px-3 py-2 ${
        recorded ? "border-warning bg-warning/10" : "border-base-300"
      }`}
      data-allergies={state.kind}
    >
      <ShieldAlert
        className={`mt-0.5 size-5 shrink-0 ${severe ? "text-error" : recorded ? "text-warning" : "text-base-content/60"}`}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-sm wrap-break-word" data-allergies-text>
        {recorded ? (
          <>
            <span className="font-semibold">Allergies: </span>
            {state.allergies.map((a, i) => (
              <span key={a.id} data-allergy={a.id}>
                {i > 0 && " · "}
                {allergyText(a)}
              </span>
            ))}
          </>
        ) : state.kind === "none" ? (
          <span className="font-semibold">{NO_KNOWN_ALLERGIES}</span>
        ) : (
          <span className="text-base-content/70">{ALLERGIES_NOT_RECORDED}</span>
        )}
      </p>
      {canWrite && (
        <Link
          to={appUrls.medicationAllergies(groupId)}
          // Closing the sheet comes back here.
          state={MEDICATION_SHEET_STATE}
          // Loaded ahead, so the sheet opens offline too.
          prefetch="render"
          preventScrollReset
          className="btn btn-ghost btn-xs shrink-0"
          data-edit-allergies
        >
          {state.kind === "notRecorded" ? "Add allergies" : "Edit"}
          {state.kind !== "notRecorded" && <span className="sr-only"> allergies</span>}
        </Link>
      )}
    </section>
  );
}
