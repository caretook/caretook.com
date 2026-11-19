# Plan: Assistant

> Source PRD: [`plans/assistant-prd.md`](assistant-prd.md). User-story numbers (US) refer to it. Backlog items B-12 (quick entry and the actions), B-49 (day summaries), B-58 (visit prep), B-87 (simple mode). Topic `assistant`.

## Status

| Slice | State                                              | Merge into `prd/assistant` (slice commits) |
| ----- | -------------------------------------------------- | ------------------------------------------ |
| 1     | not started                                        |                                            |
| 2     | blocked by 1                                       |                                            |
| 3     | not started                                        |                                            |
| 4     | not started                                        |                                            |
| 5     | blocked by 1                                       |                                            |
| 6     | blocked by 5                                       |                                            |
| 7     | blocked by 1, 2, 4, 6 and `medications-2` in `dev` |                                            |

**Landing:** land each wave as soon as it's green. The user said (2026-11-19) there's no real data, so it doesn't matter when the migration (slice 5) lands; it doesn't force one landing at the end. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued.

Backlog: B-12, B-49, B-58 and B-87 are `triaged`. Claim B-12 when slice 1 starts, B-49 with slice 3, B-58 with slice 4, B-87 with slice 5. Mark each `done` after its last slice merges: B-49 after 3, B-58 after 7 (missed doses), B-87 after 7 (the Now block), B-12 after 7.

