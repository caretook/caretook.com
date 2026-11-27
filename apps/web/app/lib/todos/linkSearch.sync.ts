import type { SearchItemType } from "@caretook/data/schema";
import type { RankedHit } from "~/lib/search/searchResults";
import type { SyncDb } from "~/lib/sync";
import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { TagRow } from "~/lib/tags/tags.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";
import type { LinkCandidate, LinkPick, LinkType } from "./linkOptions";

import { isEmptySearch } from "@caretook/data/schema";
import { upcomingItems } from "~/lib/appointments/upcoming";
import { previewText } from "~/lib/live-notes/notes.sync";
import { toMedication } from "~/lib/medications/medications.sync";
import { toProvider } from "~/lib/providers/providers.sync";
import { matchingTagIds, parseSearch, searchGroup } from "~/lib/search/search.sync";
import { compareHits } from "~/lib/search/searchResults";
import { tagsQuery } from "~/lib/tags/tags.sync";
import { readRows, toLocalTimestamp, toTimelineEntry } from "~/lib/timeline/timeline.sync";
import { linkSuggestions, linkTypeWord, SUGGESTED_UPCOMING } from "./linkOptions";

// The "Link to…" box's search (todo-links): what a todo can link to (its
// provider and medication slots, live notes and events) that matches the
// typed text, through site search's device index and its tag match, in
// site search's order. `lib/search` is used through its exports only.

/** How many candidates the box lists at most. */
export const LINK_SEARCH_LIMIT = 20;

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

/** Every entry `searchGroup` matched: its sections are cut in JS, so asking for all costs no more SQL. */
const ALL_ENTRIES = Number.MAX_SAFE_INTEGER;

/**
 * The first `limit` of the entry hits that are live notes or live, not
 * cancelled events, in their order (B-988: many matching doses, vitals or
 * symptoms never crowd them out). One light query over the ids; the rows
 * and notes' text are read only for the ones kept.
 */
