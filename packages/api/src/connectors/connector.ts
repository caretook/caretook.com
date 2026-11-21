import type { AssistantRequestMailer, AssistantRequestView, ConnectorGrantView } from "@caretook/data";

import {
  assistantRequestService,
  careGroupService,
  careRecipientService,
  connectorGrantService,
  isError,
  userService,
} from "@caretook/data";
import { deliverSoon, notify } from "@caretook/notifications";
import { z } from "zod";
import { iso } from "../dto";
import { unwrap } from "../errors";
import { authedProcedure } from "../procedures";

// Managing members' connected assistants (connectors slice 5): a member's
// own connections (Settings → Devices), every member's connections to a
// group for its owners and admins (group settings → Assistants), and
// disconnecting one. The switch itself is `careGroup.update`'s
// `connectorsEnabled` (owners only). Nothing here returns a token. While the
// switch is off, a member who isn't an owner asks the owners to turn it on
// (connectors-2): an email to each, at most once a week.

const id = z.uuid();
const inArray = (value: string[]) => ({ type: "inArray" as const, value });

/** A grant as the screens show it: no tokens, no OAuth client id, ISO times. */
const toConnection = (grant: ConnectorGrantView) => ({
  id: grant.id,
  userId: grant.userId,
  groupId: grant.groupId,
  clientName: grant.clientName,
  redirectHost: grant.redirectHost,
  scope: grant.scope,
  consentedAt: iso(grant.consentedAt),
  lastUsedAt: grant.lastUsedAt ? iso(grant.lastUsedAt) : null,
});

export type Connection = ReturnType<typeof toConnection>;

type Ctx = Parameters<typeof careGroupService.list>[0];

/** What each group is called on screen: the recipient's display name, else the group's name. */
const groupNames = async (ctx: Ctx, groupIds: string[]) => {
  if (!groupIds.length) return new Map<string, string>();
  const groups = unwrap(
    await careGroupService.list(ctx, {
      filter: { id: inArray(groupIds) },
      paginate: { page: 1, limit: 100 },
    }),
  ).data;
  const recipients = unwrap(
    await careRecipientService.list(ctx, {
      filter: { groupId: inArray(groupIds) },
      paginate: { page: 1, limit: 100 },
    }),
  ).data;
  return new Map(
    groups.map((g) => [g.id, recipients.find((r) => r.groupId === g.id)?.displayName || g.name]),
  );
};

/** Members' public names (co-members only), by user id. */
const memberNames = async (ctx: Ctx, userIds: string[]) => {
  if (!userIds.length) return new Map<string, string | null>();
  const users = unwrap(
    await userService.list(ctx, { filter: { id: inArray(userIds) }, paginate: { page: 1, limit: 100 } }),
  ).data;
  return new Map(users.map((u) => [u.id, u.name ?? null]));
};

const unique = (values: string[]) => [...new Set(values)];

/** Queues the owners' emails (one per owner) in the service's transaction. */
export const assistantRequestMailer = (): AssistantRequestMailer => async (notice, tx) => {
  const ids: string[] = [];
  for (const to of notice.to) {
    const queued = await notify("assistantsRequested", {
      to: to.email,
      actor: { id: notice.request.userId },
      data: { groupId: notice.request.groupId, groupName: notice.groupName, memberName: notice.memberName },
      idempotencyKey: `assistantsRequested:${notice.request.id}:${to.userId}`,
      tx,
    });
    if (isError(queued)) return queued;
    ids.push(queued.id);
  }
  return ids;
};

/** A request as the screens show it: when it was made. */
const toRequest = (request: AssistantRequestView) => ({
  id: request.id,
  groupId: request.groupId,
  requestedAt: iso(request.requestedAt),
});

export type AssistantRequest = ReturnType<typeof toRequest>;

export const connector = {
  /** The caller's live connections, every group, newest first, with each group's name. */
  listMine: authedProcedure.handler(async ({ context }) => {
    const grants = unwrap(await connectorGrantService.listMine(context));
    const names = await groupNames(context, unique(grants.map((g) => g.groupId)));
    return grants.map((g) => ({ ...toConnection(g), groupName: names.get(g.groupId) ?? null }));
  }),

  /**
   * Every member's live connections to the group, newest first, with the
   * member's name: owners and admins only (other members get a 403,
   * non-members a 404).
   */
  listForGroup: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    const grants = unwrap(await connectorGrantService.listForGroup(context, input.groupId));
    const names = await memberNames(context, unique(grants.map((g) => g.userId)));
    return grants.map((g) => ({ ...toConnection(g), memberName: names.get(g.userId) ?? null }));
  }),

  /**
   * Disconnect one: the caller's own, or any in a group they own or
   * administer. Its tokens stop working at once. Someone else's connection
   * the caller can't see is a 404.
   */
  revoke: authedProcedure.input(z.object({ grantId: id })).handler(async ({ context, input }) => {
    return toConnection(unwrap(await connectorGrantService.revoke(context, input.grantId)));
  }),

  /**
   * Ask the group's owners to turn assistants on: any member but an owner,
   * while the switch is off. Emails every owner; asking again within a week
   * returns the last request and sends nothing (`created: false`).
   */
  requestEnable: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    const result = unwrap(
      await assistantRequestService.request(context, input.groupId, assistantRequestMailer()),
    );
    if (result.queued.length) deliverSoon(result.queued);
    return { ...toRequest(result.request), created: result.created };
  }),

  /** The caller's last request to the group (any age), or null. Non-members get a 404. */
  myRequest: authedProcedure.input(z.object({ groupId: id })).handler(async ({ context, input }) => {
    const last = unwrap(await assistantRequestService.latest(context, input.groupId));
    return last ? toRequest(last) : null;
  }),
};
