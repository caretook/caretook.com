import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";
import type { ReminderLead } from "./calendarRules";

import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { userSchema } from "../auth/user";
import { careGroupSchema } from "../care-groups/careGroup";
import { audits, id, timestamps } from "../core/columns";
import { DEFAULT_REMINDER_LEADS } from "./calendarRules";

const timestampColumn = (name: string) =>
  timestamp(name, { precision: 3, mode: "string", withTimezone: true });

// One member's calendar settings for one care group (appointments-2): their
// reminder emails, their details consent, and their feed. Made on the first
// change (no row reads as the defaults) and deleted when they leave or are
// removed (careGroupMemberService). Not synced: read and written through
// `calendars.*`, only by the member.
export const memberCalendarSettingSchema = pgTable(
  "member_calendar_setting",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    // Consented to details outside Caretook ⇔ set, with the version of
    // DETAILS_CONSENT_TEXT they saw. Turning details off clears both.
    detailsConsentAt: timestampColumn("details_consent_at"),
    detailsConsentVersion: text("details_consent_version"),
    remindersOn: boolean("reminders_on").notNull().default(false),
    // Up to three of REMINDER_LEADS, in that order.
    reminderLeads: jsonb("reminder_leads")
      .$type<ReminderLead[]>()
      .notNull()
      .default([...DEFAULT_REMINDER_LEADS]),
    // The feed's secret (slice 5): its SHA-256 only, never the token.
    feedTokenHash: text("feed_token_hash"),
    feedRotatedAt: timestampColumn("feed_rotated_at"),
    ...timestamps,
    ...audits,
  },
  (t) => [
    uniqueIndex("member_calendar_setting_user_group_unique").on(t.userId, t.groupId),
    index("member_calendar_setting_group_idx").on(t.groupId),
    uniqueIndex("member_calendar_setting_feed_unique").on(t.feedTokenHash),
  ],
);

export type MemberCalendarSettingSchema = typeof memberCalendarSettingSchema;
export type MemberCalendarSettingSelect = InferSelectModel<MemberCalendarSettingSchema>;
export type MemberCalendarSettingInsert = Omit<InferInsertModel<MemberCalendarSettingSchema>, ProtectedField>;
export type MemberCalendarSetting = MemberCalendarSettingSelect;
