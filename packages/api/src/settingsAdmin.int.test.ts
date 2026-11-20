import type { AuthUser } from "@caretook/data";

import {
  accessCodeModel,
  adminAuditLogModel,
  appSettingSchema,
  appSettingService,
  getDb,
  isError,
  MIN_FORM_MS,
  SYSTEM_USER,
  userModel,
} from "@caretook/data";
import { setBackgroundRunner } from "@caretook/notifications";
import { createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../data/test/fixtures";
import { router } from ".";
import { resetPublicFormLimits } from "./publicForms";

// The app settings (admin slice 5) through the router: admin.settings.list
// and set (admins change, support reads, each change audited), and the
// consumers obeying a change: the sign-up switches, the invite link limits
// and the public forms' rate. Every test puts the settings back.

const PASSWORD = "a long enough passphrase";
const clientFor = (authUser: AuthUser | null, clientIp?: string) =>
  createRouterClient(router, { context: { authUser, ...(clientIp ? { clientIp } : {}) } });
const anonymous = clientFor(null);

const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));

const resetSettings = async () => {
  await getDb().delete(appSettingSchema);
  appSettingService.clearSettingsCache();
};
afterEach(resetSettings);

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

const newAddress = (label: string) => `${label}-${randomUUID().slice(0, 8)}@example.com`;

const staff = async () => {
  const admin = await createUser("set-admin", "admin");
  const support = await createUser("set-support", "support");
  return {
    admin: { ...admin, api: clientFor(admin.ctx.authUser) },
    support: { ...support, api: clientFor(support.ctx.authUser) },
  };
};

const settingEntries = async (actorId: string) => {
  const res = await adminAuditLogModel.search({
    authUser: SYSTEM_USER,
    filter: { actorId, action: "setting.set" },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(res)) throw new Error(String(res.code));
  return res.data;
};

describe("admin.settings", () => {
  it("lists every setting with its default for admins and support, and nobody else", async () => {
    const { admin, support } = await staff();
    const member = await createUser("set-member");
    const list = await support.api.admin.settings.list();
    expect(list.map((s) => s.key)).toContain("signup.accessCodes");
    expect(list.find((s) => s.key === "invites.linkMaxDays")).toMatchObject({
      value: 90,
      default: 90,
      isDefault: true,
    });
    expect(await admin.api.admin.settings.list()).toEqual(list);
    expect(await codeOf(clientFor(member.ctx.authUser).admin.settings.list())).toBe("FORBIDDEN:");
    expect(await codeOf(anonymous.admin.settings.list())).toMatch(/^UNAUTHORIZED/);
  });

  it("refuses support a change (a 403), writing nothing", async () => {
    const { support } = await staff();
    expect(
      await codeOf(
        support.api.admin.settings.set({ key: "signup.accessCodes", value: false, reason: "Trying" }),
      ),
    ).toBe("FORBIDDEN:");
    expect(await appSettingService.getSetting("signup.accessCodes")).toBe(true);
    expect(await settingEntries(support.user.id)).toHaveLength(0);
  });

  it("records each change once, with before and after and the reason", async () => {
    const { admin } = await staff();
    const saved = await admin.api.admin.settings.set({
      key: "invites.linkMaxDays",
      value: 30,
      reason: "Links abused",
    });
    expect(saved).toEqual({ key: "invites.linkMaxDays", value: 30, changed: true });
    // The same value again changes nothing and records nothing.
    expect(
      await admin.api.admin.settings.set({ key: "invites.linkMaxDays", value: 30, reason: "Again" }),
    ).toMatchObject({ changed: false });
    const entries = await settingEntries(admin.user.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      reason: "Links abused",
      changes: { "invites.linkMaxDays": [90, 30] },
    });
    expect(await admin.api.admin.settings.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "invites.linkMaxDays", value: 30, isDefault: false }),
      ]),
    );
  });

  it("refuses a value its schema doesn't allow, an unknown key and no reason", async () => {
    const { admin } = await staff();
    const set = (key: string, value: unknown, reason = "Testing") =>
      codeOf(admin.api.admin.settings.set({ key, value, reason }));
    expect(await set("invites.linkMaxDays", 91)).toBe("BAD_REQUEST:settings:invalid");
    expect(await set("signup.accessCodes", "no")).toBe("BAD_REQUEST:settings:invalid");
    expect(await set("mail.allowlist", ["not an address"])).toBe("BAD_REQUEST:settings:invalid");
    expect(await set("announcement", { text: "", tone: "info" })).toBe("BAD_REQUEST:settings:invalid");
    expect(await set("no.such.key", true)).toMatch(/^BAD_REQUEST/);
    expect(await set("signup.accessCodes", false, "  ")).toMatch(/^BAD_REQUEST/);
    expect(await settingEntries(admin.user.id)).toHaveLength(0);
    try {
      await admin.api.admin.settings.set({ key: "invites.linkMaxUses", value: 0, reason: "x" });
      expect.unreachable();
    } catch (e) {
      expect((e as ORPCError<string, { issues: { path: string }[] }>).data.issues).toEqual([
        expect.objectContaining({ path: "" }),
      ]);
    }
  });
});

