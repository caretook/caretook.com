import {
  accessCodeModel,
  accessCodeRedemptionModel,
  careGroupInviteService,
  careGroupMemberModel,
  careGroupModel,
  careRecipientModel,
  getDb,
  isError,
  legalAcceptanceModel,
  legalAcceptanceService,
  medicationPassModel,
  SYSTEM_USER,
  userModel,
} from "@caretook/data";
import { LEGAL_VERSIONS } from "@caretook/data/schema";
import { setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../../data/test/fixtures";
import { clientFor, codesOf } from "../testing";

// Starting care groups (invites slice 5) through the router: careGroup.create,
// access codes (sign-up and its group in one transaction) and the staff-only
// admin procedures, with the memory sender.

const PASSWORD = "a long enough passphrase";
const system = { authUser: SYSTEM_USER };

const anonymous = clientFor(null);

const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));

const mailTo = async (to: string) => {
  while (pending.length) await Promise.allSettled(pending.splice(0));
  return sharedMemorySender().sent.filter((m) => m.to === to);
};

const newAddress = (label: string) => `${label}-${randomUUID().slice(0, 8)}@example.com`;

const userByEmail = async (email: string) => {
  const user = await userModel.get({ ...system, filter: { email: { type: "eq", value: email } } });
  if (isError(user)) throw new Error(String(user.code));
  return user;
};

