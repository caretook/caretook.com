import type { RoleNames } from "./rolesSql";

import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { dbMayFail, getDb } from "../client";
import { DEFAULT_ROLE_NAMES, rolesSql } from "./rolesSql";
import { schemaTables } from "./schemaTables";

// `pnpm db:roles` (hosting PRD): apply `rolesSql` in one transaction, with
// whatever connection the pool has (the script points it at
// MIGRATIONS_DATABASE_URL), then read back what each role ended up with.

export const SYNC_CONFIG_PATH = new URL("../../../../../powersync/sync-config.yaml", import.meta.url);

export const readSyncConfig = () => readFileSync(SYNC_CONFIG_PATH, "utf8");

export type RoleSummary = {
  role: string;
  /** Tables with each privilege, e.g. `{ SELECT: 40, INSERT: 40 }`. */
  tablePrivileges: Record<string, number>;
  /** Column-level SELECT grants, per table (replication only). */
  columns: Record<string, string[]>;
  canCreateInSchema: boolean;
  replication: boolean;
};

export type RolesSummary = {
  roles: RoleSummary[];
  /** The publication's tables and their column lists. */
  publication: Record<string, string[]>;
};

type Row = Record<string, unknown>;

const rows = async (query: ReturnType<typeof sql>) => (await getDb().execute(query)).rows as Row[];

/** What `names`' roles and publication hold now. */
export const rolesSummary = async (names: RoleNames = DEFAULT_ROLE_NAMES): Promise<RolesSummary> => {
  const roles: RoleSummary[] = [];
  for (const role of [names.migrations, names.app, names.replication]) {
    const privileges = await rows(sql`
      SELECT privilege_type, count(*)::int AS n FROM information_schema.role_table_grants
      WHERE grantee = ${role} AND table_schema = 'public' GROUP BY privilege_type`);
    const columns = await rows(sql`
      SELECT table_name, column_name FROM information_schema.column_privileges
      WHERE grantee = ${role} AND table_schema = 'public' AND privilege_type = 'SELECT'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants t
        WHERE t.grantee = ${role} AND t.table_schema = 'public'
        AND t.table_name = column_privileges.table_name AND t.privilege_type = 'SELECT')
      ORDER BY table_name, column_name`);
    const attrs = await rows(sql`
      SELECT rolreplication,
        has_schema_privilege(${role}, 'public', 'CREATE') AS can_create
      FROM pg_roles WHERE rolname = ${role}`);
    const byTable: Record<string, string[]> = {};
    for (const c of columns) (byTable[String(c.table_name)] ??= []).push(String(c.column_name));
    roles.push({
      role,
      tablePrivileges: Object.fromEntries(privileges.map((p) => [String(p.privilege_type), Number(p.n)])),
      columns: byTable,
      canCreateInSchema: attrs[0]?.can_create === true,
      replication: attrs[0]?.rolreplication === true,
    });
  }
  const published = await rows(sql`
    SELECT tablename, attnames::text[] AS attnames FROM pg_publication_tables
    WHERE pubname = ${names.publication} ORDER BY tablename`);
  const publication: Record<string, string[]> = {};
  for (const p of published) publication[String(p.tablename)] = (p.attnames as string[] | null) ?? [];
  return { roles, publication };
};

/** Apply the roles SQL for the current sync config and schema, then summarize. */
export const applyRoles = (opts: { names?: RoleNames; syncConfig?: string } = {}) =>
  dbMayFail(async () => {
    const generated = rolesSql({
      syncConfig: opts.syncConfig ?? readSyncConfig(),
      tables: schemaTables(),
      names: opts.names,
    });
    await getDb().transaction(async (tx) => {
      for (const statement of generated.statements) await tx.execute(sql.raw(statement));
    });
    return { generated, summary: await rolesSummary(generated.names) };
  }, "db:roles");
