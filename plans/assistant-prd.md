# PRD: Assistant (quick entry, simple mode, day summaries, visit prep)

Topic `assistant`, backlog B-12, B-49, B-58, B-87. Interviewed 2026-11-19. Replaces the earlier draft (`dd0d7a9`: a remote-AI chat sheet with server-side voice), which stays in git history.

**No remote AI in this PRD.** Everything here is plain code on the device: it works offline, costs nothing per use, and sends no care data anywhere new. Voice is the keyboard's own dictation. A user's own Claude or ChatGPT comes later through `connectors` (B-104), which reuses this PRD's action shapes. On-device models (Capacitor) and paid remote calls are later decisions.

Depends on `medications-2` (passes, `duePasses`, Given all with its shared Undo; in progress) for the dose and pass actions, so those slices go last. Uses `care-periods` (ready to land) for hospital stays in visit prep, softly. B-98 (the timeline's + menu) and B-99 (no Latest vitals on phones) land first through `quick-fixes`, and make room for the quick-entry box in the timeline header.

## Problem Statement

Logging care is done by someone with their hands full. After taking a blood pressure at the bedside, a caretaker has to pick a kind, find the fields, type numbers on a phone keyboard and save, once per thing. A reading, a dose and a symptom is three trips through three forms, so things get logged later from memory, or not at all.

Some of the people doing the care will never learn the full app: an elderly spouse, a part-time aide, a relative visiting for a week. The timeline today shows filters, chips, strips, menus and five add buttons. They need one obvious place to say what happened, the few things due now, and the latest entries in large type, and they must not be able to wander into a screen that confuses them.

Reading is slow too. To see how yesterday went you read every row. Before an appointment the caretaker scrolls back weeks to remember what changed since the last visit (new symptoms, medication changes, how her blood pressure has been, the fall in October) and writes it down by hand.

## Solution

- **Quick entry.** One text box, on the timeline and at the centre of simple mode. Type (or dictate with the keyboard's mic) a line like `bp 130/85 hr 72, gave metformin, pain 4 left knee`. Caretook shows a **preview card per part** ("Vital · BP 130/85, pulse 72 · now", "Dose · Metformin 500 mg given", "Symptom · Pain 4 · left knee"), each with its best guess and the alternatives as chips ("Save as note instead"). Save writes them all, offline, through the same local writes as the forms; Edit opens the usual sheet already filled in. Nothing is saved until Save. An Undo line stays for 10 s.
- **One-tap suggestions** under the box: a due pass ("Give evening meds (4)"), lines the group usually logs around this hour, and your own recent lines.
- **Simple mode.** A large-type, one-column timeline: the recipient and today, the quick-entry box, a **Now** block (due passes with Given all, the next appointment), four big **tiles** that open single-purpose forms, then the normal rows, bigger, with no menus. Filters, search, the strips, the sections nav and management screens are hidden. Owners and admins can set it as a member's default, and **lock** a member into it; members choose for themselves otherwise, and switch with a toggle on the timeline.
- **Day summaries.** Under each day header, one line built from the day's data: "BP 128–141/80–88 ↑ · Pain 6 (new) · Fell in bathroom · 3 notes · Ann, Sam". It expands to a few lines. Hidden while a filter or search is on.
- **Visit prep.** "Prepare for this visit" on an appointment (and from a provider's page and Upcoming rows) inserts a dated **"Since your last visit"** section at the top of the appointment's live notes: medication changes, vital trends, symptoms, events and hospital stays, missed doses. People then add questions and take notes below it during the visit. Running it again adds a newer dated section above, never touching what people typed. Every note and event can now be **printed** from its ⋯ menu.

## User Stories

### Quick entry

1. As a caretaker, I want one box where I type what happened, so that I don't have to pick a kind and a form first.
2. As a caretaker, I want to dictate into the box with my keyboard's microphone, so that I can log with my hands busy.
3. As a caretaker, I want `bp 130/85` to become a blood pressure reading, so that common vitals take seconds.
4. As a caretaker, I want a bare `130/85` to be read as blood pressure, so that I can skip the keyword.
5. As a caretaker, I want `bp 130/85 hr 72 temp 99.1` to become one vital entry with three readings, so that a check is one entry, as the form makes it.
6. As a caretaker, I want temperature, weight, glucose and volume read in my units, and an explicit unit (`37.2c`, `65 kg`) to win, so that I never convert by hand.
7. As a caretaker, I want the vitals' "That's unusual" warning and hard limits applied in the preview, so that a typo like `bp 1300/85` is caught before saving.
8. As a caretaker, I want `pulse`, `hr`, `heart rate`, `o2`, `spo2`, `sats`, `temp`, `wt`, `weight`, `sugar`, `bg`, `glucose`, `bm`, `bowel`, `urine`, `slept` and similar words understood, so that I can write the way I talk.
9. As a caretaker, I want `gave metformin`, `skipped lisinopril` and `refused acetaminophen` to log a dose with that status, so that doses take one line.
10. As a caretaker, I want a partial or misspelled medication name (`metf`, `tylenol` for a medication whose name or notes say Tylenol) matched against the group's medications, so that I don't need exact spelling.
11. As a caretaker, I want `gave 2 tablets acetaminophen` to record the amount, so that the dose is accurate.
12. As a caretaker, I want `gave evening meds` or `gave all` to log the due pass with Given all, so that a round is one line.
13. As a caretaker, I want `gave meds` at 8 pm to mean the evening pass when it's due, so that the obvious meaning wins.
14. As a caretaker, I want `pain 6 left knee` or `nausea 3/10` to become a symptom with a severity and a note, so that symptoms are structured.
15. As a caretaker, I want `dizzy` alone offered as a symptom, with note as an alternative, so that short complaints are captured either way.
16. As a caretaker, I want `appt dr lee tue 2pm` or `dialysis tomorrow 9:30 at Riverside` to become an upcoming event with the provider linked and the place set, so that I can add appointments in one line.
17. As a caretaker, I want anything else to become a note, with event as an alternative, so that nothing I type is lost.
18. As a caretaker, I want `at 8am`, `30 min ago`, `yesterday 9pm` and `last night` to set the time on any part, so that I can log after the fact.
19. As a caretaker, I want a future time refused for vitals, symptoms and doses, as the forms do, so that the data stays honest.
20. As a caretaker, I want one line split on commas and "and" into several previews, so that a whole check-in is one line.
21. As a caretaker, I want to see a preview card for every part before anything is saved, so that I can catch mistakes.
22. As a caretaker, I want the alternatives as chips on each card, so that I can correct a wrong guess with one tap.
23. As a caretaker, I want to remove one card without losing the others, so that one bad part doesn't spoil the line.
24. As a caretaker, I want Edit on a card to open the usual sheet filled in, so that I can fix details the box can't express.
25. As a caretaker, I want Save to save every card at once, offline too, so that the line is one action.
26. As a caretaker, I want an Undo line for 10 s after saving, so that a slip costs nothing.
27. As a power user, I want `n:`, `e:`, `s:`, `v:` and `d:` prefixes to force a kind, so that I'm never second-guessed.
28. As a caretaker, I want medication, pass and provider names suggested as I type, so that I pick instead of spell.
29. As a caretaker, I want a short tips line under the empty box with examples, so that I learn what it understands.
30. As a viewer, I want no quick-entry box, so that I'm not offered something I can't do.
31. As a screen-reader user, I want the previews announced politely and every chip and button named, so that quick entry works without sight.

### Suggestions

32. As a caretaker, I want a due pass offered as one tap ("Give evening meds (4)"), so that the round is fastest when it matters.
33. As a caretaker, I want lines the group usually logs around this hour offered as chips (e.g. `bp` at 8 am), so that routine checks are one tap plus numbers.
34. As a caretaker, I want my own last few lines offered on this device, so that I can repeat "gave morning meds" in one tap.
35. As a caretaker, I want a suggestion that needs numbers to fill the box and wait for them, not save, so that nothing is saved with made-up values.
36. As a caretaker, I want suggestions to work offline, so that they're there at the bedside with no signal.

### Simple mode

37. As an elderly spouse, I want a screen with large text and big buttons, so that I can log without my glasses or a lesson.
38. As a simple-mode user, I want the recipient's name and "Today" at the top, so that I know where I am.
39. As a simple-mode user, I want the quick-entry box big and first, with a hint to tap the keyboard's microphone, so that talking is the obvious way in.
40. As a simple-mode user, I want a Now block with the due pass ("Give evening meds") and the next appointment, so that I see what needs doing.
41. As a simple-mode user, I want Given all to work there with Undo, as on the medication strip, so that the round is one tap.
42. As a simple-mode user, I want four big tiles that each open one short form, so that I can log without typing.
43. As an owner, I want to choose the group's tiles (fixed, picked by me, or learned from use), so that they fit our recipient (e.g. Blood sugar for a diabetic).
44. As a member of a new group, I want the tiles learned from use by default, with a first-run hint that owners can set them, so that they're useful at once and adjustable.
45. As a simple-mode user, I want tile labels in plain words using the recipient's name or pronouns ("How she feels"), so that they read naturally.
46. As a simple-mode user, I want the timeline's normal rows, bigger, with no ⋯ menus, so that I can read what others logged without risk.
47. As a simple-mode user, I want to open a note or event and type in it, so that I can add to a shared note.
48. As a simple-mode user, I want "Remove my last entry" for what I added in the last 30 minutes, so that I can fix a mistake after Undo is gone.
49. As a simple-mode user, I want filters, search, strips, the sections nav, group menus and management screens hidden, so that there's nothing to get lost in.
50. As a member, I want a toggle on the timeline to switch between simple and full, so that I can use whichever suits the moment.
51. As a member, I want my own setting (follow the group, always simple, always full) in account settings, so that my choice sticks across devices.
52. As an owner or admin, I want to set simple mode as a member's default on the Members page, so that an aide or grandparent starts there without finding a setting.
53. As an owner or admin, I want to lock a member in simple mode, so that an elderly member doesn't get lost by pressing the wrong button.
54. As a locked member, I want only Sign out and my account settings besides simple mode, so that I can still change my units or sign out.
55. As a locked member with several groups, I want to choose a group from a plain list, so that I can still reach each one.
56. As a viewer in simple mode, I want bigger rows and the next appointment and due medications as text, with no box, tiles or Now actions, so that it fits what I may do.
57. As an owner, I want the default and lock to need a connection, like other member changes, so that they're checked by the server.
58. As a member, I want my simple-mode default and lock to reach my devices by sync, so that an owner's change applies without me doing anything.

### Day summaries

59. As a caretaker, I want one line under each day header summarising the day, so that I can see how it went without reading every row.
60. As a caretaker, I want each measured vital's range for the day with an arrow when it's above or below the last 7 days, or in the unusual band, so that changes stand out.
61. As a caretaker, I want the day's symptoms with their highest severity, marked "new" when they weren't logged in the previous 7 days, so that new problems stand out.
62. As a caretaker, I want the day's event titles, the number of notes and who logged, so that I know what happened and who was there.
63. As a caretaker, I want the line to expand to a few lines on tap, so that I can see more without leaving the timeline.
64. As a caretaker, I want today's summary to update as entries arrive, so that it's always current.
65. As a caretaker, I want summaries hidden while a filter or search is on, so that they never contradict the filtered list.
66. As a simple-mode user, I want the summaries too, in the larger type, so that I get the same overview.
67. As a screen-reader user, I want the summary read as text with the arrows named ("higher than last week"), so that trends aren't visual only.

### Visit prep

68. As a caretaker, I want "Prepare for this visit" on an upcoming appointment's page, so that I start from the visit itself.
69. As a caretaker, I want "Prepare for a visit" on a provider's page, opening their next appointment (or offering to create one), so that I can start from the doctor.
70. As a caretaker, I want a Prepare action on Upcoming's appointment rows, so that I can prepare from the list of what's coming.
71. As a caretaker, I want the window to start at the last past, not cancelled, event linked to that provider, or 30 days back if there is none, so that it covers "since we last saw them".
72. As a caretaker, I want to change the window's start before inserting, so that I can cover a longer stretch.
73. As a caretaker, I want medication changes since then (started, stopped, changed) and the current list in brief, so that the doctor sees what changed.
74. As a caretaker, I want each measured vital's range, average and direction compared with before, so that trends are ready to read out.
75. As a caretaker, I want new and recurring symptoms with how often and their highest severity, so that complaints are summarised.
76. As a caretaker, I want falls and other events, hospital or rehab stays (care periods) and the missed-dose count, so that nothing important is forgotten.
77. As a caretaker, I want sections with nothing in them left out, so that the note stays short.
78. As a caretaker, I want the section inserted at the top of the appointment's live notes, dated, so that we add questions and visit notes below it.
79. As a caretaker, I want running it again to add a newer dated section above, never changing what anyone typed, so that it's safe to repeat.
80. As a co-caretaker, I want to see the inserted section live and edit it like any text, so that we prepare together.
81. As a caretaker, I want it to work offline from local data, so that I can prepare in the waiting room.
82. As a viewer, I want to read the prepared note but not run Prepare, so that only writers change documents.
83. As anyone, I want Print in a note's or event's ⋯ menu (title, time, place, With providers, text) on the shared print styles, so that I can bring it on paper.

## Implementation Decisions

### Model and storage

- **One migration.** `care_group_member` gains `simple_mode` (boolean, default false: the owner's default for that member) and `simple_mode_locked` (boolean, default false; true implies simple). `care_group` gains `simple_tiles` jsonb: `{ mode: "learned" | "fixed" | "custom", tiles?: Tile[] }` (custom only, exactly four; a tile is a kind, or `vital` with a vital type, or `dose`); null means learned. All three are synced: add them to the `care_groups` stream queries and the device schema. Neither table is in the upload switch: both are written online through oRPC.
- **Permissions.** Owners and admins update `simple_mode` and `simple_mode_locked` on any membership except an owner's, which only owners change (the existing owner rule). A member can't change their own lock. `simple_tiles` follows `care_group`'s update rule (owners, admins). Field-level write restrictions in `PERMISSIONS`; the service enforces the owner rule.
- **The user's own setting** goes in `user.preferences` as `simpleMode: "group" | "simple" | "full"` (optional; default `group`), saved through `saveSettings`, so it works offline. No migration.
- **The device toggle** is per user and group in localStorage (like the last group). Changing your own setting clears your toggles.
- **Recent lines** are per user and group in localStorage, the last 8 distinct, recorded on Save only; forgotten at sign-out with the other per-user keys.
- **Entries made through quick entry** are ordinary entries authored by the person who saved them. No source marker in this PRD (`connectors` adds one for outside assistants).

### Pure modules (deep, tested)

- **Assistant actions** (client-safe, in `@caretook/data`'s schema exports, so `connectors` can carry them out on the server later): a discriminated union `logVital` (readings, time), `logSymptom` (name, severity?, note?, time), `logDose` (medication id, status, amount?, note?, time), `givePass` (pass id, time), `addNote` (title?, text, time), `addEvent` (title, start, end?, all-day?, place?, provider ids, time zone). Each has a Zod schema reusing the existing content schemas and limits, and `actionPreview(action, context)` gives the card's wording through the existing display helpers (`medicationDisplay`, vitals' `toDisplay`, `upcomingLabels`). Actions carry no ids of their own; the runner makes them.
- **The quick-entry parser** (client-safe, beside the actions): `parseQuickEntry(text, context) → { parts: [{ text, readings: [{ actions, label, confidence, warnings }] }] }`. Context: the user's units, the group's medications, passes, providers and due passes, `now` and the recipient's time zone. Rules: split on commas, semicolons and "and" (not inside a time or a number); kind prefixes force a kind; then vitals (keyword plus number, or a bare `n/n`), doses (give/gave/skip/refuse plus a medication or pass, `all`, `meds`), symptoms (a phrase plus 0–10 or `n/10`), events (`appt`/`appointment`, or a future time phrase), then a note. Names are matched with the existing folding (case, accents, honorifics) and prefix rules from medication and provider suggestions. Time phrases are parsed in the recipient's zone. Vital warnings and hard limits come from the shared vitals spec; a future time on a past-only kind is a warning that blocks Save for that card. Always returns at least one reading per part (a note). English only.
- **Predictions:** `usualAtHour(entries, now, timeZone)` (kinds and vital types the group logged within ±60 min of this time on at least 3 of the last 14 days, as fill-in suggestions), `learnedTiles(entries)` (the four most-logged of note, symptom, a vital type, dose over the last 30 days, padded with the fixed set), and the recent-lines store (pure helpers over storage that may throw).
- **Simple-mode resolution:** `resolveSimpleMode({ role, ownerDefault, locked, ownSetting, deviceToggle }) → { simple, canToggle, locked, inputs }`. A lock wins over everything; otherwise toggle, then own setting (unless `group`), then the owner's default. `inputs` is false for viewers.
- **Day summary:** `daySummary(dayEntries, baselineEntries, context) → { parts, lines }`: vitals' range per type with a direction against the previous 7 days' range or the unusual band, symptoms with the highest severity and "new" when absent from the previous 7 days, event titles (cancelled excluded), the note count, and the authors' names. No doses (the medication strip and pass rows cover them). Text and screen-reader wording both come from it.
- **Visit prep:** `visitWindow({ providerIds, events, now })` (the last past, not cancelled, event linked to any of them, else 30 days) and `visitPrepSection(data, window) → lines`: medication changes and the current list (from `medicationDisplay`), vital ranges, averages and direction against the same length of time before, symptoms with counts and highest severity, events, care periods that overlap the window, and missed doses (a range version of `medications-2`'s slot logic, added beside `dueDoses`). Empty sections are left out; the heading is "Since your last visit · <date range>" and, on a rerun, "(updated <date>)".
- **Document insertion:** `prependNoteSection(doc, lines)` beside the existing Yjs helpers: inserts a heading and the lines at the start of the fragment as one Yjs transaction, never touching existing content.

### Device

- **The action runner** (`lib/sync`): `runActions(db, context, actions)` carries out every action in one local transaction through the existing local writes (vitals and symptoms as `timeline.ts` does, `logDose`, Given all, `materializeLiveEntry` with a document built by `noteDocFromText`, appointment creation with provider links), and returns the created ids for Undo. A refused action (a role or validation error) refuses the whole batch with the card it belongs to.
- **Undo** reuses `medications-2`'s shared Undo hook and status line (10 s). "Remove my last entry" deletes your own entries from the last 30 minutes through the normal soft delete.
- **Visit prep** reads local data only and writes through the appointment's document like typing does, so it syncs and merges as an ordinary `note_update`. Creating an appointment from a provider's page goes through the existing `entries/new?kind=event&when=pick` flow with the provider linked.

### Screens

- **The quick-entry box** (a component in a new feature folder, used by the timeline and simple mode): a field, suggestion chips, preview cards with alternatives and remove, Save, Edit and the tips line. On the timeline it sits above the entries for writers (the per-kind buttons live in B-98's + menu). Below `sm` it's one line that grows while typing.
- **Simple mode** is a view of the timeline route, not a new route, so links, Back and sync stay the same: chosen by `resolveSimpleMode`, it renders its own regions (header, box, Now, tiles, rows) and hides the strips, filters, search, the sections nav and the tab bar. The `/app` header shows only the Caretook mark, the sync status and a reduced user menu (Settings, Sign out, and the toggle unless locked). Locked members are sent to the timeline from other group routes (settings, providers, medications, Upcoming, search), except their notes' and events' pages; account settings stay reachable.
- **Tiles** open the existing sheets in a simple variant: one field group each, large controls (a 0–10 face scale for "How she feels", the vital fields for one type, the Dose sheet's due slots first).
- **Group settings:** Details gets a "Simple mode tiles" card (learned, fixed, or pick four); Members gets "Simple mode" and "Locked" switches on each member's row for owners and admins. Both online only, through oRPC (`careGroup.update` gains `simpleTiles`; a new `careGroup.setMemberMode`), read-only offline like the rest.
- **Account settings:** the Timeline layout page gains "Simple mode: Follow the group / Always / Never".
- **Day summaries:** a summary line in each day section under its sticky header (not inside the header), from one pass over the loaded window plus a 7-day baseline query; hidden when `parseFilters` reports any filter or search.
- **Visit prep:** a "Prepare for this visit" button on an upcoming appointment's page (writers), "Prepare for a visit" on a provider's page, and Prepare in Upcoming rows' actions. It opens a small sheet showing the window (start editable through `DateTimeField`) and a preview of the lines, then Insert.
- **Print** in `entryActionItems` for notes and events, for everyone, printing the entry page's regions and text on the shared print CSS (the app header and tab bar are already `print:hidden`).

### Not changed

- No new dependencies. No remote AI, no server-side voice, no new vendor.
- The forms and sheets keep working as they are; quick entry is another way in.

## Testing Decisions

- **Good tests check behaviour through a module's public function**: inputs and returned values, never internals. Times are fixed in the recipient's zone (America/Los_Angeles, like the seeds), including a DST change.
- **The parser:** a large table-driven `data:unit` test (in the style of `search.test.ts`): each row is a line, a context and the expected parts, kinds, actions and warnings. It covers every vital keyword and unit, bare blood pressure, multiple readings, every dose form and pass phrase, symptoms with and without severity, appointments with providers and places, time phrases, prefixes, splitting, misspellings and partial names, future times on past-only kinds, hard limits and unusual values, and garbage input.
- **Actions:** Zod and `actionPreview` unit tests. **The runner** is checked in component tests on the test device (docs/domain/components.md, _Component tests_): every action writes what the forms write, a refused action leaves nothing, Undo removes the batch, and the batch is queued for upload.
- **Day summary, visit prep and predictions:** fixture days and windows (`web:unit` or `data:unit`), including empty days, a type absent from the baseline, cancelled events, a window with no past visit, and DST.
- **`prependNoteSection`:** two Yjs docs, one inserting while the other types, converge with both texts kept (prior art: `noteYjs.test.ts`).
- **Simple-mode resolution:** every combination of role, default, lock, own setting and toggle.
- **Screens:** component tests beside each screen (docs/loops.md, _Browser check budget_, which overrides anything older here): the box and cards, suggestions, day summaries, the simple view for a writer, a locked member and a viewer, tiles, the visit prep sheet and Print. Another device's change is the test device's `sync()`. No new `assistant.mjs`.
- **End-to-end:** only what needs the real server and sync: one `app-shell` step (the owner's simple-mode switch reaching the member's device). The new columns get the lean set at landing. `check-areas` gains rules for the new folders and modules (screens map to none).

## Out of Scope

- Any remote AI: chat, generated summaries, generated questions. Later, and for a user's own AI through `connectors` (B-104).
- Server-side or app-specific voice, Siri, Alexa, Google Assistant. Dictation is the keyboard's.
- On-device language models (Capacitor), until the native app ships.
- Editing or deleting existing entries from the box ("make that 135").
- Languages other than English in the parser.
- Doses in the day summary.
- A full onboarding flow (B-31); this PRD adds only the first-run hint about tiles.
- Questions people add for a visit as structured data: they're text in the appointment's notes.
- Charts of vitals (B-100 adds averages to the profile separately).

## Further Notes

- The action shapes are the contract `connectors` will expose as MCP tools; keep them small, explicit and validated by the shared Zod schemas, with no device-only fields.
- Slices that need passes (dose and pass actions, the Now block, Given all in simple mode, missed doses in visit prep) wait for `medications-2` to land; the parser can treat passes as optional context until then.
- B-98 and B-99 change the same header and quick-add area; they land first, and this PRD's timeline slice syncs `dev` before starting.
- Hot files: the timeline route folder (box, summaries, simple view), `routes/app/layout/route.tsx` (the reduced header), group settings Details and Members, `entryActionItems`, `lib/sync/` writes, `PERMISSIONS`, the stream queries and device schema, `userPreferences`, `routes.ts`, `appUrls`.
