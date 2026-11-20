import type { ActionResult } from "~/lib/core/api";
import type { JoinRequestRow, LinkRow } from "./linkRules";

import { formString } from "~/lib/core/form";
import { rpc } from "~/lib/core/rpc";
import { failedSave } from "../api";
import { inviteRefusal } from "./invites";
import { DEFAULT_INVITE_OPTIONS, linkRoles, parseLinkForm, requestRefusal } from "./linkRules";

// How the Members page reads and changes invite links and join requests.
// Neither syncs (requests carry addresses, links their tokens), so both come
// from the API: online, for owners and admins only. Revoking a link is the
// email invites' `revokeInvite` (inviteApi.ts).

export type LinkActionResult = { ok: true; created?: boolean } | Extract<ActionResult, { ok: false }>;

/**
 * The group's links and waiting requests, and what the invite controls may
 * offer (admin settings), or none (offline, or not a manager).
 */
export const loadLinksAndRequests = async (groupId: string, myRole: string | null, online: boolean) => {
  const none = {
    links: [] as LinkRow[],
    requests: [] as JoinRequestRow[],
    inviteOptions: DEFAULT_INVITE_OPTIONS,
  };
  if (!online || !linkRoles(myRole).length) return none;
  try {
    const [links, requests, inviteOptions] = await Promise.all([
      rpc.invite.listLinks({ groupId }),
      rpc.joinRequest.list({ groupId }),
      rpc.invite.options({ groupId }),
    ]);
    return {
      links: links as LinkRow[],
      requests: requests as JoinRequestRow[],
      inviteOptions,
    };
  } catch (e) {
    // Lost the connection since the page started loading.
    if (e instanceof TypeError) return none;
    throw e;
  }
};

export const LINK_INTENTS = ["createLink", "approveRequest", "declineRequest"] as const;
export const isLinkIntent = (intent: string) => (LINK_INTENTS as readonly string[]).includes(intent);

/** The Members page's link and request intents, through the API. */
export const linkAction = async (
  intent: string,
  form: FormData,
  groupId: string,
  myRole: string | null,
): Promise<LinkActionResult> => {
  try {
    if (intent === "createLink") {
      const parsed = parseLinkForm(
        {
          role: formString(form, "role"),
          expiresInDays: formString(form, "expiresInDays"),
          maxUses: formString(form, "maxUses"),
        },
        myRole,
      );
      if (!parsed.ok) return parsed;
      await rpc.invite.createLink({ groupId, ...parsed.data });
      return { ok: true, created: true };
    }
    const id = formString(form, "requestId");
    if (intent === "approveRequest") await rpc.joinRequest.approve({ id });
    else await rpc.joinRequest.decline({ id });
    return { ok: true };
  } catch (e) {
    return failedSave(e, (err) => requestRefusal(err) ?? inviteRefusal(err));
  }
};
