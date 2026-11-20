import type { AuthUser } from "@caretook/data";

import {
  accessCodeModel,
  adminAuditLogModel,
  adminAuditService,
  baseModel,
  isError,
  SYSTEM_USER,
  withTransaction,
} from "@caretook/data";
import { call, createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createUser } from "../../../data/test/fixtures";
import { router } from "..";
import { staffProcedure } from "../procedures";

// Staff roles (admin slice 1): staffProcedure and the capability table, the
// admin router for admin, support and members, and the audit log written in
// each staff write's own transaction.

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

/** Every procedure path under `router.admin`, e.g. ["accessCode", "create"]. */
const procedurePaths = (node: object, prefix: string[] = []): string[][] =>
  Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === "object" && "~orpc" in value
      ? [[...prefix, key]]
      : value && typeof value === "object"
        ? procedurePaths(value as object, [...prefix, key])
        : [],
  );

const callPath = (client: unknown, path: string[], input: unknown) => {
  let fn: unknown = client;
  for (const key of ["admin", ...path]) fn = (fn as Record<string, unknown>)[key];
  return (fn as (input: unknown) => Promise<unknown>)(input);
};

/** Every entry matching `filter`, read as the system. */
const auditEntries = async (filter: Parameters<typeof adminAuditLogModel.search>[0]["filter"]) => {
  const res = await adminAuditLogModel.search({
    authUser: SYSTEM_USER,
    filter,
    paginate: { page: 1, limit: 500 },
  });
  if (isError(res)) throw new Error(String(res.code));
  return res.data;
};

const auditRows = async (where: { action: "accessCode.create" | "accessCode.revoke"; label: string }) =>
  (await auditEntries({ action: where.action })).filter((r) =>
    JSON.stringify(r.changes).includes(where.label),
  );

describe("staffProcedure", () => {
  it("lets each role through only with the capability", async () => {
    const admin = await createUser("cap-admin", "admin");
    const support = await createUser("cap-support", "support");
    const member = await createUser("cap-member");
    const write = staffProcedure("settings.write").handler(() => "done");
    const read = staffProcedure("settings.read").handler(() => "done");
    const run = (proc: typeof write, who: { ctx: { authUser: AuthUser } }) =>
      codeOf(call(proc, undefined, { context: { authUser: who.ctx.authUser } }));

    expect(await run(write, admin)).toBe("ok");
    expect(await run(write, support)).toBe("FORBIDDEN");
    expect(await run(read, support)).toBe("ok");
    expect(await run(read, member)).toBe("FORBIDDEN");
    expect(await codeOf(call(read, undefined, { context: { authUser: null } }))).toBe("UNAUTHORIZED");
  });
});

describe("the admin router", () => {
  const paths = procedurePaths(router.admin);

  it("has the procedures this slice moved onto staffProcedure", () => {
    expect(paths.map((p) => p.join("."))).toEqual(
      expect.arrayContaining([
        "accessCode.list",
        "accessCode.create",
        "accessCode.revoke",
        "careGroup.createWithOwnerInvite",
        "waitlist.list",
        "waitlist.export",
        "audit.list",
      ]),
    );
  });

  it("refuses a member every admin procedure (a 403), and anyone signed out (a 401)", async () => {
    const member = await createUser("adm-member");
    for (const path of paths) {
      expect([path.join("."), await codeOf(callPath(clientFor(member.ctx.authUser), path, {}))]).toEqual([
        path.join("."),
        "FORBIDDEN",
      ]);
      expect(await codeOf(callPath(clientFor(null), path, {}))).toBe("UNAUTHORIZED");
    }
  });

  it("lets support read and use everything this slice gives it", async () => {
    const support = await createUser("adm-support", "support");
    const api = clientFor(support.ctx.authUser);
    const label = `Support flyer ${randomUUID().slice(0, 8)}`;
    const code = await api.admin.accessCode.create({ label, expiresInDays: 7 });
    expect(code.label).toBe(label);
    expect((await api.admin.accessCode.list()).some((c) => c.id === code.id)).toBe(true);
    expect((await api.admin.accessCode.revoke({ id: code.id })).state).toBe("revoked");
    expect(await codeOf(api.admin.waitlist.list({}))).toBe("ok");
    expect(await codeOf(api.admin.waitlist.export({}))).toBe("ok");
    expect(await codeOf(api.admin.audit.list({}))).toBe("ok");
    const group = await api.admin.careGroup.createWithOwnerInvite({
      groupName: `ADM support ${randomUUID().slice(0, 6)}`,
      recipientName: "Lou Example",
      ownerEmail: `adm-owner-${randomUUID().slice(0, 8)}@example.com`,
      attested: true,
    });
    expect(group.groupId).toBeTruthy();
  });
});

