import { CONTACT_TOPIC_LABELS, CONTACT_TOPICS } from "@caretook/data/schema";
import { z } from "zod";
import { defineNotification } from "../define";
import { EmailLayout, Muted, Paragraph } from "./layout";

// A message from the marketing site's contact form, to the team's support
// address (SUPPORT_EMAIL; marketing slice 4). It carries what the visitor
// typed, which is the point of it, and goes only to the team. Privacy topics
// are flagged in the subject so they can be filtered and answered first.

export const PRIVACY_SUBJECT_FLAG = "[Privacy]";

/** The subject: the topic and who wrote, with privacy messages flagged. */
export const contactSubject = (data: { name: string; topic: (typeof CONTACT_TOPICS)[number] }) =>
  `${data.topic === "privacy" ? `${PRIVACY_SUBJECT_FLAG} ` : ""}Contact: ${CONTACT_TOPIC_LABELS[data.topic]}, from ${data.name}`;

export const contactMessage = defineNotification({
  name: "contactMessage",
  data: z.object({
    messageId: z.uuid(),
    name: z.string().trim().min(1).max(100),
    email: z.email().max(254),
    topic: z.enum(CONTACT_TOPICS),
    message: z.string().trim().min(1).max(5000),
  }),
  email: (data) => ({
    subject: contactSubject(data),
    react: (
      <EmailLayout preview={`${CONTACT_TOPIC_LABELS[data.topic]}, from ${data.name}`}>
        <Paragraph>
          {data.name} ({data.email}) wrote through the contact form about: {CONTACT_TOPIC_LABELS[data.topic]}.
        </Paragraph>
        {data.message.split(/\n+/).map((line, i) => (
          <Paragraph key={i}>{line}</Paragraph>
        ))}
        <Muted>
          Reply to {data.email} to answer. Message {data.messageId}, kept in the contact_message table.
        </Muted>
      </EmailLayout>
    ),
  }),
});
