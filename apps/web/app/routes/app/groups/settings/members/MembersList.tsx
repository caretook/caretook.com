import type { ContactValues } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/core/api";
import type { MemberDetailRow } from "~/lib/care-groups/members.sync";

import { isManagerRole } from "@caretook/data/permissions";
import { useState } from "react";
import { useFetcher } from "react-router";
import { ConfirmDialog, List } from "~/components/ui";
import { useLiveQuery } from "~/lib/sync";
import { memberDetailsQuery } from "~/lib/care-groups/members.sync";
import { memberAccess, memberName, sortMembers } from "../groupSettings";
import { MemberItem } from "./MemberItem";
import { RoleHelp } from "./RoleHelp";

// The members list and its rows. Each change posts an intent (`changeRole`,
// `removeMember`, `updateSharing`) to the route's action. Every row shows the
// member's relationship to the recipient and what they share with the group;
// your own row has "What this group sees" (online, folded, from your account's
// contact details).

type RemoveTarget = { userId: string; name: string; isSelf: boolean };

/**
 * Everyone in the group, from the local copy (live). Online, owners and
 * admins get a role menu and Remove on the members they may change (and
 * "What can each role do?" above the list), and everyone gets Leave on
 * their own row; offline it's a plain list.
 */
export function Members({
  groupId,
  userId,
  myRole,
  online,
  initial,
  myContact,
  recipientName,
}: {
  groupId: string;
  userId: string;
  myRole: string | null;
  online: boolean;
  initial: MemberDetailRow[];
  /** Your own contact details (online only): what the sharing choices offer. */
  myContact: ContactValues | null;
  recipientName: string;
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
      {/* Owners and admins pick roles here, online: what each role does is a link away. */}
      {online && isManagerRole(myRole) && (
        <div className="mb-2 flex justify-end">
          <RoleHelp />
        </div>
      )}
      <List>
        {members.map((member) => {
          const isSelf = member.user_id === userId;
          const mine = target?.userId === member.user_id;
          return (
            <MemberItem
              key={member.user_id}
              member={member}
              isSelf={isSelf}
              myContact={isSelf && online ? myContact : null}
              recipientName={recipientName}
              access={online ? memberAccess({ actorRole: myRole, memberRole: member.role, isSelf }) : null}
              removing={mine && busy}
              removeError={mine && result && !result.ok ? result.error : undefined}
              onRemove={() =>
                setConfirming({ userId: member.user_id, name: memberName(member.name), isSelf })
              }
            />
          );
        })}
      </List>
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
