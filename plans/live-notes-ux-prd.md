# PRD: Notes and events are live documents

Status: draft, 2026-11-17. To be filed as a GitHub issue once `gh` can reach `caretook/caretook.com`.

## Problem Statement

Starting shared notes for something happening right now, like a doctor's visit, takes too long. A caretaker taps **Event**, types a title, taps **Add to timeline**, finds the new row, opens its **⋯** menu, taps **Add live notes** and waits for a new page. That's at least five taps plus typing before they can write a word, and by then the doctor is talking.

Other group members have it no better. They can't tell that someone has started notes. Once they know, they have to find the entry and hit a small "Open live notes" link under it, and that link appears only after the document exists and has synced.

Notes and events also have two separate texts: the plain body in the entry form, and the live document added from the menu. People don't know which one to write in, and the timeline shows both.

## Solution

For notes and events, the live document **is** the entry's text. There's no separate body and no "Add live notes" step.

- **Starting:** tapping **Note** or **Event** in the quick-add bar opens the full-screen editor at once, with the cursor in the document and the time set to now. The entry is saved on the first keystroke, so backing out before typing leaves nothing behind. An event's title field sits at the top with one-tap chips for the group's recent event titles. If nobody picks one, the event is saved as "Event" and can be renamed later.
- **Editing:** the editor page is the only place a note or event is edited. Its header holds the title, a time chip that opens the date and time field, avatars of whoever is typing now, a Share button and a ⋯ menu with Delete.
- **Joining:** other members get there in one tap.
  - Tapping anywhere on a note or event in the timeline opens it, for viewers too.
  - A **Live now** banner at the top of the timeline ("Maria is writing · PT visit · Join") appears while another member is typing.
  - A pulsing **live dot** marks those rows.
  - **Share** sends a deep link through the phone's share sheet, or copies it.
- **Symptoms and vitals** keep their sheet form. Tapping one of their rows opens its edit sheet for writers.

## User Stories

### Starting a note or event

1. As a caretaker, I want to tap Note once and be typing straight away, so that I don't miss what's being said.
2. As a caretaker, I want to tap Event once and be typing straight away, so that I can take visit notes the moment an appointment starts.
3. As a caretaker, I want the time to default to now, so that I never have to set it for something happening right now.
4. As a caretaker, I want the cursor already in the document when the editor opens, so that I don't need another tap before typing.
5. As a caretaker, I want a note I opened and abandoned without typing to leave nothing on the timeline, so that misfires don't clutter it.
6. As a caretaker, I want the entry saved as soon as I type the first character, so that nothing is lost if my phone dies or I lose signal.
7. As a caretaker, I want starting a note to work fully offline, so that I can take notes in a hospital basement with no signal.
8. As a caretaker, I want one-tap chips with our recent event titles ("Physical therapy", "Dr. Patel"), so that I can name an event without typing.
9. As a caretaker, I want to type a custom event title when no chip fits, so that unusual events are named correctly.
10. As a caretaker, I want an event I never named to be saved as "Event", so that my notes are never blocked or lost.
11. As a caretaker, I want a gentle "Add a title" prompt on an unnamed event, so that I remember to name it later.
12. As a caretaker, I want a note's title to stay optional, so that quick notes need no title.

### Editing

13. As a caretaker, I want to edit a note's or event's text in the same editor I started it in, so that there's one place and one way to change it.
14. As a caretaker, I want to rename an entry from the editor header, so that I can fix a title without opening a separate form.
15. As a caretaker, I want to tap the time chip to change when something happened, so that I can log things after the fact.
16. As a caretaker, I want title and time changes to save as I make them, so that there's no Save button to forget.
17. As a caretaker, I want to delete an entry from the editor's ⋯ menu, with a confirmation, so that I can remove a mistake without going back to the timeline.
18. As a caretaker, I want basic formatting (bold, italic, headings, lists), so that long visit notes stay readable.
19. As a caretaker, I want my edits and a co-caretaker's edits to merge rather than overwrite, so that we can write together during a visit.
20. As a caretaker, I want undo to undo only my own changes, so that I don't erase someone else's typing.

