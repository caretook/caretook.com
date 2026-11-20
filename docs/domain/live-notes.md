# Live notes (collaborative documents)

The live notes area's rules and decisions, moved out of AGENTS.md (whose core rules still apply). An orchestrator folds a landing's lasting decisions for this area in here.

PRD: [`plans/live-notes-ux-prd.md`](../../plans/live-notes-ux-prd.md).

- **What they are:** the text of every **note and event** (`NOTE_DOCUMENT_KINDS`), a Yjs document. **Its id is the entry's id**, so two devices adding one offline make the same row and merge.
- **Tables:**
  - `note_document`: `snapshot` (compacted Yjs, base64), derived `text`, and `editors` jsonb `{ [userId]: lastEditAt }` (default `{}`, system-only writes; a forged one in an upload is ignored).
  - **Its owner** is `subject` (`entry | provider | medication | carePeriod`, default `entry`) with `entry_id` or `provider_id`: exactly one set, equal to `id`, each a cascading composite FK (a check enforces it). A provider's notes are its document. `useLiveDocuments` and the Live now banner join through `timeline_entry`, so provider documents never show there.
  - `note_update`: append-only, base64 `data`, at most 1,000,000 chars.
  - Composite FKs cascade from the entry. `timeline_entry` has a unique `(group_id, id)` for this.
- **Helpers** (`db/schema/noteYjs.ts`, client-safe): base64, `isYjsUpdate`, `buildNoteDoc`, `encodeNoteDoc`, `noteText` and its inverse `noteDocFromText` (one paragraph per line, `• ` lines as a bullet list). The fragment is `NOTE_FRAGMENT = "default"`.
- **`noteDocumentService`** (write through it):
  - `create` is idempotent and requires a live note or event.
  - `appendUpdate` is idempotent on the update id.
  - `currentText` includes pending updates (for AI and workers).
  - `compact` (system, row locked `FOR UPDATE`) folds pending updates into the snapshot and text, merges their authors into `editors` (`mergeEditors`, latest time per user), and deletes them.
