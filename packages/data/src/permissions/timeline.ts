import type { PartialPermissions } from "./types";

import {
  ANY_GROUP_ROLE,
  LOGGERS,
  OWN_ROW_LOGGERS,
  SYSTEM_ONLY,
  SYSTEM_ONLY_ENTRY,
  SYSTEM_ONLY_SCHEMA,
  WRITERS,
  groupEntry,
  groupOwnEntry,
} from "./blocks";

export const TIMELINE_PERMISSIONS = {
  // Loggers add entries (an Easy helper too: timelineEntryService limits
  // them to hand-written kinds and doses). Any writer may edit or delete any
  // entry; an Easy helper only the ones they created (`groupOwn`). Deletes
  // are soft (timelineEntryModel.remove sets deletedAt under this delete
  // permission); hard deletes are system-only (purge).
  timelineEntrySchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: { ...groupEntry(LOGGERS), fields: { deletedAt: SYSTEM_ONLY } },
    update: {
      ...groupOwnEntry(WRITERS, OWN_ROW_LOGGERS),
      fields: {
        groupId: SYSTEM_ONLY,
        recipientId: SYSTEM_ONLY,
        kind: SYSTEM_ONLY,
        deletedAt: SYSTEM_ONLY,
        via: SYSTEM_ONLY,
      },
    },
    delete: groupOwnEntry(WRITERS, OWN_ROW_LOGGERS),
  },

  // Accepted duplicate uploads of a dose (B-627): written and read directly
  // by timelineEntryService.upsert, never through a model.
  doseDuplicateUploadSchema: SYSTEM_ONLY_SCHEMA,

  // The group's symptom catalog (symptom-catalog): every member reads it;
  // anyone who may log a symptom may add one (an Easy helper too: a refused
  // log would lose a care observation). Updates are system-only here:
  // symptomTypeService.archive/unarchive check for a writer (`WRITERS`) and
  // write past this map. Rows are removed only with their group.
  symptomTypeSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(LOGGERS),
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },
} as const satisfies PartialPermissions;
