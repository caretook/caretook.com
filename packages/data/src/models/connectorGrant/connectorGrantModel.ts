import type { ConnectorGrant, Tx } from "../../db";
import type { AuthUser } from "../../permissions";

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { SYSTEM_USER } from "../../constants";
import { dbMayFail, txOrDb } from "../../db";
import {
  connectorGrantSchema,
  oauthAccessTokenSchema,
  oauthClientSchema,
  oauthConsentSchema,
  oauthRefreshTokenSchema,
} from "../../db/schema";
import { isError } from "../../errors";
import * as baseModel from "../base";

export const schemaName = "connectorGrantSchema";

export const dbToModel = (row: ConnectorGrant) => row;

const base = baseModel.getFunctions({ schemaName, dbToModel });

// Written only by the system (connectorGrantService); `revoke` is the one
// scoped write: an update allowed where the actor may `delete`.
export const { create, get, getById, list } = base;

const now = sql`now()`;

/**
 * Mark grant `id` revoked if `authUser` may delete it (the member, or the
 * group's owners and admins, in SQL). Returns the grant, or null when it's
 * out of scope or already revoked.
 */
export const revoke = async (id: string, { authUser, tx }: { authUser: AuthUser | null; tx?: Tx }) => {
  const where = baseModel.queryHelpers.generateQueryWhere(schemaName, "delete", {
    authUser,
    filter: { id: { type: "eq", value: id }, revokedAt: { type: "isNull" } },
  });
  if (isError(where)) return where;
  const res = await dbMayFail(
    () =>
      txOrDb(tx)
        .update(connectorGrantSchema)
        .set({ revokedAt: now, updatedBy: authUser?.id ?? SYSTEM_USER.id })
        .where(where)
        .returning(),
    "connectorGrantModel:revoke",
  );
  if (isError(res)) return res;
  return res[0] ? dbToModel(res[0]) : null;
};

/** Revoke every live grant matching `where` (the system's sweeps). Returns them. */
const revokeWhere = async (where: ReturnType<typeof and>, actorId: string, tx: Tx) => {
  const res = await dbMayFail(
    () =>
      tx
        .update(connectorGrantSchema)
        .set({ revokedAt: now, updatedBy: actorId })
        .where(and(where, isNull(connectorGrantSchema.revokedAt)))
        .returning(),
    "connectorGrantModel:revokeAll",
  );
  if (isError(res)) return res;
  return res.map(dbToModel);
};

/** A member's live grants for one group (leaving, removal). */
export const revokeForMember = (groupId: string, userId: string, actorId: string, tx: Tx) =>
  revokeWhere(
    and(eq(connectorGrantSchema.groupId, groupId), eq(connectorGrantSchema.userId, userId)),
    actorId,
    tx,
  );

/** Every live grant of an account, every group and client (its sessions ended everywhere). */
export const revokeForUser = (userId: string, actorId: string, tx: Tx) =>
  revokeWhere(and(eq(connectorGrantSchema.userId, userId)), actorId, tx);

/** Every live grant for a group (the switch turned off). */
export const revokeForGroup = (groupId: string, actorId: string, tx: Tx) =>
  revokeWhere(and(eq(connectorGrantSchema.groupId, groupId)), actorId, tx);

/** A member's live grant for one client (connecting again replaces it). */
export const revokeForClient = (userId: string, clientId: string, actorId: string, tx: Tx) =>
  revokeWhere(
    and(eq(connectorGrantSchema.userId, userId), eq(connectorGrantSchema.oauthClientId, clientId)),
    actorId,
    tx,
  );

/**
 * End what the OAuth plugin issued `userId` for `clientId`: its access and
 * refresh tokens stop working, and its consent goes, so the next authorize
 * comes back to /connect (and a new grant) instead of skipping it. Unscoped:
 * Better Auth's tables; the service has checked the actor.
 */
export const revokeTokens = async (userId: string, clientId: string, tx: Tx) => {
  const access = await dbMayFail(
    () =>
      tx
        .update(oauthAccessTokenSchema)
        .set({ revoked: new Date() })
        .where(
          and(
            eq(oauthAccessTokenSchema.userId, userId),
            eq(oauthAccessTokenSchema.clientId, clientId),
            isNull(oauthAccessTokenSchema.revoked),
          ),
        ),
    "connectorGrantModel:revokeTokens",
  );
  if (isError(access)) return access;
  const refresh = await dbMayFail(
    () =>
      tx
        .update(oauthRefreshTokenSchema)
        .set({ revoked: new Date() })
        .where(
          and(
            eq(oauthRefreshTokenSchema.userId, userId),
            eq(oauthRefreshTokenSchema.clientId, clientId),
            isNull(oauthRefreshTokenSchema.revoked),
          ),
        ),
    "connectorGrantModel:revokeTokens",
  );
  if (isError(refresh)) return refresh;
  const consent = await dbMayFail(
    () =>
      tx
        .delete(oauthConsentSchema)
        .where(and(eq(oauthConsentSchema.userId, userId), eq(oauthConsentSchema.clientId, clientId))),
    "connectorGrantModel:revokeTokens",
  );
  if (isError(consent)) return consent;
  return null;
};

/** The live grant for a user and client, unscoped (verify, which then checks everything else). */
export const getLive = async (userId: string, clientId: string, tx?: Tx) => {
  const res = await dbMayFail(
    () =>
      txOrDb(tx)
        .select()
        .from(connectorGrantSchema)
        .where(
          and(
            eq(connectorGrantSchema.userId, userId),
            eq(connectorGrantSchema.oauthClientId, clientId),
            isNull(connectorGrantSchema.revokedAt),
          ),
        )
        .limit(1),
    "connectorGrantModel:getLive",
  );
  if (isError(res)) return res;
  return res[0] ? dbToModel(res[0]) : null;
};

/** Stamp `last_used_at`, at most once a minute (one statement; no row lock held). */
export const touch = async (id: string, tx?: Tx) => {
  const res = await dbMayFail(
    () =>
      txOrDb(tx)
        .update(connectorGrantSchema)
        .set({ lastUsedAt: now })
        .where(
          and(
            eq(connectorGrantSchema.id, id),
            or(
              isNull(connectorGrantSchema.lastUsedAt),
              lt(connectorGrantSchema.lastUsedAt, sql`now() - interval '1 minute'`),
            ),
          ),
        ),
    "connectorGrantModel:touch",
  );
  return isError(res) ? res : null;
};

/** A registered OAuth client's public face: its name and redirect URIs (never its secret). */
export const getClient = async (clientId: string, tx?: Tx) => {
  const res = await dbMayFail(
    () =>
      txOrDb(tx)
        .select({
          clientId: oauthClientSchema.clientId,
          name: oauthClientSchema.name,
          redirectUris: oauthClientSchema.redirectUris,
          disabled: oauthClientSchema.disabled,
        })
        .from(oauthClientSchema)
        .where(eq(oauthClientSchema.clientId, clientId))
        .limit(1),
    "connectorGrantModel:getClient",
  );
  if (isError(res)) return res;
  return res[0] ?? null;
};
