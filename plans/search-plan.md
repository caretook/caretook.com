# Plan: Search

> Source PRD: [`plans/search-prd.md`](search-prd.md) (B-11). Topic `search`.

## Status

| Slice | State                                    | Merge into `prd/search` (slice commits)     |
| ----- | ---------------------------------------- | ------------------------------------------- |
| 1     | merged; landing in `dev`                 | `8f0d824` (`8a89d76`, `07989af`, `34f68fd`) |
| 2     | blocked by 1, and `appointments` slice 7 |                                             |
| 3     | in progress (`.loops/search-3`)          |                                             |
| 4     | blocked by 2 and 3                       |                                             |
| 5     | blocked by 3                             |                                             |
| 6     | in progress (`.loops/search-6`)          |                                             |

Backlog: B-11 is claimed by `prd/search`; mark it `done` after the last slice merges. The user said (2026-11-19) to land waves without asking, move on to the next work, and clean up at the end. Slice 2 waits until `appointments` has fully landed, including its slice 7 (the user's call), not just slices 1–6.

## Architectural decisions

Durable decisions every slice follows:

- **Routes** (children of the group route `/app/groups/:groupId`, built through `appUrls`):
  - `timeline?q=<text>`: the timeline's search filter, alongside `kind` and `author`.
  - `search?q=<text>`: the search page (not a group section; no tab-bar entry). `appUrls.search(groupId, q?)`.
- **One query language** for device and server: words (all must match, each as a prefix), `"phrases"`, `-word` and `-"phrase"` exclusions; anything else is plain text and never a syntax error. Only exclusions, or nothing, is an empty search. The parser is the only place a match string is built.
- **Folding:** case and accents ignored; English stemming. Device: FTS5 `porter unicode61 remove_diacritics 2`. Server: Postgres `english` over an immutable `unaccent` wrapper. Small differences between the two are accepted. A prefix that runs past a word's stem is tried both as typed and stemmed.
- **What is searchable** (the search document, one pure builder shared by device and server tests):
  - Entries: title, body, a note's or event's document text, a symptom's name, a vital's reading type names, the medication's name and strength (doses and changes), a dose's or change's note, an event's place, linked providers' names, the author's name. Title-like fields (title, symptom name, medication name, provider names) weigh more than body-like ones.
  - Providers: name, specialty, practice name, their notes' text. Medications: name, strength, reason, directions, their notes' text.
  - Soft-deleted rows never match. Cancelled appointments do. Past providers and stopped medications do, marked as such.
- **Device index:** an FTS5 table created with raw SQL after the database opens (PowerSync's schema can't declare virtual tables), one row per entry, provider and medication of every local group (id, type, group id, weighted fields), plus a local table with the index's format version. Kept current from PowerSync's table change notifications, debounced, in one transaction per batch; document text from the same local rebuild previews use (snapshot plus pending updates), so unsynced typing is searchable. A format change or a missing index triggers a background rebuild after first sync ("Preparing search…" meanwhile). Every query is scoped to one group. Sign-out deletes it with the database file.
- **No synced schema changes.** The only migration is the server's `unaccent` (slice 6); it takes its number when it lands.
- **Server:** text built at query time, scoped to one group, from stored compacted note text (no compaction before search). `searchService.search(ctx, { groupId, q, scopes?, kinds?, from?, to?, authorId?, limit, cursor? })` in the actor's scope (non-members get the usual not-found); oRPC `search.query`. The app never calls it.
- **Recent searches:** the last five distinct queries per user in localStorage, saved when a search is used (leaving the field or opening a result), cleared at sign-out, never sent anywhere.
- **Shared files** (additive edits only): `lib/timelineFilters`, the timeline windows in `lib/sync/timeline.ts` (and the lookups that share their condition), `routes.ts`, `appUrls`, the `/app` header (`routes/app/layout/route.tsx`), the router, `scripts/loops/check-areas`.

## How to run this plan

- **Waves:** 1 → (2, 3, 6) → (4, 5). Slice 2 also waits for `appointments` to land in `dev` (the timeline route folder and the timeline windows are hot files for both); 3 and 6 don't touch them.
- **Browser check:** slice 1 creates `search.mjs` (in the suite) and adds its `check-areas` rules; later slices extend it. Slice 2 also runs `phase2.mjs` (the timeline), slice 3 `app-shell.mjs` (the header). Slice 6 needs none (server only, integration tests).
- **Performance:** slice 1 measures the rebuild (target under 2 s for about 2,000 entries plus providers and medications) and a query (under 50 ms) with seeds scaled up in a check run, and records the numbers in its hand-off. Slice 6 has the 200 ms server budget for 10,000 entries.
- Everything stays fictional; checks tag and clean up what they create.

---

## Slice 1: The search index on the device

**User stories:** US 4–9, 20–25, 43, 44, 46, 51. **Blocked by:** none. **Blocks:** 2, 3, 6.

### What to build

The shared, client-safe query parser (to an FTS5 match and a Postgres tsquery) and search document builder, with unit tests. On the device: the FTS5 index and its version table, created after the database opens; the indexer that keeps it current from table changes (entries, documents and pending updates, providers, medications, provider links, member profiles); the full rebuild on a format change or a missing index; and group-scoped queries returning matching entry ids and grouped page results with ranks. Exposed through `window.caretookModules()` for checks. No screen changes yet.

### Acceptance criteria

- [ ] PowerSync's web SQLite build supports FTS5 and the porter tokenizer (checked first; stop and report if not).
- [ ] Unit tests cover the parser (words, prefixes, phrases, exclusions, junk, unbalanced quotes, empty and exclusion-only; both outputs) and the builder (every kind's fields, providers, medications, deleted rows left out).
- [ ] Through the device module: a seeded entry is found by title, by note text, by symptom name, by vital type ("blood pressure"), by medication name on a dose, by a linked provider's name and by its author's name; "walked" finds "walking"; accents and case are ignored; a phrase and an exclusion behave.
- [ ] Text typed in a note offline is found within a second; an entry deleted on another device stops matching after sync.
- [ ] Results never include another group's rows (member@'s two groups).
- [ ] Bumping the format version rebuilds the index; the rebuild and query times are measured and reported.
- [ ] `search.mjs` exists with these steps, is in the suite, and `check-areas` maps the search modules to it.

---

## Slice 2: Search on the timeline

**User stories:** US 1–3, 7, 10, 13–19. **Blocked by:** 1, `appointments` landed in `dev`. **Blocks:** 4.

### What to build

`?q=` in the timeline's filters (parsed, trimmed, length-capped; `setQuery`, `clearQuery`, and `clearFilters` clearing it), applied to the history, Upcoming and Next windows and the lookups that share their condition. A magnifier at the start of the filter chips expands a field (over the chips on phones, beside them from `sm`); typing updates the URL (debounced, `replace`, `preventScrollReset`). An active search is a "Matching "…"" chip with ✕ that clears only the search. Infinite scroll keeps working, paging keyed on every filter. The latest vitals line ignores the search. The empty state names the search. A polite announcement of the result state.

### Acceptance criteria

- [ ] Unit tests for the `q` helpers alongside the existing filter tests.
- [ ] Typing in the field narrows the timeline as you type; the URL carries `q`; reload and Back keep it.
- [ ] Search combines with the kind and author filters; the chip's ✕ clears only the search.
- [ ] Scrolling reaches the oldest match; a search change starts from one page.
- [ ] Upcoming and the Next strip show only matching items; latest vitals is unchanged.
- [ ] The empty state says no entries match the search.
- [ ] Works offline and for a viewer, rows and cards, at 420 and 1280.
- [ ] `search.mjs` covers it; `phase2.mjs` passes.

---

## Slice 3: The search page

**User stories:** US 26–36, 40–42, 45. **Blocked by:** 1. **Blocks:** 4, 5.

### What to build

A magnifier (`IconButton` link) in the `/app` header on group routes, before the sync status, opening `/app/groups/:groupId/search`. The page: an autofocused field with `?q=` in the URL (debounced `replace`), then sections for providers, medications and entries from the pure ranking and grouping module (title-like matches above body-like, then rank, entries newest first among equals; a few per section with "Show all N" for the rest). Results open what they are: an entry as the timeline would (its page, or its edit sheet for writers, or nothing for a viewer's symptom), a provider's page, a medication's page. Past providers and stopped medications are marked. "See all N in timeline" opens the timeline with the same `q`. A polite result count; a clear no-matches state.

### Acceptance criteria

- [ ] Unit tests for ranking and grouping and `appUrls.search`.
- [ ] The magnifier shows on every group route at 420 and 1280 and opens the page with the field focused.
- [ ] A search shows the right sections in the right order; each result opens the right screen, and Back returns to the same results.
- [ ] "See all N in timeline" opens the timeline filtered to the same search (once slice 2 has merged; until then the link is there with `q`).
- [ ] Past providers and stopped medications appear, marked.
- [ ] Works offline and for a viewer; never shows the other group's data.
- [ ] `search.mjs` covers it, `check-areas` maps the route; `app-shell.mjs` passes.

---

## Slice 4: Highlights and snippets

**User stories:** US 11, 12, 31, 32. **Blocked by:** 2, 3. **Blocks:** none.

### What to build

The pure highlight and snippet module (matched ranges with the same folding, prefix and stem rules; a snippet of about 120 characters on word boundaries with ellipses), with unit tests. On the timeline, matched words are marked in rows and cards, and a note or event whose match isn't in its visible text gets a snippet line. On the search page, entries show their snippet, and a provider or medication matched in its notes shows a snippet from them.

### Acceptance criteria

- [ ] Unit tests cover folding, prefixes, stems, phrases, word boundaries, ellipses and text with no match.
- [ ] Matched words are marked (`<mark>`) on the timeline in both views and on the search page.
- [ ] A note matched deep in its text shows a snippet around the match on the timeline and the page.
- [ ] A provider and a medication matched only in their notes show a snippet from the notes.
- [ ] Marks read sensibly to a screen reader (no broken words) and keep contrast in light and dark.
- [ ] `search.mjs` covers it; `phase2.mjs` passes.

---

## Slice 5: Recent searches and tips

**User stories:** US 37–39. **Blocked by:** 3. **Blocks:** none.

### What to build

The recent-searches module (last five distinct per user, saved when a search is used, storage that throws means none, cleared at sign-out with the other per-user device state), with unit tests. With the field empty, the search page shows them (one tap runs a search) and one line of tips: quotes for a phrase, -word to exclude.

### Acceptance criteria

- [ ] Unit tests cover dedupe, the cap of five, per-user keys, forgetting, and storage that throws.
- [ ] Searches from the page and the timeline field appear as recents; a tap runs one.
- [ ] Sign-out clears them; another user on the device never sees them.
- [ ] The tips line shows only while the field is empty.
- [ ] `search.mjs` covers it; `signout-wipe.mjs` passes.

---

## Slice 6: Server search

**User stories:** US 47–50. **Blocked by:** 1. **Blocks:** none (the `assistant` PRD's question slices).

### What to build

A migration enabling `unaccent` with an immutable wrapper. `searchService.search` over one group's entries, providers and medications with the shared parser's tsquery, the same searchable fields (joins for medication names, linked providers and authors; compacted note text), filters (scopes, kinds, date range, author), `ts_headline` snippets, ranks and keyset paging, in the actor's scope. The authed oRPC `search.query`, a thin DTO wrapper. Integration tests, including the timing check.

### Acceptance criteria

- [ ] Integration tests: each searchable field matches; phrases and exclusions; deleted rows excluded; filters; paging; a viewer can search; a non-member gets not-found.
- [ ] A group with 10,000 fictional entries answers in under 200 ms in the test database (if not, stored `tsvector` columns with GIN indexes replace query-time text, behind the same interface).
- [ ] `search.query` returns ids, types, titles, snippets and dates, and nothing outside the group.
- [ ] The migration's SQL is read and in the right order; `pnpm check` passes.
