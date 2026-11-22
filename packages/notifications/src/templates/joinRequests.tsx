import { z } from "zod";
import { defineNotification } from "../define";
import { greeting } from "./appPath";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";

// The emails around a request to join from an invite link (invites slice 4):
// to the group's owners and admins when someone asks, and to the requester
// when it's approved or declined. They name the group (as its members see
// it), the requester and the role, and nothing else: no health details.

const ROLE_LABELS = {
  caretaker: "a caretaker",
  viewer: "a viewer",
  easy_helper: "an Easy helper",
  easy_viewer: "an Easy viewer",
} as const;
const groupNameZ = z.string().trim().min(1).max(200);
const groupIdZ = z.uuid();

export const joinRequested = defineNotification({
  name: "joinRequested",
  data: z.object({
    groupId: groupIdZ,
    groupName: groupNameZ,
    requesterName: z.string().trim().max(100).optional(),
    requesterEmail: z.email().max(254),
    role: z.enum(["caretaker", "viewer", "easy_helper", "easy_viewer"]),
  }),
  email: (data, { link }) => {
    const who = data.requesterName?.trim() || data.requesterEmail;
    return {
      subject: `${who} asked to join ${data.groupName}'s care group`,
      react: (
        <EmailLayout preview={`${who} is waiting for your answer.`}>
          <Paragraph>Hi,</Paragraph>
          <Paragraph>
            {who} ({data.requesterEmail}) used an invite link to ask to join {data.groupName}'s care group as{" "}
            {ROLE_LABELS[data.role]}. They can't see anything in the group until an owner or admin approves.
          </Paragraph>
          <ButtonLink href={link(`/app/groups/${data.groupId}/settings/members`)}>
            Answer the request
          </ButtonLink>
          <Muted>
            If you don't know them, decline the request, and revoke the link if it went further than you
            meant.
          </Muted>
        </EmailLayout>
      ),
    };
  },
});

export const joinApproved = defineNotification({
  name: "joinApproved",
  data: z.object({
    name: z.string().trim().max(100).optional(),
    groupId: groupIdZ,
    groupName: groupNameZ,
    role: z.enum(["caretaker", "viewer", "easy_helper", "easy_viewer"]),
  }),
  email: (data, { link }) => ({
    subject: `You're in ${data.groupName}'s care group`,
    react: (
      <EmailLayout preview={`Your request to join ${data.groupName}'s care group was approved.`}>
        <Paragraph>{greeting(data.name)}</Paragraph>
        <Paragraph>
          Your request to join {data.groupName}'s care group on Caretook was approved. You're in as{" "}
          {ROLE_LABELS[data.role]}.
        </Paragraph>
        <ButtonLink href={link(`/app/groups/${data.groupId}`)}>Open the care group</ButtonLink>
      </EmailLayout>
    ),
  }),
});

export const joinDeclined = defineNotification({
  name: "joinDeclined",
  data: z.object({
    name: z.string().trim().max(100).optional(),
    groupName: groupNameZ,
  }),
  email: (data, { link }) => ({
    subject: `Your request to join ${data.groupName}'s care group`,
    react: (
      <EmailLayout preview={`Your request to join ${data.groupName}'s care group wasn't approved.`}>
        <Paragraph>{greeting(data.name)}</Paragraph>
        <Paragraph>
          Your request to join {data.groupName}'s care group on Caretook wasn't approved. If you think that's
          a mistake, ask the person who shared the link.
        </Paragraph>
        <ButtonLink href={link("/app")}>Open Caretook</ButtonLink>
      </EmailLayout>
    ),
  }),
});
