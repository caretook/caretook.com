# Plan: Care periods

> Source PRD: [`plans/care-periods-prd.md`](care-periods-prd.md). User-story numbers (US) refer to it. Backlog item B-50. Topic `care-periods`.

## Status

| Slice | State                                     | Merge into `prd/care-periods` (slice commits) |
| ----- | ----------------------------------------- | --------------------------------------------- |
| 1     | merged `9fb07f3` (f4f439c, abc3fa8)       | not landed: one landing at the end            |
| 2     | in progress (wave 2)                      |                                               |
| 3     | in progress (wave 2)                      |                                               |
| 4     | in progress (wave 2)                      |                                               |
| 5     | in progress (wave 2)                      |                                               |
| 6     | in progress (search is in `dev` since the `475bf7c` sync) |                                               |

**Landing mode: run everything through** (the user queued this PRD with `pnpm prd queue care-periods`): start every ready slice, land each green wave without asking, clean up; ask only real questions.

**One landing at the end** (the user's preference for PRDs with a migration): merge every slice, then ask the user before the one full suite (never start `--suite` unasked), `pnpm prd check`, land. The `475bf7c` sync brought `search` from `dev`, including its `0016_search` migration; ours was regenerated as `0017_care_periods` (the hand-written `ALTER PUBLICATION` kept). Slices 2–5 branched before that sync, so their merges may conflict in `appUrls`, `routes.ts`, `check-areas` and the timeline (search mode): resolve them additively. Slice 6's test database couldn't start (Docker ran out of networks); its agent retries `pnpm datastore:start:test` once a stack is removed.

Backlog: B-50 claimed by `prd/care-periods` when slice 1 started; mark it `done` after the last slice merges. The PRD and this plan are in `dev`. B-78 (strip restyle) is already in `dev`, so slice 3 matches the current `STRIP_CLASS` style. Slice 6 waits for `search` slices 2 and 3 in `dev` (only slice 1 is there as of 2026-11-19).

Fold into AGENTS.md at the final landing: a _Care periods_ section (the table, the track rules, the period-track module, the device module, the routes, the timeline line and markers, the group menu icon, suggestions, the search filter), `care_period` in the permissions table, the `carePeriod` document subject, and the stream and upload switch entries.

## Architectural decisions

Durable decisions every slice follows:

- **One track per group, stored by start only.** A period's end is the next period's start; the latest has none and is current. Gaps and overlaps can't be stored. Editing a start moves the previous period's end; deleting (soft) extends the previous one. Care never ends on the track. Order is `(started_at, created_at, id)`; two periods with the same start both stay (the earlier-created one has zero length and is shown, so it can be deleted).
- **Start:** `started_at` timestamptz plus `date_only` boolean. A date-only start is midnight in the **recipient's** time zone and shows without a time. Future starts are refused (the service at now + 1 h, the device at now + 5 min, as appointments do for past-only kinds; the issue is on `startedAt`). "Day N" counts calendar days in the recipient's zone, the start day being day 1.
- **Types** (fixed, this order; new ones appended; an unknown type displays as Other): `home`, `emergency`, `hospital`, `rehab`, `assistedLiving`, `memoryCare`, `nursingHome`, `hospiceHome`, `hospiceFacility`, `other`. `other` needs a label.
- **Schema** (one pending migration for the PRD, made in slice 1; regenerate it on top if a sync brings in another): `care_period` with `group_id`, `recipient_id` (composite FK to `care_recipient`), `type`, `label`, `place_provider_id` (composite FK to `provider`, `NO ACTION`), `place_detail`, `started_at`, `date_only`, `deleted_at`, timestamps and audits; unique `(group_id, id)`. `note_document` gains the `carePeriod` subject with its owner column (a cascading composite FK, added to the exactly-one-owner check). Read the generated SQL and reorder by hand if drizzle-kit misorders it, and keep the hand-written `ALTER PUBLICATION` at its end.
- **Permissions:** any member reads; writers (owner, admin, caretaker) create, update and soft-delete. Group and recipient ids are immutable.
- **Place:** an optional live provider in the same group (any type; the picker lists practices first) plus optional free-text detail. A provider deleted later stays linked and shows greyed "(removed)".
- **Sync:** `care_period` in the `care_groups` stream (soft-deleted rows included, explicit columns) and the publication; a device schema entry; an upload op (PUT upsert, PATCH update or soft remove, DELETE soft remove; a changed group or recipient is `immutable`; `date_only` as 1/0).
- **Markers are drawn, never written:** no timeline entry kind. The timeline places "From → to" rows from the periods.
- **Pure modules** (one home each, tested): the **period track** (client-safe: spans, `periodAt`, current period and day count, `periodRange`, validation), **timeline markers** (which markers fall in the loaded window), **period suggestions** (event title → type), **period wording** (labels, icons, line, marker text and sentence, lengths).
- **Routes** (children of the group route, built through `appUrls`):
  - `periods`: the periods page, newest first.
  - `periods/new` (`?type=`, `?startedAt=`, `?dateOnly=`, `?place=`, for prefills): the add sheet, a child of the periods page; closing returns to where it was opened (the timeline line, an entry, the list) through link state, and a deep link closes to the list.
  - `periods/:periodId`: the period page; `periods/:periodId/edit`: the edit sheet.
  - Guards send viewers and missing, deleted or other-group periods to the list.
  - Search (slice 6): `?period=<id>` on the timeline, honoured only while `q` is set, and the search page's own period parameter.
- **Not a group section:** no `GROUP_SECTIONS` entry or tab. The periods page is reached from the timeline line, the group menu and period pages.
- **Registries are appended to, never reordered:** `db/schema/index.ts`, `PERMISSIONS`, `NOTE_DOCUMENT_SUBJECTS`, `sync-config.yaml`, the upload switch, the device schema, `routes.ts`, `appUrls`, `lib/timelineFilters`, `check-areas`.
- **UI building blocks:** `components/ui/` primitives and feature folders only (AGENTS.md, _Components_). The place picker reuses the medication form's provider picker pattern (`ComboBox` with "Add "<typed>" as a new place", a new provider held as a name until Save, inserted in the period's transaction).
- **No new dependencies.**

