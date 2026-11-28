import type { ValidatedToken } from "./connectorGrantService";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, createWorld, ok, system } from "../../test/fixtures";
import { getDb } from "../db";
import {
  CONNECTOR_CONSENT_VERSION,
  connectorGrantSchema,
  oauthAccessTokenSchema,
  oauthClientSchema,
  oauthConsentSchema,
  oauthRefreshTokenSchema,
} from "../db/schema";
import { isError } from "../errors";
import { careGroupMemberModel } from "../models";
import { careGroupMemberService, careGroupService, connectorGrantService, userService } from ".";

// connectorGrantService: a member's assistant bound to one group. The OAuth
// plugin's own flow is oauth.int.test.ts (packages/api); here the clients
// and tokens are rows, and `validate` stands in for the plugin.

const REDIRECT = "https://assistant.example.com/oauth/callback";
const ALL_SCOPES = ["group:read", "group:write", "offline_access"];

/** A registered client, as dynamic registration leaves it. */
const newClient = async (name = "Test Claude") => {
  const clientId = `client-${randomUUID()}`;
  await getDb()
    .insert(oauthClientSchema)
    .values({
      clientId,
      name,
      redirectUris: [REDIRECT],
      tokenEndpointAuthMethod: "none",
      scopes: ALL_SCOPES,
    });
  return clientId;
};

/** Tokens the plugin issued `userId` for `clientId` (an access and a refresh token, and the consent). */
const issueTokens = async (userId: string, clientId: string) => {
  const later = new Date(Date.now() + 60 * 60 * 1000);
  const [refresh] = await getDb()
    .insert(oauthRefreshTokenSchema)
    .values({
      token: randomUUID(),
      clientId,
      userId,
      expiresAt: later,
      createdAt: new Date(),
      scopes: ALL_SCOPES,
    })
    .returning();
  await getDb().insert(oauthAccessTokenSchema).values({
    token: randomUUID(),
    clientId,
    userId,
    refreshId: refresh!.id,
    expiresAt: later,
    createdAt: new Date(),
    scopes: ALL_SCOPES,
  });
  await getDb()
    .insert(oauthConsentSchema)
    .values({ clientId, userId, scopes: ALL_SCOPES, createdAt: new Date(), updatedAt: new Date() });
};

/** Whether `userId`'s tokens for `clientId` still work, and their consent remains. */
const tokensLive = async (userId: string, clientId: string) => {
  const access = await getDb()
    .select()
    .from(oauthAccessTokenSchema)
    .where(and(eq(oauthAccessTokenSchema.userId, userId), eq(oauthAccessTokenSchema.clientId, clientId)));
  const refresh = await getDb()
    .select()
    .from(oauthRefreshTokenSchema)
    .where(and(eq(oauthRefreshTokenSchema.userId, userId), eq(oauthRefreshTokenSchema.clientId, clientId)));
  const consent = await getDb()
    .select()
    .from(oauthConsentSchema)
    .where(and(eq(oauthConsentSchema.userId, userId), eq(oauthConsentSchema.clientId, clientId)));
  return {
    access: access.some((t) => !t.revoked),
    refresh: refresh.some((t) => !t.revoked),
    consent: consent.length > 0,
  };
};

/** A plugin stand-in: each test's tokens map to who they're for. */
const tokens = new Map<string, ValidatedToken>();
const validate = (token: string) => Promise.resolve(tokens.get(token) ?? null);
const tokenFor = (userId: string, clientId: string, scopes = ALL_SCOPES) => {
  const token = randomUUID();
  tokens.set(token, { userId, clientId, scopes });
  return token;
};

const byId = (id: string) => ({ id: { type: "eq" as const, value: id } });

/** A group with the switch on: an owner, an admin, a caretaker and a viewer. */
const world = async () => {
  const { u, group } = await createWorld();
  ok(
    await careGroupService.update(u.owner.ctx, { filter: byId(group.id), data: { connectorsEnabled: true } }),
  );
  return { ...u, group };
};

type World = Awaited<ReturnType<typeof world>>;

