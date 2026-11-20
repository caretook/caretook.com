import type { AuthUser, JoinMailer } from "@caretook/data";

import {
  careGroupMemberService,
  GROUP_MANAGER_ROLES,
  careGroupInviteService,
  isError,
  joinRequestService,
  SYSTEM_USER,
  userService,
} from "@caretook/data";
import { deliverSoon, notify } from "@caretook/notifications";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { iso } from "../dto";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";

// `joinRequest.*` (invites slice 4): requests to join made through an invite
// link. A group's owners and admins list them (with the requester's name and
// address, so they know who's asking) and approve or decline them; the
// requester lists their own and may withdraw one. Requests don't sync, so
// these reads are the only way to see them. Every answer emails the
// requester, queued in its transaction and delivered after commit.

const id = z.uuid();

/** Declined requests stay on the requester's home this long. */
const DECLINED_SHOWN_DAYS = 14;

/** Queues a join step's emails (one per recipient) in the service's transaction. */
export const joinMailer = (): JoinMailer => async (notice, tx) => {
  const ids: string[] = [];
  for (const to of notice.to) {
    const key = `${notice.kind}:${notice.request.id}:${to.userId}`;
    const queued =
      notice.kind === "joinRequested"
        ? await notify("joinRequested", {
            to: to.email,
            actor: { id: notice.request.userId },
            data: {
              groupId: notice.request.groupId,
              groupName: notice.groupName,
              ...(notice.requester.name ? { requesterName: notice.requester.name } : {}),
              requesterEmail: notice.requester.email,
              role: notice.request.role,
            },
            idempotencyKey: key,
            tx,
          })
        : notice.kind === "joinApproved"
          ? await notify("joinApproved", {
              to: to.email,
              data: {
                groupId: notice.request.groupId,
                groupName: notice.groupName,
                role: notice.request.role,
              },
              idempotencyKey: key,
              tx,
            })
          : await notify("joinDeclined", {
              to: to.email,
              data: { groupName: notice.groupName },
              idempotencyKey: key,
              tx,
            });
    if (isError(queued)) return queued;
    ids.push(queued.id);
  }
  return ids;
};

/** 404 for non-members, 403 for members who don't manage the group. */
const requireManager = async (context: { authUser: AuthUser }, groupId: string) => {
  const membership = unwrap(
    await careGroupMemberService.get(context, {
      filter: {
        groupId: { type: "eq", value: groupId },
        userId: { type: "eq", value: context.authUser.id },
      },
    }),
  );
  if (!membership) throw new ORPCError("NOT_FOUND");
  if (!GROUP_MANAGER_ROLES.some((role) => role === membership.role)) throw new ORPCError("FORBIDDEN");
};

/**
 * Requesters' names and addresses. Read as the system: a requester isn't a
 * co-member yet, so the group's managers couldn't read their row otherwise.
 * Only for managers of the group they asked to join.
 */
const requestersOf = async (userIds: string[]) => {
  if (!userIds.length) return new Map<string, { name: string | null; email: string }>();
  const users = unwrap(
    await userService.listWhole(
      { authUser: SYSTEM_USER },
      { filter: { id: { type: "inArray", value: userIds } }, paginate: { page: 1, limit: 100 } },
    ),
  ).data;
  return new Map(users.map((u) => [u.id, { name: u.name?.trim() || null, email: u.email }]));
};

type RequestRow = {
  id: string;
  groupId: string;
  userId: string;
  role: "caretaker" | "viewer";
  status: string;
  createdAt: string;
  decidedAt: string | null;
};

const decided = <T extends { request: RequestRow; queued: string[] }>(result: T) => {
  if (result.queued.length) deliverSoon(result.queued);
  return { id: result.request.id, status: result.request.status };
};

export const joinRequest = {
  /** A group's waiting requests, oldest first, with who's asking. Owners and admins. */
  list: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    await requireManager(context, input.groupId);
    const rows = unwrap(
      await joinRequestService.list(context, {
        filter: {
          groupId: { type: "eq", value: input.groupId },
          status: { type: "eq", value: "pending" },
        },
        paginate: { page: 1, limit: 100 },
      }),
    ).data.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const people = await requestersOf(rows.map((r) => r.userId));
    return rows.map((r) => ({
      id: r.id,
      groupId: r.groupId,
      role: r.role,
      createdAt: iso(r.createdAt),
      name: people.get(r.userId)?.name ?? null,
      email: people.get(r.userId)?.email ?? null,
    }));
  }),

  /**
   * The signed-in user's own requests: waiting ones, and those declined in
   * the last 14 days, with each group's display name (what the link showed).
   */
  mine: authedProcedure.handler(async ({ context }) => {
    const rows = unwrap(
      await joinRequestService.list(context, {
        filter: {
          userId: { type: "eq", value: context.authUser.id },
          status: { type: "inArray", value: ["pending", "declined"] },
        },
        paginate: { page: 1, limit: 100 },
      }),
    ).data;
    const since = Date.now() - DECLINED_SHOWN_DAYS * 24 * 60 * 60 * 1000;
    const shown = rows
      .filter((r) => r.status === "pending" || new Date(r.decidedAt ?? r.updatedAt).getTime() >= since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.all(
      shown.map(async (r) => ({
        id: r.id,
        groupId: r.groupId,
        role: r.role,
        status: r.status as "pending" | "declined",
        createdAt: iso(r.createdAt),
        groupName: unwrap(await careGroupInviteService.groupDisplayName(r.groupId)),
      })),
    );
  }),

  /** Let them in, with the request's role (owners and admins). They're emailed. */
  approve: authedProcedure
    .input(z.object({ id }))
    .handler(async ({ context, input }) =>
      decided(unwrap(await joinRequestService.approve(context, input.id, { mail: joinMailer() }))),
    ),

  /** Say no (owners and admins). They're emailed. */
  decline: authedProcedure
    .input(z.object({ id }))
    .handler(async ({ context, input }) =>
      decided(unwrap(await joinRequestService.decline(context, input.id, { mail: joinMailer() }))),
    ),

  /** Take back your own waiting request. */
  withdraw: authedProcedure.input(z.object({ id })).handler(async ({ context, input }) => {
    const withdrawn = unwrap(await joinRequestService.withdraw(context, input.id));
    return { id: withdrawn.id, status: withdrawn.status };
  }),
};
