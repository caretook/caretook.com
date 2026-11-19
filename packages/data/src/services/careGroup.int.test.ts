import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok, system } from "../../test/fixtures";
import { careGroupMemberModel, careGroupInviteModel } from "../models";
import { isError } from "../errors";
import {
  careGroupInviteService,
  careGroupMemberService,
  careGroupService,
  careRecipientService,
  userService,
} from ".";

type Users = Record<
  "owner" | "admin" | "caretaker" | "viewer" | "outsider" | "staff",
  Awaited<ReturnType<typeof createUser>>
>;

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const byId = (id: string) => ({ filter: { id: { type: "eq", value: id } } }) as const;

// Every test builds its own group and users, so tests never depend on each other.

const setup = async () => {
  const u: Users = {
    owner: await createUser("owner"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
    staff: await createUser("staff", "admin"),
  };
  const { group, recipient } = await createGroup(u.owner, [
    { user: u.admin.user, role: "admin" },
    { user: u.caretaker.user, role: "caretaker" },
    { user: u.viewer.user, role: "viewer" },
  ]);
  const groupId = group.id;
  const membershipOf = async (user: Users[keyof Users]) => {
    const m = ok(
      await careGroupMemberService.get(system, {
        filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: user.user.id } },
      }),
    );
    if (!m) throw new Error("no membership");
    return m;
  };
  return { u, groupId, recipientId: recipient.id, membershipOf };
};

describe("reading", () => {
  it("shows a group to every member and nobody else", async () => {
    const { u, groupId } = await setup();
    for (const role of ["owner", "admin", "caretaker", "viewer"] as const) {
      expect(await careGroupService.getById(u[role].ctx, groupId)).toMatchObject({ id: groupId });
    }
    expect(await careGroupService.getById(u.outsider.ctx, groupId)).toBeNull();
  });

  it("gives Caretook staff no access to care data", async () => {
    const { u, groupId, recipientId } = await setup();
    expect(await careGroupService.getById(u.staff.ctx, groupId)).toBeNull();
    expect(await careRecipientService.getById(u.staff.ctx, recipientId)).toBeNull();
  });

  it("lets co-members read each other, but not outsiders", async () => {
    const { u } = await setup();
    const res = ok(await userService.list(u.viewer.ctx));
    const ids = res.data.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining([u.owner.user.id, u.caretaker.user.id, u.viewer.user.id]));
    expect(ids).not.toContain(u.outsider.user.id);
    expect(ids).not.toContain(u.staff.user.id);
  });

  it("rejects unauthenticated callers", async () => {
    expect(codeOf(await careGroupService.list({ authUser: null }))).toBe("permissions:unauthenticated");
  });
});

describe("care recipient", () => {
  it("lets caretakers edit the profile but not viewers", async () => {
    const { u, recipientId } = await setup();
    expect(
      codeOf(await careRecipientService.update(u.viewer.ctx, { ...byId(recipientId), data: { notes: "x" } })),
    ).toBe("baseModel:update:nothingUpdated");
    const updated = ok(
      await careRecipientService.update(u.caretaker.ctx, {
        ...byId(recipientId),
        data: { notes: "Likes tea" },
      }),
    );
    expect(updated[0]).toMatchObject({ notes: "Likes tea", updatedBy: u.caretaker.user.id });
  });

  it("won't create rows in a group the actor can't manage", async () => {
    const { u } = await setup();
    const other = await createGroup(u.outsider);
    expect(
      codeOf(await careRecipientService.create(u.caretaker.ctx, { groupId: other.group.id, name: "X" })),
    ).toBe("permissions:unauthorized");
  });
});

describe("creating a group", () => {
  it("makes the creator its only owner, with the recipient, atomically", async () => {
    const { u } = await setup();
    const res = ok(await careGroupService.create(u.viewer.ctx, { name: "Mine", recipient: { name: "Sam" } }));
    expect(res.recipient).toMatchObject({ name: "Sam", displayName: "Sam" });
    const members = ok(
      await careGroupMemberService.list(u.viewer.ctx, {
        filter: { groupId: { type: "eq", value: res.group!.id } },
      }),
    );
    expect(members.data).toEqual([expect.objectContaining({ userId: u.viewer.user.id, role: "owner" })]);
  });

  it("rolls back the group when the recipient fails", async () => {
    const { u } = await setup();
    const id = crypto.randomUUID();
    const res = await careGroupService.create(u.viewer.ctx, {
      id,
      name: "Broken",
      recipient: { name: null as never },
    });
    expect(isError(res)).toBe(true);
    expect(await careGroupService.getById(system, id)).toBeNull();
  });

  it("requires the system to name an owner", async () => {
    expect(codeOf(await careGroupService.create(system, { name: "Orphan" }))).toBe(
      "permissions:unauthorized",
    );
  });
});

