import type { ApiOutputs } from "~/lib/core/rpc";

import { useState } from "react";
import { Field } from "~/components/ui";
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
    <section className="card bg-base-100 shadow-sm" aria-labelledby="admin-actions" data-user-section="admin">
      <div className="card-body gap-3">
        <h2 id="admin-actions" className="card-title text-base">
          Access
        </h2>
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
                  className={account.disabledAt ? "btn btn-sm" : "btn btn-sm btn-error"}
                />
              </div>
            )}
            {canSetRole && <RoleControl current={account.role} />}
          </>
        )}
      </div>
    </section>
  );
}

function RoleControl({ current }: { current: string }) {
  const [role, setRole] = useState(current);
  return (
    <div className="flex flex-wrap items-end gap-2" data-role-controls="">
      <Field label="Staff role" help="Member means no access to /admin.">
        {(control) => (
          <select
            {...control}
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="select select-sm w-40"
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
