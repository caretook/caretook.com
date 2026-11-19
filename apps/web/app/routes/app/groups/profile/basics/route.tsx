import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";

import { redirect } from "react-router";
import { canEditRecipient } from "@caretook/data/schema";
import { Sheet } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { getGroup } from "~/lib/group";
import { rpc } from "~/lib/rpc";
import { sessionContext } from "~/lib/session";
import { loadRecipientProfileRows, toRecipientProfile, waitForRecipientProfile } from "~/lib/sync/profile";
import { basicsValues, parseBasics } from "../basicsFormData";
import { BasicsForm } from "../BasicsForm";
import { failedProfileSave, useCloseProfileSheet } from "../profileSheet";

// Shared by web + native. `…/profile/basics`: the sheet over the profile
// where writers edit the name, preferred name, birthday, the medical basics
// and the note for helpers. It starts from the device's copy, and saves
// online through `careGroup.updateRecipient`. A viewer, or a group with no
// recipient, lands on the profile.

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  if (!canEditRecipient(group.role, "basics")) throw redirect(appUrls.profile(group.id));
  const [row] = await loadRecipientProfileRows(db, params.groupId);
  if (!row) throw redirect(appUrls.profile(group.id));
  return { profile: toRecipientProfile(row) };
}

export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const parsed = parseBasics(basicsValues(await request.formData()));
  if (!parsed.ok) return parsed;
  try {
    await rpc.careGroup.updateRecipient({ groupId: params.groupId, ...parsed.data });
  } catch (e) {
    return failedProfileSave(e);
  }
  // The page reads the device's copy: wait for the change to sync back, so it shows when the sheet closes.
  await waitForRecipientProfile(db, params.groupId, parsed.data);
  return { ok: true };
}

/** The sheet closes on a save; nothing to load again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function BasicsSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseProfileSheet(params.groupId);
  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title="Edit profile">
      <BasicsForm profile={loaderData.profile} onDone={close} onCancel={close} />
    </Sheet>
  );
}
