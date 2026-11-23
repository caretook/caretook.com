export type DbConfig = {
  url: string | undefined;
  maxPool: number;
  /** How long the pool waits for a new connection before failing the query. */
  connectTimeoutMs: number;
  debug: boolean;
};

// Read lazily so importing the package never requires env vars (typecheck,
// builds, and client-safe entry points don't touch the database).
export const getDbConfig = (): DbConfig => ({
  url: process.env.DATABASE_URL,
  maxPool: Number(process.env.DATABASE_MAX_POOL) || 10,
  // 2 s fails fast on serverless; the integration tests set more (B-388,
  // packages/data/test/env.ts).
  connectTimeoutMs: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) || 2000,
  debug: process.env.DB_DEBUG === "true",
});
