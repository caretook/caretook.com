import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
  careGroupInsertZSchema,
  careGroupMemberService,
  careGroupService,
  careRecipientProfileZSchema,
  careRecipientService,
  GROUP_ROLE_NAMES,
  isError,
  easyTilesZSchema,
  userService,
} from "@caretook/data";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";
import { profileCareGroup } from "../profiles/profiles";
import { createCareGroup } from "./groups";

const id = z.uuid();
const ids = (values: string[]) => ({ type: "inArray" as const, value: values });
const eq = (value: string) => ({ type: "eq" as const, value });

/**
 * The result of an update to a row the actor can already read. The models
 * enforce the role in SQL, so a member whose role doesn't allow the change
 * updates nothing: that's a 403 (a non-member got a 404 from the read).
 */
const updated = <T>(result: T) => {
  if (isError(result) && result.code === "baseModel:update:nothingUpdated") throw new ORPCError("FORBIDDEN");
  return unwrap(result);
};

/** As `updated`, for a removal: a member whose role doesn't allow it removes nothing. */
const removed = <T>(result: T) => {
  if (isError(result) && result.code === "baseModel:remove:nothingRemoved") throw new ORPCError("FORBIDDEN");
  return unwrap(result);
};

/** A care recipient's profile: what every member sees (and writers edit). */
const toRecipientProfile = (recipient: {
  id: string;
  groupId: string;
  name: string;
  preferredName: string | null;
  dateOfBirth: string | null;
  timeZone: string;
  codeStatus: string | null;
  bloodType: string | null;
  primaryLanguage: string | null;
  pronouns: string | null;
  notes: string | null;
}) => ({
  id: recipient.id,
  groupId: recipient.groupId,
  name: recipient.name,
  preferredName: recipient.preferredName,
  dateOfBirth: recipient.dateOfBirth,
  timeZone: recipient.timeZone,
  codeStatus: recipient.codeStatus,
  bloodType: recipient.bloodType,
  primaryLanguage: recipient.primaryLanguage,
  pronouns: recipient.pronouns,
  notes: recipient.notes,
});

