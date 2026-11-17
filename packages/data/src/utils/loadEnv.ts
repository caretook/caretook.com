import { join } from "node:path";

/**
 * Load `.env.<NODE_ENV>` then `.env` from `dir` (a small stand-in for
 * dotenv-flow). Variables already set win: real env vars beat both files,
 * and `.env.<NODE_ENV>` beats `.env`. Missing files are skipped.
 *
 * For CLI scripts and drizzle.config.ts only; deployed apps get real env vars.
 */
export const loadEnv = (dir = process.cwd()) => {
  const files = [process.env.NODE_ENV && `.env.${process.env.NODE_ENV}`, ".env"];

  for (const file of files) {
    if (!file) continue;
    try {
      process.loadEnvFile(join(dir, file));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
};
