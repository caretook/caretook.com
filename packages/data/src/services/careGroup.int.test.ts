import { describe, expect, it } from "vitest";
import { createGroup, createWorld, ok, system } from "../../test/fixtures";
import { careGroupInviteModel } from "../models";
import { isError } from "../errors";
import {
  careGroupInviteService,
  careGroupMemberService,
  careGroupService,
  careRecipientService,
  userService,
} from ".";

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");
const byId = (id: string) => ({ filter: { id: { type: "eq", value: id } } }) as const;

// Every test builds its own group and users, so tests never depend on each other.

const setup = async () => {
  const { u, groupId, recipient } = await createWorld({ extras: ["outsider", "staff"] });
  return { u, groupId, recipientId: recipient.id };
};
type Users = Awaited<ReturnType<typeof setup>>["u"];

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

  it("shows a co-member only id, name and image; yourself and staff the whole row", async () => {
    const { u } = await setup();
    const publicProfile = (who: Users[keyof Users]) => ({
      id: who.user.id,
      name: who.user.name,
      image: who.user.image,
      publicOnly: true,
    });

    expect(ok(await userService.getById(u.viewer.ctx, u.owner.user.id))).toEqual(publicProfile(u.owner));
    const listed = ok(
      await userService.list(u.caretaker.ctx, { filter: { id: { type: "eq", value: u.admin.user.id } } }),
    );
    expect(listed.data).toEqual([publicProfile(u.admin)]);

    // Yourself, in a list with co-members: your row whole, theirs public.
    const all = ok(await userService.list(u.viewer.ctx)).data;
    const self = all.find((x) => x.id === u.viewer.user.id);
    expect(self).toMatchObject({ publicOnly: false, email: u.viewer.user.email, role: "member" });
    for (const other of all.filter((x) => x.id !== u.viewer.user.id)) {
      expect(Object.keys(other).sort()).toEqual(["id", "image", "name", "publicOnly"]);
    }

    // Staff read any row whole (account access, not care data).
    expect(ok(await userService.getById(u.staff.ctx, u.owner.user.id))).toMatchObject({
      publicOnly: false,
      email: u.owner.user.email,
    });
    expect(ok(await userService.getWholeById(u.owner.ctx, u.owner.user.id))?.email).toBe(u.owner.user.email);
    expect(codeOf(await userService.getWholeById(u.viewer.ctx, u.owner.user.id))).toBe("userModel:notWhole");
  });

  it("never lets a co-member match or sort on hidden fields", async () => {
    const { u } = await setup();
    const byEmail = { filter: { email: { type: "eq", value: u.owner.user.email } } } as const;
    expect(ok(await userService.get(u.viewer.ctx, byEmail))).toBeNull();
    expect(codeOf(await userService.getByEmail(u.viewer.ctx, u.owner.user.email))).toBe("userModel:notFound");
    expect(ok(await userService.get(u.owner.ctx, byEmail))?.id).toBe(u.owner.user.id);
    // Ordering by a hidden field leaves only whole rows (here, yourself).
    const sorted = ok(
      await userService.list(u.viewer.ctx, { orderBy: [{ field: "email", direction: "asc" }] }),
    );
    expect(sorted.data.map((x) => x.id)).toEqual([u.viewer.user.id]);
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
      codeOf(
        await careRecipientService.create(u.caretaker.ctx, {
          groupId: other.group.id,
          name: "X",
          timeZone: "UTC",
        }),
      ),
    ).toBe("permissions:unauthorized");
  });
});

describe("creating a group", () => {
  it("makes the creator its only owner, with the recipient, atomically", async () => {
    const { u } = await setup();
    const res = ok(
      await careGroupService.create(u.viewer.ctx, {
        name: "Mine",
        recipient: { name: "Sam", timeZone: "America/Chicago" },
      }),
    );
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
      recipient: { name: null as never, timeZone: "UTC" },
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

// The member role rules (who changes, removes and adds whom; the last owner;
// leaving) are careGroupMember.int.test.ts's matrix.

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
