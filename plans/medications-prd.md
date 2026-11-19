# PRD: Medications (the list, schedules, doses and changes in the timeline, a printable sheet)

Status: ✅ done (2026-11-19), all six slices of [`medications-plan.md`](medications-plan.md) in `dev`. Backlog item: B-15. Topic `medications`. Follow-ups: B-26 (allergies), B-51 (a printable dose checklist), a screen to change a recipient's time zone.

## Problem Statement

Caretakers juggle someone else's medications across pharmacies, prescribers and several people giving doses. Today Caretook has nowhere to keep the list: it lives on paper, in a phone note or in one person's head. Nobody can see at a glance what's due today, whether the 8 a.m. dose was given (and by whom), or when a refill runs out. When a dose changes or a medication is stopped, the reason gets lost, and the timeline (where everything else about the recipient's care is) never mentions it. At a visit or in the ER, someone has to rebuild the current list from memory, when what they need is a sheet to hand over.

## Solution

A **Medications** section in each care group:

- **The list:** every medication with its name, strength and form, the dose and directions, the reason it's taken, the prescriber and pharmacy (from the group's providers), refill details (last filled, quantity, refills left, Rx number), and shared **live notes** ("crush into applesauce", "pharmacy needs 3 days' notice"). Each is **current**, **completed** (a course that finished as planned) or **discontinued** (stopped early, with a reason). Current medications come first, then the rest.
- **A simple schedule:** a medication is either **scheduled** (times of day, every day, such as 8:00 and 20:00, in the recipient's time zone) or **as needed** (with an optional maximum per day).
- **Today's doses** show in three places: a **Today** section at the top of Medications (each due time with its medications and a one-tap **Given**, plus Skipped and Refused); a compact **Due now** strip on the timeline when something is due or overdue; and a **Dose** button in the timeline's quick add, which opens a sheet listing due medications first. Missed doses are worked out from the schedule, never written.
- **The timeline records it all:** each dose is a **dose** entry (given, skipped or refused, with the amount and who logged it). Each change to the list (started, changed, stopped, resumed) writes a **medication change** entry automatically, so the timeline is the history. A medication's page lists both.
- **A printable sheet** (`…/medications/print`): the recipient's name and date of birth, a table of current medications, those stopped in the last 90 days with reasons, and the prescriber and pharmacy phone numbers. Printed through the browser (Print, or Save as PDF), and it works offline.

Everything works offline and syncs like the rest of the group's data.

## User Stories

1. As a caretaker, I want a Medications tab in the group, so that the list is one tap away.
2. As a caretaker, I want to add a medication with its name, strength and form, so that the list is precise.
3. As a caretaker, I want name suggestions from medications the group has used before, so that a restart is quick and spelled the same.
4. As a caretaker, I want to record the dose per administration and the directions, so that anyone giving it does it the same way.
5. As a caretaker, I want to record why it's taken, so that we can answer "what's this one for?" at a visit.
6. As a caretaker, I want to pick the prescriber and the pharmacy from the group's providers, so that their phone numbers are one tap away.
7. As a caretaker, I want to add a missing prescriber or pharmacy while adding a medication, so that I don't lose my place.
8. As a caretaker, I want to record last filled, quantity, refills left and the Rx number, so that I know when to call the pharmacy.
9. As a caretaker, I want to schedule a medication at fixed times each day, so that the app knows what's due.
10. As a caretaker, I want to mark a medication as needed with a maximum per day, so that nobody gives too many.
11. As a caretaker, I want schedule times in the recipient's time zone, so that a caretaker in another state sees the same due times.
12. As a caretaker, I want shared notes on each medication that everyone edits together, so that tips like "with food" live with the medication.
13. As a caretaker, I want current medications first and stopped ones below, so that the list I need is on top.
14. As a caretaker, I want to search and filter the list by status, so that I can find an old medication.
15. As a caretaker, I want to mark a medication completed when a course ends, so that it leaves the current list.
16. As a caretaker, I want to discontinue a medication with a reason (side effects, not working, prescriber stopped it, other), so that the reason isn't forgotten.
17. As a caretaker, I want to restart a stopped medication, so that I don't re-enter it.
18. As a caretaker, I want to delete a medication added by mistake, so that the list stays clean.
19. As a caretaker, I want a Today section listing each due time with its medications and their state (upcoming, due, overdue, given, skipped, refused, missed), so that I know what's left to give.
20. As a caretaker, I want to log a due dose as given in one tap, so that logging takes no effort.
21. As a caretaker, I want to log a dose as skipped or refused, with an optional note, so that the record is honest.
22. As a caretaker, I want to log a dose at a time other than now, so that I can catch up later.
23. As a caretaker, I want to log an as-needed dose and see how many are left today, so that I stay under the maximum.
24. As a caretaker, I want a warning (not a block) when logging an as-needed dose past its maximum, or a scheduled dose that was already given, so that double doses are caught.
25. As a caretaker, I want a Due now strip on the timeline when something is due or overdue, so that I see it without switching tabs.
26. As a caretaker, I want a Dose button in the timeline's quick add, so that logging a dose works like logging a vital.
27. As a caretaker, I want the Dose sheet to list due medications first, so that the common case is one tap.
28. As a caretaker, I want each dose to appear in the timeline with the medication, amount, state and who logged it, so that the day's story is complete.
29. As a caretaker, I want starting, changing, stopping and restarting a medication to appear in the timeline automatically, so that I can see when the dose went up relative to a symptom.
30. As a caretaker, I want a change entry to say what changed (old dose → new dose) and why, so that it reads on its own.
31. As a caretaker, I want refill updates kept out of the timeline, so that it isn't cluttered.
32. As a caretaker, I want to filter the timeline to doses or to medication changes, so that I can review adherence or history.
33. As a caretaker, I want a medication's page to show its details, notes, schedule, and its doses and changes newest first, so that its whole history is in one place.
34. As a caretaker, I want to edit or delete a dose I logged wrongly, so that the record is right.
35. As a caretaker, I want missed doses worked out, not written, so that two devices never record the same miss twice.
36. As a caretaker at a visit, I want to print the current list, so that I can hand it over.
37. As a caretaker, I want the printout to include the recipient's name and date of birth and the date printed, so that it's identifiable and dated.
38. As a caretaker, I want the printout to include medications stopped in the last 90 days with reasons, so that the clinician sees recent changes.
39. As a caretaker, I want the prescriber and pharmacy phone numbers on the printout, so that staff can call them.
40. As a caretaker, I want to print offline, so that it works in a basement waiting room.
41. As a viewer, I want to see the list, today's doses and the printout, so that I stay informed.
42. As a viewer, I want no add, edit or log controls, so that I'm not shown actions I can't take.
43. As a caretaker offline, I want to add, change and log doses, so that they sync when I reconnect.
44. As a caretaker, I want doses logged on another device to show at once, so that two people don't give the same dose.
45. As a non-member, I want medication URLs to be the same 404 that shows nothing, so that nothing leaks.
46. As a provider's viewer, I want the provider's page to list the medications they prescribe or fill, so that I can see who's responsible for what.
47. As a developer, I want medication changes written in the same transaction as the medication, so that the timeline never misses one.
48. As a developer, I want due-dose logic in one pure module, so that the strip, Today and the sheet agree.

## Implementation Decisions

- **Depends on, by part:**
  - **Data layer:** `providers` slice 1 (the `provider` table for prescriber and pharmacy, and `note_document`'s generalized subjects). It can run as soon as that's in `dev`, in parallel with screens elsewhere.
  - **Screens:** `routing` (the group route, `appUrls`, the sheet route pattern) and, where landed, `components`' primitives. Screens built before `components` lands move onto the primitives in `components`' last slice, as providers' do.
- **Schema (one migration):**
  - **`medication`:** `id`, `group_id`, `recipient_id` (composite FK to `care_recipient`, like entries), `name`, `strength` (text, e.g. "10 mg"), `form` (`tablet | capsule | liquid | injection | patch | inhaler | drops | cream | other`), `dose` (text, e.g. "1 tablet"), `directions`, `reason`, `schedule` jsonb, `status` (`current | completed | discontinued`), `started_on` and `stopped_on` (dates), `stop_reason` (`sideEffects | ineffective | prescriberStopped | other`) and `stop_note`, `prescriber_id` and `pharmacy_id` (nullable composite FKs to `provider`, `ON DELETE SET NULL` on the column; soft-deleted providers stay linked and show greyed), `last_filled_on`, `quantity` (text), `refills_left` (integer ≥ 0), `rx_number`, `deleted_at`, `timestamps`, `audits`, unique `(group_id, id)`.
  - **`schedule`** is a Zod union: `{ type: "scheduled", times: ["08:00", "20:00"] }` (1–8 times, `HH:MM`, unique and sorted) or `{ type: "asNeeded", maxPerDay?: 1–24 }`.
  - **Rules:** `discontinued` requires a `stop_reason`; `completed` and `discontinued` require `stopped_on`; `current` clears the stop fields. `prescriber_id` must point at a clinician or practice, `pharmacy_id` at a pharmacy, in the same group.
  - **`care_recipient` gets `time_zone`** (IANA, required, defaulting to the zone of the device that creates the group; seeds use America/Los_Angeles) and **`date_of_birth` joins the synced columns**.
  - **`note_document`** gains the subject `medication` with a nullable `medication_id` owner column (cascading composite FK), on the same exactly-one-owner check as providers. No data migration: reseed.
  - **Two new entry kinds**, appended to `TIMELINE_ENTRY_KINDS`:
    - **`dose`:** `details = { medicationId, status: given | skipped | refused, amount?, scheduledFor? ("HH:MM", the slot it answers), note? }`. The title is empty; the display name comes from the medication.
    - **`medicationChange`:** `details = { medicationId, change: started | changed | stopped | resumed, fields?: [...changed field names], before?, after? (summaries of name, strength, dose, schedule), stopStatus?, stopReason?, stopNote? }`.
    - Both have no body. `medicationId` must be a medication in the entry's group (checked by the service and the device), and `deleted_at` on the medication doesn't delete its entries. Their content goes into the existing per-kind content schema.
- **Kinds, placed** (the kind definitions in AGENTS.md get both):
  - **Dose:** a medication was **given, skipped or refused** at a time. Not a vital (it's not measured) and not an event.
  - **Medication change:** a change to the list, written automatically. It's never created or edited by hand; deleting one is allowed (writers), as a correction.
- **Permissions:**
  - `medication`: read and list for any member; create, update and delete for writers (delete is soft).
  - Medication documents follow `note_document`'s rules.
  - `dose` entries follow `timeline_entry`'s (writers).
  - Group and recipient ids are immutable except by `system`.
- **Services:**
  - `medicationService`: create, update, soft remove, status transitions, provider type checks.
  - **Change entries:** `create`, a status change and an update that changes a tracked field (name, strength, form, dose, directions, schedule) each write a `medicationChange` entry **in the same transaction**, through the pure `medicationChange(before, after)`. Refill, supply, reason and provider edits write none.
  - **Change entry ids are derived** (UUID v5 of the medication id and its `updated_at` after the change), so the device and the server write the same row, and an upload that replays the change is idempotent.
  - `timelineEntryService` accepts `dose` and `medicationChange` with the medication check.
- **Sync:**
  - `medication` joins the `care_groups` stream (explicit columns, soft-deleted rows included) and the publication.
  - `care_recipient`'s query adds `time_zone` and `date_of_birth`, and `note_document`'s adds `medication_id`.
  - The upload switch adds `medication` (PUT → upsert, PATCH → update or soft remove, DELETE → remove; changing the group is `immutable`).
  - The device writes the medication and its change entry in one local transaction. On upload, the medication op goes through the service, which writes the same change entry (same derived id). The entry's own PUT is then an idempotent upsert.
  - All additions append to their registries.
- **Device:**
  - Device schema entries and local queries: the list with search and status filter, one medication, its doses and changes, today's doses for the group, and name history.
  - Local writes validate with the shared schemas and check the role, as `timeline.ts` does.
  - Adding a provider from the medication form writes the provider and the medication together.
- **Pure modules:**
  - **`dueDoses({ medications, doses, now, timeZone, overdueAfterMinutes = 60, windowMinutes = 120 })`:** expands current scheduled medications into today's slots in the recipient's zone (DST-safe), and matches dose entries to slots (by `scheduledFor`, else the nearest unmatched slot within the window).
    - Each slot is labelled `upcoming` (before its time), `due` (from its time), `overdue` (after `overdueAfterMinutes`), `given | skipped | refused` (matched), or `missed` (unmatched once the recipient's day has ended; shown on the Today section's "Yesterday" line only).
    - As-needed medications report today's count and how many are left.
    - It also gives the warnings: an as-needed dose past its maximum; a slot already given.
  - **`medicationChange(before, after)`** → change details or null.
  - **`printSheet({ recipient, medications, providers, now })`** → the sheet's view model: current medications sorted by name; stopped medications within 90 days, with dates and reasons; the prescribers and pharmacies used, deduplicated, with their primary phones.
  - **`suggestMedicationNames(typed, groupMedications)`:** case-insensitive prefix, then word, matches over the group's medications (any status), deduplicated, at most 5.
- **Routes** (children of the group route, built through `appUrls`):
  - `medications`: the Today section, then the list.
  - `medications/new` and `medications/:id/edit`: sheets, on routing's sheet pattern.
  - `medications/:id`: details, schedule, live notes, history.
  - `medications/print`.
  - `timeline/new/dose`: the Dose sheet, with an optional `?medication=<id>&slot=HH:MM`.
- **Group section:** one `GROUP_SECTIONS` entry, Medications (lucide `Pill`), appended after Providers; `match` claims `/medications/*`.
- **Timeline:**
  - `KIND_META` gets `dose` and `medicationChange` (icons and colors appended; not green, and distinct from vitals' pink).
  - Rows and cards render "<Medication> <strength>: Given 1 tablet" and "Started / Changed dose 10 mg → 20 mg / Discontinued: side effects".
  - Kind filter chips include both kinds.
  - The Due now strip sits beside the other strips (`LatestVitals`, `LiveNowBanner`) and shows only when a slot is `due` or `overdue`. Each item opens the Dose sheet for that slot, for writers; viewers see it read-only.
  - Quick add gets **Dose** (writers).
- **Print page:**
  - Print CSS only: no app frame, black on white, a table that breaks cleanly across pages, and the date printed.
  - A **Print** button calls `window.print()`.
  - No new dependency. It reads local data only, so it works offline.
- **Provider page** (from `providers`): a "Medications" list of the current medications it prescribes or fills (appended region).
- **Seeds** (their own file, append-only):
  - Fictional medications for Grandma Pat:
    - four current: two scheduled (one twice daily), one as needed, one with refills;
    - one completed antibiotic;
    - one discontinued for side effects.
  - About a week of dose entries, with a few skipped and one refused, plus their change entries.
  - Dev Family 2 gets one medication.
  - The recipients get time zones and dates of birth.
- **Hot files:** `TIMELINE_ENTRY_KINDS` and the content schema, `KIND_META`, the timeline's strips and quick add, `sync-config.yaml`, the upload switch, `PERMISSIONS`, `db/schema/index.ts`, the device schema, `GROUP_SECTIONS`, `routes.ts`, `care_recipient`, `note_document` (migration), and the provider page. Keep one pending migration for the PRD.

## Testing Decisions

- A good test checks behavior a user or caller sees (what's due, what an entry says, what the service returns or refuses), not internals.
- **Unit (`data:unit` and `web:unit`):**
  - `dueDoses`: slots in a zone different from the device's; the spring-forward and fall-back days; a late log matched by the window; `scheduledFor` taking precedence; overdue and missed boundaries; completed, discontinued and deleted medications ignored; as-needed counts and the maximum; the double-dose warning.
  - `medicationChange`: each transition; which fields changed, with before and after; null for refill-only and provider-only edits.
  - The Zod schemas: the schedule union, the status rules, provider type rules, and the dose and change details.
  - `printSheet`: sorting, the 90-day window, contact dedupe.
  - `suggestMedicationNames`.
  - Prior art: `titleSuggestions.test.ts`, `format.test.ts` (`dayLabel` across DST), `vitals.test.ts`, `timelineEntry.test.ts`.
- **Integration (`*.int.test.ts`):**
  - `medicationService`: every role × create, update and delete; status rules; provider type and group checks; **a change entry is written in the same transaction**, with the derived id, and not for refill edits; soft delete hides it from lists.
  - `timelineEntryService` for `dose` (a medication from another group is refused).
  - The generalized `noteDocumentService` for a medication document.
  - The upload switch for `medication`, including the replayed change entry being idempotent.
  - Prior art: the provider and timeline integration tests, and `fixtures.ts`.
- **Seeds:** a test validates every medication, dose and change seed against the schemas.
- **Browser check `medications.mjs`:**
  1. Add a scheduled medication with a new prescriber inline, and add an as-needed one.
  2. The Today section shows the due slot.
  3. Log a dose as Given from Today, and see it on a second browser and in the timeline.
  4. Log from the Due now strip and from the quick-add Dose sheet.
  5. Skipped with a note.
  6. The as-needed maximum warning.
  7. Change the dose and see the change entry.
  8. Discontinue with a reason; restart.
  9. Medication live notes merge between two browsers.
  10. The print page lists current and recently stopped medications with the date of birth and phones (checked through the DOM, plus a print-media screenshot).
  11. Offline: add a medication and log a dose, then reconnect and both sync.
  12. A viewer is read-only.
  13. A non-member gets a 404.

  Chrome is pinned to America/Los_Angeles, and a second run sets the device to America/New_York to check the recipient's zone. It's order-independent and self-cleaning, like the other checks. `phase2.mjs`, `roundtrip.mjs` and `live-notes.mjs` must pass unchanged apart from the new kinds and strip.

## Out of Scope

- **Allergies** (filed as their own backlog item; the print sheet gets them when that lands).
- Reminders and notifications for due doses (needs the notifications work), and refill reminders.
- Complex schedules: every N days, weekdays, tapers, per-schedule start and end dates, time-of-day ranges.
- A drug database lookup (e.g. RxNorm), interaction checks, and dose calculation.
- Generated PDFs (`@react-pdf/renderer`) and pharmacy integrations (e-refill).
- Inventory counting (pills left from doses given).
- Charts of adherence (later, with the assistant or a reports PRD).

## Further Notes

- Source: B-15 ("Work on medication list management and tracking in timeline"), with the dev keeper's note that a dose is a new kind, not a vital, and that prescriber links depend on providers.
- Interview decisions (2026-11-18):
  - Fields: name, strength, form, dose, directions, reason, prescriber and pharmacy, refills.
  - Schedules: a simple schedule (daily times, or as needed with a maximum).
  - Doses: a new `dose` kind. Changes: a separate `medicationChange` kind, written automatically.
  - Statuses: current, completed, discontinued.
  - Today's doses: the Today section, the timeline strip and the quick-add Dose sheet.
  - Missed doses: derived, not stored.
  - Names: free text with group suggestions.
  - Notes: live notes per medication.
  - Allergies: out of v1, filed in the backlog.
  - Roles: writers log doses.
  - Time zone: the recipient's zone.
  - Printing: a print page with print CSS.
  - The date of birth is now synced, so printing works offline.
- **Syncing the date of birth** puts it on every member's device. AGENTS.md's `careGroup.recipient` note (date of birth not synced) changes when this lands.
- Health-data rules apply: medications are care data, never in notification subjects, and never seen by staff by default.
