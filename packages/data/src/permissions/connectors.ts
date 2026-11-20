import type { PartialPermissions } from "./types";

import { MANAGERS, SYSTEM_ONLY_ENTRY, groupEntry } from "./blocks";

export const CONNECTORS_PERMISSIONS = {
  // A member's assistant connected to one group. The member reads and
  // revokes their own; the group's owners and admins read and revoke every
  // member's. Only connectorGrantService (as the system) creates and
  // updates them: revoking is an update it makes after checking `delete`.
  connectorGrantSchema: {
    ownerField: "userId",
    groupField: "groupId",
    read: { ...groupEntry(MANAGERS), admin: ["owned"], support: ["owned"], member: ["owned"] },
    list: { ...groupEntry(MANAGERS), admin: ["owned"], support: ["owned"], member: ["owned"] },
    create: SYSTEM_ONLY_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: { ...groupEntry(MANAGERS), admin: ["owned"], support: ["owned"], member: ["owned"] },
  },
} as const satisfies PartialPermissions;
