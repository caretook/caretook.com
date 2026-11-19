# Plan: Medications

> Source PRD: [`plans/medications-prd.md`](medications-prd.md). User-story numbers (US) refer to it. Backlog item B-15 (B-26, allergies, is a later follow-up). Topic `medications`.

## Status

| Slice | State                                   | Merge into `prd/medications` (slice commits)                                                         |
| ----- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1     | **merged** and landed in `dev` (wave 1) | `41b8930` (slice commit `febd581`); dev sync `fac86c4`, fixes `4bb35ac` `cf80fe4`                    |
| 2     | **merged** and landed (wave 2)          | `d7977c1` (slice commits `3f7e4bd`, `c051eab`)                                                       |
| 3     | **merged** and landed (wave 3)          | `6fc9771` (slice commits `baae79d`, `8e42641`)                                                       |
| 4     | **merged** and landed (wave 2)          | `46c675b` (slice commits `63d73d2`, `a021378`); wording merged into `medicationDisplay` in `25d08d7` |
| 5     | **merged** and landed (wave 4)          | `dc4b099` (slice commits `45bae5b`, `dd4c95b`)                                                       |
| 6     | **merged** and landed (wave 2)          | `72212b8` (slice commit `74388c4`)                                                                   |

Every outside blocker is in `dev`. Wave 1 landed in `dev` as `4bcf119`. Wave 2 (slices 2, 4 and 6, with B-43) merged and synced with `dev` on 2026-11-19 (sync `4115783`: `timeline-polish`'s infinite scroll, with the medication lookup following its window). Slice 3 landed on its own (wave 3), and slice 5 as wave 4 (2026-11-19). **The plan is done.** B-51 (a printable dose checklist) is proposed as a slice 7 after 6; it can reuse slice 6's print CSS and `print:hidden` classes. Slice 3's "Add medication" goes beside the list header's Print link, and the medication page header's `actions` region is empty for its Edit and status actions. Slice 5 adds due slots to `doseChoicesQuery` and the Dose sheet, which already takes `?medication=&slot=` and posts `scheduledFor`. Slice 1's migration is `0013_medications` (regenerated on top of `invites`' 0011 and 0012 at the first sync; its last statement, `ALTER PUBLICATION "powersync" ADD TABLE "medication";`, is hand-written: keep it when regenerating). The sync also gave `invites`' group creation the creating device's time zone (`newGroupFromForm`, `/admin`'s hidden field, `FALLBACK_TIME_ZONE`).

Notes for later slices: slice 2 needs a `createMedicationDocument` device write (the columns are there). Slice 4 appends `dose` and `medicationChange` to `TIMELINE_KINDS` in `lib/timelineFilters.ts` (that removes the `SHOWN_KINDS_SQL` guard's effect), restyles the placeholder `KIND_META` entries, and uses the medications module's writes for doses (`timeline.ts`'s `updateEntry`/`removeEntry` ignore them). The prescriber and pharmacy FKs are `NO ACTION`, not `SET NULL` (Drizzle can't express a column-list `SET NULL`).

Backlog: B-15 is `triaged`. Claim it when slice 1 starts; mark it `done` after the last slice merges. B-26 (allergies) is not part of this plan.

## Architectural decisions

Durable decisions every slice follows:

- **Routes** (children of `routing`'s `/app/groups/:groupId` route, built through `appUrls`):
  - `medications`: the Today section (from slice 5), then the list (`?q=`, `?status=current|completed|discontinued|all`, default current first and the rest below).
  - `medications/new` and `medications/:medicationId/edit`: sheet routes (the `routing` pattern).
  - `medications/:medicationId`: the medication page.
  - `medications/print`: the printable sheet (no app frame when printed).
  - `timeline/new/dose` (optional `?medication=<id>&slot=HH:MM`): the Dose sheet, beside the existing add sheets.
- **Group section:** one `GROUP_SECTIONS` entry, Medications (lucide `Pill`), appended after Providers; `match` claims `/medications/*`.
- **Schema** (one pending migration for the PRD, made in slice 1; regenerate it on top if a sync brings in another):
  - `medication`: as in the PRD (name, strength, form, dose, directions, reason, `schedule` jsonb, status `current | completed | discontinued`, stop date, reason and note, `prescriber_id` and `pharmacy_id` composite FKs to `provider`, refill fields, `deleted_at`, timestamps, audits; unique `(group_id, id)`).
  - `care_recipient` gains `time_zone` (required IANA); `date_of_birth` joins the synced columns.
  - `note_document` gains the `medication` subject and a `medication_id` owner column (cascading composite FK). **No data migration:** reseed.
  - `TIMELINE_ENTRY_KINDS` gains `dose` and `medicationChange` (appended), with their details in the content schema.
- **Change entries** are written by `medicationService` (and by the device's local write) in the same transaction as the medication change, with an id derived from the medication id and its new `updated_at` (UUID v5), so the device's copy and the service's are one row. Only create, status changes and tracked fields (name, strength, form, dose, directions, schedule) write one.
- **Schedule times are in the recipient's time zone.** Missed doses are derived (`dueDoses`), never written.
- **Permissions:** `medication` readable by any member, written by writers; delete is soft. Doses and change entries are timeline entries (writers). Medication documents follow `note_document`.
- **Sync:** `medication` in the `care_groups` stream and the publication (explicit columns; soft-deleted rows included). Writes are local first and upload through `sync.upload`.
- **Registries are appended to, never reordered:** `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the upload switch, the device schema, `TIMELINE_ENTRY_KINDS`, `KIND_META`, `routes.ts`, `GROUP_SECTIONS`.
- **UI building blocks:** slices 2, 3 and 6 use whatever `components` has landed by then (its primitives if its slice 2 is in `dev`, otherwise today's components); `components`' last slice moves any built before the primitives. Slices 4 and 5 use the split timeline and entry form.
- **No new dependencies.** Printing is print CSS and `window.print()`.

## How to run this plan

- **Slice 1 starts once `providers` slice 1 is in `dev`** (it needs the `provider` table and the generalized `note_document`). It touches only `packages/`, `powersync/`, the device schema and seeds. It needs a stack (migration and integration tests).
- **2 after 1 and after `routing` slice 1 lands.** Sync `dev` into `prd/medications` first.
- **3 after 2, `routing` slice 2 and `providers` slice 3** (the sheet pattern, and the provider form for inline add). **6 after 2 and `providers` slice 4** (the provider page); 3 and 6 run in parallel.
- **4 after 1 and after `components` slices 3 and 5 land** (the timeline and entry form splits), so medications never edits the timeline while `components` is splitting it. It can run in parallel with 2, 3 and 6 once they allow.
- **5 after 3 and 4.**
- Merge in number order (6 may merge before 4 and 5 if it's ready first). After each merge, run `medications.mjs` plus the checks the slice's files touch: `live-notes.mjs` (slices 1, 2), `phase2.mjs` and `roundtrip.mjs` (slices 1, 4, 5), `app-shell.mjs` and `routing.mjs` (slice 2, the new section), `providers.mjs` (slices 3, 6). Run `pnpm datastore:reset` and `docker compose restart powersync` after slice 1, and after any sync that brings a migration.
- **Land in waves:** 1 (data); then 2, 3 and 6 (a usable list, page and printout); then 4 and 5 (the timeline and Today).
- Every slice ends with `pnpm check`, `pnpm build:native`, its browser checks and a hand-off (AGENTS.md, _Loop rules_).

```
providers 1 → 1 ── 2 ──┬── 3 ──┐
                │      └── 6   ├── 5
                └────── 4 ─────┘
routing 1 → 2 · routing 2, providers 3 → 3 · providers 4 → 6 · components 3, 5 → 4
```

---

## Slice 1: The data layer

**User stories:** US 11, 29–31, 35, 43, 44, 47. **Blocked by:** `providers` slice 1. **Blocks:** 2, 4.

### What to build

The `medication` table with its Zod schemas (the schedule union, status rules, provider type rules), `PERMISSIONS` entry, model and `medicationService` (create, update, soft remove, status transitions, prescriber must be a clinician or practice and pharmacy a pharmacy, both in the group). The pure `medicationChange(before, after)` and the derived change-entry id; the service writes the `medicationChange` entry in the same transaction. Add the `dose` and `medicationChange` kinds to the content schema, with `timelineEntryService` checking `medicationId` belongs to the entry's group. `care_recipient.time_zone` (seeds and group creation fill it) and synced `date_of_birth`. `note_document`'s `medication` subject, with `noteDocumentService.create` accepting a medication that isn't deleted. One migration, no backfill.

Add `medication` and the new columns to the publication, the `care_groups` stream, the upload switch and the device schema, with local queries (the list with search and status, one medication, its doses and changes, the group's doses for a day, name history) and local writes (create, update, status change, soft remove, each with its change entry in one transaction; log, edit and delete a dose). Fictional seeds in their own file, appended: Grandma Pat's medications (four current, one completed, one discontinued), about a week of doses (a few skipped, one refused) and their change entries; one medication for Dev Family 2; time zones and dates of birth.

### Acceptance criteria

- [ ] Integration tests: every role × medication create, update and delete; status rules (discontinued needs a reason, stopped needs a date, current clears them); provider type and group checks; soft delete hides it from lists.
- [ ] Integration tests: create, a dose change and discontinue each write one `medicationChange` entry in the same transaction with the derived id; a refill-only or provider-only edit writes none; a failed update writes none.
- [ ] Integration tests: a `dose` for another group's medication is refused; a medication document is created, compacts and cascades with its medication; every existing note document test passes unchanged.
- [ ] Upload tests: `medication` PUT, PATCH, DELETE, immutable group; a device-written change entry followed by the medication op ends as one entry.
- [ ] Unit tests: `medicationChange` (each transition, changed fields with before and after, null for untracked edits), the schemas, the derived id, and the seeds (validated like `timelineEntries.test.ts`).
- [ ] After `pnpm datastore:reset` and a PowerSync restart, `window.caretookSync` on a signed-in device shows Dev Family's medications, doses, changes, the recipient's time zone and date of birth; Dev Family 2's member sees only its own.
- [ ] The timeline still renders (it skips the new kinds until slice 4); `live-notes.mjs`, `phase2.mjs` and `roundtrip.mjs` pass unchanged.

---

## Slice 2: The Medications tab, list and page

**User stories:** US 1, 12–14, 33, 41, 44, 45. **Blocked by:** 1, `routing` slice 1. **Blocks:** 3, 5, 6.

### What to build

The Medications section (one `GROUP_SECTIONS` entry) and the `medications` route: the list from local data, live, current first by name and the rest below with their status and stop date. Each row shows name, strength, form, dose, schedule ("8:00 and 20:00", "As needed, up to 4 a day") and reason. Search by name or reason (`?q=`) and a status filter (`?status=`), in the URL. The `medications/:medicationId` page: details, schedule, prescriber and pharmacy (links to their provider pages; contact actions from `providers`), refill details, the medication's live notes (`LiveNotesEditor` on its document, created on the first real change; `EditorAvatars`), and its history: its doses and changes, newest first. Read-only otherwise. Start `medications.mjs`.

### Acceptance criteria

- [ ] The tab bar (420) and header nav (1280) show Medications after Providers, with `aria-current` on the right one.
- [ ] The seeded list shows four current medications first, then the completed and discontinued ones; search and status filter survive a reload.
- [ ] A medication page shows its details, its prescriber and pharmacy as links, and its seeded doses and changes, newest first.
- [ ] Two browsers editing a medication's notes converge; viewers read them.
- [ ] Works offline from the device's copy; a non-member's or a deleted medication's URL is the 404 with no names.
- [ ] Unit tests for schedule wording and list ordering and matching.
- [ ] `medications.mjs` covers the above; `app-shell.mjs`, `routing.mjs` and `live-notes.mjs` pass.

---

## Slice 3: Add, edit, stop, restart and delete

**User stories:** US 2–11, 15–18, 29–31, 42, 43. **Blocked by:** 2, `routing` slice 2, `providers` slice 3. **Blocks:** 5.

### What to build

Sheet routes `medications/new` and `medications/:medicationId/edit`, for writers, over the list or the medication page. The form: name (with `suggestMedicationNames` from the group's medications), strength, form, dose, directions, reason, schedule (scheduled with up to 8 times, or as needed with an optional maximum per day), started on, prescriber and pharmacy (pickers over the group's providers of the right types, with inline add through `providers`' form, writing the provider and the medication together), and refill details. Status actions on the medication page and in the edit sheet: Mark completed, Discontinue (reason required, optional note), Restart, and Delete (with a confirm; soft). Every save goes through the slice 1 local writes, so change entries are written with it. Viewers get no controls, and their sheet URLs show the list.

### Acceptance criteria

- [ ] A writer adds a scheduled medication with a new prescriber added inline; both appear at once and on a second device after sync, and the page's history shows "Started".
- [ ] Typing "lis" suggests a seeded name; picking it fills the name only.
- [ ] Changing the dose writes one "Changed" entry with before and after; editing refills writes none.
- [ ] Discontinue requires a reason and moves it below current; Restart brings it back with a "Resumed" entry; Complete needs no reason.
- [ ] Validation messages show through the form's fields (name required, times unique, maximum in range).
- [ ] Offline add, edit and discontinue sync after reconnecting, with one change entry each.
- [ ] As viewer@, no add, edit or status controls; `…/medications/new` shows the list with no form.
- [ ] Unit tests for `suggestMedicationNames` and the form's parsing.
- [ ] `medications.mjs` covers the above; `routing.mjs` and `providers.mjs` pass.

---

## Slice 4: Doses and changes on the timeline

**User stories:** US 21, 22, 26, 28, 32, 34. **Blocked by:** 1, `components` slices 3 and 5. **Blocks:** 5.

### What to build

`KIND_META` entries for `dose` and `medicationChange` (appended; icons and colors not green and distinct from vitals' pink). Rows and cards render them through the shared entry body: "<Medication> <strength>: Given 1 tablet" (or Skipped or Refused, with the note) and "Started / Changed dose 10 mg → 20 mg / Discontinued: side effects / Resumed"; the medication name opens its page. Kind filter chips and kind icon links include both. The quick-add bar gets **Dose** (writers), opening the `timeline/new/dose` sheet: pick a current medication (most recently given first until slice 5 adds due ones), status (given, skipped, refused), amount (defaulting to the medication's dose), time (defaulting to now), and a note. A dose's row opens its edit sheet for writers (on `routing`'s edit-sheet pattern), with Delete in the ⋯ menu; a change entry's ⋯ menu has Delete only.

### Acceptance criteria

- [ ] Seeded doses and changes show in rows and cards with the right text; filtering by each kind shows only it, and the kind icon filters.
- [ ] A writer logs a dose from quick add; it shows at once and on a second device; editing and deleting it work.
- [ ] Logging at an earlier time places it in the right day.
- [ ] A change entry can be deleted but not edited.
- [ ] As viewer@, no Dose button; rows don't open a sheet.
- [ ] Offline logging syncs after reconnecting.
- [ ] `medications.mjs` covers the above; `phase2.mjs` and `roundtrip.mjs` pass apart from the new kinds.

---

## Slice 5: Today

**User stories:** US 19, 20, 23–25, 27, 35, 44, 48. **Blocked by:** 3, 4. **Blocks:** none.

### What to build

The pure `dueDoses({ medications, doses, now, timeZone })` (slots in the recipient's zone, DST-safe; matching by `scheduledFor`, else the nearest unmatched slot within 2 hours; states upcoming, due, overdue after 60 minutes, given, skipped, refused, missed; as-needed counts and what's left; the double-dose and over-maximum warnings). The **Today** section at the top of `medications`: each due time with its medications and their state, a one-tap **Given** (logs with `scheduledFor` and the medication's dose), and a menu for Skipped and Refused (with an optional note); as-needed medications with "2 of 4 today" and Log; yesterday's missed slots on one line. The **Due now** strip on the timeline (beside `LatestVitals` and the Live now banner), shown only while a slot is due or overdue, each item opening the Dose sheet for that slot. The Dose sheet lists due slots first and shows the warnings before saving. Re-evaluated on a timer (like `useNow`) so states change without a reload.

### Acceptance criteria

- [ ] With a medication due now, the Today section and the Due now strip both show it; one tap on Given logs it, and both update on a second device.
- [ ] Skipped with a note shows as skipped in Today and in the timeline.
- [ ] Logging an as-needed dose past its maximum, or a slot already given, warns before saving and still saves on confirm.
- [ ] With the device in America/New_York and the recipient in America/Los_Angeles, an 8:00 slot is due at 11:00 device time.
- [ ] The strip is absent when nothing is due; viewers see Today and the strip without controls.
- [ ] Unit tests for `dueDoses`: a zone different from the device's, the spring-forward and fall-back days, a late log within the window, `scheduledFor` precedence, overdue and missed boundaries, stopped and deleted medications ignored, as-needed limits, the warnings.
- [ ] `medications.mjs` covers the above; `phase2.mjs` passes with the strip absent and present.

---

## Slice 6: The printable sheet and the provider page's medications

**User stories:** US 36–40, 46. **Blocked by:** 2, `providers` slice 4. **Blocks:** none.

### What to build

The pure `printSheet({ recipient, medications, providers, now })`: the recipient header (name, date of birth, date printed, group name), current medications sorted by name (name, strength, form, dose, directions, schedule, reason, prescriber, started), medications stopped in the last 90 days (stop date, completed or discontinued with reason), and the prescribers and pharmacies used, deduplicated, with their first phone. The `medications/print` route renders it with print CSS (no app frame, black on white, table rows that don't split across pages) and a **Print** button calling `window.print()`, linked from the Medications page. It reads local data only. On the provider page (from `providers`), an appended "Medications" region lists the current medications they prescribe or fill, each opening its page.

### Acceptance criteria

- [ ] The print page shows the seeded current medications, the discontinued one with its reason, the completed antibiotic if within 90 days, the date of birth and the provider phones.
- [ ] A print-media screenshot shows no header, tab bar or buttons, and the table fits the page width at 420 and 1280.
- [ ] It works offline.
- [ ] A seeded prescriber's page lists the medications they prescribe; the pharmacy's lists those it fills.
- [ ] Unit tests for `printSheet`: sorting, the 90-day window, contact dedupe, a missing date of birth.
- [ ] `medications.mjs` covers the above; `providers.mjs` passes.

---

## For the orchestrator

- **Claim:** B-15 when slice 1 starts. Mark it `done` after the last slice merges.
- **Before slices 1, 2, 3, 4 and 6,** check the backlog's PRD table and `dev`: `providers` slice 1 (for 1), `routing` slice 1 (for 2), `routing` slice 2 and `providers` slice 3 (for 3), `components` slices 3 and 5 (for 4), `providers` slice 4 (for 6). Then `pnpm prd sync`.
- **Tell `components`** when slices 2, 3 and 6 land: its last slice moves the medication screens onto the primitives if they were built before them.
- **AGENTS.md at landing:** the two new kinds in the kind definitions, the medication table, `care_recipient`'s time zone, and that the date of birth is now synced (replacing the "isn't synced" note under `careGroup.recipient`).
- B-26 (allergies) is a follow-up, not this plan; the print sheet gets an allergies line when it lands.
