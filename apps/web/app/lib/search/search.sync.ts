import type { ParsedSearch, SearchDocument, SearchItemType } from "@caretook/data/schema";
import type { SyncDb } from "../sync/index";
import type { SqlRunner } from "./searchTables.sync";

import {
  conditionSearchDocument,
  entrySearchDocument,
  medicationSearchDocument,
  parseSearch,
  providerSearchDocument,
  SEARCH_ITEM_TYPES,
  taskSearchDocument,
  toFtsMatch,
} from "@caretook/data/schema";
import { previewText } from "../live-notes/notes.sync";
import { createSearchTables, dropSearchTables, SEARCH_SOURCE_TABLES } from "./searchTables.sync";
import { toLocalTimestamp } from "../timeline/timeline.sync";

export { parseSearch };

// The device's search index: SQLite FTS5 over every entry, provider,
// medication, task and condition of every group on the device, kept current as rows change
// (synced or typed here), so search works offline and finds what was typed
// a moment ago. Tables and triggers: ./searchTables. What each row's text
// is: `@caretook/data/schema`'s search documents. Every query is scoped to
// one group.

/**
 * The index's format. Bump it when the tables, the tokenizer or what a
 * search document holds change: devices then rebuild their index on the
 * next open.
 */
export const SEARCH_INDEX_VERSION = 3;

/** bm25 weights for (title, body): a match in a title-like field ranks above one in the text. */
const WEIGHTS = "4.0, 1.0";

/** Wait this long after the last change before re-indexing, so a burst of sync writes is one batch. */
const DEBOUNCE_MS = 150;

/** A database that can run a write transaction: PowerSync's, or a test double. */
export type SearchStore = SqlRunner & {
  writeTransaction: <T>(fn: (tx: SqlRunner & BatchRunner) => Promise<T>) => Promise<T>;
};
type BatchRunner = { executeBatch: (sql: string, params?: unknown[][]) => Promise<unknown> };
type Tx = SqlRunner & BatchRunner;

// ---------------------------------------------------------------------------
// Reading the rows to index
// ---------------------------------------------------------------------------

/** `WHERE <col> IN (ids)`, or every row when `ids` is null (a rebuild). */
const idFilter = (column: string, ids: string[] | null) =>
  ids
    ? { sql: `WHERE ${column} IN (SELECT value FROM json_each(?))`, params: [JSON.stringify(ids)] }
    : { sql: "", params: [] };

const documentColumns = (owner: string) => `
  d.snapshot AS doc_snapshot, d.text AS doc_text, d.id AS doc_id,
  (SELECT json_group_array(nu.data) FROM note_update nu WHERE nu.document_id = ${owner}) AS doc_updates`;

type DocumentColumns = {
  doc_id: string | null;
  doc_snapshot: string | null;
  doc_text: string | null;
  doc_updates: string | null;
};

/** A live document's text, with edits not compacted (or not uploaded) yet. */
const documentText = (row: DocumentColumns) =>
  row.doc_id
    ? previewText({
        id: row.doc_id,
        snapshot: row.doc_snapshot,
        text: row.doc_text,
        updates: row.doc_updates ?? "[]",
      })
    : null;

const parseJson = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

type EntrySourceRow = DocumentColumns & {
  id: string;
  group_id: string | null;
  kind: string | null;
  title: string | null;
  body: string | null;
  details: string | null;
  place: string | null;
  deleted_at: string | null;
  author_name: string | null;
  provider_names: string | null;
  medication_name: string | null;
  medication_strength: string | null;
};

