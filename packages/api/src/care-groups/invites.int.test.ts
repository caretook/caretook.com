import { getAuth } from "@caretook/auth";
import {
  careGroupInviteService,
  careGroupMemberModel,
  getDb,
  isError,
  legalAcceptanceModel,
  legalAcceptanceService,
  newError,
  SYSTEM_USER,
  userModel,
} from "@caretook/data";
import { setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createGroup, createUser } from "../../../data/test/fixtures";
import { clientFor, codesOf } from "../testing";

// invite.* (invites slice 3) through the router, with the memory sender.

const PASSWORD = "a long enough passphrase";

const anonymous = clientFor(null);

const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));

const mailTo = async (to: string) => {
  while (pending.length) await Promise.allSettled(pending.splice(0));
  return sharedMemorySender().sent.filter((m) => m.to === to);
};

const newAddress = (label: string) => `${label}-${randomUUID().slice(0, 8)}@example.com`;

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
    expect(await codesOf(s.viewer.api.invite.createEmail(input))).toBe("FORBIDDEN:");
    expect(await codesOf(s.outsider.api.invite.createEmail(input))).toBe("NOT_FOUND:");
    expect(await codesOf(s.viewer.api.invite.listForGroup({ groupId: s.groupId }))).toBe("FORBIDDEN:");
    expect(
      await codesOf(s.owner.api.invite.createEmail({ ...input, attested: false as unknown as true })),
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
      await codesOf(
        anonymous.invite.signUp({
          token,
          name: "X",
          email: newAddress("other"),
          password: PASSWORD,
          legal: true,
        }),
      ),
    ).toBe("BAD_REQUEST:ticket:emailMismatch");
    expect(
      await codesOf(
        anonymous.invite.signUp({
          token: "no-such-token-at-all",
          name: "X",
          email,
          password: PASSWORD,
          legal: true,
        }),
      ),
    ).toBe("FORBIDDEN:ticket:invalid");
    expect(
      await codesOf(anonymous.invite.signUp({ token, name: "X", email, password: "short", legal: true })),
    ).toBe("BAD_REQUEST:ticket:weakPassword");

    expect(
      await anonymous.invite.signUp({ token, name: "New Person", email, password: PASSWORD, legal: true }),
    ).toEqual({
      email,
      verified: true,
    });
    expect(
      await codesOf(
        anonymous.invite.signUp({ token, name: "Again", email, password: PASSWORD, legal: true }),
      ),
    ).toBe("CONFLICT:ticket:accountExists");
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
    expect(await codesOf(joiner.invite.accept({ token, consent: false as unknown as true }))).toMatch(
      /^BAD_REQUEST/,
    );
    expect(await joiner.invite.accept({ token, consent: true, legal: true })).toEqual({
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
    expect(await codesOf(s.outsider.api.invite.accept({ token, consent: true, legal: true }))).toBe(
      "FORBIDDEN:careGroupInviteService:wrongEmail",
    );
    expect(await codesOf(anonymous.invite.accept({ token, consent: true, legal: true }))).toBe(
      "UNAUTHORIZED:",
    );
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
    expect(await codesOf(s.viewer.api.invite.revoke({ id: created.id }))).toBe(
      "NOT_FOUND:careGroupInviteService:notFound",
    );
    await s.owner.api.invite.revoke({ id: created.id });
    expect(await anonymous.invite.preview({ token })).toEqual({ state: "revoked" });
    expect(isError(await careGroupInviteService.ticketFor(token))).toBe(true);
  });
});

