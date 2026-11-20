import type { PartialPermissions } from "./types";

import {
  ADMIN_ONLY_PERMISSION_ENTRY,
  ANY_GROUP_ROLE,
  DEFAULT_PERMISSION_ENTRY,
  PUBLIC_PROFILE_FIELDS,
  STAFF_ONLY,
  SYSTEM_ONLY,
  SYSTEM_ONLY_SCHEMA,
} from "./blocks";

export const AUTH_PERMISSIONS = {
  userSchema: {
    ownerField: "id",
    // Co-members of a care group can read each other's public profile only:
    // id, name and image. Email, role and preferences stay with the user and
    // staff; services that must email a co-member read the row as the system.
    groupUserField: "id",
    // Accounts are created by the auth flow (running as SYSTEM_USER) or by staff.
    create: ADMIN_ONLY_PERMISSION_ENTRY,
    // Staff (support too) look accounts up; members read themselves and co-members.
    read: {
      ...DEFAULT_PERMISSION_ENTRY,
      support: ["all"],
      group: ANY_GROUP_ROLE,
      groupFields: PUBLIC_PROFILE_FIELDS,
    },
    list: {
      ...DEFAULT_PERMISSION_ENTRY,
      support: ["all"],
      group: ANY_GROUP_ROLE,
      groupFields: PUBLIC_PROFILE_FIELDS,
    },
    update: {
      ...DEFAULT_PERMISSION_ENTRY,
      // Members can edit their profile but not escalate their role, and
      // email changes go through the auth provider's verification flow.
      fields: {
        role: STAFF_ONLY,
        email: STAFF_ONLY,
        emailVerified: STAFF_ONLY,
        // Disabling goes through the staff services, as the system.
        disabledAt: SYSTEM_ONLY,
        disabledBy: SYSTEM_ONLY,
        disabledReason: SYSTEM_ONLY,
      },
    },
    // Members can delete their own account (a consumer-health-data requirement).
    delete: DEFAULT_PERMISSION_ENTRY,
  },

  // Better Auth's tables: it uses them through its own adapter, never our
  // models, so only the system may touch them here.
  sessionSchema: SYSTEM_ONLY_SCHEMA,

  accountSchema: SYSTEM_ONLY_SCHEMA,

  verificationSchema: SYSTEM_ONLY_SCHEMA,

  jwksSchema: SYSTEM_ONLY_SCHEMA,
} as const satisfies PartialPermissions;
