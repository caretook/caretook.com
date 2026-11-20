import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok, system } from "../../test/fixtures";
import { isError } from "../errors";
import { careGroupMemberService, careGroupService } from ".";

// Simple mode's server rules (assistant slice 5): owners and admins set a
// member's default and lock; only owners change an owner's; nobody changes
// their own lock. And the group's tiles follow the group's update rule.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

const setup = async () => {
  const u = {
    owner: await createUser("owner"),
    owner2: await createUser("owner2"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
  };
  const { group } = await createGroup(u.owner, [
    { user: u.owner2.user, role: "owner" },
    { user: u.admin.user, role: "admin" },
    { user: u.caretaker.user, role: "caretaker" },
    { user: u.viewer.user, role: "viewer" },
  ]);
  const membershipOf = async (who: (typeof u)[keyof typeof u]) => {
    const m = ok(
      await careGroupMemberService.get(system, {
        filter: { groupId: { type: "eq", value: group.id }, userId: { type: "eq", value: who.user.id } },
      }),
    );
    if (!m) throw new Error("no membership");
    return m;
  };
  return { u, groupId: group.id, membershipOf };
};

describe("careGroupMemberService.setMode", () => {
  it("starts off, and lets owners and admins set a member's default", async () => {
    const { u, membershipOf } = await setup();
    const caretaker = await membershipOf(u.caretaker);
    expect(caretaker).toMatchObject({ simpleMode: false, simpleModeLocked: false });

    const on = ok(await careGroupMemberService.setMode(u.admin.ctx, { id: caretaker.id, simpleMode: true }));
    expect(on).toMatchObject({ simpleMode: true, simpleModeLocked: false });
    const off = ok(
      await careGroupMemberService.setMode(u.owner.ctx, { id: caretaker.id, simpleMode: false }),
    );
    expect(off).toMatchObject({ simpleMode: false });
  });

  it("refuses caretakers, viewers and outsiders", async () => {
    const { u, membershipOf } = await setup();
    const viewer = await membershipOf(u.viewer);
    // The map lets only managers update: a member updates nothing.
    expect(
      codeOf(await careGroupMemberService.setMode(u.caretaker.ctx, { id: viewer.id, simpleMode: true })),
    ).toBe("baseModel:update:nothingUpdated");
    expect(
      codeOf(await careGroupMemberService.setMode(u.viewer.ctx, { id: viewer.id, simpleMode: true })),
    ).toBe("baseModel:update:nothingUpdated");
    // An outsider can't even see the membership.
    expect(
      codeOf(await careGroupMemberService.setMode(u.outsider.ctx, { id: viewer.id, simpleMode: true })),
    ).toBe("careGroupMemberService:notFound");
    expect(await membershipOf(u.viewer)).toMatchObject({ simpleMode: false });
  });

  it("lets only owners change an owner's", async () => {
    const { u, membershipOf } = await setup();
    const owner2 = await membershipOf(u.owner2);
    expect(
      codeOf(await careGroupMemberService.setMode(u.admin.ctx, { id: owner2.id, simpleMode: true })),
    ).toBe("careGroupMemberService:ownerOnly");
    ok(await careGroupMemberService.setMode(u.owner.ctx, { id: owner2.id, simpleMode: true, locked: true }));
    expect(await membershipOf(u.owner2)).toMatchObject({ simpleMode: true, simpleModeLocked: true });
  });

  it("locks into simple mode, and turning the default off unlocks", async () => {
    const { u, membershipOf } = await setup();
    const caretaker = await membershipOf(u.caretaker);
    const locked = ok(await careGroupMemberService.setMode(u.admin.ctx, { id: caretaker.id, locked: true }));
    expect(locked).toMatchObject({ simpleMode: true, simpleModeLocked: true });
    const unlocked = ok(
      await careGroupMemberService.setMode(u.admin.ctx, { id: caretaker.id, simpleMode: false }),
    );
    expect(unlocked).toMatchObject({ simpleMode: false, simpleModeLocked: false });
  });

  it("refuses anyone locking or unlocking themselves, but not their own default", async () => {
    const { u, membershipOf } = await setup();
    const admin = await membershipOf(u.admin);
    expect(codeOf(await careGroupMemberService.setMode(u.admin.ctx, { id: admin.id, locked: true }))).toBe(
      "careGroupMemberService:ownLock",
    );
    ok(await careGroupMemberService.setMode(u.admin.ctx, { id: admin.id, simpleMode: true }));
    expect(await membershipOf(u.admin)).toMatchObject({ simpleMode: true, simpleModeLocked: false });

    // Locked by an owner, they can't get out by turning their default off.
    ok(await careGroupMemberService.setMode(u.owner.ctx, { id: admin.id, locked: true }));
    expect(
      codeOf(await careGroupMemberService.setMode(u.admin.ctx, { id: admin.id, simpleMode: false })),
    ).toBe("careGroupMemberService:ownLock");
    expect(codeOf(await careGroupMemberService.setMode(u.admin.ctx, { id: admin.id, locked: false }))).toBe(
      "careGroupMemberService:ownLock",
    );
    expect(await membershipOf(u.admin)).toMatchObject({ simpleMode: true, simpleModeLocked: true });
  });

  it("never lets a manager create a membership already in simple mode", async () => {
    const { u, groupId } = await setup();
    const joiner = await createUser("joiner");
    const res = await careGroupMemberService.create(u.admin.ctx, {
      groupId,
      userId: joiner.user.id,
      role: "caretaker",
      simpleMode: true,
    });
    expect(isError(res)).toBe(true);
  });
});

describe("careGroup simpleTiles", () => {
  const filter = (groupId: string) => ({ filter: { id: { type: "eq" as const, value: groupId } } });

  it("is null (learned) until owners or admins choose, and caretakers can't", async () => {
    const { u, groupId } = await setup();
    expect(ok(await careGroupService.getById(u.viewer.ctx, groupId))?.simpleTiles).toBeNull();

    const tiles = {
      mode: "custom" as const,
      tiles: [
        { kind: "vital" as const, vitalType: "bloodGlucose" as const },
        { kind: "symptom" as const },
        { kind: "dose" as const },
        { kind: "note" as const },
      ],
    };
    ok(await careGroupService.update(u.admin.ctx, { ...filter(groupId), data: { simpleTiles: tiles } }));
    expect(ok(await careGroupService.getById(u.viewer.ctx, groupId))?.simpleTiles).toEqual(tiles);

    expect(
      codeOf(
        await careGroupService.update(u.caretaker.ctx, {
          ...filter(groupId),
          data: { simpleTiles: { mode: "fixed" } },
        }),
      ),
    ).toBe("baseModel:update:nothingUpdated");
  });
});