describe("legal acceptance at an invite", () => {
  afterEach(() => vi.restoreAllMocks());

  const rowsOf = (userId: string) =>
    getDb().query.legalAcceptanceSchema.findMany({ where: (t, { eq }) => eq(t.userId, userId) });
  const sourcesOf = async (userId: string) => (await rowsOf(userId)).map((r) => r.source);
  const account = async (email: string) => {
    const user = await userModel.getByEmail(email, { authUser: SYSTEM_USER });
    if (isError(user)) throw new Error(user.code);
    return { id: user.id, api: clientFor({ id: user.id, roleNames: ["member"] }) };
  };
  const emailInvite = async (s: Awaited<ReturnType<typeof setup>>, email: string) => {
    await s.owner.api.invite.createEmail({ groupId: s.groupId, email, role: "caretaker", attested: true });
    return (await tokenFrom(email)).token;
  };
  const LEGAL_REQUIRED = "BAD_REQUEST:careGroupInviteService:legalRequired";

  it("refuses a sign-up without the box, for email invites and links, creating nothing", async () => {
    const s = await setup();
    const email = newAddress("no-box");
    const token = await emailInvite(s, email);
    const link = await s.owner.api.invite.createLink({ groupId: s.groupId, role: "viewer" });
    const linkEmail = newAddress("no-box-link");
    for (const [t, address] of [
      [token, email],
      [link.token, linkEmail],
    ] as const) {
      for (const legal of [undefined, false]) {
        const input = { token: t, name: "No Box", email: address, password: PASSWORD, legal };
        expect(await codesOf(anonymous.invite.signUp(input as never))).toMatch(/^BAD_REQUEST/);
      }
      expect(isError(await userModel.getByEmail(address, { authUser: SYSTEM_USER }))).toBe(true);
    }
  });

  it("an email sign-up records invite_signup, and its accept neither asks nor writes again", async () => {
    const s = await setup();
    const email = newAddress("signed");
    const token = await emailInvite(s, email);
    await anonymous.invite.signUp({ token, name: "Signed Up", email, password: PASSWORD, legal: true });
    const { id, api } = await account(email);
    expect(await sourcesOf(id)).toEqual(["invite_signup"]);
    expect(await api.invite.legalNeeded()).toEqual({ needed: false });

    expect(await api.invite.accept({ token, consent: true })).toMatchObject({ status: "joined" });
    // Accepting twice, even with the box, is the same answer and no new row.
    expect(await api.invite.accept({ token, consent: true, legal: true })).toMatchObject({
      status: "joined",
    });
    expect(await sourcesOf(id)).toEqual(["invite_signup"]);
  });

  it.each([
    ["returns an error", () => Promise.resolve(newError({ code: "baseModel:create:nothingCreated" }))],
    ["throws", () => Promise.reject(new Error("write failed"))],
  ])("a lost sign-up write (%s) keeps the account, and the accept asks", async (_, lost) => {
    const s = await setup();
    const email = newAddress("lost");
    const token = await emailInvite(s, email);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const create = vi.spyOn(legalAcceptanceModel, "create").mockImplementationOnce(lost);
    expect(
      await anonymous.invite.signUp({ token, name: "Lost Write", email, password: PASSWORD, legal: true }),
    ).toEqual({ email, verified: true });
    expect(create).toHaveBeenCalledOnce();

    const { id, api } = await account(email);
    expect(await sourcesOf(id)).toEqual([]);
    expect(await api.invite.legalNeeded()).toEqual({ needed: true });
    expect(await codesOf(api.invite.accept({ token, consent: true }))).toBe(LEGAL_REQUIRED);
    expect(await careGroupMemberModel.getRole(s.groupId, id)).toBeNull();

    await api.invite.accept({ token, consent: true, legal: true });
    expect(await sourcesOf(id)).toEqual(["invite_accept"]);
    expect(await careGroupMemberModel.getRole(s.groupId, id)).toBe("caretaker");
  });

  it("an existing account is asked once, and a current acceptance isn't asked for again", async () => {
    const s = await setup();
    const token = await emailInvite(s, s.outsider.user.email);
    expect(await s.outsider.api.invite.legalNeeded()).toEqual({ needed: true });
    expect(await codesOf(s.outsider.api.invite.accept({ token, consent: true }))).toBe(LEGAL_REQUIRED);
    expect(await s.outsider.api.invite.accept({ token, consent: true, legal: true })).toMatchObject({
      status: "joined",
    });
    expect(await sourcesOf(s.outsider.user.id)).toEqual(["invite_accept"]);
    expect(await s.outsider.api.invite.legalNeeded()).toEqual({ needed: false });

    const { group } = await createGroup(s.owner, []);
    await s.owner.api.invite.createEmail({
      groupId: group.id,
      email: s.outsider.user.email,
      role: "viewer",
      attested: true,
    });
    const second = (await tokenFrom(s.outsider.user.email)).token;
    await s.outsider.api.invite.accept({ token: second, consent: true, legal: true });
    expect(await sourcesOf(s.outsider.user.id)).toEqual(["invite_accept"]);
  });

  it("a refused accept writes no acceptance, even with the box", async () => {
    const s = await setup();
    const token = await emailInvite(s, newAddress("someone-else"));
    expect(await codesOf(s.outsider.api.invite.accept({ token, consent: true, legal: true }))).toBe(
      "FORBIDDEN:careGroupInviteService:wrongEmail",
    );
    expect(await sourcesOf(s.outsider.user.id)).toEqual([]);
  });

  it("a link's request asks the same, and a waiting request isn't asked again", async () => {
    const s = await setup();
    const { token } = await s.owner.api.invite.createLink({ groupId: s.groupId, role: "viewer" });
    const person = s.outsider;
    expect(await codesOf(person.api.invite.accept({ token, consent: true }))).toBe(LEGAL_REQUIRED);
    const none = await s.owner.api.joinRequest.list({ groupId: s.groupId });
    expect(none.filter((r) => r.email === person.user.email)).toEqual([]);

    expect(await person.api.invite.accept({ token, consent: true, legal: true })).toMatchObject({
      status: "requested",
    });
    expect(await sourcesOf(person.user.id)).toEqual(["invite_accept"]);
    expect(await person.api.invite.accept({ token, consent: true, legal: true })).toMatchObject({
      status: "requested",
    });
    expect(await sourcesOf(person.user.id)).toEqual(["invite_accept"]);
    expect(await legalAcceptanceService.hasCurrent(person.user.id)).toBe(true);
  });

  it("a member using a link passes without being asked", async () => {
    const s = await setup();
    const { token } = await s.owner.api.invite.createLink({ groupId: s.groupId, role: "viewer" });
    expect(await s.viewer.api.invite.accept({ token, consent: true })).toMatchObject({ status: "joined" });
    expect(await sourcesOf(s.viewer.user.id)).toEqual([]);
  });

  it("a link's sign-up records invite_signup; an address with an account writes no row", async () => {
    const s = await setup();
    const { token } = await s.owner.api.invite.createLink({ groupId: s.groupId, role: "viewer" });
    const email = newAddress("link-new");
    await anonymous.invite.signUp({ token, name: "Link New", email, password: PASSWORD, legal: true });
    const { id } = await account(email);
    expect(await sourcesOf(id)).toEqual(["invite_signup"]);

    const answer = await anonymous.invite.signUp({
      token,
      name: "Someone",
      email: s.outsider.user.email,
      password: PASSWORD,
      legal: true,
    });
    expect(answer).toEqual({ email: s.outsider.user.email, verified: false });
    expect(await sourcesOf(s.outsider.user.id)).toEqual([]);
  });
});