const readEntries = async (db: SqlRunner, ids: string[] | null): Promise<SearchDocument[]> => {
  const filter = idFilter("e.id", ids);
  const rows = await db.getAll<EntrySourceRow>(
    `SELECT e.id, e.group_id, e.kind, e.title, e.body, e.details, e.place, e.deleted_at,
            u.name AS author_name,
            (SELECT json_group_array(p.name) FROM timeline_entry_provider l
               JOIN provider p ON p.id = l.provider_id WHERE l.entry_id = e.id) AS provider_names,
            m.name AS medication_name, m.strength AS medication_strength,
            ${documentColumns("e.id")}
     FROM timeline_entry e
     LEFT JOIN "user" u ON u.id = e.created_by
     LEFT JOIN note_document d ON d.id = e.id
     LEFT JOIN medication m ON m.group_id = e.group_id AND m.id = json_extract(e.details, '$.medicationId')
     ${filter.sql}`,
    filter.params,
  );
  return rows.flatMap((row) => {
    if (!row.group_id || !row.kind) return [];
    const hasMedication = row.medication_name != null;
    const doc = entrySearchDocument({
      id: row.id,
      groupId: row.group_id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      details: parseJson(row.details),
      place: row.place,
      deletedAt: row.deleted_at,
      documentText: row.deleted_at ? null : documentText(row),
      authorName: row.author_name,
      providerNames: parseJson<(string | null)[]>(row.provider_names) ?? [],
      medication: hasMedication ? { name: row.medication_name, strength: row.medication_strength } : null,
    });
    return doc ? [doc] : [];
  });
};

type ProviderSourceRow = DocumentColumns & {
  id: string;
  group_id: string | null;
  name: string | null;
  specialty: string | null;
  practice_name: string | null;
  deleted_at: string | null;
};

const readProviders = async (db: SqlRunner, ids: string[] | null): Promise<SearchDocument[]> => {
  const filter = idFilter("p.id", ids);
  const rows = await db.getAll<ProviderSourceRow>(
    `SELECT p.id, p.group_id, p.name, p.specialty, p.deleted_at, pr.name AS practice_name,
            ${documentColumns("p.id")}
     FROM provider p
     LEFT JOIN provider pr ON pr.id = p.practice_id AND pr.group_id = p.group_id
     LEFT JOIN note_document d ON d.id = p.id
     ${filter.sql}`,
    filter.params,
  );
  return rows.flatMap((row) => {
    if (!row.group_id) return [];
    const doc = providerSearchDocument({
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      specialty: row.specialty,
      practiceName: row.practice_name,
      deletedAt: row.deleted_at,
      documentText: row.deleted_at ? null : documentText(row),
    });
    return doc ? [doc] : [];
  });
};

type MedicationSourceRow = DocumentColumns & {
  id: string;
  group_id: string | null;
  name: string | null;
  strength: string | null;
  reason: string | null;
  directions: string | null;
  deleted_at: string | null;
};

const readMedications = async (db: SqlRunner, ids: string[] | null): Promise<SearchDocument[]> => {
  const filter = idFilter("m.id", ids);
  const rows = await db.getAll<MedicationSourceRow>(
    `SELECT m.id, m.group_id, m.name, m.strength, m.reason, m.directions, m.deleted_at,
            ${documentColumns("m.id")}
     FROM medication m
     LEFT JOIN note_document d ON d.id = m.id
     ${filter.sql}`,
    filter.params,
  );
  return rows.flatMap((row) => {
    if (!row.group_id) return [];
    const doc = medicationSearchDocument({
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      strength: row.strength,
      reason: row.reason,
      directions: row.directions,
      deletedAt: row.deleted_at,
      documentText: row.deleted_at ? null : documentText(row),
    });
    return doc ? [doc] : [];
  });
};

type TaskSourceRow = DocumentColumns & {
  id: string;
  group_id: string | null;
  title: string | null;
  deleted_at: string | null;
};

const readTasks = async (db: SqlRunner, ids: string[] | null): Promise<SearchDocument[]> => {
  const filter = idFilter("t.id", ids);
  const rows = await db.getAll<TaskSourceRow>(
    `SELECT t.id, t.group_id, t.title, t.deleted_at, ${documentColumns("t.id")}
     FROM task t
     LEFT JOIN note_document d ON d.id = t.id
     ${filter.sql}`,
    filter.params,
  );
  return rows.flatMap((row) => {
    if (!row.group_id) return [];
    const doc = taskSearchDocument({
      id: row.id,
      groupId: row.group_id,
      title: row.title,
      deletedAt: row.deleted_at,
      documentText: row.deleted_at ? null : documentText(row),
    });
    return doc ? [doc] : [];
  });
};

type ConditionSourceRow = {
  id: string;
  group_id: string | null;
  name: string | null;
  note: string | null;
  deleted_at: string | null;
};