const connect = async (
  who: World["owner"],
  groupId: string,
  scope: "read" | "readWrite" = "readWrite",
  clientId?: string,
) => {
  const client = clientId ?? (await newClient());
  const grant = await connectorGrantService.grant(who.ctx, {
    clientId: client,
    groupId,
    scope,
    redirectUri: REDIRECT,
  });
  return { clientId: client, grant };
};

const codeOf = (value: unknown) => (isError(value) ? value.code : "ok");

describe("connectorGrantService.grant", () => {
  it("records the grant, the client's name and host, and the consent version", async () => {
    const w = await world();
    const { clientId, grant } = await connect(
      w.caretaker,
      w.group.id,
      "readWrite",
      await newClient("  Claude  "),
    );
    expect(ok(grant)).toMatchObject({
      userId: w.caretaker.user.id,
      groupId: w.group.id,
      clientName: "Claude",
      redirectHost: "assistant.example.com",
      scope: "readWrite",
      lastUsedAt: null,
    });
    const [row] = await getDb()
      .select()
      .from(connectorGrantSchema)
      .where(eq(connectorGrantSchema.oauthClientId, clientId));
    expect(row).toMatchObject({ consentVersion: CONNECTOR_CONSENT_VERSION, revokedAt: null });
    expect(row?.consentedAt).toBeTruthy();
  });

  it("is refused when the switch is off, for a non-member, and for a viewer asking to write", async () => {
    const w = await world();
    const { group: off } = await createGroup(w.owner);
    expect(codeOf((await connect(w.owner, off.id)).grant)).toBe("connectorGrantService:disabled");
    const stranger = await createUser("stranger");
    expect(codeOf((await connect(stranger, w.group.id, "read")).grant)).toBe(
      "connectorGrantService:notMember",
    );
    expect(codeOf((await connect(w.viewer, w.group.id, "readWrite")).grant)).toBe(
      "connectorGrantService:scopeNotAllowed",
    );
    expect(codeOf((await connect(w.viewer, w.group.id, "read")).grant)).toBe("ok");
  });

  it("refuses a redirect the client didn't register, and an unknown client", async () => {
    const w = await world();
    const clientId = await newClient();
    const wrong = await connectorGrantService.grant(w.owner.ctx, {
      clientId,
      groupId: w.group.id,
      scope: "read",
      redirectUri: "https://evil.example.com/cb",
    });
    expect(codeOf(wrong)).toBe("connectorGrantService:invalid");
    const unknown = await connectorGrantService.grant(w.owner.ctx, {
      clientId: "no-such-client",
      groupId: w.group.id,
      scope: "read",
      redirectUri: REDIRECT,
    });
    expect(codeOf(unknown)).toBe("connectorGrantService:invalid");
  });

  it("replaces a live grant for the same client, ending its tokens", async () => {
    const w = await world();
    const { clientId, grant: first } = await connect(w.owner, w.group.id);
    await issueTokens(w.owner.user.id, clientId);
    const { grant: second } = await connect(w.owner, w.group.id, "read", clientId);
    expect(ok(second).id).not.toBe(ok(first).id);
    expect(ok(await connectorGrantService.listMine(w.owner.ctx)).map((g) => g.id)).toEqual([ok(second).id]);
    expect(await tokensLive(w.owner.user.id, clientId)).toEqual({
      access: false,
      refresh: false,
      consent: false,
    });
  });
});

