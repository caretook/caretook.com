import type { AuthUser } from "@caretook/data";

import {
  accessCodeModel,
  accessCodeRedemptionModel,
  careGroupInviteService,
  careGroupMemberModel,
  careGroupModel,
  careRecipientModel,
  isError,
  SYSTEM_USER,
  userModel,
} from "@caretook/data";
import { setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../data/test/fixtures";
import { router } from ".";

// Starting care groups (invites slice 5) through the router: careGroup.create,
// access codes (sign-up and its group in one transaction) and the staff-only
// admin procedures, with the memory sender.

const PASSWORD = "a long enough passphrase";
const system = { authUser: SYSTEM_USER };

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

const userByEmail = async (email: string) => {
  const user = await userModel.get({ ...system, filter: { email: { type: "eq", value: email } } });
  if (isError(user)) throw new Error(String(user.code));
  return user;
};

const staff = async () => {
  const admin = await createUser("api-staff", "admin");
  return { ...admin, api: clientFor(admin.ctx.authUser) };
};

describe("careGroup.create", () => {
  it("creates the group, its recipient and the creator as owner, with a default name", async () => {
    const me = await createUser("creator");
    const api = clientFor(me.ctx.authUser);
    const { groupId, name } = await api.careGroup.create({
      recipientName: "Lou Example",
      preferredName: "Grandpa Lou",
    });
    expect(name).toBe("Grandpa Lou's care");
    expect(await careGroupMemberModel.getRole(groupId, me.user.id)).toBe("owner");
    const recipient = await careRecipientModel.get({
      ...system,
      filter: { groupId: { type: "eq", value: groupId } },
    });
    expect(recipient).toMatchObject({ name: "Lou Example", preferredName: "Grandpa Lou" });

    const named = await api.careGroup.create({
      recipientName: "Ann Example",
      groupName: "  The Example family ",
    });
    expect(named.name).toBe("The Example family");
    // It's the creator's: their group list has both.
    const mine = await api.careGroup.listMine();
    expect(mine.map((g) => g.id)).toEqual(expect.arrayContaining([groupId, named.groupId]));
  });

  it("refuses an empty recipient name, and anyone signed out", async () => {
    const me = await createUser("creator-bad");
    expect(await codeOf(clientFor(me.ctx.authUser).careGroup.create({ recipientName: "  " }))).toMatch(
      /^BAD_REQUEST/,
    );
    expect(await codeOf(anonymous.careGroup.create({ recipientName: "Pat" }))).toBe("UNAUTHORIZED:");
  });
});

describe("access codes", () => {
  const signUp = (code: string, email: string, recipientName = "Rose Example") =>
    anonymous.accessCode.signUp({
      code,
      name: "New Person",
      email,
      password: PASSWORD,
      group: { recipientName, preferredName: "Nana Rose" },
    });

  it("signs up and starts a group as its owner, in one go, and records the redemption", async () => {
    const { api } = await staff();
    const code = await api.admin.accessCode.create({ label: "Clinic flyer", expiresInDays: 30, maxUses: 5 });
    expect(code.code).toMatch(/^CARE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(
      await anonymous.accessCode.preview({ code: code.code.toLowerCase().replaceAll("-", " ") }),
    ).toEqual({
      state: "usable",
      code: code.code,
    });

    const email = newAddress("coder");
    const { groupId } = await signUp(code.code, email);
    if (!groupId) throw new Error("no group");
    const user = await userByEmail(email);
    expect(user).toMatchObject({ name: "New Person", emailVerified: false });
    expect(await careGroupMemberModel.getRole(groupId, user!.id)).toBe("owner");
    const group = await careGroupModel.getById(groupId, system);
    expect(group).toMatchObject({ name: "Nana Rose's care" });
    const redemptions = await accessCodeRedemptionModel.list({
      ...system,
      filter: { codeId: { type: "eq", value: code.id } },
    });
    if (isError(redemptions)) throw new Error("list");
    expect(redemptions.data).toEqual([expect.objectContaining({ userId: user!.id, groupId })]);
    expect((await api.admin.accessCode.get({ id: code.id })).useCount).toBe(1);

    // The new account can't use its password until the address is confirmed.
    const { getAuth } = await import("@caretook/auth");
    const res = await getAuth().api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
    expect(res.status).toBe(403);
  });

  it("refuses expired, revoked and used-up codes, creating nothing", async () => {
    const { api, ctx } = await staff();
    const used = await api.admin.accessCode.create({ label: "One use", expiresInDays: 1, maxUses: 1 });
    await signUp(used.code, newAddress("first"));
    const revoked = await api.admin.accessCode.create({ label: "Revoked", expiresInDays: 1 });
    expect((await api.admin.accessCode.revoke({ id: revoked.id })).state).toBe("revoked");
    const expired = await api.admin.accessCode.create({ label: "Expired", expiresInDays: 1 });
    await accessCodeModel.update({
      ...ctx,
      filter: { id: { type: "eq", value: expired.id } },
      data: { expiresAt: new Date(Date.now() - 1000).toISOString() },
    });

    for (const [code, state] of [
      [used.code, "usedUp"],
      [revoked.code, "revoked"],
      [expired.code, "expired"],
    ] as const) {
      expect(await anonymous.accessCode.preview({ code })).toEqual({ state });
      const email = newAddress(`refused-${state}`);
      expect(await codeOf(signUp(code, email))).toBe("CONFLICT:accessCodeService:unusable");
      expect(await userByEmail(email)).toBeNull();
    }
    expect(await anonymous.accessCode.preview({ code: "CARE-NOPE-NOPE" })).toEqual({ state: "notFound" });
    expect(await anonymous.accessCode.preview({ code: "hello" })).toEqual({ state: "notFound" });
  });

  it("rolls the whole sign-up back when the address has an account", async () => {
    const { api } = await staff();
    const code = await api.admin.accessCode.create({ label: "Taken", expiresInDays: 1 });
    const existing = await createUser("taken");
    const recipientName = `Rollback ${randomUUID().slice(0, 6)}`;
    expect(await codeOf(signUp(code.code, existing.user.email, recipientName))).toBe(
      "CONFLICT:ticket:accountExists",
    );
    const recipients = await careRecipientModel.list({
      ...system,
      filter: { name: { type: "eq", value: recipientName } },
    });
    if (isError(recipients)) throw new Error("list");
    expect(recipients.data).toEqual([]);
    expect((await api.admin.accessCode.get({ id: code.id })).useCount).toBe(0);
  });

  it("refuses a weak password before creating anything", async () => {
    const { api } = await staff();
    const code = await api.admin.accessCode.create({ label: "Weak", expiresInDays: 1 });
    const email = newAddress("weak");
    expect(
      await codeOf(
        anonymous.accessCode.signUp({
          code: code.code,
          name: "W",
          email,
          password: "short",
          group: { recipientName: "X" },
        }),
      ),
    ).toBe("BAD_REQUEST:ticket:weakPassword");
    expect(await userByEmail(email)).toBeNull();
  });
});

describe("admin.*", () => {
  it("is for staff only: a group owner and a member are refused", async () => {
    const owner = await createUser("not-staff-owner");
    await createGroup(owner);
    const member = await createUser("not-staff");
    for (const who of [owner, member]) {
      const api = clientFor(who.ctx.authUser);
      expect(await codeOf(api.admin.accessCode.list())).toBe("FORBIDDEN:");
      expect(await codeOf(api.admin.accessCode.create({ label: "x", expiresInDays: 1 }))).toBe("FORBIDDEN:");
      expect(
        await codeOf(
          api.admin.careGroup.createWithOwnerInvite({
            groupName: "G",
            recipientName: "R",
            ownerEmail: newAddress("o"),
            attested: true,
          }),
        ),
      ).toBe("FORBIDDEN:");
    }
    expect(await codeOf(anonymous.admin.accessCode.list())).toBe("UNAUTHORIZED:");
  });

  it("lists codes with their uses, newest first", async () => {
    const { api } = await staff();
    const a = await api.admin.accessCode.create({ label: "First", expiresInDays: 10 });
    const b = await api.admin.accessCode.create({ label: "Second", expiresInDays: 10, maxUses: 3 });
    const list = await api.admin.accessCode.list();
    const ids = list.map((c) => c.id);
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id));
    expect(list.find((c) => c.id === b.id)).toMatchObject({
      label: "Second",
      maxUses: 3,
      useCount: 0,
      state: "usable",
    });
  });

  it("creates a group with an owner invite; the staff member never joins it", async () => {
    const { api, user: staffUser } = await staff();
    const ownerEmail = newAddress("new-owner");
    const { groupId } = await api.admin.careGroup.createWithOwnerInvite({
      groupName: "Example family",
      recipientName: "Pat Example",
      ownerEmail,
      attested: true,
    });
    expect(await careGroupMemberModel.getRole(groupId, staffUser.id)).toBeNull();
    const group = await careGroupModel.getById(groupId, system);
    expect(group).toMatchObject({ name: "Example family", createdBy: staffUser.id });

    const [mail] = await mailTo(ownerEmail);
    expect(mail?.subject).toContain("Pat Example");
    const token = /\/invite\/([A-Za-z0-9_-]+)/.exec(mail?.text ?? "")?.[1];
    if (!token) throw new Error("no invite link");

    // The invitee signs up from the link and joins as owner.
    await anonymous.invite.signUp({ token, name: "New Owner", email: ownerEmail, password: PASSWORD });
    const owner = await userByEmail(ownerEmail);
    const joined = await careGroupInviteService.accept(
      { authUser: { id: owner!.id, roleNames: ["member"] } },
      { token, consent: true },
    );
    expect(joined).toMatchObject({ groupId, role: "owner" });
  });
});
