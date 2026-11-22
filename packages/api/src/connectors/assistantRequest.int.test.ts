import type { AuthUser } from "@caretook/data";

import {
  assistantRequestModel,
  careGroupMemberService,
  careGroupService,
  getDb,
  isError,
  timelineEntryService,
} from "@caretook/data";
import { setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { clientFor, codesOf } from "../testing";

// Asking the owners to turn assistants on (connectors-2, B-194), through the
// router with the memory sender: who may ask, the switch, the 7-day window,
// one email per owner with no health details, and the outbox key. All data
// is fictional.

const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));

const settle = async () => {
  while (pending.length) await Promise.allSettled(pending.splice(0));
};

/** The `assistantsRequested` emails each address got. */
const askedMail = async (to: string) => {
  await settle();
  return sharedMemorySender().sent.filter((m) => m.to === to && m.name === "assistantsRequested");
};

const queuedFor = (groupId: string) =>
  getDb().query.notificationOutboxSchema.findMany({
    where: (t, { and, eq: equals, like }) =>
      and(
        equals(t.name, "assistantsRequested"),
        like(t.text, `%/app/groups/${groupId}/settings/assistants%`),
      ),
  });

const SENTINEL = "SENTINEL-HEALTH-7710";

/** A group with assistants off: two owners, an admin, a caretaker and a viewer, plus an outsider. */
const world = async () => {
  const owner = await createUser("ar-owner");
  const owner2 = await createUser("ar-owner2");
  const admin = await createUser("ar-admin");
  const caretaker = await createUser("ar-caretaker");
  const viewer = await createUser("ar-viewer");
  const outsider = await createUser("ar-outsider");
  const { group } = await createGroup(owner, [
    { user: owner2.user, role: "owner" },
    { user: admin.user, role: "admin" },
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  // Health details in the group, which no email may carry.
  ok(
    await timelineEntryService.create(caretaker.ctx, {
      groupId: group.id,
      kind: "note",
      title: SENTINEL,
      occurredAt: "2026-11-17T12:00:00.000Z",
      timeZone: "America/Los_Angeles",
    }),
  );
  const api = {
    owner: clientFor(owner.ctx.authUser),
    owner2: clientFor(owner2.ctx.authUser),
    admin: clientFor(admin.ctx.authUser),
    caretaker: clientFor(caretaker.ctx.authUser),
    viewer: clientFor(viewer.ctx.authUser),
    outsider: clientFor(outsider.ctx.authUser),
  };
  return { groupId: group.id, owner, owner2, admin, caretaker, viewer, outsider, api };
};

/** Move every request of the group `days` into the past. */
const age = (groupId: string, days: number) =>
  getDb().execute(
    `UPDATE assistant_request SET requested_at = requested_at - make_interval(days => ${Number(days)}) WHERE group_id = '${groupId}'`,
  );

describe("asking the owners to turn assistants on", () => {
  it.each(["caretaker", "viewer"] as const)("a %s's request emails every owner once", async (who) => {
    const w = await world();
    const before = Date.now();
    const asked = await w.api[who].connector.requestEnable({ groupId: w.groupId });
    expect(asked).toMatchObject({ groupId: w.groupId, created: true });
    expect(new Date(asked.requestedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);

    for (const to of [w.owner, w.owner2]) {
      const mail = await askedMail(to.user.email);
      expect(mail).toHaveLength(1);
      expect(mail[0]!.subject).toBe(`ar-${who} asked to turn on assistants for Pat Example's care group`);
      expect(mail[0]!.text).toContain(`/app/groups/${w.groupId}/settings/assistants`);
    }
    // Admins and the asker get nothing: only owners can flip the switch.
    expect(await askedMail(w.admin.user.email)).toEqual([]);
    expect(await askedMail(w[who].user.email)).toEqual([]);

    // One outbox row per owner, keyed by the request.
    const rows = await queuedFor(w.groupId);
    expect(rows.map((r) => r.idempotencyKey).sort()).toEqual(
      [w.owner, w.owner2].map((o) => `assistantsRequested:${asked.id}:${o.user.id}`).sort(),
    );
    // No health details anywhere in it.
    for (const row of rows) expect(`${row.subject}${row.html}${row.text}`).not.toContain(SENTINEL);

    expect(await w.api[who].connector.myRequest({ groupId: w.groupId })).toEqual({
      id: asked.id,
      groupId: w.groupId,
      requestedAt: asked.requestedAt,
    });
  });

  it("an admin may ask too", async () => {
    const w = await world();
    expect(await w.api.admin.connector.requestEnable({ groupId: w.groupId })).toMatchObject({
      created: true,
    });
    expect(await askedMail(w.owner.user.email)).toHaveLength(1);
  });

  it("refuses an owner, who can flip the switch", async () => {
    const w = await world();
    expect(await codesOf(w.api.owner.connector.requestEnable({ groupId: w.groupId }))).toBe(
      "FORBIDDEN:assistantRequestService:owner",
    );
    expect(await queuedFor(w.groupId)).toEqual([]);
  });

  it("refuses while the switch is on", async () => {
    const w = await world();
    ok(
      await careGroupService.update(w.owner.ctx, {
        filter: { id: { type: "eq", value: w.groupId } },
        data: { connectorsEnabled: true },
      }),
    );
    expect(await codesOf(w.api.caretaker.connector.requestEnable({ groupId: w.groupId }))).toBe(
      "CONFLICT:assistantRequestService:alreadyOn",
    );
    expect(await queuedFor(w.groupId)).toEqual([]);
  });

  it("within 7 days returns the first request and sends nothing; after 7 days a new one sends", async () => {
    const w = await world();
    const first = await w.api.caretaker.connector.requestEnable({ groupId: w.groupId });
    expect(await askedMail(w.owner.user.email)).toHaveLength(1);

    await age(w.groupId, 6);
    const again = await w.api.caretaker.connector.requestEnable({ groupId: w.groupId });
    expect(again).toMatchObject({ id: first.id, created: false });
    expect(await askedMail(w.owner.user.email)).toHaveLength(1);
    expect(await queuedFor(w.groupId)).toHaveLength(2);

    // Another member has their own window.
    expect(await w.api.viewer.connector.requestEnable({ groupId: w.groupId })).toMatchObject({
      created: true,
    });
    expect(await askedMail(w.owner.user.email)).toHaveLength(2);

    await age(w.groupId, 2);
    const later = await w.api.caretaker.connector.requestEnable({ groupId: w.groupId });
    expect(later.created).toBe(true);
    expect(later.id).not.toBe(first.id);
    expect(await askedMail(w.owner.user.email)).toHaveLength(3);
    expect((await w.api.caretaker.connector.myRequest({ groupId: w.groupId }))?.id).toBe(later.id);
  });

  it("gives a non-member notFound, and myRequest null before any request", async () => {
    const w = await world();
    expect(await codesOf(w.api.outsider.connector.requestEnable({ groupId: w.groupId }))).toBe(
      "NOT_FOUND:assistantRequestService:notMember",
    );
    expect(await codesOf(w.api.outsider.connector.myRequest({ groupId: w.groupId }))).toBe(
      "NOT_FOUND:assistantRequestService:notMember",
    );
    expect(await w.api.caretaker.connector.myRequest({ groupId: w.groupId })).toBeNull();
    expect(await queuedFor(w.groupId)).toEqual([]);
  });

  it("shows a request to the member and the group's owners and admins only", async () => {
    const w = await world();
    await w.api.caretaker.connector.requestEnable({ groupId: w.groupId });
    const seen = async (ctx: { authUser: AuthUser }) => {
      const rows = await assistantRequestModel.list({
        ...ctx,
        filter: { groupId: { type: "eq", value: w.groupId } },
      });
      if (isError(rows)) throw new Error(String(rows.code));
      return rows.data.length;
    };
    expect(await seen(w.caretaker.ctx)).toBe(1);
    expect(await seen(w.owner.ctx)).toBe(1);
    expect(await seen(w.admin.ctx)).toBe(1);
    expect(await seen(w.viewer.ctx)).toBe(0);
    expect(await seen(w.outsider.ctx)).toBe(0);
    // Nobody writes them but the system.
    const forged = await assistantRequestModel.create({
      ...w.caretaker.ctx,
      data: { groupId: w.groupId, userId: w.caretaker.user.id },
    });
    expect(isError(forged)).toBe(true);
  });

  it("goes with the membership when the member leaves", async () => {
    const w = await world();
    await w.api.caretaker.connector.requestEnable({ groupId: w.groupId });
    ok(await careGroupMemberService.leave(w.caretaker.ctx, w.groupId));
    const left = await getDb().query.assistantRequestSchema.findMany({
      where: (t, { eq }) => eq(t.groupId, w.groupId),
    });
    expect(left).toEqual([]);
  });
});
