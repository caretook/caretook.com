# Plan: Appointments

> Source PRD: [`plans/appointments-prd.md`](appointments-prd.md). User-story numbers (US) refer to it. Backlog item B-47 (follow-ups B-60 recurring, B-61 reminders, B-62 iCal, B-63 Google Calendar are not part of this plan). Topic `appointments`.

## Status

| Slice | State                                                      | Merge into `prd/appointments` (slice commits) |
| ----- | ---------------------------------------------------------- | --------------------------------------------- |
| 1     | landed in `dev` (`1abaa58`); migration `0015_appointments` | `8881e85` (`5f58d49`…`e7bafce`)               |
| 2     | landed in `dev` (`3298d57`)                                | `f634977` (`69ee899`, `d14c8ca`)              |
| 3     | landed in `dev` (`3298d57`)                                | `3c16021` (`3f6c48c`, `6bbf62c`)              |
| 4     | landed in `dev` (`3298d57`)                                | `b1c1f7c` (`1395252`, `a00c38b`)              |
| 5     | landed in `dev` (`9cafb09`)                                | `2102d41` (`37fc21c`, `e623a6a`)              |
| 6     | landed in `dev` (`3298d57`)                                | `ea9de0c` (`11b210c`, `15f4ec3`)              |
| 7     | blocked by `medications` slice 5                           |                                               |

Backlog: B-47 is claimed by `prd/appointments`; mark it `done` after the last slice merges. The user said to land every wave without asking, and to clean up at the end. Slice 1 decided that doses are not future kinds (refused over 1 h ahead on the server, 5 min on the device).

Fold into AGENTS.md at the final landing: the Upcoming section and its route folder, `lib/upcoming*`, `lib/entrySchedule`, `lib/entryPlace`, `lib/eventCancel`, `lib/sync/appointments`, the timeline's history window and Next strip/Upcoming block, the moves to `components/entry/` (`EntryBody`, `OlderEntries`, `MedicationEntryText`), `components/schedule/` (`ScheduleFields`, `RescheduleSheet`, lazy), `lib/eventReschedule`, `removeEntry` clearing `rescheduled_to` and `lib/paging`, `lib/sync/useLiveRows`, the four group sections, and `scripts:unit`'s 20 s timeout. Run checks under `caffeinate -i` at night (the Mac sleeps and stalls them).

## Architectural decisions

Durable decisions every slice follows:

- **No new kind.** A future event is an appointment, a future note a reminder. "Upcoming" is **worked out, never stored**: upcoming while the start is after now, or with an end time while the end is after now; an all-day item through the end of its day in the entry's own `time_zone`. Between start and end it's "now" (in Upcoming as "Now · until …", and in the history from its start).
- **Future kinds:** only notes and events may be dated in the future. Symptoms, vitals and `medications`' dose and change kinds are refused beyond now + 5 min on the device and now + 1 h on the server (a rejected upload is dropped, so a fast device clock must not lose a real vital). The issue is on `occurredAt`: "Can't be in the future".
- **Schema** (one pending migration for the PRD, made in slice 1; regenerate it on top if a sync brings in another), all on `timeline_entry`:
  - `ends_at` timestamptz (events; after `occurred_at`; null when all-day).
  - `all_day` boolean, default false (notes and events; `occurred_at` is the start of the day in `time_zone`).
  - `place` text (events; limited like the title).
  - `cancelled_at` timestamptz, `cancelled_by` (user id, audit-style, not an FK), `cancel_reason` text (events). Cancelled ⇔ `cancelled_at` set.
  - `rescheduled_to` uuid (events, only when cancelled): composite FK `(group_id, rescheduled_to)` → `timeline_entry (group_id, id)`, `ON DELETE SET NULL (rescheduled_to)`.
  - Other kinds refuse these fields. Read the generated SQL and reorder by hand if drizzle-kit misorders it.
- **Routes** (children of the group route, built through `appUrls`):
  - `upcoming` (`?kind=`, `?author=`): the Upcoming section; `upcoming/past`: the Past tab (past events, newest first, cancelled included).
  - `entries/new?kind=event|note&when=pick`: a draft that opens the time picker first (9:00 once a day is picked).
  - `timeline?upcoming=1`: the timeline's Upcoming block.
  - Reschedule is a `Sheet` opened in place from the event's menu (timeline, Upcoming, entry page), with no URL of its own: it has three parents, and it's never deep-linked.
