import { z } from "zod";
import { defineNotification } from "../define";
import { tokenZ } from "./appPath";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";

// Staff set up a care group for a family (/admin's New group) and invite its
// first owner. Like `groupInvite`, it names the group and nothing else: no
// health details. The link opens /invite/:token, where the person signs up
// or signs in with this address, reads what the group shares and agrees.
export const ownerInvite = defineNotification({
  name: "ownerInvite",
  sensitive: true,
  data: z.object({
    /** The group as its members will see it (the care recipient's name). */
    groupName: z.string().trim().min(1).max(200),
    token: tokenZ,
  }),
  email: (data, { link }) => {
    const href = link(`/invite/${data.token}`);
    return {
      subject: `Your care group for ${data.groupName} is ready on Caretook`,
      react: (
        <EmailLayout preview={`Start ${data.groupName}'s care group on Caretook.`}>
          <Paragraph>Hi,</Paragraph>
          <Paragraph>
            The Caretook team set up a care group for {data.groupName}, with you as its owner. Caretook helps
            family and helpers share what's going on with someone's care. Once you've joined, you can invite
            the others who help.
          </Paragraph>
          <ButtonLink href={href}>Set up your care group</ButtonLink>
          <Muted>
            The invitation works for 7 days, with this email address only. If you weren't expecting it, you
            can ignore this email.
          </Muted>
        </EmailLayout>
      ),
    };
  },
});