## How to run this plan

- **Slice 1 can start now.** It touches `packages/`, `powersync/`, the device schema, the seeds and new route folders, and needs a stack.
- **2, 3, 4 and 5 after 1, in parallel.** 2 owns the period page and edit sheet; 3 the timeline header area and `TimelineEntryList`; 4 `GroupMenu`; 5 the entry page header. They share only `appUrls`, `routes.ts` and `check-areas` (additive).
- **3 follows the current strip style** (the Next strip's). B-78 (in `quick-fixes`) restyles all the strips, this line included, whenever it runs; if B-78 lands first, sync and match it.
- **6 after 1 and after `search` slices 2 and 3 land in `dev`.** Sync `dev` first.
- Merge in number order (any of 2–5 may merge as soon as it's ready). Per AGENTS.md's _Browser check budget_, loops run `pnpm prd browser --changed` before hand-off and the orchestrator runs the suite once at landing. Run `pnpm datastore:reset` and `docker compose restart powersync` after slice 1, and after any sync that brings a migration.
- **Land in waves:** 1 (periods you can add and list); then 2–5 (the page, the timeline, the menu, suggestions); then 6.
- Every slice ends with `pnpm check`, `pnpm build:native`, its browser checks and a hand-off (AGENTS.md, _Loop rules_).
- Slice 1 creates `care-periods.mjs` and its `check-areas` rules (the periods route folders, the period modules, the device module); later slices add their steps to it. Slice 3 also runs `phase2.mjs`; slice 4 `app-shell.mjs`; slice 5 `live-notes.mjs`; slice 6 `search.mjs`.

---

## Slice 1: Start and list periods

**User stories:** US 12–23, 26–29, 34, 64–66. **Blocked by:** none. **Blocks:** 2, 3, 4, 5, 6.

### What to build

The whole path for recording where the recipient is, from the database to a screen. The `care_period` table, its permissions, model and `carePeriodService` (create idempotent on id, update validating the merged row, soft remove; the place rule, the future-start rule, Other needs a label), the migration with the publication, the stream, the device schema and the upload op. The `carePeriod` document subject is added here too (the schema, the check and `noteDocumentService.create` accepting a live period), so slice 2 needs no migration.

The pure **period track** module (client-safe) and the pure **period wording** module. The device module: the group's periods, one period, the place choices, and local writes (create, update, soft remove, create with a new place in one transaction).

The **periods page** (`periods`): every period newest first with type icon, label, place, start, end ("until <date>" or "now") and length; "Add period" for writers. The **add sheet** (`periods/new`): type (`ChoiceGroup`), label, place picker with inline add, place detail, start (`DateTimeField` with a maximum of now, plus "Date only"), defaulting to now; it reads prefill parameters. A **minimal period page** (`periods/:periodId`): its type, label, place and dates, so links from other slices have a target.

Seeds (`seeds/carePeriods.ts`, own ids): Grandma Pat's Home → Emergency room → Hospital (at a seeded provider, with a room) → Rehab → Home over eight weeks; none for Dev Family 2.

`care-periods.mjs` starts here, with its `check-areas` rules.

### Acceptance criteria

- [ ] A writer adds a period from the periods page; it appears at once, and on a second device within seconds.
- [ ] Adding a period offline works and uploads on reconnect.
- [ ] Adding a period with a past start places it in the track by its start; the list shows the neighbours' ends moved.
- [ ] A new place typed in the picker becomes a provider in the directory, saved with the period in one transaction.
- [ ] A date-only start shows without a time; a timed start shows its time, in the recipient's zone.
- [ ] Future starts are refused on the device and by the service; Other without a label is refused with a field message.
- [ ] Two periods with the same start (two devices, offline) both stay and show in `(started_at, created_at, id)` order.
- [ ] Viewers see the list without "Add period"; `periods/new` sends them to the list.
- [ ] A non-member can't read or write periods (service and upload).
- [ ] Unit tests: the track (ordering, ties, derived ends, deletes, `periodAt` boundaries, current and day count across midnight and DST, date-only, `periodRange`, validation) and the wording.
- [ ] Integration tests: `carePeriodService` per role, the place rule (another group's or a deleted provider), future start, Other's label, soft delete, the upload op (PUT, PATCH, DELETE, `immutable`), and a `carePeriod` document's create.
- [ ] `care-periods.mjs`: add (with a new place), list, second device, offline, viewer. Smoke: add and see it listed.

---

## Slice 2: The period page

**User stories:** US 30–33, 45–52, 67. **Blocked by:** 1. **Blocks:** none.

### What to build

The full **period page**: header regions (title with the type and label, details with start, end and length, editors, actions with Edit and Delete for writers), the place with its contact actions (greyed "(removed)" when the provider is deleted), the place detail, links to the previous and next periods, and the period's **live notes** (created on the first real change, collaborative, offline, read-only for viewers), as the provider and medication pages do.

The **edit sheet** (`periods/:periodId/edit`), the same form as add: moving the start moves the boundaries around it. **Delete** after a `ConfirmDialog` ("<previous> will continue until <next start>"), soft, then the list. Missing, deleted and other-group periods are the 404.

### Acceptance criteria

- [ ] The period page shows type, label, place with call/map/website actions, detail, start, end and length, and previous/next links.
- [ ] Two browsers write the period's notes together; offline edits land on reconnect; a viewer reads them without editing.
- [ ] Editing a start updates the list and both neighbours' dates.
- [ ] Deleting a period extends the one before it; the list and page reflect it on a second device.
- [ ] A period whose place was deleted shows it greyed "(removed)", not as a link.
- [ ] Deleted, missing and other-group periods show the 404 without their details.
- [ ] `care-periods.mjs` covers the page, notes in two browsers, edit, delete, removed place, 404s and the viewer.

---

## Slice 3: The timeline

**User stories:** US 1–4, 9, 11, 24, 25, 35–44. **Blocked by:** 1. **Blocks:** none.

### What to build

The **current-period line** in the timeline's header area, in the current strip style (the Next strip's): the type icon, "In hospital · Mercy General · day 4", linking to the period; writers get **Change**, opening the add sheet (closing returns to the timeline). With no periods, writers see "Where is Pat now? Add care period"; viewers see nothing. It ignores the timeline's filters.

**Boundary markers**: the pure **timeline markers** module decides which markers fall in the loaded window (all older ones once the timeline has reached its beginning), and the list renders each inside its day section at its moment, in rows and cards: "Home → Hospital · Mercy General, room 412 · 14:20" with the new type's icon ("Started: Home" for the first; date-only at the start of its day), one link to the period, read as one sentence by screen readers. Markers show with kind and author filters on. A day with only a marker gets its own day section.

### Acceptance criteria

- [ ] The line shows the current period's type, place and day count, and opens the period.
- [ ] Change opens the add sheet; saving updates the line and adds a marker without a reload; closing returns to the timeline with its filters.
- [ ] Writers on a group with no periods see the prompt; viewers see nothing.
- [ ] Markers appear at the right moment in rows and cards, with the right from/to text, and open their period.
- [ ] Markers show with a kind filter and an author filter on.
- [ ] Scrolling back loads markers with their part of the timeline, never out of place; at the beginning, older markers show.
- [ ] Unit tests for the markers module (window rules, the first marker, same-moment periods, a day with no entries).
- [ ] `phase2.mjs` passes; `care-periods.mjs` covers the line, prompt, Change, markers in both views and under filters, and infinite scroll.

---

## Slice 4: The group menu

**User stories:** US 5–8, 10. **Blocked by:** 1. **Blocks:** none.

### What to build

The group menu's **trigger** shows the current period's type icon after the recipient's name, with the period's name as its accessible text and tooltip; nothing when there's no period. The **open menu** gets "Now: In hospital · day 4" (a link to the period) at the top of the group section, and "Care periods" (the periods page) after "Group settings". The menu reads the current period through a hook over local data, never `getSync()`, and shows the right group's period after switching groups.

### Acceptance criteria

- [ ] The icon shows on every group screen at 420 and 1280, with the period's name as its accessible name.
- [ ] The menu's "Now: …" item opens the period; "Care periods" opens the list.
- [ ] Switching to a group without periods removes the icon and the "Now" item.
- [ ] A new period changes the icon without a reload.
- [ ] `app-shell.mjs` passes; `care-periods.mjs` covers the icon, the items and switching groups (member@'s two groups).

---

## Slice 5: Suggestions from events

**User stories:** US 53–59. **Blocked by:** 1. **Blocks:** none.

### What to build

The pure **period suggestions** module: keyword rules per type (accents and case ignored, whole words; e.g. "admitted", "ER", "discharged home", "rehab", "hospice"), suppressed when the period at the event's time already has that type, returning the type, the event's start and the first linked practice as the place. On the **entry page**, writers see one chip on an event that matches ("Start a hospital period?"), near the With row; tapping it opens the add sheet prefilled, and closing returns to the entry. It works offline, and never shows on other kinds or for viewers.

### Acceptance criteria

- [ ] An event titled "Admitted to Mercy General" offers Hospital; "Discharged home" offers Home; "Hospice intake" offers Hospice at home.
- [ ] The sheet opens with the type, the event's time and its linked practice; saving adds the period and the chip goes away.
- [ ] No chip when the period at the event's time already has that type, on notes, symptoms or vitals, or for viewers.
- [ ] Unit tests for the suggestions module (each type's words, case and accents, whole words, suppression, prefill).
- [ ] `live-notes.mjs` passes; `care-periods.mjs` covers the chip, the prefilled sheet, suppression and offline.

---

## Slice 6: Period filter in search

**User stories:** US 60–63. **Blocked by:** 1, `search` slices 2 and 3. **Blocks:** none.

### What to build

A **period choice** on the search page (the group's periods, newest first, with "Any time") and a **period chip** in the timeline's search mode (`?period=<id>`, honoured only while `q` is set, through `lib/timelineFilters`, shown as "During <period>" with ✕). Both resolve the period to a range through the track's `periodRange` (an open period runs to now) and pass it into search's windows. Clearing the search clears the period.

### Acceptance criteria

- [ ] Searching "knee" with a period picked on the search page shows only matches within that period.
- [ ] On the timeline, the period chip narrows the search matches; ✕ clears only the period.
- [ ] The period is in the URL; Back and reload keep it.
- [ ] The current period's results run up to now.
- [ ] `?period=` without `q` changes nothing on the timeline.
- [ ] Unit tests for the URL helpers; `search.mjs` covers both surfaces.
