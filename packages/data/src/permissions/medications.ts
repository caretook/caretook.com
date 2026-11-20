import type { PartialPermissions } from "./types";

import { ANY_GROUP_ROLE, SYSTEM_ONLY, WRITERS, groupEntry } from "./blocks";

export const MEDICATIONS_PERMISSIONS = {
  // The group's medication list. Any writer adds, edits and deletes any
  // medication; deletes are soft (medicationModel.remove sets deletedAt under
  // this delete permission), so its doses and changes keep its name. Write
  // through medicationService, which checks the prescriber and pharmacy and
  // writes the timeline's change entry.
  medicationSchema: {
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

  // The group's medication passes (Morning, Evening…): like medication. Any
  // writer adds, renames, retimes, reorders and soft-deletes them. Write
  // through medicationPassService, which keeps names unique, writes a
  // retime's change entry and rewrites schedules when a pass is deleted.
  medicationPassSchema: {
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
