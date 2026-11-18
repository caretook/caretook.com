import { join } from "node:path";

/**
 * Load `.env.<NODE_ENV>.local`, `.env.<NODE_ENV>`, then `.env` from `dir` (a
 * small stand-in for dotenv-flow). Variables already set win: real env vars
 * beat every file, and earlier files beat later ones. Missing files are
 * skipped. `.local` files are uncommitted (a loop's test database port).
 *
 * For CLI scripts and drizzle.config.ts only; deployed apps get real env vars.
 */
export const loadEnv = (dir = process.cwd()) => {
  const env = process.env.NODE_ENV;
  const files = [env && `.env.${env}.local`, env && `.env.${env}`, ".env"];

  for (const file of files) {
    if (!file) continue;
    try {
      process.loadEnvFile(join(dir, file));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
};
