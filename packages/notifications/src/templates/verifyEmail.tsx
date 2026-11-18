import { z } from "zod";
import { defineNotification } from "../define";
import { appPathZ, greeting, tokenZ } from "./appPath";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";

// Sent when an unverified account tries to sign in, or asks for a new link.
export const verifyEmail = defineNotification({
  name: "verifyEmail",
  sensitive: true,
  data: z.object({
    name: z.string().trim().max(100).optional(),
    token: tokenZ,
    /** Where to go once verified. */
    next: appPathZ.optional(),
  }),
  email: (data, { link }) => {
    const href = link("/verify-email", { token: data.token, ...(data.next ? { next: data.next } : {}) });
    return {
      subject: "Confirm your email for Caretook",
      react: (
        <EmailLayout preview="Confirm your email address to start using Caretook.">
          <Paragraph>{greeting(data.name)}</Paragraph>
          <Paragraph>
            Confirm this is your email address to finish setting up your Caretook account.
          </Paragraph>
          <ButtonLink href={href}>Confirm my email</ButtonLink>
          <Muted>This link works for one hour. If you didn't ask for it, you can ignore this email.</Muted>
        </EmailLayout>
      ),
    };
  },
});
