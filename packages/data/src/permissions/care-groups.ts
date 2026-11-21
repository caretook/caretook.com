import type { PartialPermissions } from "./types";

import {
  ADMIN_ONLY_PERMISSION_ENTRY,
  ANY_GROUP_ROLE,
  MANAGERS,
  OWNERS,
  SIGNED_IN_PERMISSION_ENTRY,
  STAFF_PERMISSION_ENTRY,
  SYSTEM_ONLY,
  SYSTEM_ONLY_ENTRY,
  groupEntry,
} from "./blocks";

export const CARE_GROUPS_PERMISSIONS = {
  careGroupSchema: {
    groupField: "id",
    // Anyone signed in can start a group. Use careGroupService.create, which
    // makes the creator its first owner in the same transaction.
    create: SIGNED_IN_PERMISSION_ENTRY,
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    update: groupEntry(MANAGERS),
    delete: groupEntry(OWNERS),
  },

  // Role rules the map can't express (only owners touch owners, a group
  // always keeps an owner) live in careGroupMemberService. Write through it.
  careGroupMemberSchema: {
    ownerField: "userId",
    groupField: "groupId",
    read: groupEntry(ANY_GROUP_ROLE),
    list: groupEntry(ANY_GROUP_ROLE),
    // Sharing (relationship, shared fields) is the member's own and the
    // emergency list (rank, primary contact) the managers', but both need
    // rules the map can't express: memberSharingService and
    // emergencyContactService check them and write as the system.
    create: {
      ...groupEntry(MANAGERS),
      fields: {
        invitedBy: SYSTEM_ONLY,
        relationship: SYSTEM_ONLY,
        sharedFields: SYSTEM_ONLY,
        emergencyRank: SYSTEM_ONLY,
        isPrimaryContact: SYSTEM_ONLY,
        emergencyDroppedAt: SYSTEM_ONLY,
        // Easy mode starts off; managers turn it on afterwards (setMode).
        simpleMode: SYSTEM_ONLY,
        simpleModeLocked: SYSTEM_ONLY,
      },
    },
    update: {
      ...groupEntry(MANAGERS),
      // A membership can change role, never group or user. Managers also set
      // easy mode (`simpleMode`, `simpleModeLocked`); the owner and
      // own-lock rules are careGroupMemberService.setMode's.
      fields: {
        groupId: SYSTEM_ONLY,
        userId: SYSTEM_ONLY,
        invitedBy: SYSTEM_ONLY,
        relationship: SYSTEM_ONLY,
        sharedFields: SYSTEM_ONLY,
        emergencyRank: SYSTEM_ONLY,
        isPrimaryContact: SYSTEM_ONLY,
        emergencyDroppedAt: SYSTEM_ONLY,
      },
    },
    // Managers remove members; anyone can remove themselves (leave).
    delete: { ...groupEntry(MANAGERS), admin: ["owned"], support: ["owned"], member: ["owned"] },
  },

  // Invites carry the invitee's email, so only managers see them. The
  // invitee reads theirs by token through the service (as SYSTEM_USER).
  careGroupInviteSchema: {
    groupField: "groupId",
    read: groupEntry(MANAGERS),
    list: groupEntry(MANAGERS),
    create: {
      ...groupEntry(MANAGERS),
      fields: {
        status: SYSTEM_ONLY,
        acceptedBy: SYSTEM_ONLY,
        respondedAt: SYSTEM_ONLY,
        useCount: SYSTEM_ONLY,
      },
    },
    update: {
      ...groupEntry(MANAGERS),
      // Managers may only revoke (status); everything else is fixed.
      fields: {
        groupId: SYSTEM_ONLY,
        email: SYSTEM_ONLY,
        role: SYSTEM_ONLY,
        tokenHash: SYSTEM_ONLY,
        expiresAt: SYSTEM_ONLY,
        acceptedBy: SYSTEM_ONLY,
        respondedAt: SYSTEM_ONLY,
        kind: SYSTEM_ONLY,
        maxUses: SYSTEM_ONLY,
        useCount: SYSTEM_ONLY,
        consentAttestedBy: SYSTEM_ONLY,
        consentAttestedAt: SYSTEM_ONLY,
        consentVersion: SYSTEM_ONLY,
        tokenCiphertext: SYSTEM_ONLY,
      },
    },
    delete: groupEntry(MANAGERS),
  },

  // Who agreed to what a group shares, and when. Written only by the system
  // (careGroupInviteService.accept); read by the group's owners and admins,
  // and by the member themselves.
  careGroupConsentSchema: {
    ownerField: "userId",
    groupField: "groupId",
    read: { ...groupEntry(MANAGERS), admin: ["owned"], support: ["owned"], member: ["owned"] },
    list: { ...groupEntry(MANAGERS), admin: ["owned"], support: ["owned"], member: ["owned"] },
    create: SYSTEM_ONLY_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },

  // Requests to join from an invite link. Read by the group's owners and
  // admins, and by the requester themselves; written only by the system
  // (joinRequestService, careGroupInviteService.accept).
  careGroupJoinRequestSchema: {
    ownerField: "userId",
    groupField: "groupId",
    read: { ...groupEntry(MANAGERS), admin: ["owned"], support: ["owned"], member: ["owned"] },
    list: { ...groupEntry(MANAGERS), admin: ["owned"], support: ["owned"], member: ["owned"] },
    create: SYSTEM_ONLY_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },

  // Access codes (staff-made tickets for starting a group) and who used
  // them: Caretook staff (admin and support) only. Redeeming a code runs as
  // the system, inside sign-up (accessCodeService.redeem).
  accessCodeSchema: {
    create: STAFF_PERMISSION_ENTRY,
    read: STAFF_PERMISSION_ENTRY,
    list: STAFF_PERMISSION_ENTRY,
    update: { ...STAFF_PERMISSION_ENTRY, fields: { code: SYSTEM_ONLY, useCount: SYSTEM_ONLY } },
    delete: ADMIN_ONLY_PERMISSION_ENTRY,
  },

  accessCodeRedemptionSchema: {
    create: SYSTEM_ONLY_ENTRY,
    read: STAFF_PERMISSION_ENTRY,
    list: STAFF_PERMISSION_ENTRY,
    update: SYSTEM_ONLY_ENTRY,
    delete: SYSTEM_ONLY_ENTRY,
  },
} as const satisfies PartialPermissions;
