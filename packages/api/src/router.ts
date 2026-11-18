import type { VitalReading } from "@caretook/data";

import { z } from "zod";
import {
  careGroupMemberService,
  careGroupService,
  careRecipientService,
  TIMELINE_ENTRY_KINDS,
  timelineEntryCreateZSchema,
  timelineEntryService,
  timelineEntryUpdateZSchema,
  isKnownReading,
  resolveTimelineView,
  resolveUnits,
  userPreferencesZSchema,
  userService,
} from "@caretook/data";
import { iso, toTimelineEntry } from "./dto";
import { ORPCError } from "@orpc/server";
import { unwrap } from "./errors";
import { authedProcedure } from "./procedures";
import { sync } from "./sync";

const id = z.uuid();
const ids = (values: string[]) => ({ type: "inArray" as const, value: values });

// ---------------------------------------------------------------------------
// me
// ---------------------------------------------------------------------------

const me = {
  /** The signed-in user and their role in each care group. */
  get: authedProcedure.handler(async ({ context }) => {
    const user = unwrap(await userService.getById(context, context.authUser.id));
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
    };
  }),

  /** Change your own settings. Fields left out keep their current value. */
  updatePreferences: authedProcedure.input(userPreferencesZSchema).handler(async ({ context, input }) => {
    const self = { id: { type: "eq" as const, value: context.authUser.id } };
    const user = unwrap(await userService.getById(context, context.authUser.id));
    if (!user) throw new ORPCError("UNAUTHORIZED");
    const preferences = {
      ...user.preferences,
      ...input,
      units: { ...user.preferences.units, ...input.units },
    };
    unwrap(await userService.update(context, { filter: self, data: { preferences } }));
    return { preferences, units: resolveUnits(preferences), timelineView: resolveTimelineView(preferences) };
  }),
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
};

// ---------------------------------------------------------------------------
// timeline
// ---------------------------------------------------------------------------

const timestamp = z.iso.datetime({ offset: true });

const timeline = {
  /** One group's entries, newest first. Pass `nextCursor` back as `cursor` for more. */
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
      const entry = unwrap(await timelineEntryService.update(context, input.id, input.data));
      if (!entry) throw new ORPCError("NOT_FOUND");
      return toTimelineEntry(entry);
    }),

  /** Soft delete. */
  remove: authedProcedure.input(z.object({ id })).handler(async ({ context, input }) => {
    unwrap(await timelineEntryService.remove(context, input.id));
    return { id: input.id };
  }),
};

export const router = { me, careGroup, timeline, sync };
export type Router = typeof router;
