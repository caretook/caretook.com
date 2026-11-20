import type { PartialPermissions } from "./types";

import { ANY_GROUP_ROLE, SYSTEM_ONLY, SYSTEM_ONLY_ENTRY, WRITERS, groupEntry } from "./blocks";

export const LIVE_NOTES_PERMISSIONS = {
  // Live documents on note and event entries. Writers add one (through
  // noteDocumentService, which checks the entry); the snapshot, text and editors are
  // written by compaction, as the system. Removing the entry hides it.
  noteDocumentSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: {
      ...groupEntry(WRITERS),
      fields: { snapshot: SYSTEM_ONLY, text: SYSTEM_ONLY, editors: SYSTEM_ONLY },
    },
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },

  // Append-only edits: writers add them, everyone in the group reads them
  // (viewers watch live). Only compaction (the system) deletes them.
  noteUpdateSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(WRITERS),
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },
} as const satisfies PartialPermissions;
