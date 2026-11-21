# Plan: No more reminders; todos repeat

> Source PRD: [`plans/planner-2-prd.md`](planner-2-prd.md). User-story numbers (US) refer to it. Backlog item B-248 (remove reminders: notes can no longer be dated in the future; use todos instead). Topic `planner-2`.

## Status

| Slice | Wave | State                                                                                                                    | Merge into `prd/planner-2` (slice commits) |
| ----- | ---- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| 1     | 1    | the sonnet agent hit a usage limit at about 12:00 ET with uncommitted work; a `--continue` agent on opus is finishing it |                                            |
| 2     | 1    | handed off (opus), reviewed: 3ff6ccb2, 46ddd08f; check green apart from flakes that passed alone; merges after slice 1   |                                            |
| 3     | 2    | not started                                                                                                              |                                            |
| 4     | 2    | not started                                                                                                              |                                            |
| 5     | 2    | not started                                                                                                              |                                            |
| 6     | 2    | not started                                                                                                              |                                            |
| 7     | 2    | not started                                                                                                              |                                            |

**Landing mode: run everything through** (queued with `pnpm prd queue planner-2`): start every ready slice, land each green wave through the PR + Codex, clean up; ask only real questions. B-248 claimed by prd/planner-2 (2026-11-21). At the wave 1 boundary: `quick-entry` (B-220) is in `dev`; B-247 is still `triaged` (slice 3 waits): the quick-fixes orchestrator says the user held B-247 and B-246 back and no slice is written; it will message planner-2 if it's scheduled and when it lands. A background check watches `dev` for it. Open: ask the user whether to schedule B-247, or land wave 2 without slice 3.

