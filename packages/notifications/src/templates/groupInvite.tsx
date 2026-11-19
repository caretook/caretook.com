import { z } from "zod";
import { defineNotification } from "../define";
import { tokenZ } from "./appPath";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";

const ROLE_LABELS = {
  owner: "an owner",
  admin: "an admin",
  caretaker: "a caretaker",
  viewer: "a viewer",
} as const;

// An email invite to a care group (careGroupInviteService.createEmail and
// resend). It names the group and who sent it, and nothing else: no health
// details, ever. The link opens /invite/:token, where the person signs up or
// signs in with this address, reads what the group shares and agrees.
export const groupInvite = defineNotification({
  name: "groupInvite",
  sensitive: true,
  data: z.object({
    /** The group as its members see it (the care recipient's preferred name or name). */
    groupName: z.string().trim().min(1).max(200),
    inviterName: z.string().trim().max(100).optional(),
    role: z.enum(["owner", "admin", "caretaker", "viewer"]),
    token: tokenZ,
  }),
  email: (data, { link }) => {
    const href = link(`/invite/${data.token}`);
    const inviter = data.inviterName?.trim() || "Someone";
    return {
      subject: `${inviter} invited you to ${data.groupName}'s care group on Caretook`,
      react: (
        <EmailLayout preview={`Join ${data.groupName}'s care group on Caretook.`}>
          <Paragraph>Hi,</Paragraph>
          <Paragraph>
            {inviter} invited you to join {data.groupName}'s care group on Caretook as{" "}
            {ROLE_LABELS[data.role]}. Caretook helps family and helpers share what's going on with someone's
            care.
          </Paragraph>
          <ButtonLink href={href}>See the invitation</ButtonLink>
          <Muted>
            The invitation works for 7 days, with this email address only. If you weren't expecting it, you
            can ignore this email.
          </Muted>
        </EmailLayout>
      ),
    };
  },
});