### Joining and following along

21. As a group member, I want to tap anywhere on a note or event in the timeline to open it, so that I don't have to hunt for a small link.
22. As a group member, I want a banner saying who is writing and in which entry, so that I know notes are being taken right now.
23. As a group member, I want a Join button on that banner, so that I'm in the document in one tap.
24. As a group member, I want rows being edited right now to show a live dot, so that I can spot them while scrolling.
25. As a group member, I want to see who is typing in the editor header, so that I know who I'm writing with.
26. As a group member, I want the banner to disappear a couple of minutes after the typing stops, so that it never shows activity that's long over.
27. As a group member, I want my own typing left out of the banner and the dot, so that the signal only tells me about other people.
28. As a caretaker, I want to share a link to the entry through my phone's share sheet, so that I can text a family member "follow along here".
29. As a caretaker on a device without a share sheet, I want Share to copy the link, so that I can paste it anywhere.
30. As a family member who gets a shared link while signed out, I want to sign in and land on that entry, so that the link still works.
31. As someone outside the group who gets a shared link, I want to see "Not found" and nothing about the entry, so that the care recipient's information stays private.
32. As a viewer, I want to open and read notes and events live, so that I can follow a visit I can't attend.
33. As a viewer, I want the editor clearly read-only, so that I don't try to type and wonder why nothing happens.

### The timeline

34. As a group member, I want a note's or event's row to show the first lines of its document as its body, so that I can scan the timeline without opening entries.
35. As a group member, I want that preview to include edits that haven't synced yet, so that my own typing shows up straight away.
36. As a group member, I want no separate "Live notes" block or "Open live notes" link, so that each entry shows one text.
37. As a caretaker, I want tapping a symptom or vital row to open its edit sheet, so that every row behaves the same way.
38. As a viewer, I want tapping a symptom or vital row to do nothing, so that I'm not shown a form I can't use.
39. As a caretaker, I want the ⋯ menu on rows to keep Delete, so that I can remove entries from the timeline.

### Integrity and other callers

40. As a caretaker, I want a note or event created offline on two devices to sync without errors, so that working offline is safe.
41. As a developer of the AI and worker features, I want API reads of notes and events to include their document's text as `body`, so that those consumers keep a single text field.
42. As a developer, I want seed data to include documents for every seeded note and event, so that the dev timeline looks like production.
43. As a group admin, I want deleting an entry to remove its document, so that deleted notes don't linger.

## Implementation Decisions

### Content model

- For `note` and `event` entries, the live document is the text. The entry's `body` column is always null for these kinds. Symptoms and vitals keep their optional plain `body` (comments).
- **Entry content rules (data schema):**
  - The note content schema no longer requires a body, and rejects one.
  - Event: the title stays required, and the body is rejected.
  - The edit flows for notes and events change only `title` and `occurredAt`.
  - Creating an entry without a document is still allowed (on a device, both are written in one local transaction). The data layer doesn't require the document to exist, because uploads can arrive in separate batches.
- **Every note and event has a document.** The device creates both together. The "Add live notes" and "Start live notes" flows are removed, and so is `ensureNoteDocument` as a separate user action (its idempotent create stays as an internal step).
- **No migration of existing data:** there is only seed data. Reseed (`pnpm datastore:reset`).

### Who's typing (recent editors)

- **Schema:** a new `editors` jsonb column on `note_document`, `{ [userId]: lastEditAt }`, default `{}`, written by the **system** only (field-level permission).
  - Added to the `care_groups` stream's `note_document` query: the stream lists its columns explicitly.
  - Added to the device's sqlite schema.
  - Needs a migration and a PowerSync restart.
- **Compaction:** while folding updates into the snapshot, the service merges each update's `createdBy` and `createdAt` into `editors`, keeping the latest time per user.
- **Pure module** `recentEditors({ editors, pending, now, windowMs, excludeUserId? })`:
  - Combines the document's `editors` with its pending `note_update` rows (`createdBy`, `createdAt`).
  - Returns `[{ userId, lastEditAt }]`, most recent first, for edits within `windowMs` (default 2 minutes).
  - It's client-safe and shared by the banner, the live dot and the editor avatars.
