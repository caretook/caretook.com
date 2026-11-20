import { z } from "zod";
import { defineNotification } from "../define";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";

// Someone used an access code (/join/:code) with an address that already has
// an account. The page says "check your email" either way, so it can't be used
// to find out who has an account; the account's owner gets this instead. It
// carries nothing the person typed (no names, no code) and no health details.
export const accessCodeExistingAccount = defineNotification({
  name: "accessCodeExistingAccount",
  data: z.object({}),
  email: (_data, { link }) => ({
    subject: "Starting a care group on Caretook",
    react: (
      <EmailLayout preview="You already have a Caretook account.">
        <Paragraph>Hi,</Paragraph>
        <Paragraph>
          Someone tried to start a care group on Caretook with your address. You already have an account, so
          nothing was created.
        </Paragraph>
        <Paragraph>If it was you, sign in and choose New care group.</Paragraph>
        <ButtonLink href={link("/sign-in", { redirectTo: "/app/groups/new" })}>
          Sign in to Caretook
        </ButtonLink>
        <Muted>If it wasn't you, you can ignore this email: your account hasn't changed.</Muted>
      </EmailLayout>
    ),
  }),
});
