import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { redirect } from "react-router";
import { Sheet } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { loadFormProviders, useFormProviders } from "~/lib/profiles/conditionProviders.sync";
import { addCondition, loadConditionNames, useConditionNames } from "~/lib/profiles/conditions.sync";
import { useCloseProfileSheet } from "../../profileSheet";
import { conditionActionFromForm } from "../conditionActions";
import { ConditionForm } from "../ConditionForm";

// Shared by web + native. `…/profile/conditions/new`: the sheet over the
// profile where writers add one of the recipient's conditions (with who
// diagnosed it and who manages it, and any provider added by name). A local write
// (lib/profiles/conditions.sync.ts), so it works offline. A viewer lands on
// the profile.

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  if (!group.canWrite) throw redirect(appUrls.profile(group.id));
  const { db } = context.get(sessionContext);
  const [nameRows, providerRows] = await Promise.all([
    loadConditionNames(db, group.id),
    loadFormProviders(db, group.id),
  ]);
  return { nameRows, providerRows };
}

export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const action = conditionActionFromForm(await request.formData());
  if (action?.intent !== "create") return { ok: false, error: "Nothing to do", issues: [] };
  const { intent: _, providers, ...content } = action;
  return addCondition(db, group.id, content, providers);
}

/** Live queries keep the sheet current. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function NewConditionSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseProfileSheet(params.groupId);
  const { recipient } = useGroup();
  const names = useConditionNames(params.groupId, loaderData.nameRows);
  const providers = useFormProviders(params.groupId, loaderData.providerRows);
  const who = recipient?.displayName;
  return (
    <Sheet
      guardChanges
      isOpen
      onOpenChange={(open) => !open && close()}
      title={who ? `Add a condition for ${who}` : "Add a condition"}
    >
      <ConditionForm groupNames={names} providers={providers} onDone={close} onCancel={close} />
    </Sheet>
  );
}
