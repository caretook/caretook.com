import type { PartialPermissions } from "./types";

import { NOBODY_ENTRY, STAFF_PERMISSION_ENTRY, SYSTEM_ONLY_ENTRY } from "./blocks";

export const ADMIN_PERMISSIONS = {
  // The staff audit log (admin PRD): append-only. Only the system writes it
  // (adminAuditService.record, inside the action's transaction); staff read
  // it; nobody, the system included, updates or deletes a row.
  adminAuditLogSchema: {
    create: SYSTEM_ONLY_ENTRY,
    read: STAFF_PERMISSION_ENTRY,
    list: STAFF_PERMISSION_ENTRY,
    update: NOBODY_ENTRY,
    delete: NOBODY_ENTRY,
  },

  // Settings changed without a deploy (admin PRD): staff read them; only
  // the system writes them (setSetting, after the capability check).
  appSettingSchema: {
    create: SYSTEM_ONLY_ENTRY,
    read: STAFF_PERMISSION_ENTRY,
    list: STAFF_PERMISSION_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: NOBODY_ENTRY,
  },
} as const satisfies PartialPermissions;