**Other PRDs:** list-filters wave 1 landed in dev (PR #18, f48c0f5; no migration, seed, sync-config or dependency change): `pnpm prd sync` at the wave 1 boundary, before wave 2 starts. list-filters wave 2 changes the Todos tab (TodoChips become a Filter menu; no `?who=` means Everyone; `defaultWho` gives way to `whoOf`/`clearWho`) and one Planner test: it overlaps slice 6 (`routes/app/groups/todos/`). Whichever comes second syncs first.

**Start conditions:** slices 1 and 2 can start at once. **Slice 5 waits for `quick-entry` (B-220, the smarter quick entry box) in `dev`**; **slice 3 waits for B-247 in `dev`** (Planner: Past becomes an Upcoming | Past toggle, with the All / Events / Todos chips; a `quick-fixes` item). `pnpm prd sync` before each.

**Landing:** slice 2 adds a migration (additive: three nullable columns on `todo`); no new dependencies. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. If the rest of wave 2 is merged and B-247 or `quick-entry` still isn't in `dev`, ask the user: wait, or land without that slice and file it as a follow-up. Never `--suite` without asking. After the deploy to staging the user reseeds it (no data migration).

**Backlog:** claim B-248 when slice 1 starts; `done B-248` after the last slice merges.

Fold into the area docs at landing:

- **Slice 1:** [appointments](../docs/domain/appointments.md): the "No new kind" line (a future event is an appointment; notes are past-only), _Future dates_, _Repeating_ (events only), seeds. [timeline](../docs/domain/timeline.md) where it names future notes.
- **Slice 2:** [todos](../docs/domain/todos.md): the repeat columns and checks, `todoRepeat`, tick, reopen, skip, the twin upload. [data-layer](../docs/domain/data-layer.md) and [sync](../docs/domain/sync.md) if the migration or `todoOp` needs a line.
- **Slice 3:** [appointments](../docs/domain/appointments.md) (the Planner's Add menu and rows), [timeline](../docs/domain/timeline.md) (the Today card, simple Next).
- **Slice 4:** [calendars](../docs/domain/calendars.md): the kinds, the sweep, pull, "Remind me"; [notifications](../docs/domain/notifications.md) if its line names reminders.
- **Slice 5:** [assistant](../docs/domain/assistant.md): the future-note reading.
- **Slice 6:** [todos](../docs/domain/todos.md): the form, rows, page, the delete dialog, seeds, the `roundtrip` step.
- **Slice 7:** [connectors](../docs/domain/connectors.md): `upcoming`, the refusal, `repeats`.

## Architectural decisions

- **One future rule:** `FUTURE_KINDS = ["event"]` (`db/schema/core/entryTiming.ts`) and the device's `FUTURE_KINDS_SQL`. Nothing else decides whether a kind may be ahead; every reader of "upcoming" follows these.
- **Nothing is dropped.** `timeline_entry`'s all-day and series columns, `appointment_series.kind` and its check, `reminder_override` and `member_calendar_setting` stay. No data migration: stored future notes and note series are left, hidden from every "upcoming" reader, and never topped up.
- **Series are events only** at the schema (Zod) level and in `topUp`.
- **The calendar projection's kinds are appointment and todo.** A note never gives a calendar item.
- **A repeating todo is one open row.** `todo.repeat_rule`, `repeat_starts_on`, `repeat_id`: all set or none; a rule needs `due_on`. The next occurrence's id is UUID v5 of (`repeat_id`, day), so the device and server converge.
- **`todoRepeat`** is pure and lives in `@caretook/data/series` (rrule stays out of first load; check `pnpm build:budget`). The next day is the first rule day after both the todo's due day and today in the recipient's zone.
- **The server is the author of the next occurrence**; the device's copy is an optimistic twin whose upload is accepted as satisfied when the row exists.
- **Write through the services** (`timelineEntryService`, `todoService`, the series service); RBAC stays in SQL. Completing keeps its permissions: writers, and a viewer on their own todo. Skip is writers only.
- **Wording:** "Can't be in the future" (`FUTURE_DATE_MESSAGE`) for a note ahead; the connector's refusal adds the pointer to `add_todo`.
- **Seeds are fictional**, as always.

## How to run this plan

- **Wave 1: slices 1 and 2** together. Slice 1 owns the entry timing rule, the timeline entry and series services, the entry page's time chip and `seeds/appointments.ts`. Slice 2 owns the `todo` schema and migration, `todoRepeat`, `todoService`, `lib/todos/todos.sync.ts`, the device schema and `todoOp`. They share no file.
- **Wave 2: slices 3 to 7** together, each when its start condition holds.
  - Slice 3 owns `routes/app/groups/planner/`, `lib/appointments/upcoming*.ts` and the timeline's Today card and simple Next files.
  - Slice 4 owns `db/schema/calendars/`, the calendar services, `packages/notifications`' reminders, `lib/calendars/` and `RemindMeSheet`.
  - Slice 5 owns `lib/assistant/` and `db/schema/assistant/`.
  - Slice 6 owns `routes/app/groups/todos/`, `routes/app/groups/todo/`, `components/todos/`, `lib/todos/` display files, `seeds/todos.ts` and the `roundtrip` step.
  - Slice 7 owns `packages/api/src/connectors/`.
  - `entryActionItems.ts` ("Remind me" on events only) is slice 4's; slice 3 doesn't touch it.
- **Stacks:** slice 6 needs one (the `roundtrip` step); the rest are stackless (unit, integration on the shared test Postgres, component tests).
- **Checks:** every slice runs `pnpm check` and `pnpm test:components --changed prd/planner-2`, and `pnpm prd browser --changed` once before hand-off, reporting what it named. Component tests use the Planner's fixed clock and read after render with polling.
- **Running beside other PRDs:** `quick-fixes` (B-246 removes due doses from the Planner, B-247 reworks its tabs and chips, B-251 moves its tabs to `TabNav`): slice 3 starts after B-247 and syncs first. `list-filters` slice 4 changes the Planner's filter row: not alongside slice 3; whichever comes second syncs first. `quick-entry` must be in `dev` before slice 5.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: Notes are past-only

Stack: no · Reads: docs/domain/appointments.md, docs/domain/timeline.md, docs/domain/data-layer.md, docs/domain/sync.md · Tests: unit, integration, component

**User stories:** 1–3, 7, 8.

### What to build

`FUTURE_KINDS` becomes `["event"]`, with the device's `FUTURE_KINDS_SQL` and `futureRefusal` following. The server refuses a note ahead on create and when its time moves; a stored future note stays editable otherwise. The note's time chip on the entry page maxes at now and shows the message; `?when=pick` and `appUrls.newPlannerEntry` are events only (a note link falls back to an ordinary new note). The series schema takes events only for new and edited series, notes show no Repeat field, and `topUp` skips note series. In `seeds/appointments.ts` the reminder and any note series go (slice 6 adds the todos). Other screens may still show a leftover future note until wave 2; that is expected.

### Acceptance criteria

- [ ] `entryTiming.test.ts`: a note beyond the device and server skew is too far ahead; an event is not.
- [ ] Integration (`timelineEntryService`): creating a note ahead is refused; moving a note's time ahead is refused; editing a stored future note's text without moving its time works; an event ahead still works.
- [ ] Integration (the series service): a new or edited series of kind note is refused; `topUp` writes no visits for a stored note series and still tops up event series.
- [ ] Unit or sync tests (`timeline.sync.test.ts`, `timelineWindows.sync.test.ts`): the device refuses a note ahead; the upcoming window holds events only.
- [ ] Component: the entry page's note time chip can't go past now and shows "Can't be in the future"; a note has no Repeat field; an event's chip and Repeat are unchanged.
- [ ] Seeds load with no future note and no note series.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** slices 3, 4, 5, 7.

---

## Slice 2: Repeating todos, the data

Stack: no · Reads: docs/domain/todos.md, docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/appointments.md · Tests: unit, integration

**User stories:** 15–22, 24, 25, 27, 28.

### What to build

Adds a migration: `repeat_rule`, `repeat_starts_on` and `repeat_id` on `todo` with their checks, in the schema, the sync stream, the device schema and `todoOp`. `todoRepeat` (`nextDueDay`, `nextTodoId`, `nextOccurrence`) beside `seriesVisits`. `todoService`: `create` and `update` take a repeat (a rule or due-day change resets the anchor; clearing clears all three); `complete` inserts the next occurrence once; `reopen` soft-deletes an untouched next, else the reopened todo loses its repeat; `skip` (writers). The device's `createTodo`, `updateTodo`, `completeTodo`, `reopenTodo` and a new `skipTodo` do the same in one local transaction. The upload of the twin row is accepted as satisfied when the server already has it. No screen changes: the form gets its field in slice 6.

### Acceptance criteria

- [ ] `todoRepeat` unit tests: weekly, every 2 weeks from the anchor, monthly by date and "last Friday"; a tick three weeks late gives the next rule day after today; COUNT and UNTIL end the chain (null); the id is stable for (chain, day); the next occurrence carries title, assignee, time, provider and medication links and the rule, not the appointment link or done state.
- [ ] Schema tests: the three columns are all set or none; a rule without a due day is refused.
- [ ] Integration (`todoService`): `complete` on a repeating todo leaves it done and one open next todo; completing again, or from a second caller, makes no second one; a viewer completing their own repeating todo gets the next; `reopen` removes an untouched next and keeps an edited one (the reopened todo then has no repeat); `skip` soft-deletes and creates the next, and is refused for a viewer; an ended rule makes none.
- [ ] Integration (sync upload): a device's tick and its twin row upload cleanly for a writer and for a viewer on their own todo; two devices ticking the same todo end with one next todo.
- [ ] Device tests (`todos.sync`): tick, Undo, skip and edit behave as on the server, each in one transaction.
- [ ] `pnpm build:budget` shows rrule still outside first load.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** slices 6, 7.

---

## Slice 3: The Planner, Today card and simple Next without reminders

Stack: no · Reads: docs/domain/appointments.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**User stories:** 4–6.

### What to build

`PlannerHeader`'s Add menu is Appointment and Todo. Remove what is left of the reminder kind after B-247: the note label in `upcomingLabels` ("Reminder"), the Reminders wording and note kind in `upcomingFilters`, comments and fixtures (`plannerWorld`). `upcomingQuery` already reads events only (slice 1); the Today card (`useTodayCard`, `todayStatus`), `SimpleNext` and `useSimpleUpcoming` drop their reminder wording and any note branch. `plannerTodos`' merge is appointments and todos.

### Acceptance criteria

- [ ] `planner.browser.test.tsx`: the Add menu lists Appointment and Todo only; a stored future note shows in no Planner row; appointments and todos show as before.
- [ ] `upcomingFilters.test.ts`, `upcoming.test.ts`, `todayStatus.test.ts`: no reminder kind or wording; a future note is never "next".
- [ ] The Today card and simple Next component tests (`timelineSimpleNow`, `timelineStrips`): the next item is an appointment; a future note never appears.
- [ ] No "Reminder" text is left in the Planner, the Today card or simple mode.
- [ ] `pnpm check` passes.

**Blocked by:** slice 1; B-247 in `dev`. **Blocks:** none.

---

## Slice 4: Calendars without the reminder kind

Stack: no · Reads: docs/domain/calendars.md, docs/domain/notifications.md, docs/domain/api.md · Tests: unit, integration, component

**User stories:** 9–11.

### What to build

`CALENDAR_ITEM_KINDS` is appointment and todo; remove `isReminder`, the note branch of `entryKind`, the reminder default length and the "Reminder" wording in `calendarText`. Notes leave the feed, Google push, the pull plan's reminder branch and the sweep's selection; `reminderPlan` covers appointments and todos. "Remind me" (`canRemind`, `entryActionItems`) is events only. The settings page's wording says appointments and todos. Tables are unchanged.

### Acceptance criteria

- [ ] `calendarItems.test.ts`, `calendarText.test.ts`, `reminderPlan.test.ts`: a note, past or future, gives no item; appointments and todos are unchanged; no reminder kind or wording.
- [ ] The golden `.ics` and `calendars.int.test.ts`: the feed has appointments and todos only.
- [ ] Integration: `reminders.int.test.ts` sends for an appointment and a todo's assignee and nothing for a stored future note; the Google push and pull plans ignore notes.
- [ ] `remindMe.test.ts` and `plannerRemind.browser.test.tsx`: "Remind me" on an appointment only.
- [ ] `calendarReminders.browser.test.tsx`: the settings cards read appointments and todos.
- [ ] `pnpm check` passes.

**Blocked by:** slice 1. **Blocks:** none.

---

## Slice 5: Quick entry makes a todo, not a reminder

Stack: no · Reads: docs/domain/assistant.md, docs/domain/todos.md · Tests: unit, component

**User stories:** 12–14.

### What to build

In `noteReading`, a note that says a future time becomes an `addTodo` action: the title is the line without its time words, `dueOn` the day, `dueTime` the time when given. The card shows the Todo chip, with Note as the other choice (a note now, with the full text). A future time on a note is otherwise a blocking warning. A bare weekday or day of the month on a note reads back, like the other past-only kinds. The vocabulary table gets rows for these lines. The server twin (`assistantActionService`) refuses a note ahead through the service rule.

### Acceptance criteria

- [ ] `quickEntry.test.ts` and the vocabulary rows: "call the pharmacy tomorrow" gives a todo due tomorrow; "call the pharmacy tomorrow 3pm" adds 15:00; "next friday pick up walker" gives a todo that Friday; "called the pharmacy" stays a note now; "dizzy monday" and a note with a bare weekday read back; provider lines still make events.
- [ ] A note action with a future time is a blocking warning and `runActions` refuses it.
- [ ] Component (the quick entry box): the card for a future note line shows Todo with Note one tap away; Save makes the todo with Undo; choosing Note saves a note dated now.
- [ ] `pnpm check` passes.

**Blocked by:** slice 1; `quick-entry` (B-220) in `dev`. **Blocks:** none.

---

## Slice 6: Repeating todos, the screens

Stack: yes · Reads: docs/domain/todos.md, docs/domain/components.md, docs/domain/appointments.md, docs/domain/sync.md · Tests: unit, component, e2e:roundtrip

**User stories:** 15–17, 20, 23–26, 33.

### What to build

`TodoForm` gets `RepeatField` and `RepeatSheet`, disabled until a due day is set, clearing with it. Rows (the Todos tab, the Planner, the Today card, the simple view) show `RepeatMark` with a text name; the todo page shows the rule in words (`repeatText`). The tick and its Undo use slice 2's writes, so the next occurrence appears and goes with Undo. Delete on a repeating todo opens a native `<dialog>`: "Skip this one", "Delete and stop repeating", Cancel. `seeds/todos.ts` gains the todo that replaces the old reminder, a weekly repeating todo and a done occurrence of it. `roundtrip` gets one step.

### Acceptance criteria

- [ ] Component (the sheets): Repeat is disabled without a due day; a weekly rule saves and reopens as chosen; turning it off makes an ordinary todo.
- [ ] Component (the list and the page): a repeating todo has the mark, named for screen readers, and "Repeats weekly on Monday" on its page; ticking it moves it to Done and shows the next under its day; Undo removes the next and reopens it.
- [ ] Component (delete): the dialog's three buttons; Skip removes this one and shows the next; Stop removes it with no next; an ordinary todo keeps its existing confirm.
- [ ] Unit (`todoDisplay` or `todoList`): the repeat wording and where the next one sorts.
- [ ] `roundtrip`: a repeating todo ticked offline on one device shows done with one next todo on the other device and the server.
- [ ] Seeds load; the repeating todo shows in the Planner and the Todos tab.
- [ ] `pnpm check` passes.

**Blocked by:** slice 2. **Blocks:** none.

---

## Slice 7: The connector: upcoming with todos, no future notes

Stack: no · Reads: docs/domain/connectors.md, docs/domain/todos.md, docs/domain/api.md · Tests: unit, integration

**User stories:** 30–32.

### What to build

`upcoming` becomes "Upcoming appointments and todos": events as today, plus open todos with a due day from overdue through the window, overdue first, each item `appointment` or `todo` (a todo has `id`, `title`, `dueOn`, `dueTime`, `overdue`, `assignee`, `repeats`); its description points to `todays_doses` for doses. `add_note`, `update_entry` and `append_to_entry` return the refusal for a note ahead: "A note can't be in the future. Use add_todo with a due day for something to do later."; their descriptions say notes are for what has happened. `list_todos` items gain `repeats`. The server instructions and prompts name todos, not reminders. `add_todo` takes no repeat.

### Acceptance criteria

- [ ] `readTools.int.test.ts`: `upcoming` lists an appointment, an overdue todo first, a todo due in the window and none beyond it, no done or undated todo, and no stored future note; the text lines read "appointment" or "todo"; a repeating todo has `repeats`; `list_todos` has it too.
- [ ] `mcpWrites.int.test.ts` and `writes.test.ts`: `add_note` with a future time returns the refusal and writes nothing; `update_entry` moving a note ahead does the same; `add_event` ahead still works; `add_todo` with a due day works.
- [ ] The tool list's descriptions and the server instructions contain no "reminder" for notes.
- [ ] `pnpm check` passes.

**Blocked by:** slices 1 and 2. **Blocks:** none.
