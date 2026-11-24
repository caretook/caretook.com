import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { ConditionProviderRows } from "~/lib/profiles/conditionProviders.sync";
import type { LocalCondition } from "~/lib/profiles/conditions.sync";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { useState } from "react";
import { redirect } from "react-router";
import { Sheet } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import {
  loadConditionProviders,
  loadFormProviders,
  useConditionProviders,
  useFormProviders,
} from "~/lib/profiles/conditionProviders.sync";
import {
  loadConditionNames,
  loadConditionRows,
  toCondition,
  updateCondition,
  useCondition,
  useConditionNames,
} from "~/lib/profiles/conditions.sync";
import { useCloseProfileSheet } from "../../profileSheet";
import { conditionActionFromForm } from "../conditionActions";
import { ConditionForm } from "../ConditionForm";
import { ConditionGone } from "../ConditionGone";

// Shared by web + native. `…/profile/conditions/:conditionId/edit`: writers
// change a condition's name, since, note, who diagnosed it and who manages
// it (its status is the view's
// Resolve and Reactivate). A local write, so it works offline. A viewer lands
// on the condition; a missing or deleted one on the profile.

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const rows = await loadConditionRows(db, group.id, params.conditionId);
  const condition = rows[0] ? toCondition(rows[0]) : null;
  if (!condition) throw redirect(appUrls.profile(group.id));
  if (!group.canWrite) throw redirect(appUrls.condition(group.id, condition.id));
  const [nameRows, providerRows, linked] = await Promise.all([
    loadConditionNames(db, group.id),
    loadFormProviders(db, group.id),
    loadConditionProviders(db, condition.id, condition.diagnosedById),
  ]);
  return { rows, nameRows, providerRows, linked };
}

export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const action = conditionActionFromForm(await request.formData());
  if (action?.intent !== "update" || action.conditionId !== params.conditionId)
    return { ok: false, error: "Nothing to do", issues: [] };
  const { name, sinceYear, sinceMonth, note, diagnosedById, providers } = action;
  return updateCondition(
    db,
    action.conditionId,
    { name, sinceYear, sinceMonth, note, diagnosedById },
    providers,
  );
}

/** Live queries keep the sheet current. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function EditConditionSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseProfileSheet(params.groupId);
  const condition = useCondition(params.groupId, params.conditionId, loaderData.rows);
  const names = useConditionNames(params.groupId, loaderData.nameRows);
  const providers = useFormProviders(params.groupId, loaderData.providerRows);
  return (
    <Sheet
      guardChanges
      isOpen
      onOpenChange={(open) => !open && close()}
      title={condition ? `Edit ${condition.name}` : "Edit condition"}
    >
      {condition ? (
        <EditForm
          condition={condition}
          names={names}
          providers={providers}
          linked={loaderData.linked}
          close={close}
        />
      ) : (
        <ConditionGone onClose={close} />
      )}
    </Sheet>
  );
}

/** The form, with who manages it as it opens (read once: the form owns the choice after that). */
function EditForm({
  condition,
  names,
  providers,
  linked,
  close,
}: {
  condition: LocalCondition;
  names: string[];
  providers: LocalProvider[];
  linked: ConditionProviderRows;
  close: () => void;
}) {
  const { managers } = useConditionProviders(condition, linked);
  const [managerIds] = useState(() => managers.map((m) => m.id));
  return (
    <ConditionForm
      condition={condition}
      groupNames={names}
      providers={providers}
      managerIds={managerIds}
      onDone={close}
      onCancel={close}
    />
  );
}
