import type { PartialPermissions } from "./types";

import {
  ANY_GROUP_ROLE,
  LOGGERS,
  OWNERS,
  OWN_ROW_LOGGERS,
  SYSTEM_ONLY,
  SYSTEM_ONLY_ENTRY,
  WRITERS,
  groupEntry,
  groupOwnEntry,
} from "./blocks";

export const TAGS_PERMISSIONS = {
  // A care group's shared tag list (tags PRD). Every member reads it; anyone
  // who may log adds a tag (an Easy helper too). Owners, admins and
  // caretakers rename any tag, an Easy helper only one they created
  // (`groupOwn`; when two people add one tag offline, the first upload's
  // author is its creator). Only owners delete one (a hard delete; links
  // cascade). Write through tagService, which derives the id and the key.
  tagSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(LOGGERS),
    update: {
      ...groupOwnEntry(WRITERS, OWN_ROW_LOGGERS),
      fields: { groupId: SYSTEM_ONLY, nameKey: SYSTEM_ONLY },
    },
    delete: groupEntry(OWNERS),
  },

  // Which records carry which tags. Any member reads; loggers link and
  // unlink (a hard delete); a link never changes. recordTagService narrows
  // it: writers tag any record, an Easy helper only their own entries
  // (`canTagRecord`). Tagging never borrows a record's update permission.
  recordTagSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(LOGGERS),
    update: SYSTEM_ONLY_ENTRY,
    delete: groupEntry(LOGGERS),
  },
} as const satisfies PartialPermissions;
