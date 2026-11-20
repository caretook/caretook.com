import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "../db";
import { adminAuditLogSchema, emailSuppressionSchema } from "../db/schema";
import { isError } from "../errors";
import { createUser, ok } from "../../test/fixtures";
import * as emailSuppressionService from "./emailSuppressionService";

// Suppressed addresses (hosting slice 4): suppressing is idempotent on the
// webhook event, one active row per address, and staff list and clear them.
// The webhook and the outbox's skip are tested in @caretook/notifications.

const run = randomUUID().slice(0, 8);
let seq = 0;
const address = (label = "sup") => `${label}-${run}-${++seq}@example.com`;
const eventId = () => `msg_${run}_${++seq}`;

const rowsFor = (addr: string) =>
  getDb().select().from(emailSuppressionSchema).where(eq(emailSuppressionSchema.address, addr));

describe("emailSuppressionService.suppress", () => {
  it("stores the address lower-cased, once per event and once per address", async () => {
    const addr = address();
    const event = eventId();
    expect(ok(await emailSuppressionService.suppress(`  ${addr.toUpperCase()} `, "bounce", event))).toEqual({
      suppressed: true,
    });
    // The same event again, and another event for the same address: nothing new.
    expect(ok(await emailSuppressionService.suppress(addr, "bounce", event))).toEqual({ suppressed: false });
    expect(ok(await emailSuppressionService.suppress(addr, "complaint", eventId()))).toEqual({
      suppressed: false,
    });
    const rows = await rowsFor(addr);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ address: addr, reason: "bounce", eventId: event, clearedAt: null });
    expect(ok(await emailSuppressionService.hasEvent(event))).toBe(true);
    expect(ok(await emailSuppressionService.isSuppressed(addr.toUpperCase()))).toBe(true);
    expect(ok(await emailSuppressionService.isSuppressed(address()))).toBe(false);
  });
});

describe("emailSuppressionService.list", () => {
  it("lets support list the active suppressions, searched by part of the address", async () => {
    const support = await createUser("sup-support", "support");
    const addr = address("listed");
    ok(await emailSuppressionService.suppress(addr, "complaint", eventId()));
    const res = ok(await emailSuppressionService.list(support.ctx, { query: `LISTED-${run}`, page: 1 }));
    expect(res.data.map((r) => r.address)).toContain(addr);
    expect(res.data.find((r) => r.address === addr)).toMatchObject({ reason: "complaint" });
    expect(res.count).toBeGreaterThanOrEqual(1);
  });

  it("refuses a member", async () => {
    const member = await createUser("sup-member");
    const res = await emailSuppressionService.list(member.ctx, { page: 1 });
    expect(isError(res) && res.code).toBe("staff:notAllowed");
  });
});

describe("emailSuppressionService.clear", () => {
  it("needs users.help", async () => {
    const member = await createUser("sup-member");
    const addr = address();
    ok(await emailSuppressionService.suppress(addr, "bounce", eventId()));
    const res = await emailSuppressionService.clear(member.ctx, { address: addr, reason: "Fixed" });
    expect(isError(res) && res.code).toBe("staff:notAllowed");
    expect(ok(await emailSuppressionService.isSuppressed(addr))).toBe(true);
  });

  it("needs a reason", async () => {
    const support = await createUser("sup-support", "support");
    const addr = address();
    ok(await emailSuppressionService.suppress(addr, "bounce", eventId()));
    const res = await emailSuppressionService.clear(support.ctx, { address: addr, reason: "  " });
    expect(isError(res) && res.code).toBe("emailSuppression:invalid");
    expect(isError(res) && res.meta).toMatchObject({ issues: [{ path: "reason" }] });
    expect(ok(await emailSuppressionService.isSuppressed(addr))).toBe(true);
  });

  it("clears it, keeps the row as history and records the audit entry naming the account", async () => {
    const support = await createUser("sup-support", "support");
    const owner = await createUser("sup-owner");
    const addr = owner.user.email.toLowerCase();
    ok(await emailSuppressionService.suppress(addr, "bounce", eventId()));

    const res = ok(
      await emailSuppressionService.clear(support.ctx, {
        address: addr.toUpperCase(),
        reason: "Mailbox fixed",
      }),
    );
    expect(res).toEqual({ address: addr, cleared: true });
    expect(ok(await emailSuppressionService.isSuppressed(addr))).toBe(false);
    const [row] = await rowsFor(addr);
    expect(row).toMatchObject({ clearedBy: support.user.id, clearReason: "Mailbox fixed" });
    expect(row?.clearedAt).not.toBeNull();

    const audit = await getDb()
      .select()
      .from(adminAuditLogSchema)
      .where(
        and(
          eq(adminAuditLogSchema.action, "mail.suppressionCleared"),
          eq(adminAuditLogSchema.targetUserId, owner.user.id),
        ),
      );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorId: support.user.id,
      reason: "Mailbox fixed",
      changes: { address: [addr, addr], suppressed: ["bounce", null] },
    });

    // Cleared, it can be suppressed again by a new event.
    expect(ok(await emailSuppressionService.suppress(addr, "complaint", eventId()))).toEqual({
      suppressed: true,
    });
  });

  it("is a 404 for an address that isn't suppressed", async () => {
    const support = await createUser("sup-support", "support");
    const res = await emailSuppressionService.clear(support.ctx, { address: address(), reason: "Why not" });
    expect(isError(res) && res.code).toBe("emailSuppression:notFound");
  });
});
