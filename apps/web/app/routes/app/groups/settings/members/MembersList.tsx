import type { ActionResult } from "~/lib/api";
import type { MemberDetailRow } from "~/lib/sync/members";

import { useState } from "react";
import { useFetcher } from "react-router";
import { ConfirmDialog, UserAvatar } from "~/components/ui";
import { useLiveQuery } from "~/lib/sync";
import { memberDetailsQuery } from "~/lib/sync/members";
import { memberAccess, memberName, roleLabel, sortMembers } from "../groupSettings";
import { memberHistory } from "./invites";

// The members list and its rows. Each change posts an intent (`changeRole`,
// `removeMember`) to the route's action.

type RemoveTarget = { userId: string; name: string; isSelf: boolean };

/**
 * Everyone in the group, from the local copy (live). Online, owners and
 * admins get a role menu and Remove on the members they may change, and
 * everyone gets Leave on their own row; offline it's a plain list.
 */
export function Members({
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
  initial: MemberDetailRow[];
}) {
  const [seed] = useState(initial);
  const query = memberDetailsQuery(groupId);
  const members = sortMembers(useLiveQuery<MemberDetailRow>(query.sql, query.params, seed));

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
  member: MemberDetailRow;
  isSelf: boolean;
  /** What you may do to this member; null offline (nothing). */
  access: ReturnType<typeof memberAccess> | null;
  removing: boolean;
  removeError: string | undefined;
  onRemove: () => void;
}) {
  const name = memberName(member.name);
  const history = memberHistory(member);
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
        <UserAvatar name={member.name} image={member.image} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {name}
            {isSelf && <span className="text-base-content/70 font-normal"> (you)</span>}
          </p>
          {history && (
            <p data-member-history="" className="text-base-content/70 truncate text-sm">
              {history}
            </p>
          )}
        </div>
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
