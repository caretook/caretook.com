import type { PartialPermissions } from "./types";

import { ANY_GROUP_ROLE, SYSTEM_ONLY, WRITERS, groupEntry } from "./blocks";

export const TODOS_PERMISSIONS = {
  // The group's todos (tasks PRD). Any member reads; writers create, edit
  // and soft-delete. Viewers may update, but todoService limits them to
  // completing and reopening todos assigned to them
  // (todoService:viewerCompletionOnly). Write through todoService.
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
} as const satisfies PartialPermissions;
