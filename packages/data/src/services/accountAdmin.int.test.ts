import type { Tx } from "../db";

import { and, eq, isNull, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok, system } from "../../test/fixtures";
import { getDb } from "../db";
import {
  adminAuditLogSchema,
  careGroupMemberSchema,
  sessionSchema,
  STAFF_REFUSAL_MESSAGES,
  userSchema,
  verificationSchema,
} from "../db/schema";
import { ERRORS, isError } from "../errors";
import { accountAdminService } from ".";

// Disabling, re-enabling and staff roles (admin slice 3), at the service:
// the guards (not yourself, never the last admin), sessions and pending
// links going with a disable in one transaction, and the audit entries.
// Sign-in itself is refused in packages/auth (see the api package's
// accountDisable.int.test.ts).

const entriesFor = (userId: string) =>
  getDb().select().from(adminAuditLogSchema).where(eq(adminAuditLogSchema.targetUserId, userId));

const codeOf = (value: unknown) => (isError(value) ? value.code : "ok");

const addSession = (userId: string) =>
  getDb()
    .insert(sessionSchema)
    .values({ userId, token: randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) });

const sessionsOf = (userId: string) =>
  getDb().select({ id: sessionSchema.id }).from(sessionSchema).where(eq(sessionSchema.userId, userId));

const userRow = async (userId: string) =>
  (await getDb().select().from(userSchema).where(eq(userSchema.id, userId)))[0]!;

class Rollback extends Error {}

/** Run `fn` in a transaction where `onlyAdminId` is the only enabled admin, then roll it all back. */
const withOnlyAdmin = async (onlyAdminId: string, fn: (tx: Tx) => Promise<void>) => {
  await getDb()
    .transaction(async (tx) => {
      await tx
        .update(userSchema)
        .set({ role: "member" })
        .where(and(eq(userSchema.role, "admin"), ne(userSchema.id, onlyAdminId)));
      await fn(tx);
      throw new Rollback();
    })
    .catch((e: unknown) => {
      if (!(e instanceof Rollback)) throw e;
    });
};

