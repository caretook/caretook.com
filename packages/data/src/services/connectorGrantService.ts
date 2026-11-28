import type { GroupRoleName } from "../constants";
import type { ConnectorGrant, ConnectorScope, Tx } from "../db";
import type { AuthUser } from "../permissions";
import type { ServiceContext } from "./types";

import { GROUP_MANAGER_ROLES, SYSTEM_USER } from "../constants";
import { withTransaction } from "../db";
import {
  CONNECTOR_CONSENT_VERSION,
  CONNECTOR_OAUTH_SCOPES,
  connectorClientName,
  effectiveScope,
  isConnectorScope,
  readOnlyByOwner,
  scopesForRole,
} from "../db/schema";
import { isError, newError } from "../errors";
import { careGroupMemberModel, careGroupModel, connectorGrantModel, userModel } from "../models";
import { isSystemUser } from "../permissions";

// A member's own AI assistant connected to one care group (connectors PRD).
// The OAuth plugin (packages/auth) issues the tokens; a grant says which
// group they reach and what they may do there. Every /mcp call goes through
// `verify`, which rechecks the membership, the role and the group's switch.
// Every write here is the system's, after checking the actor; tokens and
// consents are revoked with their grant, in the same transaction.

export const schemaName = connectorGrantModel.schemaName;

const live = { revokedAt: { type: "isNull" as const } };

/** What a token is, as the OAuth plugin validated it: only an active token gets here. */
export type ValidatedToken = { userId: string; clientId: string; scopes: readonly string[] };
/** Validates an access token through the plugin; null when it's unknown, expired or revoked. */
export type ValidateToken = (token: string) => Promise<ValidatedToken | null>;

/** A grant as the member and the group's managers see it (never a token). */
export type ConnectorGrantView = Pick<
  ConnectorGrant,
  "id" | "userId" | "groupId" | "clientName" | "redirectHost" | "scope" | "consentedAt" | "lastUsedAt"
>;

const toView = (grant: ConnectorGrant): ConnectorGrantView => ({
  id: grant.id,
  userId: grant.userId,
  groupId: grant.groupId,
  clientName: grant.clientName,
  redirectHost: grant.redirectHost,
  scope: grant.scope,
  consentedAt: grant.consentedAt,
  lastUsedAt: grant.lastUsedAt,
});

const hostOf = (uri: string) => {
  try {
    return new URL(uri).host || null;
  } catch {
    return null;
  }
};

/** End grants and what the plugin issued for them, inside `tx`. */
const endGrants = async (grants: readonly ConnectorGrant[], tx: Tx) => {
  for (const grant of grants) {
    const ended = await connectorGrantModel.revokeTokens(grant.userId, grant.oauthClientId, tx);
    if (ended) return ended;
  }
  return null;
};

/**
 * Connect `clientId` to `groupId` for the actor, from the consent page. The
 * group's switch must be on, the actor a member, and `readWrite` needs a
 * writer's role. `redirectUri` is the authorize request's (one the client
 * registered); its host is shown beside the client's name. A live grant for
 * the same client is replaced, with its tokens. Records the consent version.
 */
export const grant = (
  ctx: ServiceContext,
  {
    clientId,
    groupId,
    scope,
    redirectUri,
  }: { clientId: string; groupId: string; scope: ConnectorScope; redirectUri: string },
) =>
  withTransaction(async (tx) => {
    const actor = ctx.authUser;
    if (!actor || isSystemUser(actor)) return newError({ code: "permissions:unauthenticated" });
    if (!isConnectorScope(scope)) return newError({ code: "connectorGrantService:invalid" });

    const role = await careGroupMemberModel.getRole(groupId, actor.id, { tx });
    if (isError(role)) return role;
    if (!role) return newError({ code: "connectorGrantService:notMember" });
    const group = await careGroupModel.getById(groupId, { authUser: actor, tx });
    if (isError(group)) return group;
    if (!group) return newError({ code: "connectorGrantService:notMember" });
    if (!group.connectorsEnabled) return newError({ code: "connectorGrantService:disabled" });
    if (!scopesForRole(role).includes(scope))
      return newError({ code: "connectorGrantService:scopeNotAllowed" });
    if (!scopesForRole(role, group.connectorsReadOnly).includes(scope))
      return newError({ code: "connectorGrantService:groupReadOnly" });

    const client = await connectorGrantModel.getClient(clientId, tx);
    if (isError(client)) return client;
    const host = hostOf(redirectUri);
    if (!client || client.disabled || !host || !client.redirectUris.includes(redirectUri)) {
      return newError({ code: "connectorGrantService:invalid" });
    }

    const replaced = await connectorGrantModel.revokeForClient(actor.id, clientId, SYSTEM_USER.id, tx);
    if (isError(replaced)) return replaced;
    const ended = await endGrants(replaced, tx);
    if (ended) return ended;

    const created = await connectorGrantModel.create({
      authUser: SYSTEM_USER,
      tx,
      data: {
        userId: actor.id,
        groupId,
        oauthClientId: clientId,
        clientName: connectorClientName(client.name),
        redirectHost: host,
        scope,
        consentVersion: CONNECTOR_CONSENT_VERSION,
        consentedAt: new Date().toISOString(),
      },
    });
    if (isError(created)) return created;
    return created ? toView(created) : newError({ code: "baseModel:create:nothingCreated" });
  }, ctx);

