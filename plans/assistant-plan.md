# Plan: Assistant

> Source PRD: [`plans/assistant-prd.md`](assistant-prd.md). User-story numbers (US) refer to it. Backlog items B-12 (quick entry and the actions), B-49 (day summaries), B-58 (visit prep), B-87 (simple mode). Topic `assistant`.

## Status

| Slice | State                                               | Merge into `prd/assistant` (slice commits) |
| ----- | --------------------------------------------------- | ------------------------------------------ |
| 1     | merged                                              | 3766647 (c3c3398, 7ddf05d)                 |
| 2     | merged                                              | 66b3e35 (98aff27, d94ea40)                 |
| 3     | merged                                              | f358d86 (33436b2, a1d1045)                 |
| 4     | merged                                              | bab73d5 (5c7c747, 95b8c05)                 |
| 5     | merged (migration 0021_simple_mode)                 | 42c5518 (e082102, b4a282c)                 |
| 6     | running                                             |                                            |
| 7     | blocked by 1, 2, 4, 6 (`medications-2` is in `dev`) |                                            |

**Wave A** (slices 1–5, plus the dev sync 86f0fba with quick-fixes' + menu and `DayHeader`): merged. The lean suite at b723d14 failed `app-shell` (viewers' new ⋯ Print menu counted as writer controls), `roundtrip` (local add 2.3 s > 2 s) and `live-notes` (the viewer's avatar order, already failing at 86f0fba). A fix is running on a fresh `slice/assistant/4` (slot 1); rerun only those three once it merges, then `pnpm prd check` and land. Docs folded for slices 1–4 (new `docs/domain/assistant.md`); slice 5's (simple mode) are still to fold. Slice 6 is running.

**Landing:** land each wave as soon as it's green. The user said (2026-11-19) there's no real data, so it doesn't matter when the migration (slice 5) lands; it doesn't force one landing at the end. **Landing mode: run everything through** (queued with `pnpm prd queue assistant`, 2026-11-19): start every ready slice, land each green wave without asking, clean up; ask only real questions.

Backlog: B-12, B-49, B-58 and B-87 are `triaged`. Claim B-12 when slice 1 starts, B-49 with slice 3, B-58 with slice 4, B-87 with slice 5. Mark each `done` after its last slice merges: B-49 after 3, B-58 after 7 (missed doses), B-87 after 7 (the Now block), B-12 after 7.

Fold into the area docs at each landing (AGENTS.md, _Area index_; only rules and pointers into AGENTS.md itself): the actions and the parser in a new `docs/domain/assistant.md` (and its _Area index_ row), the quick-entry box and day summaries in `timeline.md`, visit prep and Print in `live-notes.md` and `appointments.md`, simple mode in `app-shell.md` (the frame) and `care-groups.md` (the members columns, the permissions table, `simpleTiles`), the preference in `sync.md`'s settings cache.

## Architectural decisions

Durable decisions every slice follows:

- **No remote AI, no new vendor, no new dependency.** Everything runs on the device from local data; voice is the keyboard's dictation.
- **Assistant actions** are a client-safe module in `@caretook/data`'s schema exports: a discriminated union `logVital | logSymptom | logDose | givePass | addNote | addEvent`, each validated by Zod built from the existing content schemas and limits, with `actionPreview` wording from the existing display helpers. Actions carry no ids and nothing device-only, because `connectors` (B-104) will carry out the same shapes through the services.
- **The parser** is pure and client-safe beside the actions: `parseQuickEntry(text, context)` → parts → ranked readings → actions, plus warnings. Context holds units, medications, passes (optional until slice 7), providers, due passes, `now` and the recipient's time zone. English only. Every part returns at least a note reading.
- **The runner** lives in `lib/sync`: it carries out a batch of actions in **one local transaction** through the existing local writes, refuses the whole batch if one action is refused, and returns the created ids.
- **Quick-entry state** that isn't care data is per user and group in localStorage (recent lines; the simple-mode device toggle), wrapped in try/catch, forgotten at sign-out.
- **Simple mode** is a view of the timeline route, not a route: `resolveSimpleMode({ role, ownerDefault, locked, ownSetting, deviceToggle })` decides it. A lock wins; otherwise toggle, then own setting (`group | simple | full`, in `user.preferences.simpleMode`), then the owner's default. Viewers get no inputs.
- **One migration** (slice 5): `care_group_member.simple_mode` and `simple_mode_locked` (booleans, default false), `care_group.simple_tiles` jsonb (`{ mode: "learned" | "fixed" | "custom", tiles? }`, null = learned). All synced through the `care_groups` stream and the device schema; none in the upload switch (written online through oRPC: `careGroup.setMemberMode`, `careGroup.update` with `simpleTiles`). Owners and admins set them; only owners change an owner's row; nobody changes their own lock.
- **Visit prep** inserts into the appointment's existing live document through a Yjs helper that prepends a dated section in one transaction and never edits existing content; it syncs as an ordinary `note_update`. A rerun prepends a newer dated section.
- **Day summaries** are computed from the loaded window plus a 7-day baseline, in each day section under its sticky header, and hidden whenever a filter or search is on.
- **Routes:** no new top-level pages. Visit prep is a sheet; simple mode's tiles reuse the existing add sheets (`timeline/new/:kind`, the Dose sheet) in a simple variant. New URLs go through `appUrls` and `routes.ts` (appended).
- **Pure modules** (one home each, unit tested): actions, parser, predictions (`usualAtHour`, `learnedTiles`, recent lines), `resolveSimpleMode`, `daySummary`, `visitWindow`, `visitPrepSection`, `prependNoteSection`.
- **Registries are appended to, never reordered:** `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the device schema, `routes.ts`, `appUrls`, `entryActionItems`, `check-areas`.
- **UI building blocks:** `components/ui/` primitives and feature folders only (AGENTS.md, _Components_). The quick-entry box and preview cards live in a new `components/quick-entry/` folder, since the timeline and simple mode both use them.

## How to run this plan

- **Wave 1: slices 1, 3 and 4 in parallel.** 1 owns the actions, the parser, the runner and the box above the timeline's entries; 3 owns the day sections' summary line inside `TimelineEntryList`; 4 owns the entry page, the provider page, Upcoming rows' actions and `entryActionItems` (Print). 1 and 3 both touch the timeline route folder: keep 1 to the region above the entries and 3 to the day sections.
- **Wave 2: slices 2 and 5.** 2 owns the box's suggestions; 5 owns the migration, settings and the simple view. Both touch `components/quick-entry/`: 2 adds below the field, 5 renders the box larger.
- **Wave 3: slice 6.**
- **Wave 4: slice 7.** `medications-2` (passes, `duePasses`, Given all, the shared Undo hook) is already in `dev`.
- **B-98, B-99 and B-105** (`quick-fixes`: the + menu, no Latest vitals on phones, the care period in the sticky date header) reshape the same header. If any has landed in `dev`, sync before starting slice 1, 3 or 5 and follow it.
- Merge in number order within a wave, with no checks between merges. Run `pnpm datastore:reset` and `docker compose restart powersync` after slice 5, and after any sync that brings a migration.
- **Tests follow docs/loops.md, _Browser check budget_** (it overrides anything older in this plan or the PRD):
  - **Screens get component tests** (`*.browser.test.tsx` beside the screen, on the test device: docs/domain/components.md, _Component tests_). That covers everything one device decides: the box and its cards, alternatives, Edit, Save and the status line, suggestions, day summaries, the simple view, tiles, the lock, viewers, the visit prep sheet and the Print item. The test device's local writes, `queued()` and `sync()` cover the runner (one transaction, a refused batch leaves nothing, the created ids), offline saves and another device's change arriving. **There is no new `assistant.mjs`**, and no new steps in `phase2.mjs` or `live-notes.mjs`.
  - **Pure modules get unit tests**; server rules (`setMemberMode`, the permissions) get integration tests.
  - **End-to-end steps only for flows across the server and sync**, in the lean checks that own them: one `app-shell` step in slice 5 (an owner turns on simple mode for caretaker@ from Members; caretaker@'s device switches without a reload). The runner's uploads go through the existing local writes, which `roundtrip` already covers; the new columns get the lean set at landing (a migration maps to it).
  - **While building:** `pnpm test:components --changed prd/assistant`, plus `pnpm prd browser app-shell` in slice 5 only. **Before hand-off:** `pnpm check`, `pnpm build:native`, then `pnpm prd browser --changed` once (a stackless slice whose diff names a check adds one with `pnpm prd stack up`). **At landing:** the orchestrator runs `pnpm prd browser --suite` once for a wave that changes screens, plus any `e2e no` check `--changed --base dev --list` names.
  - **`check-areas`:** each slice adds rules for its new folders and modules: `components/quick-entry/` and the simple view map to none (component tests); pure modules with sibling unit tests need none.
- Every slice ends with its hand-off (AGENTS.md, _Loop rules_), with the ■ lines and table from `pnpm prd browser --changed`.

---

## Slice 1: Quick entry on the timeline

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md, docs/domain/sync.md, docs/domain/medications.md, docs/domain/appointments.md, docs/domain/providers.md · Tests: unit, component

**User stories:** US 1–11, 14–27, 30, 31. **Blocked by:** none. **Blocks:** 2, 5, 7.

### What to build

The action shapes with Zod and `actionPreview`, and the parser for everything except passes: vitals (keywords, units, bare `n/n`, several readings in one entry, hard limits and unusual warnings), doses for a single medication (give, skip, refuse, amount; name matching by prefix and folding), symptoms with and without severity, appointments (a future time phrase or `appt`, provider and place matching), notes as the fallback, time phrases in the recipient's zone (future times refused for past-only kinds), splitting on commas, semicolons and "and", and the `n: e: s: v: d:` prefixes.

The runner, carrying out a batch in one local transaction. The quick-entry box above the timeline's entries for writers (one line below `sm` that grows while typing): a preview card per part with its best reading, alternatives as chips, remove, Edit (opens the existing sheet or the entry page filled in) and Save (saves all, offline). After Save, a polite status line ("Saved 3 entries"). Undo comes in slice 7 with `medications-2`'s shared hook. Viewers see no box.

### Acceptance criteria

- [ ] A line with a vital, a dose and a symptom saves as three entries in one transaction, offline, appears on the timeline and is queued for upload (component test: `queued()`).
- [ ] Alternatives switch a card's kind; remove drops one card; Edit opens the right sheet or page filled in.
- [ ] A hard-limit value or a future time on a past-only kind blocks that card's Save with its message; an unusual value warns but saves.
- [ ] The user's units are used and an explicit unit wins.
- [ ] Viewers get no box; the box and cards are named and announced for screen readers.
- [ ] A table-driven parser test (every rule above, misspellings, garbage) and action Zod and preview tests; component tests for the box, the cards and the runner (a refused action leaves nothing).

---

## Slice 2: Suggestions in the box

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md · Tests: unit, component

**User stories:** US 28, 29, 33–36. **Blocked by:** 1. **Blocks:** 7.

### What to build

Name autocomplete for medications and providers while typing (the existing suggestion matching). Recent lines: the last 8 distinct saved lines per user and group on this device, recorded on Save, forgotten at sign-out, offered as one-tap chips that fill the box. Usual at this hour: kinds and vital types the group logged within ±60 minutes of now on at least 3 of the last 14 days, offered as chips that fill the box with the keyword and wait for numbers. The tips line under an empty box.

### Acceptance criteria

- [ ] Typing a partial medication or provider name offers it; picking it completes the word.
- [ ] A saved line appears in recent lines on the next visit, on this device only, and is gone after sign-out.
- [ ] Seeded morning blood pressures produce a `bp` chip around their hour; tapping it never saves on its own.
- [ ] Everything works offline.
- [ ] Unit tests for `usualAtHour` (fixed days, DST) and the recent-lines store (storage that throws); component tests for the chips and autocomplete.

---

## Slice 3: Day summaries

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md · Tests: unit, component

**User stories:** US 59–67. **Blocked by:** none. **Blocks:** none.

### What to build

`daySummary(dayEntries, baselineEntries, context)`: each measured vital type's range for the day with a direction against the previous 7 days or the unusual band, symptoms with their highest severity and "new" when absent from the previous 7 days, event titles (not cancelled), the note count, and who logged. No doses. A summary line in each day section under its sticky header, expanding to a few lines on tap (a disclosure button), live for today, hidden when any filter or search is on, in rows and cards, with screen-reader wording for the arrows.

### Acceptance criteria

- [ ] Seeded days show a summary that matches their entries; a new symptom is marked "new"; a high reading has an up arrow.
- [ ] A new entry today updates the summary live.
- [ ] Any kind, author or search filter hides every summary; clearing it brings them back.
- [ ] The line expands and collapses by tap and keyboard, and is read as text.
- [ ] Unit tests for `daySummary` (empty day, a type absent from the baseline, cancelled events, DST); component tests for the line, live updates and filters hiding it (in the timeline's shared `timelineWorld`).

---

## Slice 4: Visit prep and printing notes

Stack: no · Reads: docs/domain/components.md, docs/domain/live-notes.md, docs/domain/appointments.md, docs/domain/providers.md, docs/domain/medications.md, docs/domain/care-periods.md · Tests: unit, component

**User stories:** US 68–75, 76 (not missed doses), 77–83. **Blocked by:** none. **Blocks:** 7.

### What to build

`visitWindow` (the last past, not cancelled, event linked to the providers, else 30 days) and `visitPrepSection` (medication changes and the current list, vital ranges, averages and direction, symptoms with counts and highest severity, events, care periods overlapping the window; empty sections left out; a dated heading, "(updated …)" on a rerun). `prependNoteSection` in the Yjs helpers.

"Prepare for this visit" on an upcoming appointment's page (writers), "Prepare for a visit" on a provider's page (opens their next appointment, or creates one through `entries/new?kind=event&when=pick` with the provider linked), and Prepare in Upcoming rows' actions. Each opens a sheet with the window's start (editable) and a preview, then Insert, which prepends the section into the appointment's live notes. Works offline; a co-editor sees it live. Viewers read only.

Print in the ⋯ menu of every note and event, for everyone: the title, time, place, With providers and text on the shared print CSS.

### Acceptance criteria

- [ ] Prepare on a seeded appointment inserts a section covering the time since the last visit with that provider; sections with nothing are left out.
- [ ] Running it again prepends a newer dated section; text typed by anyone is unchanged, including when another device types at the same time (the `prependNoteSection` unit test with two docs; a component test with `sync()`).
- [ ] The three entry points work; from a provider with no upcoming appointment it offers to create one.
- [ ] Offline, prep inserts and syncs on reconnect.
- [ ] Print is in the ⋯ menu for everyone and the print view holds the title, time, place, With providers and text (component test); the look in print media is a by-hand check at landing.
- [ ] Unit tests for `visitWindow`, `visitPrepSection` and `prependNoteSection` (two docs converge); component tests for the three entry points, the sheet and offline Insert.

---

## Slice 5: Simple mode basics

Stack: yes · Reads: docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/api.md, docs/domain/care-groups.md, docs/domain/app-shell.md, docs/domain/components.md, docs/domain/timeline.md · Tests: unit, integration, component, e2e:app-shell

**User stories:** US 37–39, 46, 47, 49–53, 57, 58. **Blocked by:** 1. **Blocks:** 6.

### What to build

The PRD's migration (`simple_mode`, `simple_mode_locked`, `simple_tiles`), permissions, the service rule for owners' rows and self-locks, the stream queries and device schema, `careGroup.setMemberMode`, and `simpleTiles` on `careGroup.update` (stored; used in slice 6). `simpleMode` in `user.preferences`. `resolveSimpleMode`.

The simple view of the timeline: the recipient and "Today", the quick-entry box in large type with a dictation hint, then the timeline's rows, bigger and without ⋯ menus; notes and events open as usual. Filters, search, the strips, the sections nav and the tab bar are hidden, and the `/app` header shows only the mark, the sync status and a reduced user menu. The toggle on the timeline (stored per device), the account setting (Follow the group / Always / Never, on the Timeline layout page, through `saveSettings`), and the owner's Simple mode switch on each member's row on Members (online only).

### Acceptance criteria

- [ ] The migration adds the three columns; they sync to every member's device.
- [ ] An owner turns on simple mode for caretaker@ from Members; caretaker@'s device switches without a reload.
- [ ] Own setting and toggle follow the precedence (toggle, own, owner default): `resolveSimpleMode` unit tests and a component test with `sync()` for a setting from another device.
- [ ] Only owners change an owner's row; nobody changes their own lock; the server refuses otherwise.
- [ ] The simple view hides everything the PRD lists and still saves through the box.
- [ ] Integration tests for `setMemberMode` and the permissions; unit tests for `resolveSimpleMode`; component tests for the simple view, the toggle, the account setting and the Members switch; one `app-shell` step for the owner's switch reaching the member's device.

---

## Slice 6: Simple mode complete

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md, docs/domain/care-groups.md, docs/domain/timeline.md · Tests: unit, component

**User stories:** US 42–45, 48, 54–56. **Blocked by:** 5. **Blocks:** 7.

### What to build

Tiles: the "Simple mode tiles" card in group settings Details (learned, fixed, or pick four; online only), `learnedTiles` (the group's last 30 days, padded with the fixed set), four big tiles with labels using the recipient's name or pronouns, each opening a simple variant of the existing sheet (a 0–10 face scale for how they feel, one vital type's fields, the Dose sheet), and a first-run hint that owners can set them.

The lock: the Locked switch on Members; a locked member has no toggle or Full app link, a user menu with only Settings and Sign out, and is sent to the timeline from other group routes (except their notes' and events' pages); with several groups they choose from `/app`'s list. The viewer version: bigger rows, the next appointment as text, no box or tiles. "Remove my last entry" for your own entries from the last 30 minutes.

### Acceptance criteria

- [ ] Each tile mode shows the right four tiles; each tile saves an entry through its simple sheet, offline.
- [ ] A locked member can't reach the full app or other group routes, but can reach account settings and sign out.
- [ ] Viewers in simple mode get no inputs.
- [ ] Remove my last entry deletes only your own entries from the last 30 minutes.
- [ ] Unit tests for `learnedTiles`, tile labels and the lock's route rule; component tests for tiles, the lock and viewers.

---

## Slice 7: Passes everywhere

Stack: no · Reads: docs/domain/components.md, docs/domain/medications.md, docs/domain/timeline.md, docs/domain/live-notes.md · Tests: unit, component

**User stories:** US 12, 13, 26, 32, 40, 41, and missed doses in 76. **Blocked by:** 1, 2, 4, 6 (`medications-2` is in `dev`). **Blocks:** none.

### What to build

With passes in `dev`: the `givePass` action and runner support through Given all; the parser's pass phrases (`gave evening meds`, `gave all`, `gave meds`, with due passes breaking ties); the due pass as the first suggestion chip; simple mode's Now block (due passes with Given all, the next appointment); Undo for quick entry's Save through `medications-2`'s shared hook (10 s); and missed doses in visit prep through a range version of the slot logic beside `dueDoses`.

### Acceptance criteria

- [ ] `gave evening meds` logs the evening pass's medications as Given all does; `gave meds` picks the due pass.
- [ ] The due pass is offered as one tap in the box and in simple mode's Now block, with Undo.
- [ ] Undo after any quick-entry Save removes the whole batch.
- [ ] Visit prep shows the missed-dose count for its window.
- [ ] Parser table rows for passes; unit tests for the range slot logic (DST, retimed pass); component tests for the chip, the Now block and Undo.
