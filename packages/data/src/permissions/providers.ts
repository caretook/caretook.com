import type { PartialPermissions } from "./types";

import { ANY_GROUP_ROLE, SYSTEM_ONLY, SYSTEM_ONLY_ENTRY, WRITERS, groupEntry } from "./blocks";

export const PROVIDERS_PERMISSIONS = {
  // The group's provider directory. Any writer adds, edits and deletes any
  // provider; deletes are soft (providerModel.remove sets deletedAt under
  // this delete permission), so linked entries keep the name. Write through
  // providerService, which checks the practice.
  providerSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: { ...groupEntry(WRITERS), fields: { deletedAt: SYSTEM_ONLY } },
    update: { ...groupEntry(WRITERS), fields: { groupId: SYSTEM_ONLY, deletedAt: SYSTEM_ONLY } },
    delete: groupEntry(WRITERS),
  },

  // Which providers an event or note was with. Writers link and unlink
  // (a hard delete); a link never changes, so update is the system's.
  // Write through entryProviderService, which checks both ends.
  timelineEntryProviderSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(WRITERS),
    update: SYSTEM_ONLY_ENTRY,
    delete: groupEntry(WRITERS),
  },
} as const satisfies PartialPermissions;
