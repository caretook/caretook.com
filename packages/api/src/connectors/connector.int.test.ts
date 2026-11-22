import type { AuthUser, GroupRoleName } from "@caretook/data";

import { careGroupService, connectorGrantService } from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { connectAssistant, enablePasswordSignIn } from "./testing";
import { clientFor, rejection } from "../testing";

// Managing connections over the API (connectors slice 5): `connector.*` and
// the owners' switch on `careGroup.update`. Connections come from the real
// OAuth dance (testing.ts), so there are real tokens to keep out of every
// answer. All data is fictional.

const WHO = ["owner", "admin", "caretaker", "caretaker2", "viewer", "outsider"] as const;
type Who = (typeof WHO)[number];

/** A group with Assistants on and a member of each role, plus an outsider; each can sign in. */
const world = async () => {
  const people = {} as Record<Who, Awaited<ReturnType<typeof createUser>>>;
  for (const who of WHO) people[who] = await createUser(who);
  for (const who of WHO) await enablePasswordSignIn(people[who].user.id);
  const { group } = await createGroup(people.owner, [
    { user: people.admin.user, role: "admin" },
    { user: people.caretaker.user, role: "caretaker" },
    { user: people.caretaker2.user, role: "caretaker" },
    { user: people.viewer.user, role: "viewer" },
  ]);
  ok(
    await careGroupService.update(people.owner.ctx, {
      filter: { id: { type: "eq", value: group.id } },
      data: { connectorsEnabled: true },
    }),
  );
  const roles: Partial<Record<Who, GroupRoleName>> = {
    owner: "owner",
    admin: "admin",
    caretaker: "caretaker",
    caretaker2: "caretaker",
    viewer: "viewer",
  };
  const api = (who: Who) => {
    const role = roles[who];
    return clientFor({ ...people[who].ctx.authUser, groupRoles: role ? { [group.id]: role } : {} });
  };
  const connect = (who: Who, clientName = `${who}'s Claude`) =>
    connectAssistant({
      email: people[who].user.email,
      groupId: group.id,
      scope: who === "viewer" ? "read" : "readWrite",
      clientName,
    });
  return { people, group, api, connect, id: (who: Who) => people[who].user.id };
};

/** A member's live connections, straight from the service. */
const liveGrants = async (person: { ctx: { authUser: AuthUser } }) =>
  ok(await connectorGrantService.listMine(person.ctx));

describe("connector.listMine", () => {
  it("returns only the caller's live connections, with the group's name and no token", async () => {
    const { api, connect, id, group } = await world();
    const mine = await connect("caretaker");
    await connect("owner");

    const listed = await api("caretaker").connector.listMine();
    expect(listed).toHaveLength(1);
    const [only] = listed;
    expect(only).toMatchObject({
      userId: id("caretaker"),
      groupId: group.id,
      clientName: "caretaker's Claude",
      redirectHost: "assistant.example.com",
      scope: "readWrite",
      lastUsedAt: null,
    });
    expect(only!.consentedAt).toMatch(/Z$/);
    expect(typeof only!.groupName).toBe("string");
    // Only these fields: no token, no OAuth client id.
    expect(Object.keys(only!).sort()).toEqual(
      [
        "id",
        "userId",
        "groupId",
        "groupName",
        "clientName",
        "redirectHost",
        "scope",
        "consentedAt",
        "lastUsedAt",
      ].sort(),
    );
    const json = JSON.stringify(listed);
    expect(json).not.toContain(mine.tokens.access_token);
    expect(json).not.toContain(mine.tokens.refresh_token);
    expect(json).not.toContain(mine.clientId);

    expect(await api("outsider").connector.listMine()).toEqual([]);
  });
});

