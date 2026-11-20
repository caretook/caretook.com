// `pnpm db:access` and `pnpm db:roles` (hosting PRD): the command line and
// the connection they use, parsed. Pure, so they're unit-tested; the
// scripts in packages/data/scripts run them.

export const DB_ACCESS_USAGE = `Usage:
  pnpm db:access grant <email> --hours N [--reason "why"]   (N is 1–24)
  pnpm db:access revoke <email> [--reason "why"]
  pnpm db:access list`;

export type DbAccessArgs =
  | { command: "grant"; email: string; hours: number; reason?: string }
  | { command: "revoke"; email: string; reason?: string }
  | { command: "list" }
  | { error: string };

/** `argv` without node and the script. */
export const parseDbAccessArgs = (argv: readonly string[]): DbAccessArgs => {
  const args = argv.filter((a) => a !== "--");
  const [command, ...rest] = args;
  if (command !== "grant" && command !== "revoke" && command !== "list")
    return { error: command ? `Unknown command ${command}` : "Give a command" };

  let email: string | undefined;
  let hours: string | undefined;
  let reason: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] ?? "";
    const [flag, inline] = arg.startsWith("--") && arg.includes("=") ? arg.split(/=(.*)/s) : [arg, undefined];
    if (flag === "--hours" || flag === "--reason") {
      const value = inline ?? rest[++i];
      if (value === undefined || value === "") return { error: `${flag} needs a value` };
      if (flag === "--hours") hours = value;
      else reason = value.trim();
    } else if (arg.startsWith("-")) {
      return { error: `Unknown option ${arg}` };
    } else if (email === undefined && command !== "list") {
      email = arg.trim();
    } else {
      return { error: `Unexpected argument ${arg}` };
    }
  }

  if (command === "list") {
    if (hours !== undefined || reason !== undefined) return { error: "list takes no options" };
    return { command };
  }
  if (!email) return { error: "Give the staff account's email address" };
  if (reason !== undefined && (reason.length < 1 || reason.length > 500))
    return { error: "--reason is 1–500 characters" };
  if (command === "revoke") {
    if (hours !== undefined) return { error: "revoke takes no --hours" };
    return { command, email, ...(reason ? { reason } : {}) };
  }
  if (hours === undefined) return { error: "grant needs --hours N (1–24)" };
  if (!/^\d+$/.test(hours) || Number(hours) < 1 || Number(hours) > 24)
    return { error: "--hours must be a whole number from 1 to 24" };
  return { command, email, hours: Number(hours), ...(reason ? { reason } : {}) };
};

/**
 * The connection the role scripts use: MIGRATIONS_DATABASE_URL (they need
 * CREATEROLE and DDL), or in development, with no APP_ENV, DATABASE_URL.
 * A deployed environment (APP_ENV set) without it is refused, so the app
 * role is never tried.
 */
export const migrationsDatabaseUrl = (env: {
  MIGRATIONS_DATABASE_URL?: string;
  DATABASE_URL?: string;
  APP_ENV?: string;
}): { url: string } | { error: string } => {
  if (env.MIGRATIONS_DATABASE_URL) return { url: env.MIGRATIONS_DATABASE_URL };
  if (env.APP_ENV) return { error: `MIGRATIONS_DATABASE_URL is required with APP_ENV=${env.APP_ENV}` };
  if (env.DATABASE_URL) return { url: env.DATABASE_URL };
  return { error: "Set MIGRATIONS_DATABASE_URL (or DATABASE_URL in development)" };
};

/** `url` with another role's credentials: the connection string a grant prints once. */
export const connectionStringFor = (url: string, role: string, password: string) => {
  const out = new URL(url);
  out.username = encodeURIComponent(role);
  out.password = encodeURIComponent(password);
  return out.toString();
};
