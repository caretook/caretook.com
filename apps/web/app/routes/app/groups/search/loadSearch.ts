import type { SearchItemType } from "@caretook/data/schema";
import type { LinkedProviderName } from "~/lib/providers/entryProviders";
import type { WithMedication } from "~/lib/medications/medicationEntries";
import type { TimelineEntry } from "~/lib/core/rpc";
import type { ResultSection, SearchPageQuery } from "~/lib/search/searchResults";
import type { SyncDb } from "~/lib/sync";
import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { SearchIndexStatus } from "~/lib/search/search.sync";
import type { EntryMedicationRow } from "~/lib/medications/medicationTimeline.sync";
import type { LocalMedication, MedicationRow } from "~/lib/medications/medications.sync";
import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";
import type { LocalTodo, TodoRow } from "~/lib/todos/todos.sync";
import type { ConditionRow, LocalCondition } from "~/lib/profiles/conditions.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";
import type { EntryProviderLinkRow } from "~/lib/providers/entryProviders";
import type { TagRow } from "~/lib/tags/tags.sync";

import { activeTag, TAG_TARGET_COLUMNS, TAG_TARGETS } from "@caretook/data/schema";
import { groupLinksByEntry } from "~/lib/providers/entryProviders";
import { isLiveEntryKind } from "~/lib/live-notes/liveEntry";
import { medicationIdOf, withMedication } from "~/lib/medications/medicationEntries";
import { searchSections, sectionLimits } from "~/lib/search/searchResults";
import { loadSchedulePasses, toPasses } from "~/lib/medications/medicationPasses.sync";
import { toEntryMedication } from "~/lib/medications/medicationTimeline.sync";
import { toMedication } from "~/lib/medications/medications.sync";
import { previewText } from "~/lib/live-notes/notes.sync";
import { toProvider, windowLinksQuery } from "~/lib/providers/providers.sync";
import { toTodo } from "~/lib/todos/todos.sync";
import { toConditions } from "~/lib/profiles/conditions.sync";
import { rangeUntilNow } from "~/lib/care-periods/periodSearch";
import { loadSearchPeriods, searchPeriodRange } from "~/lib/care-periods/periodSearch.sync";
import { matchingTagIds, searchGroup, searchIndexStatus, taggedItems } from "~/lib/search/search.sync";
import { tagsQuery } from "~/lib/tags/tags.sync";
import { fromLocalTimestamp, readRows, toTimelineEntry } from "~/lib/timeline/timeline.sync";
import { isEmptySearch, parseSearch } from "@caretook/data/domain";

// The search page's reads: the index's matches for one group, arranged into
// sections (`lib/search/searchResults`), then the rows they show, read locally in
// one query per type (never one per result). Used by the loader (so Back
// shows the same results at once) and by `useSearchPage` (as the text and
// the index change).

/** An entry as a result shows it: with its medication, linked providers and author's name. */
export type EntryResult = TimelineEntry &
  WithMedication & { providers: LinkedProviderName[]; authorName: string };
export type ProviderResult = LocalProvider & { practiceName: string | null };

export type SearchPageData = SearchPageQuery & {
  /** The index's state when this was read ("preparing": results may be missing). */
  status: SearchIndexStatus;
  /** The text has no word to search for (empty, or only exclusions). */
  empty: boolean;
  /** The tag filter's name, while `tag` is one of the group's tags (else both are null). */
  tagName: string | null;
  sections: ResultSection[];
  entries: Record<string, EntryResult>;
  providers: Record<string, ProviderResult>;
  medications: Record<string, LocalMedication>;
  todos: Record<string, LocalTodo>;
  conditions: Record<string, LocalCondition>;
  /** The notes' text of the providers, medications and todos shown (by their id), for snippets. */
  notes: Record<string, string>;
  /** The tags the text names (`matchingTagIds`) that each result shown carries, by its id, A to Z. */
  namedTags: Record<string, NamedTag[]>;
};

/** A tag the search's text names, as a result's chip shows it. */
export type NamedTag = Pick<TagRow, "id" | "name" | "color">;

const inIds = (column: string) => `${column} IN (SELECT value FROM json_each(?))`;

const byId = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r]));

const idsOf = (sections: ResultSection[], type: SearchItemType) =>
  JSON.stringify(sections.find((s) => s.type === type)?.hits.map((h) => h.id) ?? []);

/**
 * The text of the documents with these ids (an entry's, provider's or
 * medication's document has its owner's id), pending typing included.
 */
