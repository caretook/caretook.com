# Medications 2: passes, quick logging, the bedside sheet and allergies

Topic `medications-2`. Backlog: **B-76** (medication groups), **B-86** (the medication strip on the timeline, quick dose logging), **B-51** (a printable check-off sheet), **B-26** (allergies). Builds on the done `medications` PRD ([medications-prd.md](medications-prd.md)) and `appointments` (due doses in Upcoming).

Interviewed 2026-11-19. GitHub issue: to file once `gh` can see the repo.

## Problem Statement

Caretakers give medications in rounds: at 8 in the morning Grandma Pat takes her blood-pressure pill, her diabetes pill and a vitamin together, and at night another handful. Caretook only knows medications one at a time. Each one has its own times, each dose is logged on its own (four taps and four sheets for one morning round), and the timeline fills with one dose row per pill. When a pill is refused in the middle of a round there's no quick way to say "all given except this one".

From the timeline, the only sign of medications is the Due now strip, which shows only once something is already due and opens a sheet for one medication at a time. So a caretaker can't see at a glance "the evening meds are next, at 8".

At the bedside many families keep a paper chart and tick boxes with a pen, because a phone isn't always at hand, or another helper (a neighbour, a paid aide) doesn't use the app. The printable list Caretook has is a reference, not a chart to fill in.

And Caretook doesn't know the recipient's allergies, though every list a caretaker hands a new doctor or pharmacist should start with them, and nothing warns when a medication that matches a known allergy is added.

## Solution

**Passes.** A care group has a short list of named **passes** (medication rounds): "Morning · 8:00", "Evening · 20:00", and whatever else the family uses. A medication's schedule picks passes (and can still have a one-off time of its own), and can take a different amount in each pass (1000 mg in the Morning, 500 mg in the Evening). Writers manage passes on a Passes screen in the Medications section; moving a pass's time moves every medication in it.

**Logging a pass in one tap.** Wherever a pass is due (the timeline strip, Today, the Dose sheet), writers get **Given all**: every open medication in the pass is logged as given now, with its amount for that pass, and a "Morning logged · Undo" status stays for about 10 seconds. Expanding a pass lets each medication be marked Given, Skipped or Refused on its own. On the timeline, the doses logged together show as **one row** ("Morning: 3 given, 1 refused"), which opens a **pass sheet** where each dose's status, amount, note and time can be corrected, a forgotten medication added, or the whole log deleted.

**The medication strip.** The timeline's Due now strip becomes one always-on, compact line: "Next: Evening · 8:00 PM · 4 meds" while nothing is due, amber with Given all when a pass is due, red when one is overdue (an overdue earlier pass takes the line's place). Hidden for a group with no scheduled medications. One-off times show in the strip like a pass of one.

**The weekly bedside sheet.** A second printable sheet: one week, a row per pass and medication (with its amount), a column per day, a check box and room for initials in each cell, the allergies at the top, and blank rows for as-needed doses. It prints from local data, so it works offline.

**Allergies.** The recipient has a list of allergies (substance, reaction, severity), synced, shown on the medications page, each medication's page and both printed sheets. Adding or renaming a medication whose name matches an allergy shows a warning (never a block).

## User Stories

### Passes

1. As a caretaker, I want my care group to have named medication passes like Morning and Evening, so that the app matches how we actually give medications.
2. As a caretaker of a new care group, I want Morning (8:00) and Evening (20:00) to exist already, so that I can start without setting anything up.
3. As a writer, I want to add a pass with a name and a time, so that a Noon or Bedtime round can be tracked.
4. As a writer, I want to rename a pass, so that it uses the family's own words ("Breakfast meds").
5. As a writer, I want to change a pass's time, so that when the morning round moves to 8:30 every medication in it moves too.
6. As a caretaker, I want a pass's time change to appear on the timeline ("Morning moved 08:00 → 08:30"), so that others know why the schedule changed.
7. As a writer, I want to put passes in order, so that they read the way the day goes.
8. As a writer, I want to delete a pass without losing any medication's schedule, so that its medications keep their time as a one-off time.
9. As a viewer, I want to see the passes and their medications without being able to change them, so that I know the routine.
10. As a caretaker, I want each pass to list the medications in it, so that I can check the round is right.
11. As a caretaker, I want pass times in the recipient's time zone, as medication times are, so that a pass doesn't shift when I travel.

