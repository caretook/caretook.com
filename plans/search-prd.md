# Search: PRD

Status: 📝 **written**, not planned or sliced. Backlog item: B-11. Topic `search`. Interview: 2026-11-19.

Depends on `timeline-polish` (done: filters in the URL, infinite scroll, `entryWindow`). Shares the timeline route folder and the timeline's query windows with `appointments`, so it runs after `appointments` has landed. The `assistant` PRD's question slices wait on this PRD's server side.

## Problem Statement

A care group's timeline grows by dozens of entries a week: notes, events, appointments, symptoms, vitals, doses and medication changes. After a few weeks, a caretaker who wants to find something ("when did the cardiologist change her dose?", "what did the PT say about her knee?", "every time she fell") can only scroll back or tap a kind filter and scroll again. Provider and medication notes are reachable only by opening each provider or medication one at a time. There's no way to ask "where did we write about X?" across the group's record.

The searching has to work where caretakers are: often on a phone, often in a waiting room or a hospital with bad signal, and often right after typing the thing they now want to find. It also has to work for the coming assistant, which answers questions about the timeline from the server.

## Solution

Two ways to search, both on the device, both offline:

- **On the timeline**, a magnifier at the start of the filter chips opens a search field. Typing narrows the timeline to matching entries, in its usual day layout, with the matched words highlighted and a short snippet of a note's or event's text around the match. The search is a URL filter (`?q=`) alongside kind and author, shown as a "Matching "…"" chip with ✕. Upcoming and the Next strip show only matching items too.
- **A search page** for the current care group, opened from a magnifier in the `/app` header on group routes. It searches entries, providers and medications (including their notes), grouped into sections, best match first, with a "See all N in timeline" link that opens the timeline with the same query. With nothing typed, it shows this device's last five searches and one line of tips.

Matching is the same everywhere: every word must match, the last word (and any word) matches as a prefix ("pres" finds "pressure"), case and accents are ignored, English word forms match ("walked" finds "walking"), "quoted phrases" match in order, and -word excludes. Besides titles and text, an entry matches on its vital types ("blood pressure"), its medication's name (for doses and changes), its linked providers' names and its author's name.

Search runs on **SQLite full-text search (FTS5) on the device**, so it works offline and finds what was typed a moment ago, synced or not. The **server** gets the same search over Postgres full-text search, as a service and an oRPC procedure, for the API and the assistant.

## User Stories

### Searching the timeline

1. As a caretaker, I want a search control on the timeline, so that I can find an entry without scrolling back through weeks.
2. As a caretaker on a phone, I want the search control to take no extra row until I tap it, so that the timeline keeps its space.
3. As a caretaker, I want results to update as I type, so that I don't have to press a button or know the whole word.
4. As a caretaker, I want "pres" to find "pressure", so that I can type less on a phone.
5. As a caretaker, I want matching to ignore case and accents, so that "jose" finds "José".
6. As a caretaker, I want "walked" to find "walking" and "falls" to find "fall", so that I don't have to guess the exact word form.
7. As a caretaker, I want every word I type to have to match, so that adding a word narrows the results.
8. As a caretaker, I want "quoted words" to match as a phrase, so that I can find "short of breath" and not every entry with "short".
9. As a caretaker, I want -word to exclude entries with that word, so that I can drop the noise.
10. As a caretaker, I want the matching entries in the usual day layout, rows or cards, so that I still see when things happened.
11. As a caretaker, I want the matched words highlighted, so that I can see why each entry matched.
12. As a caretaker, I want a short snippet of a note's or event's text around the match, so that I don't have to open the note to see the context.
13. As a caretaker, I want search to combine with the kind and author filters, so that I can find "knee" in Sam's notes only.
14. As a caretaker, I want an active search shown as a "Matching "…"" chip with ✕, so that I know the timeline is filtered and can clear just the search.
15. As a caretaker, I want the search in the URL, so that Back, reload and a shared link keep it.
16. As a caretaker, I want infinite scroll to keep working while searching, so that I can reach the oldest matches.
17. As a caretaker, I want the empty state to say what I searched for, so that I know there were no matches rather than no entries.
18. As a caretaker, I want Upcoming and the Next strip to show only matching appointments while I search, so that the screen agrees with itself.
19. As a caretaker, I want the latest vitals line to stay as it is while I search, so that the current readings are always visible.
20. As a caretaker, I want a symptom's name, a vital's type ("blood pressure", "sleep"), a dose's medication and an appointment's place to be searchable, so that structured entries are findable too.
21. As a caretaker, I want "lisinopril" to find its doses and dose changes, so that I can see the history of one medication on the timeline.
22. As a caretaker, I want "Dr. Patel" to find the notes and events linked to Dr. Patel, so that I can find every visit with them.
23. As a caretaker, I want "Sam" to find entries Sam wrote, so that typing a name works like tapping their initials.
24. As a caretaker, I want a note I typed seconds ago (even offline) to be found, so that search never lags behind what I can see.
25. As a caretaker, I want deleted entries never to appear in results, so that search agrees with the timeline.

