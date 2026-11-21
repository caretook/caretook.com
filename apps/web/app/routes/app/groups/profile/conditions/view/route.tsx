import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { ConditionIntent } from "../ConditionDetails";

import { useEffect, useState } from "react";
import { redirect, useFetcher } from "react-router";
import { Sheet } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import {
  loadConditionRows,
  reactivateCondition,
  removeCondition,
  resolveCondition,
  toCondition,
  useCondition,
} from "~/lib/profiles/conditions.sync";
import { loadConditionMedications, useConditionMedications } from "~/lib/profiles/medicationConditions.sync";
import { loadConditionProviders, useConditionProviders } from "~/lib/profiles/conditionProviders.sync";
import { useCloseProfileSheet } from "../../profileSheet";
import { CONDITION_FIELD, conditionActionFromForm } from "../conditionActions";
import { ConditionDetails } from "../ConditionDetails";
import { ConditionGone } from "../ConditionGone";
import { ConditionMedications } from "../ConditionMedications";
import { ConditionProviders } from "../ConditionProviders";

// Shared by web + native. `…/profile/conditions/:conditionId`: one of the
// recipient's conditions in a sheet over the profile, for every member: its
// status, since and note, who diagnosed it and who manages it. Writers get Edit, Resolve or Reactivate, and Delete
// behind a confirm (for a mistake). Local writes, so it works offline. A
// missing or deleted condition lands on the profile.

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const rows = await loadConditionRows(db, group.id, params.conditionId);
  const condition = rows[0] ? toCondition(rows[0]) : null;
  if (!condition) throw redirect(appUrls.profile(group.id));
  const [medicationRows, providerRows] = await Promise.all([
    loadConditionMedications(db, params.conditionId),
    loadConditionProviders(db, condition.id, condition.diagnosedById),
  ]);
  return { rows, medicationRows, providerRows };
}

export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const action = conditionActionFromForm(await request.formData());
  if (!action || !("conditionId" in action) || action.conditionId !== params.conditionId)
    return { ok: false, error: "Nothing to do", issues: [] };
  switch (action.intent) {
    case "resolve":
      return resolveCondition(db, action.conditionId);
    case "reactivate":
      return reactivateCondition(db, action.conditionId);
    case "remove":
      return removeCondition(db, action.conditionId);
    default:
      return { ok: false, error: "Nothing to do", issues: [] };
  }
}

/** Live queries keep the sheet current. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function ConditionSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseProfileSheet(params.groupId);
  const group = useGroup();
  const condition = useCondition(params.groupId, params.conditionId, loaderData.rows);
  const medications = useConditionMedications(params.conditionId, loaderData.medicationRows);
  const providers = useConditionProviders(
    { id: params.conditionId, diagnosedById: condition?.diagnosedById ?? null },
    loaderData.providerRows,
  );
  const fetcher = useFetcher<ActionResult>();
  // Deleting it here closes the sheet (rather than saying it's gone).
  const [removed, setRemoved] = useState(false);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  useEffect(() => {
    if (removed && result?.ok) close();
  }, [removed, result, close]);
  const act = (intent: ConditionIntent) => {
    if (intent === "remove") setRemoved(true);
    void fetcher.submit(
      { [CONDITION_FIELD.intent]: intent, [CONDITION_FIELD.conditionId]: params.conditionId },
      { method: "post" },
    );
  };

  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title={condition?.name ?? "Condition"}>
      {condition ? (
        <ConditionDetails
          groupId={group.id}
          condition={condition}
          canWrite={group.canWrite}
          busy={fetcher.state !== "idle"}
          refusal={result && !result.ok ? result.error : null}
          medications={<ConditionMedications groupId={group.id} medications={medications} />}
          providers={<ConditionProviders groupId={group.id} providers={providers} />}
          onAction={act}
          onClose={close}
        />
      ) : removed ? null : (
        <ConditionGone onClose={close} />
      )}
    </Sheet>
  );
}