### Schedules with passes

12. As a writer adding a medication, I want to tick the passes it's taken in, so that I don't type times again.
13. As a writer, I want to add a one-off time that isn't a pass, so that a medication taken at 14:00 alone still works.
14. As a writer, I want a different amount per pass (1000 mg Morning, 500 mg Evening), so that split doses are logged and printed right.
15. As a writer, I want the medication's usual dose used wherever I didn't set a pass amount, so that I only enter differences.
16. As a caretaker, I want the medication page and list to show its schedule as passes ("Morning and Evening") with any amounts, so that it reads naturally.
17. As a caretaker, I want medication change entries for a schedule edit to name passes ("Added to Evening"), so that the history is readable.
18. As a caretaker, I want as-needed medications to stay as they are (no passes), so that nothing about them gets harder.

### Logging a pass

19. As a writer, I want one tap to log every open medication in a due pass as given, so that a normal round takes one tap instead of four sheets.
20. As a writer, I want an Undo for about 10 seconds after Given all, so that a mis-tap costs nothing.
21. As a writer, I want to expand a pass and mark one medication Skipped or Refused (with an optional note) while the rest are given, so that exceptions are quick.
22. As a writer, I want Given all to log only medications not already answered, so that a dose someone else logged isn't doubled.
23. As a writer, I want to see who already logged part of a pass, so that two caretakers don't both give it.
24. As a writer, I want Given all to work offline, so that I can log at the bedside without a signal.
25. As a writer on a second device, I want a pass logged elsewhere to show as done within seconds, so that I don't give it again.
26. As a writer, I want the Dose sheet to offer a due pass as one choice (with Given all), as well as single medications, so that the sheet works for rounds too.
27. As a writer, I want Today on the medications page to group by pass, with Given all on each, so that the page matches the strip.
28. As a writer, I want the overdue and "already given" warnings to still apply per medication, so that safety rules don't get lost in a round.
29. As a viewer, I want to see pass states without logging controls, so that I can follow along.

### The timeline

30. As a caretaker, I want doses logged together to show as one row ("Morning: 3 given, 1 refused"), so that the timeline isn't flooded with pills.
31. As a caretaker, I want to see each medication in that row on expanding it, so that the detail is one tap away.
32. As a writer, I want tapping the pass row to open a pass sheet, so that I can fix a status, amount, note or time.
33. As a writer, I want to add a medication someone forgot to the pass log from that sheet, so that the log stays complete.
34. As a writer, I want to delete a whole pass log at once, so that a log of the wrong pass is easy to remove.
35. As a caretaker, I want a dose logged on its own to stay its own row, as it is now, so that nothing else changes.
36. As a caretaker, I want the dose kind filter to show pass rows too, so that filtering still works.

### The medication strip

37. As a caretaker, I want the timeline to always show the next pass ("Next: Evening · 8:00 PM · 4 meds"), so that I know what's coming.
38. As a writer, I want the strip to turn amber with Given all when a pass is due, so that I can log it from the timeline.
39. As a caretaker, I want an overdue pass to show in red in the strip's place, so that it isn't missed.
40. As a writer, I want to open the pass's details from the strip, so that I can mark exceptions.
41. As a caretaker of a group with no scheduled medications, I want no strip at all, so that the timeline stays clean.
42. As a caretaker, I want the strip to stay one line on a phone, so that the timeline's header stays short (B-78).

### The weekly bedside sheet

