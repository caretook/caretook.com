import type { SchemaTables, TableColumns } from "./syncConfig";

import { syncedColumns } from "./syncConfig";

// The database roles (hosting PRD), as idempotent SQL that `pnpm db:roles`
// applies with the migrations role after every migration:
//
// - migrations: DDL (CREATE on the database and the public schema); it owns
//   the tables it creates.
// - app: CONNECT, USAGE, SELECT/INSERT/UPDATE/DELETE on every table and
//   USAGE/SELECT on sequences, no CREATE; default privileges give it the same
//   on tables the migrations role creates later.
// - replication: REPLICATION, and SELECT on exactly the columns the sync
//   config reads (`syncedColumns`), or on the whole table for
//   REPLICATION_WHOLE_TABLES; nothing on any other table.
// - the publication: the same tables with the same column lists.
//
// Roles are created without passwords (the runbook sets them). Pure: it only
// builds the SQL; tests apply it to the test database.

export type RoleNames = {
  migrations: string;
  app: string;
  replication: string;
  publication: string;
};

export const DEFAULT_ROLE_NAMES: RoleNames = {
  migrations: "caretook_migrations",
  app: "caretook_app",
  replication: "caretook_replication",
  publication: "powersync",
};

/**
 * Synced tables the replication role reads whole (a table-level SELECT), not
 * column by column. PowerSync's first snapshot of a table runs `SELECT *`
 * (1.28.3: module-postgres SnapshotQuery), which Postgres refuses unless the
 * role can read every column, so a synced table must either list all its
 * columns in sync-config.yaml or be here. The publication still lists only
 * the streams' columns for every table, so changes replicate just those; the
 * other columns reach only PowerSync's server-side storage, in the snapshot,
 * never devices.
 *
 * - "user": its email, role, preferences and disabled fields must never
 *   reach devices (the streams and the publication list id, name, image and
 *   the two avatar ids).
 * - "note_document" and "timeline_entry": `search_vector` (migration 0016,
 *   hand-written, not in the Drizzle schema) is derived from text these
 *   tables already sync, and devices build their own index.
 * - "care_group": `simple_tiles`, retired by `easy_tiles` (migration 0034) and no
 *   longer synced, stays until a contract migration drops it.
 * - "care_group_member": `simple_mode` and `simple_mode_locked`, retired by the
 *   easy roles (migration 0036) and no longer synced, stay until a contract
 *   migration drops them.
 *
 * Keep this list short; the parser still refuses `*` in streams. A test
 * fails when a synced table can't be read with `SELECT *`.
 */
export const REPLICATION_WHOLE_TABLES: readonly string[] = [
  "user",
  "note_document",
  "timeline_entry",
  "care_group",
  "care_group_member",
];

const NAME = /^[a-z_][a-z0-9_]{0,62}$/;

/** A double-quoted identifier. */
export const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** A single-quoted literal. */
export const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

const checkNames = (names: RoleNames) => {
  for (const [key, value] of Object.entries(names)) {
    if (!NAME.test(value))
      throw new Error(`rolesSql: ${key} name "${value}" isn't a plain lower-case identifier`);
  }
  const roles = [names.migrations, names.app, names.replication];
  if (new Set(roles).size !== roles.length) throw new Error("rolesSql: the three roles need different names");
};

/**
 * CREATE ROLE when it's missing. An existing role is altered only when
 * `wrong` (a condition on its pg_roles row) holds, so a rerun changes
 * nothing, and the migrations role never alters itself (it can't).
 */
const ensureRole = (role: string, attributes: string, wrong?: string) => `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${literal(role)}) THEN
    CREATE ROLE ${ident(role)} ${attributes};${
      wrong
        ? `
  ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${literal(role)} AND (${wrong})) THEN
    ALTER ROLE ${ident(role)} ${attributes};`
        : ""
    }
  END IF;
END
$$;`;

/** A statement on the current database, whose name isn't known up front. */
const onDatabase = (statement: string) => `DO $$
BEGIN
  EXECUTE format(${literal(statement.replace("%DB%", "%I"))}, current_database());
END
$$;`;

