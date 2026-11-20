# PRD: Care periods (where care happens, over time)

Topic `care-periods`, backlog B-50. Interviewed 2026-11-19.

Depends on `timeline-polish` (done: day sections, infinite scroll, filters), `providers` (done: the place picker), `appointments` (done: the timeline's strips, `allDay`). The last part (a period filter in search) depends on `search` slices 2 and 3.

## Problem Statement

A care recipient's life moves between settings: at home, then the emergency room, admitted to hospital, a few weeks of rehab, home again, later hospice at home. These changes explain everything else on the timeline. A run of low blood pressure readings means one thing at home and another on a cardiac ward; a dose skipped "because the nurse gave it" only makes sense if you know she was in the hospital that week.

Today Caretook has no idea where the recipient is. Caretakers write "Admitted to Mercy General" as an event and hope everyone scrolls to it. Someone opening the app after a few days away can't see at a glance that Grandma is in rehab now, since when, or where that is. Nobody can look back at "the hospital stay in March" as a unit, and there is nowhere to keep the things that belong to a stay rather than a day: the discharge instructions, the facility's visiting hours, the room number, the unit's phone.

The coming assistant will need this context too: a summary of a day or a question about "while she was in rehab" depends on knowing when that was.

## Solution

A **care period** is a span of time in one care setting: Home, Hospital, Rehab or skilled nursing, and so on. A care group has **one track** of periods: they follow each other with no gaps and no overlap. Starting a new period ends the current one at that moment, and the latest period runs until now. Care never "ends" on the track; the last period is always current.

- **Each period has** a type from a fixed list, an optional label ("Mercy General, cardiac unit"), an optional place (a provider from the directory, such as a hospital or facility, plus free text for a room or bed), a start date with an optional time (in the recipient's time zone), and its own **live notes**, like a provider or a medication.
- **On the timeline**, a one-line **current-period line** in the header says where the recipient is now: "In hospital · Mercy General · day 4", linking to the period. Writers get **Change** on it, which opens the start sheet. With no periods yet, writers see "Where is Pat now? Add care period"; viewers see nothing.
- **Boundary markers** sit in the timeline at the moment each period started: one row, "Home → Hospital · Mercy General, room 412 · 14:20", with the new type's icon. The first period reads "Started: Home". A marker opens its period. Markers show with any kind or author filter on: they're context, not entries.
- **In the app header**, the group menu's trigger shows the current period's type icon after the recipient's name (its name as the icon's accessible text and tooltip). The open menu has "Now: In hospital · day 4", linking to the period.
- **A periods page** for the group lists every period, newest first, with dates and lengths, and "Add period" for writers (also for filling in earlier periods). It is opened from the current-period line and the group menu; it is not a tab.
- **A period page** shows the type, label, place with contact actions, start and end, length, and the period's live notes. Writers can edit and delete (soft). Deleting a period extends the one before it.
- **Suggestions from events:** when a writer opens an event whose title matches a period type's words ("Admitted…" → Hospital, "Discharged home" → Home, "Hospice…" → Hospice), and that type isn't the period at the event's time, the entry page offers one chip: "Start a hospital period?". Tapping it opens the start sheet prefilled with the type, the event's time, and the event's linked practice as the place.
- **In search** (after `search` lands): a period filter on the search page, and a period chip on the timeline while a search is active, so "knee" can be searched within "Rehab at Oak Hills". The timeline itself gets no period filter.

Everyone in the group sees periods; writers (owners, admins, caretakers) add, change and delete them. Everything works offline, like other synced data.

## User Stories

### Seeing where the recipient is

1. As a caretaker, I want the timeline header to say where the recipient is now, so that I know the setting before I read anything else.
2. As a caretaker, I want the current-period line to say how long it has been ("day 4"), so that I know how long the stay has lasted without counting.
3. As a caretaker, I want the current-period line to show the place's name, so that I know which hospital without opening anything.
4. As a caretaker, I want to tap the current-period line to open the period, so that the room, the phone number and the notes are one tap away.
5. As a caretaker, I want a small icon for the current setting beside the recipient's name in the app header, so that I see it on every group screen.
6. As a screen-reader user, I want that icon to have the period's name as its text, so that I hear "In hospital" rather than nothing.
7. As a caretaker on a desktop, I want a tooltip on the header icon, so that I can tell what it means.
8. As a caretaker, I want the open group menu to say "Now: In hospital · day 4" and link to the period, so that I can reach it from any screen.
9. As a viewer, I want to see the current period, so that I know where to visit even though I can't change it.
10. As a caretaker with two care groups, I want each group's header to show its own recipient's period, so that switching groups never shows the wrong setting.

### Starting a period

11. As a caretaker, I want a Change action on the current-period line, so that recording "she was admitted" starts where I see the current setting.
12. As a caretaker, I want the start sheet to default to now, so that recording a move as it happens takes no date entry.
13. As a caretaker, I want to choose the type from a short fixed list (Home, Emergency room or observation, Hospital, Rehab or skilled nursing, Assisted living, Memory care, Nursing home, Hospice at home, Hospice facility, Other), so that periods read consistently across the family.
14. As a caretaker, I want to add an optional label ("Mercy General, cardiac unit"), so that the period says more than its type.
15. As a caretaker, I want Other to require a label, so that an Other period always says what it is.
16. As a caretaker, I want to pick the place from the provider directory, so that its address and phone come with it.
17. As a caretaker, I want to add a new place by typing its name in the picker, so that I don't have to leave the sheet to add the hospital to the directory first.
18. As a caretaker, I want a free-text place detail ("Room 412, bed B"), so that the room number is written down where everyone can find it.
19. As a caretaker, I want to give a date without a time, so that "she moved to rehab on Tuesday" doesn't need a made-up time.
20. As a caretaker, I want to add the time when I know it, so that an admission at 14:20 is placed correctly among that day's entries.
21. As a caretaker, I want the start's date and time to be in the recipient's time zone, so that a sibling in another zone records the same day.
22. As a caretaker, I want starting a new period to end the current one at that moment, so that I never have to close one period and open another.
23. As a caretaker, I want a start in the future refused, so that the current period is always what is true now (planned moves are appointments).
24. As a caretaker with no periods yet, I want the timeline to ask "Where is Pat now?" with "Add care period", so that I find the feature when it's useful.
25. As a viewer, I want no Change action or prompt, so that I'm not offered something I can't do.
26. As a caretaker offline, I want to start a period, so that a move recorded in a hospital basement isn't lost.

### Filling in and correcting the past

27. As a caretaker, I want a periods page listing every period, newest first, with dates and lengths, so that I can see the whole history of settings.
28. As a caretaker, I want "Add period" on the periods page with any past start, so that I can fill in where she was before we started using Caretook.
29. As a caretaker, I want a period added in the past to slot into the track by its start, so that the periods around it end and begin at the right times.
30. As a caretaker, I want to edit a period's type, label, place and start, so that I can fix a mistake.
31. As a caretaker, I want moving a period's start to move the end of the period before it, so that the track stays without gaps.
32. As a caretaker, I want to delete a period after a confirm, so that a wrong entry goes away.
33. As a caretaker, I want deleting a period to extend the one before it, so that there's never a hole in the track.
34. As a caretaker, I want two periods added offline at the same moment on two phones to both stay and show in a fixed order, so that nothing is silently lost and I can delete the duplicate.

### On the timeline

35. As a caretaker, I want a marker row in the timeline where each period starts, so that I see the move in the flow of the day.
36. As a caretaker, I want the marker to read "Home → Hospital · Mercy General, room 412 · 14:20", so that I know where she came from and where she went.
37. As a caretaker, I want the first period's marker to read "Started: Home", so that the oldest marker makes sense on its own.
38. As a caretaker, I want a date-only period's marker at the start of its day, so that it heads that day's entries.
39. As a caretaker, I want to tap a marker to open its period, so that the stay's notes are one tap from the timeline.
40. As a caretaker, I want markers to show with a kind or author filter on, so that "only doses" still shows where the hospital stay began.
41. As a caretaker scrolling back, I want markers to appear as their part of the timeline loads, so that infinite scroll never shows a marker out of place.
42. As a caretaker at the beginning of the timeline, I want markers older than the oldest entry still shown, so that a period added for the time before Caretook isn't hidden.
43. As a caretaker, I want markers in both the rows and cards views, so that the view choice doesn't hide them.
44. As a screen-reader user, I want a marker read as one item ("Moved from Home to Hospital, Mercy General, at 14:20"), so that it's clear it's not an entry.

### The period page and its notes

45. As a caretaker, I want a page for each period with its type, label, place, start, end and length, so that I have the stay's facts in one place.
46. As a caretaker, I want the place's call, map and website actions on the period page, so that I can phone the unit from there.
47. As a caretaker, I want each period to have live notes, so that the discharge instructions and visiting hours live with the stay.
48. As a caretaker, I want to write those notes with someone else at the same time, so that two of us can take down instructions together.
49. As a caretaker offline, I want to read and write the period's notes, so that a hospital without signal doesn't stop me.
50. As a viewer, I want to read the period's notes but not change them, so that I stay informed.
51. As a caretaker, I want links from the period page to the previous and next periods, so that I can step through the history.
52. As a caretaker, I want a deleted, missing or other group's period to show the not-found page, so that nothing leaks between groups.

### Suggestions from events

53. As a caretaker writing an event titled "Admitted to Mercy General", I want a chip offering to start a hospital period, so that recording the event and the setting takes one more tap.
54. As a caretaker, I want "Discharged home" to suggest Home and "Hospice intake" to suggest Hospice at home, so that the common moves are covered.
55. As a caretaker, I want the chip's sheet prefilled with the event's time and its linked practice as the place, so that I only confirm.
56. As a caretaker, I want no chip when the period at the event's time is already that type, so that I'm not nagged after recording it.
57. As a caretaker, I want no chip on notes, symptoms or vitals, so that suggestions stay where they make sense.
58. As a viewer, I want no suggestion chip, so that I'm not offered something I can't do.
59. As a caretaker offline, I want suggestions to work, so that they don't depend on signal.

### Search (after the search PRD)

60. As a caretaker, I want a period filter on the search page, so that I can search "knee" within the rehab stay.
61. As a caretaker searching the timeline, I want a period chip that narrows the matches to one period's dates, so that the results cover one stay.
62. As a caretaker, I want the period filter in the URL, so that Back and a reload keep it.
63. As a caretaker, I want the current period's results to run up to now, so that an open period isn't cut off.

### Permissions and sync

64. As an owner, admin or caretaker, I want to add, change and delete periods, so that whoever is with the recipient can record a move.
65. As a non-member, I want no access to a group's periods, so that a recipient's whereabouts stay private.
66. As a caretaker, I want a change on one device to show on the others within seconds, so that the family sees the move at once.
67. As a caretaker, I want a place that was later removed from the directory to show greyed "(removed)" on the period, so that the history stays readable.

## Implementation Decisions

### Model

- **One track per group (per recipient).** Periods are stored by **start only**; a period's end is the next period's start, and the latest has none (it's current). Gaps and overlaps can't be stored. Editing a start moves the previous period's end; deleting extends the previous one. Care never ends on the track.
- **Order and ties:** periods sort by `(started_at, created_at, id)`. Two periods with the same start both stay; the earlier-created one has zero length and is shown, so it can be deleted. Nothing merges them.
- **Start:** a moment plus a `date_only` flag. A date-only start is stored as midnight in the recipient's time zone (as appointments' `allDay` does) and shown without a time. Starts in the future are refused by the service (with a small skew allowance on the device, like appointments' doses).
- **Types** (fixed, in this order): `home`, `emergency` (Emergency room or observation), `hospital`, `rehab` (Rehab or skilled nursing), `assistedLiving`, `memoryCare`, `nursingHome`, `hospiceHome`, `hospiceFacility`, `other`. `other` needs a label. New types are appended; unknown types from a newer build display as Other.
- **Place:** an optional provider in the same group (any live type; the picker lists practices first, then the rest) and an optional free-text place detail. A removed provider stays linked and displays greyed.
- **Day count:** "day N" counts calendar days in the recipient's zone, the start day being day 1.

### Data layer

- **A new table** `care_period`: `group_id`, `recipient_id` (composite FK to the recipient, as medications do), `type`, `label`, `place_provider_id` (composite FK to `provider`, `NO ACTION`, since providers are only soft-deleted), `place_detail`, `started_at`, `date_only`, `deleted_at`, timestamps and audits. Unique `(group_id, id)`.
- **Permissions:** any member reads; writers create and update; writers delete (soft). Group and recipient ids are immutable.
- **`carePeriodService`:** create (idempotent on id, for uploads), update (validates the merged row), soft remove. Rules: the place must be a live provider in the group when set or changed; the start can't be in the future; `other` needs a label.
- **Live notes:** a new `note_document` subject `carePeriod` with its owner column (a cascading composite FK, added to the exactly-one-owner check). `noteDocumentService.create` accepts a period that isn't deleted.
- **Sync:** the table in the `care_groups` stream (soft-deleted rows included) and the publication (one migration); the device schema entry; an upload op (PUT upsert, PATCH update or soft remove, DELETE soft remove; a changed group or recipient is `immutable`). All shared-registry edits are additive.

### Pure modules (deep, tested)

- **Period track** (client-safe, beside the schema): `periodSpans(periods)` → ordered spans `{ period, startsAt, endsAt | null }`, ignoring deleted rows; `periodAt(spans, instant)`; `currentPeriod(spans, now, timeZone)` → the span and its day count; `periodRange(spans, periodId)` → `{ from, to | null }` for search; and the content validation shared by the device, the service and the form.
- **Timeline markers** (web lib): `periodMarkers(spans, { oldestLoaded, hasOlder })` → the markers to show in the loaded window, each with its moment and its from/to, so the list can place them in their day sections. With `hasOlder` false, older markers are included and placed in their own day sections. Independent of the kind and author filters.
- **Period suggestions** (web lib): `suggestPeriod({ title, occurredAt, spans, providers })` → `{ type, startsAt, placeProviderId } | null` from keyword rules per type (accents and case ignored, whole words), suppressed when the period at that moment already has that type.
- **Period wording** (web lib, the one home for it): type labels and lucide icons, "In hospital", "day 4", the current-period line, the marker text ("Home → Hospital · …", "Started: Home"), the length on the periods page, and the accessible marker sentence.

### Device

- `lib/sync/carePeriods.ts`: queries (the group's periods, one period, the place providers) and local writes (create, update, soft remove, and create-with-new-place in one transaction, as medications' `newProviders` does). `createCarePeriodDocument` for its notes.

### Screens

- **Routes** (children of the group route, through `appUrls`): the periods page (`periods`), the period page (`periods/:periodId`), and sheets for add and edit (children of the periods page, the routing sheet pattern with guards: viewers and missing or deleted periods go to the list). A sheet opened from the timeline line or an entry's suggestion closes back to where it came from.
- **The timeline:** a `CurrentPeriodLine` region in the timeline header area, styled with the other one-line strips (B-78 restyles them together; it should take this line into account). Markers are rendered by `TimelineEntryList` from `periodMarkers` in both views, as `li` rows inside day sections, never as entries.
- **The group menu:** the trigger gets the period icon; the menu gets a "Now: …" link item at the top of the group section, and "Care periods" after "Group settings". `GroupMenu` reads the current period through a hook, not `getSync()`.
- **The entry page:** a suggestion chip for writers on events, in the header's `with` area or just below it, opening the add sheet with prefilled search params.
- **Search** (last slice): a period choice on the search page and a period chip in the timeline's search mode, both through `timelineFilters` (`?period=<id>`, honoured only while `q` is set) and the search page's own URL helpers; the period resolves to a `from`/`to` range through `periodRange`.
- `check-areas` gets rules for the new route folders, the pure modules and the device module.

### Not changed

- No new timeline entry kind: markers are drawn from periods, never written as entries.
- No group section or tab.
- No oRPC procedure yet; the assistant PRD adds a read when it needs one.

## Testing Decisions

- **Good tests check behaviour through the module's interface** (inputs → outputs, or service calls → stored rows and returned errors), never internal helpers or markup structure. Pure rules live in modules small enough to test exhaustively; browser checks keep only the wiring (a link is there, a tap navigates, data shows on a second device).
- **Unit tests (`data:unit`, `web:unit`):**
  - Period track: ordering and ties, derived ends, deletes extending the previous period, `periodAt` at boundaries (inclusive start), the current period and day count across midnight and DST in the recipient's zone, date-only starts, `periodRange` for open and closed periods, validation (future starts, Other without a label).
  - Timeline markers: the window rules (inside, older with and without `hasOlder`), the first period's "Started" marker, same-moment periods, markers on a day with no entries.
  - Period suggestions: each type's keywords, case and accents, whole words only, suppression by the period at the event's time, prefill of time and practice.
  - Period wording: every type's label and icon, the line, the marker text and sentence, lengths.
  - Prior art: `dueDoses.test.ts`, `timelineDays.test.ts`, `providerSuggestions.test.ts`, `medicationDisplay.test.ts`.
- **Integration (`integration`):** `carePeriodService` against the test Postgres: each role's create, update and delete; a non-member gets not-found; the place rule (another group's provider, a deleted provider); a future start refused; Other without a label; soft delete; the upload op's PUT, PATCH and DELETE, and `immutable`; a `carePeriod` document's create. Fixtures per test (`fixtures.ts`). Prior art: the medication and provider service tests.
- **Browser check:** a new `care-periods.mjs` in the suite, with `check-areas` rules. It covers: the writer prompt on a group without periods; starting a period from the line (with a new place typed inline); the line, header icon and menu item; a marker in rows and cards, and with a kind filter; adding an earlier period on the periods page and the boundaries moving; editing and deleting; the period page with contact actions and two-browser notes; the suggestion chip on an event; a viewer; offline add; a second device seeing the change; the 404s. Smoke mode: start a period from the line and see its marker. It tags its periods and soft-deletes them at the end. Prior art: `medications.mjs`, `providers.mjs`, `phase2.mjs`.
- **Search slice:** extends `search.mjs` with the period filter on both surfaces.

## Out of Scope

- Filtering the timeline itself by period (only search gets a period filter).
- Overlapping periods, or extra spans beyond the one track (chemo cycles, a visit to a relative).
- Ending care (the last period always runs to now).
- Future or planned periods; a planned admission is an appointment.
- Group-defined types or colours.
- Day headers carrying the period's colour or label.
- AI summaries per period or day (the `assistant` PRD, B-49), and an oRPC read for periods.
- Showing the current setting on the profiles PRD's recipient sheet or the medications print sheet (possible follow-ups).
- Suggestions on timeline rows or from notes.

## Further Notes

- **Seeds** (`seeds/carePeriods.ts`, own ids): for Grandma Pat, Home from eight weeks ago, a short Emergency room stay then Hospital (at a seeded provider) about three weeks ago, Rehab for ten days, then Home again, so the timeline, page and history all have something to show. Dev Family 2 gets none, so the writer prompt is visible on member@'s second group.
- **Hot files:** the timeline header area and `TimelineEntryList` (shared with `search` slice 2 and B-78), `GroupMenu`, the entry page header, `note_document`'s subject check, the sync and upload registries, `routes.ts`, `appUrls`, one migration.
- **Order with other work:** B-78 (the strips' restyle) should run before or with the timeline slice so the line matches. The search slice waits for `search` slices 2 and 3.
- **Rough slices (for the plan):** (1) data layer, sync, seeds and the device module, proved through `window.caretookModules()`; (2) the periods page, period page with notes, and the add and edit sheets; (3) the timeline line, writer prompt and markers; (4) the group menu icon and item; (5) suggestions on the entry page; (6) the search filter (blocked by `search`). 3, 4 and 5 can run in parallel after 2.
- The PRD hasn't been filed as a GitHub issue, because `gh` can't see `caretook/caretook.com` yet.
