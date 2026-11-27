import type { InviteActionResult } from "./inviteApi";

import { ATTESTATION_TEXT } from "@caretook/data/schema";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button, CheckField, Field, Message, Notice, Sheet } from "~/components/ui";
import { roleDescription } from "../groupSettings";
import { emailInviteRoles } from "./invites";
import { INVITES_UNAVAILABLE } from "./linkRules";
import { RoleHelp } from "./RoleHelp";
import { RoleOptions } from "./RoleOptions";

// The Members page's Invite button (owners and admins) and its sheet: an
// email, a role, and the inviter's confirmation that the care recipient
// agreed to share. Sending is online only; offline, or while email invites
// are switched off (admin settings), the button is disabled and says why.

export function InviteButton({
  myRole,
  online,
  enabled = true,
}: {
  myRole: string | null;
  online: boolean;
  /** False while email invites are switched off (admin settings). */
  enabled?: boolean;
}) {
  const roles = emailInviteRoles(myRole);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("caretaker");
  const fetcher = useFetcher<InviteActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const sentTo = result?.ok ? (result.sentTo ?? null) : null;

  // Sent: close the sheet (once per result); the status below says to whom.
  const [handled, setHandled] = useState<InviteActionResult | undefined>(undefined);
  if (sentTo && result !== handled) {
    setHandled(result);
    setOpen(false);
  }

  if (!roles.length) return null;
  const issue = (path: string) =>
    result && !result.ok ? result.issues.find((i) => i.path === path)?.message : undefined;

  return (
    <div data-invite-controls="" className="space-y-2">
      <Button
        variant="primary"
        size="sm"
        icon={UserPlus}
        disabled={!online || !enabled}
        aria-describedby={online && enabled ? undefined : "invite-offline"}
        onClick={() => setOpen(true)}
      >
        Invite by email
      </Button>
      {(!online || !enabled) && (
        <p id="invite-offline" className="text-muted text-sm">
          {online ? INVITES_UNAVAILABLE.email : "Needs a connection to invite."}
        </p>
      )}
      {sentTo && !open && <Notice tone="success">Invitation sent to {sentTo}.</Notice>}
      {open && (
        <Sheet
          guardChanges
          isOpen
          onOpenChange={(next) => {
            setOpen(next);
            // A discarded role doesn't come back with the next open.
            if (!next) setRole("caretaker");
          }}
          title="Invite by email"
        >
          <fetcher.Form method="post" className="space-y-2" data-invite-sheet="">
            <input type="hidden" name="intent" value="invite" />
            <p className="text-muted text-sm">
              We'll email them a link that works for 7 days, with that address only.
            </p>
            <Field kind="input" label="Email" error={issue("email")}>
              {(control) => <input {...control} type="email" name="email" autoComplete="off" required />}
            </Field>
            <div className="relative">
              {/* Beside the label: the label is short, so the link fits on its line. */}
              <RoleHelp className="absolute end-0 top-1.5" />
              <Field kind="select" label="Role" help={roleDescription(role)} error={issue("role")}>
                {(control) => (
                  <select
                    {...control}
                    name="role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                  >
                    <RoleOptions roles={roles} />
                  </select>
                )}
              </Field>
            </div>
            <CheckField label={ATTESTATION_TEXT} name="attested" required error={issue("attested")} />
            {result && !result.ok && !result.issues.length && <Message tone="error">{result.error}</Message>}
            <Button type="submit" variant="primary" block busy={busy} busyLabel="Sending…">
              Send invitation
            </Button>
          </fetcher.Form>
        </Sheet>
      )}
    </div>
  );
}
