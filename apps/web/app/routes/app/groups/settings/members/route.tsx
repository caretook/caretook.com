import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/api";
import type { MemberRow } from "~/lib/sync/timeline";

import { ORPCError } from "@orpc/client";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";
import { ConfirmDialog, UserAvatar } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { formString } from "~/lib/form";
import { getGroup, useGroup } from "~/lib/group";
import { rpc } from "~/lib/rpc";
import { sessionContext } from "~/lib/session";
import { useLiveQuery } from "~/lib/sync";
import { waitForMembershipGone } from "~/lib/sync/members";
import { membersQuery, readRows } from "~/lib/sync/timeline";
import { failedSave, loadRecipientProfile } from "../api";
import { MEMBER_ROLES, memberAccess, memberName, roleLabel, sortMembers } from "../groupSettings";
import { SettingsPage } from "../parts";

// `…/settings/members`. Shared by web + native. Members and roles come from
// the device's local copy (live, so they work offline and follow other
// members' changes). Changing a role, removing and leaving go through the
// API: online only.

export const meta = () => [{ title: "Members · Group settings · Caretook" }];

export { shouldRevalidate } from "../api";

/**
 * The members from the local copy (the group itself comes from the group
 * route). The API read only says whether the page can reach the server:
 * without a connection it loads read-only (`online: false`).
 */
export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  getGroup(context);
  const { db } = context.get(sessionContext);
  const members = await readRows<MemberRow>(db, membersQuery(groupId));
  const { online } = await loadRecipientProfile(request, groupId);
  return { userId: db.userId, groupId, members, online };
}

export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  const { groupId } = params;
  const form = await request.formData();
  const intent = formString(form, "intent");
  try {
    if (intent === "changeRole") {
      const chosen = formString(form, "role");
      const role = MEMBER_ROLES.find((known) => known === chosen);
      if (!role) return { ok: false, error: "Choose a role.", issues: [] };
      await rpc.careGroup.changeRole({ groupId, userId: formString(form, "userId"), role });
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
    <SettingsPage id="members" title="Members" online={online}>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <Members
            groupId={groupId}
            userId={userId}
            myRole={group.role}
            online={online}
            initial={loaderData.members}
          />
        </div>
      </div>
    </SettingsPage>
  );
}

type RemoveTarget = { userId: string; name: string; isSelf: boolean };

/**
 * Everyone in the group, from the local copy (live). Online, owners and
 * admins get a role menu and Remove on the members they may change, and
 * everyone gets Leave on their own row; offline it's a plain list.
 */
function Members({
  groupId,
  userId,
  myRole,
  online,
  initial,
}: {
  groupId: string;
  userId: string;
  myRole: string | null;
  online: boolean;
  initial: MemberRow[];
}) {
  const [seed] = useState(initial);
  const query = membersQuery(groupId);
  const members = sortMembers(useLiveQuery<MemberRow>(query.sql, query.params, seed));

  // Removing and leaving share one confirm dialog and one request.
  const [confirming, setConfirming] = useState<RemoveTarget | null>(null);
  const [target, setTarget] = useState<RemoveTarget | null>(null);
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const confirm = () => {
    if (!confirming) return;
    setTarget(confirming);
    setConfirming(null);
    void fetcher.submit({ intent: "removeMember", userId: confirming.userId }, { method: "post" });
  };

  return (
    <>
      <ul className="divide-base-200 divide-y">
        {members.map((member) => {
          const isSelf = member.user_id === userId;
          const mine = target?.userId === member.user_id;
          return (
            <MemberItem
              key={member.user_id}
              member={member}
              isSelf={isSelf}
              access={online ? memberAccess({ actorRole: myRole, memberRole: member.role, isSelf }) : null}
              removing={mine && busy}
              removeError={mine && result && !result.ok ? result.error : undefined}
              onRemove={() =>
                setConfirming({ userId: member.user_id, name: memberName(member.name), isSelf })
              }
            />
          );
        })}
      </ul>
      {/* Offline there's nothing to confirm: no controls at all. */}
      {online && (
        <ConfirmDialog
          open={!!confirming}
          title={
            confirming?.isSelf
              ? "Leave this care group? You'll lose access to its timeline."
              : `Remove ${confirming?.name ?? "this member"} from this care group? They'll lose access to its timeline.`
          }
          confirmLabel={confirming?.isSelf ? "Leave" : "Remove"}
          onConfirm={confirm}
          onClose={() => setConfirming(null)}
        />
      )}
    </>
  );
}

function MemberItem({
  member,
  isSelf,
  access,
  removing,
  removeError,
  onRemove,
}: {
  member: MemberRow;
  isSelf: boolean;
  /** What you may do to this member; null offline (nothing). */
  access: ReturnType<typeof memberAccess> | null;
  removing: boolean;
  removeError: string | undefined;
  onRemove: () => void;
}) {
  const name = memberName(member.name);
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;

  // The role just chosen shows while it saves and until it syncs back; a
  // refused change, or anyone else's change to this member, shows the saved role.
  const [sent, setSent] = useState<{ role: string; from: string | null } | null>(null);
  if (sent && sent.from !== member.role) setSent(null);
  const shownRole = sent && (busy || result?.ok) ? sent.role : member.role;
  const changeRole = (role: string) => {
    setSent({ role, from: member.role });
    void fetcher.submit({ intent: "changeRole", userId: member.user_id, role }, { method: "post" });
  };

  const error = (result && !result.ok ? result.error : undefined) ?? removeError;
  return (
    <li data-member={member.user_id} className="space-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <UserAvatar name={member.name} image={member.image} className="size-9 text-sm" />
        <p className="min-w-0 flex-1 truncate font-medium">
          {name}
          {isSelf && <span className="text-base-content/70 font-normal"> (you)</span>}
        </p>
        {access?.roles.length ? (
          <select
            aria-label={`Role for ${name}`}
            className="select select-sm w-auto"
            value={shownRole ?? ""}
            disabled={busy || removing}
            onChange={(event) => changeRole(event.target.value)}
          >
            {/* A role this build doesn't know stays selectable as itself. */}
            {!access.roles.some((role) => role === shownRole) && (
              <option value={shownRole ?? ""}>{roleLabel(shownRole)}</option>
            )}
            {access.roles.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        ) : (
          <span data-role className="text-base-content/70 text-sm">
            {roleLabel(member.role)}
          </span>
        )}
        {(access?.remove || access?.leave) && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy || removing}
            aria-label={access.leave ? "Leave this care group" : `Remove ${name}`}
            onClick={onRemove}
          >
            {access.leave ? (removing ? "Leaving…" : "Leave") : removing ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
    </li>
  );
}
