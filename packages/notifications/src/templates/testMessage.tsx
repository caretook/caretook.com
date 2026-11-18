import { z } from "zod";
import { defineNotification } from "../define";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";

// A harmless message for tests and the dev mailbox (`/dev/mail`).
export const testMessage = defineNotification({
  name: "testMessage",
  data: z.object({
    name: z.string().trim().min(1).max(100),
    message: z.string().trim().min(1).max(1000),
    /** Where the button goes: an app path. */
    path: z
      .string()
      .regex(/^\/(?!\/)/, "An app path starting with /")
      .default("/app"),
  }),
  email: (data, { link }) => {
    const href = link(data.path);
    return {
      subject: `A test message for ${data.name}`,
      react: (
        <EmailLayout preview={data.message}>
          <Paragraph>Hi {data.name},</Paragraph>
          <Paragraph>{data.message}</Paragraph>
          <ButtonLink href={href}>Open Caretook</ButtonLink>
          <Muted>This is a test message from Caretook. You can ignore it.</Muted>
        </EmailLayout>
      ),
    };
  },
});