const readNotes = async (db: SyncDb, groupId: string, ids: string): Promise<Map<string, string>> => {
  const rows = await db.powersync.getAll<NoteDocRow>(
    `SELECT d.id, d.snapshot, d.text,
            (SELECT json_group_array(u.data) FROM note_update u WHERE u.document_id = d.id) AS updates
     FROM note_document d WHERE d.group_id = ? AND ${inIds("d.id")}`,
    [groupId, ids],
  );
  return new Map(rows.map((row) => [row.id, previewText(row)]));
};

const readEntries = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<EntryRow>(
    `SELECT * FROM timeline_entry WHERE group_id = ? AND deleted_at IS NULL AND ${inIds("id")}`,
    [groupId, ids],
  );
  const entries = rows.flatMap((row) => toTimelineEntry(row) ?? []);
  const medicationIds = JSON.stringify(entries.flatMap((e) => medicationIdOf(e) ?? []));
  const authorIds = JSON.stringify([...new Set(entries.map((e) => e.createdBy))]);
  const window = { sql: `FROM timeline_entry WHERE ${inIds("id")}`, params: [ids] };
  const links = windowLinksQuery(window);
  const liveIds = JSON.stringify(entries.filter((e) => isLiveEntryKind(e.kind)).map((e) => e.id));
  const [medications, linkRows, authors, notes, passRows] = await Promise.all([
    db.powersync.getAll<EntryMedicationRow>(
      `SELECT id, name, strength, deleted_at FROM medication WHERE group_id = ? AND ${inIds("id")}`,
      [groupId, medicationIds],
    ),
    db.powersync.getAll<EntryProviderLinkRow>(links.sql, links.params),
    db.powersync.getAll<{ id: string; name: string | null }>(
      `SELECT id, name FROM "user" WHERE ${inIds("id")}`,
      [authorIds],
    ),
    readNotes(db, groupId, liveIds),
    loadSchedulePasses(db, groupId),
  ]);
  const passes = toPasses(passRows);
  const medicationById = new Map(medications.map((m) => [m.id, toEntryMedication(m)]));
  const providersByEntry = groupLinksByEntry(linkRows, fromLocalTimestamp);
  const authorById = new Map(authors.map((a) => [a.id, a.name]));
  return byId(
    entries.map((entry): EntryResult => ({
      // A note's or event's text is its document (as on the timeline).
      ...withMedication(
        isLiveEntryKind(entry.kind) ? { ...entry, body: notes.get(entry.id) || null } : entry,
        (id) => medicationById.get(id),
        passes,
      ),
      providers: providersByEntry.get(entry.id) ?? [],
      authorName: authorById.get(entry.createdBy) || "Former member",
    })),
  );
};

/** A provider row with its practice's name, as `providerResultsSql` reads it. */
export type ProviderResultRow = ProviderRow & { practice_name: string | null };

/** Providers in a group (`p`, the first parameter) with their practice's name, by `where` on `p`. */
export const providerResultsSql = (where: string) =>
  `SELECT p.*, pr.name AS practice_name FROM provider p
   LEFT JOIN provider pr ON pr.id = p.practice_id AND pr.group_id = p.group_id AND pr.deleted_at IS NULL
   WHERE p.group_id = ? AND ${where}`;

/** The result for a row, or null when it isn't one (unreadable, or deleted). */
export const toProviderResult = (row: ProviderResultRow): ProviderResult | null => {
  const provider = row.deleted_at ? null : toProvider(row);
  return provider && { ...provider, practiceName: row.practice_name };
};

const readProviders = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<ProviderResultRow>(
    providerResultsSql(`p.deleted_at IS NULL AND ${inIds("p.id")}`),
    [groupId, ids],
  );
  return byId(rows.flatMap((row) => toProviderResult(row) ?? []));
};

const readMedications = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<MedicationRow>(
    `SELECT * FROM medication WHERE group_id = ? AND deleted_at IS NULL AND ${inIds("id")}`,
    [groupId, ids],
  );
  return byId(rows.flatMap((row) => toMedication(row) ?? []));
};

const readTodos = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<TodoRow>(
    `SELECT * FROM todo WHERE group_id = ? AND deleted_at IS NULL AND ${inIds("id")}`,
    [groupId, ids],
  );
  return byId(rows.flatMap((row) => toTodo(row) ?? []));
};

const readConditions = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<ConditionRow>(
    `SELECT * FROM recipient_condition WHERE group_id = ? AND deleted_at IS NULL AND ${inIds("id")}`,
    [groupId, ids],
  );
  return byId(toConditions(rows));
};

const LINK_TARGET = `coalesce(${TAG_TARGETS.map((t) => TAG_TARGET_COLUMNS[t]).join(", ")})`;

