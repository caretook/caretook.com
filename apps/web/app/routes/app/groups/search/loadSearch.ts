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
import type { LocalTask, TaskRow } from "~/lib/tasks/tasks.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";
import type { EntryProviderLinkRow } from "~/lib/providers/entryProviders";

import { isEmptySearch } from "@caretook/data/schema";
import { groupLinksByEntry } from "~/lib/providers/entryProviders";
import { isLiveEntryKind } from "~/lib/live-notes/liveEntry";
import { medicationIdOf, withMedication } from "~/lib/medications/medicationEntries";
import { searchSections, sectionLimits } from "~/lib/search/searchResults";
import { loadSchedulePasses, toPasses } from "~/lib/medications/medicationPasses.sync";
import { toEntryMedication } from "~/lib/medications/medicationTimeline.sync";
import { toMedication } from "~/lib/medications/medications.sync";
import { previewText } from "~/lib/live-notes/notes.sync";
import { toProvider, windowLinksQuery } from "~/lib/providers/providers.sync";
import { toTask } from "~/lib/tasks/tasks.sync";
import { rangeUntilNow } from "~/lib/care-periods/periodSearch";
import { loadSearchPeriods, searchPeriodRange } from "~/lib/care-periods/periodSearch.sync";
import { parseSearch, searchGroup, searchIndexStatus } from "~/lib/search/search.sync";
import { fromLocalTimestamp, toTimelineEntry } from "~/lib/timeline/timeline.sync";

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
  sections: ResultSection[];
  entries: Record<string, EntryResult>;
  providers: Record<string, ProviderResult>;
  medications: Record<string, LocalMedication>;
  tasks: Record<string, LocalTask>;
  /** The notes' text of the providers, medications and tasks shown (by their id), for snippets. */
  notes: Record<string, string>;
};

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

const readProviders = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<ProviderRow & { practice_name: string | null }>(
    `SELECT p.*, pr.name AS practice_name FROM provider p
     LEFT JOIN provider pr ON pr.id = p.practice_id AND pr.group_id = p.group_id AND pr.deleted_at IS NULL
     WHERE p.group_id = ? AND p.deleted_at IS NULL AND ${inIds("p.id")}`,
    [groupId, ids],
  );
  return byId(
    rows.flatMap((row) => {
      const provider = toProvider(row);
      return provider ? [{ ...provider, practiceName: row.practice_name }] : [];
    }),
  );
};

const readMedications = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<MedicationRow>(
    `SELECT * FROM medication WHERE group_id = ? AND deleted_at IS NULL AND ${inIds("id")}`,
    [groupId, ids],
  );
  return byId(rows.flatMap((row) => toMedication(row) ?? []));
};

const readTasks = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<TaskRow>(
    `SELECT * FROM task WHERE group_id = ? AND deleted_at IS NULL AND ${inIds("id")}`,
    [groupId, ids],
  );
  return byId(rows.flatMap((row) => toTask(row) ?? []));
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
 * when it names one: entries only). While the index is being
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
  const none: SearchPageData = {
    ...query,
    status,
    empty: isEmptySearch(parsed),
    sections: [],
    entries: {},
    providers: {},
    medications: {},
    tasks: {},
    notes: {},
  };
  if (none.empty || status === "unavailable") return none;
  let sections: ResultSection[];
  try {
    const range = await periodSearchRange(db, groupId, query.period);
    sections = searchSections(await searchGroup(db, groupId, parsed, sectionLimits(query.all), range), query);
  } catch (e) {
    // The index's tables are being created (or rebuilt): nothing to show yet.
    if (status === "preparing") return none;
    throw e;
  }
  const ownerIds = JSON.stringify(
    sections.filter((s) => s.type !== "entry").flatMap((s) => s.hits.map((h) => h.id)),
  );
  const [entries, providers, medications, tasks, notes] = await Promise.all([
    readEntries(db, groupId, idsOf(sections, "entry")),
    readProviders(db, groupId, idsOf(sections, "provider")),
    readMedications(db, groupId, idsOf(sections, "medication")),
    readTasks(db, groupId, idsOf(sections, "task")),
    readNotes(db, groupId, ownerIds),
  ]);
  // An item deleted since it was indexed drops out (the index catches up in a moment).
  const shown = { entry: entries, provider: providers, medication: medications, task: tasks };
  return {
    ...none,
    sections: sections.map((s) => ({ ...s, hits: s.hits.filter((h) => h.id in shown[s.type]) })),
    entries,
    providers,
    medications,
    tasks,
    notes: Object.fromEntries(notes),
  };
};
