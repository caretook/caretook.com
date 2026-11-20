import type { AuthUser } from "@caretook/data";

import { getAuth } from "@caretook/auth";
import {
  adminAuditLogModel,
  getDb,
  isError,
  notificationOutboxSchema,
  sessionSchema,
  SYSTEM_USER,
} from "@caretook/data";
import { setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../../data/test/fixtures";
import { router } from "..";

// Staff account help (admin slice 2): search, an account's page, and the
// help actions (resend verification, send a reset, sign sessions out), each
// with a reason and one audit entry in its own transaction.

const clientFor = (authUser: AuthUser | null) => createRouterClient(router, { context: { authUser } });

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "ok";
  } catch (e) {
    if (e instanceof ORPCError) return String(e.code);
    throw e;
  }
};

// Emails are delivered in the background: collect that work so tests can wait for it.
const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));
const settle = async () => {
  while (pending.length) await Promise.allSettled(pending.splice(0));
};
const mailTo = async (to: string, name: string) => {
  await settle();
  return sharedMemorySender().sent.filter((m) => m.to === to && m.name === name);
};
const tokenIn = (text: string, path: string) => {
  const match = text.match(new RegExp(`https?://[^\\s]+${path.replaceAll("/", "\\/")}\\?[^\\s]+`));
  if (!match) throw new Error(`No ${path} link in: ${text}`);
  return new URL(match[0]).searchParams.get("token") ?? "";
};

const auditFor = async (targetUserId: string) => {
  await settle();
  const res = await adminAuditLogModel.search({
    authUser: SYSTEM_USER,
    filter: { target: targetUserId },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(res)) throw new Error(String(res.code));
  return res.data;
};

/** Signed-in sessions for `userId`, as Better Auth would store them. */
const addSessions = async (userId: string, agents: string[]) => {
  const rows = await getDb()
    .insert(sessionSchema)
    .values(
      agents.map((userAgent) => ({
        userId,
        token: randomUUID(),
        userAgent,
        ipAddress: "203.0.113.7",
        expiresAt: new Date(Date.now() + 86_400_000),
      })),
    )
    .returning({ id: sessionSchema.id });
  return rows.map((r) => r.id);
};

/** Plain SQL on the test database (this package doesn't depend on drizzle-orm). */
const query = async <T extends object>(text: string, values: unknown[] = []) =>
  (await getDb().$client.query<T>(text, values)).rows;

const sessionCount = async (userId: string) =>
  (await query<{ id: string }>(`select id from session where user_id = $1`, [userId])).length;

/** Every column name of the care tables a staff page must never carry (beyond the recipient's names). */
const careColumns = async () => {
  const rows = await query<{ column_name: string }>(`
    select distinct column_name from information_schema.columns
    where table_name in ('timeline_entry', 'note_document', 'note_update', 'provider', 'medication',
      'care_period', 'care_recipient_details')
      and column_name not in ('id', 'group_id', 'recipient_id', 'created_at', 'updated_at', 'created_by',
        'updated_by', 'deleted_at', 'name', 'status', 'type', 'email')`);
  return rows.map((r) => r.column_name);
};

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Every key anywhere in `value`. */
const keysOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(keysOf)
    : value && typeof value === "object"
      ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)])
      : [];