/** Which of `tags` (named by the text) each of the results (`ids`) carries, in one query. */
const readNamedTags = async (db: SyncDb, groupId: string, tags: readonly TagRow[], ids: string) => {
  if (!tags.length) return {};
  const links = await db.powersync.getAll<{ tag_id: string; record_id: string }>(
    `SELECT tag_id, ${LINK_TARGET} AS record_id FROM record_tag
     WHERE group_id = ? AND tag_id IN (SELECT value FROM json_each(?)) AND ${inIds(LINK_TARGET)}`,
    [groupId, JSON.stringify(tags.map((t) => t.id)), ids],
  );
  const carried = new Set(links.map((l) => `${l.record_id} ${l.tag_id}`));
  const shown = JSON.parse(ids) as string[];
  return Object.fromEntries(
    shown.flatMap((id) => {
      const on = tags.filter((t) => carried.has(`${id} ${t.id}`));
      return on.length ? [[id, on.map(({ id, name, color }): NamedTag => ({ id, name, color }))]] : [];
    }),
  );
};

/**
 * The range a search is narrowed to: the period's dates (the current one's
 * up to now), or null for any time. A period that isn't on the track (deleted
 * since, another group's) narrows nothing.
 */
const periodSearchRange = async (db: SyncDb, groupId: string, periodId: string | null) => {
  if (!periodId) return null;
  const range = searchPeriodRange(await loadSearchPeriods(db, groupId), periodId);
  return range && rangeUntilNow(range, new Date());
};

/**
 * The search page for `query` in one group (within its care period's dates,
 * when it names one: entries only; with a tag, only the items carrying it,
 * and with a tag and no text, every live one of them, conditions left out:
 * `taggedItems`). An unknown or deleted tag is no filter. While the index is being
 * prepared (a first open, a new format) it may find nothing yet; the page
 * says so and searches again when it's ready.
 */
export const loadSearch = async (
  db: SyncDb,
  groupId: string,
  query: SearchPageQuery,
): Promise<SearchPageData> => {
  const status = searchIndexStatus();
  const parsed = parseSearch(query.q);
  // A tag the text names finds the items carrying it (tags-3), so the tags are read for any text.
  const groupTags = query.tag || query.q.trim() ? await readRows<TagRow>(db, tagsQuery(groupId)) : [];
  const tag = query.tag ? activeTag(query.tag, groupTags) : null;
  const named = new Set(matchingTagIds(groupTags, parsed));
  const namedTags = groupTags.filter((t) => named.has(t.id));
  const none: SearchPageData = {
    ...query,
    tag: tag?.id ?? null,
    tagName: tag?.name ?? null,
    status,
    empty: isEmptySearch(parsed),
    sections: [],
    entries: {},
    providers: {},
    medications: {},
    todos: {},
    conditions: {},
    notes: {},
    namedTags: {},
  };
  // A tag with no text lists what carries it, without the index.
  const listing = !!tag && !query.q.trim();
  if (!listing && (none.empty || status === "unavailable")) return none;
  let sections: ResultSection[];
  try {
    const limits = sectionLimits(query.all);
    const results = listing
      ? await taggedItems(db, groupId, tag.id, limits)
      : await searchGroup(
          db,
          groupId,
          parsed,
          limits,
          await periodSearchRange(db, groupId, query.period),
          tag?.id ?? null,
          namedTags.map((t) => t.id),
        );
    sections = searchSections(results, query);
  } catch (e) {
    // The index's tables are being created (or rebuilt): nothing to show yet.
    if (status === "preparing") return none;
    throw e;
  }
  const ownerIds = JSON.stringify(
    sections.filter((s) => s.type !== "entry").flatMap((s) => s.hits.map((h) => h.id)),
  );
  const hitIds = JSON.stringify(sections.flatMap((s) => s.hits.map((h) => h.id)));
  const [entries, providers, medications, todos, conditions, notes, carried] = await Promise.all([
    readEntries(db, groupId, idsOf(sections, "entry")),
    readProviders(db, groupId, idsOf(sections, "provider")),
    readMedications(db, groupId, idsOf(sections, "medication")),
    readTodos(db, groupId, idsOf(sections, "todo")),
    readConditions(db, groupId, idsOf(sections, "condition")),
    readNotes(db, groupId, ownerIds),
    readNamedTags(db, groupId, namedTags, hitIds),
  ]);
  // An item deleted since it was indexed drops out (the index catches up in a moment).
  const shown = {
    entry: entries,
    provider: providers,
    medication: medications,
    todo: todos,
    condition: conditions,
  };
  return {
    ...none,
    sections: sections.map((s) => ({ ...s, hits: s.hits.filter((h) => h.id in shown[s.type]) })),
    entries,
    providers,
    medications,
    todos,
    conditions,
    notes: Object.fromEntries(notes),
    namedTags: carried,
  };
};
