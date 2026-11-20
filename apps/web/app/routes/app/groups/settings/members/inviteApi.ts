import type { ActionResult } from "~/lib/core/api";
import type { InviteRow } from "./invites";

import { formString } from "~/lib/core/form";
import { rpc } from "~/lib/core/rpc";
import { failedSave } from "../api";
import { emailInviteRoles, inviteRefusal, parseInviteForm } from "./invites";

// How the Members page reads and changes invites. Invites don't sync (they
// carry addresses), so they come from the API: online, for owners and admins only.

/** What an invite action returns: a sent invite says to whom. */
export type InviteActionResult = { ok: true; sentTo?: string } | Extract<ActionResult, { ok: false }>;

/** The group's waiting and recently declined invites, or none (offline, or not a manager). */
export const loadInvites = async (groupId: string, myRole: string | null, online: boolean) => {
  if (!online || !emailInviteRoles(myRole).length) return [] as InviteRow[];
  try {
    return (await rpc.invite.listForGroup({ groupId })) as InviteRow[];
  } catch (e) {
    // Lost the connection, or the role, since the page started loading.
    if (e instanceof TypeError) return [];
    throw e;
  }
};

export const INVITE_INTENTS = ["invite", "resendInvite", "revokeInvite"] as const;
export const isInviteIntent = (intent: string) => (INVITE_INTENTS as readonly string[]).includes(intent);

/** The Members page's invite intents (`invite`, `resendInvite`, `revokeInvite`), through the API. */
export const inviteAction = async (
  intent: string,
  form: FormData,
  groupId: string,
  myRole: string | null,
): Promise<InviteActionResult> => {
  try {
    if (intent === "invite") {
      const parsed = parseInviteForm(
        {
          email: formString(form, "email"),
          role: formString(form, "role"),
          attested: formString(form, "attested"),
        },
        myRole,
      );
      if (!parsed.ok) return parsed;
      const sent = await rpc.invite.createEmail({ groupId, ...parsed.data, attested: true });
      return { ok: true, sentTo: sent.email ?? parsed.data.email };
    }
    const id = formString(form, "inviteId");
    if (intent === "resendInvite") {
      const sent = await rpc.invite.resend({ id });
      return { ok: true, sentTo: sent.email ?? "" };
    }
    await rpc.invite.revoke({ id });
    return { ok: true };
  } catch (e) {
    return failedSave(e, inviteRefusal);
  }
};
