import type { RouterContextProvider } from "react-router";
import type { ActionResult, FieldIssue } from "~/lib/core/api";
import type { SavedDetails } from "~/lib/profiles/recipientDetails";

import { redirect } from "react-router";
import { canEditRecipient } from "@caretook/data/schema";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup } from "~/lib/app-shell/group";
import { toRecipientDetails } from "~/lib/profiles/recipientDetails";
import { rpc } from "~/lib/core/rpc";
import { sessionContext } from "~/lib/auth/session";
import { loadRecipientDetailsRows, waitForRecipientDetails } from "~/lib/profiles/recipientDetails.sync";
import { failedProfileSave } from "./profileSheet";

// The writers' sheets over the profile (`profile/contact`, `profile/insurance`):
// one guard and one save. A viewer (whose device has no details) lands on
// the profile; a writer starts from the device's copy, and saves online
// through `careGroup.updateRecipientDetails`.

/** A writers' sheet's loader: the details as the device has them, or the profile for anyone else. */
export async function loadDetailsSheet(context: Readonly<RouterContextProvider>, groupId: string) {
  const group = getGroup(context);
  if (!canEditRecipient(group.role, "details")) throw redirect(appUrls.profile(group.id));
  const { db } = context.get(sessionContext);
  const [row] = await loadRecipientDetailsRows(db, groupId);
  return { details: toRecipientDetails(row) };
}

/**
 * Save part of the details online, then wait for it to sync back, so the
 * page shows it when the sheet closes. `mapIssues` moves the server's field
 * issues onto the form's rows.
 */
export async function saveDetails(
  context: Readonly<RouterContextProvider>,
  groupId: string,
  change: SavedDetails,
  mapIssues: (issues: FieldIssue[]) => FieldIssue[] = (issues) => issues,
): Promise<ActionResult> {
  getGroup(context);
  const { db } = context.get(sessionContext);
  try {
    await rpc.careGroup.updateRecipientDetails({ groupId, ...change });
  } catch (e) {
    const failed = failedProfileSave(e);
    return failed.ok ? failed : { ...failed, issues: mapIssues(failed.issues) };
  }
  await waitForRecipientDetails(db, groupId, change);
  return { ok: true };
}
