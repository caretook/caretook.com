import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/core/api";
import type { MemberDetailRow } from "~/lib/care-groups/members.sync";
import type { InviteActionResult } from "./inviteApi";
import type { LinkActionResult } from "./linkApi";

import { ORPCError } from "@orpc/client";
import { redirect } from "react-router";
import { load } from "~/lib/core/api";
import { SettingsCard, SettingsPage } from "~/components/settings";
import { appUrls } from "~/lib/app-shell/appUrls";
import { formString } from "~/lib/core/form";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { rpc } from "~/lib/core/rpc";
import { sessionContext } from "~/lib/auth/session";
import { sharingFromForm } from "~/lib/profiles/memberContact";
import { memberDetailsQuery, waitForMembershipGone } from "~/lib/care-groups/members.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { failedSave, loadRecipientProfile } from "../api";
import { MEMBER_ROLES, NEEDS_CONNECTION } from "../groupSettings";
import { inviteAction, isInviteIntent, loadInvites } from "./inviteApi";
import { emailInviteRoles } from "./invites";
import { InviteButton } from "./InviteSheet";
import { CreateLinkButton, InviteLinks } from "./InviteLinks";
import { JoinRequests } from "./JoinRequests";
import { isLinkIntent, linkAction, loadLinksAndRequests } from "./linkApi";
import { Members } from "./MembersList";
import { PendingInvites } from "./PendingInvites";

// `…/settings/members`. Shared by web + native. Members and roles come from
// the device's local copy (live, so they work offline and follow other
// members' changes). Changing a role (the easy roles too: there are no
// easy-mode switches), removing and leaving go through the API: online only. So do invites (`InviteSheet`, `PendingInvites`), which
// owners and admins send, resend and revoke here, and invite links and the
// requests to join they bring (`InviteLinks`, `JoinRequests`). Each member's
// relationship and shared contact details come from the local copy too; your
// own choices for the group save through the API (`updateSharing`), offered
// from your account's contact details (`me.contact`, online only).

export const meta = () => [{ title: "Members · Group settings · Caretook" }];

export { shouldRevalidate } from "../api";

/**
 * The members from the local copy (the group itself comes from the group
 * route). The API read only says whether the page can reach the server:
 * without a connection it loads read-only (`online: false`).
 */
export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const members = await readRows<MemberDetailRow>(db, memberDetailsQuery(groupId));
  const { online } = await loadRecipientProfile(request, groupId);
  const [invites, { links, requests, inviteOptions }, myContact] = await Promise.all([
    loadInvites(groupId, group.role, online),
    loadLinksAndRequests(groupId, group.role, online),
    online ? load(request, rpc.me.contact()).catch(offlineIsNull) : null,
  ]);
  return { userId: db.userId, groupId, members, online, invites, links, requests, inviteOptions, myContact };
}

/** A read that lost the connection after the page's first one: nothing, as offline. */
const offlineIsNull = (e: unknown) => {
  if (e instanceof TypeError) return null;
  throw e;
};

export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult | InviteActionResult | LinkActionResult> {
  const { groupId } = params;
  const form = await request.formData();
  const intent = formString(form, "intent");
  if (isInviteIntent(intent)) return inviteAction(intent, form, groupId, getGroup(context).role);
  if (isLinkIntent(intent)) return linkAction(intent, form, groupId, getGroup(context).role);
  try {
    if (intent === "changeRole") {
      const chosen = formString(form, "role");
      const role = MEMBER_ROLES.find((known) => known === chosen);
      if (!role) return { ok: false, error: "Choose a role.", issues: [] };
      await rpc.careGroup.changeRole({ groupId, userId: formString(form, "userId"), role });
      return { ok: true };
    }
    if (intent === "updateSharing") {
      await rpc.careGroup.updateMySharing({ groupId, ...sharingFromForm(form) });
      return { ok: true };
    }
    if (intent === "removeMember") {
      const userId = formString(form, "userId");
      const { db } = context.get(sessionContext);
      await rpc.careGroup.removeMember({ groupId, userId });
      if (userId !== db.userId) return { ok: true };
      // You left. `/app` reads the local copy, so wait for the group to go
      // from it first (otherwise `/app` would send you straight back here).
      await waitForMembershipGone(db, { groupId, userId });
      throw redirect(appUrls.home());
    }
    return { ok: false, error: "Unknown action.", issues: [] };
  } catch (e) {
    return failedSave(e, memberRefusal);
  }
}

/**
 * What a refused member change says. The membership rules' own messages are
 * written for people (owner only, the last owner), so they're shown as they
 * are; a member who has already gone is said plainly.
 */
const memberRefusal = (e: unknown): string | null => {
  if (!(e instanceof ORPCError)) return null;
  const code = (e.data as { code?: unknown } | undefined)?.code;
  if (typeof code !== "string" || !code.startsWith("careGroupMemberService:")) return null;
  if (code === "careGroupMemberService:notFound") return "That person is no longer in this care group.";
  return e.message;
};

export default function GroupMembers({ loaderData }: Route.ComponentProps) {
  const { userId, groupId, online } = loaderData;
  // Live from the device: a changed role shows without a reload.
  const group = useGroup();
  return (
    <SettingsPage id="members" title="Members" offlineNotice={online ? undefined : NEEDS_CONNECTION}>
      <InviteButton myRole={group.role} online={online} enabled={loaderData.inviteOptions.emailInvites} />
      <CreateLinkButton myRole={group.role} online={online} options={loaderData.inviteOptions} />
      {online && <JoinRequests requests={loaderData.requests} />}
      <SettingsCard>
        <Members
          groupId={groupId}
          userId={userId}
          myRole={group.role}
          online={online}
          initial={loaderData.members}
          myContact={loaderData.myContact}
          recipientName={group.recipient?.displayName || "them"}
        />
      </SettingsCard>
      {online && emailInviteRoles(group.role).length > 0 && (
        <PendingInvites invites={loaderData.invites} myRole={group.role} />
      )}
      {online && emailInviteRoles(group.role).length > 0 && (
        <InviteLinks links={loaderData.links} groupName={group.displayName} />
      )}
    </SettingsPage>
  );
}
