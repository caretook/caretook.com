import type { AppError } from "../errors";

import { lt, sql } from "drizzle-orm";
import { dbMayFail, getDb, withTransaction } from "../db";
import { RATE_LIMIT_LONGEST_WINDOW_MS, rateLimitHitSchema, rateLimitSchema } from "../db/schema";
import { isError } from "../errors";

// Shared rate limits (hosting PRD, slice 3): the Postgres side of
// `packages/api/src/rateLimit.ts`'s `postgresStore`, and the purge the
// outbox cron runs. Not a model service: the tables are the system's only
// and hold no one's data, so the queries are direct, like the outbox's.

const hits = rateLimitHitSchema;

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Count a hit for `key` if it has fewer than `limit` in the window
 * `(now - windowMs, now]`; true when it was counted. Hits for one key are
 * serialized by a transaction-scoped advisory lock on the key, and the
 * count and insert are one statement, so instances sharing the table can't
 * both take the last slot.
 */
export const hit = ({
  key,
  now,
  windowMs,
  limit,
}: {
  key: string;
  now: number;
  windowMs: number;
  limit: number;
}): Promise<boolean | AppError> =>
  withTransaction(async (tx) => {
    const done = await dbMayFail(async () => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
      return tx.execute(sql`
        INSERT INTO ${hits} (${sql.identifier(hits.key.name)}, ${sql.identifier(hits.hitAt.name)})
        SELECT ${key}, ${iso(now)}::timestamptz
        WHERE (
          SELECT count(*) FROM ${hits}
          WHERE ${hits.key} = ${key} AND ${hits.hitAt} > ${iso(now - windowMs)}::timestamptz
        ) < ${limit}
        RETURNING ${hits.id}`);
    }, "rateLimitService:store");
    return isError(done) ? done : done.rows.length > 0;
  });

/** Forget every hit whose key starts with `prefix` (tests' resets). */
export const clear = async (prefix: string): Promise<number | AppError> => {
  const removed = await dbMayFail(
    () =>
      getDb()
        .delete(hits)
        .where(sql`starts_with(${hits.key}, ${prefix})`)
        .returning({ id: hits.id }),
    "rateLimitService:store",
  );
  return isError(removed) ? removed : removed.length;
};

/**
 * Delete rate-limit rows older than the longest window
 * (RATE_LIMIT_LONGEST_WINDOW_MS): our limiter's hits, and Better Auth's
 * counters whose last request is that old (its windows are shorter, so
 * they've expired). Run by the outbox cron's sweep. Returns how many of each.
 */
export const purge = async ({ now = Date.now() }: { now?: number } = {}): Promise<
  { hits: number; authCounters: number } | AppError
> => {
  const cutoff = now - RATE_LIMIT_LONGEST_WINDOW_MS;
  const removed = await dbMayFail(async () => {
    const db = getDb();
    const oldHits = await db
      .delete(hits)
      .where(lt(hits.hitAt, iso(cutoff)))
      .returning({ id: hits.id });
    const oldCounters = await db
      .delete(rateLimitSchema)
      .where(lt(rateLimitSchema.lastRequest, cutoff))
      .returning({ id: rateLimitSchema.id });
    return { hits: oldHits.length, authCounters: oldCounters.length };
  }, "rateLimitService:store");
  return removed;
};
