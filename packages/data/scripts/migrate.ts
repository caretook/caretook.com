import { migrate } from "../src/db/migrate";
import { migrationsDatabaseUrl } from "../src/utils/dbAccessArgs";
import { loadEnv } from "../src/utils/loadEnv";
import { run } from "./run";

// pnpm datastore:migrate: apply pending migrations. Like db:roles, it runs as
// the migrations role (MIGRATIONS_DATABASE_URL) in a deployed environment
// (APP_ENV set; the deploy Action), and with DATABASE_URL in development and
// tests, so the app role is never asked to run DDL.

loadEnv();
const conn = migrationsDatabaseUrl(process.env);
if ("error" in conn) {
  console.error(conn.error);
  process.exit(1);
}
process.env.DATABASE_URL = conn.url;

await run("Database migrated", migrate);