const tableList = (grants: TableColumns[]) =>
  grants.map((g) => `${ident(g.table)} (${g.columns.map(ident).join(", ")})`).join(",\n    ");

export type RolesSql = {
  /** The SQL, one statement per entry, to run in order in one transaction. */
  statements: string[];
  /** The replication role's column grants and the publication's column lists. */
  replication: TableColumns[];
  names: RoleNames;
};

/**
 * The role and grant SQL for `syncConfig` (the text of
 * `powersync/sync-config.yaml`) over the schema's `tables`. Throws when the
 * sync config can't be read (a `*`, an unknown column).
 */
export const rolesSql = ({
  syncConfig,
  tables,
  names = DEFAULT_ROLE_NAMES,
  wholeTables = REPLICATION_WHOLE_TABLES,
}: {
  syncConfig: string;
  tables: SchemaTables;
  names?: RoleNames;
  /** Synced tables granted whole (default REPLICATION_WHOLE_TABLES). */
  wholeTables?: readonly string[];
}): RolesSql => {
  checkNames(names);
  const replication = syncedColumns(syncConfig, tables);
  if (replication.length === 0) throw new Error("rolesSql: the sync config syncs no tables");
  for (const table of wholeTables) {
    if (!replication.some((g) => g.table === table))
      throw new Error(`rolesSql: "${table}" is granted whole but isn't synced`);
  }
  const { migrations, app, replication: repl, publication } = names;
  const m = ident(migrations);
  const a = ident(app);
  const r = ident(repl);

  const statements = [
    // The roles. LOGIN without a password: the runbook sets one.
    ensureRole(migrations, "LOGIN"),
    ensureRole(
      app,
      "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION",
      "rolsuper OR NOT rolcanlogin OR rolcreatedb OR rolcreaterole OR rolreplication",
    ),
    ensureRole(
      repl,
      "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE REPLICATION",
      "rolsuper OR NOT rolcanlogin OR rolcreatedb OR rolcreaterole OR NOT rolreplication",
    ),

    // Nobody but the migrations role creates anything.
    `REVOKE CREATE ON SCHEMA public FROM PUBLIC;`,
    onDatabase(`REVOKE CREATE ON DATABASE %DB% FROM PUBLIC, ${a}, ${r}`),
    `REVOKE CREATE ON SCHEMA public FROM ${a}, ${r};`,

    // migrations: DDL.
    onDatabase(`GRANT CONNECT, CREATE, TEMPORARY ON DATABASE %DB% TO ${m}`),
    `GRANT USAGE, CREATE ON SCHEMA public TO ${m};`,

    // app: DML on every table and sequence, now and later.
    onDatabase(`GRANT CONNECT ON DATABASE %DB% TO ${a}`),
    `GRANT USAGE ON SCHEMA public TO ${a};`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${a};`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${a};`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${m} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${a};`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${m} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${a};`,

    // replication: exactly the synced columns. Revoking table privileges
    // revokes column privileges too, so a column a stream dropped goes.
    onDatabase(`GRANT CONNECT ON DATABASE %DB% TO ${r}`),
    `GRANT USAGE ON SCHEMA public TO ${r};`,
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${r};`,
    `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${r};`,
    ...replication.map((g) =>
      wholeTables.includes(g.table)
        ? `GRANT SELECT ON TABLE ${ident(g.table)} TO ${r};`
        : `GRANT SELECT (${g.columns.map(ident).join(", ")}) ON TABLE ${ident(g.table)} TO ${r};`,
    ),

    // The publication: the same tables and columns.
    `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = ${literal(publication)}) THEN
    ALTER PUBLICATION ${ident(publication)} SET TABLE
    ${tableList(replication)};
  ELSE
    CREATE PUBLICATION ${ident(publication)} FOR TABLE
    ${tableList(replication)};
  END IF;
END
$$;`,
  ];

  return { statements, replication, names };
};