describe("accountAdminService.disable and enable", () => {
  it("disables an account: who, when and why, every session gone, one audit entry", async () => {
    const admin = await createUser("dis-admin", "admin");
    const target = await createUser("dis-target");
    const { group } = await createGroup(target);
    await addSession(target.user.id);
    await addSession(target.user.id);

    expect(
      ok(await accountAdminService.disable(admin.ctx, { userId: target.user.id, reason: " Abuse " })),
    ).toEqual({ revoked: 2 });
    const row = await userRow(target.user.id);
    expect(row.disabledAt).toBeTruthy();
    expect(row).toMatchObject({ disabledBy: admin.user.id, disabledReason: "Abuse" });
    expect(await sessionsOf(target.user.id)).toHaveLength(0);
    const [entry, ...rest] = await entriesFor(target.user.id);
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      actorId: admin.user.id,
      action: "user.disable",
      reason: "Abuse",
      changes: { disabled: [false, true], sessions: [2, 0] },
    });

    // A second disable is refused; memberships stay; re-enabling clears it.
    expect(
      codeOf(await accountAdminService.disable(admin.ctx, { userId: target.user.id, reason: "x" })),
    ).toBe("accountAdmin:alreadyDisabled");
    const memberships = await getDb()
      .select()
      .from(careGroupMemberSchema)
      .where(eq(careGroupMemberSchema.userId, target.user.id));
    expect(memberships.map((m) => m.groupId)).toEqual([group.id]);

    ok(await accountAdminService.enable(admin.ctx, { userId: target.user.id, reason: "Resolved" }));
    expect(await userRow(target.user.id)).toMatchObject({
      disabledAt: null,
      disabledBy: null,
      disabledReason: null,
    });
    expect((await entriesFor(target.user.id)).map((e) => e.action).sort()).toEqual([
      "user.disable",
      "user.enable",
    ]);
    expect(codeOf(await accountAdminService.enable(admin.ctx, { userId: target.user.id, reason: "x" }))).toBe(
      "accountAdmin:notDisabled",
    );
  });

  it("voids the account's pending sign-in codes, links and reset links, and nobody else's", async () => {
    const admin = await createUser("dis-links-admin", "admin");
    const target = await createUser("dis-links");
    const other = await createUser("dis-links-other");
    const expiresAt = new Date(Date.now() + 300_000);
    const rows = (email: string, userId: string) => [
      { identifier: `sign-in-otp-${email}`, value: "hashed:1", expiresAt },
      {
        identifier: `magic-link:${randomUUID()}`,
        value: JSON.stringify({ type: "magic-link", email }),
        expiresAt,
      },
      { identifier: `reset-password:${randomUUID()}`, value: userId, expiresAt },
    ];
    await getDb()
      .insert(verificationSchema)
      .values([...rows(target.user.email, target.user.id), ...rows(other.user.email, other.user.id)]);

    ok(await accountAdminService.disable(admin.ctx, { userId: target.user.id, reason: "Compromised" }));
    const left = await getDb().select({ value: verificationSchema.value }).from(verificationSchema);
    const values = left.map((r) => r.value);
    expect(values.filter((v) => v.includes(target.user.email) || v === target.user.id)).toEqual([]);
    expect(values.filter((v) => v.includes(other.user.email) || v === other.user.id)).toHaveLength(2);
  });

  it("refuses disabling yourself and the last admin, and records nothing", async () => {
    const admin = await createUser("dis-self", "admin");
    expect(codeOf(await accountAdminService.disable(admin.ctx, { userId: admin.user.id, reason: "x" }))).toBe(
      "accountAdmin:self",
    );
    await withOnlyAdmin(admin.user.id, async (tx) => {
      const res = await accountAdminService.disable(
        { ...system, tx },
        { userId: admin.user.id, reason: "Leaving" },
      );
      expect(codeOf(res)).toBe("accountAdmin:lastAdmin");
    });
    // With another enabled admin, the system may.
    await createUser("dis-self-other", "admin");
    ok(await accountAdminService.disable(system, { userId: admin.user.id, reason: "Left the company" }));
    const [entry] = await entriesFor(admin.user.id);
    expect(entry).toMatchObject({ actorId: null, action: "user.disable" });
    expect((await userRow(admin.user.id)).disabledBy).toBeNull();
  });

  it("refuses support, members and an action without a reason", async () => {
    const support = await createUser("dis-support", "support");
    const member = await createUser("dis-member");
    const admin = await createUser("dis-admin-2", "admin");
    const target = await createUser("dis-target-2");
    const input = { userId: target.user.id, reason: "Because" };
    for (const actor of [support, member]) {
      expect(codeOf(await accountAdminService.disable(actor.ctx, input))).toBe("staff:notAllowed");
      expect(codeOf(await accountAdminService.enable(actor.ctx, input))).toBe("staff:notAllowed");
      expect(codeOf(await accountAdminService.setRole(actor.ctx, { ...input, role: "support" }))).toBe(
        "staff:notAllowed",
      );
    }
    for (const reason of ["", "   ", "x".repeat(501)]) {
      expect(codeOf(await accountAdminService.disable(admin.ctx, { ...input, reason }))).toBe(
        "accountAdmin:invalid",
      );
    }
    expect((await userRow(target.user.id)).disabledAt).toBeNull();
    expect(await entriesFor(target.user.id)).toHaveLength(0);
  });

  it("refuses help emails for a disabled account", async () => {
    const admin = await createUser("dis-help-admin", "admin");
    const target = await createUser("dis-help");
    ok(await accountAdminService.disable(admin.ctx, { userId: target.user.id, reason: "Abuse" }));
    const sent: string[] = [];
    const mail = {
      verification: () => (sent.push("verification"), Promise.resolve({ id: randomUUID() })),
      reset: () => (sent.push("reset"), Promise.resolve({ id: randomUUID() })),
    };
    const input = { userId: target.user.id, reason: "Asked by phone" };
    expect(codeOf(await accountAdminService.resendVerification(admin.ctx, input, { mail }))).toBe(
      "accountAdmin:disabled",
    );
    expect(codeOf(await accountAdminService.sendReset(admin.ctx, input, { mail }))).toBe(
      "accountAdmin:disabled",
    );
    expect(sent).toEqual([]);
  });
});

