import type { ContactValues } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/core/api";
import type { MemberDetailRow } from "~/lib/care-groups/members.sync";

import { visibleSharedFields } from "@caretook/data/schema";
import { useState } from "react";
import { useFetcher } from "react-router";
import { ContactLines } from "~/components/contact";
import { Badge, Button, ConfirmDialog, Message, UserAvatar } from "~/components/ui";
import { emergencyBadges } from "~/lib/profiles/emergencyList";
import { useLiveQuery } from "~/lib/sync";
import {
  memberContactLines,
  memberShare,
  parseSharedFields,
  sharedSummary,
} from "~/lib/profiles/memberContact";
import { memberDetailsQuery } from "~/lib/care-groups/members.sync";
import { memberAccess, memberName, roleLabel, sortMembers } from "../groupSettings";
import { memberHistory } from "./invites";
import { SharingForm } from "./SharingForm";

// The members list and its rows. Each change posts an intent (`changeRole`,
// `setMemberMode`, `removeMember`, `updateSharing`) to the route's action. Every row shows the
// member's relationship to the recipient and what they share with the group;
// your own row has "What this group sees" (online, from your account's
// contact details).

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
      <ul className="divide-base-200 divide-y">
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
  myContact,
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
  const sharedFields = parseSharedFields(member.shared_fields);
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

  const simple = useSimpleModeSwitch(member);

  const error = (result && !result.ok ? result.error : undefined) ?? simple.error ?? removeError;
  return (
    <li data-member={member.user_id} className="space-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <UserAvatar name={member.name} image={member.image} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
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
            <p data-member-relationship="" className="truncate text-sm">
              {relationship}
            </p>
          )}
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
      {(access?.simpleMode || !!member.simple_mode) && (
        <div className="flex min-w-0 flex-col gap-2 pl-12" data-member-switches="">
          {access?.simpleMode ? (
            <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                aria-label={`Simple mode for ${name}`}
                checked={simple.on}
                disabled={simple.busy || removing}
                onChange={(event) => simple.set(event.target.checked)}
                data-simple-mode-switch=""
              />
              <span aria-hidden="true" className="min-w-0">
                Simple mode
              </span>
            </label>
          ) : (
            !!member.simple_mode && (
              <Badge data-simple-mode-badge="" className="self-start">
                {member.simple_mode_locked ? "Simple mode, locked" : "Simple mode"}
              </Badge>
            )
          )}
          {access?.lock && (
            <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                aria-label={`Lock ${name} in simple mode`}
                checked={simple.locked}
                disabled={simple.busy || removing}
                onChange={(event) => simple.lock(event.target.checked)}
                data-simple-lock-switch=""
              />
              <span aria-hidden="true" className="min-w-0">
                Locked
              </span>
            </label>
          )}
          {access?.simpleMode && !access.lock && !!member.simple_mode_locked && (
            <Badge data-simple-mode-badge="" className="self-start">
              Locked
            </Badge>
          )}
        </div>
      )}
      {error && <Message tone="error">{error}</Message>}
      {contactLines.length > 0 && (
        <div className="pl-12">
          <ContactLines lines={contactLines} data-member-contact="" />
        </div>
      )}
      {isSelf &&
        (myContact ? (
          <SharingForm
            contact={myContact}
            sharedFields={sharedFields}
            relationship={member.relationship}
            recipientName={recipientName}
          />
        ) : (
          <p data-sharing-summary="" className="text-base-content/70 pl-12 text-sm">
            {sharedSummary(visibleSharedFields(share))}
          </p>
        ))}
    </li>
  );
}

/**
 * A member's simple-mode switches: the managers' default for them, and the
 * lock. Locking turns the default on, and turning the default off unlocks
 * (the server's rule, shown at once). The latest choice shows while it saves
 * and until it syncs back. Each change sent is remembered until its own echo
 * arrives, so an earlier change syncing back after a later click doesn't
 * undo the later one on screen; a refused change, or a saved value none of
 * ours explains (anyone else's change), shows what's saved.
 */
function useSimpleModeSwitch(member: MemberDetailRow) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const saved = { on: !!member.simple_mode, locked: !!member.simple_mode_locked };
  const savedKey = modeKey(saved);
  // What we've sent, oldest first, and the saved value we last looked at.
  const [sent, setSent] = useState<{ pending: string[]; seen: string }>({ pending: [], seen: savedKey });
  if (sent.seen !== savedKey) {
    const echo = sent.pending.indexOf(savedKey);
    // Our own change arriving drops it and anything older; anything else is someone else's.
    setSent({ pending: echo < 0 ? [] : sent.pending.slice(echo + 1), seen: savedKey });
  }
  const latest = sent.pending.at(-1);
  const shown = latest && (busy || result?.ok) ? parseModeKey(latest) : saved;
  const send = (next: ModeState, field: "simpleMode" | "locked", value: boolean) => {
    setSent({ pending: [...sent.pending, modeKey(next)], seen: savedKey });
    void fetcher.submit(
      { intent: "setMemberMode", userId: member.user_id, [field]: value ? "on" : "off" },
      { method: "post" },
    );
  };
  return {
    on: shown.on,
    locked: shown.locked,
    busy,
    set: (on: boolean) => send({ on, locked: on && shown.locked }, "simpleMode", on),
    lock: (locked: boolean) => send({ on: locked || shown.on, locked }, "locked", locked),
    error: result && !result.ok ? result.error : undefined,
  };
}

type ModeState = { on: boolean; locked: boolean };
const modeKey = ({ on, locked }: ModeState) => `${on}:${locked}`;
const parseModeKey = (key: string): ModeState => {
  const [on, locked] = key.split(":");
  return { on: on === "true", locked: locked === "true" };
};
