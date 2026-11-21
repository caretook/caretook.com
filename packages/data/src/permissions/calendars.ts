import type { PartialPermissions } from "./types";

import { NO_ACCESS, SYSTEM_ONLY, SYSTEM_ONLY_SCHEMA } from "./blocks";

/** The member's own rows only: nobody else reads or writes them, owners and staff included. */
const OWN = {
  ...NO_ACCESS,
  admin: ["owned"],
  support: ["owned"],
  member: ["owned"],
  system: ["all"],
} as const;

export const CALENDARS_PERMISSIONS = {
  // A member's calendar settings for one group (appointments-2). Only the
  // member reads and writes their own; calendarSettingService checks they're
  // in the group, records consent and deletes the row when they go. The
  // feed's secret is set only by the system (calendarFeedService).
  memberCalendarSettingSchema: {
    ownerField: "userId",
    groupField: "groupId",
    create: { ...OWN, fields: { feedTokenHash: SYSTEM_ONLY, feedRotatedAt: SYSTEM_ONLY } },
    read: OWN,
    list: OWN,
    update: {
      ...OWN,
      fields: {
        userId: SYSTEM_ONLY,
        groupId: SYSTEM_ONLY,
        feedTokenHash: SYSTEM_ONLY,
        feedRotatedAt: SYSTEM_ONLY,
      },
    },
    delete: OWN,
  },
  // A member's reminder choice for one appointment or reminder: theirs alone.
  reminderOverrideSchema: {
    ownerField: "userId",
    groupField: "groupId",
    create: OWN,
    read: OWN,
    list: OWN,
    update: { ...OWN, fields: { userId: SYSTEM_ONLY, groupId: SYSTEM_ONLY, entryId: SYSTEM_ONLY } },
    delete: OWN,
  },
  // Google Calendar (slice 7): the system's only. googleConnectionService and
  // calendarSyncService check membership themselves and return a status,
  // never a token; nothing is written through a model.
  googleCalendarConnectionSchema: SYSTEM_ONLY_SCHEMA,
  googleEventLinkSchema: SYSTEM_ONLY_SCHEMA,
  calendarSyncJobSchema: SYSTEM_ONLY_SCHEMA,
  googleOauthStateSchema: SYSTEM_ONLY_SCHEMA,
} as const satisfies PartialPermissions;