/** A group's passes as [name, time], in order: every new group starts with Morning and Evening. */
const passesOf = async (groupId: string) => {
  const res = await medicationPassModel.list({
    ...system,
    filter: { groupId: { type: "eq", value: groupId } },
  });
  if (isError(res)) throw new Error(String(res.code));
  return res.data.map((p) => [p.name, p.time]);
};
const DEFAULT_PASS_LIST = [
  ["Morning", "08:00"],
  ["Evening", "20:00"],
];

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
    expect(await passesOf(groupId)).toEqual(DEFAULT_PASS_LIST);

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
    expect(await codesOf(clientFor(me.ctx.authUser).careGroup.create({ recipientName: "  " }))).toMatch(
      /^BAD_REQUEST/,
    );
    expect(await codesOf(anonymous.careGroup.create({ recipientName: "Pat" }))).toBe("UNAUTHORIZED:");
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
      legal: true,
    });

  const acceptancesOf = (userId: string) =>
    getDb().query.legalAcceptanceSchema.findMany({ where: (t, { eq }) => eq(t.userId, userId) });

  it("refuses a sign-up without the legal box, creating nothing", async () => {
    const { api } = await staff();
    const code = await api.admin.accessCode.create({ label: "No box", expiresInDays: 1, maxUses: 1 });
    const email = newAddress("no-legal");
    const input = {
      code: code.code,
      name: "New Person",
      email,
      password: PASSWORD,
      group: { recipientName: "Rose Example" },
    };
    for (const attempt of [input, { ...input, legal: false }]) {
      // @ts-expect-error the type requires `legal: true`; the server must refuse it too.
      expect(await codesOf(anonymous.accessCode.signUp(attempt))).toMatch(/^BAD_REQUEST/);
    }
    expect(await userByEmail(email)).toBeNull();
    expect((await api.admin.accessCode.get({ id: code.id })).useCount).toBe(0);
  });

  it("records one acceptance naming the versions and the source", async () => {
    const { api } = await staff();
    const code = await api.admin.accessCode.create({ label: "Accepts", expiresInDays: 1 });
    const email = newAddress("accepts");
    await signUp(code.code, email);
    const user = await userByEmail(email);
    expect(await acceptancesOf(user!.id)).toEqual([
      expect.objectContaining({
        source: "access_code",
        termsVersion: LEGAL_VERSIONS.terms,
        privacyVersion: LEGAL_VERSIONS.privacy,
        healthDataPrivacyVersion: LEGAL_VERSIONS.healthDataPrivacy,
        wordingVersion: LEGAL_VERSIONS.wording,
      }),
    ]);
    expect(await legalAcceptanceService.hasCurrent(user!.id)).toBe(true);
  });

  it("writes no acceptance for an address that already has an account, with the same answer", async () => {
    const { api } = await staff();
    const code = await api.admin.accessCode.create({ label: "Existing", expiresInDays: 1 });
    const existing = await createUser("legal-existing");
    expect(await signUp(code.code, existing.user.email)).toEqual({ email: existing.user.email });
    expect(await acceptancesOf(existing.user.id)).toEqual([]);
    expect(await legalAcceptanceService.hasCurrent(existing.user.id)).toBe(false);
  });

  it("lets only the person read a row and only the system write one; deleting the account deletes it", async () => {
    const { api, ctx: staffCtx } = await staff();
    const code = await api.admin.accessCode.create({ label: "Rows", expiresInDays: 1 });
    const email = newAddress("rows");
    await signUp(code.code, email);
    const user = await userByEmail(email);
    const [row] = await acceptancesOf(user!.id);
    const person = { authUser: { ...staffCtx.authUser, id: user!.id, role: "member" as const } };
    const other = await createUser("legal-other");

    expect(await legalAcceptanceModel.getById(row!.id, person)).toMatchObject({ id: row!.id });
    expect(await legalAcceptanceModel.getById(row!.id, other.ctx)).toBeNull();
    expect(await legalAcceptanceModel.getById(row!.id, staffCtx)).toBeNull();

    const data = {
      userId: user!.id,
      source: "access_code" as const,
      termsVersion: "x",
      privacyVersion: "x",
      healthDataPrivacyVersion: "x",
      wordingVersion: "x",
    };
    for (const ctx of [person, other.ctx, staffCtx]) {
      expect(isError(await legalAcceptanceModel.create({ ...ctx, data }))).toBe(true);
    }
    expect(await acceptancesOf(user!.id)).toHaveLength(1);

    expect(
      isError(await userModel.remove({ ...system, filter: { id: { type: "eq", value: user!.id } } })),
    ).toBe(false);
    expect(await acceptancesOf(user!.id)).toEqual([]);
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
    expect(await signUp(code.code, email)).toEqual({ email });
    const user = await userByEmail(email);
    expect(user).toMatchObject({ name: "New Person", emailVerified: false });
    const [membership] = await getDb().query.careGroupMemberSchema.findMany({
      where: (t, { eq }) => eq(t.userId, user!.id),
    });
    const groupId = membership!.groupId;
    expect(await careGroupMemberModel.getRole(groupId, user!.id)).toBe("owner");
    const group = await careGroupModel.getById(groupId, system);
    expect(group).toMatchObject({ name: "Nana Rose's care" });
    expect(await passesOf(groupId)).toEqual(DEFAULT_PASS_LIST);
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
      expect(await codesOf(signUp(code, email))).toBe("CONFLICT:accessCodeService:unusable");
      expect(await userByEmail(email)).toBeNull();
    }
    expect(await anonymous.accessCode.preview({ code: "CARE-NOPE-NOPE" })).toEqual({ state: "notFound" });
    expect(await anonymous.accessCode.preview({ code: "hello" })).toEqual({ state: "notFound" });
  });

  it("answers an address with an account like a new one, creates nothing and emails its owner", async () => {
    const { api } = await staff();
    const code = await api.admin.accessCode.create({ label: "Taken", expiresInDays: 1 });
    const fresh = newAddress("fresh");
    const existing = await createUser("taken");
    const recipientName = `Existing ${randomUUID().slice(0, 6)}`;

    expect(await signUp(code.code, fresh)).toEqual({ email: fresh });
    // Typed differently, it's the same address, and the same answer.
    const typed = existing.user.email.toUpperCase();
    expect(await signUp(code.code, typed, recipientName)).toEqual({ email: existing.user.email });

    // Nothing was created: no group or recipient, no membership, no
    // redemption, no new user, and the code counts only the new sign-up.
    const recipients = await careRecipientModel.list({
      ...system,
      filter: { name: { type: "eq", value: recipientName } },
    });
    if (isError(recipients)) throw new Error("list");
    expect(recipients.data).toEqual([]);
    const redemptions = await accessCodeRedemptionModel.list({
      ...system,
      filter: { userId: { type: "eq", value: existing.user.id } },
    });
    if (isError(redemptions)) throw new Error("list");
    expect(redemptions.data).toEqual([]);
    const memberships = await getDb().query.careGroupMemberSchema.findMany({
      where: (t, { eq }) => eq(t.userId, existing.user.id),
    });
    expect(memberships).toEqual([]);
    expect((await userByEmail(existing.user.email))?.id).toBe(existing.user.id);
    expect((await api.admin.accessCode.get({ id: code.id })).useCount).toBe(1);

    // Its owner gets one email (a repeat sends no second), with no code or
    // anything the person typed in it.
    expect(await signUp(code.code, existing.user.email, recipientName)).toEqual({
      email: existing.user.email,
    });
    const mail = (await mailTo(existing.user.email)).filter((m) => m.name === "accessCodeExistingAccount");
    expect(mail).toHaveLength(1);
    expect(mail[0]!.text).toContain("sign in and choose New care group");
    expect(mail[0]!.text).not.toContain(code.code);
    expect(mail[0]!.text).not.toContain(recipientName);
    const queued = await getDb().query.notificationOutboxSchema.findMany({
      where: (t, { and, eq }) =>
        and(eq(t.recipient, existing.user.email), eq(t.name, "accessCodeExistingAccount")),
    });
    expect(queued).toHaveLength(1);
    // A new address gets no such email.
    expect((await mailTo(fresh)).filter((m) => m.name === "accessCodeExistingAccount")).toEqual([]);
    expect((await api.admin.accessCode.get({ id: code.id })).useCount).toBe(1);
  });

  it("refuses a code that can't be used the same way for an address with an account", async () => {
    const { api } = await staff();
    const revoked = await api.admin.accessCode.create({ label: "Revoked", expiresInDays: 1 });
    await api.admin.accessCode.revoke({ id: revoked.id });
    const existing = await createUser("taken-revoked");
    expect(await codesOf(signUp(revoked.code, existing.user.email))).toBe(
      "CONFLICT:accessCodeService:unusable",
    );
    expect(await codesOf(signUp(revoked.code, newAddress("revoked-new")))).toBe(
      "CONFLICT:accessCodeService:unusable",
    );
    expect(await codesOf(signUp("CARE-ZZZZ-ZZZZ", existing.user.email))).toBe(
      await codesOf(signUp("CARE-ZZZZ-ZZZZ", newAddress("unknown-new"))),
    );
    expect((await mailTo(existing.user.email)).filter((m) => m.name === "accessCodeExistingAccount")).toEqual(
      [],
    );
  });

  it("refuses a weak password before creating anything", async () => {
    const { api } = await staff();
    const code = await api.admin.accessCode.create({ label: "Weak", expiresInDays: 1 });
    const email = newAddress("weak");
    expect(
      await codesOf(
        anonymous.accessCode.signUp({
          code: code.code,
          name: "W",
          email,
          password: "short",
          group: { recipientName: "X" },
          legal: true,
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
      expect(await codesOf(api.admin.accessCode.list())).toBe("FORBIDDEN:");
      expect(await codesOf(api.admin.accessCode.create({ label: "x", expiresInDays: 1 }))).toBe("FORBIDDEN:");
      expect(
        await codesOf(
          api.admin.careGroup.createWithOwnerInvite({
            groupName: "G",
            recipientName: "R",
            ownerEmail: newAddress("o"),
            attested: true,
          }),
        ),
      ).toBe("FORBIDDEN:");
    }
    expect(await codesOf(anonymous.admin.accessCode.list())).toBe("UNAUTHORIZED:");
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
    expect(await passesOf(groupId)).toEqual(DEFAULT_PASS_LIST);

    const [mail] = await mailTo(ownerEmail);
    expect(mail?.subject).toContain("Pat Example");
    const token = /\/invite\/([A-Za-z0-9_-]+)/.exec(mail?.text ?? "")?.[1];
    if (!token) throw new Error("no invite link");

    // The invitee signs up from the link and joins as owner.
    await anonymous.invite.signUp({
      token,
      name: "New Owner",
      email: ownerEmail,
      password: PASSWORD,
      legal: true,
    });
    const owner = await userByEmail(ownerEmail);
    const joined = await careGroupInviteService.accept(
      { authUser: { id: owner!.id, roleNames: ["member"] } },
      { token, consent: true, legal: true },
    );
    expect(joined).toMatchObject({ groupId, role: "owner" });
  });
});
