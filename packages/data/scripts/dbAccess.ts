import { randomPassword } from "../src/db/roles";
import { isError } from "../src/errors";
import { dbAccessService } from "../src/services";
import {
  connectionStringFor,
  DB_ACCESS_USAGE,
  migrationsDatabaseUrl,
  parseDbAccessArgs,
} from "../src/utils/dbAccessArgs";
import { loadEnv } from "../src/utils/loadEnv";
import { run } from "./run";

// pnpm db:access grant <email> --hours N | revoke <email> | list (hosting PRD):
// a staff member's personal, read-only, expiring database role, recorded in
// the audit log. Runs with MIGRATIONS_DATABASE_URL. The connection string
// is printed once and never logged anywhere else.

const args = parseDbAccessArgs(process.argv.slice(2));
if ("error" in args) {
  console.error(`${args.error}\n${DB_ACCESS_USAGE}`);
  process.exit(1);
}

loadEnv();
const conn = migrationsDatabaseUrl(process.env);
if ("error" in conn) {
  console.error(conn.error);
  process.exit(1);
}
// The pool reads DATABASE_URL on first use: point it at the migrations role.
process.env.DATABASE_URL = conn.url;

if (args.command === "grant") {
  await run(`Grant database access to ${args.email}`, async () => {
    const res = await dbAccessService.grant({ ...args, password: randomPassword() });
    if (isError(res)) return res;
    console.log(`Role ${res.role}, read-only, valid until ${res.validUntil}.`);
    console.log("Connection string (shown once; keep it out of chat, tickets and shell history):");
    console.log(connectionStringFor(conn.url, res.role, res.password));
    return res;
  });
} else if (args.command === "revoke") {
  await run(`Revoke database access from ${args.email}`, async () => {
    const res = await dbAccessService.revoke(args);
    if (isError(res)) return res;
    console.log(res.dropped ? `Dropped ${res.role}.` : `${res.email} had no database role: nothing to do.`);
    return res;
  });
} else {
  await run("List personal database roles", async () => {
    const res = await dbAccessService.list();
    if (isError(res)) return res;
    if (res.length === 0) console.log("No personal database roles.");
    for (const r of res)
      console.log(
        `${r.role}  ${r.expired ? "EXPIRED" : "valid until"} ${r.validUntil ?? "never"}  user ${r.userId ?? "?"}`,
      );
    return res;
  });
}
