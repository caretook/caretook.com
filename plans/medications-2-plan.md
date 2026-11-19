# Plan: Medications 2

> Source PRD: [`plans/medications-2-prd.md`](medications-2-prd.md). User-story numbers (US) refer to it. Backlog items B-76 (passes), B-86 (the medication strip), B-51 (the weekly sheet), B-26 (allergies). Topic `medications-2`.

## Status

| Slice | State                           | Merge into `prd/medications-2` (slice commits)  |
| ----- | ------------------------------- | ----------------------------------------------- |
| 1     | merged                          | d92771a (05033d4, 9f776b7, 1b52df3)             |
| 2     | merged                          | 79b6edd (38649d2, fe4896e)                      |
| 3     | merged                          | eff620e (6938aaf, c74c009, 1b1efa5); B-26 ready |
| 4     | in progress                     |                                                 |
| 5     | blocked by 4 (B-78 is in `dev`) |                                                 |
| 6     | blocked by 4                    |                                                 |
| 7     | in progress (B-51 claimed)      |                                                 |

**Landing mode: run everything through** (queued with `pnpm prd queue`): start every ready slice, land each green wave without asking, clean up; ask only real questions.

**Landing:** this PRD has a migration, so per the user's standing preference (from `profiles`) it lands **once, after every slice is merged**, with one full suite run then (ask the user before starting `--suite`). Slice 1 left the seeded medications on time slots; slice 2 moves them onto passes. Slice 3 adds a PATCH on `care_recipient` limited to `no_known_allergies_at`.

Backlog: B-76, B-86, B-51 and B-26 are `triaged`. Claim B-76 when slice 1 starts, B-26 with slice 3, B-51 with slice 7, B-86 with slice 5. Mark each `done` after its last slice merges (B-76 after slice 6). The PRD and this plan are on `plan/medications-2` until they land in `dev`.

Fold into AGENTS.md at the final landing (into _Medications_): passes (the table, the rules, default passes, the Passes screen), the schedule's slots and the old-shape read, `duePasses` and Given all with Undo, pass logs on the timeline and the pass sheet, the medication strip (replacing _Due now_), the weekly sheet, allergies (the table, the recipient flag, the warning), both tables in the permissions table, and the stream and upload switch entries.

## Architectural decisions

Durable decisions every slice follows:

