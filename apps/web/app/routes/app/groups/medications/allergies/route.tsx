import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { LocalAllergy } from "~/lib/medications/allergies.sync";

import { useCallback, useState } from "react";
import { redirect } from "react-router";
import { Sheet } from "~/components/ui";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { allergiesSheetGuard, sheetTab } from "~/lib/medications/medicationSheets";
import { sessionContext } from "~/lib/auth/session";
import {
  addAllergy,
  loadAllergies,
  removeAllergy,
  setNoKnownAllergies,
  updateAllergy,
  useAllergies,
} from "~/lib/medications/allergies.sync";
import { useCloseMedicationSheet } from "../medicationSheet";
import { allergyActionFromForm } from "./allergyActions";
import { AllergyForm } from "./AllergyForm";
import { AllergyList } from "./AllergyList";

// Shared by web + native. `medications/<tab>/allergies`: the recipient's allergies
// in a sheet over the list (opened from the list or a medication's page, and
// closing back there). Writers add, edit and remove allergies, and record "No
// known allergies" while there are none; adding one clears it. Local writes
// (lib/medications/allergies.sync.ts), so it works offline. A viewer lands on the list.

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const url = new URL(request.url);
  const decision = allergiesSheetGuard({
    groupId: group.id,
    tab: sheetTab(group.id, url.pathname),
    search: url.search,
    canWrite: group.canWrite,
  });
  if ("redirect" in decision) throw redirect(decision.redirect);
  const { db } = context.get(sessionContext);
  return loadAllergies(db, group.id);
}

export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const action = allergyActionFromForm(await request.formData());
  if (!action) return { ok: false, error: "Nothing to do", issues: [] };
  switch (action.intent) {
    case "create":
    case "update": {
      const { substance, reaction, severity } = action;
      return action.intent === "create"
        ? addAllergy(db, group.id, { substance, reaction, severity })
        : updateAllergy(db, action.allergyId, { substance, reaction, severity });
    }
    case "remove":
      return removeAllergy(db, action.allergyId);
    case "noKnown":
      return setNoKnownAllergies(db, group.id, action.on);
  }
}

/** Live queries keep the sheet current. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function AllergiesSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseMedicationSheet();
  const { recipient } = useGroup();
  const { state } = useAllergies(params.groupId, loaderData);
  const [editing, setEditing] = useState<LocalAllergy | null>(null);
  // Each add starts a fresh form.
  const [added, setAdded] = useState(0);
  const stopEditing = useCallback(() => setEditing(null), []);
  const addDone = useCallback(() => setAdded((n) => n + 1), []);
  const who = recipient?.displayName;

  return (
    <Sheet
      guardChanges="[data-allergy-form]"
      isOpen
      onOpenChange={(open) => !open && close()}
      title={who ? `${who}'s allergies` : "Allergies"}
    >
      <div className="space-y-5" data-allergies-sheet>
        <AllergyList state={state} onEdit={setEditing} />
        <section aria-labelledby="allergy-form-heading" className="space-y-1">
          <h3 id="allergy-form-heading" className="font-semibold">
            {editing ? `Edit ${editing.substance}` : "Add an allergy"}
          </h3>
          {editing ? (
            <AllergyForm key={editing.id} allergy={editing} onDone={stopEditing} onCancel={stopEditing} />
          ) : (
            <AllergyForm key={`new-${added}`} onDone={addDone} />
          )}
        </section>
        <div className="flex justify-end">
          <button type="button" className="btn" onClick={() => close()} data-allergies-done>
            Done
          </button>
        </div>
      </div>
    </Sheet>
  );
}
