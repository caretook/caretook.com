import type { RouterContextProvider } from "react-router";
import type { ActionResult } from "~/lib/core/api";
import type { EmergencySave } from "~/lib/profiles/emergencyList";

import { outsideContactsZSchema } from "@caretook/data/schema";
import { redirect } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { EMERGENCY_FIELD, outsideFieldName, parseEmergencySave } from "~/lib/profiles/emergencyList";
import { getGroup } from "~/lib/app-shell/group";
import { toRecipientDetails } from "~/lib/profiles/recipientDetails";
import { rpc } from "~/lib/core/rpc";
import { sessionContext } from "~/lib/auth/session";
import { loadMemberDetailRows, waitForEmergencyList } from "~/lib/care-groups/members.sync";
import { loadRecipientDetailsRows } from "~/lib/profiles/recipientDetails.sync";
import { failedProfileSave } from "./profileSheet";
import { canManageEmergencyContacts } from "@caretook/data/domain";

// The `profile/emergency` sheet's loader and save (owners and admins only).
// The save is three online calls, in order: the outside contacts, the whole
// list's order, then the primary contact. Then it waits for the list to sync
// back, so the profile shows it when the sheet closes.

/** The members and outside contacts as the device has them; anyone but a manager lands on the profile. */
export async function loadEmergencySheet(context: Readonly<RouterContextProvider>, groupId: string) {
  const group = getGroup(context);
  if (!canManageEmergencyContacts(group.role)) throw redirect(appUrls.profile(group.id));
  const { db } = context.get(sessionContext);
  const [members, [row]] = await Promise.all([
    loadMemberDetailRows(db, groupId),
    loadRecipientDetailsRows(db, groupId),
  ]);
  return { members, outside: toRecipientDetails(row).outsideContacts };
}

const invalid = (issues: { path: string; message: string }[]): ActionResult => ({
  ok: false,
  error: "Check the highlighted fields.",
  issues,
});

/** Save the posted list (see the module comment). */
export async function saveEmergencySheet(
  context: Readonly<RouterContextProvider>,
  groupId: string,
  form: FormData,
): Promise<ActionResult> {
  getGroup(context);
  const save: EmergencySave | null = parseEmergencySave(form.get(EMERGENCY_FIELD));
  if (!save) return { ok: false, error: "Something went wrong. Try again.", issues: [] };

  // The outside contacts' fields, checked here first so errors show on their rows.
  const parsed = outsideContactsZSchema.safeParse(save.outside);
  if (!parsed.success) {
    return invalid(
      parsed.error.issues.flatMap(({ path, message }) => {
        const [index, field] = path;
        const id = typeof index === "number" ? save.outside[index]?.id : undefined;
        if (!id || (field !== "name" && field !== "relationship" && field !== "phone")) return [];
        return [{ path: outsideFieldName(id, field), message }];
      }),
    );
  }

  const { db } = context.get(sessionContext);
  try {
    await rpc.careGroup.updateOutsideContacts({ groupId, contacts: parsed.data });
    await rpc.careGroup.setEmergencyContacts({ groupId, contacts: save.order });
    await rpc.careGroup.setPrimaryContact({ groupId, userId: save.primaryUserId });
  } catch (e) {
    return failedProfileSave(e);
  }
  await waitForEmergencyList(db, groupId, save);
  return { ok: true };
}
