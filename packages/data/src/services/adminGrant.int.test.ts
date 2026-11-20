import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createUser, ok, system } from "../../test/fixtures";
import { getDb } from "../db";
import { adminAuditLogSchema } from "../db/schema";
import { isError } from "../errors";
import { userModel } from "../models";
import { adminGrantService } from ".";

// `pnpm admin:grant` (admin slice 1): sets the role as the system and records
// it with no actor; an unknown address is refused.

const entriesFor = (userId: string) =>
  getDb().select().from(adminAuditLogSchema).where(eq(adminAuditLogSchema.targetUserId, userId));

describe("adminGrantService.grant", () => {
  it("makes an account staff and records it with no actor", async () => {
    const { user } = await createUser("grant-me");
    const res = ok(await adminGrantService.grant({ email: user.email.toUpperCase(), role: "support" }));
    expect(res).toMatchObject({ userId: user.id, role: "support", changed: true });
    expect(ok(await userModel.getWholeById(user.id, system))?.role).toBe("support");

    const [entry, ...rest] = await entriesFor(user.id);
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      actorId: null,
      action: "user.setRole",
      changes: { role: ["member", "support"] },
    });
    expect(entry?.reason).toBeTruthy();

    ok(await adminGrantService.grant({ email: user.email, role: "admin" }));
    expect(ok(await userModel.getWholeById(user.id, system))?.role).toBe("admin");
    expect(await entriesFor(user.id)).toHaveLength(2);
  });

  it("changes and records nothing for a role the account already has", async () => {
    const { user } = await createUser("grant-same", "admin");
    expect(ok(await adminGrantService.grant({ email: user.email, role: "admin" }))).toMatchObject({
      changed: false,
    });
    expect(await entriesFor(user.id)).toHaveLength(0);
  });

  it("refuses an unknown address and a role that isn't staff", async () => {
    const unknown = await adminGrantService.grant({ email: "nobody-here@example.com", role: "admin" });
    expect(isError(unknown) && unknown.code).toBe("adminGrant:unknownAddress");
    const { user } = await createUser("grant-role");
    const bad = await adminGrantService.grant({ email: user.email, role: "member" });
    expect(isError(bad) && bad.code).toBe("adminGrant:invalidRole");
    expect(ok(await userModel.getWholeById(user.id, system))?.role).toBe("member");
  });
});