describe("the audit log", () => {
  it("records creating and revoking a code, once each, naming the actor", async () => {
    const support = await createUser("aud-support", "support");
    const api = clientFor(support.ctx.authUser);
    const label = `Audit flyer ${randomUUID().slice(0, 8)}`;
    const code = await api.admin.accessCode.create({ label, expiresInDays: 30, maxUses: 5 });

    const created = await auditRows({ action: "accessCode.create", label });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ actorId: support.user.id, targetUserId: null, targetGroupId: null });
    expect(created[0]?.changes).toMatchObject({
      code: [null, code.code],
      label: [null, label],
      maxUses: [null, 5],
    });

    await api.admin.accessCode.revoke({ id: code.id });
    await api.admin.accessCode.revoke({ id: code.id }); // already revoked: no second entry
    const revoked = await auditRows({ action: "accessCode.revoke", label: code.code });
    expect(revoked).toHaveLength(1);
    expect(revoked[0]?.changes.revokedAt?.[0]).toBeNull();

    const listed = await api.admin.audit.list({ actorId: support.user.id });
    expect(listed.entries.map((e) => e.action).sort()).toEqual(["accessCode.create", "accessCode.revoke"]);
    expect(listed.entries[0]?.actor).toMatchObject({ id: support.user.id, email: support.user.email });
    expect(listed.actors.some((a) => a.id === support.user.id)).toBe(true);
    expect(
      (await api.admin.audit.list({ actorId: support.user.id, action: "accessCode.create" })).count,
    ).toBe(1);
    expect(
      (await api.admin.audit.list({ actorId: support.user.id, from: "2001-01-01", to: "2001-01-02" })).count,
    ).toBe(0);
  });

  it("records a staff-made group with its target and nothing about the recipient", async () => {
    const admin = await createUser("aud-admin", "admin");
    const api = clientFor(admin.ctx.authUser);
    const groupName = `ADM group ${randomUUID().slice(0, 6)}`;
    const { groupId } = await api.admin.careGroup.createWithOwnerInvite({
      groupName,
      recipientName: "Pat Private",
      ownerEmail: `adm-owner-${randomUUID().slice(0, 8)}@example.com`,
      attested: true,
    });
    const rows = await auditEntries({ target: groupId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "staffGroup.create", actorId: admin.user.id });
    expect(JSON.stringify(rows[0]?.changes)).not.toContain("Pat Private");
    expect((await api.admin.audit.list({ target: groupName })).entries[0]?.targetGroup).toEqual({
      id: groupId,
      name: groupName,
    });
  });

  it("writes nothing when a call is refused or fails", async () => {
    const member = await createUser("aud-refused");
    const label = `Refused ${randomUUID().slice(0, 8)}`;
    expect(
      await codeOf(clientFor(member.ctx.authUser).admin.accessCode.create({ label, expiresInDays: 1 })),
    ).toBe("FORBIDDEN");
    expect(await auditRows({ action: "accessCode.create", label })).toHaveLength(0);

    const admin = await createUser("aud-missing", "admin");
    expect(await codeOf(clientFor(admin.ctx.authUser).admin.accessCode.revoke({ id: randomUUID() }))).toBe(
      "NOT_FOUND",
    );
    expect((await clientFor(admin.ctx.authUser).admin.audit.list({ actorId: admin.user.id })).count).toBe(0);
  });

  it("rolls the action back when its entry can't be written", async () => {
    // A reason over 500 characters fails the entry's check, inside the transaction.
    const admin = await createUser("aud-rollback", "admin");
    const label = `Rolled back ${randomUUID().slice(0, 8)}`;
    const res = await withTransaction(async (tx) => {
      const created = await accessCodeModel.create({
        authUser: admin.ctx.authUser,
        tx,
        data: {
          code: `ZZZZ-${randomUUID().slice(0, 4).toUpperCase()}-ZZZZ`,
          label,
          expiresAt: new Date().toISOString(),
        },
      });
      if (isError(created)) return created;
      return adminAuditService.record(tx, {
        actorId: admin.user.id,
        action: "accessCode.create",
        reason: "x".repeat(501),
      });
    });
    expect(isError(res)).toBe(true);
    const page = await accessCodeModel.list({ authUser: SYSTEM_USER, paginate: { page: 1, limit: 500 } });
    if (isError(page)) throw new Error(String(page.code));
    expect(page.data.some((c) => c.label === label)).toBe(false);
  });

  it("can't be changed or deleted by anyone, the system included", async () => {
    const admin = await createUser("aud-immutable", "admin");
    const entry = await adminAuditService.record(undefined, { actorId: admin.user.id, action: "user.view" });
    if (isError(entry)) throw new Error(String(entry.code));
    expect("update" in adminAuditLogModel).toBe(false);
    expect("remove" in adminAuditLogModel).toBe(false);
    expect("update" in adminAuditService).toBe(false);
    expect("remove" in adminAuditService).toBe(false);

    const fns = baseModel.getFunctions({
      schemaName: "adminAuditLogSchema",
      dbToModel: (row: unknown) => row,
    });
    const filter = { id: { type: "eq" as const, value: entry.id } };
    for (const authUser of [SYSTEM_USER, admin.ctx.authUser]) {
      expect(isError(await fns.update({ authUser, filter, data: { reason: "edited" } }))).toBe(true);
      expect(isError(await fns.remove({ authUser, filter }))).toBe(true);
    }
    const [row] = (await auditEntries({ actorId: admin.user.id })).filter((e) => e.id === entry.id);
    expect(row?.reason).toBeNull();
  });
});
