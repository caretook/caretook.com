import type { PartialPermissions } from "./types";

import { ANY_GROUP_ROLE, SYSTEM_ONLY, WRITERS, groupEntry } from "./blocks";

export const CARE_PERIODS_PERMISSIONS = {
  // Where the recipient's care happens, over time (one track per group). Any
  // writer adds, edits and deletes any period; deletes are soft
  // (carePeriodModel.remove sets deletedAt under this delete permission), so
  // the deletion syncs. Write through carePeriodService, which checks the
  // place and the start.
  carePeriodSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: { ...groupEntry(WRITERS), fields: { deletedAt: SYSTEM_ONLY } },
    update: {
      ...groupEntry(WRITERS),
      fields: { groupId: SYSTEM_ONLY, recipientId: SYSTEM_ONLY, deletedAt: SYSTEM_ONLY },
    },
    delete: groupEntry(WRITERS),
  },
} as const satisfies PartialPermissions;