/** A registered client's name (as we show it) and redirect URIs, for the consent page; null when unknown or disabled. */
export const client = async (clientId: string) => {
  const found = await connectorGrantModel.getClient(clientId);
  if (isError(found)) return found;
  if (!found || found.disabled) return null;
  return {
    clientId: found.clientId,
    name: connectorClientName(found.name),
    redirectUris: found.redirectUris,
  };
};

/** What a verified call may do: whom it acts for, in which group, and its scope now. */
export type VerifiedConnector = {
  /** The member, as a plain member: staff powers never reach a connector. */
  authUser: AuthUser;
  groupId: string;
  role: GroupRoleName;
  scope: ConnectorScope;
  /** The group's read-only setting is what stops this connection writing. */
  readOnlyByOwner: boolean;
  grantId: string;
  clientName: string;
};

/**
 * The only way into /mcp. Validates `accessToken` through the plugin
 * (`validate`), loads its live grant, then rechecks on every call that the
 * account is enabled, the member still belongs to the group, the group's
 * switch is on, and narrows the scope to the member's current role, the
 * group's read-only setting and the token's own scopes. Stamps `last_used_at` (at most once a minute). Every
 * refusal is `invalidToken`: the assistant has to reconnect.
 */
export const verify = async (accessToken: string, validate: ValidateToken) => {
  const refused = () => newError({ code: "connectorGrantService:invalidToken" });
  const token = await validate(accessToken);
  if (!token) return refused();
  if (!token.scopes.includes(CONNECTOR_OAUTH_SCOPES.read)) return refused();

  const found = await connectorGrantModel.getLive(token.userId, token.clientId);
  if (isError(found)) return found;
  if (!found) return refused();

  const user = await userModel.getWholeById(found.userId, { authUser: SYSTEM_USER });
  if (isError(user)) return user;
  if (!user || user.disabledAt) return refused();

  const role = await careGroupMemberModel.getRole(found.groupId, found.userId);
  if (isError(role)) return role;
  const group = await careGroupModel.getById(found.groupId, { authUser: SYSTEM_USER });
  if (isError(group)) return group;
  if (!group?.connectorsEnabled) return refused();

  const allowed = effectiveScope(found.scope, role, group.connectorsReadOnly);
  if (!role || !allowed) return refused();
  const tokenCanWrite = token.scopes.includes(CONNECTOR_OAUTH_SCOPES.write);
  const scope = allowed === "readWrite" && tokenCanWrite ? "readWrite" : "read";

  const touched = await connectorGrantModel.touch(found.id);
  if (touched) return touched;

  return {
    authUser: { id: found.userId, roleNames: ["member"], groupRoles: { [found.groupId]: role } },
    groupId: found.groupId,
    role,
    scope,
    readOnlyByOwner: readOnlyByOwner(found.scope, role, group.connectorsReadOnly, tokenCanWrite),
    grantId: found.id,
    clientName: found.clientName,
  } satisfies VerifiedConnector;
};

/**
 * Disconnect grant `grantId`: the member's own, or any in a group the actor
 * owns or administers. Its tokens stop working and its consent goes, in the
 * same transaction.
 */
