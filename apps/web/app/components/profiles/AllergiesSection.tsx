import type { ActionResult } from "~/lib/core/api";
import type { AllergyState } from "~/lib/medications/allergies";

import { ShieldAlert } from "lucide-react";
import { useFetcher } from "react-router";
import { Button, ICON, List, ListRow, Message, Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { ALLERGIES_NOT_RECORDED, allergyText, NO_KNOWN_ALLERGIES } from "~/lib/medications/allergies";
import { ALLERGY_FIELD } from "~/lib/medications/allergyActions";
import { PROFILE_SHEET_STATE } from "~/lib/profiles/profileSheetLink";

/**
 * The recipient's allergies, after Basics and before Conditions, for every
 * member: each on file (most severe first, a severe one marked), or "No
 * known allergies", or "Allergies not recorded". Writers get Add or Edit,
 * which opens the allergies sheet over the profile (add, edit, remove), and
 * while none are on file "No known allergies" to record (or clear); the
 * profile's action writes it locally, so it works offline.
 */
export function AllergiesSection({
  groupId,
  state,
  canWrite,
}: {
  groupId: string;
  state: AllergyState;
  canWrite: boolean;
}) {
  const fetcher = useFetcher<ActionResult>();
  const refusal = fetcher.state === "idle" && fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const setNoKnown = (on: boolean) =>
    void fetcher.submit(
      { [ALLERGY_FIELD.intent]: "noKnown", [ALLERGY_FIELD.on]: on ? "1" : "0" },
      { method: "post" },
    );

  return (
    <Section
      id="allergies"
      title="Allergies"
      data-allergies={state.kind}
      actions={
        canWrite && (
          <Button
            to={appUrls.profileAllergies(groupId)}
            state={PROFILE_SHEET_STATE}
            // Loaded ahead, so the sheet opens offline too.
            prefetch="render"
            preventScrollReset
            variant="ghost"
            size="sm"
            data-edit-allergies=""
          >
            {state.kind === "recorded" ? "Edit" : "Add"}
            <span className="sr-only"> allergies</span>
          </Button>
        )
      }
    >
      {state.kind === "recorded" ? (
        <List data-allergy-list="">
          {state.allergies.map((allergy) => {
            const severe = allergy.severity === "severe";
            return (
              <ListRow key={allergy.id} data-allergy={allergy.id} data-severe={severe ? "" : undefined}>
                <span className="flex items-start gap-2">
                  {severe && (
                    <ShieldAlert className={`text-error-ink mt-0.5 ${ICON} shrink-0`} aria-hidden="true" />
                  )}
                  <span className={`min-w-0 wrap-break-word ${severe ? "font-semibold" : ""}`}>
                    {allergyText(allergy)}
                  </span>
                </span>
              </ListRow>
            );
          })}
        </List>
      ) : state.kind === "none" ? (
        <div className="flex items-center justify-between gap-2" data-no-known-allergies="">
          <p className="font-semibold">{NO_KNOWN_ALLERGIES}</p>
          {canWrite && (
            <Button variant="ghost" size="sm" onClick={() => setNoKnown(false)} data-clear-no-known="">
              Clear<span className="sr-only"> No known allergies</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2" data-allergies-not-recorded="">
          <p className="text-muted text-sm">{ALLERGIES_NOT_RECORDED}</p>
          {canWrite && (
            <Button size="sm" onClick={() => setNoKnown(true)} data-record-no-known="">
              {NO_KNOWN_ALLERGIES}
            </Button>
          )}
        </div>
      )}
      {refusal && <Message tone="error">{refusal}</Message>}
    </Section>
  );
}
