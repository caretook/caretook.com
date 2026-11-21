import { z } from "zod";
import { defineNotification } from "../define";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";

// A member asked the group's owners to turn assistants on (connectors-2,
// B-194): to every owner, at most once a week per member and group. It
// names the member and the group (as its members see it) and nothing else:
// no health details. The link opens the group's Assistants settings.
export const assistantsRequested = defineNotification({
  name: "assistantsRequested",
  data: z.object({
    groupId: z.uuid(),
    groupName: z.string().trim().min(1).max(200),
    memberName: z.string().trim().min(1).max(254),
  }),
  email: (data, { link }) => ({
    subject: `${data.memberName} asked to turn on assistants for ${data.groupName}'s care group`,
    react: (
      <EmailLayout preview={`${data.memberName} would like to connect their AI assistant.`}>
        <Paragraph>Hi,</Paragraph>
        <Paragraph>
          {data.memberName} would like to connect their own AI assistant, such as Claude or ChatGPT, to{" "}
          {data.groupName}'s care group on Caretook. Only an owner can allow that, in the group's settings
          under Assistants.
        </Paragraph>
        <ButtonLink href={link(`/app/groups/${data.groupId}/settings/assistants`)}>
          Open Assistants
        </ButtonLink>
        <Muted>
          Nothing changes unless you turn it on. You can turn it off again at any time, which disconnects
          every assistant.
        </Muted>
      </EmailLayout>
    ),
  }),
});
