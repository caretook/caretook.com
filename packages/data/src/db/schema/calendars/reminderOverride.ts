import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";
import type { ReminderLead } from "./calendarRules";

import { foreignKey, index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { userSchema } from "../auth/user";
import { careGroupSchema } from "../care-groups/careGroup";
import { audits, enumCheck, id, timestamps } from "../core/columns";
import { timelineEntrySchema } from "../timeline/timelineEntry";
import { REMINDER_OVERRIDE_MODES } from "./calendarRules";

// A member's reminder choice for one appointment or reminder
// (appointments-2, the "Remind me" sheet): no reminders for it (`mute`), or
// extra leads for it (`extra`, with `leads`). For that member only; deleted
// when they leave or are removed, and with the entry.
export const reminderOverrideSchema = pgTable(
  "reminder_override",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id").notNull(),
    mode: text("mode", { enum: REMINDER_OVERRIDE_MODES }).notNull(),
    // `extra` only: up to three of REMINDER_LEADS.
    leads: jsonb("leads").$type<ReminderLead[]>(),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // The entry is in the override's group; a hard delete takes the override with it.
    foreignKey({
      name: "reminder_override_entry_fk",
      columns: [t.groupId, t.entryId],
      foreignColumns: [timelineEntrySchema.groupId, timelineEntrySchema.id],
    }).onDelete("cascade"),
    uniqueIndex("reminder_override_user_entry_unique").on(t.userId, t.entryId),
    index("reminder_override_group_user_idx").on(t.groupId, t.userId),
    enumCheck("reminder_override_mode_check", t.mode, REMINDER_OVERRIDE_MODES),
  ],
);

export type ReminderOverrideSchema = typeof reminderOverrideSchema;
export type ReminderOverrideSelect = InferSelectModel<ReminderOverrideSchema>;
export type ReminderOverrideInsert = Omit<InferInsertModel<ReminderOverrideSchema>, ProtectedField>;
export type ReminderOverride = ReminderOverrideSelect;
