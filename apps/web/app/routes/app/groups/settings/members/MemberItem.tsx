import type { ContactValues } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/core/api";
import type { MemberDetailRow } from "~/lib/care-groups/members.sync";
import type { memberAccess } from "../groupSettings";
import type { MemberStatus } from "./memberStatus";

import { visibleSharedFields } from "@caretook/data/schema";
import { useState } from "react";
import { useFetcher } from "react-router";
import { ContactLines } from "~/components/contact";
import { MemberAvatar } from "~/components/members";
import { Badge, Button, ListRow, Message } from "~/components/ui";
import { emergencyBadges } from "~/lib/profiles/emergencyList";
import { memberContactLines, memberShare, sharedSummary } from "~/lib/profiles/memberContact";
import { memberName, roleLabel } from "../groupSettings";
import { memberHistory } from "./invites";
import { memberStatusLine } from "./memberStatus";
import { RoleOptions } from "./RoleOptions";
import { YourSharing } from "./YourSharing";

/**
 * One member's card. The identity (avatar, full name, badges, relationship,
 * history) comes first and wraps rather than cuts; the role and Leave or
 * Remove sit below it, or to its right where the card is wide enough. Your
 * own card folds "What this group sees" behind a disclosure (online), or says
 * what you share (offline).
 */
export function MemberItem({
  member,
  isSelf,
  myContact,
  status,
  recipientName,
  access,
  removing,
  removeError,
  onRemove,
}: {
  member: MemberDetailRow;
  isSelf: boolean;
  /** Your contact details, on your own row while online; else null (no sharing form). */
  myContact: ContactValues | null;
  /** Their email confirmation and last sign-in: owners and admins, online only; else none. */
  status: MemberStatus | undefined;
  recipientName: string;
  /** What you may do to this member; null offline (nothing). */
  access: ReturnType<typeof memberAccess> | null;
  removing: boolean;
  removeError: string | undefined;
  onRemove: () => void;
}) {
  const name = memberName(member.name);
  const history = memberHistory(member);
  const relationship = member.relationship?.trim();
  const share = memberShare(member);
  const contactLines = memberContactLines(name, share);
  const badges = emergencyBadges(member);
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
    <ListRow data-member={member.user_id}>
      <div className="flex items-start gap-3">
        <MemberAvatar userId={member.user_id} name={member.name} image={member.image} size="lg" />
        <div className="@container min-w-0 flex-1 space-y-2">
          <div className="flex flex-col gap-2 @md:flex-row @md:items-start">
            <div className="min-w-0 flex-1 break-words">
              <p className="font-medium">
                {name}
                {isSelf && <span className="text-base-content/70 font-normal"> (you)</span>}
              </p>
              {badges.length > 0 && (
                <p className="flex flex-wrap gap-1 py-0.5" data-member-badges="">
                  {badges.map((badge) => (
                    <Badge
                      key={badge}
                      tone={badge === "Primary contact" ? "primary" : "neutral"}
                      data-badge={badge === "Primary contact" ? "primary" : "emergency"}
                    >
                      {badge}
                    </Badge>
                  ))}
                </p>
              )}
              {relationship && (
                <p data-member-relationship="" className="text-sm">
                  {relationship}
                </p>
              )}
              {history && (
                <p data-member-history="" className="text-base-content/70 text-sm">
                  {history}
                </p>
              )}
              {status && (
                <p
                  data-member-status={status.emailVerified ? "confirmed" : "unconfirmed"}
                  className="text-sm"
                >
                  {memberStatusLine(status)}
                </p>
              )}
            </div>
            <div data-member-controls="" className="flex shrink-0 flex-wrap items-center gap-2">
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
                  <RoleOptions roles={access.roles} />
                </select>
              ) : (
                <span data-role className="text-base-content/70 text-sm">
                  {roleLabel(member.role)}
                </span>
              )}
              {(access?.remove || access?.leave) && (
                <Button
                  size="sm"
                  busy={removing}
                  busyLabel={access.leave ? "Leaving…" : "Removing…"}
                  disabled={busy}
                  aria-label={access.leave ? "Leave this care group" : `Remove ${name}`}
                  onClick={onRemove}
                >
                  {access.leave ? "Leave" : "Remove"}
                </Button>
              )}
            </div>
          </div>
          {error && <Message tone="error">{error}</Message>}
          {contactLines.length > 0 && <ContactLines lines={contactLines} data-member-contact="" />}
          {isSelf && !myContact && (
            <p data-sharing-summary="" className="text-base-content/70 text-sm">
              {sharedSummary(visibleSharedFields(share))}
            </p>
          )}
        </div>
      </div>
      {isSelf && myContact && (
        <YourSharing member={member} contact={myContact} recipientName={recipientName} />
      )}
    </ListRow>
  );
}
