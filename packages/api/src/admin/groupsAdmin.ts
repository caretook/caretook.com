import type { InviteMailer } from "@caretook/data";

import { createHash } from "node:crypto";
import { groupAdminService, inviteEmailZ, staffReasonZSchema } from "@caretook/data";
import { deliverSoon, notify } from "@caretook/notifications";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { iso } from "../dto";
import { unwrap } from "../errors";
import { staffProcedure } from "../procedures";
import { GROUP_ADMIN_PAGE_SIZE, STAFF_SETTABLE_GROUP_ROLES } from "@caretook/data/domain";

// `admin.groups.*` (admin slice 4): care groups for Caretook staff. Every
// staff member (`groups.read`) searches groups and opens one: its name, its
// recipient's name, members (name, email, role, who invited them, when they
// joined), counts and dates. Never care data: nothing here selects an
// entry's, document's, provider's or medication's content, or the
// recipient's profile beyond their names. Admins (`groups.manage`) recover
// an owner, change a role and remove a member, always with a reason.

const id = z.uuid();
const reason = staffReasonZSchema;

const hashed = (value: string) => createHash("sha256").update(value).digest("base64url");

/** Queues `ownerInvite` in the service's transaction (the same email a staff-made group's owner gets). */
const ownerInviteMailer =
  (actorId: string): InviteMailer =>
  ({ invite, token, groupName }, tx) => {
    if (!invite.email) throw new Error("An email invite without an email");
    return notify("ownerInvite", {
      to: invite.email,
      actor: { id: actorId },
      data: { groupName, token },
      idempotencyKey: `ownerInvite:${invite.id}:${hashed(token)}`,
      tx,
    });
  };

type Person = { id: string; name: string | null; email: string };

export const groupsAdmin = {
  /** One page of groups (newest first) by part of the group's or recipient's name, optionally only those with no owner. */
  search: staffProcedure("groups.read")
    .input(
      z.object({
        q: z.string().trim().max(120).optional(),
        noOwner: z.boolean().optional(),
        page: z.number().int().min(1).max(100_000).default(1),
      }),
    )
    .handler(async ({ context, input: { page, ...filter } }) => {
      const res = unwrap(await groupAdminService.search(context, filter, { page }));
      return {
        count: res.count,
        page,
        pageSize: GROUP_ADMIN_PAGE_SIZE,
        groups: res.data.map((g) => ({
          id: g.id,
          name: g.name,
          recipientName: g.recipientName,
          recipientPreferredName: g.recipientPreferredName,
          memberCount: g.memberCount,
          owners: g.owners.map((o): Person => ({ id: o.id, name: o.name, email: o.email })),
          createdAt: iso(g.createdAt),
        })),
      };
    }),

  /** One group for staff: names, members, counts and dates. A 404 when there's no such group. */
  get: staffProcedure("groups.read")
    .input(z.object({ id }))
    .handler(async ({ context, input }) => {
      const group = unwrap(await groupAdminService.get(context, input.id));
      if (!group) throw new ORPCError("NOT_FOUND");
      return {
        id: group.id,
        name: group.name,
        recipientName: group.recipientName,
        recipientPreferredName: group.recipientPreferredName,
        createdAt: iso(group.createdAt),
        lastActivityAt: group.lastActivityAt ? iso(group.lastActivityAt) : null,
        counts: {
          entries: group.counts.entries,
          providers: group.counts.providers,
          medications: group.counts.medications,
        },
        members: group.members.map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          joinedAt: iso(m.joinedAt),
          invitedBy: m.inviterId
            ? ({ id: m.inviterId, name: m.inviterName, email: m.inviterEmail ?? "" } satisfies Person)
            : null,
        })),
      };
    }),

  /** Make a member an owner (owner recovery). */
  promoteOwner: staffProcedure("groups.manage")
    .input(z.object({ groupId: id, userId: id, reason }))
    .handler(async ({ context, input }) => unwrap(await groupAdminService.promoteOwner(context, input))),

  /** Send an owner invite to an address (the `ownerInvite` email). */
  inviteOwner: staffProcedure("groups.manage")
    .input(z.object({ groupId: id, email: inviteEmailZ, reason }))
    .handler(async ({ context, input }) => {
      const sent = unwrap(
        await groupAdminService.inviteOwner(context, input, { mail: ownerInviteMailer(context.authUser.id) }),
      );
      if (sent.queued) deliverSoon(sent.queued);
      return { inviteId: sent.inviteId, email: sent.email };
    }),

  /** Change a member's role to admin, caretaker or viewer. A group always keeps an owner (a 409). */
  changeRole: staffProcedure("groups.manage")
    .input(z.object({ groupId: id, userId: id, role: z.enum(STAFF_SETTABLE_GROUP_ROLES), reason }))
    .handler(async ({ context, input }) => unwrap(await groupAdminService.changeRole(context, input))),

  /** Remove a member. Removing the last owner is refused (a 409). */
  removeMember: staffProcedure("groups.manage")
    .input(z.object({ groupId: id, userId: id, reason }))
    .handler(async ({ context, input }) => unwrap(await groupAdminService.removeMember(context, input))),
};
