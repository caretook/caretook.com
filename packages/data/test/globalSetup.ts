import { clear } from "../src/db/clear";
import { endClient } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { isError } from "../src/errors";
import { loadTestEnv } from "./env";

// Runs once per `vitest` run, before any integration file: start from an
// empty, fully migrated test database.
export default async function setup() {
  loadTestEnv();

  for (const step of [clear, migrate]) {
    const res = await step();
    if (isError(res)) {
      await endClient();
      throw new Error(
        `Test database setup failed (${String(res.code)}). Is it running? pnpm datastore:up:test`,
        {
          cause: res.cause ?? res,
        },
      );
    }
  }
  await endClient();
}
