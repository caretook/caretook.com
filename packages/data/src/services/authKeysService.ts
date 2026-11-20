import { and, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { dbMayFail, withTransaction } from "../db";
import { auditChanges, JWKS_GRACE_SECONDS, jwksSchema } from "../db/schema";
import { isError } from "../errors";
import * as adminAuditService from "./adminAuditService";

// The JWT signing keys (hosting slice 9, `pnpm auth:rotate-jwks`). Better
// Auth's jwt plugin signs with the newest key that hasn't expired and makes
// a new one when none is left, so rotating is expiring the live keys: the
// next token request makes a key encrypted with the current secret. Tokens
// the old key signed (15 minutes) still verify while its public half stays
// in the JWKS (`JWKS_GRACE_SECONDS`). Writes no secret: it needs only the
// database, never BETTER_AUTH_SECRET.

export const ROTATE_REASON = "Rotated with pnpm auth:rotate-jwks";

export type RotateResult = {
  /** The keys (`kid`s) that stopped signing now. */
  retired: string[];
  /** Keys retired longer ago than the grace period, deleted. */
  deleted: string[];
};

/**
 * Expire every live signing key and delete keys retired more than
 * `JWKS_GRACE_SECONDS` ago, recorded as `auth.jwksRotated` (the system as
 * actor) in the same transaction. With no key yet, it records an empty
 * rotation; the first token makes the first key.
 */
export const rotate = ({ reason = ROTATE_REASON, now = new Date() }: { reason?: string; now?: Date } = {}) =>
  withTransaction(async (tx) => {
    const keys = jwksSchema;
    const retired = await dbMayFail(
      () =>
        tx
          .update(keys)
          .set({ expiresAt: now })
          .where(or(isNull(keys.expiresAt), gt(keys.expiresAt, now)))
          .returning({ id: keys.id }),
      "authKeys:failed",
    );
    if (isError(retired)) return retired;

    const cutoff = new Date(now.getTime() - JWKS_GRACE_SECONDS * 1000);
    const old = await dbMayFail(
      () =>
        tx
          .delete(keys)
          // The keys just retired expire at `now`, after the cutoff: they stay.
          .where(and(isNotNull(keys.expiresAt), lt(keys.expiresAt, cutoff)))
          .returning({ id: keys.id }),
      "authKeys:failed",
    );
    if (isError(old)) return old;

    const result: RotateResult = { retired: retired.map((k) => k.id), deleted: old.map((k) => k.id) };
    const recorded = await adminAuditService.record(tx, {
      actorId: null,
      action: "auth.jwksRotated",
      reason,
      changes: auditChanges(null, result, ["retired", "deleted"]),
    });
    if (isError(recorded)) return recorded;
    return result;
  });
