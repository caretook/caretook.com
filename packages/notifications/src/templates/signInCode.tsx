import { z } from "zod";
import { defineNotification } from "../define";
import { Code, EmailLayout, Muted, Paragraph } from "./layout";

// "Email me a code": a 6-digit code to type into the sign-in screen (handy
// in the app, where a link would open the browser instead).
export const signInCode = defineNotification({
  name: "signInCode",
  sensitive: true,
  data: z.object({ code: z.string().regex(/^\d{6}$/, "Six digits") }),
  email: (data) => ({
    // The code stays out of the subject, which the outbox keeps after delivery.
    subject: "Your Caretook sign-in code",
    react: (
      <EmailLayout preview={`Your sign-in code is ${data.code}.`}>
        <Paragraph>Hi,</Paragraph>
        <Paragraph>Enter this code on the Caretook sign-in screen:</Paragraph>
        <Code>{data.code}</Code>
        <Muted>
          The code works for five minutes. If you didn't ask for it, you can ignore this email: nobody can
          sign in without it.
        </Muted>
      </EmailLayout>
    ),
  }),
});
