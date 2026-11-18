import { z } from "zod";
import { defineNotification } from "../define";
import { greeting, tokenZ } from "./appPath";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";

// "Forgot password?": only sent when the account exists, but the screen
// says the same thing either way.
export const resetPassword = defineNotification({
  name: "resetPassword",
  sensitive: true,
  data: z.object({
    name: z.string().trim().max(100).optional(),
    token: tokenZ,
  }),
  email: (data, { link }) => ({
    subject: "Reset your Caretook password",
    react: (
      <EmailLayout preview="Choose a new password for Caretook.">
        <Paragraph>{greeting(data.name)}</Paragraph>
        <Paragraph>
          Someone asked to reset the password for your Caretook account. Choose a new one here:
        </Paragraph>
        <ButtonLink href={link("/reset-password", { token: data.token })}>Choose a new password</ButtonLink>
        <Muted>
          This link works once, for one hour. If you didn't ask for it, ignore this email: your password stays
          the same.
        </Muted>
      </EmailLayout>
    ),
  }),
});
