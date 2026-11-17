import { endClient } from "../src/db/client";
import { isError } from "../src/errors";
import { loadEnv } from "../src/utils/loadEnv";

/**
 * Shared runner for datastore CLI scripts: loads env files, runs the task,
 * prints the outcome, closes the pool, and sets the exit code. A task that
 * resolves to an AppError is reported as a failure.
 */
export const run = async (name: string, task: () => Promise<unknown>) => {
  loadEnv();

  const res = await task();
  await endClient();

  if (isError(res)) {
    console.error(`❌ ${name} failed: [${String(res.code)}] ${res.message}`);
    if (res.cause) console.error(res.cause);
    process.exit(1);
  }

  console.log(`✅ ${name}`);
};
