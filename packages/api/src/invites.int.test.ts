import type { AuthUser } from "@caretook/data";

import { getAuth } from "@caretook/auth";
import { careGroupInviteService, isError, SYSTEM_USER, userModel } from "@caretook/data";
import { setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../data/test/fixtures";
import { router } from ".";

// invite.* (invites slice 3) through the router, with the memory sender.

const PASSWORD = "a long enough passphrase";

const clientFor = (authUser: AuthUser | null) => createRouterClient(router, { context: { authUser } });
const anonymous = clientFor(null);

const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));

const mailTo = async (to: string) => {
  while (pending.length) await Promise.allSettled(pending.splice(0));
  return sharedMemorySender().sent.filter((m) => m.to === to);
};

const newAddress = (label: string) => `${label}-${randomUUID().slice(0, 8)}@example.com`;

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

const setup = async () => {
  const owner = await createUser("api-owner");
  const viewer = await createUser("api-viewer");
  const outsider = await createUser("api-outsider");
  const { group } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  return {
    groupId: group.id,
    owner: { ...owner, api: clientFor(owner.ctx.authUser) },
    viewer: { ...viewer, api: clientFor(viewer.ctx.authUser) },
    outsider: { ...outsider, api: clientFor(outsider.ctx.authUser) },
  };
};

/** The token in the newest groupInvite mail to `email`. */
const tokenFrom = async (email: string) => {
  const mail = (await mailTo(email)).filter((m) => m.name === "groupInvite").at(-1);
  const token = mail?.text.match(/\/invite\/([A-Za-z0-9_-]+)/)?.[1];
  if (!token) throw new Error(`No invite link for ${email}`);
  return { token, mail: mail };
};

describe("invite.createEmail and the email", () => {
  it("queues one groupInvite naming the group and inviter, and returns no token", async () => {
    const s = await setup();
    const email = newAddress("sib");
    const created = await s.owner.api.invite.createEmail({
      groupId: s.groupId,
      email,
      role: "caretaker",
      attested: true,
    });
    expect(created).toMatchObject({
      email,
      role: "caretaker",
      state: "usable",
      sentBy: { name: "api-owner" },
    });
    expect(JSON.stringify(created)).not.toMatch(/token/i);

    const { mail } = await tokenFrom(email);
    expect(mail.subject).toBe("api-owner invited you to Pat Example's care group on Caretook");
    expect(await mailTo(email)).toHaveLength(1);

    const listed = await s.owner.api.invite.listForGroup({ groupId: s.groupId });
    expect(listed.map((i) => i.email)).toContain(email);
  });

  it("refuses viewers (403) and non-members (404), and a missing attestation", async () => {
    const s = await setup();
    const input = {
      groupId: s.groupId,
      email: newAddress("x"),
      role: "viewer" as const,
      attested: true as const,
    };
    expect(await codeOf(s.viewer.api.invite.createEmail(input))).toBe("FORBIDDEN:");
    expect(await codeOf(s.outsider.api.invite.createEmail(input))).toBe("NOT_FOUND:");
    expect(await codeOf(s.viewer.api.invite.listForGroup({ groupId: s.groupId }))).toBe("FORBIDDEN:");
    expect(
      await codeOf(s.owner.api.invite.createEmail({ ...input, attested: false as unknown as true })),
    ).toMatch(/^BAD_REQUEST/);
  });

  it("resend sends a new link; the old one previews as not found", async () => {
    const s = await setup();
    const email = newAddress("again");
    const created = await s.owner.api.invite.createEmail({
      groupId: s.groupId,
      email,
      role: "viewer",
      attested: true,
    });
    const first = await tokenFrom(email);
    await s.owner.api.invite.resend({ id: created.id });
    const second = await tokenFrom(email);
    expect(second.token).not.toBe(first.token);
    expect(await anonymous.invite.preview({ token: first.token })).toEqual({ state: "notFound" });
    expect(await anonymous.invite.preview({ token: second.token })).toMatchObject({ state: "usable" });
  });
});

