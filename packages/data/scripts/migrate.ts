import { migrate } from "../src/db/migrate";
import { isError } from "../src/errors";
import { backfill } from "../src/services/symptomTypeService";
import { migrationsDatabaseUrl } from "../src/utils/dbAccessArgs";
import { loadEnv } from "../src/utils/loadEnv";
import { run } from "./run";

// pnpm datastore:migrate: apply pending migrations. Like db:roles, it runs as
// the migrations role (MIGRATIONS_DATABASE_URL) in a deployed environment
// (APP_ENV set; the deploy Action), and with DATABASE_URL in development and
// tests, so the app role is never asked to run DDL. After the SQL, the data
// steps SQL can't do: the symptom catalog's backfill (idempotent).

loadEnv();
const conn = migrationsDatabaseUrl(process.env);
if ("error" in conn) {
  console.error(conn.error);
  process.exit(1);
}
process.env.DATABASE_URL = conn.url;

await run("Database migrated", async () => {
  const migrated = await migrate();
  if (isError(migrated)) return migrated;
  const symptoms = await backfill();
  if (isError(symptoms)) return symptoms;
  const { groups, defaults, history, unreadable } = symptoms;
  console.log(`Symptom catalog: ${groups} group(s), ${defaults} default(s) and ${history} name(s) added`);
  if (unreadable.length)
    console.warn(`Symptom catalog: ${unreadable.length} entry name(s) unreadable: ${unreadable.join(", ")}`);
  return migrated;
});
