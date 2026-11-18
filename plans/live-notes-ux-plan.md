# Plan: Notes and events are live documents

> Source PRD: [`plans/live-notes-ux-prd.md`](live-notes-ux-prd.md). User-story numbers (US) refer to it.

## Status

| Slice | State                    | Merge into `data-layer` (slice commits) |
| ----- | ------------------------ | --------------------------------------- |
| 1     | ✅ merged                | `b0ceb5c` (`ce4feec`)                   |
| 2     | ✅ merged                | `ecd70a8` (`ddd8c2b`)                   |
| 4     | ✅ merged                | `73f76ff` (`cf17d0b`)                   |
| 5     | ✅ merged                | `195b243` (`54239fc`)                   |
| 6     | ✅ merged                | `40e4e54` (`ffe16d9`, `3836ab3`)        |
| 8     | ✅ merged                | `52abf68` (`90d7ce7`)                   |
| 9     | ✅ merged                | `5388422` (`943d63d`)                   |
| 3, 7  | **ready: the next wave** | `loop/slice-3`, `loop/slice-7`          |
| 10    | blocked by 3 and 7       |                                         |

Post-merge fix: `3604c18` (`entry-header.mjs` targets the ⋯ menu by label now that Share shares the `actions` region; `share.mjs` picks a note with text).

**After the wave-2 merges** (main checkout, fresh dev server): `pnpm check` passes (14 files, 202 tests). Browser checks: `live-note` 23/23, `live-notes` 24/24, `phase2` 36/36, `entry-header` 16/16, `editors` 14/14, `share` 14/14, `signout-wipe` clean. The first run after a reset can fail on PowerSync's 401 (JWKS refetch); rerun once. **`roundtrip.mjs` is stale** (it presses a "Note" button, a link since slice 1): slice 10 rewrites it.

