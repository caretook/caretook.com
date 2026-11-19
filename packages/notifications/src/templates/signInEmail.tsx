import { z } from "zod";
import { defineNotification } from "../define";
import { appPathZ, tokenZ } from "./appPath";
import { ButtonLink, Code, EmailLayout, Muted, Paragraph } from "./layout";

// "Email me a sign-in link" (B-96): one email with both a one-tap link and a
// 6-digit code, so the code works when the email is read on another device
// (or in the app, where a link would open the browser instead). Only sent to
// existing accounts, but the screen says the same thing either way.
export const signInEmail = defineNotification({
  name: "signInEmail",
  sensitive: true,
  data: z.object({
    token: tokenZ,
    code: z.string().regex(/^\d{6}$/, "Six digits"),
    /** Where the link lands once signed in. */
    next: appPathZ.default("/app"),
  }),
  email: (data, { link }) => {
    // Better Auth's endpoint checks the token, sets the session and
    // redirects; a used or expired link goes back to sign-in to say so.
    const href = link("/api/auth/magic-link/verify", {
      token: data.token,
      callbackURL: data.next,
      errorCallbackURL: "/sign-in?with=email&expired=1",
    });
    return {
      // The code stays out of the subject and the preview, which a lock
      // screen shows (and the outbox keeps the subject after delivery).
      subject: "Your Caretook sign-in link and code",
      react: (
        <EmailLayout preview="Sign in to Caretook with one tap, or with a code.">
          <Paragraph>Hi,</Paragraph>
          <Paragraph>Tap the button to sign in to Caretook on this device.</Paragraph>
          <ButtonLink href={href}>Sign in to Caretook</ButtonLink>
          <Paragraph>Or enter this code on the Caretook sign-in screen:</Paragraph>
          <Code>{data.code}</Code>
          <Muted>
            The link works once, and the link and code work for five minutes. If you didn't ask for them, you
            can ignore this email: nobody can sign in without them.
          </Muted>
        </EmailLayout>
      ),
    };
  },
});
