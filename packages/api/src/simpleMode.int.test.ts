import type { AuthUser } from "@caretook/data";

import { createRouterClient, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../data/test/fixtures";
import { router } from ".";

// Simple mode over the API (assistant slice 5): `careGroup.setMemberMode`,
// `simpleTiles` on `careGroup.update`, and the own setting in preferences.

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

const rejection = async (call: Promise<unknown>) => {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof ORPCError)) throw new Error(`Expected an ORPCError, got ${String(error)}`);
  return error as ORPCError<string, { code?: string }>;
};

const setup = async () => {
  const people = {
    owner: await createUser("owner"),
    owner2: await createUser("owner2"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
  };
  const roles = { owner2: "owner", admin: "admin", caretaker: "caretaker", viewer: "viewer" } as const;
  const { group } = await createGroup(
    people.owner,
    Object.entries(roles).map(([who, role]) => ({ user: people[who as keyof typeof roles].user, role })),
  );
  const api = (who: keyof typeof people) => {
    const role = who === "owner" ? "owner" : who === "outsider" ? undefined : roles[who];
    return clientFor({ ...people[who].ctx.authUser, groupRoles: role ? { [group.id]: role } : {} });
  };
  const id = (who: keyof typeof people) => people[who].user.id;
  return { group, api, id };
};

describe("careGroup.setMemberMode", () => {
  it("lets an owner or admin set a member's default, and lock them", async () => {
    const { group, api, id } = await setup();
    const groupId = group.id;
    expect(
      await api("admin").careGroup.setMemberMode({ groupId, userId: id("caretaker"), simpleMode: true }),
    ).toEqual({ userId: id("caretaker"), simpleMode: true, locked: false });
    expect(
      await api("owner").careGroup.setMemberMode({ groupId, userId: id("viewer"), locked: true }),
    ).toEqual({ userId: id("viewer"), simpleMode: true, locked: true });
  });

  it.each(["caretaker", "viewer"] as const)("refuses a %s with a 403", async (who) => {
    const { group, api, id } = await setup();
    const error = await rejection(
      api(who).careGroup.setMemberMode({ groupId: group.id, userId: id("viewer"), simpleMode: true }),
    );
    expect(error.code).toBe("FORBIDDEN");
  });

  it("answers a non-member, or an unknown member, with a 404", async () => {
    const { group, api, id } = await setup();
    const call = (who: "outsider" | "owner", userId: string) =>
      api(who).careGroup.setMemberMode({ groupId: group.id, userId, simpleMode: true });
    expect((await rejection(call("outsider", id("viewer")))).code).toBe("NOT_FOUND");
    expect((await rejection(call("owner", id("outsider")))).code).toBe("NOT_FOUND");
  });

  it("lets only owners change an owner's, and nobody their own lock", async () => {
    const { group, api, id } = await setup();
    const groupId = group.id;
    const ownerOnly = await rejection(
      api("admin").careGroup.setMemberMode({ groupId, userId: id("owner2"), simpleMode: true }),
    );
    expect(ownerOnly.code).toBe("FORBIDDEN");
    expect(ownerOnly.data?.code).toBe("careGroupMemberService:ownerOnly");

    const ownLock = await rejection(
      api("owner").careGroup.setMemberMode({ groupId, userId: id("owner"), locked: true }),
    );
    expect(ownLock.code).toBe("FORBIDDEN");
    expect(ownLock.data?.code).toBe("careGroupMemberService:ownLock");

    expect(
      await api("owner").careGroup.setMemberMode({ groupId, userId: id("owner2"), simpleMode: true }),
    ).toMatchObject({ simpleMode: true });
  });
});

describe("careGroup.update simpleTiles", () => {
  it("stores the tiles choice for owners and admins, keeping the name", async () => {
    const { group, api } = await setup();
    const tiles = {
      mode: "custom" as const,
      tiles: [
        { kind: "vital" as const, vitalType: "bloodGlucose" as const },
        { kind: "symptom" as const },
        { kind: "dose" as const },
        { kind: "note" as const },
      ],
    };
    expect(await api("admin").careGroup.update({ groupId: group.id, simpleTiles: tiles })).toEqual({
      id: group.id,
      name: group.name,
      simpleTiles: tiles,
    });
    expect(await api("owner").careGroup.update({ groupId: group.id, simpleTiles: null })).toMatchObject({
      simpleTiles: null,
    });
  });

  it("refuses custom tiles that aren't four, and caretakers", async () => {
    const { group, api } = await setup();
    const three = { mode: "custom", tiles: [{ kind: "note" }, { kind: "note" }, { kind: "dose" }] } as never;
    expect(
      (await rejection(api("owner").careGroup.update({ groupId: group.id, simpleTiles: three }))).code,
    ).toBe("BAD_REQUEST");
    const error = await rejection(
      api("caretaker").careGroup.update({ groupId: group.id, simpleTiles: { mode: "fixed" } }),
    );
    expect(error.code).toBe("FORBIDDEN");
  });
});

describe("me simpleMode", () => {
  it("defaults to following the group, and saves your own choice", async () => {
    const { api } = await setup();
    expect((await api("caretaker").me.get()).simpleMode).toBe("group");
    expect(await api("caretaker").me.updatePreferences({ simpleMode: "simple" })).toMatchObject({
      simpleMode: "simple",
    });
    expect((await api("caretaker").me.get()).simpleMode).toBe("simple");
  });
});