describe("the invitee", () => {
  it("previews, signs up with the invite's email (verified), signs in and accepts", async () => {
    const s = await setup();
    const email = newAddress("new");
    await s.owner.api.invite.createEmail({ groupId: s.groupId, email, role: "caretaker", attested: true });
    const { token } = await tokenFrom(email);

    expect(await anonymous.invite.preview({ token })).toEqual({
      state: "usable",
      kind: "email",
      role: "caretaker",
      email,
      groupName: "Pat Example",
      inviterName: "api-owner",
      expiresAt: expect.any(String) as string,
    });

    // Another address, or no ticket, creates nothing.
    expect(
      await codeOf(
        anonymous.invite.signUp({ token, name: "X", email: newAddress("other"), password: PASSWORD }),
      ),
    ).toBe("BAD_REQUEST:ticket:emailMismatch");
    expect(
      await codeOf(
        anonymous.invite.signUp({ token: "no-such-token-at-all", name: "X", email, password: PASSWORD }),
      ),
    ).toBe("FORBIDDEN:ticket:invalid");
    expect(await codeOf(anonymous.invite.signUp({ token, name: "X", email, password: "short" }))).toBe(
      "BAD_REQUEST:ticket:weakPassword",
    );

    expect(await anonymous.invite.signUp({ token, name: "New Person", email, password: PASSWORD })).toEqual({
      email,
      verified: true,
    });
    expect(await codeOf(anonymous.invite.signUp({ token, name: "Again", email, password: PASSWORD }))).toBe(
      "CONFLICT:ticket:accountExists",
    );
    const user = await userModel.getByEmail(email, { authUser: SYSTEM_USER });
    if (isError(user)) throw new Error(user.code);
    expect(user.emailVerified).toBe(true);

    // The new account signs in with its password at once (verified).
    const signedIn = await getAuth().api.signInEmail({
      body: { email, password: PASSWORD },
      asResponse: true,
    });
    expect(signedIn.status).toBe(200);

    const joiner = clientFor({ id: user.id, roleNames: ["member"] });
    expect(await codeOf(joiner.invite.accept({ token, consent: false as unknown as true }))).toMatch(
      /^BAD_REQUEST/,
    );
    expect(await joiner.invite.accept({ token, consent: true })).toEqual({
      status: "joined",
      groupId: s.groupId,
      role: "caretaker",
    });
    // Accepted: the link now says so, and names nothing.
    expect(await anonymous.invite.preview({ token })).toEqual({ state: "accepted" });
  });

  it("public sign-up stays refused", async () => {
    const email = newAddress("public");
    const res = await getAuth().api.signUpEmail({
      body: { email, password: PASSWORD, name: "Nope" },
      asResponse: true,
    });
    expect(res.ok).toBe(false);
    expect(isError(await userModel.getByEmail(email, { authUser: SYSTEM_USER }))).toBe(true);
  });

  it("someone signed in with another address is refused; decline needs no account", async () => {
    const s = await setup();
    const email = newAddress("wrong");
    await s.owner.api.invite.createEmail({ groupId: s.groupId, email, role: "viewer", attested: true });
    const { token } = await tokenFrom(email);
    expect(await codeOf(s.outsider.api.invite.accept({ token, consent: true }))).toBe(
      "FORBIDDEN:careGroupInviteService:wrongEmail",
    );
    expect(await codeOf(anonymous.invite.accept({ token, consent: true }))).toBe("UNAUTHORIZED:");
    expect(await anonymous.invite.decline({ token })).toEqual({ ok: true });
    expect(await anonymous.invite.preview({ token })).toEqual({ state: "declined" });
    const listed = await s.owner.api.invite.listForGroup({ groupId: s.groupId });
    expect(listed.find((i) => i.email === email)?.status).toBe("declined");
  });

  it("revoke stops the link at once, and is for managers", async () => {
    const s = await setup();
    const email = newAddress("revoke");
    const created = await s.owner.api.invite.createEmail({
      groupId: s.groupId,
      email,
      role: "viewer",
      attested: true,
    });
    const { token } = await tokenFrom(email);
    expect(await codeOf(s.viewer.api.invite.revoke({ id: created.id }))).toBe(
      "NOT_FOUND:careGroupInviteService:notFound",
    );
    await s.owner.api.invite.revoke({ id: created.id });
    expect(await anonymous.invite.preview({ token })).toEqual({ state: "revoked" });
    expect(isError(await careGroupInviteService.ticketFor(token))).toBe(true);
  });
});