### The search page

26. As a caretaker, I want a magnifier in the app header on every group screen, so that I can search from anywhere in the group.
27. As a caretaker, I want the search page to search only the current care group, so that results never mix two people's care.
28. As a caretaker, I want the field focused when the page opens, so that I can type at once.
29. As a caretaker, I want results grouped into providers, medications and entries, so that I can jump to the kind of thing I'm after.
30. As a caretaker, I want the best match first in each group, title matches above text matches, and newer entries first among equals, so that the likely answer is at the top.
31. As a caretaker, I want a provider result to show a snippet from its notes when the match is there, so that I see why it matched.
32. As a caretaker, I want a medication result to show a snippet from its notes when the match is there, so that I can find "take with food" in a medication's notes.
33. As a caretaker, I want each section to show a few results and a way to see the rest, so that one section doesn't push the others off the screen.
34. As a caretaker, I want "See all N in timeline" under entries, so that I can read the matches in time order with the timeline's filters.
35. As a caretaker, I want tapping a result to open it (an entry's page or edit sheet as the timeline would, a provider's page, a medication's page), so that search is a way in, not a dead end.
36. As a caretaker, I want past providers and stopped medications included and marked as such, so that I can find history.
37. As a caretaker, I want my last five searches shown when the field is empty, so that I can repeat a search with one tap.
38. As a caretaker, I want recent searches kept only on this device and cleared when I sign out, so that health terms I searched for don't follow me or the next person.
39. As a caretaker, I want one line of tips on the empty page (quotes for a phrase, -word to exclude), so that I learn the syntax without a help page.
40. As a caretaker, I want the search in the page's URL, so that Back from a result returns to the same results.
41. As a caretaker, I want the page to say clearly when nothing matched, so that I can try other words.

### Everyone

42. As a viewer, I want to search the same way as writers, so that I can find information even though I can't edit it.
43. As a caretaker offline, I want both search surfaces to work fully, so that a waiting room without signal doesn't stop me.
44. As a caretaker on a slow phone, I want results within a fraction of a second for a group with months of entries, so that search feels instant.
45. As a keyboard or screen-reader user, I want the search control, field and results to be labelled, focusable and announced (a polite count of results), so that search is usable without sight or touch.
46. As a caretaker switching care groups, I want search never to show another group's data, so that groups stay separate on a shared device.

### Server and assistant

47. As the assistant, I want a server search over the group's entries, providers and medications with text, kinds, date range and author, in the asking user's permissions, so that I can answer questions about the record.
48. As the assistant, I want results with ids and short snippets, so that I can cite entries and fetch more only when needed.
49. As an API client, I want the same matching rules on the server as in the app, so that a query means the same thing everywhere.
50. As a non-member, I want a search of a group I'm not in to fail the same way as any other read, so that it reveals nothing.
51. As the developer, I want the device's index rebuilt automatically when its format changes, so that a new build never shows stale or missing results.

## Implementation Decisions

### Matching rules (shared)

- **One query language** for device and server: words (each must match), a prefix match on every word, `"quoted phrases"`, and `-word` / `-"phrase"` exclusions. Anything else (operators, punctuation, unbalanced quotes) is treated as plain text, never as syntax that can fail. A query with only exclusions or no words matches nothing and shows the empty state's tips.
- **English stemming, accents and case folded.** The device uses FTS5's `porter` tokenizer over `unicode61 remove_diacritics 2`; the server uses Postgres's `english` configuration over an immutable `unaccent` wrapper. Stemmers differ slightly, so device and server results may differ at the edges; that's accepted. A prefix is matched against stemmed tokens, so a prefix that runs past a word's stem ("walki") may miss; the query parser tries both the typed prefix and its stem.
- **What an entry's searchable text is** (the search document): title, body, a note's or event's document text, a symptom's name, the names of a vital's reading types, the medication's name and strength for doses and changes, the dose's or change's note, an event's place, the names of linked providers, and the author's name. Weighted fields: title-like fields (title, symptom name, medication name, provider names) above body-like fields (document text, notes, place, author).
- **Providers' searchable text:** name, specialty, practice name, and their notes document text. **Medications':** name, strength, reason, directions, and their notes document text.
- **Deleted rows never match**: soft-deleted entries, providers and medications. Cancelled appointments still match (the timeline still shows them, struck through).

### Modules

- **Query parser** (pure, client-safe, in the data package's shared schema area so device and server share it): user text → a parsed query (terms, phrases, exclusions) → an FTS5 `MATCH` string and a Postgres `tsquery` string. Interface: `parseSearch(text)`, `toFtsMatch(parsed)`, `toTsQuery(parsed)`, `isEmptySearch(parsed)`. Deep: all quoting and escaping lives here, so no caller builds a match string.
- **Search document builder** (pure, client-safe): entry, provider and medication rows plus their lookups (medication names, provider names, author names, document text) → `{ id, kind, groupId, title, body }` fields to index. Shared by the device indexer and the server's text expressions are documented to match it (the server builds the same fields in SQL; the unit tests pin the field list).
- **Highlight and snippet** (pure, client-safe): given shown text and the parsed query, the matched ranges (same folding and prefix rules, stem-aware) and a snippet of about 120 characters around the first match, on word boundaries with ellipses. Used for timeline rows and cards and search page results. Highlight is rendered as `<mark>`.
- **Ranking and grouping** (pure): search page results → sections (providers, medications, entries), each ordered by match weight (title-like over body-like), then FTS rank, then newest first for entries; the first few per section with a count of the rest.
- **Timeline filter:** `lib/timelineFilters` gains `q` (`parseFilters` reads it trimmed and length-capped; `setQuery`, `clearQuery`; `clearFilters` clears it too). The timeline's windows (`entryWindow`, `historyWindow`, `upcomingWindow` and the "with …" and medication lookups that share their condition) add an `id IN (matching ids)` condition from the device index when `q` is set. Paging stays keyed on all filters.
- **Device index** (`lib/sync/search`):
  - An FTS5 table created with raw SQL after the database opens (PowerSync's schema can't declare virtual tables), holding one row per entry, provider and medication of every local group: an id, its type, its group id, and the weighted fields. Plus a small local table with the index's format version.
  - **The indexer** watches the synced tables (entries, documents and their pending updates, providers, medications, links, member profiles) through PowerSync's change notifications, and re-indexes the affected rows in one transaction, debounced. Document text comes from the same local rebuild previews use (snapshot plus pending updates), so text typed on the device is searchable within a second, synced or not.
  - **A full rebuild** runs when the format version changes or the index is missing, in the background after first sync; until it finishes, search shows "Preparing search…". Sign-out deletes the database file, and the index with it.
  - Queries: `searchEntryIds(groupId, parsed)` for the timeline's condition, and `searchGroup(groupId, parsed, limits)` for the page, both always scoped to one group.
  - Check that PowerSync's web SQLite build has FTS5 and the porter tokenizer before slice 1 builds on it (the bundled wa-sqlite builds contain FTS5).
- **Recent searches** (`lib/recentSearches`, like `lib/lastGroup`): the last five distinct queries per user in localStorage, saved when a search is run (on leaving the field or opening a result, not every keystroke), cleared by `forgetRecentSearches` at sign-out. Storage that throws means no recents. Never sent to the server.
- **Screens:**
  - The timeline: `TimelineFilters` gets the magnifier and an expanding field (over the chips on phones, beside them from `sm`), and a "Matching "…"" chip with ✕, built through `timelineFilters` like every filter control; typing replaces the URL (debounced, `replace`, `preventScrollReset`). `EntryBody` highlights matches and adds the snippet line for notes and events when the match isn't in the visible text. The empty state names the search.
  - The search page: a route under the group route (`appUrls.search(groupId, q?)`), not a group section. The magnifier in the `/app` header (an `IconButton` link, group routes only, placed before the sync status). An autofocused field, `?q=` in the URL (debounced `replace`), recents and tips when empty, then the sections, each a list of results; "See all N in timeline" links through `appUrls.timeline` with `q`. A polite `role="status"` result count.
- **Server:**
  - A migration that enables `unaccent` and adds the immutable wrapper. Text is built **at query time, scoped to one group** (joins for linked providers, medication names and author names), so there are no stored search columns or triggers to keep in step across every writer. Note text is the stored **compacted** text (no compaction before search); recent typing reaches it at the next compaction.
  - If one group's search exceeds 200 ms in the integration test with 10,000 entries, add stored `tsvector` columns with GIN indexes instead; that's a change inside the service, not its interface.
  - `searchService.search(ctx, { groupId, q, scopes?, kinds?, from?, to?, authorId?, limit, cursor? })`, in the actor's scope like every service (a non-member gets the same not-found as other reads). Returns sections of `{ id, type, title, snippet, occurredAt?, rank }` with `ts_headline` snippets, entries keyset-paged.
  - oRPC `search.query` (authed), a thin wrapper returning DTOs. The app doesn't call it; it's for the API and the assistant's `searchEntries` tool.

### Rules across PRDs

- Edits to `timelineFilters`, the timeline windows, `routes.ts`, `appUrls` and the router are additive. The device schema gets no new synced table; the FTS table and its version table are created outside it.
- One migration (`unaccent`); it takes its number when it lands.
- New rules in `scripts/loops/check-areas` for the search page and the search modules.

## Testing Decisions

- **Good tests check behaviour through the module's interface**: given input text or rows, the output a caller relies on; never internal helpers or SQL strings beyond what's observable (a match string is the interface for the parser, so it's asserted, along with whether it matches sample text through a real SQLite FTS5 where available).
- **Unit tests (`web:unit` and `data:unit`):**
  - The query parser: words, prefixes, phrases, exclusions, junk and unbalanced quotes, empty and exclusion-only queries, both outputs.
  - The search document builder: every kind's fields (vital type names, medication names on doses and changes, linked providers, author, place, document text), providers and medications, deleted rows excluded.
  - Highlight and snippet: folding, prefixes, stems, phrases, word boundaries, ellipses, text with no match.
  - Ranking and grouping, and the `q` URL helpers (`parseFilters`, `setQuery`, `clearQuery`, `clearFilters`), alongside the existing `timelineFilters` tests.
  - Recent searches: dedupe, cap of five, per user, forget, storage that throws.
- **Integration tests (`integration`):** `searchService` against the test Postgres: each field type matches, scoping (a non-member gets not-found; a viewer can search), deleted rows excluded, filters (kinds, dates, author), paging, and the 10,000-entry timing check. Fixtures built per test (`fixtures.ts`), as the other `*.int.test.ts` do.
- **Browser check:** a new `search.mjs` (in the suite, with `check-areas` rules): the timeline field and chip, highlights and snippets, combining with kind and author, infinite scroll under a search, the search page sections and links, recents and sign-out clearing them, a just-typed offline note found at once, a viewer, and the other group's data never appearing (member@'s two groups). Smoke mode: one search on each surface. Prior art: `phase2.mjs` (timeline filters), `providers.mjs` (directory search), `live-notes.mjs` (offline typing through the proxy).

## Out of Scope

- Search across all of a user's care groups at once.
- Elasticsearch or any other search service (another host and another copy of health data).
- Embeddings, semantic or "fuzzy" spelling-tolerant matching.
- Searching vital values or ranges ("BP over 160"), dates typed as text, or structured query fields (`kind:`, `by:`); the filters cover kind and author.
- Saved searches, search alerts, or syncing recent searches between devices.
- Searching the marketing site, admin screens, invites or members.
- The assistant itself (B-12) and its tools; this PRD only provides the server search it calls.
- A compaction sweep so server text is always fresh (still a separate follow-up under _Live notes_).

## Further Notes

- **Order of slices (rough, for planning):** (1) the query parser and search document builder, the device FTS index and indexer with its rebuild, proved through `window.caretookModules()`; (2) the timeline's `q` filter, chip, field, highlight and snippet; (3) the search page with sections, links, recents and tips, and the header magnifier; (4) the server: `unaccent` migration, `searchService`, `search.query`, integration tests. Slice 4 depends only on slice 1's shared parser and builder, so it can run alongside 2 and 3.
- **Timing:** start after `appointments` lands (the timeline route folder and the timeline windows are hot files for both). Slice 4 can start earlier, since it touches neither.
- **Performance budget:** the device index for about 2,000 entries plus providers and medications should rebuild in under 2 s on a mid-range phone and answer a query in under 50 ms; slice 1 measures both with seeded data scaled up.
- **Privacy:** searches are never logged on the server beyond normal request handling, and recent searches never leave the device. The index lives in the same database file that sign-out deletes.
- **Open questions:** ❓ whether the header magnifier should also get a keyboard shortcut (`/`) on wide screens; ❓ whether "See all N in timeline" should also carry a kind filter when only one kind matched.
