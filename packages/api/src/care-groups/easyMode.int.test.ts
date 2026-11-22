import { describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../../data/test/fixtures";
import { clientFor, rejection } from "../testing";

// Easy mode over the API: `easyTiles` on `careGroup.update`, and the own
// setting in preferences (the managers' `setMemberMode` went with the lock).

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

describe("careGroup.update easyTiles", () => {
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
    expect(await api("admin").careGroup.update({ groupId: group.id, easyTiles: tiles })).toEqual({
      id: group.id,
      name: group.name,
      easyTiles: tiles,
    });
    expect(await api("owner").careGroup.update({ groupId: group.id, easyTiles: null })).toMatchObject({
      easyTiles: null,
    });
  });

  it("refuses custom tiles that aren't four, and caretakers", async () => {
    const { group, api } = await setup();
    const three = { mode: "custom", tiles: [{ kind: "note" }, { kind: "note" }, { kind: "dose" }] } as never;
    expect(
      (await rejection(api("owner").careGroup.update({ groupId: group.id, easyTiles: three }))).code,
    ).toBe("BAD_REQUEST");
    const error = await rejection(
      api("caretaker").careGroup.update({ groupId: group.id, easyTiles: { mode: "fixed" } }),
    );
    expect(error.code).toBe("FORBIDDEN");
  });
});

describe("me easyMode", () => {
  it("defaults to full, saves your own choice, and no longer takes “follow the group”", async () => {
    const { api } = await setup();
    expect((await api("caretaker").me.get()).easyMode).toBe("full");
    expect(await api("caretaker").me.updatePreferences({ easyMode: "easy" })).toMatchObject({
      easyMode: "easy",
    });
    expect((await api("caretaker").me.get()).easyMode).toBe("easy");
    const error = await rejection(api("caretaker").me.updatePreferences({ easyMode: "group" } as never));
    expect(error.code).toBe("BAD_REQUEST");
  });
});
