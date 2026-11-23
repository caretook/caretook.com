import type { ApiOutputs } from "~/lib/core/rpc";

import { useState } from "react";
import { Field } from "~/components/ui";
import { AdminCard } from "../AdminCard";
import { DISABLE_COPY, ENABLE_COPY, ROLE_OPTIONS, setRoleCopy } from "./accountActions";
import { HelpAction } from "./HelpAction";

// An account's admin-only controls (admin PRD, slice 3): disable or
// re-enable it, and its staff role, each behind a confirm with a reason.
// Only for staff with `users.disable` or `users.setRole` (admins); never on
// your own account, which the API refuses too.

type Account = ApiOutputs["admin"]["users"]["get"]["account"];

export function AccountAdminActions({
  account,
  canDisable,
  canSetRole,
  isSelf,
}: {
  account: Account;
  canDisable: boolean;
  canSetRole: boolean;
  isSelf: boolean;
}) {
  if (!canDisable && !canSetRole) return null;
  return (
    <AdminCard id="admin-actions" titleSize="base" title="Access" data-user-section="admin">
      {isSelf ? (
        <p className="text-sm" data-self-note="">
          You can&apos;t disable your own account or change your own role.
        </p>
      ) : (
        <>
          {canDisable && (
            <div data-disable-controls="">
              {/* One control for both, so its "done" line stays when it flips. */}
              <HelpAction
                intent={account.disabledAt ? "enable" : "disable"}
                copy={account.disabledAt ? ENABLE_COPY : DISABLE_COPY}
                variant={account.disabledAt ? "secondary" : "dangerQuiet"}
              />
            </div>
          )}
          {canSetRole && <RoleControl current={account.role} />}
        </>
      )}
    </AdminCard>
  );
}

function RoleControl({ current }: { current: string }) {
  const [role, setRole] = useState(current);
  return (
    <div className="flex flex-wrap items-end gap-2" data-role-controls="">
      <Field kind="select" label="Staff role" help="Member means no access to /admin.">
        {(control) => (
          <select
            {...control}
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={`${control.className} select-sm max-w-40`}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.role} value={o.role}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <HelpAction intent="setRole" copy={setRoleCopy(role)} values={{ role }} disabled={role === current} />
    </div>
  );
}
