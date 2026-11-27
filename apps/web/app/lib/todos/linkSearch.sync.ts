import type { SearchItemType } from "@caretook/data/schema";
import type { RankedHit } from "~/lib/search/searchResults";
import type { SyncDb } from "~/lib/sync";
import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { TagRow } from "~/lib/tags/tags.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";
import type { LinkCandidate } from "./linkOptions";

import { isEmptySearch } from "@caretook/data/schema";
import { previewText } from "~/lib/live-notes/notes.sync";
import { toMedication } from "~/lib/medications/medications.sync";
import { toProvider } from "~/lib/providers/providers.sync";
import { matchingTagIds, parseSearch, searchGroup } from "~/lib/search/search.sync";
import { compareHits } from "~/lib/search/searchResults";
import { tagsQuery } from "~/lib/tags/tags.sync";
import { readRows, toTimelineEntry } from "~/lib/timeline/timeline.sync";

// The "Link to…" box's search (todo-links): what a todo can link to (its
// provider and medication slots, live notes and events) that matches the
// typed text, through site search's device index and its tag match, in
// site search's order. `lib/search` is used through its exports only.

/** How many candidates the box lists at most. */
export const LINK_SEARCH_LIMIT = 20;

/** Entries are over-fetched: doses, vitals, symptoms and cancelled events match too, and are dropped. */
const ENTRY_OVERFETCH = 5;

const inIds = (column: string) => `${column} IN (SELECT value FROM json_each(?))`;

const idsOf = (hits: readonly RankedHit[]) => JSON.stringify(hits.map((h) => h.id));

type ProviderLinkRow = ProviderRow & { practice_name: string | null };

const readProviders = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<ProviderLinkRow>(
    `SELECT p.*, pr.name AS practice_name FROM provider p
     LEFT JOIN provider pr ON pr.id = p.practice_id AND pr.group_id = p.group_id AND pr.deleted_at IS NULL
     WHERE p.group_id = ? AND p.deleted_at IS NULL AND ${inIds("p.id")}`,
    [groupId, ids],
  );
  return new Map(
    rows.flatMap((row): [string, LinkCandidate][] => {
      const p = toProvider(row);
      return p
        ? [
            [
              p.id,
              {
                type: "provider",
                id: p.id,
                provider: { ...p, practiceName: row.practice_name },
              },
            ],
          ]
        : [];
    }),
  );
};

const readMedications = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<MedicationRow>(
    `SELECT * FROM medication WHERE group_id = ? AND deleted_at IS NULL AND ${inIds("id")}`,
    [groupId, ids],
  );
  return new Map(
    rows.flatMap((row): [string, LinkCandidate][] => {
      const m = toMedication(row);
      return m ? [[m.id, { type: "medication", id: m.id, medication: m }]] : [];
    }),
  );
};

/** The live notes and events among `ids` (a cancelled event left out), with the notes' text. */
const readEntries = async (db: SyncDb, groupId: string, ids: string) => {
  const rows = await db.powersync.getAll<EntryRow>(
    `SELECT * FROM timeline_entry
     WHERE group_id = ? AND deleted_at IS NULL AND cancelled_at IS NULL
       AND kind IN ('note', 'event') AND ${inIds("id")}`,
    [groupId, ids],
  );
  const entries = rows.flatMap((row) => toTimelineEntry(row) ?? []);
  const noteIds = JSON.stringify(entries.filter((e) => e.kind === "note").map((e) => e.id));
  const documents = await db.powersync.getAll<NoteDocRow>(
    `SELECT d.id, d.snapshot, d.text,
            (SELECT json_group_array(u.data) FROM note_update u WHERE u.document_id = d.id) AS updates
     FROM note_document d WHERE d.group_id = ? AND ${inIds("d.id")}`,
    [groupId, noteIds],
  );
  const texts = new Map(documents.map((d) => [d.id, previewText(d)]));
  return new Map(
    entries.map((e): [string, LinkCandidate] => [
      e.id,
      e.kind === "event"
        ? { type: "event", id: e.id, event: e }
        : { type: "note", id: e.id, note: { ...e, text: texts.get(e.id) ?? null } },
    ]),
  );
};

/**
 * What a todo can link to that matches `text` in one group: providers,
 * medications, live notes and live, not cancelled events, never a todo, a
 * condition or another entry kind. The text is site search's (its parser,
 * its tag-name match), and the list is in site search's order (title
 * matches first, then rank, then newest: `compareHits`), at most `limit`,
 * the ids in `exclude` (what's linked already) left out. An empty or
 * exclusion-only text finds nothing. Throws while the index is being
 * created; the caller says "Preparing search…".
 */
export const searchLinkables = async (
  db: SyncDb,
  groupId: string,
  text: string,
  { exclude = [], limit = LINK_SEARCH_LIMIT }: { exclude?: readonly string[]; limit?: number } = {},
): Promise<LinkCandidate[]> => {
  const parsed = parseSearch(text);
  if (isEmptySearch(parsed)) return [];
  const tags = await readRows<TagRow>(db, tagsQuery(groupId));
  const want = limit + exclude.length;
  const results = await searchGroup(
    db,
    groupId,
    parsed,
    { provider: want, medication: want, entry: want * ENTRY_OVERFETCH, todo: 0, condition: 0 },
    null,
    null,
    matchingTagIds(tags, parsed),
  );
  const [providers, medications, entries] = await Promise.all([
    readProviders(db, groupId, idsOf(results.provider.hits)),
    readMedications(db, groupId, idsOf(results.medication.hits)),
    readEntries(db, groupId, idsOf(results.entry.hits)),
  ]);
  const found: Partial<Record<SearchItemType, Map<string, LinkCandidate>>> = {
    provider: providers,
    medication: medications,
    entry: entries,
  };
  const skip = new Set(exclude);
  return [...results.provider.hits, ...results.medication.hits, ...results.entry.hits]
    .filter((hit) => !skip.has(hit.id) && found[hit.type]?.has(hit.id))
    .sort(compareHits)
    .slice(0, limit)
    .flatMap((hit) => found[hit.type]?.get(hit.id) ?? []);
};
