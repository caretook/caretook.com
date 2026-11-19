import type { AuthUser } from "@caretook/data";

import { userModel, isError, SYSTEM_USER } from "@caretook/data";
import { setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../data/test/fixtures";
import { router } from ".";

// Invite links and join requests (invites slice 4) through the router, with the memory sender.

const clientFor = (authUser: AuthUser | null) => createRouterClient(router, { context: { authUser } });
const anonymous = clientFor(null);

const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));

const mailTo = async (to: string) => {
  while (pending.length) await Promise.allSettled(pending.splice(0));
  return sharedMemorySender().sent.filter((m) => m.to === to);
};

const codeOf = async (call: Promise<unknown>) => {
  try {
    await call;
    return "ok";
  } catch (e) {
    if (e instanceof ORPCError)
      return `${e.code}:${String((e.data as { code?: string } | undefined)?.code ?? "")}`;
    throw e;
  }
};

/** Refused, or answered with nothing: either way, no group data. */
const nothingOr = (call: Promise<unknown[]>) =>
  call.then(
    (rows) => rows.length === 0,
    (e: unknown) => e instanceof ORPCError,
  );

const setup = async () => {
  const owner = await createUser("jr-owner");
  const admin = await createUser("jr-admin");
  const viewer = await createUser("jr-viewer");
  const { group } = await createGroup(owner, [
    { user: admin.user, role: "admin" },
    { user: viewer.user, role: "viewer" },
  ]);
  return {
    groupId: group.id,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    admin: { ...admin, api: clientFor(admin.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
  };
};

const joinerClient = async (label: string) => {
  const joiner = await createUser(label);
  return { ...joiner, api: clientFor(joiner.ctx.authUser) };
};

describe("invite links", () => {
  it("managers make caretaker and viewer links; the API refuses owner, admin and other members", async () => {
    const s = await setup();
    const made = await s.admin.api.invite.createLink({ groupId: s.groupId, role: "caretaker", maxUses: 5 });
    expect(made.invite).toMatchObject({
      kind: "link",
      role: "caretaker",
      maxUses: 5,
      useCount: 0,
      state: "usable",
    });
    // Defaults to 7 days.
    const days = (new Date(made.invite.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);

    for (const role of ["owner", "admin"]) {
      expect(
        await codeOf(s.owner.api.invite.createLink({ groupId: s.groupId, role: role as "viewer" })),
      ).toMatch(/^BAD_REQUEST/);
    }
    expect(
      await codeOf(s.owner.api.invite.createLink({ groupId: s.groupId, role: "viewer", expiresInDays: 91 })),
    ).toMatch(/^BAD_REQUEST/);
    expect(await codeOf(s.viewer.api.invite.createLink({ groupId: s.groupId, role: "viewer" }))).toBe(
      "FORBIDDEN:",
    );

    const listed = await s.owner.api.invite.listLinks({ groupId: s.groupId });
    expect(listed.map((l) => l.id)).toEqual([made.invite.id]);
    expect(JSON.stringify(listed)).not.toContain(made.token);
    // Email invites' list doesn't carry links.
    expect((await s.owner.api.invite.listForGroup({ groupId: s.groupId })).map((i) => i.id)).not.toContain(
      made.invite.id,
    );
  });

  it("copyLink gives another manager the same link while it's active", async () => {
    const s = await setup();
    const made = await s.owner.api.invite.createLink({ groupId: s.groupId, role: "viewer" });
    expect((await s.admin.api.invite.copyLink({ id: made.invite.id })).token).toBe(made.token);
    expect(await codeOf(s.viewer.api.invite.copyLink({ id: made.invite.id }))).toMatch(/^NOT_FOUND/);
    await s.admin.api.invite.revoke({ id: made.invite.id });
    expect(await codeOf(s.owner.api.invite.copyLink({ id: made.invite.id }))).toBe(
      "CONFLICT:careGroupInviteService:linkInactive",
    );
    expect(await s.owner.api.invite.listLinks({ groupId: s.groupId })).toEqual([]);
  });

  it("previews as a link, with no address", async () => {
    const s = await setup();
    const made = await s.owner.api.invite.createLink({ groupId: s.groupId, role: "viewer" });
    expect(await anonymous.invite.preview({ token: made.token })).toMatchObject({
      state: "usable",
      kind: "link",
      email: null,
      role: "viewer",
      groupName: "Pat Example",
    });
  });
});

describe("signing up through a link", () => {
  it("creates an unverified account for any address, and says the same for an existing one", async () => {
    const s = await setup();
    const made = await s.owner.api.invite.createLink({ groupId: s.groupId, role: "viewer" });
    const email = `jr-new-${randomUUID().slice(0, 8)}@example.com`;
    const res = await anonymous.invite.signUp({
      token: made.token,
      name: "Robin",
      email,
      password: "a long enough passphrase",
    });
    expect(res).toEqual({ email, verified: false });
    const user = await userModel.get({
      authUser: SYSTEM_USER,
      filter: { email: { type: "eq", value: email } },
    });
    if (isError(user) || !user) throw new Error("no user");
    expect(user.emailVerified).toBe(false);

    const again = await anonymous.invite.signUp({
      token: made.token,
      name: "Someone else",
      email: s.viewer.user.email,
      password: "a long enough passphrase",
    });
    expect(again).toEqual({ email: s.viewer.user.email, verified: false });
  });
});

describe("join requests", () => {
  const asked = async () => {
    const s = await setup();
    const made = await s.owner.api.invite.createLink({ groupId: s.groupId, role: "viewer" });
    const joiner = await joinerClient("jr-joiner");
    const res = await joiner.api.invite.accept({ token: made.token, consent: true });
    return { ...s, joiner, res, link: made };
  };

  it("asking emails every owner and admin, and the requester sees no group data", async () => {
    const s = await asked();
    expect(s.res).toEqual({ status: "requested", groupId: s.groupId, role: "viewer" });
    for (const manager of [s.owner, s.admin]) {
      const mail = (await mailTo(manager.user.email)).filter((m) => m.name === "joinRequested");
      expect(mail).toHaveLength(1);
      expect(mail[0]?.subject).toBe("jr-joiner asked to join Pat Example's care group");
      expect(mail[0]?.text).toContain(`/app/groups/${s.groupId}/settings/members`);
    }
    expect((await mailTo(s.viewer.user.email)).filter((m) => m.name === "joinRequested")).toHaveLength(0);
    expect(await nothingOr(s.joiner.api.timeline.list({ groupId: s.groupId }).then((p) => p.data))).toBe(
      true,
    );
    expect(await nothingOr(s.joiner.api.careGroup.members({ groupId: s.groupId }))).toBe(true);

    // Asking twice: one request, one email each.
    await s.joiner.api.invite.accept({ token: s.link.token, consent: true });
    expect((await mailTo(s.owner.user.email)).filter((m) => m.name === "joinRequested")).toHaveLength(1);

    const mine = await s.joiner.api.joinRequest.mine();
    expect(mine).toMatchObject([{ groupId: s.groupId, status: "pending", groupName: "Pat Example" }]);
    const list = await s.admin.api.joinRequest.list({ groupId: s.groupId });
    expect(list).toMatchObject([{ name: "jr-joiner", email: s.joiner.user.email, role: "viewer" }]);
    expect(await codeOf(s.viewer.api.joinRequest.list({ groupId: s.groupId }))).toBe("FORBIDDEN:");
  });

  it("approving makes them a member and emails them; declining emails them", async () => {
    const s = await asked();
    const [request] = await s.owner.api.joinRequest.list({ groupId: s.groupId });
    if (!request) throw new Error("no request");
    expect(await codeOf(s.viewer.api.joinRequest.approve({ id: request.id }))).toBe(
      "FORBIDDEN:joinRequestService:notAllowed",
    );
    expect(await s.admin.api.joinRequest.approve({ id: request.id })).toEqual({
      id: request.id,
      status: "approved",
    });
    const approved = (await mailTo(s.joiner.user.email)).filter((m) => m.name === "joinApproved");
    expect(approved).toHaveLength(1);
    const members = await s.joiner.api.careGroup.members({ groupId: s.groupId });
    expect(members.find((m) => m.userId === s.joiner.user.id)?.role).toBe("viewer");
    expect(await s.joiner.api.joinRequest.mine()).toEqual([]);

    const t = await asked();
    const [other] = await t.owner.api.joinRequest.list({ groupId: t.groupId });
    if (!other) throw new Error("no request");
    await t.owner.api.joinRequest.decline({ id: other.id });
    expect((await mailTo(t.joiner.user.email)).map((m) => m.name)).toContain("joinDeclined");
    expect(await t.joiner.api.joinRequest.mine()).toMatchObject([{ status: "declined" }]);
    expect(await nothingOr(t.joiner.api.careGroup.members({ groupId: t.groupId }))).toBe(true);
  });

  it("the requester can withdraw", async () => {
    const s = await asked();
    const [mine] = await s.joiner.api.joinRequest.mine();
    if (!mine) throw new Error("no request");
    expect(await s.joiner.api.joinRequest.withdraw({ id: mine.id })).toEqual({
      id: mine.id,
      status: "withdrawn",
    });
    expect(await s.owner.api.joinRequest.list({ groupId: s.groupId })).toEqual([]);
  });
});
