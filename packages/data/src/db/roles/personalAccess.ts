import type { SchemaTables } from "./syncConfig";

import { ident } from "./rolesSql";

// What a personal `staff_` role (`pnpm db:access`, hosting slices 2 and 9)
// may read: every table in the schema except the secrets. Pure, so the SQL
// and the list's coverage are unit-tested (personalAccess.test.ts fails on a
// new table or column that looks secret and isn't listed below).

/**
 * Never readable through personal access. A bare name is a whole table; a
 * `table.column` entry keeps that column out (the table's other columns
 * become a column grant).
 */
export const PERSONAL_ACCESS_EXCLUDED = [
  // Better Auth: password hashes and OAuth tokens, session tokens, sign-in
  // links' and codes' values, and the JWT signing keys.
  "account",
  "session",
  "verification",
  "jwks",
  // Rate limits: keyed by client IP and email address.
  "rate_limit",
  "rate_limit_hit",
  // Invites: the link token's hash and its sealed copy (INVITE_LINK_KEY).
  "care_group_invite.token_hash",
  "care_group_invite.token_ciphertext",
  // An access code is itself the sign-up credential.
  "access_code.code",
  // Emails carry sign-in links and codes, reset links and invite links.
  "notification_outbox.html",
  "notification_outbox.text",
  "dev_mail.html",
  "dev_mail.text",
  // The OAuth provider plugin (connectors): access and refresh tokens (hashed,
  // plus a rotated refresh token's replayable response), and client secrets.
  "oauth_access_token",
  "oauth_refresh_token",
  "oauth_client.client_secret",
  // A member's calendar feed URL holds its token; only the hash is stored (appointments-2).
  "member_calendar_setting.feed_token_hash",
  // Google Calendar: the sealed refresh token, the sync token, and a Connect's state and PKCE verifier.
  "google_calendar_connection.refresh_token_sealed",
  "google_calendar_connection.sync_token",
  "google_oauth_state",
] as const;

/** A table or column name that looks like it holds a secret. */
export const SECRET_LOOKING = /token|secret|hash|password|private/i;

/**
 * Secret-looking names that are deliberately readable, with why: add
 * `table.column` here only when the name misleads.
 */
export const PERSONAL_ACCESS_ALLOWED: readonly string[] = [
  // The OAuth plugin's settings, not tokens: how a client authenticates,
  // whether tokens are sender-bound, and token lifetimes.
  "oauth_client.token_endpoint_auth_method",
  "oauth_client.dpop_bound_access_tokens",
  "oauth_resource.access_token_ttl",
  "oauth_resource.refresh_token_ttl",
  "oauth_resource.dpop_bound_access_tokens_required",
  // A content hash of a Google event as last pushed (to skip unchanged ones), not a secret.
  "google_event_link.pushed_hash",
];

const excludedTables = () => new Set<string>(PERSONAL_ACCESS_EXCLUDED.filter((e) => !e.includes(".")));
const excludedColumns = () => new Set<string>(PERSONAL_ACCESS_EXCLUDED.filter((e) => e.includes(".")));

export type PersonalAccessGrants = {
  /** Tables read whole (a table-level SELECT). */
  tables: string[];
  /** Tables read without some columns: the columns granted. */
  columns: Record<string, string[]>;
};

/** What a personal role gets on `tables` (the Drizzle schema's, `schemaTables()`). */
export const personalAccessGrants = (tables: SchemaTables): PersonalAccessGrants => {
  const skipTables = excludedTables();
  const skipColumns = excludedColumns();
  const out: PersonalAccessGrants = { tables: [], columns: {} };
  for (const [table, cols] of Object.entries(tables)) {
    if (skipTables.has(table)) continue;
    const readable = cols.filter((c) => !skipColumns.has(`${table}.${c}`));
    if (readable.length === cols.length) out.tables.push(table);
    else if (readable.length) out.columns[table] = readable;
  }
  return out;
};

/**
 * Problems with the list against `tables`: a secret-looking table or column
 * that's neither excluded nor allowed, and an entry naming nothing (stale).
 */
export const personalAccessProblems = (tables: SchemaTables): string[] => {
  const skipTables = excludedTables();
  const skipColumns = excludedColumns();
  const allowed = new Set(PERSONAL_ACCESS_ALLOWED);
  const problems: string[] = [];
  for (const [table, cols] of Object.entries(tables)) {
    if (skipTables.has(table)) continue;
    if (SECRET_LOOKING.test(table) && !allowed.has(table))
      problems.push(
        `table ${table} looks secret: add it to PERSONAL_ACCESS_EXCLUDED or PERSONAL_ACCESS_ALLOWED`,
      );
    for (const col of cols) {
      const name = `${table}.${col}`;
      if (SECRET_LOOKING.test(col) && !skipColumns.has(name) && !allowed.has(name))
        problems.push(
          `column ${name} looks secret: add it to PERSONAL_ACCESS_EXCLUDED or PERSONAL_ACCESS_ALLOWED`,
        );
    }
  }
  for (const entry of [...PERSONAL_ACCESS_EXCLUDED, ...PERSONAL_ACCESS_ALLOWED]) {
    const [table = "", col] = entry.split(".");
    const known = col === undefined ? table in tables : (tables[table] ?? []).includes(col);
    if (!known) problems.push(`${entry} is listed but not in the schema`);
  }
  return problems;
};

/**
 * The statements that give `role` its reads, and that take exactly them
 * back. Both start by revoking every table in `public`, so a role granted
 * before the list (SELECT on everything) is narrowed by its next grant, and
 * a revoke leaves nothing however the role was granted.
 */
export const personalAccessSql = (role: string, tables: SchemaTables) => {
  const r = ident(role);
  const { tables: whole, columns } = personalAccessGrants(tables);
  const columnList = (cols: string[]) => cols.map(ident).join(", ");
  const resetAll = `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${r}`;
  return {
    grant: [
      resetAll,
      ...(whole.length ? [`GRANT SELECT ON ${whole.map(ident).join(", ")} TO ${r}`] : []),
      ...Object.entries(columns).map(
        ([table, cols]) => `GRANT SELECT (${columnList(cols)}) ON ${ident(table)} TO ${r}`,
      ),
    ],
    revoke: [
      ...Object.entries(columns).map(
        ([table, cols]) => `REVOKE SELECT (${columnList(cols)}) ON ${ident(table)} FROM ${r}`,
      ),
      ...(whole.length ? [`REVOKE SELECT ON ${whole.map(ident).join(", ")} FROM ${r}`] : []),
      resetAll,
    ],
  };
};