describe("membership rules", () => {
  it("only lets managers change roles, and never the group or user", async () => {
    const { u, membershipOf } = await setup();
    const viewer = await membershipOf(u.viewer);
    expect(
      codeOf(await careGroupMemberService.updateRole(u.caretaker.ctx, { id: viewer.id, role: "caretaker" })),
    ).toBe("baseModel:update:nothingUpdated");
    expect(
      codeOf(
        await careGroupMemberModel.update({
          ...u.owner.ctx,
          ...byId(viewer.id),
          data: { userId: u.outsider.user.id },
        }),
      ),
    ).toBe("permissions:fieldUnauthorized");
  });

  it("keeps owners in the hands of owners", async () => {
    const { u, membershipOf } = await setup();
    const owner = await membershipOf(u.owner);
    const viewer = await membershipOf(u.viewer);
    expect(
      codeOf(await careGroupMemberService.updateRole(u.admin.ctx, { id: owner.id, role: "viewer" })),
    ).toBe("careGroupMemberService:ownerOnly");
    expect(
      codeOf(await careGroupMemberService.updateRole(u.admin.ctx, { id: viewer.id, role: "owner" })),
    ).toBe("careGroupMemberService:ownerOnly");
    expect(codeOf(await careGroupMemberService.remove(u.admin.ctx, owner.id))).toBe(
      "careGroupMemberService:ownerOnly",
    );
  });

  it("never leaves a group without an owner", async () => {
    const { u, groupId, membershipOf } = await setup();
    const owner = await membershipOf(u.owner);
    expect(codeOf(await careGroupMemberService.leave(u.owner.ctx, groupId))).toBe(
      "careGroupMemberService:lastOwner",
    );
    expect(
      codeOf(await careGroupMemberService.updateRole(u.owner.ctx, { id: owner.id, role: "admin" })),
    ).toBe("careGroupMemberService:lastOwner");
  });

  it("allows handing over ownership and then leaving", async () => {
    const { u } = await setup();
    const { group } = await createGroup(u.owner, [{ user: u.caretaker.user, role: "caretaker" }]);
    const filter = (userId: string) =>
      ({
        filter: { groupId: { type: "eq", value: group.id }, userId: { type: "eq", value: userId } },
      }) as const;
    const care = ok(await careGroupMemberService.get(system, filter(u.caretaker.user.id)))!;

    expect(
      ok(await careGroupMemberService.updateRole(u.owner.ctx, { id: care.id, role: "owner" })),
    ).toMatchObject({
      role: "owner",
    });
    expect(codeOf(await careGroupMemberService.leave(u.owner.ctx, group.id))).toBe("ok");
    expect(await careGroupService.getById(u.owner.ctx, group.id)).toBeNull();
  });

  it("lets any member leave", async () => {
    const { u } = await setup();
    const { group } = await createGroup(u.owner, [{ user: u.viewer.user, role: "viewer" }]);
    expect(codeOf(await careGroupMemberService.leave(u.viewer.ctx, group.id))).toBe("ok");
    expect(await careGroupService.getById(u.viewer.ctx, group.id)).toBeNull();
  });
});

describe("invites", () => {
  it("lets managers invite, returning the token once and never the hash", async () => {
    const { u, groupId } = await setup();
    const res = ok(
      await careGroupInviteService.createEmail(u.admin.ctx, {
        groupId,
        email: "New.Person@Example.com",
        role: "caretaker",
        attested: true,
      }),
    );
    expect(res.token.length).toBeGreaterThan(30);
    expect(res.invite).toMatchObject({
      email: "new.person@example.com",
      status: "pending",
      isExpired: false,
    });
    expect(res.invite).not.toHaveProperty("tokenHash");

    // One pending invite per email per group.
    expect(
      codeOf(
        await careGroupInviteService.createEmail(u.owner.ctx, {
          groupId,
          email: "new.person@example.com",
          role: "viewer",
          attested: true,
        }),
      ),
    ).toBe("careGroupInviteService:alreadyInvited");
  });

  it("only lets owners invite owners", async () => {
    const { u, groupId } = await setup();
    expect(
      codeOf(
        await careGroupInviteService.createEmail(u.admin.ctx, {
          groupId,
          email: "o@example.com",
          role: "owner",
          attested: true,
        }),
      ),
    ).toBe("careGroupInviteService:ownerOnly");
    expect(
      codeOf(
        await careGroupInviteService.createEmail(u.owner.ctx, {
          groupId,
          email: "o@example.com",
          role: "owner",
          attested: true,
        }),
      ),
    ).toBe("ok");
  });

  it("hides invites from non-managers", async () => {
    const { u, groupId } = await setup();
    expect(ok(await careGroupInviteService.list(u.caretaker.ctx)).count).toBe(0);
    expect(
      codeOf(
        await careGroupInviteService.createEmail(u.caretaker.ctx, {
          groupId,
          email: "c@example.com",
          role: "viewer",
          attested: true,
        }),
      ),
    ).toBe("permissions:unauthorized");
  });

  it("revokes pending invites only, and can't be used to forge acceptance", async () => {
    const { u, groupId } = await setup();
    const { invite } = ok(
      await careGroupInviteService.createEmail(u.owner.ctx, {
        groupId,
        email: "r@example.com",
        role: "viewer",
        attested: true,
      }),
    );
    if (!invite) throw new Error("invite not readable");
    expect(
      codeOf(
        await careGroupInviteModel.update({
          ...u.owner.ctx,
          ...byId(invite.id),
          data: { acceptedBy: u.owner.user.id },
        }),
      ),
    ).toBe("permissions:fieldUnauthorized");
    expect(ok(await careGroupInviteService.revoke(u.owner.ctx, invite.id))).toMatchObject({
      status: "revoked",
    });
    expect(codeOf(await careGroupInviteService.revoke(u.owner.ctx, invite.id))).toBe(
      "careGroupInviteService:notFound",
    );
  });
});

describe("deleting a group", () => {
  it("is for owners only and cascades", async () => {
    const { u } = await setup();
    const { group, recipient } = await createGroup(u.owner, [{ user: u.admin.user, role: "admin" }]);
    expect(codeOf(await careGroupService.remove(u.admin.ctx, byId(group.id)))).toBe(
      "baseModel:remove:nothingRemoved",
    );
    expect(codeOf(await careGroupService.remove(u.owner.ctx, byId(group.id)))).toBe("ok");
    expect(await careRecipientService.getById(system, recipient.id)).toBeNull();
  });
});
