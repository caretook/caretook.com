import type { PartialPermissions } from "./types";

import {
  ANY_GROUP_ROLE,
  MANAGERS,
  NO_ACCESS,
  SYSTEM_ONLY,
  SYSTEM_ONLY_ENTRY,
  WRITERS,
  groupEntry,
} from "./blocks";

export const PROFILES_PERMISSIONS = {
  careRecipientSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(MANAGERS),
    update: { ...groupEntry(WRITERS), fields: { groupId: SYSTEM_ONLY } },
    delete: groupEntry(MANAGERS),
  },

  // The recipient's sensitive details (profiles): phones, email, address,
  // insurance and outside contacts. Owners, admins and caretakers only;
  // viewers get none (and the writers stream keeps it off their devices).
  // Outside contacts are the managers': careRecipientDetailsService checks
  // the role and writes them as the system.
  careRecipientDetailsSchema: {
    groupField: "groupId",
    read: groupEntry(WRITERS),
    list: groupEntry(WRITERS),
    create: { ...groupEntry(WRITERS), fields: { outsideContacts: SYSTEM_ONLY } },
    update: {
      ...groupEntry(WRITERS),
      fields: { groupId: SYSTEM_ONLY, recipientId: SYSTEM_ONLY, outsideContacts: SYSTEM_ONLY },
    },
    delete: SYSTEM_ONLY_ENTRY,
  },

  // A member's own contact details: theirs alone (staff included), never
  // replicated. Groups see only what's shared, through member_contact_share.
  userContactSchema: {
    ownerField: "userId",
    create: { ...NO_ACCESS, admin: ["owned"], support: ["owned"], member: ["owned"], system: ["all"] },
    read: { ...NO_ACCESS, admin: ["owned"], support: ["owned"], member: ["owned"], system: ["all"] },
    list: { ...NO_ACCESS, admin: ["owned"], support: ["owned"], member: ["owned"], system: ["all"] },
    update: {
      ...NO_ACCESS,
      admin: ["owned"],
      support: ["owned"],
      member: ["owned"],
      system: ["all"],
      fields: { userId: SYSTEM_ONLY },
    },
    delete: { ...NO_ACCESS, admin: ["owned"], support: ["owned"], member: ["owned"], system: ["all"] },
  },

  // What each member shares with a group: read by the group, written only
  // by the services that keep it in step (userContactService,
  // memberSharingService), as the system.
  memberContactShareSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: SYSTEM_ONLY_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },

  // The recipient's allergies: like medication (soft deletes, writers write).
  recipientAllergySchema: {
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

  // The recipient's conditions (conditions): like allergies (soft deletes, writers write).
  recipientConditionSchema: {
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

  // What a medication is for (conditions slice 4): links between a
  // medication and the recipient's conditions. Writers link and unlink (a
  // hard delete); a link never changes, so update is the system's. Write
  // through medicationConditionService, which checks both ends.
  medicationConditionSchema: {
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    create: groupEntry(WRITERS),
    update: SYSTEM_ONLY_ENTRY,
    delete: groupEntry(WRITERS),
  },
} as const satisfies PartialPermissions;
