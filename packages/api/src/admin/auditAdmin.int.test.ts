import type { AuthUser } from "@caretook/data";

import { adminAuditService, isError } from "@caretook/data";
import { createRouterClient } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createUser } from "../../../data/test/fixtures";
import { router } from "..";
import { AUDIT_PAGE_SIZE } from "./auditAdmin";

// `admin.audit.list` as /admin/audit's loader and the account and group
// pages call it (admin.mjs steps 2 and 5, moved): a target by id or by part
// of an email, pages of 50 newest first, and the actor filter's choices.
// The filters by actor, action and day are in staffAdmin.int.test.ts.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

const record = async (entry: Parameters<typeof adminAuditService.record>[1]) => {
  const res = await adminAuditService.record(undefined, entry);
  if (isError(res)) throw new Error(String(res.code));
};

describe("admin.audit.list for the pages", () => {
  it("finds an account's entries by its id or part of its email, and nobody else's", async () => {
    const support = await createUser("audit-pages-support", "support");
    const tag = randomUUID().slice(0, 8);
    const target = await createUser(`audit-target-${tag}`);
    const other = await createUser(`audit-other-${tag}`);
    await record({ actorId: support.user.id, action: "user.view", targetUserId: target.user.id });
    await record({
      actorId: support.user.id,
      action: "user.sendReset",
      targetUserId: target.user.id,
      reason: "Locked out",
    });
    await record({ actorId: support.user.id, action: "user.view", targetUserId: other.user.id });

    const api = clientFor(support.ctx.authUser);
    const byId = await api.admin.audit.list({ target: target.user.id });
    expect(byId.count).toBe(2);
    expect(byId.entries.map((e) => e.action)).toEqual(["user.sendReset", "user.view"]);
    expect(byId.entries[0]).toMatchObject({
      actor: { id: support.user.id, email: support.user.email },
      targetUser: { id: target.user.id, email: target.user.email },
      reason: "Locked out",
    });

    const byEmail = await api.admin.audit.list({ target: `audit-target-${tag}` });
    expect(byEmail.entries.map((e) => e.targetUser?.id)).toEqual([target.user.id, target.user.id]);
    expect(byId.actors.some((a) => a.id === support.user.id)).toBe(true);
  });

  it("pages 50 at a time, newest first, with the total", async () => {
    const admin = await createUser("audit-pages-admin", "admin");
    const target = await createUser("audit-paged");
    for (let i = 0; i < AUDIT_PAGE_SIZE + 3; i++)
      await record({ actorId: admin.user.id, action: "user.view", targetUserId: target.user.id });

    const api = clientFor(admin.ctx.authUser);
    const first = await api.admin.audit.list({ actorId: admin.user.id });
    expect(first).toMatchObject({ count: AUDIT_PAGE_SIZE + 3, page: 1, pageSize: AUDIT_PAGE_SIZE });
    expect(first.entries).toHaveLength(AUDIT_PAGE_SIZE);
    const times = first.entries.map((e) => e.createdAt);
    expect([...times].sort().reverse()).toEqual(times);

    const second = await api.admin.audit.list({ actorId: admin.user.id, page: 2 });
    expect(second.entries).toHaveLength(3);
    const ids = new Set(first.entries.map((e) => e.id));
    expect(second.entries.some((e) => ids.has(e.id))).toBe(false);
  });
});