const readConditions = async (db: SqlRunner, ids: string[] | null): Promise<SearchDocument[]> => {
  const filter = idFilter("c.id", ids);
  const rows = await db.getAll<ConditionSourceRow>(
    `SELECT c.id, c.group_id, c.name, c.note, c.deleted_at FROM recipient_condition c ${filter.sql}`,
    filter.params,
  );
  return rows.flatMap((row) => {
    if (!row.group_id) return [];
    const doc = conditionSearchDocument({
      id: row.id,
      groupId: row.group_id,
      name: row.name,
      note: row.note,
      deletedAt: row.deleted_at,
    });
    return doc ? [doc] : [];
  });
};

const READERS: Record<SearchItemType, (db: SqlRunner, ids: string[] | null) => Promise<SearchDocument[]>> = {
  entry: readEntries,
  provider: readProviders,
  medication: readMedications,
  task: readTasks,
  condition: readConditions,
};

// ---------------------------------------------------------------------------
// Writing the index
// ---------------------------------------------------------------------------

/** Replace the index rows of these ids (of one type) with `docs`; an id without a doc is removed. */
const replaceItems = async (tx: Tx, type: SearchItemType, ids: string[] | null, docs: SearchDocument[]) => {
  if (ids) {
    const json = JSON.stringify(ids);
    await tx.execute(
      `DELETE FROM search_fts WHERE rowid IN
         (SELECT rowid FROM search_item WHERE item_type = ? AND item_id IN (SELECT value FROM json_each(?)))`,
      [type, json],
    );
    await tx.execute(
      `DELETE FROM search_item WHERE item_type = ? AND item_id IN (SELECT value FROM json_each(?))`,
      [type, json],
    );
  }
  const kept = docs.filter((d) => d.title || d.body);
  if (!kept.length) return;
  // One id is one row, whatever its type was (a row id never moves between tables).
  await tx.execute(
    `DELETE FROM search_fts WHERE rowid IN
      (SELECT rowid FROM search_item WHERE item_id IN (SELECT value FROM json_each(?)))`,
    [JSON.stringify(kept.map((d) => d.id))],
  );
  await tx.execute(`DELETE FROM search_item WHERE item_id IN (SELECT value FROM json_each(?))`, [
    JSON.stringify(kept.map((d) => d.id)),
  ]);
  await tx.executeBatch(
    `INSERT INTO search_item (item_id, item_type, group_id) VALUES (?, ?, ?)`,
    kept.map((d) => [d.id, d.type, d.groupId]),
  );
  await tx.executeBatch(
    `INSERT INTO search_fts (rowid, title, body) SELECT rowid, ?, ? FROM search_item WHERE item_id = ?`,
    kept.map((d) => [d.title, d.body, d.id]),
  );
};

/** Which items a batch of changed rows touches, by type (ids that turn out not to exist are removed). */
const dirtyItems = async (tx: Tx): Promise<Record<SearchItemType, string[]>> => {
  const ids = (rows: { id: string | null }[]) => [...new Set(rows.flatMap((r) => (r.id ? [r.id] : [])))];
  const dirty = (sources: string) => `SELECT id FROM search_dirty WHERE source IN (${sources})`;
  const [entry, provider, medication, task, condition] = await Promise.all([
    tx.getAll<{ id: string | null }>(
      `${dirty("'timeline_entry', 'note_document', 'note_update', 'timeline_entry_provider'")}
       UNION SELECT l.entry_id FROM timeline_entry_provider l WHERE l.provider_id IN (${dirty("'provider'")})
       UNION SELECT e.id FROM timeline_entry e
         WHERE e.kind IN ('dose', 'medicationChange')
           AND json_extract(e.details, '$.medicationId') IN (${dirty("'medication'")})
       UNION SELECT e.id FROM timeline_entry e WHERE e.created_by IN (${dirty("'user'")})`,
    ),
    tx.getAll<{ id: string | null }>(
      `${dirty("'provider', 'note_document', 'note_update'")}
       UNION SELECT p.id FROM provider p WHERE p.practice_id IN (${dirty("'provider'")})`,
    ),
    tx.getAll<{ id: string | null }>(dirty("'medication', 'note_document', 'note_update'")),
    tx.getAll<{ id: string | null }>(dirty("'task', 'note_document', 'note_update'")),
    tx.getAll<{ id: string | null }>(dirty("'recipient_condition'")),
  ]);
  return {
    entry: ids(entry),
    provider: ids(provider),
    medication: ids(medication),
    task: ids(task),
    condition: ids(condition),
  };
};