- **Recent editors** (`db/schema/noteEditors.ts`, client-safe): `recentEditors({ editors, pending, now, excludeUserId })` combines `editors` with pending `note_update` rows. The window is 2 min (`RECENT_EDITORS_WINDOW_MS`, edge inclusive, up to one window of future skew allowed), re-evaluated every 15 s (`useNow`). On the device, `lib/sync/editors.ts` has `documentEditorsQuery`, `groupLiveEditorsQuery` and `useLiveDocuments` (the group's live, not deleted, notes and events, for the live dot and banner), `toRecentEditors` and `useRecentEditors`. `EditorAvatars` shows up to 3 initials then "+N", never the viewer. An update's `created_at` is the server's, so offline edits count as "now" for 2 min after they upload.
  - `compactIfDue`: at 20 pending updates, or after 60 s.
- **Device** (`lib/sync/notes.ts`):
  - `createNoteDoc` and `bindNoteDoc` are split so StrictMode's double effects can't destroy a live doc.
  - Typing bursts flush as one `note_update` 250 ms after the last keystroke, and at least every 1 s.
  - A viewer's changes are never written.
  - Previews rebuild text locally, so they include unsynced edits.
- **Entry page** (`routes/app/groups/entry/route.tsx`, `/entries/:id`; `/entries/new?kind=note|event` is a draft, the same route so the editor stays mounted):
  - Nothing is written until the first real change (`shouldMaterialize` in `lib/liveEntry.ts`: text in the document, or a title). Then `materializeLiveEntry` (`lib/sync/liveEntry.ts`) writes the entry and its document in one local transaction (idempotent on the id; for an older event it adds only the document), and the URL is **replaced** with `/entries/:id`.
  - `bindNoteDoc`'s `ensureSaved` holds a draft's Yjs changes in memory until then; leaving drops them.
  - `EntryHeader` has four regions:
    - **title:** `EntryTitle`, editable by writers for both kinds. `commitTitle` saves a new draft, or renames an existing entry. While an event is unnamed (`isUnnamedEvent`) and nothing is typed, writers see `EventTitleChips`: up to 5 of the group's recent event titles (`suggestTitles` in `lib/titleSuggestions.ts`: 14-day half-life, case-insensitive dedupe, no "Event" or deleted entries; read locally by `lib/sync/titleSuggestions.ts`, so they work offline). A tap goes through `commitTitle`, so a named event takes 2 taps.
    - **time:** `EntryTimeChip` for writers (a popover with `DateTimeField`; saved on close, only if changed; a time picked on a draft is the saved time, via `occurredAtRef`). Viewers get a plain `EntryTime`.
    - **editors:** `EditorAvatars`.
    - **actions:** once the entry exists, `ShareButton` for everyone, plus `EntryActions` (⋯ → Delete, with a `ConfirmDialog`, then back to the timeline) for writers.
  - **Share** (`share.ts` beside the entry route): the Web Share API when `canShare` allows it, else the clipboard with a "Link copied" status; a dismissed sheet shows nothing, and a failed copy shows the link to copy by hand. The origin is `VITE_API_ORIGIN || location.origin`.
  - Symptom or vital ids, and non-members, get a 404 that shows no title or text.
  - **The route only composes** (about 120 lines): `loadEntry.ts` (the loader's reads and 404 rules), the `useLiveEntry` hook (`entry`, `stored`, `isNew`, `canWrite`, `deleted`, `ensureSaved`, `commitTitle`, `changeTime`, `remove`, `saveError`; no JSX), `EntryPageHeader` (fills `EntryHeader`'s regions and owns the delete dialog) and `EntryTitleRegion` (the title and chips; it owns the typed text). Pure, tested: `entryPage.ts` (`entryHeading`, `titleState`, `showTitleChips`). **`LiveNotesEditor` takes an optional `ref`** (`LiveNotesEditorHandle { focus() }`); a picked title chip focuses the editor through it, never by querying the DOM.
- **Visit prep** (B-58): `prependNoteSection(doc, lines)` (`schema/noteYjs.ts`; typed lines: heading, subheading, bullet) inserts at the start of a document in one transaction, never touching existing content; it syncs as an ordinary `note_update` (`insertNoteSection` in `lib/sync/visitPrep.ts`, writers only, creating the document in the same transaction if there is none). A rerun prepends a newer dated section ("(updated …)"). What goes in it: [appointments](appointments.md).
- **Print** (everyone, notes and events): the entry page's `EntryPrintView` (title, time, place, With providers, text) shows only in print; the rest of the page is `print:hidden`. Rows elsewhere link to `appUrls.printEntry` (`?print=1`), which prints once and drops the parameter (`useEntryPrint.ts`).
- **Editor:** `LiveNotesEditor` is Tiptap StarterKit (`undoRedo: false`, because Collaboration brings Yjs undo; `link: false`). Its chunk is about 140 KB gzipped and loads only on its route.
- **Vite:** `optimizeDeps.include` pre-bundles yjs and Tiptap, and `resolve.dedupe` keeps one yjs, React and ProseMirror. Without both, "Yjs was already imported" and broken hooks after re-optimization.
- **Latency:** a co-editor sees typing in about 0.5–0.8 s locally. Offline edits land about 2.5–3 s after reconnecting.
- ❓ Presence and cursors (a websocket relay such as Hocuspocus): decide after real use. 🟡 Not built: a compaction cron sweep, a snapshot size cap, an oRPC read for documents, search over `text`.
- **Tests:** the entry page is component tests (`entry/entry.browser.test.tsx`), and so are the Live now banner and live dot (`timeline/timelineStrips.browser.test.tsx`, with expiry). `live-notes.mjs` keeps what needs devices: uploads, Live now from another device and Join, who's typing across devices with convergence and compaction, offline then reconnect, a time change and delete reaching others, and a link opened signed out.
