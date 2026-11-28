import { SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import { auditChanges } from "../db/schema";
import { isError, newError } from "../errors";
import { userModel } from "../models";
import * as adminAuditService from "./adminAuditService";

export const schemaName = userModel.schemaName;

// `pnpm admin:grant <email> [--role admin|support]` (admin PRD): how a new
// database gets its first staff, without SQL. Runs as the system on the
// server only (no procedure calls it), and records the change in the audit
// log with no actor.

export const GRANTABLE_ROLES = ["admin", "support"] as const;
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

export const GRANT_REASON = "Granted on the server with pnpm admin:grant";

const isGrantable = (role: string): role is GrantableRole => GRANTABLE_ROLES.some((r) => r === role);

/**
 * Give the account at `email` the staff role `role`, with an audit entry
 * (actor null) in the same transaction. An unknown address is refused; a
 * role it already has changes nothing and records nothing.
 */
export const grant = ({ email, role }: { email: string; role: string }) =>
  withTransaction(async (tx) => {
    if (!isGrantable(role)) return newError({ code: "adminGrant:invalidRole" });
    const system = { authUser: SYSTEM_USER, tx };
    const user = await userModel.getWhole({
      ...system,
      filter: { email: { type: "eq", value: userModel.normalizeEmail(email) } },
    });
    if (isError(user)) return user;
    if (!user) return newError({ code: "adminGrant:unknownAddress" });
    if (user.role === role) return { userId: user.id, email: user.email, role, changed: false };

    const updated = await userModel.update({
      ...system,
      filter: { id: { type: "eq", value: user.id } },
      data: { role },
    });
    if (isError(updated)) return updated;

    const recorded = await adminAuditService.record(tx, {
      actorId: null,
      action: "user.setRole",
      targetUserId: user.id,
      reason: GRANT_REASON,
      changes: auditChanges(user, { role }, ["role"]),
    });
    if (isError(recorded)) return recorded;
    return { userId: user.id, email: user.email, role, changed: true };
  });
