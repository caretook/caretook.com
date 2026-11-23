// The fictional test env a CI run uses, generated fresh for each job. CI reads no
// GitHub secret, and nothing here is a real credential or host: secrets are
// random and start with `fictional-`, URLs are localhost, and the database is
// the job's own throwaway Postgres, whose password the workflow's plan job
// generates per run and passes in as CI_PG_PASSWORD.
//
//   node scripts/ci/env.mjs >> "$GITHUB_ENV"         the test jobs
//   node scripts/ci/env.mjs build >> "$GITHUB_ENV"   the build job
//   node scripts/ci/env.mjs browser >> "$GITHUB_ENV" the browser job
//   node scripts/ci/env.mjs zone >> "$GITHUB_ENV"    moves a job to the second zone
import { randomBytes } from "node:crypto";

import { PRIMARY_ZONE, secondZoneEnv } from "./zones.mjs";

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

/** The zone CI's server and runner use: the one the browser contexts pin. */
export const CI_ZONE = PRIMARY_ZONE;

/** The browser job's Compose project, and so its Postgres container's name. */
export const CI_STACK = "caretook-ci";

const CI_WEB_PORT = "5173";
const CI_STACK_PG_PORT = "5434";

/**
 * The env for the browser job: a check build served on this runner against the
 * Docker stack. NODE_ENV stays unset, since the seed refuses production and the
 * build and server steps set their own. The database password is
 * docker-compose.yml's local one. The server binds every interface because on
 * Linux `host.docker.internal` is the bridge address, where PowerSync's
 * container fetches the JWKS.
 * @param {Parameters<typeof ciEnv>} args
 * @returns {Record<string, string>}
 */
export function ciBrowserEnv(...args) {
  const [random = (/** @type {number} */ bytes) => randomBytes(bytes).toString("hex")] = args;
  const env = { ...ciBuildEnv(random, args[1]) };
  delete env.NODE_ENV;
  delete env.PG_TEST_PORT;
  return {
    ...env,
    CARETOOK_STACK: CI_STACK,
    PG_CONTAINER: `${CI_STACK}-postgres-1`,
    PG_PORT: CI_STACK_PG_PORT,
    DATABASE_URL: `postgresql://caretook:password@localhost:${CI_STACK_PG_PORT}/caretook`,
    POWERSYNC_PORT: "8080",
    PS_JWKS_URL: `http://host.docker.internal:${CI_WEB_PORT}/api/auth/jwks`,
    BASE: `http://localhost:${CI_WEB_PORT}`,
    HOST: "0.0.0.0",
    PORT: CI_WEB_PORT,
    TZ: CI_ZONE,
    VITE_CHECK_BUILD: "1",
    MAIL_SENDER: "log",
    INVITE_LINK_KEY: `${FICTIONAL_PREFIX}${random(32)}`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const makers = { build: ciBuildEnv, browser: ciBrowserEnv, zone: secondZoneEnv };
  const env = (makers[/** @type {keyof typeof makers} */ (process.argv[2])] ?? ciEnv)();
  for (const [name, value] of Object.entries(env)) console.log(`${name}=${value}`);
}