- The timestamps come from device clocks. A small skew is acceptable.
- The device re-evaluates "now" on a timer (about every 15 s), so the banner and dots expire without new rows arriving.

### Live entry lifecycle (device)

- **Routes:**
  - `/app/groups/:groupId/entries/new?kind=note|event` opens a blank editor with a client-generated entry id.
  - `/app/groups/:groupId/entries/:entryId` is the entry page. It replaces `/entries/:entryId/notes`, which is removed because there's no data to keep it for.
  - Both are shared and client-only, with no server loader or action.
- **Materialize on first change:** a new module, `materializeLiveEntry(db, { id, groupId, kind, title, occurredAt, timeZone })`, writes the `timeline_entry` row and its `note_document` row in one local transaction.
  - It's idempotent on the id.
  - It validates with the same Zod schemas and checks the role locally, like the existing local writes.
  - It runs on the first document change, or the first title change, whichever comes first.
  - For an event without a title, it saves `title: "Event"`.
- **Edits before materializing:** the editor's Y.Doc buffers changes in memory and flushes them as `note_update` rows once the entry exists. This extends `bindNoteDoc`, which already batches bursts of typing.
- After materializing, the URL is replaced (not pushed) with `/entries/:id`, so Back returns to the timeline and Share links are stable.
- Leaving `new` without any change writes nothing.
- **Upload order:** PowerSync uploads the CRUD queue in order, so the entry's PUT always arrives before its document's.

### Entry page

- **Header:**
  - The kind icon.
  - An editable title, saved on blur or Enter through the existing local `updateEntry`. Last write wins.
  - A time chip that opens the existing `DateTimeField` in a popover and saves on change.
  - Recent editors' avatars (initials).
  - Share.
  - ⋯ → Delete, through the existing `ConfirmDialog`, then back to the timeline.
- **Title suggestions (events):**
  - A local query reads the group's event titles, excluding deleted entries and the default "Event".
  - A pure `suggestTitles(rows, limit)` ranks them by count weighted by recency, and returns at most 5 distinct titles (case-insensitive).
  - The chips show while the title is empty or still "Event".
- **Editor:** the existing `LiveNotesEditor` (Tiptap and Yjs), autofocused for writers on a new entry, and read-only for viewers.
- **Share:** `navigator.share({ title, url })` when available, otherwise copy the link to the clipboard and confirm with a short "Link copied" message. The URL is the web origin's entry URL. In native, `VITE_API_ORIGIN` decides the origin; the Capacitor share plugin comes later.
- **States:**
  - A non-member, a missing entry, or a symptom or vital id → 404.
  - The entry deleted while the page is open → the existing "This entry was deleted" message.
  - A signed-out visit → the existing sign-in redirect with `redirectTo`.

### Timeline

- The quick-add tiles **Note** and **Event** navigate to `entries/new?kind=…`. Symptom and Vitals still open the sheet.
- `EntryForm` loses the note and event kinds (its kind picker becomes Symptom plus Vitals) and the "Edit note" and "Edit event" paths.
- **Rows and cards:**
  - The whole row or card is the tap target: an entry page for notes and events, the edit sheet for symptoms and vitals (writers only).
  - The ⋯ menu keeps only Delete (it goes into an Edit/Delete menu for symptoms and vitals).
  - The ⋯ button and the More/Less text toggle don't trigger the row's tap.
- **Body preview:** a note's or event's row body is its document preview (`previewText`), clamped as today. `LiveNotesPreview` and the "Add/Open live notes" menu items are removed.
- **Live dot:** a small pulsing marker on a row with recent editors other than the viewer. It has an sr-only label ("Being written now by Maria") and respects `prefers-reduced-motion`.
- **Live now banner:**
  - Sits above the quick-add bar.
  - Shows the most recently active document with other recent editors: "Maria is writing · PT visit · Join". With several, "+1 more".
  - Join navigates to the entry.
  - The live regions are polite, and announced once per document.

