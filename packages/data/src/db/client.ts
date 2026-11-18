import type { Tx } from "./types";
import type { AppError, ErrorCode } from "../errors";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getDbConfig } from "../config";
import { isError, newError } from "../errors";
import { forget, remember } from "../utils/remember";
import * as schema from "./schema";

// Only tables (and later relations) belong in the drizzle schema object.
// Column helpers and Zod schemas are ignored by drizzle, so passing the
// whole module is fine.
export const getSchema = <K extends keyof typeof schema>(name: K) => schema[name];

const POOL_KEY = "caretook:db-pool";

const createPool = () => {
  const { url, maxPool } = getDbConfig();
  if (!url) throw newError({ code: "db:missingUrl" });
  return new pg.Pool({
    connectionString: url,
    max: maxPool,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  });
};

// { schema } enables the relational query API (db.query.userSchema...).
const createDb = (pool: pg.Pool) => drizzle({ client: pool, schema, logger: getDbConfig().debug });

// The pool is kept across dev-server HMR reloads (one set of connections).
// The drizzle wrapper isn't: it holds the schema, so it's rebuilt when this
// module reloads, and new tables work without restarting the server.
let db: ReturnType<typeof createDb> | null = null;

/** Lazily create the pool on first use, so importing never needs DATABASE_URL. */
export const getDb = () => (db ??= createDb(remember(POOL_KEY, createPool)));

export type Db = ReturnType<typeof createDb>;

export const txOrDb = (tx?: Tx) => tx ?? getDb();

/**
 * Run a db operation and return failures as an AppError instead of throwing.
 * Takes a thunk (not a promise) so a synchronous throw, such as getDb() with
 * no DATABASE_URL, is caught too. AppErrors pass through with their own code.
 */
export const dbMayFail = async <T>(
  run: () => PromiseLike<T>,
  code: ErrorCode,
  meta?: Record<string, unknown>,
): Promise<T | AppError> => {
  try {
    return await run();
  } catch (cause) {
    return isError(cause) ? cause : newError({ code, cause, meta });
  }
};

/** Check the connection works. */
export const initClient = () => dbMayFail(() => getDb().execute(sql`SELECT 1`), "db:connect");

export const endClient = async () => {
  await getDb().$client.end();
  forget(POOL_KEY);
  db = null;
};

/**
 * Run `fn` in a transaction, reusing `opts.tx` when already inside one.
 *
 * Because errors are returned rather than thrown, a plain drizzle transaction
 * would COMMIT when `fn` returns an AppError. This rolls back instead and
 * returns that error.
 */
export const withTransaction = async <T>(
  fn: (tx: Tx) => Promise<T>,
  opts: { tx?: Tx } = {},
): Promise<T | AppError> => {
  if (opts.tx) return fn(opts.tx);

  let failure: AppError | undefined;
  const res = await dbMayFail(
    () =>
      getDb().transaction(async (tx) => {
        const result = await fn(tx);
        if (isError(result)) {
          failure = result;
          tx.rollback();
        }
        return result;
      }),
    "db:transaction",
  );

  return failure ?? res;
};
