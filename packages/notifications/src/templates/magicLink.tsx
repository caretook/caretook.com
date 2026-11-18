import { z } from "zod";
import { defineNotification } from "../define";
import { appPathZ, tokenZ } from "./appPath";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";

// "Email me a link": only sent to existing accounts (magic links never
// create one), but the screen says the same thing either way.
export const magicLink = defineNotification({
  name: "magicLink",
  sensitive: true,
  data: z.object({
    token: tokenZ,
    /** Where the link lands once signed in. */
    next: appPathZ.default("/app"),
  }),
  email: (data, { link }) => {
    // Better Auth's endpoint checks the token, sets the session and
    // redirects; a used or expired link goes back to sign-in to say so.
    const href = link("/api/auth/magic-link/verify", {
      token: data.token,
      callbackURL: data.next,
      errorCallbackURL: "/sign-in?with=link&expired=1",
    });
    return {
      subject: "Your Caretook sign-in link",
      react: (
        <EmailLayout preview="Sign in to Caretook with one tap.">
          <Paragraph>Hi,</Paragraph>
          <Paragraph>Tap the button to sign in to Caretook on this device.</Paragraph>
          <ButtonLink href={href}>Sign in to Caretook</ButtonLink>
          <Muted>
            This link works once, for five minutes. If you didn't ask for it, you can ignore this email.
          </Muted>
        </EmailLayout>
      ),
    };
  },
});
