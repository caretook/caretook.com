import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "../core/columns";

import { foreignKey, index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { careGroupSchema } from "../care-groups/careGroup";
import { careGroupMemberSchema } from "../care-groups/careGroupMember";
import { audits, id, timestamps } from "../core/columns";

// A member asking their group's owners to turn assistants on (connectors-2,
// B-194): one row per ask, which emailed every owner. A member may ask once
// every ASSISTANT_REQUEST_WINDOW_DAYS per group (assistantRequestService).
//
// Written only by the system, inside assistantRequestService. Not synced:
// the member and the group's owners and admins read it through the API.
// Leaving the group (or being removed) takes the member's rows with it.
export const assistantRequestSchema = pgTable(
  "assistant_request",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => careGroupSchema.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    requestedAt: timestamp("requested_at", { precision: 3, mode: "string", withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps,
    ...audits,
  },
  (t) => [
    // The asker is a member of the group: their membership's end ends the rows.
    foreignKey({
      name: "assistant_request_member_fk",
      columns: [t.groupId, t.userId],
      foreignColumns: [careGroupMemberSchema.groupId, careGroupMemberSchema.userId],
    }).onDelete("cascade"),
    index("assistant_request_group_user_idx").on(t.groupId, t.userId, t.requestedAt),
  ],
);

/** How long after a request the member's next one returns it instead of emailing again. */
export const ASSISTANT_REQUEST_WINDOW_DAYS = 7;

export type AssistantRequestSchema = typeof assistantRequestSchema;
export type AssistantRequestSelect = InferSelectModel<AssistantRequestSchema>;
export type AssistantRequestInsert = Omit<InferInsertModel<AssistantRequestSchema>, ProtectedField>;
export type AssistantRequest = AssistantRequestSelect;