describe("connectorGrantService.verify", () => {
  it("answers whom a call is for, in which group, as a plain member, and stamps last used", async () => {
    const w = await world();
    const { clientId } = await connect(w.caretaker, w.group.id);
    const verified = ok(
      await connectorGrantService.verify(tokenFor(w.caretaker.user.id, clientId), validate),
    );
    expect(verified).toMatchObject({
      authUser: { id: w.caretaker.user.id, roleNames: ["member"], groupRoles: { [w.group.id]: "caretaker" } },
      groupId: w.group.id,
      role: "caretaker",
      scope: "readWrite",
      clientName: "Test Claude",
    });
    const [grant] = ok(await connectorGrantService.listMine(w.caretaker.ctx));
    expect(grant?.lastUsedAt).toBeTruthy();
  });

  it("never carries staff powers through a connector", async () => {
    const staff = await createUser("staff", "admin");
    const { group } = await createGroup(staff);
    ok(
      await careGroupService.update(staff.ctx, { filter: byId(group.id), data: { connectorsEnabled: true } }),
    );
    const { clientId } = await connect(staff, group.id);
    const verified = ok(await connectorGrantService.verify(tokenFor(staff.user.id, clientId), validate));
    expect(verified.authUser.roleNames).toEqual(["member"]);
  });

  it("refuses an unknown or expired token, and a token whose grant was revoked", async () => {
    const w = await world();
    const { clientId, grant } = await connect(w.owner, w.group.id);
    expect(codeOf(await connectorGrantService.verify("expired-or-unknown", validate))).toBe(
      "connectorGrantService:invalidToken",
    );
    const token = tokenFor(w.owner.user.id, clientId);
    ok(await connectorGrantService.revoke(w.owner.ctx, ok(grant).id));
    expect(codeOf(await connectorGrantService.verify(token, validate))).toBe(
      "connectorGrantService:invalidToken",
    );
  });

  it("refuses a removed member and a group switched off", async () => {
    const w = await world();
    const { clientId: caretakerClient } = await connect(w.caretaker, w.group.id);
    const { clientId: ownerClient } = await connect(w.owner, w.group.id);
    const membership = ok(
      await careGroupMemberModel.get({
        ...system,
        filter: {
          groupId: { type: "eq", value: w.group.id },
          userId: { type: "eq", value: w.caretaker.user.id },
        },
      }),
    );
    ok(await careGroupMemberService.remove(w.owner.ctx, membership!.id));
    expect(
      codeOf(await connectorGrantService.verify(tokenFor(w.caretaker.user.id, caretakerClient), validate)),
    ).toBe("connectorGrantService:invalidToken");

    ok(
      await careGroupService.update(w.owner.ctx, {
        filter: byId(w.group.id),
        data: { connectorsEnabled: false },
      }),
    );
    expect(codeOf(await connectorGrantService.verify(tokenFor(w.owner.user.id, ownerClient), validate))).toBe(
      "connectorGrantService:invalidToken",
    );
  });

  it("makes a demoted caretaker read only, and a token without group:write too", async () => {
    const w = await world();
    const { clientId } = await connect(w.caretaker, w.group.id);
    const readOnlyToken = tokenFor(w.caretaker.user.id, clientId, ["group:read", "offline_access"]);
    expect(ok(await connectorGrantService.verify(readOnlyToken, validate)).scope).toBe("read");

    const membership = ok(
      await careGroupMemberModel.get({
        ...system,
        filter: {
          groupId: { type: "eq", value: w.group.id },
          userId: { type: "eq", value: w.caretaker.user.id },
        },
      }),
    );
    ok(await careGroupMemberService.updateRole(w.owner.ctx, { id: membership!.id, role: "viewer" }));
    const verified = ok(
      await connectorGrantService.verify(tokenFor(w.caretaker.user.id, clientId), validate),
    );
    expect(verified).toMatchObject({ role: "viewer", scope: "read" });
  });
});

describe("the easy roles (easy roles PRD)", () => {
  it("refuses an Easy helper's and an Easy viewer's authorisation, read only included", async () => {
    const w = await world();
    for (const role of ["easy_helper", "easy_viewer"] as const) {
      const who = await createUser(role);
      ok(await careGroupMemberService.create(system, { groupId: w.group.id, userId: who.user.id, role }));
      for (const scope of ["read", "readWrite"] as const)
        expect(codeOf((await connect(who, w.group.id, scope)).grant)).toBe(
          "connectorGrantService:scopeNotAllowed",
        );
    }
  });

  it("cuts a connected caretaker off when they become an Easy helper", async () => {
    const w = await world();
    const { clientId } = await connect(w.caretaker, w.group.id);
    ok(await connectorGrantService.verify(tokenFor(w.caretaker.user.id, clientId), validate));

    const membership = ok(
      await careGroupMemberModel.get({
        ...system,
        filter: {
          groupId: { type: "eq", value: w.group.id },
          userId: { type: "eq", value: w.caretaker.user.id },
        },
      }),
    );
    ok(await careGroupMemberService.updateRole(w.owner.ctx, { id: membership!.id, role: "easy_helper" }));
    expect(
      codeOf(await connectorGrantService.verify(tokenFor(w.caretaker.user.id, clientId), validate)),
    ).toBe("connectorGrantService:invalidToken");
  });
});