- **Group section:** one `GROUP_SECTIONS` entry, Upcoming (lucide `CalendarClock`), appended after the last one; `match` claims `/upcoming/*`.
- **Permissions:** unchanged. Everything is a timeline entry: any member reads, writers create, update, cancel and reschedule; delete stays soft.
- **Sync:** the new columns join `timeline_entry`'s stream query (explicit columns), the device schema and the upload switch's PUT and PATCH mapping (`all_day` as 1/0). No new tables, no new procedures.
- **One time-rules module** (pure, web) decides timing, ordering and "next" for every screen; the history, upcoming and past windows are pure query builders sharing `entryWindow`'s filter conditions; the history window ends at a cutoff from a once-a-minute clock, so items cross over without new rows.
- **Reschedule** keeping the old one is **one local transaction**: the new event, its provider links (`entryProviderId`), its `note_document` plus one `note_update` carrying the old document's full Yjs state (devices can't write snapshots), and the old event cancelled with `rescheduled_to`. Just moving is an ordinary time update.
- **Registries are appended to, never reordered:** `sync-config.yaml`, the upload switch, the device schema, `routes.ts`, `appUrls`, `GROUP_SECTIONS`, `entryActionItems`, `lib/timelineFilters`.
- **UI building blocks:** `components/ui/` primitives and feature folders only (AGENTS.md, _Components_); a new pattern used twice becomes a primitive. `DateTimeField` gains an optional maximum.
- **No new dependencies.**

## How to run this plan

- **Slice 1 can start now.** It touches `packages/`, `powersync/`, the device schema, the seeds, pure modules and the sheets' date maximum, and needs a stack. **`medications` slice 1 is changing the same content schema and upload switch**: if it lands in `dev` first, sync before merging slice 1 and regenerate this migration on top.
- **2 and 3 after 1, in parallel.** 2 owns the entry page header; 3 owns the new `upcoming` route folder. 3's Add buttons link to `?when=pick`, which opens the picker once 2 has merged.
- **4 after 2** (it adds to the entry page header and `EntryActions`). **5 after 4.**
- **6 after 1 and after `timeline-polish` wave 3 lands** (slice 7 rewrites paging in `useTimelineData`, which 6 changes). Sync `dev` first. It can run in parallel with 4 and 5.
- **7 after 3 and after `medications` slice 5 lands** (`dueDoses`). Sync `dev` first.
- Merge in number order (6 may merge before 4 and 5 if ready first). Per AGENTS.md's _Browser check budget_, loops run `pnpm prd browser --changed` before hand-off and the orchestrator runs the suite once at landing. Run `pnpm datastore:reset` and `docker compose restart powersync` after slice 1, and after any sync that brings a migration.
- **Land in waves:** 1 (data, behind no screen); then 2 and 3 (appointments you can add and see); then 4, 5 and 6 (cancel, reschedule, the timeline); then 7.
- Every slice ends with `pnpm check`, `pnpm build:native`, its browser checks and a hand-off (AGENTS.md, _Loop rules_).
- A new screen or check adds its rule to `scripts/loops/check-areas` (slice 3 adds `upcoming.mjs` for the `upcoming` route folder and the time-rules module).

```
1 ──┬── 2 ── 4 ── 5
    ├── 3 ──────────── 7 ← medications 5
    └── 6 ← timeline-polish wave 3
```

---

## Slice 1: The data layer and the time rules

**User stories:** US 14–16, 57, 60–63. **Blocked by:** none. **Blocks:** 2, 3, 6.

### What to build

The new `timeline_entry` columns (end time, all-day, place, the cancel fields, `rescheduled_to`) in one migration, with the content schema's per-kind rules (which kinds accept which fields; end after start; all-day without an end; cancel fields and `rescheduled_to` on events only, `rescheduled_to` only when cancelled and in the same group) and the future-date rule (future kinds, device and server skew). `timelineEntryService` enforces both on create, upsert and update. The columns join the stream query, the publication if needed, the device schema and the upload switch, and the device's local writes validate them the same way.

The pure time-rules module (timing past, upcoming or now; soonest-first order with all-day first in a day; next plus a count, skipping cancelled), the labels (time range, "All day", "Now · until …", "Cancelled", "Rescheduled to …", the Next strip text), "Tomorrow" in `dayLabel`, and the three query builders (history to a cutoff, upcoming within 90 days, past events), each with unit tests. `DateTimeField` takes an optional maximum, and the symptom and vital sheets set it to now. Fictional seeds in their own file with their own ids, placed relative to now (`daysAhead`): about eight upcoming items for Dev Family over three weeks (two appointments with providers and places, one with an end time, one all-day, a reminder note, one cancelled, one rescheduled pair) and two past cancelled events; one upcoming appointment for Dev Family 2.

### Acceptance criteria