Fold into AGENTS.md at each landing: the actions and the parser (a new _Assistant_ section), the timeline's quick-entry box and day summaries (_Timeline screen_), visit prep and Print (_Live notes_ / _Appointments_), simple mode (the frame, the members columns and the permissions table, `simpleTiles`, the preference).

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
- **Wave 4: slice 7**, only once `medications-2` has landed in `dev` (passes, `duePasses`, Given all, the shared Undo hook). Ask `medications-2`'s orchestrator to message you when it lands; sync `dev` first.
- **B-98 and B-99** (`quick-fixes`: the + menu and no Latest vitals on phones) reshape the same header. If either has landed in `dev`, sync before starting slice 1 or 5 and follow it.
- Merge in number order within a wave. Per AGENTS.md's _Browser check budget_, loops run `pnpm prd browser --changed` before hand-off and the orchestrator runs the suite once per UI landing. Run `pnpm datastore:reset` and `docker compose restart powersync` after slice 5, and after any sync that brings a migration.
- Every slice ends with `pnpm check`, `pnpm build:native`, its browser checks and a hand-off (AGENTS.md, _Loop rules_).
- Browser checks go in a new `assistant.mjs` (tagged rows, cleaned up at the end, smoke blocks for each slice's core path), plus `phase2.mjs` for day summaries and `live-notes.mjs` for Print. Each slice adds `check-areas` rules for its new folders and modules.

---

## Slice 1: Quick entry on the timeline

**User stories:** US 1–11, 14–27, 30, 31. **Blocked by:** none. **Blocks:** 2, 5, 7.

### What to build

The action shapes with Zod and `actionPreview`, and the parser for everything except passes: vitals (keywords, units, bare `n/n`, several readings in one entry, hard limits and unusual warnings), doses for a single medication (give, skip, refuse, amount; name matching by prefix and folding), symptoms with and without severity, appointments (a future time phrase or `appt`, provider and place matching), notes as the fallback, time phrases in the recipient's zone (future times refused for past-only kinds), splitting on commas, semicolons and "and", and the `n: e: s: v: d:` prefixes.

The runner, carrying out a batch in one local transaction. The quick-entry box above the timeline's entries for writers (one line below `sm` that grows while typing): a preview card per part with its best reading, alternatives as chips, remove, Edit (opens the existing sheet or the entry page filled in) and Save (saves all, offline). After Save, a polite status line ("Saved 3 entries"). Undo comes in slice 7 with `medications-2`'s shared hook. Viewers see no box.

### Acceptance criteria

- [ ] A line with a vital, a dose and a symptom saves as three entries in one transaction, offline, and they appear on the timeline and on a second device.
- [ ] Alternatives switch a card's kind; remove drops one card; Edit opens the right sheet or page filled in.
- [ ] A hard-limit value or a future time on a past-only kind blocks that card's Save with its message; an unusual value warns but saves.
- [ ] The user's units are used and an explicit unit wins.
- [ ] Viewers get no box; the box and cards are named and announced for screen readers.
- [ ] A table-driven parser test (every rule above, misspellings, garbage) and action Zod and preview tests; `assistant.mjs` steps for the box, including the runner through `window.caretookModules()`.

---

## Slice 2: Suggestions in the box

**User stories:** US 28, 29, 33–36. **Blocked by:** 1. **Blocks:** 7.

### What to build

Name autocomplete for medications and providers while typing (the existing suggestion matching). Recent lines: the last 8 distinct saved lines per user and group on this device, recorded on Save, forgotten at sign-out, offered as one-tap chips that fill the box. Usual at this hour: kinds and vital types the group logged within ±60 minutes of now on at least 3 of the last 14 days, offered as chips that fill the box with the keyword and wait for numbers. The tips line under an empty box.

### Acceptance criteria

- [ ] Typing a partial medication or provider name offers it; picking it completes the word.
- [ ] A saved line appears in recent lines on the next visit, on this device only, and is gone after sign-out.
- [ ] Seeded morning blood pressures produce a `bp` chip around their hour; tapping it never saves on its own.
- [ ] Everything works offline.
- [ ] Unit tests for `usualAtHour` (fixed days, DST) and the recent-lines store (storage that throws); `assistant.mjs` steps.

---

## Slice 3: Day summaries

**User stories:** US 59–67. **Blocked by:** none. **Blocks:** none.

### What to build

`daySummary(dayEntries, baselineEntries, context)`: each measured vital type's range for the day with a direction against the previous 7 days or the unusual band, symptoms with their highest severity and "new" when absent from the previous 7 days, event titles (not cancelled), the note count, and who logged. No doses. A summary line in each day section under its sticky header, expanding to a few lines on tap (a disclosure button), live for today, hidden when any filter or search is on, in rows and cards, with screen-reader wording for the arrows.

### Acceptance criteria

- [ ] Seeded days show a summary that matches their entries; a new symptom is marked "new"; a high reading has an up arrow.
- [ ] A new entry today updates the summary live.
- [ ] Any kind, author or search filter hides every summary; clearing it brings them back.
- [ ] The line expands and collapses by tap and keyboard, and is read as text.
- [ ] Unit tests for `daySummary` (empty day, a type absent from the baseline, cancelled events, DST); `phase2.mjs` steps.

---

## Slice 4: Visit prep and printing notes

**User stories:** US 68–75, 76 (not missed doses), 77–83. **Blocked by:** none. **Blocks:** 7.

### What to build

`visitWindow` (the last past, not cancelled, event linked to the providers, else 30 days) and `visitPrepSection` (medication changes and the current list, vital ranges, averages and direction, symptoms with counts and highest severity, events, care periods overlapping the window; empty sections left out; a dated heading, "(updated …)" on a rerun). `prependNoteSection` in the Yjs helpers.

"Prepare for this visit" on an upcoming appointment's page (writers), "Prepare for a visit" on a provider's page (opens their next appointment, or creates one through `entries/new?kind=event&when=pick` with the provider linked), and Prepare in Upcoming rows' actions. Each opens a sheet with the window's start (editable) and a preview, then Insert, which prepends the section into the appointment's live notes. Works offline; a co-editor sees it live. Viewers read only.

Print in the ⋯ menu of every note and event, for everyone: the title, time, place, With providers and text on the shared print CSS.

### Acceptance criteria

- [ ] Prepare on a seeded appointment inserts a section covering the time since the last visit with that provider; sections with nothing are left out.
- [ ] Running it again prepends a newer dated section; text typed by anyone is unchanged, including when a second browser types at the same time.
- [ ] The three entry points work; from a provider with no upcoming appointment it offers to create one.
- [ ] Offline, prep inserts and syncs on reconnect.
- [ ] Print renders a note and an event legibly at 420 and 1280 in print media.
- [ ] Unit tests for `visitWindow`, `visitPrepSection` and `prependNoteSection` (two docs converge); `assistant.mjs` and `live-notes.mjs` steps.

---

## Slice 5: Simple mode basics

**User stories:** US 37–39, 46, 47, 49–53, 57, 58. **Blocked by:** 1. **Blocks:** 6.

### What to build

The PRD's migration (`simple_mode`, `simple_mode_locked`, `simple_tiles`), permissions, the service rule for owners' rows and self-locks, the stream queries and device schema, `careGroup.setMemberMode`, and `simpleTiles` on `careGroup.update` (stored; used in slice 6). `simpleMode` in `user.preferences`. `resolveSimpleMode`.

The simple view of the timeline: the recipient and "Today", the quick-entry box in large type with a dictation hint, then the timeline's rows, bigger and without ⋯ menus; notes and events open as usual. Filters, search, the strips, the sections nav and the tab bar are hidden, and the `/app` header shows only the mark, the sync status and a reduced user menu. The toggle on the timeline (stored per device), the account setting (Follow the group / Always / Never, on the Timeline layout page, through `saveSettings`), and the owner's Simple mode switch on each member's row on Members (online only).

### Acceptance criteria

- [ ] The migration adds the three columns; they sync to every member's device.
- [ ] An owner turns on simple mode for caretaker@ from Members; caretaker@'s device switches without a reload.
- [ ] Own setting and toggle follow the precedence (toggle, own, owner default), on two devices.
- [ ] Only owners change an owner's row; nobody changes their own lock; the server refuses otherwise.
- [ ] The simple view hides everything the PRD lists and still saves through the box.
- [ ] Integration tests for `setMemberMode` and the permissions; unit tests for `resolveSimpleMode`; `assistant.mjs` and `app-shell.mjs` steps.

---

## Slice 6: Simple mode complete

**User stories:** US 42–45, 48, 54–56. **Blocked by:** 5. **Blocks:** 7.

### What to build

Tiles: the "Simple mode tiles" card in group settings Details (learned, fixed, or pick four; online only), `learnedTiles` (the group's last 30 days, padded with the fixed set), four big tiles with labels using the recipient's name or pronouns, each opening a simple variant of the existing sheet (a 0–10 face scale for how they feel, one vital type's fields, the Dose sheet), and a first-run hint that owners can set them.

The lock: the Locked switch on Members; a locked member has no toggle or Full app link, a user menu with only Settings and Sign out, and is sent to the timeline from other group routes (except their notes' and events' pages); with several groups they choose from `/app`'s list. The viewer version: bigger rows, the next appointment as text, no box or tiles. "Remove my last entry" for your own entries from the last 30 minutes.

### Acceptance criteria

- [ ] Each tile mode shows the right four tiles; each tile saves an entry through its simple sheet, offline.
- [ ] A locked member can't reach the full app or other group routes, but can reach account settings and sign out.
- [ ] Viewers in simple mode get no inputs.
- [ ] Remove my last entry deletes only your own entries from the last 30 minutes.
- [ ] Unit tests for `learnedTiles` and tile labels; `assistant.mjs` steps for tiles, the lock and viewers.

---

## Slice 7: Passes everywhere

**User stories:** US 12, 13, 26, 32, 40, 41, and missed doses in 76. **Blocked by:** 1, 2, 4, 6, and `medications-2` landed in `dev`. **Blocks:** none.

### What to build

With passes in `dev`: the `givePass` action and runner support through Given all; the parser's pass phrases (`gave evening meds`, `gave all`, `gave meds`, with due passes breaking ties); the due pass as the first suggestion chip; simple mode's Now block (due passes with Given all, the next appointment); Undo for quick entry's Save through `medications-2`'s shared hook (10 s); and missed doses in visit prep through a range version of the slot logic beside `dueDoses`.

### Acceptance criteria

- [ ] `gave evening meds` logs the evening pass's medications as Given all does; `gave meds` picks the due pass.
- [ ] The due pass is offered as one tap in the box and in simple mode's Now block, with Undo.
- [ ] Undo after any quick-entry Save removes the whole batch.
- [ ] Visit prep shows the missed-dose count for its window.
- [ ] Parser table rows for passes; unit tests for the range slot logic (DST, retimed pass); `assistant.mjs` steps.
