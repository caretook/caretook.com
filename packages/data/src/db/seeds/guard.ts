/**
 * Where the fictional seed may run (hosting slice 1). Pure, so the rules have
 * unit tests; `seed()` applies them before anything connects.
 *
 * - Never with `APP_ENV=production`: fictional data must never sit beside real data.
 * - On staging (`APP_ENV=staging`, a hosted database) only with a secret
 *   `SEED_USER_PASSWORD`: staging is public, and the dev password is in this repo.
 *   And with `INVITE_LINK_KEY`, so the seeded link invite is sealed with the
 *   key staging's server opens it with (B-830).
 * - Otherwise only a local database, and never with `NODE_ENV=production`.
 */

/** The dev password every seeded account shares (packages/data/.env.example). */
export const DEV_SEED_PASSWORD = "caretook-dev-password";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

export type SeedEnv = {
  APP_ENV?: string;
  NODE_ENV?: string;
  DATABASE_URL?: string;
  SEED_USER_PASSWORD?: string;
  INVITE_LINK_KEY?: string;
};

export type SeedRefusal =
  "db:seed:production" | "db:seed:notLocal" | "db:seed:password" | "db:seed:appEnv" | "db:seed:linkKey";

const isLocal = (url: string | undefined) => {
  try {
    return LOCAL_HOSTS.includes(new URL(url ?? "").hostname);
  } catch {
    return false;
  }
};

/** Why the seed must not run here, or null when it may. */
export const seedRefusal = (env: SeedEnv): SeedRefusal | null => {
  const appEnv = env.APP_ENV?.trim();
  if (appEnv === "production") return "db:seed:production";
  if (appEnv === "staging") {
    const password = env.SEED_USER_PASSWORD?.trim();
    if (!password || password === DEV_SEED_PASSWORD) return "db:seed:password";
    return env.INVITE_LINK_KEY?.trim() ? null : "db:seed:linkKey";
  }
  if (appEnv) return "db:seed:appEnv";
  if (env.NODE_ENV === "production") return "db:seed:production";
  return isLocal(env.DATABASE_URL) ? null : "db:seed:notLocal";
};
