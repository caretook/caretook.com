import type { InviteActionResult } from "./inviteApi";

import { ATTESTATION_TEXT } from "@caretook/data/schema";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Field, Sheet } from "~/components/ui";
import { roleLabel } from "../groupSettings";
import { emailInviteRoles } from "./invites";
import { INVITES_UNAVAILABLE } from "./linkRules";

// The Members page's Invite button (owners and admins) and its sheet: an
// email, a role, and the inviter's confirmation that the care recipient
// agreed to share. Sending is online only; offline, or while email invites
// are switched off (admin settings), the button is disabled and says why.

const ROLE_HELP: Record<string, string> = {
  owner: "Manages the group, its members and owners.",
  admin: "Manages members and invitations.",
  caretaker: "Reads and adds to the timeline.",
  viewer: "Reads only.",
};

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
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={!online || !enabled}
        aria-describedby={online && enabled ? undefined : "invite-offline"}
        onClick={() => setOpen(true)}
      >
        <UserPlus aria-hidden="true" className="size-4" />
        Invite by email
      </button>
      {(!online || !enabled) && (
        <p id="invite-offline" className="text-base-content/70 text-sm">
          {online ? INVITES_UNAVAILABLE.email : "Needs a connection to invite."}
        </p>
      )}
      {sentTo && !open && (
        <p role="status" className="alert alert-success alert-soft text-sm">
          Invitation sent to {sentTo}.
        </p>
      )}
      <Sheet isOpen={open} onOpenChange={setOpen} title="Invite by email">
        <fetcher.Form method="post" className="space-y-2" data-invite-sheet="">
          <input type="hidden" name="intent" value="invite" />
          <p className="text-base-content/70 text-sm">
            We'll email them a link that works for 7 days, with that address only.
          </p>
          <Field label="Email" error={issue("email")}>
            {(control) => (
              <input
                {...control}
                className="input w-full"
                type="email"
                name="email"
                autoComplete="off"
                required
              />
            )}
          </Field>
          <Field label="Role" error={issue("role")}>
            {(control) => (
              <select {...control} className="select w-full" name="role" defaultValue="caretaker">
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}: {ROLE_HELP[role]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <label className="flex items-start gap-3 py-1 text-sm">
            <input
              type="checkbox"
              name="attested"
              className="checkbox mt-0.5"
              required
              aria-invalid={issue("attested") ? true : undefined}
            />
            <span>{ATTESTATION_TEXT}</span>
          </label>
          {issue("attested") && <p className="text-error text-sm">{issue("attested")}</p>}
          {result && !result.ok && !result.issues.length && (
            <p role="alert" className="text-error text-sm">
              {result.error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Sending…" : "Send invitation"}
          </button>
        </fetcher.Form>
      </Sheet>
    </div>
  );
}