describe("admin.users.search", () => {
  it("matches part of a name or email, newest first, a page at a time", async () => {
    const support = await createUser("usr-support", "support");
    const api = clientFor(support.ctx.authUser);
    const tag = `srch${randomUUID().slice(0, 6)}`;
    const made = [];
    for (let i = 0; i < 3; i++) {
      made.push(await createUser(`${tag}-${i}`));
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const all = await api.admin.users.search({ q: tag.toUpperCase() });
    expect(all.count).toBe(3);
    expect(all.users.map((u) => u.id)).toEqual(made.map((m) => m.user.id).reverse());
    expect(all.users[0]).toMatchObject({ emailVerified: false, role: "member", disabled: false });

    // Part of the email only (the name is the label, the email adds a suffix).
    const suffix = made[1]!.user.email.split("-").at(-1)!.split("@")[0]!;
    expect((await api.admin.users.search({ q: suffix })).users.map((u) => u.id)).toEqual([made[1]!.user.id]);

    // `%` and `_` match only themselves.
    expect((await api.admin.users.search({ q: "%" })).count).toBe(0);

    const total = (await api.admin.users.search({})).count;
    expect(total).toBeGreaterThanOrEqual(3);
    const second = await api.admin.users.search({ page: 2 });
    expect(second.page).toBe(2);
    expect(second.users.length).toBe(Math.max(0, Math.min(50, total - 50)));
  });
});

describe("admin.users.get", () => {
  it("shows the account, its sessions, groups and mail, and nothing from the care tables", async () => {
    const support = await createUser("usr-get-support", "support");
    const owner = await createUser("usr-get-owner");
    const target = await createUser("usr-get-target");
    const { group } = await createGroup(owner, [{ user: target.user, role: "caretaker" }]);
    await query(`update care_group_member set invited_by = $1 where user_id = $2`, [
      owner.user.id,
      target.user.id,
    ]);
    await query(
      `update care_recipient set preferred_name = 'Patty', notes = 'Private note for helpers' where group_id = $1`,
      [group.id],
    );
    await addSessions(target.user.id, ["Mozilla/5.0 (iPhone)", "Mozilla/5.0 (Macintosh)"]);
    await getDb()
      .insert(notificationOutboxSchema)
      .values({
        name: "resetPassword",
        recipient: target.user.email.toUpperCase(),
        subject: "Reset",
        html: "<p>secret body</p>",
        text: "secret body with a token",
        idempotencyKey: `test:${randomUUID()}`,
        status: "failed",
        attempts: 8,
        lastError: `validation_error: ${target.user.email} is not allowed`,
        createdBy: SYSTEM_USER.id,
        updatedBy: SYSTEM_USER.id,
      });

    const page = await clientFor(support.ctx.authUser).admin.users.get({ userId: target.user.id });
    expect(page.account).toMatchObject({ id: target.user.id, email: target.user.email, role: "member" });
    expect(page.signIn).toMatchObject({ password: false, emailed: true });
    expect(page.signIn.lastSignInAt).not.toBeNull();
    expect(page.sessions).toHaveLength(2);
    expect(page.sessions[0]).not.toHaveProperty("token");
    expect(page.groups).toEqual([
      expect.objectContaining({
        groupId: group.id,
        displayName: "Patty",
        role: "caretaker",
        invitedBy: { id: owner.user.id, name: owner.user.name, email: owner.user.email },
      }),
    ]);
    expect(page.mail).toEqual([
      expect.objectContaining({ template: "resetPassword", status: "failed", attempts: 8 }),
    ]);
    expect(page.mail[0]?.errorCode).toBe("validation_error");

    const text = JSON.stringify(page);
    expect(text).not.toContain("secret body");
    expect(text).not.toContain("Private note");
    expect(text).not.toContain("is not allowed");
    const forbidden = (await careColumns()).flatMap((c) => [c, camel(c)]);
    expect(keysOf(page).filter((k) => forbidden.includes(k))).toEqual([]);

    // Opening the page is recorded (in the background).
    const views = (await auditFor(target.user.id)).filter((e) => e.action === "user.view");
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ actorId: support.user.id });
  });

  it("is a 404 for an unknown account", async () => {
    const admin = await createUser("usr-get-404", "admin");
    expect(await codeOf(clientFor(admin.ctx.authUser).admin.users.get({ userId: randomUUID() }))).toBe(
      "NOT_FOUND",
    );
  });
});

