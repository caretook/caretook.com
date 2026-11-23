import type { MemberAction } from "../groupDisplay";

import { useState } from "react";
import { Link, useNavigation, useSubmit } from "react-router";
import { Badge, Button, ConfirmDialog, Field, LINK, List, ListRow } from "~/components/ui";
import { adminUrls } from "../adminUrls";
import { changeRoleOptions, dayText, memberActionText, personLabel, sortGroupMembers } from "../groupDisplay";
import { groupRoleLabel } from "@caretook/data/permissions";
import { STAFF_REASON_MAX } from "@caretook/data/schema";

// A group's members on its staff page: name and email (a link to the
// account's staff page), role, who invited them and when they joined. For
// admins, each row has Make owner, Change role and Remove, each confirmed in
// a dialog that asks why (the reason goes in the audit log).

type Member = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
  invitedBy: { id: string; name: string | null; email: string } | null;
};

type Pending = { action: MemberAction; member: Member };

export function MemberList({
  members,
  groupName,
  canManage,
}: {
  members: readonly Member[];
  groupName: string;
  canManage: boolean;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const busy = useNavigation().state !== "idle";
  return (
    <>
      <List data-admin-members="">
        {sortGroupMembers(members).map((m) => (
          <ListRow
            key={m.userId}
            className="flex flex-wrap items-start justify-between gap-2 text-sm"
            data-admin-member={m.email}
            data-role={m.role}
          >
            <div className="min-w-0 space-y-0.5">
              <Link to={adminUrls.user(m.userId)} className={`${LINK} font-medium break-all`}>
                {personLabel(m)}
              </Link>
              <p>
                <Badge>{groupRoleLabel(m.role)}</Badge>
              </p>
              <p className="text-muted text-xs">
                {m.invitedBy ? (
                  <>
                    Invited by{" "}
                    <Link to={adminUrls.user(m.invitedBy.id)} className={LINK}>
                      {personLabel(m.invitedBy)}
                    </Link>
                    {" · "}
                  </>
                ) : null}
                Joined {dayText(m.joinedAt)}
              </p>
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-1">
                {m.role !== "owner" && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => setPending({ action: "promoteOwner", member: m })}
                  >
                    Make owner<span className="sr-only"> {m.email}</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setPending({ action: "changeRole", member: m })}
                >
                  Change role<span className="sr-only"> {m.email}</span>
                </Button>
                <Button
                  size="sm"
                  variant="dangerQuiet"
                  disabled={busy}
                  onClick={() => setPending({ action: "removeMember", member: m })}
                >
                  Remove<span className="sr-only"> {m.email}</span>
                </Button>
              </div>
            )}
          </ListRow>
        ))}
      </List>
      {pending && (
        <MemberActionDialog
          key={`${pending.action}:${pending.member.userId}`}
          pending={pending}
          groupName={groupName}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}

function MemberActionDialog({
  pending: { action, member },
  groupName,
  onClose,
}: {
  pending: Pending;
  groupName: string;
  onClose: () => void;
}) {
  const submit = useSubmit();
  const options = changeRoleOptions(member.role);
  const [role, setRole] = useState<string>(options[0] ?? "");
  const [reason, setReason] = useState("");
  const text = memberActionText(action, member, groupName);
  const confirm = () => {
    const form = new FormData();
    form.set("intent", action);
    form.set("userId", member.userId);
    form.set("who", member.name || member.email);
    form.set("reason", reason.trim());
    if (action === "changeRole") form.set("role", role);
    void submit(form, { method: "post" });
    onClose();
  };
  return (
    <ConfirmDialog
      open
      title={text.title}
      message={text.message}
      confirmLabel={text.confirm}
      confirmDisabled={!reason.trim()}
      onConfirm={confirm}
      onClose={onClose}
    >
      <div data-member-dialog={action}>
        {action === "changeRole" && (
          <Field kind="select" label="New role">
            {(control) => (
              <select {...control} name="role" value={role} onChange={(e) => setRole(e.target.value)}>
                {options.map((r) => (
                  <option key={r} value={r}>
                    {groupRoleLabel(r)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field kind="textarea" label="Reason" help="Recorded in the audit log.">
          {(control) => (
            <textarea
              {...control}
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={STAFF_REASON_MAX}
              rows={3}
              required
            />
          )}
        </Field>
      </div>
    </ConfirmDialog>
  );
}
