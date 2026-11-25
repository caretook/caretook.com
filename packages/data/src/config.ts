export type DbConfig = {
  url: string | undefined;
  maxPool: number;
  /** How long the pool waits for a new connection before failing the query. */
  connectTimeoutMs: number;
  debug: boolean;
};

export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

// Read lazily so importing the package never requires env vars (typecheck,
// builds, and client-safe entry points don't touch the database).
export const getDbConfig = (): DbConfig => ({
  url: process.env.DATABASE_URL,
  maxPool: Number(process.env.DATABASE_MAX_POOL) || 10,
  // 10 s lets a burst of uploads queue for the pool's clients instead of
  // failing (B-342); the integration tests use the same (packages/data/test/env.ts).
  connectTimeoutMs: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) || DEFAULT_CONNECT_TIMEOUT_MS,
  debug: process.env.DB_DEBUG === "true",
});