describe("sign-up switches", () => {
  const signUp = (code: string, email: string) =>
    anonymous.accessCode.signUp({
      code,
      name: "New Person",
      email,
      password: PASSWORD,
      group: { recipientName: "Rose Example" },
    });

  it("refuses access-code sign-up while it's off, creating nothing, and works again once on", async () => {
    const { admin } = await staff();
    const code = await admin.api.admin.accessCode.create({ label: "Switch test", expiresInDays: 30 });
    await admin.api.admin.settings.set({ key: "signup.accessCodes", value: false, reason: "Pause" });

    expect(await anonymous.accessCode.preview({ code: code.code })).toEqual({ state: "unavailable" });
    const email = newAddress("closed");
    expect(await codeOf(signUp(code.code, email))).toBe("FORBIDDEN:settings:signupClosed");
    // An existing account gets the same answer.
    expect(await codeOf(signUp(code.code, admin.user.email))).toBe("FORBIDDEN:settings:signupClosed");
    const user = await userModel.get({
      authUser: SYSTEM_USER,
      filter: { email: { type: "eq", value: email } },
    });
    expect(user).toBeNull();
    const row = await accessCodeModel.getByCode(code.code);
    expect(isError(row) ? null : row?.useCount).toBe(0);

    await admin.api.admin.settings.set({ key: "signup.accessCodes", value: true, reason: "Resume" });
    expect(await anonymous.accessCode.preview({ code: code.code })).toMatchObject({ state: "usable" });
    expect(await signUp(code.code, email)).toEqual({ email });
  });

  it("refuses new invite links while links are off, and says so on an existing link", async () => {
    const { admin } = await staff();
    const owner = await createUser("set-owner");
    const { group } = await createGroup(owner);
    const api = clientFor(owner.ctx.authUser);
    const made = await api.invite.createLink({ groupId: group.id, role: "viewer" });
    await admin.api.admin.settings.set({ key: "signup.linkInvites", value: false, reason: "Abuse" });

    expect(await codeOf(api.invite.createLink({ groupId: group.id, role: "viewer" }))).toBe(
      "FORBIDDEN:settings:signupClosed",
    );
    expect(await anonymous.invite.preview({ token: made.token })).toEqual({ state: "unavailable" });
    const joiner = await createUser("set-joiner");
    expect(
      await codeOf(clientFor(joiner.ctx.authUser).invite.accept({ token: made.token, consent: true })),
    ).toBe("FORBIDDEN:settings:signupClosed");
    expect(await api.invite.options({ groupId: group.id })).toMatchObject({
      linkInvites: false,
      emailInvites: true,
    });
    // Email invites are a separate switch.
    expect(
      await codeOf(
        api.invite.createEmail({
          groupId: group.id,
          email: newAddress("inv"),
          role: "viewer",
          attested: true,
        }),
      ),
    ).toBe("ok");
  });

  it("refuses new email invites while they're off", async () => {
    const { admin } = await staff();
    const owner = await createUser("set-owner-e");
    const { group } = await createGroup(owner);
    const api = clientFor(owner.ctx.authUser);
    await admin.api.admin.settings.set({ key: "signup.emailInvites", value: false, reason: "Abuse" });
    expect(
      await codeOf(
        api.invite.createEmail({
          groupId: group.id,
          email: newAddress("inv"),
          role: "viewer",
          attested: true,
        }),
      ),
    ).toBe("FORBIDDEN:settings:signupClosed");
    expect(await codeOf(api.invite.createLink({ groupId: group.id, role: "viewer" }))).toBe("ok");
  });

  it("still lets staff invite an owner while email invites are off (B-106)", async () => {
    const { admin } = await staff();
    const owner = await createUser("set-owner-s");
    const { group } = await createGroup(owner);
    await admin.api.admin.settings.set({ key: "signup.emailInvites", value: false, reason: "Abuse" });
    const ownerInvitesTo = (email: string) =>
      getDb().query.notificationOutboxSchema.findMany({
        where: (t, { and, eq }) => and(eq(t.recipient, email), eq(t.name, "ownerInvite")),
      });

    // A member's email invite is still refused.
    expect(
      await codeOf(
        clientFor(owner.ctx.authUser).invite.createEmail({
          groupId: group.id,
          email: newAddress("inv"),
          role: "viewer",
          attested: true,
        }),
      ),
    ).toBe("FORBIDDEN:settings:signupClosed");

    // /admin's owner invite to an existing group.
    const invited = newAddress("staff-owner");
    const sent = await admin.api.admin.groups.inviteOwner({
      groupId: group.id,
      email: invited,
      reason: "Only owner left",
    });
    expect(sent.email).toBe(invited);
    expect(await ownerInvitesTo(invited)).toHaveLength(1);
    const invite = await getDb().query.careGroupInviteSchema.findFirst({
      where: (t, { eq }) => eq(t.id, sent.inviteId),
    });
    expect(invite).toMatchObject({ role: "owner", status: "pending", kind: "email" });

    // A new group with an owner invite.
    const ownerEmail = newAddress("staff-new");
    const created = await admin.api.admin.careGroup.createWithOwnerInvite({
      groupName: `Switch-off group ${randomUUID().slice(0, 6)}`,
      recipientName: "Lou Example",
      ownerEmail,
      attested: true,
    });
    expect(created.groupId).toBeTruthy();
    expect(await ownerInvitesTo(ownerEmail)).toHaveLength(1);
  });
});