/** Re-index what changed since the last run. Returns how many items it re-read. */
export const indexSearchChanges = async (store: SearchStore) =>
  store.writeTransaction(async (tx) => {
    const items = await dirtyItems(tx);
    let count = 0;
    for (const type of SEARCH_ITEM_TYPES) {
      const ids = items[type];
      if (!ids.length) continue;
      count += ids.length;
      await replaceItems(tx, type, ids, await READERS[type](tx, ids));
    }
    await tx.execute(`DELETE FROM search_dirty`);
    return count;
  });

/** Index everything from scratch, in one transaction. Returns how many items it indexed. */
const rebuildIn = async (tx: Tx) => {
  await tx.execute(`DELETE FROM search_dirty`);
  await tx.execute(`DELETE FROM search_item`);
  await tx.execute(`DELETE FROM search_fts`);
  let count = 0;
  for (const type of SEARCH_ITEM_TYPES) {
    const docs = await READERS[type](tx, null);
    count += docs.length;
    await replaceItems(tx, type, null, docs);
  }
  return count;
};

const readVersion = async (db: SqlRunner) => {
  const exists = await db.getAll<{ n: number }>(
    `SELECT count(*) AS n FROM sqlite_master WHERE name IN ('search_meta', 'search_fts', 'search_item', 'search_dirty')`,
  );
  if ((exists[0]?.n ?? 0) < 4) return null;
  const rows = await db.getAll<{ value: string }>(`SELECT value FROM search_meta WHERE key = 'version'`);
  return rows[0] ? Number(rows[0].value) : null;
};

export type RebuildResult = { rebuilt: boolean; items: number; ms: number };

/**
 * Make sure the index exists in this build's format: create it, or drop and
 * rebuild it when it's missing or its version differs. Otherwise only the
 * triggers are (re)created where missing.
 */
export const prepareSearchIndex = async (
  store: SearchStore,
  { force = false } = {},
): Promise<RebuildResult> => {
  const started = performance.now();
  return store.writeTransaction(async (tx) => {
    const version = await readVersion(tx);
    if (!force && version === SEARCH_INDEX_VERSION) {
      await createSearchTables(tx);
      return { rebuilt: false, items: 0, ms: performance.now() - started };
    }
    await dropSearchTables(tx);
    await createSearchTables(tx);
    const items = await rebuildIn(tx);
    await tx.execute(`INSERT OR REPLACE INTO search_meta (key, value) VALUES ('version', ?)`, [
      String(SEARCH_INDEX_VERSION),
    ]);
    return { rebuilt: true, items, ms: performance.now() - started };
  });
};

// ---------------------------------------------------------------------------
// The indexer's lifecycle (one per open database)
// ---------------------------------------------------------------------------

export type SearchIndexStatus = "preparing" | "ready" | "unavailable";

let status: SearchIndexStatus = "preparing";
const statusListeners = new Set<() => void>();
const setStatus = (next: SearchIndexStatus) => {
  status = next;
  for (const listener of statusListeners) listener();
};

/** "preparing" until the index exists in this build's format (a rebuild can take a moment). */
export const searchIndexStatus = () => status;

/** Call `onChange` when the status changes; returns the unsubscribe. */
export const subscribeSearchIndexStatus = (onChange: () => void) => {
  statusListeners.add(onChange);
  return () => void statusListeners.delete(onChange);
};

const changeListeners = new Set<() => void>();
const notifyChanged = () => {
  for (const listener of changeListeners) listener();
};

/**
 * Call `onChange` whenever the index's contents change (a batch that
 * re-indexed something, a rebuild), so a screen showing results can search
 * again. Returns the unsubscribe.
 */
export const subscribeSearchIndexChanges = (onChange: () => void) => {
  changeListeners.add(onChange);
  return () => void changeListeners.delete(onChange);
};

