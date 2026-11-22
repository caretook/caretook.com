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

// The grants are read from pg_catalog's ACLs, not information_schema: its
// column_privileges, correlated against role_table_grants, took about 2.5 s a
// role (B-450). These return the same rows: the views' relkinds and privilege
// types, the owner's default ACL when a table has none, and only grants whose
// grantor or grantee the connected role can use (as the views filter them).
const VISIBLE = sql`(pg_has_role(g.grantor, 'USAGE') OR pg_has_role(g.grantee, 'USAGE'))`;

/** What `names`' roles and publication hold now. */
export const rolesSummary = async (names: RoleNames = DEFAULT_ROLE_NAMES): Promise<RolesSummary> => {
  const roles: RoleSummary[] = [];
  for (const role of [names.migrations, names.app, names.replication]) {
    const privileges = await rows(sql`
      SELECT g.privilege_type, count(*)::int AS n
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) g
      JOIN pg_roles r ON r.oid = g.grantee
      WHERE r.rolname = ${role} AND n.nspname = 'public' AND c.relkind IN ('r', 'v', 'f', 'p')
      AND g.privilege_type IN ('INSERT', 'SELECT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
      AND ${VISIBLE}
      GROUP BY g.privilege_type`);
    // Column-level SELECT grants on tables the role can't SELECT whole.
    const columns = await rows(sql`
      SELECT c.relname AS table_name, a.attname AS column_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
      CROSS JOIN LATERAL aclexplode(a.attacl) g
      JOIN pg_roles r ON r.oid = g.grantee
      WHERE r.rolname = ${role} AND n.nspname = 'public' AND c.relkind IN ('r', 'v', 'f', 'p')
      AND g.privilege_type = 'SELECT' AND ${VISIBLE}
      AND NOT EXISTS (
        SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) g
        WHERE g.grantee = r.oid AND g.privilege_type = 'SELECT' AND ${VISIBLE})
      ORDER BY c.relname, a.attname`);
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
