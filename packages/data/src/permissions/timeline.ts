import type { PartialPermissions } from "./types";

import { ANY_GROUP_ROLE, SYSTEM_ONLY, WRITERS, groupEntry } from "./blocks";

export const TIMELINE_PERMISSIONS = {
  // Any writer may edit or delete any entry (not just their own). Deletes
  // are soft (timelineEntryModel.remove sets deletedAt under this delete
  // permission); hard deletes are system-only (purge).
  timelineEntrySchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: { ...groupEntry(WRITERS), fields: { deletedAt: SYSTEM_ONLY } },
    update: {
      ...groupEntry(WRITERS),
      fields: {
        groupId: SYSTEM_ONLY,
        recipientId: SYSTEM_ONLY,
        kind: SYSTEM_ONLY,
        deletedAt: SYSTEM_ONLY,
        via: SYSTEM_ONLY,
      },
    },
    delete: groupEntry(WRITERS),
  },
} as const satisfies PartialPermissions;