- **Passes** are a synced table, `medication_pass`: `group_id`, `recipient_id` (composite FK to `care_recipient`), `name`, `time` (`HH:MM` in the recipient's zone), `sort_order`, `deleted_at`, timestamps and audits; unique `(group_id, id)`. Live names are unique per group, case-insensitive; at most 8 live passes per group.
- **Allergies** are a synced table, `recipient_allergy`: `group_id`, `recipient_id` (composite FK), `substance`, `reaction` (optional), `severity` (`mild | moderate | severe | unknown`), `deleted_at`, timestamps and audits; unique `(group_id, id)`. `care_recipient` gains one nullable column, `no_known_allergies_at`, cleared when an allergy is added.
- **One migration for the PRD**, made in slice 1: both tables, the recipient column and the publication (hand-written `ALTER PUBLICATION` at its end; keep it when regenerating). Regenerate it on top if a sync brings in another PRD's migration, and reread its SQL order.
- **Permissions** for both tables, like `medication`: any member reads; writers (owner, admin, caretaker) create, update and soft-delete; group and recipient ids are immutable. `no_known_allergies_at` follows `care_recipient`'s update rule.
- **Sync:** both tables in the `care_groups` stream (soft-deleted rows included, explicit columns), the publication, the device schema and the upload switch (PUT upsert, PATCH update or soft remove, DELETE soft remove; a changed group or recipient is `immutable`). The recipient's new column is added to the stream query and the device schema.
- **The schedule** is `{ type: "scheduled", slots: [{ passId, amount? } | { time, amount? }] }` (1–8 slots, no repeated pass or time) or the unchanged `asNeeded`. **Every read goes through one normaliser** that also accepts the old `{ type: "scheduled", times }` (as time slots), because older builds may upload it; writes use the new shape only.
- **Pass changes:** a time change writes one `medicationChange` entry with a new `passMoved` variant (pass id, name, before and after time, the medication ids), id a UUID v5 of the pass and the moment. Deleting a pass turns its slot into `{ time, amount }` in every live medication's schedule, in the same transaction, with no change entries for those. The device does both in one local transaction; the service repeats them idempotently on upload.
- **Default passes:** Morning 08:00 and Evening 20:00 for every new group, through one helper called by every create path (`careGroupService.create`, the access-code redemption, the staff create). Seeds add them to both groups and move seeded medications onto them. No backfill for existing rows (dev data only).
- **Dose details** gain optional `passId` and `passLogId` (shared by every dose of one round). `scheduledFor` stays the slot's time. jsonb, so no timeline migration.
- **Due logic:** `dueDoses` keys a slot by its pass when it has one, so a retimed pass keeps its answered doses; a dose answers a pass slot by `passId` first, then by `scheduledFor`. `duePasses` rolls slots up into passes (a one-off time is a pass of one). Today, the strip, the Dose sheet and Upcoming all read `duePasses`; `doseWarnings` stays per medication.
- **Routes** (children of the group route, built through `appUrls`):
  - `medications/passes`: the Passes screen (writers edit, viewers read).
  - `medications/allergies`: the allergies sheet (writers only), a child of the medications list; opened from the list and from a medication's page, and closing returns there through link state.
  - `timeline/pass/:passLogId/edit`: the pass sheet, a child of the timeline like the dose edit sheet; its guard sends viewers and missing or fully deleted logs to the timeline (filters kept).
  - `medications/print/week?start=YYYY-MM-DD`: the weekly sheet (start defaults to this week's Monday in the recipient's zone).
- **Pure modules** (one home each, unit tested): pass rules, schedule slots and normaliser, `dueDoses` with passes and `duePasses`, `givenAllWrites`, `groupPassLogs` and `passLogText`, `medicationStripText`, `weeklySheet`, `allergyMatches`, plus the wording in `medicationDisplay`.
- **Registries are appended to, never reordered:** `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the upload switch, the device schema, `routes.ts`, `appUrls`, `check-areas`.
- **UI building blocks:** `components/ui/` primitives and feature folders only (AGENTS.md, _Components_). Undo is one shared hook and one polite `role="status"` line, used by the strip, Today and the Dose sheet.
- **No new dependencies.**

## How to run this plan

- **Slice 1 can start now.** It touches `packages/`, `powersync/`, the device schema, the seeds and new route folders, and needs a stack.
- **2 and 3 after 1, in parallel.** 2 owns the medication form's schedule, the schedule wording and `dueDoses`; 3 owns the allergy routes, region and the printed list's allergies block. They share only `appUrls`, `routes.ts` and `check-areas` (additive).
- **4 and 7 after their blockers, in parallel.** 4 owns Today, the Dose sheet and Upcoming's due doses; 7 owns the weekly print route.
- **5 and 6 after 4, in parallel.** 5 owns the timeline header's strip; 6 owns `TimelineEntryList`'s grouping, rows and cards for pass logs, and the pass sheet. Both touch the timeline route folder: keep 5 to the strip region and 6 to the list.
- **5 waits for B-78 (quick-fixes) to land in `dev`**: sync `dev` first and follow its strip style. If `care-periods` slice 3 is running at the same time, both change the timeline header and `TimelineEntryList`: land a small regions split first (the hot-files rule).
- Merge in number order (2 and 3, 4 and 7, 5 and 6 in either order within their wave). Per AGENTS.md's _Browser check budget_, loops run `pnpm prd browser --changed` before hand-off and the orchestrator runs the suite once at landing. Run `pnpm datastore:reset` and `docker compose restart powersync` after slice 1, and after any sync that brings a migration.
- **Land in waves:** 1; then 2 and 3; then 4 and 7; then 5 and 6.
- Every slice ends with `pnpm check`, `pnpm build:native`, its browser checks and a hand-off (AGENTS.md, _Loop rules_).
- Browser checks extend `medications.mjs` (slices 1–4, 6, 7, with tagged, clock-independent passes cleaned up at the end) and `phase2.mjs` (slices 5 and 6). Each slice adds `check-areas` rules for its new route folders and modules.

---

## Slice 1: Passes and the Passes screen

**User stories:** US 1–11. **Blocked by:** none. **Blocks:** 2, 3.

### What to build

The PRD's migration: `medication_pass`, `recipient_allergy` and `care_recipient.no_known_allergies_at`, with permissions, models, services, sync streams, the publication, the device schema and the upload switch for both tables (the allergy service and screens come in slice 3; this slice only makes the table sync). The schedule's new `slots` shape with the normaliser, read everywhere schedules are read today (existing medications become time slots with no visible change). Default passes on every group-create path, and in the seeds.

The Passes screen at `medications/passes`, linked from the medications list header: passes in order with their times and the medications in each. Writers add, rename, retime, reorder and delete (a `ConfirmDialog` saying the medications keep the time). A retime moves every medication in the pass and writes the `passMoved` change entry, which the timeline shows ("Morning moved 08:00 → 08:30") like other medication changes. Delete rewrites schedules to time slots. Works offline (local writes), and a second device sees changes live. Viewers read only.

### Acceptance criteria

- [ ] The migration creates both tables and the column; the publication includes both tables; the stream and device schema carry them.
- [ ] New groups (every create path) and both seeded groups have Morning 08:00 and Evening 20:00.
- [ ] A schedule stored or uploaded in the old `times` shape reads as time slots everywhere; new writes use `slots`.
- [ ] Writers can add, rename, retime, reorder and delete passes offline; names are unique per group (case-insensitive) and at most 8 live passes exist.
- [ ] A retime writes one `passMoved` entry shown on the timeline; deleting a pass turns its slots into times with amounts kept, in one transaction on device and server.
- [ ] Viewers see the screen without controls; another group's pass is refused on upload.
- [ ] Unit tests for pass rules and the schedule normaliser; integration tests for the pass service, upload of both tables and default passes; `medications.mjs` steps for the Passes screen.

---

## Slice 2: Passes in medication schedules

**User stories:** US 12–18. **Blocked by:** 1. **Blocks:** 4, 7.

### What to build

The medication form's schedule: a check box for each pass, each with an optional amount (the medication's dose is the placeholder), plus "Add another time" for one-off times with their own optional amount; as needed is unchanged. The schedule's wording everywhere it's shown (list, medication page, printed list): "Morning and Evening", "Morning (1000 mg), Evening (500 mg)", one-off times after passes. Change entries for schedule edits name passes ("Added to Evening", "Morning amount 500 mg → 1000 mg").

`dueDoses` takes passes: pass slots fall at the pass's time, are keyed by pass, and a dose answers them by `passId` first, then by `scheduledFor`, so a retimed pass keeps today's answered doses. Today, Due now and the Dose sheet keep working as they do now (per medication) on top of it; grouping comes in slice 4.

### Acceptance criteria

- [ ] Writers can schedule a medication by passes and one-off times, with an amount per slot, offline; saved schedules use `slots`.
- [ ] Schedule text on the list, the page and the printed list reads in passes, with amounts when they differ.
- [ ] Schedule change entries name passes and amounts.
- [ ] After a pass is retimed, a dose already logged for it today still answers it, and the new time is due.
- [ ] Unit tests for slot amounts, schedule wording, change wording and `dueDoses` with passes (retime, DST day, old-shape schedule); `medications.mjs` steps for the form.

---

## Slice 3: Allergies

**User stories:** US 51–58. **Blocked by:** 1. **Blocks:** 7.

### What to build

The allergy service (create, update, soft delete; adding one clears "No known allergies") and the device writes. An allergies region at the top of the medications list and each medication's page: "Allergies: Penicillin (hives, severe) · Sulfa", or "No known allergies", or, while nothing is recorded, "Allergies not recorded" with "Add allergies" for writers. The allergies sheet at `medications/allergies` (writers): add, edit and remove allergies (substance, reaction, severity), and "No known allergies". The printed medication list gets an allergies block at its top.

The allergy warning: `allergyMatches` on the medication form's name, shown as the name `Field`'s warning ("Matches an allergy on file: Penicillin (severe)"), never blocking Save.

### Acceptance criteria

- [ ] Writers can add, edit and remove allergies and record "No known allergies" offline; adding an allergy clears it; a second device sees changes live.
- [ ] The region shows on the list and each medication's page, in all three states; viewers get no controls.
- [ ] The printed list shows allergies at the top, in print media, offline.
- [ ] Adding or renaming a medication that matches an allergy shows the warning and still saves.
- [ ] Unit tests for `allergyMatches` (folding, whole words, no partial-word match); integration tests for the service and its permissions; `medications.mjs` steps for the sheet, the region, the print block and the warning.

---

## Slice 4: Given all

**User stories:** US 19–29. **Blocked by:** 2. **Blocks:** 5, 6.

### What to build

`duePasses` (each pass's state: upcoming, due, overdue, partly done, done; its open medications; who logged each answered one) and `givenAllWrites` (the doses for every open medication: given, now, the slot's amount, `passId`, one new `passLogId`, `scheduledFor`).

Today groups by pass: name, time, state badge, who logged what, **Given all** for writers, and an expand with each medication's Given, Skipped and Refused (the existing note dialog). After Given all, the shared Undo status shows "Morning logged · Undo" for about 10 s; Undo soft-deletes exactly the doses it wrote. Partial rounds log only open medications, and per-medication marks within a pass carry the pass's `passId` and `passLogId`, so the round stays one log. The Dose sheet lists due passes first (Given all, and each medication's status inside), then single medications as now. Upcoming's due doses show a pass as one row. Warnings stay per medication. One-off times act as a pass of one.

### Acceptance criteria

- [ ] Given all logs every open medication in a due pass in one local transaction, offline, and a second device shows the pass done within seconds.
- [ ] Undo within about 10 s removes exactly those doses; after it, the pass is open again.
- [ ] A medication logged earlier is skipped by Given all; Today shows who logged it.
- [ ] Marking one medication skipped or refused, then Given all for the rest, makes one log.
- [ ] The Dose sheet offers due passes; Upcoming shows passes as one row each; viewers see states without controls.
- [ ] Unit tests for `duePasses` and `givenAllWrites` (partly done, overdue, yesterday's missed, one-off times); `medications.mjs` steps for Today, Undo, the Dose sheet, offline and a second device.

---

## Slice 5: The medication strip

**User stories:** US 37–42. **Blocked by:** 4, and B-78 landing in `dev`. **Blocks:** none.

### What to build

The strip replaces the Due now strip in the timeline header, in B-78's style and size: one line, always shown while the group has scheduled medications. Idle: "Next: Evening · 8:00 PM · 4 meds" (quiet). Due: amber, with Given all for writers (the slice 4 path and Undo). Overdue: red, taking the line's place when an earlier pass is still open. The pass name opens the Dose sheet on that pass (filters kept). The zone note when the device is elsewhere. Viewers get text. Hidden for groups without scheduled medications.

### Acceptance criteria

- [ ] The strip shows next, due and overdue states at the right moments (clock-independent check slots), on one line at 420 px.
- [ ] Given all from the strip logs the pass and shows Undo; the strip moves to the next pass.
- [ ] The pass name opens the Dose sheet on that pass; viewers see text only; a group with no scheduled medications shows no strip.
- [ ] Unit tests for `medicationStripText`; `phase2.mjs` steps for the strip (writer, viewer, hidden) and the Due now strip's old steps updated.

---

## Slice 6: Pass logs on the timeline

**User stories:** US 30–36. **Blocked by:** 4. **Blocks:** none.

### What to build

`groupPassLogs` folds the doses sharing a `passLogId` within a day into one row at the earliest dose's time, in rows and cards: "Morning: 3 given, 1 refused", expandable to each medication. A dose without a `passLogId` stays its own row. The dose kind filter shows pass rows. Paging counts a pass log as one item, so a log is never split across pages.

Tapping the row opens the pass sheet at `timeline/pass/:passLogId/edit` for writers: each dose's status, amount, note and time (through the existing dose writes), "Add a medication" (a dose in the same log), and "Delete this log" (a `ConfirmDialog`, soft-deleting every dose in it). Viewers get the expanded row only.

### Acceptance criteria

- [ ] A round logged together is one row in rows and cards; a single dose is unchanged; the dose filter includes pass rows.
- [ ] A log is never split by paging, including at the beginning of the timeline.
- [ ] Writers can change, add to and delete a log from the pass sheet, offline; the guard sends viewers and missing logs to the timeline.
- [ ] Unit tests for `groupPassLogs`, `passLogText` and the paging rule; `phase2.mjs` and `medications.mjs` steps for the row and the sheet.

---

## Slice 7: The weekly bedside sheet

**User stories:** US 43–50. **Blocked by:** 2, 3. **Blocks:** none.

### What to build

`weeklySheet` and the print route `medications/print/week?start=`: the recipient, the group, the week (seven days in the recipient's zone, DST-safe), the allergies block, then a row per pass and medication (passes in order, medications by name, one-off times after passes) with strength and the slot's amount, and seven cells each with a check box and room for initials; then blank rows for as-needed medications with space for the time. A week picker (this week by default, previous and next). The medications list's Print link becomes a two-item Print menu (Medication list, Weekly chart). Landscape through `@page`, the existing print CSS, local data only, so it works offline.

### Acceptance criteria

- [ ] The sheet lists every current scheduled medication under its passes, with amounts, and the allergies at the top.
- [ ] The week picker changes the start; days are right across a DST change in the recipient's zone.
- [ ] A usual list (Grandma Pat's seeds) fits one landscape page in print media at 1280; it prints black on white in both themes, offline.
- [ ] The Print menu offers both sheets.
- [ ] Unit tests for `weeklySheet` (order, amounts, as-needed rows, DST week); `medications.mjs` steps for the sheet in print media at 420 and 1280, and offline.