export const careGroup = {
  /** The groups the user belongs to, with their role and the recipient's name. */
  listMine: authedProcedure.handler(async ({ context }) => {
    const groups = unwrap(await careGroupService.list(context, { paginate: { page: 1, limit: 100 } }));
    const groupIds = groups.data.map((g) => g.id);
    const recipients = groupIds.length
      ? unwrap(await careRecipientService.list(context, { filter: { groupId: ids(groupIds) } })).data
      : [];

    return groups.data.map((group) => {
      const recipient = recipients.find((r) => r.groupId === group.id);
      return {
        id: group.id,
        name: group.name,
        role: context.authUser.groupRoles?.[group.id] ?? null,
        recipient: recipient ? { id: recipient.id, displayName: recipient.displayName } : null,
      };
    });
  }),

  /**
   * A group's members as public profiles: name, image and role, never email
   * or account fields. What the timeline needs to show who wrote an entry.
   */
  members: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    const members = unwrap(
      await careGroupMemberService.list(context, {
        filter: { groupId: { type: "eq", value: input.groupId } },
        paginate: { page: 1, limit: 100 },
      }),
    ).data;
    const userIds = members.map((m) => m.userId);
    const users = userIds.length
      ? unwrap(
          await userService.list(context, {
            filter: { id: ids(userIds) },
            paginate: { page: 1, limit: 100 },
          }),
        ).data
      : [];

    return members.map((m) => {
      const user = users.find((u) => u.id === m.userId);
      return { userId: m.userId, role: m.role, name: user?.name ?? null, image: user?.image ?? null };
    });
  }),

  /**
   * Rename a group, or choose how easy mode picks its tiles (`easyTiles`;
   * null: learned from use). Owners and admins; fields left out keep their
   * value. Other members get a 403, non-members a 404. The Assistants switch
   * (`connectorsEnabled`, connectors) is owners' only (an admin gets a 403);
   * turning it off disconnects every member's assistant, and turning it on
   * reconnects none.
   */
  update: authedProcedure
    .input(
      careGroupInsertZSchema.pick({ name: true }).partial().extend({
        groupId: id,
        easyTiles: easyTilesZSchema.nullable().optional(),
        connectorsEnabled: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const group = unwrap(await careGroupService.getById(context, input.groupId));
      if (!group) throw new ORPCError("NOT_FOUND");
      const data = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.easyTiles !== undefined && { easyTiles: input.easyTiles }),
        ...(input.connectorsEnabled !== undefined && { connectorsEnabled: input.connectorsEnabled }),
      };
      if (Object.keys(data).length === 0)
        return { id: group.id, name: group.name, easyTiles: group.easyTiles };
      const [saved = group] = updated(
        await careGroupService.update(context, { filter: { id: eq(group.id) }, data }),
      );
      return { id: saved.id, name: saved.name, easyTiles: saved.easyTiles };
    }),

  /**
   * The group's care recipient: name, preferred name, date of birth, time
   * zone, the medical basics and the note for helpers. Members only; null
   * when the group has none.
   */
  recipient: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    const group = unwrap(await careGroupService.getById(context, input.groupId));
    if (!group) throw new ORPCError("NOT_FOUND");
    const recipient = unwrap(await careRecipientService.get(context, { filter: { groupId: eq(group.id) } }));
    return recipient ? toRecipientProfile(recipient) : null;
  }),

  /**
   * Edit the recipient's profile: name, preferred name, birthday, time zone,
   * the medical basics and the note for helpers (owners, admins and
   * caretakers). Fields left out keep their value; empty text clears it. An
   * unknown zone is a 400 naming `timeZone`.
   */
  updateRecipient: authedProcedure
    .input(careRecipientProfileZSchema.extend({ groupId: id }))
    .handler(async ({ context, input }) => {
      const { groupId, ...profile } = input;
      return toRecipientProfile(unwrap(await careRecipientService.updateProfile(context, groupId, profile)));
    }),

  /**
   * Change a member's group role (owners and admins; only owners make or
   * change owners, and the last owner keeps the role: a 409). Other members
   * get a 403, non-members and unknown members a 404. Returns the member as
   * a public profile, like `members`.
   */
  changeRole: authedProcedure
    .input(z.object({ groupId: id, userId: id, role: z.enum(GROUP_ROLE_NAMES) }))
    .handler(async ({ context, input }) => {
      const membership = unwrap(
        await careGroupMemberService.get(context, {
          filter: { groupId: eq(input.groupId), userId: eq(input.userId) },
        }),
      );
      if (!membership) throw new ORPCError("NOT_FOUND");
      const saved = updated(
        await careGroupMemberService.updateRole(context, { id: membership.id, role: input.role }),
      );
      const user = unwrap(await userService.getById(context, saved.userId));
      return { userId: saved.userId, role: saved.role, name: user?.name ?? null, image: user?.image ?? null };
    }),

  /**
   * Easy mode for a member: the default the managers choose for them
   * (`simpleMode`) and the lock (`locked`; locking turns the default on, and
   * turning the default off unlocks). Owners and admins; only owners change
   * an owner's (403), and nobody locks or unlocks themselves (403). Other
   * members get a 403, non-members and unknown members a 404. Fields left out
   * keep their value. Reaches the member's devices by sync.
   */
  setMemberMode: authedProcedure
    .input(
      z.object({
        groupId: id,
        userId: id,
        simpleMode: z.boolean().optional(),
        locked: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const membership = unwrap(
        await careGroupMemberService.get(context, {
          filter: { groupId: eq(input.groupId), userId: eq(input.userId) },
        }),
      );
      if (!membership) throw new ORPCError("NOT_FOUND");
      const saved = updated(
        await careGroupMemberService.setMode(context, {
          id: membership.id,
          simpleMode: input.simpleMode,
          locked: input.locked,
        }),
      );
      return { userId: saved.userId, simpleMode: saved.simpleMode, locked: saved.simpleModeLocked };
    }),

  /**
   * Remove a member (owners and admins; only owners remove owners). Removing
   * yourself is leaving, which any member may do, except the last owner (a
   * 409). Other members get a 403, non-members and unknown members a 404.
   */
  removeMember: authedProcedure
    .input(z.object({ groupId: id, userId: id }))
    .handler(async ({ context, input }) => {
      const membership = unwrap(
        await careGroupMemberService.get(context, {
          filter: { groupId: eq(input.groupId), userId: eq(input.userId) },
        }),
      );
      if (!membership) throw new ORPCError("NOT_FOUND");
      removed(await careGroupMemberService.remove(context, membership.id));
      return { groupId: input.groupId, userId: input.userId };
    }),

  /** Start a care group with its recipient; the creator is its owner (groups.ts). */
  create: createCareGroup,

  /** Profiles: the recipient's details, the emergency list, and sharing (profiles.ts). */
  ...profileCareGroup,
};