describe("invite link limits", () => {
  const days = (iso: string) => Math.round((Date.parse(iso) - Date.now()) / (24 * 60 * 60 * 1000));

  it("caps a link's days and uses at the settings, and uses their default", async () => {
    const { admin } = await staff();
    const owner = await createUser("set-owner-l");
    const { group } = await createGroup(owner);
    const api = clientFor(owner.ctx.authUser);
    const set = (key: string, value: number) =>
      admin.api.admin.settings.set({ key, value, reason: "Tighten" });
    await set("invites.linkMaxDays", 10);
    await set("invites.linkDefaultDays", 14);
    await set("invites.linkMaxUses", 3);

    try {
      await api.invite.createLink({ groupId: group.id, role: "viewer", expiresInDays: 11 });
      expect.unreachable();
    } catch (e) {
      const err = e as ORPCError<string, { code: string; issues: { path: string; message: string }[] }>;
      expect(err.data).toMatchObject({
        code: "careGroupInviteService:linkTooLong",
        issues: [{ path: "expiresInDays", message: "At most 10 days" }],
      });
    }
    expect(
      await codeOf(
        api.invite.createLink({ groupId: group.id, role: "viewer", expiresInDays: 5, maxUses: 4 }),
      ),
    ).toBe("BAD_REQUEST:careGroupInviteService:tooManyUses");
    // No days given: the default, never past the longest.
    const made = await api.invite.createLink({ groupId: group.id, role: "viewer" });
    expect(days(made.invite.expiresAt)).toBe(10);
    expect(await api.invite.options({ groupId: group.id })).toEqual({
      emailInvites: true,
      linkInvites: true,
      link: { defaultDays: 10, maxDays: 10, maxUses: 3 },
    });
  });
});

describe("public forms' rate", () => {
  it("follows publicForms.perMinute", async () => {
    const { admin } = await staff();
    await admin.api.admin.settings.set({ key: "publicForms.perMinute", value: 2, reason: "Spam" });
    resetPublicFormLimits();
    const visitor = clientFor(null, "198.51.100.77");
    const join = () =>
      visitor.public.waitlist.join({ email: newAddress("rate"), elapsedMs: MIN_FORM_MS + 1000 });
    expect(await codeOf(join())).toBe("ok");
    expect(await codeOf(join())).toBe("ok");
    expect(await codeOf(join())).toMatch(/^TOO_MANY_REQUESTS/);
    resetPublicFormLimits();
  });
});
