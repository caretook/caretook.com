import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_NAMES,
  REPLICATION_WHOLE_TABLES,
  rolesSql,
  schemaTables,
  SyncConfigError,
  syncedColumns,
} from ".";

// The replication grants come from the sync config (hosting slice 2): the
// columns each stream reads, per table, the union across streams, nothing
// for unsynced tables, and a loud failure on `*` or an unknown column.

const TABLES = {
  group: ["id", "name", "secret", "created_at"],
  member: ["id", "group_id", "user_id", "role", "created_at"],
  note: ["id", "group_id", "title", "body", "private_notes"],
  user: ["id", "name", "image", "email", "password_hash"],
  account: ["id", "user_id", "password"],
};

const CONFIG = `# A fixture sync config, shaped like powersync/sync-config.yaml.
config:
  edition: 3

streams:
  groups:
    auto_subscribe: true
    with:
      my_groups: SELECT group_id FROM member WHERE user_id = auth.user_id()
    queries:
      - SELECT id, name FROM "group" WHERE id IN my_groups # trailing comment
      - >-
        SELECT id, group_id, title
        FROM note WHERE group_id IN my_groups
  notes_again:
    with:
      writer_groups: >-
        SELECT group_id FROM member
        WHERE user_id = auth.user_id() AND role != 'viewer'
    queries:
      - SELECT id, group_id, body FROM note WHERE group_id IN writer_groups
  profiles:
    with:
      my_groups: SELECT group_id FROM member WHERE user_id = auth.user_id()
    query: >-
      SELECT "user".id, "user".name, u2.image FROM "user"
      INNER JOIN member ON member.user_id = "user".id
      JOIN "user" u2 ON u2.id = "user".id
      WHERE member.group_id IN my_groups
`;

const grantsOf = (config: string) =>
  Object.fromEntries(syncedColumns(config, TABLES).map((g) => [g.table, g.columns]));

describe("syncedColumns", () => {
  it("grants each table the columns its streams read", () => {
    const grants = grantsOf(CONFIG);
    expect(grants.group).toEqual(["id", "name"]);
    // Read only by parameter queries and joins, which PowerSync evaluates on its copy too.
    expect(grants.member).toEqual(["group_id", "user_id", "role"]);
    expect(grants.user).toEqual(["id", "name", "image"]);
  });

  it("gives a table in two streams the union of their columns", () => {
    expect(grantsOf(CONFIG).note).toEqual(["id", "group_id", "title", "body"]);
  });

  it("gives a table in no stream nothing", () => {
    const grants = grantsOf(CONFIG);
    expect(grants).not.toHaveProperty("account");
    expect(Object.keys(grants).sort()).toEqual(["group", "member", "note", "user"]);
  });

  it("refuses *", () => {
    const star = CONFIG.replace("SELECT id, name FROM", "SELECT * FROM");
    expect(() => syncedColumns(star, TABLES)).toThrow(/list its columns, not \*/);
    const qualified = CONFIG.replace('SELECT "user".id, "user".name', 'SELECT "user".*');
    expect(() => syncedColumns(qualified, TABLES)).toThrow(SyncConfigError);
  });

  it("refuses a column or table it can't resolve against the schema", () => {
    expect(() => syncedColumns(CONFIG.replace("id, group_id, body", "id, group_id, bodyy"), TABLES)).toThrow(
      /stream notes_again: unknown column "note.bodyy"/,
    );
    expect(() =>
      syncedColumns(
        CONFIG.replace("FROM note WHERE group_id IN writer", "FROM notes WHERE group_id IN writer"),
        TABLES,
      ),
    ).toThrow(/unknown table "notes"/);
    expect(() =>
      syncedColumns(CONFIG.replace("user_id = auth.user_id() AND", "user_idd = auth.user_id() AND"), TABLES),
    ).toThrow(/unknown column "member.user_idd"/);
    expect(() =>
      syncedColumns(CONFIG.replace("SELECT id, name FROM", "SELECT id, upper(name) FROM"), TABLES),
    ).toThrow(/can't resolve/);
  });

  it("refuses an unqualified column in a join", () => {
    const ambiguous = CONFIG.replace("WHERE member.group_id IN my_groups", "WHERE group_id IN my_groups");
    expect(() => syncedColumns(ambiguous, TABLES)).toThrow(/qualify "group_id"/);
  });

  it("refuses YAML it doesn't read", () => {
    expect(() => syncedColumns("streams: { a: 1 }", TABLES)).toThrow(/unsupported YAML/);
    expect(() =>
      syncedColumns("bucket_definitions:\n  a:\n    data:\n      - SELECT id FROM note\n", TABLES),
    ).toThrow(/Sync Rules/);
    expect(() => syncedColumns("config:\n  edition: 3\n", TABLES)).toThrow(/no streams/);
  });

  it("reads the real powersync/sync-config.yaml against the schema", () => {
    const config = readFileSync(
      new URL("../../../../../powersync/sync-config.yaml", import.meta.url),
      "utf8",
    );
    const tables = schemaTables();
    const grants = Object.fromEntries(syncedColumns(config, tables).map((g) => [g.table, g.columns]));
    expect(grants.user).toEqual(["id", "name", "image", "avatar_color", "avatar_icon"]);
    expect(grants.timeline_entry).toContain("group_id");
    // Never synced: account tables, invites, the audit log.
    for (const table of [
      "account",
      "session",
      "verification",
      "jwks",
      "care_group_invite",
      "admin_audit_log",
    ]) {
      expect(table in tables).toBe(true);
      expect(grants).not.toHaveProperty(table);
    }
  });
});

describe("rolesSql", () => {
  it("returns the parsed grants with its SQL", () => {
    const res = rolesSql({ syncConfig: CONFIG, tables: TABLES, wholeTables: ["user"] });
    expect(res.names).toEqual(DEFAULT_ROLE_NAMES);
    expect(res.replication).toEqual(syncedColumns(CONFIG, TABLES));
    expect(res.statements.length).toBeGreaterThan(10);
  });

  it("refuses role names that aren't plain identifiers, or the same name twice", () => {
    const names = { ...DEFAULT_ROLE_NAMES, app: 'x"; DROP TABLE y; --' };
    expect(() => rolesSql({ syncConfig: CONFIG, tables: TABLES, names })).toThrow(/plain lower-case/);
    const same = { ...DEFAULT_ROLE_NAMES, app: DEFAULT_ROLE_NAMES.replication };
    expect(() => rolesSql({ syncConfig: CONFIG, tables: TABLES, names: same })).toThrow(/different names/);
  });

  it("refuses a whole-table grant for a table that isn't synced", () => {
    expect(() => rolesSql({ syncConfig: CONFIG, tables: TABLES, wholeTables: ["account"] })).toThrow(
      /isn't synced/,
    );
  });

  it("leaves no table partly synced in the real sync config unless it's granted whole", () => {
    const config = readFileSync(
      new URL("../../../../../powersync/sync-config.yaml", import.meta.url),
      "utf8",
    );
    const tables = schemaTables();
    const partial = syncedColumns(config, tables)
      .filter((g) => g.columns.length < (tables[g.table]?.length ?? 0))
      .map((g) => g.table);
    // Columns outside the Drizzle schema (search_vector) show only in the integration test.
    expect(partial.filter((t) => !REPLICATION_WHOLE_TABLES.includes(t))).toEqual([]);
    expect(partial).toContain("user");
  });

  it("refuses a sync config it can't read", () => {
    expect(() =>
      rolesSql({ syncConfig: CONFIG.replace("SELECT id, name", "SELECT *"), tables: TABLES }),
    ).toThrow(SyncConfigError);
  });
});
