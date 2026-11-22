import type { GroupRoleName } from "../constants";

import { describe, expect, it } from "vitest";
import { createUser, createWorld, ok, system } from "../../test/fixtures";
import { GROUP_ROLE_NAMES } from "../constants";
import { isError } from "../errors";
import { careGroupMemberModel } from "../models";
import { careGroupMemberService, careGroupService } from ".";

// The member role matrix (test-health slice 11): every role, and a user
// outside the group, against every member action, at the service that owns
// the rules. Owners and admins manage members; only an owner adds, makes,
// changes or removes an owner; the last owner stays one; anyone may leave.
// The router and the connector only pass these answers through. Every test
// builds its own world. All data is fictional.

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

type Actor = GroupRoleName | "outsider";
const OTHERS = GROUP_ROLE_NAMES.filter((r) => r !== "owner");
const ACTORS: readonly Actor[] = [...GROUP_ROLE_NAMES, "outsider"];
const isManager = (actor: Actor) => actor === "owner" || actor === "admin";

/** A group with one member in every role, one owner, and an outsider. */
const matrixWorld = async () => {
  const w = await createWorld({ members: OTHERS, extras: ["outsider"] });
  const ids = Object.fromEntries(
    await Promise.all(GROUP_ROLE_NAMES.map(async (r) => [r, (await w.membershipOf(w.u[r])).id] as const)),
  ) as Record<GroupRoleName, string>;
  /** Every member's role, by the role they started with. */
  const roles = async () => {
    const rows = ok(
      await careGroupMemberService.list(system, { filter: { groupId: { type: "eq", value: w.groupId } } }),
    );
    const byUser = new Map(rows.data.map((m) => [m.userId, m.role]));
    return Object.fromEntries(GROUP_ROLE_NAMES.map((r) => [r, byUser.get(w.u[r].user.id) ?? null]));
  };
  const SEEDED = Object.fromEntries(GROUP_ROLE_NAMES.map((r) => [r, r]));
  return { ...w, ids, roles, SEEDED };
};

describe("careGroupMemberService.updateRole: the matrix", () => {
  /** What `actor` gets for giving the member who is `target` the role `to` (one owner in the group). */
  const expected = (actor: Actor, target: GroupRoleName, to: GroupRoleName) => {
    if (actor === "outsider") return "careGroupMemberService:notFound";
    if (target === to) return "ok";
    if (target === "owner" || to === "owner") {
      if (actor !== "owner") return "careGroupMemberService:ownerOnly";
      return target === "owner" ? "careGroupMemberService:lastOwner" : "ok";
    }
    return isManager(actor) ? "ok" : "baseModel:update:nothingUpdated";
  };

  it.each(ACTORS)(
    "answers a %s for every member and every role, changing only what it allows",
    async (actor) => {
      const w = await matrixWorld();
      for (const target of GROUP_ROLE_NAMES) {
        for (const to of GROUP_ROLE_NAMES) {
          const want = expected(actor, target, to);
          const res = await careGroupMemberService.updateRole(w.u[actor].ctx, {
            id: w.ids[target],
            role: to,
          });
          const label = `${actor} makes ${target} ${to}`;
          expect(codeOf(res), label).toBe(want);
          expect(await w.roles(), label).toEqual({ ...w.SEEDED, [target]: want === "ok" ? to : target });
          if (want === "ok")
            ok(await careGroupMemberService.updateRole(system, { id: w.ids[target], role: target }));
        }
      }
    },
  );

  it("lets an owner change another owner once there are two, and then the last one stays", async () => {
    const w = await matrixWorld();
    const owner = w.u.owner.ctx;
    ok(await careGroupMemberService.updateRole(owner, { id: w.ids.admin, role: "owner" }));
    // A member who is not an owner still can't touch one, however many there are.
    expect(
      codeOf(await careGroupMemberService.updateRole(w.u.caretaker.ctx, { id: w.ids.admin, role: "viewer" })),
    ).toBe("careGroupMemberService:ownerOnly");
    expect(
      ok(await careGroupMemberService.updateRole(owner, { id: w.ids.owner, role: "viewer" })),
    ).toMatchObject({
      role: "viewer",
    });
    // The new owner is now the last one, and the old one can't manage owners.
    expect(
      codeOf(await careGroupMemberService.updateRole(w.u.admin.ctx, { id: w.ids.admin, role: "caretaker" })),
    ).toBe("careGroupMemberService:lastOwner");
    expect(codeOf(await careGroupMemberService.updateRole(owner, { id: w.ids.admin, role: "viewer" }))).toBe(
      "careGroupMemberService:ownerOnly",
    );
    expect(await w.roles()).toEqual({ ...w.SEEDED, owner: "viewer", admin: "owner" });
  });

  it("never moves a membership to another group or user", async () => {
    const w = await matrixWorld();
    expect(
      codeOf(
        await careGroupMemberModel.update({
          ...w.u.owner.ctx,
          filter: { id: { type: "eq", value: w.ids.viewer } },
          data: { userId: w.u.outsider.user.id },
        }),
      ),
    ).toBe("permissions:fieldUnauthorized");
  });
});

