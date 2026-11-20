import type { PartialPermissions } from "./types";

import { ADMIN_ONLY_PERMISSION_ENTRY, STAFF_PERMISSION_ENTRY, SYSTEM_ONLY_ENTRY } from "./blocks";

export const MARKETING_PERMISSIONS = {
  // The marketing site's waitlist and contact messages: what visitors typed
  // into the public forms. Written only by the system (waitlistService.join,
  // contactMessageService.send); read, and removed on request, by staff.
  waitlistEntrySchema: {
    create: SYSTEM_ONLY_ENTRY,
    read: STAFF_PERMISSION_ENTRY,
    list: STAFF_PERMISSION_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: ADMIN_ONLY_PERMISSION_ENTRY,
  },

  contactMessageSchema: {
    create: SYSTEM_ONLY_ENTRY,
    read: ADMIN_ONLY_PERMISSION_ENTRY,
    list: ADMIN_ONLY_PERMISSION_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: ADMIN_ONLY_PERMISSION_ENTRY,
  },
} as const satisfies PartialPermissions;