43. As a caretaker, I want to print a week's chart with a box per pass, medication and day, so that helpers can tick doses with a pen.
44. As a caretaker, I want each row to show the medication, strength and the pass's amount, so that a helper without the app gives the right dose.
45. As a caretaker, I want room for initials in each box, so that we know who gave it.
46. As a caretaker, I want blank rows for as-needed medications, with space to write the time, so that those can be recorded too.
47. As a caretaker, I want the allergies printed at the top, so that anyone at the bedside sees them.
48. As a caretaker, I want to choose the week's start (this week by default), so that I can print next week's chart ahead.
49. As a caretaker, I want it to print offline and in black and white whatever the theme, so that it works at home.
50. As a caretaker, I want the week to fit one landscape page for a usual list, so that it can hang on the fridge.

### Allergies

51. As a writer, I want to add an allergy with a substance, a reaction and a severity, so that the recipient's allergies are recorded.
52. As a writer, I want to edit and remove allergies, so that the list stays right.
53. As a caretaker, I want "No known allergies" to be something I can record, so that an empty list isn't mistaken for not knowing.
54. As a caretaker, I want the allergies at the top of the medications page and on each medication's page, so that they're seen before giving anything.
55. As a caretaker, I want allergies on the printed medication list, so that a new doctor gets them.
56. As a writer, I want a warning when a medication I add or rename matches an allergy, so that a dangerous mistake is caught; I can still save.
57. As a viewer, I want to read allergies but not change them, so that the list is protected.
58. As a caretaker, I want allergies to work offline and sync like other care data, so that they're there when needed.

## Implementation Decisions

### Data

