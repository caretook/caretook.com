import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok, system } from "../../test/fixtures";
import { isError } from "../errors";
import { careGroupMemberModel } from "../models";
import { careGroupMemberService, careGroupService } from ".";

// Easy mode's server rules: the easy roles replaced the managers' default and
// lock (simple-mode PRD, slice 3), whose retired columns nobody writes; the
// group's tiles follow the group's update rule.

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

describe("the retired easy-mode member columns", () => {
  it("can't be written by a manager, on a new membership or an existing one", async () => {
    const { u, groupId, membershipOf } = await setup();
    const joiner = await createUser("joiner");
    const created = await careGroupMemberService.create(u.admin.ctx, {
      groupId,
      userId: joiner.user.id,
      role: "caretaker",
      simpleMode: true,
    });
    expect(isError(created)).toBe(true);

    const caretaker = await membershipOf(u.caretaker);
    // No service writes them; the map refuses them at the model too.
    const updated = await careGroupMemberModel.update({
      ...u.owner.ctx,
      filter: { id: { type: "eq", value: caretaker.id } },
      data: { simpleModeLocked: true },
    });
    expect(isError(updated)).toBe(true);
    expect(await membershipOf(u.caretaker)).toMatchObject({ simpleMode: false, simpleModeLocked: false });
  });
});

describe("careGroup easyTiles", () => {
  const filter = (groupId: string) => ({ filter: { id: { type: "eq" as const, value: groupId } } });

  it("is null (learned) until owners or admins choose, and caretakers can't", async () => {
    const { u, groupId } = await setup();
    expect(ok(await careGroupService.getById(u.viewer.ctx, groupId))?.easyTiles).toBeNull();

    const tiles = {
      mode: "custom" as const,
      tiles: [
        { kind: "vital" as const, vitalType: "bloodGlucose" as const },
        { kind: "symptom" as const },
        { kind: "dose" as const },
        { kind: "note" as const },
      ],
    };
    ok(await careGroupService.update(u.admin.ctx, { ...filter(groupId), data: { easyTiles: tiles } }));
    expect(ok(await careGroupService.getById(u.viewer.ctx, groupId))?.easyTiles).toEqual(tiles);

    expect(
      codeOf(
        await careGroupService.update(u.caretaker.ctx, {
          ...filter(groupId),
          data: { easyTiles: { mode: "fixed" } },
        }),
      ),
    ).toBe("baseModel:update:nothingUpdated");
  });
});