### API read path

- When `timeline.list` and other entry reads return a note or event, its `body` is filled from `note_document.text`. The current-text function, which includes pending updates, isn't needed for lists.
- The output type stays the same. The upload endpoint still rejects a non-null `body` on notes and events through the content rules.

### Seeds

- Every seeded note and event gets a `note_document`: a compacted snapshot built with a new client-safe `noteDocFromText(text)` (one paragraph per line, `• ` lines become a bullet list), its `text`, and `editors` set to the author at `occurredAt`.
- The seed entries keep their `body` strings as the source text. The insert moves them into the document and stores a null `body`.
- The seed validation test checks the new content rules.

## Testing Decisions

- Good tests check behavior through a module's public interface (inputs → outputs, or the rows that land in Postgres). They never check internals such as how Yjs encodes updates or which timer fired. They build their own fixtures, not seed data.
- **Unit (`data:unit`):**
  - Entry content rules: a note without a body passes, and one with a body fails. An event requires a title and rejects a body.
  - `noteDocFromText`: round trips through `noteText`, bullets work, and empty text gives an empty document.
  - `recentEditors`: the window edge, merging `editors` with pending updates (the latest wins), excluding the viewer, ordering, and empty inputs.
  - Prior art: `vitals.test.ts`, `noteYjs.test.ts`.
- **Integration:**
  - Compaction writes `editors` from the updates' authors and keeps the latest time per user. `editors` can't be forged on create.
  - `sync.upload` accepts a note entry PUT with no body followed by its document PUT, in one batch and across two.
  - It rejects a note or event PUT with a body.
  - `timeline.list` returns the document text as `body`.
  - Prior art: `noteDocument.int.test.ts`, `router.int.test.ts`.
- **New `web:unit` Vitest project** for pure apps/web logic, declared in the root `vitest.config.ts` (no new dependency).
  - `suggestTitles`: ranking, case-insensitive dedupe, excludes "Event", the limit.
  - The pure decision parts of the live entry lifecycle (when to materialize, the default title).
  - No PowerSync in these tests.
- **Browser check** (`scripts/browser-checks/`): replaces `live-notes.mjs` and keeps its convergence, offline and authorship checks. New checks:
  - Taps from the timeline to typing: 1 for Note, and 1 for Event plus 1 for a chip.
  - An abandoned `new` writes no row.
  - Typing materializes the entry and replaces the URL.
  - A second member sees the banner and dot within about 2 s, and Join opens the entry.
  - Tapping the row opens it, for the viewer too, read-only.
  - The banner expires after the window.
  - Share copies the link in headless Chrome, where the clipboard fallback applies.
  - The time chip and title edits sync.
  - Delete from the header.
  - A symptom row tap opens the sheet.
  - No console errors.
  - Rerun `phase2.mjs` (and update its edit and add steps for notes and events).

## Out of Scope

- Full presence: cursors, "who's viewing", a websocket relay such as Hocuspocus.
- Push or email notifications when someone starts notes (they come with the Notifications iteration).
- Appointments as a richer kind (place, provider, schedule).
- The Capacitor share plugin and native deep-link handling.
- AI summaries of notes, or prepared questions.
- A compaction cron sweep, snapshot size caps, and search over document text.
- Changing symptom or vital entry beyond tapping a row to open its sheet.
- Converting entries between kinds.

## Further Notes

- **Default titles:** "Event" is excluded from the title suggestions, so it never suggests itself.
- **Latency:** the banner's timing is set by PowerSync's propagation (about 0.5–0.8 s locally) plus how often devices flush typing (250 ms idle, 1 s max). Compaction runs every ~20 updates or 60 s, so `editors` carries the signal past compaction.
- **Conflicts:** title and time edits are last-write-wins per row, which is acceptable here. The document merges through Yjs.
- AGENTS.md (the _Collaborative notes_ and _Entry kinds_ sections) needs updating as slices land. In particular: "the note itself stays plain text" is no longer true.