describe("the help actions", () => {
  it("resends verification: one email, one audit entry, and the link confirms the address", async () => {
    const support = await createUser("usr-verify-support", "support");
    const target = await createUser("usr-verify");
    const api = clientFor(support.ctx.authUser);
    await api.admin.users.resendVerification({ userId: target.user.id, reason: "Lost the first email" });

    const mail = await mailTo(target.user.email, "verifyEmail");
    expect(mail).toHaveLength(1);
    const entries = (await auditFor(target.user.id)).filter((e) => e.action === "user.resendVerification");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actorId: support.user.id, reason: "Lost the first email" });

    const verified = await getAuth().api.verifyEmail({
      query: { token: tokenIn(mail[0]!.text, "/verify-email") },
      asResponse: true,
    });
    expect(verified.status).toBe(200);
    expect(
      await codeOf(api.admin.users.resendVerification({ userId: target.user.id, reason: "Again" })),
    ).toBe("CONFLICT");
  });

  it("sends a reset: one email, one audit entry, and the link sets a password", async () => {
    const support = await createUser("usr-reset-support", "support");
    const target = await createUser("usr-reset");
    await clientFor(support.ctx.authUser).admin.users.sendReset({
      userId: target.user.id,
      reason: "Locked out, called support",
    });

    const mail = await mailTo(target.user.email, "resetPassword");
    expect(mail).toHaveLength(1);
    expect((await auditFor(target.user.id)).filter((e) => e.action === "user.sendReset")).toHaveLength(1);

    const res = await getAuth().api.resetPassword({
      body: { token: tokenIn(mail[0]!.text, "/reset-password"), newPassword: "a staff-sent new passphrase" },
      asResponse: true,
    });
    expect(res.status).toBe(200);
  });

  it("signs one session out and leaves the others, or signs them all out", async () => {
    const support = await createUser("usr-sess-support", "support");
    const target = await createUser("usr-sess");
    const api = clientFor(support.ctx.authUser);
    const [first, second] = await addSessions(target.user.id, ["Phone", "Laptop", "Tablet"]);

    await api.admin.users.revokeSession({ userId: target.user.id, sessionId: first!, reason: "Lost phone" });
    expect(await sessionCount(target.user.id)).toBe(2);
    expect(
      await codeOf(
        api.admin.users.revokeSession({ userId: target.user.id, sessionId: first!, reason: "Again" }),
      ),
    ).toBe("NOT_FOUND");
    // Another account's session can't be named through this one.
    const other = await createUser("usr-sess-other");
    expect(
      await codeOf(
        api.admin.users.revokeSession({ userId: other.user.id, sessionId: second!, reason: "No" }),
      ),
    ).toBe("NOT_FOUND");
    expect(await sessionCount(target.user.id)).toBe(2);

    expect(
      await api.admin.users.revokeAllSessions({ userId: target.user.id, reason: "Shared computer" }),
    ).toEqual({ revoked: 2 });
    expect(await sessionCount(target.user.id)).toBe(0);

    const actions = (await auditFor(target.user.id)).map((e) => e.action).sort();
    expect(actions).toEqual(["user.revokeAllSessions", "user.revokeSession"]);
  });

  it("refuses every action without a reason, and records nothing", async () => {
    const admin = await createUser("usr-noreason", "admin");
    const target = await createUser("usr-noreason-target");
    const api = clientFor(admin.ctx.authUser);
    const [sessionId] = await addSessions(target.user.id, ["Phone"]);
    const userId = target.user.id;
    for (const reason of [undefined, "", "   ", "x".repeat(501)]) {
      const input = { userId, reason } as { userId: string; reason: string };
      expect(await codeOf(api.admin.users.resendVerification(input))).toBe("BAD_REQUEST");
      expect(await codeOf(api.admin.users.sendReset(input))).toBe("BAD_REQUEST");
      expect(await codeOf(api.admin.users.revokeSession({ ...input, sessionId: sessionId! }))).toBe(
        "BAD_REQUEST",
      );
      expect(await codeOf(api.admin.users.revokeAllSessions(input))).toBe("BAD_REQUEST");
    }
    expect(await sessionCount(userId)).toBe(1);
    expect(await mailTo(target.user.email, "resetPassword")).toHaveLength(0);
    expect(await auditFor(userId)).toHaveLength(0);
  });

  it("refuses members everything, and lets support do each action", async () => {
    const member = await createUser("usr-member");
    const target = await createUser("usr-member-target");
    const api = clientFor(member.ctx.authUser);
    const help = { userId: target.user.id, reason: "Because" };
    expect(await codeOf(api.admin.users.search({}))).toBe("FORBIDDEN");
    expect(await codeOf(api.admin.users.get({ userId: target.user.id }))).toBe("FORBIDDEN");
    expect(await codeOf(api.admin.users.sendReset(help))).toBe("FORBIDDEN");
    expect(await codeOf(api.admin.users.revokeAllSessions(help))).toBe("FORBIDDEN");
    expect(await auditFor(target.user.id)).toHaveLength(0);
    // Support: covered action by action above (each test's actor is support).
  });
});
