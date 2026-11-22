// The fictional test env a CI run uses, generated fresh for each job. CI reads no
// GitHub secret, and nothing here is a real credential or host: secrets are
// random and start with `fictional-`, URLs are localhost, and the database is
// the job's own throwaway Postgres, whose password the workflow's plan job
// generates per run and passes in as CI_PG_PASSWORD.
//
//   node scripts/ci/env.mjs >> "$GITHUB_ENV"         the test jobs
//   node scripts/ci/env.mjs build >> "$GITHUB_ENV"   the build job
import { randomBytes } from "node:crypto";

/** The Postgres service's port: the integration tests' test port. */
export const CI_PG_PORT = "5435";

export const FICTIONAL_PREFIX = "fictional-";

/** Variables that hold a generated secret or password. */
export const SECRET_NAMES = ["BETTER_AUTH_SECRET", "SEED_USER_PASSWORD"];

/**
 * @param {(bytes: number) => string} [random] hex of that many random bytes
 * @param {string} [dbPassword] the Postgres service's password, when the job has one
 * @returns {Record<string, string>}
 */
export function ciEnv(
  random = (bytes) => randomBytes(bytes).toString("hex"),
  dbPassword = process.env.CI_PG_PASSWORD,
) {
  const password = dbPassword || `${FICTIONAL_PREFIX}${random(16)}`;
  if (!password.startsWith(FICTIONAL_PREFIX)) throw new Error("CI_PG_PASSWORD must be marked fictional");
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

/** What a build reads that the build job leaves unset on purpose, and why. */
export const BUILD_UNSET = {
  APP_ENV: "only a deployed build names its environment",
  BUILD_TARGET: "set by `build:native` itself",
  VERCEL: "Vercel's preset is for the deploy; CI keeps the plain build",
  VITE_CHECK_BUILD: "would keep window.caretookSync, which the job greps for",
  VITEST: "set only by Vitest",
  WEB_PORT: "the dev server's",
};

/**
 * The env for production builds: the test env's fictional values, plus the public
 * URLs bundled into the client. The API origin stays empty, as on the web.
 * @param {Parameters<typeof ciEnv>} args
 * @returns {Record<string, string>}
 */
export function ciBuildEnv(...args) {
  return {
    ...ciEnv(...args),
    NODE_ENV: "production",
    POWERSYNC_URL: "http://localhost:8080",
    VITE_POWERSYNC_URL: "http://localhost:8080",
    VITE_API_ORIGIN: "",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = process.argv[2] === "build" ? ciBuildEnv() : ciEnv();
  for (const [name, value] of Object.entries(env)) console.log(`${name}=${value}`);
}
