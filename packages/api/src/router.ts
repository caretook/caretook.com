import type { VitalReading } from "@caretook/data";

import { z } from "zod";
import {
  careGroupInsertZSchema,
  careGroupMemberService,
  careGroupService,
  careRecipientProfileZSchema,
  careRecipientService,
  GROUP_ROLE_NAMES,
  isError,
  TIMELINE_ENTRY_KINDS,
  timelineEntryCreateZSchema,
  timelineEntryService,
  timelineEntryUpdateZSchema,
  isKnownReading,
  resolveSimpleModeSetting,
  resolveTimelineView,
  resolveUnits,
  simpleTilesZSchema,
  userPreferencesZSchema,
  userService,
} from "@caretook/data";
import { iso, toTimelineEntry } from "./dto";
import { ORPCError } from "@orpc/server";
import { unwrap } from "./errors";
import { authedProcedure } from "./procedures";
import { invite } from "./invites";
import { joinRequest } from "./joinRequests";
import { accessCode, admin, createCareGroup } from "./groups";
import { groupsAdmin } from "./groupsAdmin";
import { publicForms } from "./publicForms";
import { announcement } from "./announcement";
import { profileCareGroup, profileMe } from "./profiles";
import { search } from "./search";
import { sync } from "./sync";
import { waitlistAdmin } from "./waitlistAdmin";
import { auditAdmin } from "./auditAdmin";
import { usersAdmin } from "./usersAdmin";
import { settingsAdmin } from "./settingsAdmin";

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

// ---------------------------------------------------------------------------
// me
// ---------------------------------------------------------------------------

const me = {
  /** The signed-in user and their role in each care group. */
  get: authedProcedure.handler(async ({ context }) => {
    const user = unwrap(await userService.getWholeById(context, context.authUser.id));
    // The account was deleted after the session was issued.
    if (!user) throw new ORPCError("UNAUTHORIZED");
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      groupRoles: context.authUser.groupRoles ?? {},
      preferences: user.preferences,
      /** Display units with defaults filled in: what screens should use. */
      units: resolveUnits(user.preferences),
      timelineView: resolveTimelineView(user.preferences),
      simpleMode: resolveSimpleModeSetting(user.preferences),
    };
  }),

  /** Change your own settings. Fields left out keep their current value. */
  updatePreferences: authedProcedure.input(userPreferencesZSchema).handler(async ({ context, input }) => {
    const self = { id: { type: "eq" as const, value: context.authUser.id } };
    const user = unwrap(await userService.getWholeById(context, context.authUser.id));
    if (!user) throw new ORPCError("UNAUTHORIZED");
    const preferences = {
      ...user.preferences,
      ...input,
      units: { ...user.preferences.units, ...input.units },
    };
    unwrap(await userService.update(context, { filter: self, data: { preferences } }));
    return {
      preferences,
      units: resolveUnits(preferences),
      timelineView: resolveTimelineView(preferences),
      simpleMode: resolveSimpleModeSetting(preferences),
    };
  }),

  /** Your own contact details (profiles.ts). */
  ...profileMe,
};

// ---------------------------------------------------------------------------
// careGroup
// ---------------------------------------------------------------------------

const careGroup = {
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
   * Rename a group, or choose how simple mode picks its tiles (`simpleTiles`;
   * null: learned from use). Owners and admins; fields left out keep their
   * value. Other members get a 403, non-members a 404.
   */
  update: authedProcedure
    .input(
      careGroupInsertZSchema
        .pick({ name: true })
        .partial()
        .extend({ groupId: id, simpleTiles: simpleTilesZSchema.nullable().optional() }),
    )
    .handler(async ({ context, input }) => {
      const group = unwrap(await careGroupService.getById(context, input.groupId));
      if (!group) throw new ORPCError("NOT_FOUND");
      const data = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.simpleTiles !== undefined && { simpleTiles: input.simpleTiles }),
      };
      if (Object.keys(data).length === 0)
        return { id: group.id, name: group.name, simpleTiles: group.simpleTiles };
      const [saved = group] = updated(
        await careGroupService.update(context, { filter: { id: eq(group.id) }, data }),
      );
      return { id: saved.id, name: saved.name, simpleTiles: saved.simpleTiles };
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
   * Simple mode for a member: the default the managers choose for them
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

// ---------------------------------------------------------------------------
// timeline
// ---------------------------------------------------------------------------

const timestamp = z.iso.datetime({ offset: true });

const timeline = {
  /**
   * One group's entries, newest first. Pass `nextCursor` back as `cursor` for more.
   * A note's or event's `body` is its live document's compacted text (null until
   * the document arrives); deleted entries never carry their document's text.
   */
  list: authedProcedure
    .input(
      z.object({
        groupId: id,
        kinds: z.array(z.enum(TIMELINE_ENTRY_KINDS)).optional(),
        from: timestamp.optional(),
        to: timestamp.optional(),
        cursor: z.string().max(512).nullish(),
        limit: z.int().min(1).max(100).optional(),
        includeDeleted: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const page = unwrap(await timelineEntryService.list(context, input));
      return { data: page.data.map(toTimelineEntry), nextCursor: page.nextCursor };
    }),

  /**
   * The newest reading of each vital type in the group, for the "latest
   * vitals" strip. Readings of types this server doesn't know are skipped.
   */
  latestVitals: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    const rows = unwrap(await timelineEntryService.latestVitals(context, input));
    return rows
      .filter((row) => isKnownReading(row.reading))
      .map((row) => ({
        entryId: row.entryId,
        occurredAt: iso(row.occurredAt),
        reading: row.reading as VitalReading,
      }));
  }),

  create: authedProcedure.input(timelineEntryCreateZSchema).handler(async ({ context, input }) => {
    const entry = unwrap(await timelineEntryService.create(context, input));
    // Created but not readable back: a permissions bug, not a client error.
    if (!entry) throw new ORPCError("INTERNAL_SERVER_ERROR");
    return toTimelineEntry(entry);
  }),

  update: authedProcedure
    .input(z.object({ id, data: timelineEntryUpdateZSchema }))
    .handler(async ({ context, input }) => {
      const updated = unwrap(await timelineEntryService.update(context, input.id, input.data));
      if (!updated) throw new ORPCError("NOT_FOUND");
      // A note's or event's body comes from its document, as in `list`.
      const [entry = updated] = unwrap(await timelineEntryService.withDocumentText(context, [updated]));
      return toTimelineEntry(entry);
    }),

  /** Soft delete. */
  remove: authedProcedure.input(z.object({ id })).handler(async ({ context, input }) => {
    unwrap(await timelineEntryService.remove(context, input.id));
    return { id: input.id };
  }),
};

export const router = {
  me,
  careGroup,
  timeline,
  sync,
  invite,
  joinRequest,
  accessCode,
  admin: {
    ...admin,
    waitlist: waitlistAdmin,
    audit: auditAdmin,
    users: usersAdmin,
    groups: groupsAdmin,
    settings: settingsAdmin,
  },
  public: { ...publicForms, announcement },
  search,
};
export type Router = typeof router;
