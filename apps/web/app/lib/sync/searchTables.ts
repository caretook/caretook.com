// The device's search index tables, outside PowerSync's schema (it can't
// declare virtual tables). They live in the same database file, so sign-out
// deletes them with everything else; `dropSearchTables` also runs whenever
// PowerSync clears the local copy, so one user's index never outlives
// their data on a shared device.
//
//   search_item    one row per indexed entry, provider or medication
//   search_fts     FTS5 over its weighted fields, rowid = search_item.rowid
//   search_meta    the index's format version
//   search_dirty   what changed since the indexer last ran, filled by triggers
//
// Triggers on PowerSync's storage tables (`ps_data__<table>`, where both
// synced rows and local writes land) record which rows changed, so the
// indexer re-reads only those. A trigger must never fail, or it would fail
// PowerSync's own write: they only insert ids, OR IGNORE, with no constraints.

/** Anything that can run SQL: PowerSync's database or a transaction. */
export type SqlRunner = {
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
  getAll: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
};

/** Each change source: the synced table, and the expression for the id it dirties (over `ROW.data`). */
const SOURCES = [
  { table: "timeline_entry", id: "ROW.id" },
  { table: "note_document", id: "ROW.id" },
  { table: "note_update", id: "json_extract(ROW.data, '$.document_id')" },
  { table: "provider", id: "ROW.id" },
  { table: "medication", id: "ROW.id" },
  { table: "timeline_entry_provider", id: "json_extract(ROW.data, '$.entry_id')" },
  { table: "user", id: "ROW.id" },
] as const;

export type SearchSource = (typeof SOURCES)[number]["table"];

/** The synced tables the indexer listens to. */
export const SEARCH_SOURCE_TABLES: SearchSource[] = SOURCES.map((s) => s.table);

const OPERATIONS = [
  { name: "ins", event: "INSERT", row: "NEW" },
  { name: "upd", event: "UPDATE", row: "NEW" },
  { name: "del", event: "DELETE", row: "OLD" },
] as const;

const triggerName = (table: string, op: string) => `search_dirty_${table}_${op}`;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS search_item (
     rowid INTEGER PRIMARY KEY,
     item_id TEXT NOT NULL UNIQUE,
     item_type TEXT NOT NULL,
     group_id TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS search_item_group ON search_item (group_id, item_type)`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
     title, body,
     tokenize = 'porter unicode61 remove_diacritics 2'
   )`,
  `CREATE TABLE IF NOT EXISTS search_meta (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS search_dirty (source TEXT, id TEXT, PRIMARY KEY (source, id))`,
];

/** PowerSync's storage tables that exist (a table it hasn't created yet gets its trigger next time). */
const storageTables = async (db: SqlRunner) => {
  const rows = await db.getAll<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (SELECT 'ps_data__' || value FROM json_each(?))`,
    [JSON.stringify(SEARCH_SOURCE_TABLES)],
  );
  return new Set(rows.map((r) => r.name));
};

/** Create the tables and the change triggers, where missing. */
export const createSearchTables = async (db: SqlRunner) => {
  for (const sql of TABLES) await db.execute(sql);
  const existing = await storageTables(db);
  for (const source of SOURCES) {
    const storage = `ps_data__${source.table}`;
    if (!existing.has(storage)) continue;
    for (const op of OPERATIONS) {
      await db.execute(
        `CREATE TRIGGER IF NOT EXISTS ${triggerName(source.table, op.name)}
         AFTER ${op.event} ON ${storage} FOR EACH ROW
         BEGIN
           INSERT OR IGNORE INTO search_dirty (source, id)
           VALUES ('${source.table}', ${source.id.replace("ROW", op.row)});
         END`,
      );
    }
  }
};

/** Drop the triggers (first, so no PowerSync write ever meets a missing table), then the tables. */
export const dropSearchTables = async (db: SqlRunner) => {
  for (const source of SOURCES) {
    for (const op of OPERATIONS)
      await db.execute(`DROP TRIGGER IF EXISTS ${triggerName(source.table, op.name)}`);
  }
  for (const table of ["search_fts", "search_item", "search_meta", "search_dirty"]) {
    await db.execute(`DROP TABLE IF EXISTS ${table}`);
  }
};