type Indexer = {
  db: SyncDb;
  controller: AbortController;
  /** Resolves when the work in flight (preparing or a batch) is done. */
  idle: Promise<unknown>;
  /** The last rebuild's measurements, for checks. */
  lastRebuild: RebuildResult | null;
  /** When the last batch with changes finished, how many items it re-read, and how long it took. */
  lastBatch: { at: number; items: number; ms: number } | null;
};

let indexer: Indexer | null = null;

const runBatch = (current: Indexer) => {
  current.idle = current.idle
    .then(async () => {
      if (current.controller.signal.aborted) return;
      const started = performance.now();
      const items = await indexSearchChanges(current.db.powersync);
      if (items) {
        current.lastBatch = { at: Date.now(), items, ms: performance.now() - started };
        if (indexer === current) notifyChanged();
      }
    })
    .catch((e: unknown) => console.error("Search index: couldn't index changes", e));
  return current.idle;
};

/**
 * Start indexing for this database: prepare (or rebuild) the index, index
 * anything changed since the last run, then follow changes. Called once
 * the database opens; never throws (search just stays unavailable).
 */
export const startSearchIndex = (db: SyncDb) => {
  if (indexer?.db === db) return indexer.idle;
  void stopSearchIndex();
  const current: Indexer = {
    db,
    controller: new AbortController(),
    idle: Promise.resolve(),
    lastRebuild: null,
    lastBatch: null,
  };
  indexer = current;
  setStatus("preparing");

  current.idle = prepareSearchIndex(db.powersync)
    .then((result) => {
      if (result.rebuilt) current.lastRebuild = result;
      if (indexer === current) {
        setStatus("ready");
        notifyChanged();
      }
    })
    .catch((e: unknown) => {
      console.error("Search index: couldn't prepare it", e);
      if (indexer === current) setStatus("unavailable");
      current.controller.abort();
    });
  void runBatch(current);

  let timer: ReturnType<typeof setTimeout> | undefined;
  current.controller.signal.addEventListener("abort", () => clearTimeout(timer));
  db.powersync.onChange(
    {
      onChange: () => {
        clearTimeout(timer);
        timer = setTimeout(() => void runBatch(current), DEBOUNCE_MS);
      },
    },
    { tables: SEARCH_SOURCE_TABLES, throttleMs: 30, signal: current.controller.signal },
  );
  return current.idle;
};

/** Stop following changes (sign-out, or another user's database). Waits for work in flight. */
export const stopSearchIndex = async () => {
  const current = indexer;
  if (!current) return;
  indexer = null;
  current.controller.abort();
  setStatus("preparing");
  await current.idle.catch(() => undefined);
};

/**
 * Wait until the index has caught up with every change so far (for checks
 * and tests; screens follow the live status instead).
 */
export const searchIndexSettled = async () => {
  const current = indexer;
  if (!current) return;
  await current.idle;
  await runBatch(current);
};

/** Rebuild from scratch now, as a format change would. Returns the measurements. */
export const rebuildSearchIndex = async () => {
  const current = indexer;
  if (!current) throw new Error("The search index isn't running.");
  await current.idle;
  setStatus("preparing");
  const result = await prepareSearchIndex(current.db.powersync, { force: true });
  current.lastRebuild = result;
  setStatus("ready");
  notifyChanged();
  return result;
};

/** The indexer's measurements (checks only). */
export const searchIndexStats = () =>
  indexer ? { status, lastRebuild: indexer.lastRebuild, lastBatch: indexer.lastBatch } : { status };

// ---------------------------------------------------------------------------
// Queries, always scoped to one group
// ---------------------------------------------------------------------------

/**
 * A condition on `column` (an entry id) for the timeline's queries: the
 * group's entries that match. Null for an empty search, which matches
 * nothing: show the empty state instead of querying.
 */
export const entryMatchCondition = (column: string, groupId: string, parsed: ParsedSearch) => {
  const match = toFtsMatch(parsed);
  if (!match) return null;
  return {
    sql: `${column} IN (SELECT i.item_id FROM search_fts f JOIN search_item i ON i.rowid = f.rowid
            WHERE search_fts MATCH ? AND i.group_id = ? AND i.item_type = 'entry')`,
    params: [match, groupId],
  };
};

/** A time range for a search (a care period's dates, `periodRange`): ISO 8601, `to` exclusive, null for no end. */
export type SearchRange = { from: string; to: string | null };

