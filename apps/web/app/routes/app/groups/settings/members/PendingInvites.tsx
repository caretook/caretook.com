import type { InviteActionResult } from "./inviteApi";
import type { InviteRow } from "./invites";

import { Mail } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button, ConfirmDialog, EmptyState, Message } from "~/components/ui";
import { roleLabel } from "../groupSettings";
import { inviteStatusLine, mayResend, mayRevoke } from "./invites";

// The Members page's Pending list (owners and admins, online): email invites
// still waiting (expired ones too, to send again) and those declined lately,
// each with its role, who sent it and when it expires, plus Resend and Revoke.

export function PendingInvites({ invites, myRole }: { invites: InviteRow[]; myRole: string | null }) {
  const [revoking, setRevoking] = useState<InviteRow | null>(null);
  const revokeFetcher = useFetcher<InviteActionResult>();
  const confirmRevoke = () => {
    if (!revoking) return;
    void revokeFetcher.submit({ intent: "revokeInvite", inviteId: revoking.id }, { method: "post" });
    setRevoking(null);
  };
  const revokeResult = revokeFetcher.state === "idle" ? revokeFetcher.data : undefined;

  return (
    <section
      aria-labelledby="pending-invites-heading"
      data-pending-invites=""
      className="card bg-base-100 shadow-sm"
    >
      <div className="card-body">
        <h2 id="pending-invites-heading" className="card-title text-lg">
          Pending invitations
        </h2>
        {invites.length ? (
          <ul className="divide-base-200 divide-y">
            {invites.map((invite) => (
              <PendingInvite
                key={invite.id}
                invite={invite}
                myRole={myRole}
                revoking={
                  revokeFetcher.state !== "idle" && revokeFetcher.formData?.get("inviteId") === invite.id
                }
                onRevoke={() => setRevoking(invite)}
              />
            ))}
          </ul>
        ) : (
          <EmptyState>No invitations waiting.</EmptyState>
        )}
        {revokeResult && !revokeResult.ok && <Message tone="error">{revokeResult.error}</Message>}
      </div>
      <ConfirmDialog
        open={!!revoking}
        title={`Withdraw the invitation to ${revoking?.email ?? "this address"}? Its link will stop working.`}
        confirmLabel="Revoke"
        onConfirm={confirmRevoke}
        onClose={() => setRevoking(null)}
      />
    </section>
  );
}

function PendingInvite({
  invite,
  myRole,
  revoking,
  onRevoke,
}: {
  invite: InviteRow;
  myRole: string | null;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const fetcher = useFetcher<InviteActionResult>();
  const resending = fetcher.state !== "idle";
  const result = resending ? undefined : fetcher.data;
  const address = invite.email ?? "Invitation";
  return (
    <li
      data-invite={invite.id}
      data-invite-status={invite.state}
      className="space-y-1 py-3 first:pt-0 last:pb-0"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Mail aria-hidden="true" className="text-base-content/60 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{address}</p>
          <p className="text-base-content/70 text-sm">
            {roleLabel(invite.role)} · {inviteStatusLine(invite)}
          </p>
        </div>
        {mayResend(myRole, invite) && (
          <Button
            size="sm"
            busy={resending}
            busyLabel="Sending…"
            disabled={revoking}
            aria-label={`Resend the invitation to ${address}`}
            onClick={() =>
              void fetcher.submit({ intent: "resendInvite", inviteId: invite.id }, { method: "post" })
            }
          >
            Resend
          </Button>
        )}
        {mayRevoke(myRole, invite) && (
          <Button
            variant="ghost"
            size="sm"
            busy={revoking}
            busyLabel="Revoking…"
            disabled={resending}
            aria-label={`Revoke the invitation to ${address}`}
            onClick={onRevoke}
          >
            Revoke
          </Button>
        )}
      </div>
      {result?.ok && result.sentTo !== undefined && (
        <Message tone="success">Sent again, with a new link.</Message>
      )}
      {result && !result.ok && <Message tone="error">{result.error}</Message>}
    </li>
  );
}
