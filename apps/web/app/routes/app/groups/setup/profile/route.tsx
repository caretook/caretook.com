import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { AllergiesSection, ConditionsSection } from "~/components/profiles";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { allergyActionFromForm } from "~/lib/medications/allergyActions";
import { loadAllergies, setNoKnownAllergies, useAllergies } from "~/lib/medications/allergies.sync";
import { conditionActionFromForm } from "~/lib/profiles/conditionActions";
import { loadConditions, setNoKnownConditions, useConditions } from "~/lib/profiles/conditions.sync";

// Shared by web + native. The setup flow's profile step: the Profile's
// Allergies and Conditions sections, working as they do there. "No known
// allergies" and "No known conditions" post here and write on the device
// (offline too); Add and Edit open the Profile's sheets, which close back
// to this page.

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const [allergies, conditionRows] = await Promise.all([
    loadAllergies(db, group.id),
    loadConditions(db, group.id),
  ]);
  return { allergies, conditionRows };
}

/** The sections' "No known allergies" and "No known conditions", as the Profile's action writes them. */
export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const form = await request.formData();
  const allergy = allergyActionFromForm(form);
  if (allergy?.intent === "noKnown") return setNoKnownAllergies(db, group.id, allergy.on);
  const condition = conditionActionFromForm(form);
  if (condition?.intent === "noKnownConditions") return setNoKnownConditions(db, group.id, condition.on);
  return { ok: false, error: "Nothing to do", issues: [] };
}

/** The sections are live, so a save needn't reload them. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function SetupProfile({ loaderData }: Route.ComponentProps) {
  const { id: groupId, canWrite } = useGroup();
  const { state: allergies } = useAllergies(groupId, loaderData.allergies);
  const conditions = useConditions(groupId, loaderData.conditionRows);
  return (
    <div data-setup-profile="">
      <AllergiesSection groupId={groupId} state={allergies} canWrite={canWrite} />
      <ConditionsSection groupId={groupId} state={conditions.state} canWrite={canWrite} />
    </div>
  );
}
