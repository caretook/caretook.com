import type { ToolContext } from "../registry";

import {
  careGroupMemberService,
  careGroupService,
  careRecipientService,
  FALLBACK_TIME_ZONE,
  isError,
  newError,
  userService,
} from "@caretook/data";

// What several tools read: the group, its recipient and the members' public
// names. Every read is in the actor's scope and the grant's group.

export const eq = (value: string) => ({ type: "eq" as const, value });

/** The service context for a call: the member only (the rest of ToolContext isn't the services'). */
export const asMember = (ctx: ToolContext) => ({ authUser: ctx.authUser });

/** The group and its care recipient (the recipient's zone is every answer's zone). */
export const loadGroup = async (ctx: ToolContext) => {
  const group = await careGroupService.getById(asMember(ctx), ctx.groupId);
  if (isError(group)) return group;
  if (!group) return newError({ code: "careGroupService:notFound" });
  const recipients = await careRecipientService.list(asMember(ctx), { filter: { groupId: eq(ctx.groupId) } });
  if (isError(recipients)) return recipients;
  const recipient = recipients.data[0] ?? null;
  return { group, recipient, timeZone: recipient?.timeZone ?? FALLBACK_TIME_ZONE };
};

/** The group's members: name and role only (never an email or a phone). */
export const loadMembers = async (ctx: ToolContext) => {
  const members = await careGroupMemberService.list(asMember(ctx), {
    filter: { groupId: eq(ctx.groupId) },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(members)) return members;
  const userIds = members.data.map((m) => m.userId);
  const users = userIds.length
    ? await userService.list(asMember(ctx), {
        filter: { id: { type: "inArray", value: userIds } },
        paginate: { page: 1, limit: 100 },
      })
    : { data: [] };
  if (isError(users)) return users;
  return members.data.map((m) => ({
    id: m.userId,
    name: users.data.find((u) => u.id === m.userId)?.name ?? null,
    role: m.role,
  }));
};
