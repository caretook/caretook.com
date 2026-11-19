import { adminGrantService } from "../src/services";
import { ADMIN_GRANT_USAGE, parseAdminGrantArgs } from "../src/utils/adminGrantArgs";
import { run } from "./run";

// pnpm admin:grant <email> [--role admin|support]: make an existing account
// Caretook staff, recorded in the audit log with no actor (the system).

const args = parseAdminGrantArgs(process.argv.slice(2));
if ("error" in args) {
  console.error(`${args.error}\n${ADMIN_GRANT_USAGE}`);
  process.exit(1);
}

await run(`Grant ${args.role} to ${args.email}`, async () => {
  const res = await adminGrantService.grant(args);
  if (!("changed" in res) || res.changed) return res;
  console.log(`${res.email} already had the ${res.role} role: nothing changed`);
  return res;
});