**Next wave:** a fresh orchestrator runs `scripts/loops/new.sh 3 slice-3` and `new.sh 7 slice-7`, then one agent each. They collide only in `entry.tsx` (3: the title region; 7: the banner, outside the header) and maybe `timeline.tsx` (7's live dot). Merge 3, then 7, then start 10.

### What the merged slices left for later slices

- **Slice 3 (event title suggestions):**
  - Show chips when `isUnnamedEvent(kind, title)` (`lib/liveEntry.ts`) is true: an event whose title is empty or `"Event"` (`DEFAULT_EVENT_TITLE`).
  - Put them in the header's **title** region next to `EntryTitle`, whose value and placeholder come from `titleField(kind, title, saved)`.
  - A chip tap can go through `commitTitle(chip)`: it saves a new draft (`isNew && !saved.current`) or renames an existing entry.
- **Slice 7 (live dot, Live now banner):**
  - Data: `groupEditorsQuery(groupId)` with `useLiveQuery`, one `useNow()`, and `toRecentEditors(row, { now, viewerId: db.userId })` per document (`lib/sync/editors.ts`). `row.id` is the entry id. The most recently active document has the largest `result[0].lastEditAt`.
  - `recentEditors` and the window/tick constants come from `@caretook/data/schema` (`noteEditors.ts`).
  - `EditorAvatars` builds its "X is editing" label inline; lift `listNames` out if the banner needs the same wording.
  - Rows: anything clickable in a row or card must be `relative z-10`, above the row's stretched open target (`EntryOpenTarget`, `absolute inset-0`). Anything else sits under it, so taps on it still open the entry. Rows are `relative isolate` so they stay under the sticky day headers.
- **Slice 10 (checks and docs):**
  - Rewrite `roundtrip.mjs` (Note is a link; the sheet is Symptom and Vitals only).
  - Consolidate `live-note`, `live-notes`, `entry-header`, `editors` and `share`. Checks find rows' open targets by `a[aria-label^="Open "]` / `button[aria-label^="Edit "]`, real taps go through CDP mouse events (`tap()` in `phase2.mjs`), the header menu by `button[aria-label^="Actions for"]`, Share by `button[aria-label="Share"]`, avatars by `[data-region="editors"] [data-editor]`.
  - Consider merging `EntryMenu` (entry header) into the timeline's `EntryActions`.
  - Seed bodies with `- ` lines become plain paragraphs, not bullets (only `• ` makes a list).
- **Still true from slice 1:**
  - `entry.tsx` reads `getSync()` once into state, because sign-out closes the DB while the page can still render once more.
  - The route's `ensureSaved` must stay stable, or the editor rebinds.
  - `routeDiscovery: { mode: "initial" }` stays (lazy discovery fails offline).
  - The entry header is `main header`; the app navbar is also a `<header>`.

## How to run this plan

- **Slice 1 runs alone.** Every other slice builds on its route, lifecycle and header.
- After slice 1, the slices run in parallel lanes. Each one lists what it's **blocked by** and what it **blocks**. Start a slice only when everything it's blocked by has been merged.
- **The entry page header is shared.** Slice 1 lays it out with four regions: **title**, **time**, **editors** and **actions**. Slices 2, 3, 4, 6 and 8 each fill only their own region, which keeps merge conflicts small.
- **The only migration is `0007`, in slice 6.** If any other slice turns out to need one, take the next number and say so in the hand-off.
- Every slice ends with `pnpm check` passing, a browser check for its behaviour (or an extended existing one), and a hand-off note (see AGENTS.md, _PRDs and parallel loops_).
- Run `pnpm datastore:reset` after any slice that changes seeds.

```
1 ──┬── 2 ── 3
    ├── 4
    ├── 5 ──┐
    ├── 6 ──┴── 7
    ├── 8
    └── 9
                 all ── 10
```

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes** (shared, client-only, no server loader or action):
  - `/app/groups/:groupId/entries/new?kind=note|event`: a blank editor with a client-generated entry id. Nothing is written until the first change.
  - `/app/groups/:groupId/entries/:entryId`: the entry page for notes and events. It replaces `/entries/:entryId/notes`, which is removed, with no redirect.
  - After the first save, `new` is **replaced** (not pushed) with `/entries/:entryId`.
  - A non-member, a missing entry, or a symptom or vital id → 404. Signed-out visitors get the existing `/sign-in?redirectTo=…`.
- **Content model:**
  - For `note` and `event`, the live document is the text, and `timeline_entry.body` is always null (the content rules reject a body).
  - Notes have an optional title. Events need a title; the device saves `"Event"` when none is given.
  - Symptoms and vitals are unchanged.
- **Every note and event has a `note_document`** with the same id. The device writes both in one local transaction (materialize on first change, idempotent on the id). The data layer doesn't require the document to exist, because uploads may arrive in separate batches.
- **Schema change (one):** `note_document.editors` is jsonb `{ [userId]: lastEditAt }`, default `{}`, written by the system only. Compaction merges each consumed update's author and time into it. It's added to the `care_groups` stream query and the device schema.
- **Recent editors:**
  - One pure, client-safe function combines `editors` with pending `note_update` rows.
  - The window is 2 minutes. The viewer is excluded wherever the result is shown to them.
  - It's re-evaluated on a timer of about 15 s, so the signals expire.
- **No new dependencies.** Share uses the Web Share API with a clipboard fallback.
- **No data migration.** There's only seed data: seeds build compacted documents with a text → document helper, and we reseed.

---

## Phase 1: Tracer: a note is its document ✅ merged

**Blocked by:** none · **Blocks:** 2–10 · **User stories:** 1, 3–7, 12, 13, 18–20, 34–36, 40, 42

### What to build

The thinnest complete path for notes:

1. Tapping **Note** in the quick-add bar opens `/entries/new?kind=note`: a full-screen editor with the cursor in the document and the time set to now.
2. The first keystroke (or the first title change) creates the `timeline_entry` and `note_document` locally, in one transaction. Edits made before that are buffered and flushed after it.
3. The URL is replaced with `/entries/:entryId`.
4. Leaving without typing writes nothing.
5. Other members open the entry at `/entries/:entryId`, edit it together through Yjs, offline included, and viewers see it read-only.

**Changes:**

- **Content rules:** a note rejects a body, and its title stays optional. The sync upload accepts a note PUT with no body.
- **Timeline:**
  - A note's row and card show its document preview as the body.
  - `EntryForm` drops the note kind.
  - The old `/notes` route is removed.
- **Entry page header:** laid out with its four regions. In this slice it holds only the kind icon, a read-only time, and the editable optional title for notes.
- **Seeds:** every seeded note gets a compacted document built from its text, with a null `body`. A client-safe text → document helper (paragraphs, `• ` bullets) is added for this.
- **Tests:** a new `web:unit` Vitest project in the root config (no new dependency), for pure web logic.

### Acceptance criteria

- [x] From the timeline, a writer is typing in a new note after **one tap**.
- [x] Opening `new` and leaving without typing writes no `timeline_entry` or `note_document` row, locally or in Postgres.
- [x] After the first keystroke, the URL is `/entries/:entryId` and Back returns to the timeline.
- [x] Postgres has the entry with a null `body`, plus its document and updates, with correct authorship.
- [x] A note written fully offline uploads without rejection after reconnecting.
- [x] Two writers' edits converge, and a viewer sees them live, read-only.
- [x] The timeline row shows the document's text, including edits not yet synced. There's no separate "Live notes" block for notes.
- [x] The note option is gone from the entry sheet.
- [x] A symptom or vital id at `/entries/:id` → 404. A non-member → 404. Signed out → sign-in, then back to the entry.
- [x] Unit tests: the note content rules; the text → document helper round trips through plain text (bullets, empty text).
- [x] Integration test: an upload batch with a note PUT and its document PUT, and the same split across two batches, both succeed. A note PUT with a body is rejected.
- [x] Seed validation passes against the new rules, and `pnpm datastore:reset` seeds documents for all notes.
- [x] The `web:unit` project runs in `pnpm test` and covers the pure "when to materialize" decision.
- [x] A browser check covers the one-tap start, the abandoned draft, the URL replace, convergence, offline and the viewer.

---

## Phase 2: Events are documents ✅ merged

**Blocked by:** 1 · **Blocks:** 3 · **User stories:** 2, 9, 10, 11

### What to build

Events get the same flow as notes:

- Tapping **Event** opens `/entries/new?kind=event`, with the title field at the top. The user can type a title or go straight into the document.
- If the first change happens with no title, the event is saved as **"Event"**. The title region then shows a gentle "Add a title" prompt until it's renamed.
- An event's content rules reject a body and require a title.
- `EntryForm` drops the event kind; the sheet is now Symptom plus Vitals only.
- Seeded events get documents, as notes did.
- Event rows and cards show the document preview as their body.

### Acceptance criteria

- [x] From the timeline, a writer is typing in a new event after **one tap**.
- [x] Typing in the document before any title saves the event titled "Event", and the "Add a title" prompt shows.
- [x] Renaming the event syncs to other members.
- [x] An event PUT with a body or no title is rejected by the upload, which the integration test covers.
- [x] Unit tests: the event content rules, and the default-title decision (in `web:unit`).
- [x] The entry sheet offers only Symptom and Vitals.
- [x] Seeded events have documents after a reset. The timeline shows no plain bodies on notes or events.
- [x] The browser check covers the event start, the default title and a rename.

---

## Phase 3: Event title suggestions

**Blocked by:** 2 · **Blocks:** none · **User stories:** 8

### What to build

While an event's title is empty or still "Event", the title region shows up to 5 chips with the group's recent event titles. Tapping one sets the title (and saves the entry if this is its first change).

- The chips are ranked by how often and how recently each title was used, de-duplicated case-insensitively.
- Deleted entries and "Event" itself are left out.
- They're read from the local database, so they work offline.

### Acceptance criteria

- [ ] With the seed data, opening a new event shows chips such as "Physical therapy".
- [ ] One tap on a chip sets the title. Event start to named event takes 2 taps in total.
- [ ] The chips disappear once a custom title is typed.
- [ ] Unit tests (`web:unit`) cover the ranking, case-insensitive dedupe, excluding "Event", deleted entries, and the limit.
- [ ] The browser check covers a chip tap.

---

## Phase 4: Header: time chip and delete ✅ merged

**Blocked by:** 1 · **Blocks:** none · **User stories:** 14–17

### What to build

- **Time region:** a tappable chip ("Today 2:15 PM") that opens the date and time field in a popover. Changes save locally, last write wins, and sync to others. It works on `new` too: a time set before the first change is used when the entry is saved.
- **Actions region:** ⋯ → **Delete**, with the existing confirm dialog. It soft-deletes the entry and returns to the timeline. Anyone else with the page open sees the existing "This entry was deleted" state.
- Title edits (from slice 1) save on blur or Enter, with no Save button.

### Acceptance criteria

- [x] Changing the time from the chip moves the entry to the right place on the timeline, for every member.
- [x] A time set on `new` before typing is the saved `occurredAt`.
- [x] Delete from the header asks for confirmation, soft-deletes the entry, and returns to the timeline. A second browser on the entry sees the deleted state.
- [x] Viewers see neither the time chip as editable nor the ⋯ menu.
- [x] The browser check covers the time change, delete and the viewer.

---

## Phase 5: Tap the row to open, and menu cleanup ✅ merged

**Blocked by:** 1 · **Blocks:** 7 · **User stories:** 21, 32, 33, 37–39

### What to build

- **Tapping a row or card:** anywhere on a note or event (rows and cards) opens `/entries/:entryId`, for viewers too. On a symptom or vital, the tap opens its edit sheet for writers and does nothing for viewers.
- **The ⋯ menu:** keeps Delete, plus Edit for symptoms and vitals. "Add live notes" and "Open live notes" are removed, and so is the separate live notes preview component.
- **Taps that don't open the entry:** the ⋯ button and the More/Less text toggle.
- **Keyboard:** the row's open action is reachable and has an accessible name.

### Acceptance criteria

- [x] Tapping anywhere on a note or event row or card opens it, in both views, for a writer and for a viewer.
- [x] Tapping a symptom or vital row opens its edit sheet for a writer, and does nothing for a viewer.
- [x] The ⋯ menu and the More/Less toggle don't open the entry.
- [x] No "Add live notes" or "Open live notes" remains anywhere.
- [x] Keyboard users can open an entry, and jsx-a11y lint passes.
- [x] `phase2.mjs` is updated and passes. The browser check covers row taps in both views and for both roles.

---

## Phase 6: Recent editors and editor avatars ✅ merged

**Blocked by:** 1 · **Blocks:** 7 · **User stories:** 25–27

### What to build

The "who's typing" signal, end to end, shown first in the entry page's **editors** region:

- **Migration `0007`:** adds `note_document.editors` (jsonb, default `{}`, system-only writes).
- **Compaction:** merges each consumed update's author and time into `editors`, keeping the latest time per user.
- **Sync:** the column is added to the `care_groups` stream query and the device schema (restart PowerSync).
- **Signal:** a pure recent-editors function combines `editors` with pending updates. It applies the 2-minute window, excludes the viewer, and sorts the most recent first.
- **Avatars:** the header shows initials avatars for the other recent editors. They update live and expire on a ~15 s timer.

### Acceptance criteria

- [x] When member A types, member B sees A's avatar in the header within ~2 s.
- [x] The avatar disappears about 2 minutes after A stops typing, even after compaction has deleted A's updates.
- [x] Nobody sees their own avatar.
- [x] Unit tests: the window edge, merging `editors` with pending updates (latest wins), excluding the viewer, ordering, and empty inputs.
- [x] Integration tests: compaction writes `editors` from the update authors, keeps the latest time per user, and `editors` can't be forged through create or upload.
- [x] The stream syncs `editors` to devices, which is verified locally.
- [x] The browser check covers the avatar appearing, and then expiring (with a shortened window or a mocked clock).

---

## Phase 7: Live dot and the Live now banner

**Blocked by:** 5, 6 · **Blocks:** none · **User stories:** 22–24

### What to build

- **Live now banner:** above the quick-add bar, for the most recently active document that has other recent editors: "Maria is writing · PT visit · **Join**". With more than one, it adds "+N more". Join opens the entry.
- **Live dot:** a small pulsing marker on every row and card whose document has other recent editors. It has an sr-only label ("Being written now by Maria") and doesn't pulse under `prefers-reduced-motion`.
- **Expiry:** both use slice 6's signal and expire on the same timer.
- **Announcements:** the banner is a polite live region, announced once per document.

### Acceptance criteria

- [ ] When member A starts a note, member B's timeline shows the banner and the dot within ~2 s. Join opens the note in one tap.
- [ ] Both disappear about 2 minutes after A stops typing.
- [ ] A never sees a banner or dot for their own typing.
- [ ] With two active documents, the banner shows the most recent, with "+1 more".
- [ ] Reduced motion: the dot is static. Screen readers get the sr-only label, and a single banner announcement.
- [ ] The browser check covers the banner, Join, the dot and expiry.

---

## Phase 8: Share link ✅ merged

**Blocked by:** 1 · **Blocks:** none · **User stories:** 28–31

### What to build

A **Share** button in the header's actions region shares the entry's web URL with its title:

- through the device's share sheet where the Web Share API exists;
- otherwise it copies the link and shows "Link copied".

The link takes a signed-out member through sign-in to the entry, and shows a non-member "Not found" with nothing about the entry.

### Acceptance criteria

- [x] Share calls the share sheet when it's available, and copies the link with a confirmation otherwise.
- [x] A signed-out member opening the link lands on the entry after signing in.
- [x] A signed-in non-member gets a 404 that reveals no title or text.
- [x] Share is available to viewers too, since sharing a link grants no access.
- [x] The browser check covers the clipboard fallback, the signed-out redirect and the non-member 404.

---

## Phase 9: API read path ✅ merged

**Blocked by:** 1 · **Blocks:** none · **User stories:** 41, 43

### What to build

Server reads of timeline entries (`timeline.list` and the other entry reads in the API and services) return a note's or event's `body` filled from its document's compacted text. Other callers (AI, workers, OpenAPI) keep one text field, and the output type doesn't change.

Deleting an entry hides its document from service reads, as it does today. The cascade still removes it on hard delete.

### Acceptance criteria

- [x] `timeline.list` returns the document text as `body` for notes and events, and the stored `body` for symptoms and vitals.
- [x] A note without a document yet (its upload is still pending) returns a null `body`, without an error.
- [x] A soft-deleted entry's document text isn't returned by any read.
- [x] Integration tests in the router suite cover these cases.

---

## Phase 10: Browser check overhaul and documentation

**Blocked by:** 1–9 · **Blocks:** none · **User stories:** all (end-to-end regression)

### What to build

- **One consolidated browser check:** it replaces `live-notes.mjs`, keeps its convergence, offline and authorship checks, and adds the slices' new checks.
  - It counts taps: Note 1, Event 1, a named event 2, Join 1.
  - It asserts there are no console errors.
- **`phase2.mjs`:** brought in line with the new flows.
- **AGENTS.md:**
  - Fold the PRD's lasting decisions into _Timeline entries_ and _Live notes_ (the entry kinds now say a note's text is its document).
  - Update the layout and routes.
  - Mark the PRD done under _Active PRDs_.

### Acceptance criteria

- [ ] The consolidated check and `phase2.mjs` pass against a freshly reset database.
- [ ] `pnpm check` passes.
- [ ] AGENTS.md no longer describes "Add live notes", `/notes` routes, or plain bodies on notes and events.
- [ ] The PRD is marked done. Any remaining follow-ups are listed under _Next steps_.
