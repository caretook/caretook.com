import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { LocalAllergy } from "~/lib/medications/allergies.sync";

import { useCallback, useState } from "react";
import { redirect } from "react-router";
import { Button, Sheet, TITLE_SECTION } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import {
  addAllergy,
  loadAllergies,
  removeAllergy,
  setNoKnownAllergies,
  updateAllergy,
  useAllergies,
} from "~/lib/medications/allergies.sync";
import { useCloseProfileSheet } from "../profileSheet";
import { allergyActionFromForm } from "./allergyActions";
import { AllergyForm } from "./AllergyForm";
import { AllergyList } from "./AllergyList";

// Shared by web + native. `…/profile/allergies`: the recipient's allergies in
// a sheet over the profile (opened from its Allergies section, from the
// Medications summary's Manage link, or the old `medications/<tab>/allergies`
// URL). Writers add, edit and remove allergies, and record "No known
// allergies" while there are none; adding one clears it. Local writes
// (lib/medications/allergies.sync.ts), so it works offline. A viewer lands on
// the profile.

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  if (!group.canWrite) throw redirect(appUrls.profile(group.id));
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
  const close = useCloseProfileSheet(params.groupId);
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
          <h3 id="allergy-form-heading" className={TITLE_SECTION}>
            {editing ? `Edit ${editing.substance}` : "Add an allergy"}
          </h3>
          {editing ? (
            <AllergyForm key={editing.id} allergy={editing} onDone={stopEditing} onCancel={stopEditing} />
          ) : (
            <AllergyForm key={`new-${added}`} onDone={addDone} />
          )}
        </section>
        <div className="flex justify-end">
          <Button onClick={() => close()} data-allergies-done="">
            Done
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
