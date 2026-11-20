import type { PartialPermissions } from "./types";

import { ANY_GROUP_ROLE, SYSTEM_ONLY, WRITERS, groupEntry } from "./blocks";

export const TASKS_PERMISSIONS = {
  // The group's tasks (tasks PRD). Any member reads; writers create, edit
  // and soft-delete. Viewers may update, but taskService limits them to
  // completing and reopening tasks assigned to them
  // (taskService:viewerCompletionOnly). Write through taskService.
  taskSchema: {
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