- **A new synced table for passes** (`medication_pass`): group, recipient (a composite FK, as `medication` has), name, time (`HH:MM` in the recipient's zone), a sort order, `deleted_at`, plus timestamps and audits. Unique `(group_id, id)`. Permissions like `medication`: any member reads, writers write, delete is soft. In the `care_groups` stream, the publication, the device schema and the upload switch (PUT upsert, PATCH update or soft remove, DELETE soft remove; a changed group or recipient is `immutable`). Names are unique per group among live passes (case-insensitive), up to about 8 live passes per group.
- **A new synced table for allergies** (`recipient_allergy`): group, recipient (composite FK), substance, reaction (optional), severity (`mild | moderate | severe | unknown`), `deleted_at`. Same permissions and sync pattern. It is a table, not columns on `care_recipient`, because `profiles` is changing `care_recipient` now and a list needs no jsonb rules. **"No known allergies"** is a nullable timestamp on the recipient (`no_known_allergies_at`); it's the one `care_recipient` column this PRD adds, and is cleared when an allergy is added. If `profiles` has landed its recipient changes first, add the column through its patterns.
- **The schedule** gains a slot list. `{ type: "scheduled", slots: [{ passId } | { time }, amount?] }`, 1–8 slots, no duplicate pass or time. The old `{ type: "scheduled", times }` shape is still **read** everywhere (every parse goes through one function that turns `times` into time slots), because devices on an older build may upload it; writes use the new shape only. A medication that points at a deleted pass is treated as having that pass's last time until it's saved again (the server's delete turns it into a time first, below).
- **Pass rules** (the service, in one transaction, rows locked `FOR UPDATE`): a time change updates the pass and writes one `medicationChange` entry with a new `passMoved` variant (pass id, name, before and after time, the medications in it), its id a UUID v5 of the pass and the moment. Deleting a pass replaces it with `{ time }` (amount kept) in every live medication's schedule, in the same transaction, writing no change entries for those (the pass delete is the change). The device does both in one local transaction too, and the upload replays them idempotently.
- **New groups get Morning 08:00 and Evening 20:00** (`careGroupService.create`, the access-code redemption and the staff create, all through one helper). Seeds add them for both seeded groups and move the seeded medications onto them.
- **Dose details** gain optional `passId` and `passLogId` (a UUID shared by every dose logged in one pass round). jsonb, so no timeline migration; the shared Zod schema accepts both. `scheduledFor` stays (the pass's time when logged), so the existing due logic and older builds still read the doses.

### Pure modules (web:unit or data:unit tested)

- **Pass rules** (client-safe in the data package): sort order, name uniqueness, the delete rewrite of a schedule (`withoutPass(schedule, pass)`), the retime summary, the `passMoved` change wording.
- **Schedule slots**: `normalizeSchedule` (old `times` → slots), `slotTimes(schedule, passes)` (the time each slot falls at), `slotAmount(medication, slot)` (pass amount, else the medication's dose), and `sameSchedule` extended to slots (so change entries stay right).
- **Due doses, extended**: `dueDoses` takes the passes, keys each slot by its pass when it has one (`passId@day`, else `time@day`), so a retimed pass keeps its answered doses; a dose answers a pass slot by `passId` first, then by `scheduledFor` as now. A new `duePasses(due, passes)` rolls slots up into passes: each pass's state (upcoming, due, overdue, done, partly done), its open medications, who logged what. One-off times become a pass of one. `doseWarnings` stays per medication.
- **Pass logging** (`givenAllWrites(pass, due, now)`): the dose rows Given all writes (open medications only, the pass amount, `passId`, `passLogId`, `scheduledFor`), so the strip, Today and the Dose sheet all write the same thing.
- **Timeline grouping**: doses with one `passLogId` in one day fold into one pass row (`groupPassLogs`), placed at the earliest dose's time, with a summary (`passLogText`: "Morning: 3 given, 1 refused"). Grouping runs over the listed window only; paging never splits a log across pages (the window rule counts a log as one item, or the grouping accepts a partial log at the window's edge and shows "+N earlier" — the plan picks one, tested).
- **Strip text** (`medicationStripText`): next, due and overdue lines, the count, "Given all" labels, in the recipient's zone with the zone note when the device is elsewhere.
- **The weekly sheet** (`weeklySheet({ recipient, passes, medications, allergies, weekStart, now })`): rows by pass order then medication name, one-off times after passes, as-needed rows last, the amount per row, the seven days in the recipient's zone (DST-safe through the existing zoned-day helpers), and the allergies block.
- **Allergy matching** (`allergyMatches(name, allergies)`): case and accents folded, whole words: an allergy's substance words all appear in the medication's name, or the name's words in the substance ("Penicillin" warns on "Penicillin VK", not on "Amoxicillin"). Plain word matching only; drug families are out of scope. It returns the matching allergies for the warning.

### Screens

- **Passes screen** in the Medications section (a route under the medications list, built through `appUrls`): the list in order with times and their medications; writers get add, rename, retime, reorder and delete (a `ConfirmDialog` that says the medications keep the time). Reached from the list header and from the medication form's schedule.
- **The medication form's schedule** (`ScheduleFields` in the medications folder): pass check boxes with an optional amount each, "Add another time", and as needed as now. The allergy warning shows on the name field (`Field`'s `warning`).
- **Today** groups by pass (pass name, time, state badge, Given all, expand for each medication's Given, Skipped, Refused); one-off times show as before.
- **The medication strip** replaces `DueNowStrip` in the timeline header (same region, one line, B-78's style rules). For writers, "Given all" logs and shows the Undo status; the pass name opens the Dose sheet on that pass. Viewers get text.
- **The Dose sheet** lists due passes first (Given all and per-medication status inside), then single medications as now.
- **The pass sheet** (an edit-sheet route for a pass log, like the dose edit sheet, built through `appUrls`): each dose's status, amount, note and time, "Add a medication", and "Delete this log". Its guard sends viewers and missing or deleted logs to the timeline.
- **Undo**: a polite `role="status"` line with an Undo button for about 10 s; Undo soft-deletes exactly the doses that Given all wrote (by `passLogId` and the ids it returned). One shared hook for the strip, Today and the Dose sheet.
- **The weekly sheet** at a print route beside the existing printable list (`medications/print/week?start=YYYY-MM-DD`), linked from the list's Print menu (the list gets a two-item Print menu: Medication list, Weekly chart). It reuses the print CSS; landscape through `@page`.
- **Allergies**: a region at the top of the medications page and each medication's page ("Allergies: Penicillin (hives, severe) · Sulfa"), "No known allergies", or, for writers, "Add allergies". Writers edit them in a sheet (add, edit, remove, "No known allergies"). Both printed sheets show them at the top.

### Shared files

- Registries, appended only: `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the device schema, the upload switch, `routes.ts`, `appUrls`, `check-areas`.
- One migration for the two tables, the recipient column and the publication (hand-written `ALTER PUBLICATION`, kept when regenerating).
- Hot spots: `lib/dueDoses.ts` and its callers (Today, Due now, the Dose sheet, Upcoming's due doses), the timeline header region (coordinate with B-78 in quick-fixes and `care-periods`' timeline slice), `TimelineEntryList` grouping (also touched by `care-periods`), `ScheduleFields` and the medication form.
- Upcoming's due doses (`appointments`) show passes as one row too, through `duePasses`.

## Testing Decisions

- **Good tests check behaviour through a module's interface** (inputs → outputs, or a service call → what's stored and returned), never internal helpers or markup. Pure modules get table-driven unit tests that pin every boundary: DST days, midnight, a retimed pass, partly logged passes, old-shape schedules.
- **Unit tests for every pure module above**: pass rules, schedule slots and normalising, `dueDoses` with passes and `duePasses`, `givenAllWrites`, `groupPassLogs` and `passLogText`, `medicationStripText`, `weeklySheet`, `allergyMatches`. Prior art: `dueDoses.test.ts`, `printSheet` tests, `medicationDisplay` tests, `timelineDays` tests, `zonedDay` tests.
- **Integration tests** (the `integration` project, own fixtures): the pass service (create, rename, retime with its change entry, delete rewriting schedules, uniqueness, permissions per role, another group refused), the allergy service, the upload switch for both tables (including an old-shape schedule from an older build), Given all's doses through upload, and new groups getting default passes on every create path. Prior art: the medication service and upload tests.
- **Browser checks**: extend `medications.mjs` (passes screen, the schedule with passes and amounts, Given all with Undo from Today, the pass sheet, the weekly sheet at print media at 420 and 1280 and offline, allergies with the warning, viewer, a second device seeing a pass logged, offline Given all) and `phase2.mjs` (the strip: next, due, overdue, hidden; the pass row on the timeline in rows and cards). Tagged rows, cleaned up at the end, clock-independent slots as the existing Today steps do. Add each new screen to `check-areas`.

## Out of Scope

- Reminders and notifications for passes (B-61's notifications work); refill reminders.
- Turning a photo of the bedside sheet into doses (assistant, later).
- Drug interaction or allergy-family checking beyond plain word matching (e.g. that amoxicillin is a penicillin); no external drug database.
- As-needed medications inside passes.
- Several recipients per group with their own passes (passes carry the recipient for later, but the screens assume one).
- A screen to change the recipient's time zone (B-65, in quick-fixes).
- Changing how single-medication doses look on the timeline.

## Further Notes

- **Order:** the data layer (passes, the schedule's slots, allergies) lands first; the due logic with passes next; then the strip, Today and Given all; the timeline pass row and pass sheet; the weekly sheet; allergies' screens. The weekly sheet and allergies are independent of logging and can run alongside it.
- **Coordination:** B-78 (quick-fixes) is reshaping the timeline's strips now; this PRD's strip follows its styling and should start after it lands. `care-periods` also touches the timeline header area and `TimelineEntryList`; the hot-files rule applies (a regions slice first if both run at once).
- **Default passes for existing groups:** dev data only until launch, so the migration doesn't backfill; seeds and new groups get them. If a real group exists by then, add a one-off backfill.
- **Allergy matching** is deliberately simple; the warning wording says "matches an allergy on file", never "safe".