const linkableEntryHits = async (
  db: SyncDb,
  groupId: string,
  hits: readonly RankedHit[],
  { limit, skip, type }: { limit: number; skip: ReadonlySet<string>; type: LinkType | null },
) => {
  if (!hits.length || limit <= 0) return [];
  const kinds = type === "note" || type === "event" ? [type] : ["note", "event"];
  const rows = await db.powersync.getAll<{ id: string }>(
    `SELECT id FROM timeline_entry
     WHERE group_id = ? AND deleted_at IS NULL AND cancelled_at IS NULL
       AND kind IN (SELECT value FROM json_each(?)) AND ${inIds("id")}`,
    [groupId, JSON.stringify(kinds), idsOf(hits)],
  );
  const linkable = new Set(rows.map((r) => r.id));
  return hits.filter((h) => linkable.has(h.id) && !skip.has(h.id)).slice(0, limit);
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
 * the ids in `exclude` (what's linked already) left out. A type word
 * typed first or last (`linkTypeWord`: "provider lee") is read first and
 * keeps only its type, as `type` does (the box's chip); the word wins.
 * When that finds nothing, the whole text is searched as typed (an event
 * named "Eye doctor" is still found by "eye doctor"). An empty or
 * exclusion-only text (or a type word alone) finds nothing. `wordType`
 * is the type word the list was narrowed by: null with none, or when the
 * whole text was searched instead (its chip isn't on then).
 * Throws while the index is being created; the caller says "Preparing search…".
 */
export const searchLinkables = async (
  db: SyncDb,
  groupId: string,
  text: string,
  {
    exclude = [],
    limit = LINK_SEARCH_LIMIT,
    type: chosen = null,
  }: { exclude?: readonly string[]; limit?: number; type?: LinkType | null } = {},
): Promise<{ candidates: LinkCandidate[]; wordType: LinkType | null }> => {
  const word = linkTypeWord(text);
  const found = await searchOne(db, groupId, word.rest, word.type ?? chosen, exclude, limit);
  if (found.length || !word.type || !word.rest) return { candidates: found, wordType: word.type };
  return { candidates: await searchOne(db, groupId, text, chosen, exclude, limit), wordType: null };
};

/** `searchLinkables` for one reading of the text: `text` to search, of `type` only (null: all). */
const searchOne = async (
  db: SyncDb,
  groupId: string,
  text: string,
  type: LinkType | null,
  exclude: readonly string[],
  limit: number,
): Promise<LinkCandidate[]> => {
  const parsed = parseSearch(text);
  if (isEmptySearch(parsed)) return [];
  const tags = await readRows<TagRow>(db, tagsQuery(groupId));
  const want = limit + exclude.length;
  const wants = (t: LinkType | "entry") =>
    type === null || type === t || (t === "entry" && (type === "note" || type === "event"));
  const results = await searchGroup(
    db,
    groupId,
    parsed,
    {
      provider: wants("provider") ? want : 0,
      medication: wants("medication") ? want : 0,
      entry: wants("entry") ? ALL_ENTRIES : 0,
      todo: 0,
      condition: 0,
    },
    null,
    null,
    matchingTagIds(tags, parsed),
  );
  const skip = new Set(exclude);
  const entryHits = await linkableEntryHits(db, groupId, results.entry.hits, { limit, skip, type });
  const [providers, medications, entries] = await Promise.all([
    readProviders(db, groupId, idsOf(results.provider.hits)),
    readMedications(db, groupId, idsOf(results.medication.hits)),
    readEntries(db, groupId, idsOf(entryHits)),
  ]);
  const found: Partial<Record<SearchItemType, Map<string, LinkCandidate>>> = {
    provider: providers,
    medication: medications,
    entry: entries,
  };
  return [...results.provider.hits, ...results.medication.hits, ...entryHits]
    .filter((hit) => !skip.has(hit.id) && found[hit.type]?.has(hit.id))
    .sort(compareHits)
    .slice(0, limit)
    .flatMap((hit) => found[hit.type]?.get(hit.id) ?? []);
};

// --- Suggestions (B-947) -----------------------------------------------------

/** The rows `picks` name, by id: those that are live in the group (a note or event as its own kind). */
const readPicks = async (db: SyncDb, groupId: string, picks: readonly LinkPick[]) => {
  const of = (...types: LinkType[]) =>
    JSON.stringify(picks.filter((p) => types.includes(p.type)).map((p) => p.id));
  const [providers, medications, entries] = await Promise.all([
    readProviders(db, groupId, of("provider")),
    readMedications(db, groupId, of("medication")),
    readEntries(db, groupId, of("note", "event")),
  ]);
  return new Map([...providers, ...medications, ...entries]);
};

const DAY_MS = 86_400_000;

/**
 * The group's next `limit` live, not cancelled events at `now`: upcoming or
 * in progress (an all-day one through its day), in Upcoming's order.
 */
const upcomingEvents = async (db: SyncDb, groupId: string, now: Date, limit: number): Promise<LinkPick[]> => {
  const at = toLocalTimestamp(now);
  // An all-day event started up to a day and a bit ago may still be today, in its own zone.
  const allDayFrom = toLocalTimestamp(new Date(now.getTime() - 2 * DAY_MS));
  const rows = await db.powersync.getAll<EntryRow>(
    `SELECT * FROM timeline_entry
     WHERE group_id = ? AND kind = 'event' AND deleted_at IS NULL AND cancelled_at IS NULL
       AND (occurred_at > ? OR ends_at > ? OR (all_day = 1 AND occurred_at > ?))
     ORDER BY occurred_at, id LIMIT ?`,
    [groupId, at, at, allDayFrom, limit + 10],
  );
  const events = rows.flatMap((row) => toTimelineEntry(row) ?? []);
  return upcomingItems(events, now)
    .slice(0, limit)
    .map((e) => ({ type: "event", id: e.id }));
};

/**
 * What the empty box suggests (`linkSuggestions`'s order): the record it
 * was opened from, the group's next events, then what this user viewed
 * recently (`recent`, newest first), each only while it's live in the group
 * (a cancelled event left out), with what's `linked` left out and only
 * `type` when one is chosen. Needs no search index: it works while that's
 * prepared.
 */
export const suggestLinkables = async (
  db: SyncDb,
  groupId: string,
  {
    cameFrom = null,
    recent = [],
    linked = [],
    type = null,
    now = new Date(),
  }: {
    cameFrom?: LinkPick | null;
    recent?: readonly LinkPick[];
    linked?: readonly string[];
    type?: LinkType | null;
    now?: Date;
  } = {},
): Promise<LinkCandidate[]> => {
  // Enough upcoming ones for three after the linked and the came-from one are left out.
  const upcoming = await upcomingEvents(db, groupId, now, SUGGESTED_UPCOMING + linked.length + 1);
  const found = await readPicks(db, groupId, [...(cameFrom ? [cameFrom] : []), ...upcoming, ...recent]);
  const live = (picks: readonly LinkPick[]) =>
    picks.flatMap((p): LinkPick[] => {
      const row = found.get(p.id);
      return row ? [{ type: row.type, id: row.id }] : [];
    });
  return linkSuggestions({
    cameFrom: cameFrom ? (live([cameFrom])[0] ?? null) : null,
    upcoming: live(upcoming),
    recent: live(recent),
    linked,
    type,
  }).flatMap((p) => found.get(p.id) ?? []);
};