export const revoke = (ctx: ServiceContext, grantId: string) =>
  withTransaction(async (tx) => {
    const visible = await connectorGrantModel.getById(grantId, { ...ctx, tx });
    if (isError(visible)) return visible;
    if (!visible || visible.revokedAt) return newError({ code: "connectorGrantService:notFound" });

    const revoked = await connectorGrantModel.revoke(grantId, { authUser: ctx.authUser, tx });
    if (isError(revoked)) return revoked;
    if (!revoked) return newError({ code: "connectorGrantService:notAllowed" });

    const ended = await endGrants([revoked], tx);
    if (ended) return ended;
    return toView(revoked);
  }, ctx);

/** A connection as the lists show it: whether the group's owner is why it can only read. */
export type ConnectorConnectionView = ConnectorGrantView & { readOnlyByOwner: boolean };

/** Adds `readOnlyByOwner` from each grant, its member's current role and its group's setting. */
const withReadOnlyByOwner = async (ctx: ServiceContext, grants: readonly ConnectorGrant[]) => {
  const readOnly = new Map<string, boolean>();
  const views: ConnectorConnectionView[] = [];
  for (const found of grants) {
    if (!readOnly.has(found.groupId)) {
      const group = await careGroupModel.getById(found.groupId, { authUser: SYSTEM_USER, tx: ctx.tx });
      if (isError(group)) return group;
      readOnly.set(found.groupId, group?.connectorsReadOnly ?? false);
    }
    const role = await careGroupMemberModel.getRole(found.groupId, found.userId, { tx: ctx.tx });
    if (isError(role)) return role;
    views.push({
      ...toView(found),
      readOnlyByOwner: readOnlyByOwner(found.scope, role, readOnly.get(found.groupId) ?? false),
    });
  }
  return views;
};

/** The actor's live connections, every group (Settings → Devices). */
export const listMine = async (ctx: ServiceContext) => {
  if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
  const res = await connectorGrantModel.list({
    ...ctx,
    filter: { userId: { type: "eq", value: ctx.authUser.id }, ...live },
    orderBy: [{ field: "consentedAt", direction: "desc" }],
  });
  if (isError(res)) return res;
  return withReadOnlyByOwner(ctx, res.data);
};

/** Every member's live connections to `groupId`: its owners and admins only (the Assistants page). */
export const listForGroup = async (ctx: ServiceContext, groupId: string) => {
  if (!ctx.authUser) return newError({ code: "permissions:unauthenticated" });
  if (!isSystemUser(ctx.authUser)) {
    const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, ctx);
    if (isError(role)) return role;
    if (!role) return newError({ code: "connectorGrantService:notMember" });
    if (!GROUP_MANAGER_ROLES.some((manager) => manager === role)) {
      return newError({ code: "connectorGrantService:notAllowed" });
    }
  }
  const res = await connectorGrantModel.list({
    ...ctx,
    filter: { groupId: { type: "eq", value: groupId }, ...live },
    orderBy: [{ field: "consentedAt", direction: "desc" }],
  });
  if (isError(res)) return res;
  return withReadOnlyByOwner(ctx, res.data);
};

/**
 * A member left or was removed: their connections to the group end with the
 * membership. Runs as the system inside the caller's transaction.
 */
export const revokeForMember = async (tx: Tx, groupId: string, userId: string) => {
  const revoked = await connectorGrantModel.revokeForMember(groupId, userId, SYSTEM_USER.id, tx);
  if (isError(revoked)) return revoked;
  return endGrants(revoked, tx);
};

/** The group's switch went off: every member's connection ends. Inside the caller's transaction. */
export const revokeForGroup = async (tx: Tx, groupId: string) => {
  const revoked = await connectorGrantModel.revokeForGroup(groupId, SYSTEM_USER.id, tx);
  if (isError(revoked)) return revoked;
  const ended = await endGrants(revoked, tx);
  return ended ?? { count: revoked.length };
};

/**
 * The account's sessions ended everywhere (a password reset, "sign out
 * everywhere", staff's sign-out-all or disable): every live grant of the
 * account ends, with its tokens and consent, in every group, as `revoke`
 * does for one. Runs as the system, inside `tx` when given (staff's
 * transactions), else its own. Returns how many grants ended.
 */
export const revokeAllForUser = (userId: string, tx?: Tx) =>
  withTransaction(
    async (inner) => {
      const revoked = await connectorGrantModel.revokeForUser(userId, SYSTEM_USER.id, inner);
      if (isError(revoked)) return revoked;
      const ended = await endGrants(revoked, inner);
      return ended ?? { count: revoked.length };
    },
    tx ? { tx } : {},
  );