describe("listing and revoking", () => {
  it("lists a member's own connections, and the group's for its owners and admins only", async () => {
    const w = await world();
    const { grant: mine } = await connect(w.caretaker, w.group.id);
    const { grant: viewers } = await connect(w.viewer, w.group.id, "read");
    expect(ok(await connectorGrantService.listMine(w.caretaker.ctx)).map((g) => g.id)).toEqual([ok(mine).id]);

    for (const manager of [w.owner, w.admin]) {
      const ids = ok(await connectorGrantService.listForGroup(manager.ctx, w.group.id)).map((g) => g.id);
      expect(ids.sort()).toEqual([ok(mine).id, ok(viewers).id].sort());
    }
    expect(codeOf(await connectorGrantService.listForGroup(w.caretaker.ctx, w.group.id))).toBe(
      "connectorGrantService:notAllowed",
    );
    const stranger = await createUser("stranger");
    expect(codeOf(await connectorGrantService.listForGroup(stranger.ctx, w.group.id))).toBe(
      "connectorGrantService:notMember",
    );
    // Never a token.
    expect(JSON.stringify(ok(await connectorGrantService.listMine(w.caretaker.ctx)))).not.toMatch(/token/i);
  });

  it("lets the member, an owner or an admin revoke, not another caretaker; tokens and consent go with it", async () => {
    const w = await world();
    const other = await createUser("other");
    ok(
      await careGroupMemberService.create(system, {
        groupId: w.group.id,
        userId: other.user.id,
        role: "caretaker",
      }),
    );

    for (const revoker of [w.caretaker, w.owner, w.admin]) {
      const { clientId, grant } = await connect(w.caretaker, w.group.id);
      await issueTokens(w.caretaker.user.id, clientId);
      expect(codeOf(await connectorGrantService.revoke(other.ctx, ok(grant).id))).toBe(
        "connectorGrantService:notFound",
      );
      expect(ok(await connectorGrantService.revoke(revoker.ctx, ok(grant).id))).toMatchObject({
        id: ok(grant).id,
      });
      expect(await tokensLive(w.caretaker.user.id, clientId)).toEqual({
        access: false,
        refresh: false,
        consent: false,
      });
      expect(codeOf(await connectorGrantService.revoke(revoker.ctx, ok(grant).id))).toBe(
        "connectorGrantService:notFound",
      );
    }
  });
});