- [ ] Integration tests: a future symptom or vital beyond the server skew is refused with the `occurredAt` issue; a future note and event are accepted; a note with an end time or place, or a symptom with cancel fields, is refused; `rescheduled_to` in another group, or on an uncancelled event, is refused; every role × setting and clearing the new fields.
- [ ] Upload tests: PUT and PATCH round-trip every new column (`all_day` as 1/0); a refused future vital is acknowledged as rejected.
- [ ] Unit tests (`data:unit`): the content schema per kind and the future-date rule at its edges; the seeds validate against the content schema.
- [ ] Unit tests (`web:unit`): timing at exactly now, end equal to now, all-day across midnight and a DST change in another zone; ordering; next skipping cancelled; every label; "Tomorrow"; the three query builders' conditions with and without filters.
- [ ] The symptom and vital sheets can't pick a time after now; a vital saved "now" on a clock 2 minutes fast saves.
- [ ] After `pnpm datastore:reset` and a PowerSync restart, `window.caretookSync` shows the seeded upcoming items with their new columns; Dev Family 2's member sees only its own.
- [ ] The timeline, entry page and sheets render unchanged; `roundtrip.mjs`, `phase2.mjs` and `live-notes.mjs` pass (seeded future items still show at the top of the timeline until slice 6).

---

## Slice 2: Appointment details on the entry page

**User stories:** US 1–3, 8–13, 58, 59. **Blocked by:** 1. **Blocks:** 4.

### What to build

On the entry page for notes and events: the time region shows the range ("10:30–11:15") or "All day", and for writers the time chip's popover gains an end time (events) and an all-day switch (notes and events). Events get a place row beside the With row: empty shows the first linked provider's address as its default (greyed, "from <provider>"), writers can type a place, and either has a map action. `entries/new?kind=…&when=pick` opens the time popover on arrival, with the time set to 9:00 once a day is picked; nothing is saved until the first real change, as today. Viewers see the details with no controls.

### Acceptance criteria

- [ ] A writer adds an appointment through `?when=pick`: the picker opens first, a day gives 9:00, and the saved entry has that time; Back before any change saves nothing.
- [ ] End time and all-day save, show on the page after a reload, and reach a second device; an end before the start shows the field error.
- [ ] The place defaults to the first linked provider's address, a typed place replaces it, and the map action opens a maps search for whichever shows.
- [ ] A viewer sees range, all-day and place with no controls.
- [ ] Offline edits sync on reconnect.
- [ ] `live-notes.mjs` covers the above (or `upcoming.mjs` if slice 3 has merged); `providers.mjs` passes.

---

## Slice 3: The Upcoming section

**User stories:** US 7, 25–36, 55, 56. **Blocked by:** 1. **Blocks:** 7.

### What to build

The Upcoming group section and the `upcoming` route: live from local data, grouped by day soonest first (Today, Tomorrow, then dated headings), all-day items first in their day, an item in progress at the top as "Now · until …", cancelled items struck through and labelled. Each row reuses the entry body with the time range, place and "with …" line, plus call (first linked provider) and map (the place) actions, and opens the entry. Kind and author filter chips in the URL. Writers get **Add appointment** and **Add reminder** (`entries/new?kind=event|note&when=pick`). The `upcoming/past` tab lists past events newest first with cancelled ones included, paged like the timeline. An empty state for each. Start `upcoming.mjs` and its `check-areas` rule.

### Acceptance criteria

- [ ] The tab bar (420) and header nav (1280) show Upcoming after the existing sections, with `aria-current` on the right one.
- [ ] The seeded items show soonest first by day, all-day first, the cancelled one struck through, the reminder note among them; filters survive a reload.
- [ ] An entry whose time passes leaves Upcoming within a minute without a reload; one with an end time shows "Now · until …" until it ends.
- [ ] Call and map actions are on rows that have a provider or a place.
- [ ] Add appointment and Add reminder open drafts at `?when=pick` for writers; viewers see neither.
- [ ] The Past tab lists past events newest first, including the seeded cancelled ones.
- [ ] Works offline from the device's copy; a non-member's URL is the 404.
- [ ] `upcoming.mjs` covers the above; `app-shell.mjs` and `routing.mjs` pass.

---

## Slice 4: Cancel and undo cancel

**User stories:** US 39–44, 52. **Blocked by:** 2. **Blocks:** 5.

### What to build

`entryActionItems` gives events Cancel (or Undo cancel when cancelled) before Delete, for writers, on rows, cards, Upcoming rows and the entry page. Cancel opens a `ConfirmDialog` with an optional reason; it's a local write of the cancel fields, past events included. The entry page shows a Cancelled banner (reason, by whom, when; Undo for writers). Cancelled events are struck through and labelled on the timeline, in Upcoming and Past, and never count as "next". Delete is unchanged.