describe("connector.listForGroup", () => {
  it.each(["owner", "admin"] as const)("lists every member's connection for an %s, named", async (who) => {
    const { api, connect, id, group } = await world();
    const caretaker = await connect("caretaker");
    const viewer = await connect("viewer");

    const listed = await api(who).connector.listForGroup({ groupId: group.id });
    expect(listed.map((g) => [g.userId, g.clientName, g.scope]).sort()).toEqual(
      [
        [id("caretaker"), "caretaker's Claude", "readWrite"],
        [id("viewer"), "viewer's Claude", "read"],
      ].sort(),
    );
    expect(listed.every((g) => typeof g.memberName === "string")).toBe(true);
    const json = JSON.stringify(listed);
    for (const t of [caretaker, viewer]) {
      expect(json).not.toContain(t.tokens.access_token);
      expect(json).not.toContain(t.tokens.refresh_token);
    }
  });

  it.each(["caretaker", "viewer"] as const)("refuses a %s with a 403", async (who) => {
    const { api, group } = await world();
    const error = await rejection(api(who).connector.listForGroup({ groupId: group.id }));
    expect(error.status).toBe(403);
    expect(error.data?.code).toBe("connectorGrantService:notAllowed");
  });

  it("refuses a non-member with a 404", async () => {
    const { api, group } = await world();
    const error = await rejection(api("outsider").connector.listForGroup({ groupId: group.id }));
    expect(error.status).toBe(404);
  });
});

describe("connector.revoke", () => {
  it.each(["caretaker", "owner", "admin"] as const)(
    "disconnects the caretaker's assistant when asked by the %s",
    async (who) => {
      const { api, connect, id, people } = await world();
      const { tokens } = await connect("caretaker");
      const [grant] = await liveGrants(people.caretaker);

      const revoked = await api(who).connector.revoke({ grantId: grant!.id });
      expect(revoked).toMatchObject({ id: grant!.id, userId: id("caretaker") });
      expect(JSON.stringify(revoked)).not.toContain(tokens.access_token);
      expect(await api("caretaker").connector.listMine()).toEqual([]);
    },
  );

  it.each(["caretaker2", "viewer", "outsider"] as const)(
    "is refused for the %s (they can't see it: a 404), and the connection stays",
    async (who) => {
      const { api, connect, people } = await world();
      await connect("caretaker");
      const [grant] = await liveGrants(people.caretaker);

      const error = await rejection(api(who).connector.revoke({ grantId: grant!.id }));
      expect(error.status).toBe(404);
      expect(await api("caretaker").connector.listMine()).toHaveLength(1);
    },
  );

  it("answers a connection already disconnected with a 404", async () => {
    const { api, connect, people } = await world();
    await connect("caretaker");
    const [grant] = await liveGrants(people.caretaker);
    await api("caretaker").connector.revoke({ grantId: grant!.id });
    expect((await rejection(api("caretaker").connector.revoke({ grantId: grant!.id }))).status).toBe(404);
  });
});

describe("careGroup.update's connectorsEnabled", () => {
  it("lets an owner turn it off, disconnecting everyone, and on again, reconnecting no one", async () => {
    const { api, connect, group } = await world();
    await connect("caretaker");
    await connect("viewer");
    expect(await api("owner").connector.listForGroup({ groupId: group.id })).toHaveLength(2);

    await api("owner").careGroup.update({ groupId: group.id, connectorsEnabled: false });
    expect(await api("owner").connector.listForGroup({ groupId: group.id })).toEqual([]);
    expect(await api("caretaker").connector.listMine()).toEqual([]);

    await api("owner").careGroup.update({ groupId: group.id, connectorsEnabled: true });
    expect(await api("owner").connector.listForGroup({ groupId: group.id })).toEqual([]);
  });

  it.each(["admin", "caretaker"] as const)("refuses the %s with a 403 and changes nothing", async (who) => {
    const { api, connect, group } = await world();
    await connect("caretaker");
    const error = await rejection(api(who).careGroup.update({ groupId: group.id, connectorsEnabled: false }));
    expect(error.status).toBe(403);
    expect(await api("owner").connector.listForGroup({ groupId: group.id })).toHaveLength(1);
  });

  it("refuses a non-member with a 404", async () => {
    const { api, group } = await world();
    const error = await rejection(
      api("outsider").careGroup.update({ groupId: group.id, connectorsEnabled: false }),
    );
    expect(error.status).toBe(404);
  });
});