describe("accountAdminService.setRole", () => {
  it("makes an account support, admin and a member again, each with an audit entry", async () => {
    const admin = await createUser("role-admin", "admin");
    const target = await createUser("role-target");
    // Each call's entry is the one it added. Not sorted by `createdAt`: it
    // keeps milliseconds, and back-to-back calls can share one (B-778).
    const seen = new Set<string>();
    const set = async (role: string) => {
      const res = ok(
        await accountAdminService.setRole(admin.ctx, {
          userId: target.user.id,
          role,
          reason: "Joined the team",
        }),
      );
      const added = (await entriesFor(target.user.id)).filter((e) => !seen.has(e.id));
      for (const e of added) seen.add(e.id);
      return { res, added: added.map((e) => [e.action, e.actorId, e.changes]) };
    };

    expect(await set("support")).toEqual({
      res: { role: "support" },
      added: [["user.setRole", admin.user.id, { role: ["member", "support"] }]],
    });
    expect(await set("admin")).toEqual({
      res: { role: "admin" },
      added: [["user.setRole", admin.user.id, { role: ["support", "admin"] }]],
    });
    expect(await set("member")).toEqual({
      res: { role: "member" },
      added: [["user.setRole", admin.user.id, { role: ["admin", "member"] }]],
    });
    expect((await userRow(target.user.id)).role).toBe("member");
    expect(await entriesFor(target.user.id)).toHaveLength(3);
  });

  it("refuses your own role, an unknown or unchanged role, and the last admin", async () => {
    const admin = await createUser("role-self", "admin");
    const target = await createUser("role-guard");
    const set = (ctx: Parameters<typeof accountAdminService.setRole>[0], userId: string, role: string) =>
      accountAdminService.setRole(ctx, { userId, role, reason: "Testing" });

    expect(codeOf(await set(admin.ctx, admin.user.id, "member"))).toBe("accountAdmin:self");
    expect(codeOf(await set(admin.ctx, target.user.id, "member"))).toBe("accountAdmin:unchanged");
    const unknown = await set(admin.ctx, target.user.id, "owner");
    expect(codeOf(unknown)).toBe("accountAdmin:unknownRole");
    expect(isError(unknown) && unknown.meta).toMatchObject({ issues: [{ path: "role" }] });
    await withOnlyAdmin(admin.user.id, async (tx) => {
      expect(codeOf(await set({ ...system, tx }, admin.user.id, "support"))).toBe("accountAdmin:lastAdmin");
    });
    expect(await entriesFor(admin.user.id)).toHaveLength(0);
    expect(await entriesFor(target.user.id)).toHaveLength(0);
  });

  it("lets the last enabled admin demote a disabled admin", async () => {
    const admin = await createUser("role-only", "admin");
    const disabled = await createUser("role-disabled-admin", "admin");
    ok(await accountAdminService.disable(admin.ctx, { userId: disabled.user.id, reason: "On leave" }));
    await withOnlyAdmin(admin.user.id, async (tx) => {
      await tx.update(userSchema).set({ role: "admin" }).where(eq(userSchema.id, disabled.user.id));
      const enabledAdmins = await tx
        .select({ id: userSchema.id })
        .from(userSchema)
        .where(and(eq(userSchema.role, "admin"), isNull(userSchema.disabledAt)));
      expect(enabledAdmins.map((u) => u.id)).toEqual([admin.user.id]);
      const res = await accountAdminService.setRole(
        { authUser: admin.ctx.authUser, tx },
        { userId: disabled.user.id, role: "member", reason: "Left" },
      );
      expect(res).toEqual({ role: "member" });
    });
  });
});

describe("the refusal messages", () => {
  it("are the staff rules' messages", () => {
    for (const refusal of ["self", "lastAdmin", "unknownRole", "unchanged"] as const) {
      expect(ERRORS[`accountAdmin:${refusal}`].message).toBe(STAFF_REFUSAL_MESSAGES[refusal]);
    }
  });
});
