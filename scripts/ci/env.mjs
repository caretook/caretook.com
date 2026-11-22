// The fictional test env a CI run uses, generated fresh for each job. CI reads no
// GitHub secret, and nothing here is a real credential or host: secrets are
// random and start with `fictional-`, URLs are localhost, and the database is
// the job's own throwaway Postgres (trust auth, so its password is never checked).
//
//   node scripts/ci/env.mjs >> "$GITHUB_ENV"
import { randomBytes } from "node:crypto";

/** The Postgres service's port: the integration tests' test port. */
export const CI_PG_PORT = "5435";

export const FICTIONAL_PREFIX = "fictional-";

/** Variables that hold a generated secret or password. */
export const SECRET_NAMES = ["BETTER_AUTH_SECRET", "SEED_USER_PASSWORD"];

/**
 * @param {(bytes: number) => string} [random] hex of that many random bytes
 * @returns {Record<string, string>}
 */
export function ciEnv(random = (bytes) => randomBytes(bytes).toString("hex")) {
  const password = `${FICTIONAL_PREFIX}${random(16)}`;
  return {
    NODE_ENV: "test",
    PG_TEST_PORT: CI_PG_PORT,
    DATABASE_URL: `postgresql://caretook:${password}@localhost:${CI_PG_PORT}/caretook`,
    DATABASE_CONNECT_TIMEOUT_MS: "10000",
    CARETOOK_INT_WORKERS: "3",
    UV_THREADPOOL_SIZE: "8",
    APP_URL: "http://localhost:5173",
    BETTER_AUTH_URL: "http://localhost:5173",
    BETTER_AUTH_SECRET: `${FICTIONAL_PREFIX}${random(32)}`,
    SEED_USER_PASSWORD: `${FICTIONAL_PREFIX}${random(16)}`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [name, value] of Object.entries(ciEnv())) console.log(`${name}=${value}`);
}
