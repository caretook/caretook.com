import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ProtectedField } from "./columns";

import { sql } from "drizzle-orm";
import { check, pgTable, text } from "drizzle-orm/pg-core";
import { audits, enumCheck, id, timestamps } from "./columns";
import { CONTACT_MESSAGE_MAX, CONTACT_TOPICS } from "./publicFormRules";

// A message from the marketing site's contact form (marketing slice 4). Kept
// beside the `contactMessage` email to SUPPORT_EMAIL, which is queued in the
// same transaction (contactMessageService.send). No IP address or user agent
// is stored. Written only by the system; staff (global admin) read it.
export const contactMessageSchema = pgTable(
  "contact_message",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    topic: text("topic", { enum: CONTACT_TOPICS }).notNull(),
    message: text("message").notNull(),
    ...timestamps,
    ...audits,
  },
  (t) => [
    enumCheck("contact_message_topic_check", t.topic, CONTACT_TOPICS),
    check(
      "contact_message_message_length",
      sql`char_length(${t.message}) <= ${sql.raw(String(CONTACT_MESSAGE_MAX))}`,
    ),
  ],
);

export type ContactMessageSchema = typeof contactMessageSchema;
export type ContactMessage = InferSelectModel<ContactMessageSchema>;
export type ContactMessageInsert = Omit<InferInsertModel<ContactMessageSchema>, ProtectedField>;
