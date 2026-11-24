import { careGroupMemberModel, getDb, sessionSchema } from "@caretook/data";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../../data/test/fixtures";
import { clientFor, codesOf } from "../testing";

// careGroup.memberStatuses (B-679): owners and admins see whether each member
// has confirmed their email and when they last signed in; other members are
// refused, and no email ever comes back.

/** Plain SQL on the test database (this package doesn't depend on drizzle-orm). */
const query = async (text: string, values: unknown[] = []) => getDb().$client.query(text, values);

/** A session started at `createdAt`, as Better Auth would store it. */
const addSession = (userId: string, createdAt: Date) =>
  getDb()
    .insert(sessionSchema)
    .values({
      userId,
      token: randomUUID(),
      userAgent: "Test browser",
      ipAddress: "203.0.113.7",
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt,
      updatedAt: createdAt,
    });

const setup = async () => {
  const owner = await createUser("ms-owner");
  const admin = await createUser("ms-admin");
  const caretaker = await createUser("ms-caretaker");
  const viewer = await createUser("ms-viewer");
  const outsider = await createUser("ms-outsider");
  const { group } = await createGroup(owner, [
    { user: admin.user, role: "admin" },
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  // The owner and admin confirmed their email; the caretaker and viewer haven't.
  await query(`update "user" set email_verified = true where id = any($1)`, [[owner.user.id, admin.user.id]]);
  const earlier = new Date("2026-11-20T09:00:00.000Z");
  const later = new Date("2026-11-22T18:30:00.000Z");
  await addSession(admin.user.id, earlier);
  await addSession(admin.user.id, later);
  await addSession(caretaker.user.id, earlier);
  return { groupId: group.id, owner, admin, caretaker, viewer, outsider, earlier, later };
};

describe("careGroup.memberStatuses", () => {
  it("gives owners and admins each member's confirmation and last sign-in, never an email", async () => {
    const s = await setup();
    for (const manager of [s.owner, s.admin]) {
      const rows = await clientFor(manager.ctx.authUser).careGroup.memberStatuses({ groupId: s.groupId });
      const byUser = Object.fromEntries(rows.map((r) => [r.userId, r]));
      expect(Object.keys(byUser).sort()).toEqual(
        [s.owner.user.id, s.admin.user.id, s.caretaker.user.id, s.viewer.user.id].sort(),
      );
      expect(byUser[s.owner.user.id]).toEqual({
        userId: s.owner.user.id,
        emailVerified: true,
        lastSignInAt: null,
      });
      expect(byUser[s.admin.user.id]).toEqual({
        userId: s.admin.user.id,
        emailVerified: true,
        lastSignInAt: s.later.toISOString(),
      });
      expect(byUser[s.caretaker.user.id]).toEqual({
        userId: s.caretaker.user.id,
        emailVerified: false,
        lastSignInAt: s.earlier.toISOString(),
      });
      expect(byUser[s.viewer.user.id]).toEqual({
        userId: s.viewer.user.id,
        emailVerified: false,
        lastSignInAt: null,
      });
      const text = JSON.stringify(rows);
      for (const user of [s.owner, s.admin, s.caretaker, s.viewer])
        expect(text).not.toContain(user.user.email);
      expect(text).not.toContain("@");
    }
  });

  it("refuses a caretaker or viewer, and a non-member gets nothing", async () => {
    const s = await setup();
    for (const member of [s.caretaker, s.viewer]) {
      expect(
        await codesOf(clientFor(member.ctx.authUser).careGroup.memberStatuses({ groupId: s.groupId })),
      ).toBe("FORBIDDEN:careGroupMemberService:managersOnly");
    }
    expect(
      await codesOf(clientFor(s.outsider.ctx.authUser).careGroup.memberStatuses({ groupId: s.groupId })),
    ).toBe("NOT_FOUND:careGroupMemberService:notFound");
    expect(await codesOf(clientFor(null).careGroup.memberStatuses({ groupId: s.groupId }))).toMatch(
      /^UNAUTHORIZED/,
    );
  });

  it("scopes the rows in SQL to the actor's own managed groups", async () => {
    const s = await setup();
    // The model returns no rows to anyone who doesn't manage the group.
    const rows = await careGroupMemberModel.accountStatuses(s.groupId, s.outsider.user.id);
    expect(rows).toEqual([]);
    const asViewer = await careGroupMemberModel.accountStatuses(s.groupId, s.viewer.user.id);
    expect(asViewer).toEqual([]);
  });
});
