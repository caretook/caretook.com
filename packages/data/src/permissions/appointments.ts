import type { PartialPermissions } from "./types";

import { ANY_GROUP_ROLE, SYSTEM_ONLY, WRITERS, groupEntry } from "./blocks";

export const APPOINTMENTS_PERMISSIONS = {
  // Repeating appointments and reminders (appointments-2). Any member reads;
  // writers create, edit and (soft) delete. Write through
  // appointmentSeriesService, which writes the visits with the series.
  appointmentSeriesSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: { ...groupEntry(WRITERS), fields: { deletedAt: SYSTEM_ONLY } },
    update: {
      ...groupEntry(WRITERS),
      fields: { groupId: SYSTEM_ONLY, recipientId: SYSTEM_ONLY, kind: SYSTEM_ONLY, deletedAt: SYSTEM_ONLY },
    },
    delete: groupEntry(WRITERS),
  },
} as const satisfies PartialPermissions;
