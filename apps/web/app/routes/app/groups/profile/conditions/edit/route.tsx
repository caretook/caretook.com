import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { redirect } from "react-router";
import { Sheet } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
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
// change a condition's name, since and note (its status is the view's
// Resolve and Reactivate). A local write, so it works offline. A viewer lands
// on the condition; a missing or deleted one on the profile.

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const rows = await loadConditionRows(db, group.id, params.conditionId);
  const condition = rows[0] ? toCondition(rows[0]) : null;
  if (!condition) throw redirect(appUrls.profile(group.id));
  if (!group.canWrite) throw redirect(appUrls.condition(group.id, condition.id));
  return { rows, nameRows: await loadConditionNames(db, group.id) };
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
  const { name, sinceYear, sinceMonth, note } = action;
  return updateCondition(db, action.conditionId, { name, sinceYear, sinceMonth, note });
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
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => !open && close()}
      title={condition ? `Edit ${condition.name}` : "Edit condition"}
    >
      {condition ? (
        <ConditionForm condition={condition} groupNames={names} onDone={close} onCancel={close} />
      ) : (
        <ConditionGone onClose={close} />
      )}
    </Sheet>
  );
}
