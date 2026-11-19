# PRD: Appointments (upcoming notes and events, the Upcoming section, cancel and reschedule)

Backlog: B-47. Follow-ups filed separately: recurring appointments (B-60), reminders by email and push (B-61), an iCal feed (B-62), Google Calendar sync (B-63).

## Problem Statement

Caretakers spend as much effort on what's coming as on what happened: doctor visits, labs, therapy, home health, rides, refills, a sibling's visit. Caretook's timeline only looks back. An event can already be given a future time (nothing stops it), but it then sits at the very top of the history, above Today, with nothing saying it hasn't happened yet. There's no place for the appointment's address or length, no way to say it was cancelled or moved, and no single view of what's next. Symptoms and vitals can also be dated in the future by mistake, which makes no sense for something felt or measured.

So the family keeps appointments somewhere else (a paper calendar, one person's phone), the visit's prep list lives apart from the visit, and after the visit nobody can see that the cardiology appointment was rescheduled twice.

## Solution

**A future event is an appointment, and a future note is a reminder.** There is no new kind: when the time passes, the appointment simply becomes the event in the history, with its live notes (the prep list, then what happened) carried along.

- **Only notes and events can be dated in the future.** Symptoms, vitals, doses and medication changes can't.
- **Events gain an optional end time, a place, and all-day**; notes gain all-day. A place defaults to the first linked provider's address.
- **The timeline stays a history by default.** A one-line **Next** strip ("Next: Dr. Alvarez · Tomorrow 10:30 · +3 more") shows whenever something is upcoming. A **Show upcoming** toggle (in the URL) adds an **Upcoming** block above Today, soonest first, linking to the Upcoming section.
- **A new Upcoming section** (a group section beside Timeline and Providers) is the future timeline: soonest first by day, all-day items first in their day, "Now · until 11:15" for one in progress, contact actions on each item, kind and author filters, **Add appointment** and **Add reminder**, today's due medication doses (once medications builds them), and a **Past** tab listing past events, newest first.
- **Cancel, Reschedule, Delete** on every event. Cancelled events stay, struck through and labelled Cancelled, everywhere. Rescheduling either just moves the event, or keeps the old one as cancelled and creates a new one at the new time with the same title and providers; the live notes continue on the new one, and the old one links to it with its earlier notes read-only.

Everyone in the group sees upcoming items; writers create and change them, as with other entries.

## User Stories

1. As a caretaker, I want to add an appointment with a date and time in the future, so that the whole family knows it's coming.
2. As a caretaker, I want Add appointment to open the date picker first, so that I never save an appointment at the wrong time by accident.
3. As a caretaker, I want the time to default to 9:00 once I pick a day, so that the common case takes one more tap at most.
4. As a caretaker, I want an appointment to be an ordinary event, so that after the visit it is the record of the visit without retyping anything.
5. As a caretaker, I want to write a prep list (questions, what to bring) in the appointment's live notes, so that whoever goes to the visit has it.
6. As a caretaker at the visit, I want to keep writing in the same notes, so that the prep list and what the doctor said live together.
7. As a caretaker, I want to add a reminder as a future note ("Call the pharmacy about the refill"), so that small future things have a place too.
8. As a caretaker, I want to give an appointment an end time, so that everyone knows how long it takes and when the person is free.
9. As a caretaker, I want to mark an appointment or reminder as all day, so that "Hospice intake visit, sometime Thursday" doesn't need a made-up time.
10. As a caretaker, I want an all-day item to count as upcoming for the whole of its day, so that it doesn't vanish from Upcoming at midnight that morning.
11. As a caretaker, I want to give an appointment a place, so that the driver knows where to go.
12. As a caretaker, I want the place to default to the linked provider's address, so that I don't type addresses the directory already has.
13. As a caretaker, I want a map action on the place, so that I can navigate there in one tap.
14. As a caretaker, I want symptoms and vitals refused in the future, so that the record can't claim something was measured before it happened.
15. As a caretaker, I want the date picker to stop at now for symptoms and vitals, so that I can't pick a future time in the first place.
16. As a caretaker whose phone clock is slightly off, I want a few minutes of leeway, so that a vital logged "just now" is never refused.
17. As a caretaker, I want the timeline to show only the history by default, so that the day's story isn't pushed down by next month's appointments.
18. As a caretaker, I want a Next strip on the timeline whenever something is upcoming, so that I always see what's next without leaving the history.
19. As a caretaker, I want the Next strip to say how many more are upcoming, so that I know whether to look further.
20. As a caretaker who just saved an event for later today, I want it to show in the Next strip, so that I can see it saved even though it's not in the history yet.
21. As a caretaker, I want to turn on Show upcoming on the timeline, so that I can see the future and the recent past together.
22. As a caretaker, I want upcoming items in their own block above Today, soonest first, so that the next thing is closest to now.
23. As a caretaker, I want the Show upcoming choice in the URL, so that a reload or a shared link keeps it.
24. As a caretaker, I want the Upcoming block to link to the Upcoming section, so that I can see more detail about the future.
25. As a caretaker, I want an Upcoming section in the group's navigation, so that the future has its own place.
26. As a caretaker, I want Upcoming grouped by day with Today, Tomorrow and dated headings, so that I can scan the week.
27. As a caretaker, I want all-day items listed first in their day, so that the day's big item is on top.
28. As a caretaker, I want an appointment in progress to show as "Now · until 11:15", so that I know it's happening.
29. As a caretaker, I want an appointment with an end time to stay in Upcoming until it ends, so that it's still easy to find during the visit.
30. As a caretaker, I want an appointment to appear in the history once it starts, so that notes taken during the visit show where they belong.
31. As a caretaker, I want each upcoming appointment to show its time, its providers and its place, so that I don't need to open it.
32. As a caretaker, I want call and map actions on each appointment, so that I can phone the office or get directions from the list.
33. As a caretaker, I want to filter Upcoming by kind and by author, so that I can see only appointments, or only what my brother added.
34. As a caretaker, I want Add appointment and Add reminder on the Upcoming section, so that adding future things starts where I'm looking at them.
35. As a caretaker, I want a Past tab on Upcoming listing past events newest first, so that I can review recent visits.
36. As a caretaker, I want cancelled events in the Past tab, so that the history of cancellations is visible.
37. As a caretaker, I want today's due medication doses in Upcoming, so that doses and appointments are in one list for the day.
38. As a caretaker, I want a due dose in Upcoming to open the Dose sheet for that medication and time, so that logging it is one tap away.
39. As a caretaker, I want to cancel an event, so that the family knows the visit isn't happening.
40. As a caretaker, I want to give an optional reason when cancelling, so that "office called, doctor out sick" is recorded.
41. As a caretaker, I want a cancelled event struck through and labelled Cancelled everywhere, so that nobody mistakes it for a real visit.
42. As a caretaker, I want a cancelled appointment never to be "Next", so that the strip points at something real.
43. As a caretaker, I want to undo a cancel, so that a mistaken cancel can be put right.
44. As a caretaker, I want to cancel and reschedule a past event too, so that I can record afterwards that yesterday's visit didn't happen.
45. As a caretaker, I want Reschedule to ask for the new time, so that moving an appointment is one flow.
46. As a caretaker, I want Reschedule to let me just move the appointment, so that a simple time change doesn't clutter the record.
47. As a caretaker, I want Reschedule to let me keep the old one as cancelled, so that the record shows it was moved.
48. As a caretaker, I want the new appointment to keep the title and providers, so that I don't set it up again.
49. As a caretaker, I want the live notes to continue on the new appointment, so that the prep list goes with the visit.
50. As a caretaker, I want the cancelled one to link to the new one ("Rescheduled to Tue, Dec 1"), so that I can follow the chain.
51. As a caretaker, I want the cancelled one's earlier notes still readable, so that nothing written before the move is lost.
52. As a caretaker, I want to delete an event as today, so that a mistaken entry can still go away entirely.
53. As a caretaker offline, I want to add, change, cancel and reschedule appointments, so that they sync when I reconnect.
54. As a caretaker, I want appointments made on another device to appear at once, so that two people don't book the same ride.
55. As a viewer, I want to see Upcoming, the Next strip, the toggle and the Past tab, so that I stay informed.
56. As a viewer, I want no add, cancel or reschedule controls, so that I can't change what I can only read.
57. As a caretaker, I want items to move from Upcoming to the history on their own as time passes, so that I never have to "close" an appointment.
58. As a caretaker, I want the entry page to show an appointment's place, end time, all-day and cancelled state, so that the page is the full picture.
59. As a caretaker, I want to edit the end time, place and all-day from the entry page's header, so that details are where the title and time already are.
60. As a caretaker, I want "Tomorrow" as a day heading, so that the near future reads naturally.
61. As a developer, I want every time rule (past, upcoming, now, all-day) in one pure module, so that the strip, the block, the section and the entry page agree.
62. As a developer, I want the future-date rule in the shared content schema and enforced by the service, so that no client can store a future vital.
63. As a developer, I want the history, upcoming and past-events queries built by pure, tested functions, so that their conditions can't drift apart.
64. As a developer, I want reschedule as one local transaction, so that a half-made reschedule never syncs.

## Implementation Decisions

- **No new kind.** "Upcoming" is worked out, never stored: an item is upcoming while its start is after now, or (with an end time) while its end is after now; an all-day item is upcoming through the end of its day in the entry's own `time_zone`. Between start and end it's "now": in Upcoming as "Now · until …" and in the history at its start.
- **Schema** (`timeline_entry`, real columns, one migration, no backfill):
  - `ends_at` (timestamptz, nullable): events only, after `occurred_at`.
  - `all_day` (boolean, default false): notes and events. An all-day item's `occurred_at` is the start of its day in `time_zone`; with `all_day`, `ends_at` is null.
  - `place` (text, nullable, limited like the title): events only.
  - `cancelled_at` (timestamptz), `cancelled_by` (user id, audit-style, not an FK), `cancel_reason` (text, optional): events only. Cancelled ⇔ `cancelled_at` set.
  - `rescheduled_to` (uuid, nullable): events only, a composite FK `(group_id, rescheduled_to)` to `timeline_entry (group_id, id)` with `ON DELETE SET NULL (rescheduled_to)`. Set only on a cancelled event.
  - Read the generated SQL and fix its order by hand if needed (the AGENTS.md drizzle gotcha).
- **Content schema:** the content union gains these fields per kind (other kinds refuse them). The update schema accepts them, checked against the merged row as today. A **future-date rule** in the shared schema module: `FUTURE_KINDS` (note, event; medications' dose and change kinds are not future kinds) and `isTooFarAhead(kind, occurredAt, now, skewMs)`.
  - The device enforces 5 minutes of skew. **The service allows 1 hour**, because an upload is acknowledged as rejected on a 4xx and the server copy restored, so a device with a fast clock must not lose a real vital. Refusals are a field issue on `occurredAt` ("Can't be in the future").
  - `DateTimeField` gets an optional maximum, which the sheets set to now for non-future kinds.
- **Sync:** the new columns join `timeline_entry`'s stream query (columns are listed explicitly), the device schema, and the upload switch's PUT and PATCH mapping (`all_day` arrives as 1/0). Cancel and uncancel are PATCHes of the cancel fields, writers only (the existing update permission).
- **Pure modules (web):**
  - **`lib/upcoming`:** `entryTiming(entry, now)` → `past | upcoming | now`; `upcomingOrder` (soonest first, all-day first within a day); `nextUp(items, now)` → `{ next, more }`, skipping cancelled; `historyCutoff(now)`. DST-safe all-day day ends through the entry's zone.
  - **Labels** (beside it): `timeRange` ("10:30–11:15", "All day"), `nowLabel` ("Now · until 11:15"), `cancelledLabel`, `rescheduledLabel` ("Rescheduled to Tue, Dec 1"), `nextStripText`. `dayLabel` gains "Tomorrow"; later days keep the weekday-and-date form.
  - **Query builders** beside `entryWindow`, sharing its filter conditions: `historyWindow(groupId, filters, limit, now)` (the timeline, now ending at the cutoff, so paging counts only past items), `upcomingWindow(groupId, filters, now)` (soonest first, uncapped within a horizon of 90 days with "Show later"), `pastEventsWindow(groupId, filters, limit, now)`. The cutoff comes from a once-a-minute clock (like `useNow`), so items cross over without new rows.
  - **Filters:** `lib/timelineFilters` gains `upcoming` (`?upcoming=1`) with `setUpcoming`/`clearUpcoming`, and the Upcoming section reuses kind and author.
- **Local writes** (device, beside `timeline.ts`): `cancelEvent(id, reason?)`, `uncancelEvent(id)`, and `rescheduleEvent(id, { occurredAt, endsAt?, allDay?, keepOldAsCancelled })`.
  - Without `keepOldAsCancelled` it's an ordinary update of the time fields.
  - With it, **one local transaction**: a new event (same title, place, end offset, all-day), copies of its provider links (`entryProviderId` gives their ids), a new `note_document` for it plus **one `note_update` carrying the old document's full Yjs state** (devices can't write a snapshot), and the old event set cancelled with `rescheduled_to`. The old document stays as it was.
  - Viewers' writes are refused locally, as today.
- **Server:** `timelineEntryService` enforces the new fields' kind rules and the future-date rule on create, upsert and update; a cancelled event can still be edited and uncancelled. `rescheduled_to` must name an event in the same group. No new procedures: everything arrives through `sync.upload`.
- **Screens:**
  - **Group section** `Upcoming` (one `GROUP_SECTIONS` entry, appended; lucide `CalendarClock`), route `upcoming` with a `past` child tab, built through `appUrls.upcoming(groupId, search)` and `appUrls.pastEvents(groupId, search)`.
  - **Upcoming list:** day groups, rows reusing `EntryBody` with the time range, place and providers; `ContactActions` for the first linked provider (call) and the place (map); cancelled rows struck through; kind and author filter chips; writers get **Add appointment** (`/entries/new?kind=event&when=pick`, opening the time chip's picker first, 9:00 once a day is chosen) and **Add reminder** (the same for a note).
  - **Due doses** (the last slice, after medications slice 5): an adapter turns medications' `dueDoses` slots for today that are upcoming, due or overdue into Upcoming items under Today, each linking to `timeline/new/dose?medication=…&slot=…`. Never written as entries.
  - **Timeline:** `NextStrip` (below `LatestVitals`, above `LiveNowBanner`, viewers too; hidden when nothing is upcoming) with "Show upcoming" beside it; with `?upcoming=1` an `UpcomingBlock` above Today (soonest first, at most 5, then "See all in Upcoming").
  - **Entry page:** the header's time region shows the range or "All day" and, for writers, the time chip's popover gains end time and all-day; a place row beside the With row (defaulting to the first linked provider's address, editable, with a map action); a Cancelled banner (reason, by whom, Undo for writers) and, after a reschedule, "Rescheduled to …" linking to the new event, with the old notes read-only below.
  - **`EntryActions`:** events get Reschedule and Cancel (or Undo cancel) before Delete, from rows, cards and the entry page. Reschedule opens a sheet: new date and time, then "Keep the old one as cancelled" (default on for an upcoming event, off for a past one), Save.
- **Shared files touched** (add at the end of each group, per the rules across PRDs): the migration, `db/schema` timeline entry, `PERMISSIONS` (none expected), `sync-config.yaml`, the device schema, the upload switch, `routes.ts`, `appUrls`, `GROUP_SECTIONS`, `EntryActions`' item list, `lib/timelineFilters`, `lib/format` (`dayLabel`). Hot with `medications` (content union, `KIND_META`, quick add, the upload switch) and `timeline-polish` (the timeline route folder).
- **Seeds:** a new file with its own ids, appended: for Dev Family, about eight upcoming items over three weeks relative to now (two appointments with providers and places, one with an end time, one all-day, a reminder note, one cancelled, one rescheduled pair) and two past cancelled events; one upcoming appointment for Dev Family 2. Times are relative (`daysAhead`), so seeds stay future after a reset.

## Testing Decisions

- Good tests check behaviour through the public interface: given entries and a time, what's past, upcoming, now and next; given a search string, what the filters are; given content, which issues come back. Not internal helpers or rendering details.
- **Unit (`web:unit`):** `lib/upcoming` (timing at the edges: exactly now, end equals now, all-day across midnight and DST in another zone, cancelled skipped by `nextUp`, ordering), the labels, `dayLabel`'s Tomorrow, the new filter parameter, and the three query builders' conditions (prior art: `entryWindow`, `timelineFilters`, `dayLabel` tests).
- **Unit (`data:unit`):** the content schema per kind (which fields each kind accepts, `ends_at` after start, all-day without an end, cancel fields only on events, `rescheduled_to` only when cancelled) and `isTooFarAhead` (prior art: `timelineEntry.test.ts`, `vitals.test.ts`).
- **Integration:** `timelineEntryService` refuses a future symptom and vital beyond the server skew, accepts a future note and event, refuses event-only fields on a note, and checks `rescheduled_to` is in the group; every role × cancel and reschedule; `sync.upload` round-trips the new columns (prior art: the timeline entry and provider service tests, own fixtures).
- **Device module:** reschedule as one transaction (new entry, links, document state, old cancelled), checked through `window.caretookModules()` as `providers.mjs` does.
- **Browser check `upcoming.mjs`** (new; added to the suite and a `check-areas` rule for the Upcoming route folder, `lib/upcoming` and the new entry header parts): the Next strip and its feedback after saving a later-today event; the toggle and block; the section with filters, contact actions, Add appointment and Add reminder; all-day and "Now"; cancel, undo, both reschedule paths with notes carried over; the Past tab; viewer; offline add and reschedule; two devices; future refused for a vital. Smoke: add an appointment and see it in the strip and the section. `phase2.mjs` gains the default-history assertion (a seeded future item isn't in the history).

## Out of Scope

- Recurring appointments (B-60), reminders by email or push (B-61), an iCal feed (B-62) and Google Calendar (B-63).
- Marking a reminder done: checkable items are the todos feature (B-55).
- A calendar grid (month or week view).
- Appointment types, travel time, rides or who's going (assignment belongs with todos).
- Server-side reads of upcoming items (no oRPC procedure); the assistant's visit prep (B-58) builds on this later.
- Changing how medications' Today section and Due now strip work.

## Further Notes

- **Depends on:** `providers`, `routing`, `components` (done). Its timeline slices wait for `timeline-polish` wave 3 (the timeline route folder). The due-doses slice waits for `medications` slice 5. The schema slice touches the same content union and upload switch as `medications` slice 1: whichever lands second regenerates its migration on top.
- The history window ending at now changes the timeline's paging: "Show older" and infinite scroll (`timeline-polish` slice 7) count past items only.
- `titleSuggestions` already treats a planned event as now; keep that.
- Default for "Keep the old one as cancelled": on when rescheduling an upcoming event, off for a past one (moving a past event's time is usually a correction).
