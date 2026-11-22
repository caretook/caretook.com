import type { PartialPermissions } from "./types";

import { ANY_GROUP_ROLE, LOGGERS, SYSTEM_ONLY, SYSTEM_ONLY_ENTRY, groupEntry } from "./blocks";

export const LIVE_NOTES_PERMISSIONS = {
  // Live documents on note and event entries. Loggers add one through
  // noteDocumentService, which checks the actor may update the owner (an
  // Easy helper: only an entry they created, never a provider's, a
  // medication's, a care period's or a todo's); the snapshot, text and
  // editors are written by compaction, as the system. Removing the entry
  // hides it.
  noteDocumentSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: {
      ...groupEntry(LOGGERS),
      fields: { snapshot: SYSTEM_ONLY, text: SYSTEM_ONLY, editors: SYSTEM_ONLY },
    },
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },

  // Append-only edits: loggers add them (noteDocumentService checks the
  // owner as for documents), everyone in the group reads them (viewers watch
  // live). Only compaction (the system) deletes them.
  noteUpdateSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(LOGGERS),
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },
} as const satisfies PartialPermissions;