describe("the group switch and memberships", () => {
  it("is owners' only; off revokes every grant, and on restores none", async () => {
    const w = await world();
    const set = (who: World["owner"], on: boolean) =>
      careGroupService.update(who.ctx, { filter: byId(w.group.id), data: { connectorsEnabled: on } });
    expect(codeOf(await set(w.admin, false))).toBe("careGroupService:connectorsOwnerOnly");
    expect(codeOf(await set(w.caretaker, false))).toBe("careGroupService:connectorsOwnerOnly");

    const { clientId } = await connect(w.caretaker, w.group.id);
    await issueTokens(w.caretaker.user.id, clientId);
    await connect(w.viewer, w.group.id, "read");
    ok(await set(w.owner, false));
    expect(ok(await connectorGrantService.listForGroup(w.owner.ctx, w.group.id))).toEqual([]);
    expect(await tokensLive(w.caretaker.user.id, clientId)).toEqual({
      access: false,
      refresh: false,
      consent: false,
    });

    ok(await set(w.owner, true));
    expect(ok(await connectorGrantService.listForGroup(w.owner.ctx, w.group.id))).toEqual([]);
    // Admins still rename the group as before.
    ok(await careGroupService.update(w.admin.ctx, { filter: byId(w.group.id), data: { name: "Renamed" } }));
  });

  it("ends a member's connections to the group when they leave or are removed, not to other groups", async () => {
    const w = await world();
    const { group: second } = await createGroup(w.owner, [{ user: w.caretaker.user, role: "caretaker" }]);
    ok(
      await careGroupService.update(w.owner.ctx, {
        filter: byId(second.id),
        data: { connectorsEnabled: true },
      }),
    );
    await connect(w.caretaker, w.group.id);
    const { grant: elsewhere } = await connect(w.caretaker, second.id);
    ok(await careGroupMemberService.leave(w.caretaker.ctx, w.group.id));
    expect(ok(await connectorGrantService.listMine(w.caretaker.ctx)).map((g) => g.id)).toEqual([
      ok(elsewhere).id,
    ]);

    const { clientId } = await connect(w.viewer, w.group.id, "read");
    await issueTokens(w.viewer.user.id, clientId);
    const membership = ok(
      await careGroupMemberModel.get({
        ...system,
        filter: {
          groupId: { type: "eq", value: w.group.id },
          userId: { type: "eq", value: w.viewer.user.id },
        },
      }),
    );
    ok(await careGroupMemberService.remove(w.admin.ctx, membership!.id));
    expect(ok(await connectorGrantService.listMine(w.viewer.ctx))).toEqual([]);
    expect(await tokensLive(w.viewer.user.id, clientId)).toEqual({
      access: false,
      refresh: false,
      consent: false,
    });
  });

  it("deletes every connection with the account", async () => {
    const w = await world();
    const { clientId } = await connect(w.viewer, w.group.id, "read");
    await issueTokens(w.viewer.user.id, clientId);
    ok(await userService.remove(system, { filter: byId(w.viewer.user.id) }));
    const left = await getDb()
      .select()
      .from(connectorGrantSchema)
      .where(eq(connectorGrantSchema.userId, w.viewer.user.id));
    expect(left).toEqual([]);
    const access = await getDb()
      .select()
      .from(oauthAccessTokenSchema)
      .where(eq(oauthAccessTokenSchema.userId, w.viewer.user.id));
    expect(access).toEqual([]);
  });
});

describe("connectorGrantService.revokeAllForUser", () => {
  it("ends every live grant of the account, in every group, with tokens and consent, and no one else's", async () => {
    const w = await world();
    const { group: second } = await createGroup(w.owner, [{ user: w.caretaker.user, role: "caretaker" }]);
    ok(
      await careGroupService.update(w.owner.ctx, {
        filter: byId(second.id),
        data: { connectorsEnabled: true },
      }),
    );
    const here = await connect(w.caretaker, w.group.id);
    const there = await connect(w.caretaker, second.id);
    await issueTokens(w.caretaker.user.id, here.clientId);
    await issueTokens(w.caretaker.user.id, there.clientId);
    const theirs = await connect(w.viewer, w.group.id, "read");
    await issueTokens(w.viewer.user.id, theirs.clientId);

    expect(ok(await connectorGrantService.revokeAllForUser(w.caretaker.user.id))).toEqual({ count: 2 });

    expect(ok(await connectorGrantService.listMine(w.caretaker.ctx))).toEqual([]);
    const ended = { access: false, refresh: false, consent: false };
    expect(await tokensLive(w.caretaker.user.id, here.clientId)).toEqual(ended);
    expect(await tokensLive(w.caretaker.user.id, there.clientId)).toEqual(ended);
    expect(ok(await connectorGrantService.listMine(w.viewer.ctx)).map((g) => g.id)).toEqual([
      ok(theirs.grant).id,
    ]);
    expect(await tokensLive(w.viewer.user.id, theirs.clientId)).toEqual({
      access: true,
      refresh: true,
      consent: true,
    });
    // Nothing left: a second call ends none.
    expect(ok(await connectorGrantService.revokeAllForUser(w.caretaker.user.id))).toEqual({ count: 0 });
  });
});
