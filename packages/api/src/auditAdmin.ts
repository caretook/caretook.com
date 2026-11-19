import type { AdminAuditEntry } from "@caretook/data";

import { adminAuditService, auditFilterZSchema } from "@caretook/data";
import { z } from "zod";
import { iso } from "./dto";
import { unwrap } from "./errors";
import { staffProcedure } from "./procedures";

// `admin.audit.*` (admin PRD): the staff audit log, for every staff member
// (`audit.read`). Each entry is who acted, what, on which account or group
// (by name and email, the group by name only), the reason and the changed
// fields: never care data, which the log never holds.

/** Entries per page on /admin/audit. */
export const AUDIT_PAGE_SIZE = 50;

export const toAuditEntry = (entry: AdminAuditEntry) => ({
  id: entry.id,
  action: entry.action,
  actor: entry.actor,
  targetUser: entry.targetUser,
  targetGroup: entry.targetGroup,
  reason: entry.reason,
  changes: entry.changes,
  createdAt: iso(entry.createdAt),
});
export type AuditEntryDto = ReturnType<typeof toAuditEntry>;

export const auditAdmin = {
  /** One page of the matching entries, newest first, how many match, and every actor (the filter's choices). */
  list: staffProcedure("audit.read")
    .input(auditFilterZSchema.extend({ page: z.number().int().min(1).max(100_000).default(1) }))
    .handler(async ({ context, input: { page, ...filter } }) => {
      const res = unwrap(await adminAuditService.list(context, filter, { page, limit: AUDIT_PAGE_SIZE }));
      const actors = unwrap(await adminAuditService.actors(context));
      return {
        count: res.count,
        page,
        pageSize: AUDIT_PAGE_SIZE,
        entries: res.data.map(toAuditEntry),
        actors,
      };
    }),
};
