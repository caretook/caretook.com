import type { PartialPermissions } from "./types";

import { ANY_GROUP_ROLE, SYSTEM_ONLY, SYSTEM_ONLY_ENTRY, WRITERS, groupEntry } from "./blocks";

export const TODOS_PERMISSIONS = {
  // The group's todos (todos PRD). Any member reads; writers create, edit
  // and soft-delete. Viewers may update, but todoService limits them to
  // completing and reopening todos assigned to them
  // (todoService:completionOnly). Write through todoService.
  todoSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: { ...groupEntry(WRITERS), fields: { deletedAt: SYSTEM_ONLY } },
    update: {
      ...groupEntry(ANY_GROUP_ROLE),
      fields: { groupId: SYSTEM_ONLY, recipientId: SYSTEM_ONLY, deletedAt: SYSTEM_ONLY, via: SYSTEM_ONLY },
    },
    delete: groupEntry(WRITERS),
  },

  // Which todos a note or event links (planner-3). Any member reads; writers
  // link and unlink (a hard delete); a link never changes, so update is the
  // system's. Viewers and both easy roles only tick a todo (todoService).
  // Write through entryTodoService, which checks both ends.
  timelineEntryTodoSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(WRITERS),
    update: SYSTEM_ONLY_ENTRY,
    delete: groupEntry(WRITERS),
  },
} as const satisfies PartialPermissions;