### Acceptance criteria

- [ ] A writer cancels an upcoming and a past event with and without a reason; both show struck through and labelled everywhere, and on a second device.
- [ ] Undo cancel restores the event; the banner and labels go.
- [ ] A cancelled appointment isn't "next" in the time rules (unit-tested in slice 1) or in Upcoming's Now/first position.
- [ ] Viewers see the banner and labels but no Cancel or Undo; the server refuses a viewer's cancel.
- [ ] Offline cancel syncs on reconnect.
- [ ] Unit tests for the new menu items by kind, state and role.
- [ ] `upcoming.mjs` covers the above; `ui.mjs` and `live-notes.mjs` pass.

---

## Slice 5: Reschedule

**User stories:** US 45–51, 53, 54, 64. **Blocked by:** 4. **Blocks:** none.

### What to build

Events get Reschedule in their menu, opening the reschedule sheet: a new date and time (and end time, all-day), then "Keep the old one as cancelled" (on by default for an upcoming event, off for a past one), Save. Off: an ordinary time update. On: the one-transaction reschedule write (new event with the same title, place, end offset and all-day; its provider links; its document seeded from the old document's state; the old event cancelled with `rescheduled_to`), then the sheet opens the new event. The cancelled event's page shows "Rescheduled to <day>" linking to the new one, with its earlier notes read-only below; Upcoming and Past show the same link text on the cancelled row.

### Acceptance criteria

- [ ] "Just move": the event keeps its id, notes and links at the new time.
- [ ] "Keep the old one": a new event at the new time with the same title, providers and notes text; the old one cancelled, linking to it, with its notes read-only; the new one's notes keep editing live on two devices.
- [ ] The whole reschedule is one local transaction (checked through the device module, as `providers.mjs` does): an injected failure leaves neither event changed.
- [ ] Offline reschedule syncs on reconnect, and the new event's notes match on both devices.
- [ ] Deleting the new event leaves the old one cancelled with no link.
- [ ] Viewers see no Reschedule; the server refuses a viewer's reschedule writes.
- [ ] `upcoming.mjs` covers the above; `live-notes.mjs` and `providers.mjs` pass.

---

## Slice 6: Upcoming on the timeline

**User stories:** US 4–6, 17–24. **Blocked by:** 1, `timeline-polish` wave 3. **Blocks:** none.

### What to build

The timeline's history ends at now (through the history window; paging and infinite scroll count past items only). A **Next strip** below the latest vitals, viewers too, whenever something is upcoming: "Next: <title> · <when> · +N more", linking to the entry, with "Show upcoming" beside it. `?upcoming=1` (in `lib/timelineFilters`, kept with the other filters) adds an **Upcoming block** above Today: up to 5 items soonest first in the timeline's own row or card view, then "See all in Upcoming". The block respects the kind and author filters.

### Acceptance criteria

- [ ] By default the seeded future items aren't in the history; the Next strip names the soonest one with the right count.
- [ ] Saving an event for later today shows it in the Next strip at once.
- [ ] Show upcoming adds the block above Today, survives a reload, combines with the kind and author filters, and its link opens Upcoming with the same filters.
- [ ] An item whose time passes moves from the block (and strip) into the history within a minute, without a reload.
- [ ] Rows and cards, 420 and 1280, writer and viewer.
- [ ] `phase2.mjs` gains the default-history and strip assertions; `upcoming.mjs` covers the toggle; `roundtrip.mjs` and `live-notes.mjs` pass.

---

## Slice 7: Due doses in Upcoming

**User stories:** US 37, 38. **Blocked by:** 3, `medications` slice 5. **Blocks:** none.

### What to build

An adapter turns `medications`' `dueDoses` slots for today that are upcoming, due or overdue into Upcoming items under Today, in time order among appointments and reminders, with their state ("Due", "Overdue"). Each opens the Dose sheet for that medication and slot (`timeline/new/dose?medication=…&slot=…`) for writers; viewers see them without a link. They're never written as entries, and a logged dose drops out at once.

### Acceptance criteria

- [ ] The seeded medications' remaining doses for today show in Upcoming under Today, ordered with the day's other items.
- [ ] Logging one through its link removes it from Upcoming without a reload, on a second device too.
- [ ] Viewers see the doses but no link.
- [ ] Unit tests for the adapter (slots in, items out, given ones dropped).
- [ ] `upcoming.mjs` and `medications.mjs` pass.
