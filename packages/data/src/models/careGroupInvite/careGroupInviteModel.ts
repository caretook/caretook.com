import type { CareGroupInvite, Tx } from "../../db";
import type { QueryCreateArgs } from "../base/queryHelpers";

import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { dbMayFail, txOrDb } from "../../db";
import { careGroupInviteSchema } from "../../db/schema";
import { isError } from "../../errors";
import * as baseModel from "../base";
import { normalizeEmail } from "../user";

export const schemaName = "careGroupInviteSchema";

/** Invites are looked up by the SHA-256 of their token; the token is never stored. */
export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

// The token hash (and a link's sealed token) never leaves the model layer.
export const dbToModel = ({ tokenHash: _tokenHash, tokenCiphertext: _sealed, ...row }: CareGroupInvite) => ({
  ...row,
  isExpired: new Date(row.expiresAt).getTime() <= Date.now(),
});

const base = baseModel.getFunctions({ schemaName, dbToModel });

// No upsert: invites are created by the service (which makes the token) and
// otherwise only change status.
export const { get, getById, list, remove, update } = base;

// Emails are stored lowercased so they match user.email.
export const create = (args: QueryCreateArgs<typeof schemaName>) =>
  base.create({
    ...args,
    data: {
      ...args.data,
      email: args.data.email == null ? args.data.email : normalizeEmail(args.data.email),
    },
  });

// ---------------------------------------------------------------------------
// Unscoped helpers for careGroupInviteService. Holding the token is what
// entitles someone to an invite, so these skip RBAC: the service decides
// what the holder may see.
// ---------------------------------------------------------------------------

/**
 * The invite whose token is `token`, or null. With `lock` (inside a
 * transaction), the row is locked `FOR UPDATE`, so two accepts of one invite
 * run one after the other.
 */
export const getByToken = async (token: string, opts: { tx?: Tx; lock?: boolean } = {}) => {
  const res = await dbMayFail(() => {
    const query = txOrDb(opts.tx)
      .select()
      .from(careGroupInviteSchema)
      .where(eq(careGroupInviteSchema.tokenHash, hashInviteToken(token)))
      .limit(1);
    return opts.lock ? query.for("update") : query;
  }, "careGroupInviteModel:getByToken");
  if (isError(res)) return res;
  const [row] = res;
  return row ? dbToModel(row) : null;
};

/**
 * A link invite's sealed token (see utils/linkToken.ts), or null. Only for
 * careGroupInviteService.copyLink, after it has read the invite in the
 * actor's scope.
 */
export const getSealedToken = async (id: string, opts: { tx?: Tx } = {}) => {
  const res = await dbMayFail(
    () =>
      txOrDb(opts.tx)
        .select({ sealed: careGroupInviteSchema.tokenCiphertext })
        .from(careGroupInviteSchema)
        .where(and(eq(careGroupInviteSchema.id, id), eq(careGroupInviteSchema.kind, "link")))
        .limit(1),
    "careGroupInviteModel:getSealedToken",
  );
  if (isError(res)) return res;
  return res[0]?.sealed ?? null;
};
