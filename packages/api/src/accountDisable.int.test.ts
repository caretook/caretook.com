import type { AuthUser } from "@caretook/data";

import { adminAuditLogModel, getDb, isError, SYSTEM_USER } from "@caretook/data";
import { createRouterClient, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { createUser } from "../../data/test/fixtures";
import { router } from ".";

// admin.users.disable, enable and setRole (admin slice 3): admins only, a
// reason each, and the staff rules' refusals with their messages. What a
// disabled account can't do is in packages/auth's disabled.int.test.ts,
// and the guards in packages/data's accountAdmin.int.test.ts.

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

const query = async <T extends object>(text: string, values: unknown[] = []) =>
  (await getDb().$client.query<T>(text, values)).rows;

const auditActions = async (userId: string) => {
  const res = await adminAuditLogModel.search({
    authUser: SYSTEM_USER,
    filter: { target: userId },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(res)) throw new Error(String(res.code));
  return res.data.map((e) => e.action).sort();
};

describe("admin.users.disable, enable and setRole", () => {
  it("are for admins: support and members get a 403, and nothing changes", async () => {
    const target = await createUser("dsb-403");
    const input = { userId: target.user.id, reason: "Because" };
    for (const role of ["support", "member"] as const) {
      const actor = clientFor((await createUser(`dsb-403-${role}`, role)).ctx.authUser);
      expect(await codeOf(actor.admin.users.disable(input))).toBe("FORBIDDEN");
      expect(await codeOf(actor.admin.users.enable(input))).toBe("FORBIDDEN");
      expect(await codeOf(actor.admin.users.setRole({ ...input, role: "admin" }))).toBe("FORBIDDEN");
    }
    expect(await query(`select disabled_at, role from "user" where id = $1`, [target.user.id])).toEqual([
      { disabled_at: null, role: "member" },
    ]);
    expect(await auditActions(target.user.id)).toEqual([]);
  });

  it("change a staff role, and refuse your own, with the staff rules' messages", async () => {
    const admin = await createUser("dsb-role-admin", "admin");
    const staff = clientFor(admin.ctx.authUser);
    const target = await createUser("dsb-role");
    expect(
      await staff.admin.users.setRole({ userId: target.user.id, role: "support", reason: "Hired" }),
    ).toEqual({
      role: "support",
    });
    const page = await staff.admin.users.get({ userId: target.user.id });
    expect(page.account.role).toBe("support");

    for (const call of [
      () => staff.admin.users.setRole({ userId: admin.user.id, role: "member", reason: "Oops" }),
      () => staff.admin.users.disable({ userId: admin.user.id, reason: "Oops" }),
    ]) {
      const error = await call().then(
        () => null,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(ORPCError);
      expect(error).toMatchObject({ code: "CONFLICT", message: "You can't do that to your own account." });
    }
    expect(await codeOf(staff.admin.users.setRole({ userId: target.user.id, role: "", reason: "x" }))).toBe(
      "BAD_REQUEST",
    );
    expect(await codeOf(staff.admin.users.disable({ userId: target.user.id, reason: "" }))).toBe(
      "BAD_REQUEST",
    );
  });
});
