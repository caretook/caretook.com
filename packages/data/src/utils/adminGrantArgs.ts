// `pnpm admin:grant <email> [--role admin|support]`: the command line, parsed.
// Pure, so it's unit-tested; scripts/adminGrant.ts runs it.

export const ADMIN_GRANT_USAGE = "Usage: pnpm admin:grant <email> [--role admin|support]";

export type AdminGrantArgs = { email: string; role: string } | { error: string };

/** `argv` without node and the script: an email and an optional `--role` (default admin). */
export const parseAdminGrantArgs = (argv: readonly string[]): AdminGrantArgs => {
  let email: string | undefined;
  let role = "admin";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined || arg === "--") continue;
    if (arg === "--role") {
      const value = argv[++i];
      if (!value) return { error: "--role needs a value" };
      role = value;
    } else if (arg.startsWith("--role=")) {
      role = arg.slice("--role=".length);
    } else if (arg.startsWith("-")) {
      return { error: `Unknown option ${arg}` };
    } else if (email === undefined) {
      email = arg.trim();
    } else {
      return { error: `Unexpected argument ${arg}` };
    }
  }
  if (!email) return { error: "Give the account's email address" };
  if (role !== "admin" && role !== "support") return { error: "--role must be admin or support" };
  return { email, role };
};
