import { z } from "zod";
import { defineNotification } from "../define";
import { ButtonLink, EmailLayout, Muted, Paragraph } from "./layout";

// Caretook staff changed a care group's members from /admin (invited an
// owner, made a member an owner, changed a role or removed someone;
// account-security slice 3, B-331): to every owner of the group, queued in
// the change's transaction. It names the group (as its members see it), the
// member and the roles, never the staff member and no health details, and
// gives the support address to ask about it.

const ROLES = ["owner", "admin", "caretaker", "viewer", "easy_helper", "easy_viewer"] as const;
const roleZ = z.enum(ROLES);
const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  owner: "an owner",
  admin: "an admin",
  caretaker: "a caretaker",
  viewer: "a viewer",
  easy_helper: "an Easy helper",
  easy_viewer: "an Easy viewer",
};
const nameZ = z.string().trim().min(1).max(254);

const changeZ = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ownerInvited"), email: z.email().max(254) }),
  z.object({ kind: z.literal("madeOwner"), memberName: nameZ, from: roleZ }),
  z.object({ kind: z.literal("roleChanged"), memberName: nameZ, from: roleZ, to: roleZ }),
  z.object({ kind: z.literal("removed"), memberName: nameZ, from: roleZ }),
]);

/** One sentence saying what changed. */
const whatChanged = (change: z.output<typeof changeZ>, groupName: string) => {
  switch (change.kind) {
    case "ownerInvited":
      return `invited ${change.email} to be an owner of ${groupName}'s care group`;
    case "madeOwner":
      return `made ${change.memberName} an owner of ${groupName}'s care group (they were ${ROLE_LABELS[change.from]})`;
    case "roleChanged":
      return `changed ${change.memberName} from ${ROLE_LABELS[change.from]} to ${ROLE_LABELS[change.to]} in ${groupName}'s care group`;
    case "removed":
      return `removed ${change.memberName} (${ROLE_LABELS[change.from]}) from ${groupName}'s care group`;
  }
};

export const staffGroupChange = defineNotification({
  name: "staffGroupChange",
  data: z.object({
    groupId: z.uuid(),
    groupName: z.string().trim().min(1).max(200),
    change: changeZ,
    /** Where to ask about it (the team's support address). */
    supportEmail: z.email().max(254),
  }),
  email: (data, { link }) => ({
    subject: `Caretook staff changed the members of ${data.groupName}'s care group`,
    react: (
      <EmailLayout preview={`A change to ${data.groupName}'s care group members.`}>
        <Paragraph>Hi,</Paragraph>
        <Paragraph>The Caretook team {whatChanged(data.change, data.groupName)}.</Paragraph>
        <ButtonLink href={link(`/app/groups/${data.groupId}/settings/members`)}>See the members</ButtonLink>
        <Muted>
          Staff change a group's members only when a family asks. If you didn't expect this, write to{" "}
          {data.supportEmail} and we'll look into it.
        </Muted>
      </EmailLayout>
    ),
  }),
});