/**
 * A condition on `column` (an entry's `occurred_at`, in PowerSync's text
 * form) for entries within `range`: from its start (inclusive) to its end
 * (exclusive), or with no end.
 */
export const entryRangeCondition = (column: string, range: SearchRange) => ({
  sql: range.to ? `${column} >= ? AND ${column} < ?` : `${column} >= ?`,
  params: range.to
    ? [toLocalTimestamp(range.from), toLocalTimestamp(range.to)]
    : [toLocalTimestamp(range.from)],
});

/** The ids of the group's entries that match. */
export const searchEntryIds = async (db: SyncDb, groupId: string, parsed: ParsedSearch) => {
  const condition = entryMatchCondition("i.item_id", groupId, parsed);
  if (!condition) return [];
  const rows = await db.powersync.getAll<{ id: string }>(
    `SELECT i.item_id AS id FROM search_item i WHERE ${condition.sql}`,
    condition.params,
  );
  return rows.map((r) => r.id);
};

export type SearchHit = {
  id: string;
  type: SearchItemType;
  /** bm25: lower is better. */
  rank: number;
  /** Every included term matched in a title-like field. */
  titleMatch: boolean;
  /** An entry's time. */
  occurredAt: string | null;
};

export type SearchSection = { hits: SearchHit[]; total: number };
export type SearchResults = Record<SearchItemType, SearchSection>;

export type SearchLimits = Partial<Record<SearchItemType, number>>;

const DEFAULT_LIMIT = 5;

/**
 * The search page's query: every matching item of the group, best first
 * (title matches, rank, newest). With a `range` (a care period's dates),
 * only entries within it: providers, medications, tasks and conditions aren't dated by it, so none.
 */
export const searchGroupQuery = (groupId: string, parsed: ParsedSearch, range?: SearchRange | null) => {
  const match = toFtsMatch(parsed);
  const titleMatch = toFtsMatch(parsed, { columns: ["title"] });
  if (!match || !titleMatch) return null;
  const within = range ? entryRangeCondition("e.occurred_at", range) : null;
  return {
    sql: `SELECT i.item_id AS id, i.item_type AS type, bm25(search_fts, ${WEIGHTS}) AS rank,
                 i.rowid IN (SELECT rowid FROM search_fts WHERE search_fts MATCH ?) AS title_match,
                 e.occurred_at
          FROM search_fts JOIN search_item i ON i.rowid = search_fts.rowid
          LEFT JOIN timeline_entry e ON i.item_type = 'entry' AND e.id = i.item_id
          WHERE search_fts MATCH ? AND i.group_id = ?${within ? ` AND i.item_type = 'entry' AND ${within.sql}` : ""}
          ORDER BY title_match DESC, rank, e.occurred_at DESC`,
    params: [titleMatch, match, groupId, ...(within?.params ?? [])],
  };
};

type HitRow = { id: string; type: string; rank: number; title_match: number; occurred_at: string | null };

/**
 * The group's matches by type, the first few of each (`limits`, default 5)
 * with each type's total; with a `range`, only the entries within it.
 */
export const searchGroup = async (
  db: SyncDb,
  groupId: string,
  parsed: ParsedSearch,
  limits: SearchLimits = {},
  range: SearchRange | null = null,
): Promise<SearchResults> => {
  const results: SearchResults = {
    entry: { hits: [], total: 0 },
    provider: { hits: [], total: 0 },
    medication: { hits: [], total: 0 },
    task: { hits: [], total: 0 },
    condition: { hits: [], total: 0 },
  };
  const query = searchGroupQuery(groupId, parsed, range);
  if (!query) return results;
  const rows = await db.powersync.getAll<HitRow>(query.sql, query.params);
  for (const row of rows) {
    const section = results[row.type as SearchItemType] as SearchSection | undefined;
    if (!section) continue;
    section.total++;
    if (section.hits.length >= (limits[row.type as SearchItemType] ?? DEFAULT_LIMIT)) continue;
    section.hits.push({
      id: row.id,
      type: row.type as SearchItemType,
      rank: row.rank,
      titleMatch: !!row.title_match,
      occurredAt: row.occurred_at,
    });
  }
  return results;
};
