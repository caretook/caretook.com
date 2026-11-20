import { applyRoles } from "../src/db/roles";
import { isError } from "../src/errors";
import { migrationsDatabaseUrl } from "../src/utils/dbAccessArgs";
import { loadEnv } from "../src/utils/loadEnv";
import { run } from "./run";

// pnpm db:roles (hosting PRD): create or update the app, migrations and
// replication roles and the `powersync` publication from
// powersync/sync-config.yaml, then print what each role holds. Idempotent;
// the deploy runs it after every migration. Runs with MIGRATIONS_DATABASE_URL.
// Roles are created without passwords: the runbook sets them.

loadEnv();
const conn = migrationsDatabaseUrl(process.env);
if ("error" in conn) {
  console.error(conn.error);
  process.exit(1);
}
process.env.DATABASE_URL = conn.url;

await run("Apply database roles", async () => {
  const res = await applyRoles();
  if (isError(res)) return res;
  const { summary } = res;
  for (const role of summary.roles) {
    const privileges = Object.entries(role.tablePrivileges)
      .map(([p, n]) => `${p} on ${n} tables`)
      .join(", ");
    console.log(
      `\n${role.role}${role.replication ? " (REPLICATION)" : ""}${role.canCreateInSchema ? " (CREATE in public)" : ""}`,
    );
    if (privileges) console.log(`  ${privileges}`);
    for (const [table, columns] of Object.entries(role.columns))
      console.log(`  SELECT (${columns.join(", ")}) ON ${table}`);
  }
  console.log(`\npublication ${res.generated.names.publication}`);
  for (const [table, columns] of Object.entries(summary.publication))
    console.log(`  ${table} (${columns.join(", ")})`);
  return res;
});