describe("careGroupMemberService.remove: the matrix", () => {
  /** What `actor` gets for removing the member who is `target` (one owner in the group). */
  const expected = (actor: Actor, target: GroupRoleName) => {
    if (actor === "outsider") return "careGroupMemberService:notFound";
    if (target === "owner")
      return actor === "owner" ? "careGroupMemberService:lastOwner" : "careGroupMemberService:ownerOnly";
    if (actor === target || isManager(actor)) return "ok";
    return "baseModel:remove:nothingRemoved";
  };

  it.each(ACTORS)("answers a %s for every member, removing only what it allows", async (actor) => {
    const w = await matrixWorld();
    for (const target of GROUP_ROLE_NAMES) {
      const want = expected(actor, target);
      const label = `${actor} removes ${target}`;
      expect(codeOf(await careGroupMemberService.remove(w.u[actor].ctx, w.ids[target])), label).toBe(want);
      expect(await w.roles(), label).toEqual({ ...w.SEEDED, [target]: want === "ok" ? null : target });
      if (want === "ok") {
        // Back in, under a new membership id, for the next target.
        const back = ok(
          await careGroupMemberService.create(system, {
            groupId: w.groupId,
            userId: w.u[target].user.id,
            role: target,
          }),
        );
        w.ids[target] = back!.id;
        expect(await careGroupService.getById(w.u[target].ctx, w.groupId)).toMatchObject({ id: w.groupId });
      }
    }
  });

  it("takes the group away from the member who goes", async () => {
    const w = await matrixWorld();
    ok(await careGroupMemberService.remove(w.u.admin.ctx, w.ids.caretaker));
    expect(await careGroupService.getById(w.u.caretaker.ctx, w.groupId)).toBeNull();
    expect(ok(await careGroupMemberService.list(w.u.caretaker.ctx)).data).toEqual([]);
  });

  it("lets an owner remove another owner, an admin never, and the last owner stays", async () => {
    const w = await matrixWorld();
    ok(await careGroupMemberService.updateRole(w.u.owner.ctx, { id: w.ids.caretaker, role: "owner" }));
    expect(codeOf(await careGroupMemberService.remove(w.u.admin.ctx, w.ids.caretaker))).toBe(
      "careGroupMemberService:ownerOnly",
    );
    expect(codeOf(await careGroupMemberService.remove(w.u.owner.ctx, w.ids.caretaker))).toBe("ok");
    expect(codeOf(await careGroupMemberService.remove(w.u.owner.ctx, w.ids.owner))).toBe(
      "careGroupMemberService:lastOwner",
    );
  });
});

describe("careGroupMemberService.leave", () => {
  it.each(OTHERS)("lets a %s leave", async (role) => {
    const w = await matrixWorld();
    expect(codeOf(await careGroupMemberService.leave(w.u[role].ctx, w.groupId))).toBe("ok");
    expect(await careGroupService.getById(w.u[role].ctx, w.groupId)).toBeNull();
    expect(await w.roles()).toEqual({ ...w.SEEDED, [role]: null });
  });

  it("keeps the last owner until there's another, then lets them go", async () => {
    const w = await matrixWorld();
    expect(codeOf(await careGroupMemberService.leave(w.u.owner.ctx, w.groupId))).toBe(
      "careGroupMemberService:lastOwner",
    );
    ok(await careGroupMemberService.updateRole(w.u.owner.ctx, { id: w.ids.admin, role: "owner" }));
    expect(codeOf(await careGroupMemberService.leave(w.u.owner.ctx, w.groupId))).toBe("ok");
    expect(await careGroupService.getById(w.u.owner.ctx, w.groupId)).toBeNull();
    expect(await w.roles()).toEqual({ ...w.SEEDED, owner: null, admin: "owner" });
  });

  it("answers someone outside the group with notFound", async () => {
    const w = await matrixWorld();
    expect(codeOf(await careGroupMemberService.leave(w.u.outsider.ctx, w.groupId))).toBe(
      "careGroupMemberService:notFound",
    );
    expect(await w.roles()).toEqual(w.SEEDED);
  });
});

describe("careGroupMemberService.create: the matrix", () => {
  /** What `actor` gets for adding a new user under `role`. */
  const expected = (actor: Actor, role: GroupRoleName) => {
    if (role === "owner") return actor === "owner" ? "ok" : "careGroupMemberService:ownerOnly";
    return isManager(actor) ? "ok" : "permissions:unauthorized";
  };

  it.each(ACTORS)("answers a %s adding someone in every role", async (actor) => {
    const w = await matrixWorld();
    for (const role of GROUP_ROLE_NAMES) {
      const newcomer = await createUser("newcomer");
      const res = await careGroupMemberService.create(w.u[actor].ctx, {
        groupId: w.groupId,
        userId: newcomer.user.id,
        role,
      });
      const want = expected(actor, role);
      expect(codeOf(res), `${actor} adds a ${role}`).toBe(want);
      const joined = ok(await careGroupService.getById(newcomer.ctx, w.groupId));
      expect(joined?.id ?? null, `${actor} adds a ${role}`).toBe(want === "ok" ? w.groupId : null);
    }
  });
});
