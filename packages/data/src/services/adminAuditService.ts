import type { Tx } from "../db";
import type { AuditAction, AuditChanges, AuditFilter } from "../db/schema";
import type { ServiceContext } from "./types";

import { auditFilterZSchema, isAuditAction, STAFF_REASON_MAX } from "../db/schema";
import { newError } from "../errors";
import { adminAuditLogModel } from "../models";
import { staffRefusal } from "./staffAccess";

export const schemaName = adminAuditLogModel.schemaName;

// The staff audit log (admin PRD). `record` runs inside the action's own
// transaction, so a change and its entry commit together and a refused or
// failed action leaves none. Page views (`user.view`, `group.view`) and
// account searches (`user.search`) call it awaited with no transaction, so
// the entry exists before staff see the answer, and a failed write fails the
// read. Entries are never updated or deleted: there's no function for it
// here, PERMISSIONS refuses it to everyone, and the roles SQL revokes UPDATE
// and DELETE on the table from the app role.

export type AuditEntryInput = {
  /** The staff member, or null for the system (the `admin:grant` command). */
  actorId: string | null;
  action: AuditAction;
  targetUserId?: string | null;
  targetGroupId?: string | null;
  /** Why (1–500 characters), for every changing action; none for page views. */
  reason?: string | null;
  /** From `auditChanges(before, after, fields)`, never a hand-built object with other columns. */
  changes?: AuditChanges;
};

/** Append one entry, inside `tx` (the action's transaction). */
export const record = async (tx: Tx | undefined, entry: AuditEntryInput) => {
  const reason = entry.reason?.trim() || null;
  if (!isAuditAction(entry.action) || (reason && reason.length > STAFF_REASON_MAX))
    return newError({ code: "adminAuditService:invalid", meta: { action: entry.action } });
  return adminAuditLogModel.insert(tx, {
    actorId: entry.actorId,
    action: entry.action,
    targetUserId: entry.targetUserId ?? null,
    targetGroupId: entry.targetGroupId ?? null,
    reason,
    changes: entry.changes ?? {},
  });
};

/** Staff (`audit.read`): one page of the entries matching `filter`, newest first, and the total. */
export const list = async (
  ctx: ServiceContext,
  filter: Partial<AuditFilter>,
  page: { page: number; limit: number },
) => {
  const refused = staffRefusal(ctx, "audit.read");
  if (refused) return refused;
  const parsed = auditFilterZSchema.partial().safeParse(filter);
  if (!parsed.success) return newError({ code: "adminAuditService:invalid" });
  return adminAuditLogModel.search({ ...ctx, filter: parsed.data, paginate: page });
};

/** Staff (`audit.read`): everyone with an entry in the log (the actor filter's choices). */
export const actors = (ctx: ServiceContext) => {
  const refused = staffRefusal(ctx, "audit.read");
  if (refused) return refused;
  return adminAuditLogModel.actors(ctx);
};
