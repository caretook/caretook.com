# PRD: No more reminders; todos repeat

Backlog: B-248 (remove reminders: notes can no longer be dated in the future; use todos instead). Topic `planner-2`. Areas: [appointments](../docs/domain/appointments.md), [todos](../docs/domain/todos.md), [calendars](../docs/domain/calendars.md), [assistant](../docs/domain/assistant.md), [connectors](../docs/domain/connectors.md).

## Problem Statement

The app has two ways to say "do this later". A **reminder** is a note dated in the future; a **todo** has a due day, an assignee and a tick. They show up side by side in the Planner, the Today card, calendars and emails, and a caretaker has to guess which to use. A reminder can't be assigned or ticked off, so it just slides into the timeline when its time passes, done or not.

Reminders have one thing todos lack: they can repeat ("bins out every Monday").

## Solution

- **Reminders go away.** A note is something that happened: it can no longer be dated in the future. Only events (appointments) can.
- **Todos take their place everywhere** a reminder showed: the Planner, the Today card, simple mode's Next, calendars, emails, quick entry and connected assistants.
- **Todos can repeat**, with the same choices as repeating appointments. A repeating todo is one open todo: ticking it keeps it as done and makes the next one.
- **Quick entry:** a line that used to make a reminder ("call the pharmacy tomorrow") makes a todo due that day.
- **Connected assistants:** `upcoming` lists appointments and dated todos; a note with a future time is refused with a pointer to `add_todo`.
- **No data migration.** Nothing is live; seeds change, and staging is reseeded after the deploy.

## User Stories

1. As a caretaker, I want one way to plan something for later (a todo), so that I never wonder whether to make a reminder or a todo.
2. As a caretaker, I want a note's time to stop at now, so that notes are always a record of what happened.
3. As a caretaker, I want a clear message ("Can't be in the future") if I try to move a note ahead, so that I know to make a todo instead.
4. As a caretaker, I want the Planner's Add menu to offer Appointment and Todo only, so that the choice is obvious.
5. As a caretaker, I want the Planner to show appointments and todos only, so that it reads as one plan.
6. As a caretaker, I want the Today card's next item and simple mode's Next to be appointments (with todos as they show today), so that no reminder appears there.
7. As a caretaker, I want repeating appointments to keep working exactly as before, so that weekly PT is untouched.
8. As a caretaker, I want notes to have no Repeat choice, so that I can't make a repeating reminder by another door.
9. As a member with a calendar feed or Google Calendar connected, I want appointments and todos there and no reminders, so that my calendar matches the app.
10. As a member with reminder emails on, I want emails for appointments and for todos assigned to me, as today, so that nothing I rely on stops.
11. As a caretaker, I want "Remind me" on appointments only, so that the per-item email choice stays where it makes sense.
12. As a caretaker, I want "call the pharmacy tomorrow" in quick entry to make a todo due tomorrow, so that the line I always typed still works.
13. As a caretaker, I want "call the pharmacy tomorrow 3pm" to make a todo due tomorrow at 3:00 PM, so that the time isn't lost.
14. As a caretaker, I want that card to show a Todo chip before I save, so that I can see what Save will make.
15. As a caretaker, I want a todo to repeat daily, weekly on chosen days, or monthly (by date or "last Friday"), every N, with an optional end, so that it matches how appointments repeat.
16. As a caretaker, I want a repeating todo to need a due day, so that the repeat has somewhere to start.
17. As a caretaker, I want ticking a repeating todo to keep it under Done and show the next one on its next day, so that the list has one open copy at a time.
18. As a caretaker, I want a repeating todo I tick late to come back on the next scheduled day after today, so that missed weeks don't pile up.
19. As a caretaker, I want a repeating todo I never tick to stay overdue, so that it isn't silently skipped.
20. As a caretaker, I want Undo after a tick to take the next one away again, so that a mistaken tick leaves no stray todo.
21. As a caretaker, I want the next one to keep the title, assignee, time, provider and medication links and the repeat, so that I set it up once.
22. As a caretaker, I want each occurrence to have its own notes, so that this week's notes don't carry to next week.
23. As a caretaker, I want Delete on a repeating todo to ask "Skip this one" or "Delete and stop repeating", so that I can do either.
24. As a caretaker, I want editing a repeating todo's title, assignee, time or repeat to hold for later ones, so that a change sticks.
25. As a caretaker, I want to turn a repeat off by editing the todo, so that it becomes an ordinary todo.
26. As a caretaker, I want a repeat mark on a repeating todo's row and "Repeats weekly on Monday" on its page, so that I can tell it repeats.
27. As a helper (viewer) with a repeating todo assigned to me, I want ticking it to bring the next one, so that it works for me as for writers.
28. As a caretaker working offline, I want ticking a repeating todo to show the next one at once, and two devices ticking the same todo to end with one next todo, so that sync never doubles it.
29. As a member with a calendar connected, I want a repeating todo's current occurrence on my calendar, so that it shows like any dated todo.
30. As a member with a connected assistant, I want "what's coming up?" to list appointments and dated todos together, overdue todos first, so that one call answers it.
31. As a member with a connected assistant, I want it told plainly that a note can't be in the future and to add a todo instead, so that it does the right thing.
32. As a member with a connected assistant, I want it to see that a todo repeats, so that it can tell me.
33. As a screen-reader user, I want the delete dialog's two choices as named buttons and the repeat mark to have a text name, so that nothing depends on the icon.

## Implementation Decisions

### Notes are past-only

- **One rule:** `FUTURE_KINDS` is `["event"]` (`db/schema/core/entryTiming.ts`), mirrored by the device's `FUTURE_KINDS_SQL` (`lib/timeline/timeline.sync.ts`). Notes get the skew every past-only kind has: now + 5 min on the device, now + 1 h on the server, message "Can't be in the future".
- **The server** (`timelineEntryService.refuseFuture`): on create, and on update only when `occurredAt` moves, as today, so a leftover future note stays editable.
- **The device:** `futureRefusal` covers notes; the note's time chip maxes at now; `entries/new?kind=note&when=pick` no longer opens the picker for notes (`WHEN_PICK` is events only); `appUrls.newPlannerEntry` takes events only.
- **All-day notes stay** (a past note can be all-day). The `all_day` and series columns on `timeline_entry` stay; nothing is dropped.
- **Series are events only.** The series schema accepts `kind: "event"` only for new and edited series; notes show no Repeat field; `appointmentSeriesService.topUp` skips a series whose kind is note. The `kind` column and its check stay.
- **Leftover rows:** no migration. A future note already stored is hidden from the Planner, the Today card, Next, calendars and the connector's `upcoming`, stays hidden from the timeline until its time comes (`historyWindow`, as today), then reads as an ordinary note.

### Screens

- **The Planner:** `PlannerHeader`'s Add menu is Appointment and Todo. `upcomingQuery` and `upcomingWindow` read events only; the "Reminder" label for an untitled note (`upcomingLabels`) and the Reminders wording in `upcomingFilters` go. The chips row (All, Events, Todos) and the Upcoming | Past control are B-247's (a `quick-fixes` item); this PRD removes only what is left of the reminder kind there.
- **The Today card and simple mode's Next** (`useTodayCard`, `todayStatus`, `SimpleNext`, `useSimpleUpcoming`) follow `upcomingQuery`: appointments only; todos as today.
- **"Remind me"** (`canRemind`, `entryActionItems`): events only.

### Calendars

- `CALENDAR_ITEM_KINDS` is appointment and todo. `isReminder` and the note branch of `entryKind` go, with `DEFAULT_ITEM_MINUTES.reminder` and the "Reminder" wording in `calendarText`.
- Notes leave the feed, Google push (`calendarSyncService`), Google pull (`pullPlan`'s reminder branch) and the sweep (`calendarReminderService` selects events). `reminderPlan` covers appointments and todos.
- `reminder_override` and `member_calendar_setting` are unchanged. A Google event pushed earlier for a note is not cleaned up (staging is reseeded).

### Quick entry

- `noteReading`: a note that says a future time becomes an `addTodo` action: the title is the line without its time words, `dueOn` the day, `dueTime` the time when one was given. It saves directly, like other todos from quick entry; the card shows the Todo chip, with Note as the other choice (a note now, with the full text).
- A future time on a note is otherwise a **blocking** warning, like any past-only kind.
- Built on `quick-entry` (B-220): its vocabulary table, date reading (forward for events, back for past-only kinds) and kind chips. Notes join the past-only kinds for a bare weekday or day of the month unless the line says a future time.

### Connector

- **`upcoming`**: title "Upcoming appointments and todos". Items are `appointment` or `todo`: events as today, plus open todos with a due day from overdue through the window. Overdue todos come first, then by day, all-day and undated-time items first in a day. A todo item has `id`, `kind`, `title`, `dueOn`, `dueTime`, `overdue`, `assignee`, `repeats`. The description points to `todays_doses` for medication doses.
- **`add_note`, `update_entry`, `append_to_entry`:** a future time on a note is refused with "A note can't be in the future. Use add_todo with a due day for something to do later." The tool descriptions say notes are for what has happened.
- **`list_todos`** items gain `repeats` (the rule in words, or null). `add_todo` does not take a repeat.
- **Server instructions and prompts** name todos, not reminders.

### Repeating todos

- **Columns on `todo`** (one additive migration): `repeat_rule` (RRULE text, the grammar `appointment_series.rule` takes), `repeat_starts_on` (date: the chain's first due day, the rule's anchor) and `repeat_id` (UUID shared by the chain; the first todo's id). All nullable. Checks: all three set or none; a rule needs `due_on`. In the sync stream, the device schema and `todoOp`.
- **`todoRepeat`** (pure, in `@caretook/data/series` beside `seriesVisits`, so rrule stays out of first load):
  - `nextDueDay(rule, startsOn, dueOn, today)`: the first rule day after both `dueOn` and today; null when the rule has ended (COUNT or UNTIL).
  - `nextTodoId(repeatId, day)`: UUID v5, as `seriesVisitId`.
  - `nextOccurrence(todo, today)`: the next todo's content, or null. It carries the title, assignee, due time, provider and medication links and the three repeat columns. It does not carry the appointment link, the notes document, or done state.
  - `repeatText` (the existing wording) says the rule.
- **Tick** (`completeTodo` on the device, `todoService.complete` on the server): in one transaction, the todo is marked done and the next occurrence is inserted unless a row with that id exists. "Today" is the day in the recipient's zone.
- **The server is the author of the next occurrence.** `complete` creates it for anyone who may complete (a viewer on their own todo, the connector). The device's copy is an optimistic twin with the same id: its upload is accepted as satisfied when the row exists, whatever the uploader's role, and sync replaces the device's copy.
- **Reopen and Undo** (`reopenTodo`, `todoService.reopen`): the next occurrence is soft-deleted when it is untouched (open, never edited, no notes document). Otherwise both stay and the reopened todo loses its repeat (the later one carries it).
- **Skip** (`skipTodo`, `todoService.skip`; writers): soft-deletes this occurrence and inserts the next, in one transaction. **Stop** is the ordinary delete.
- **Edit:** a change to a repeating todo is an ordinary update of the open row; later occurrences copy from it. Changing the rule or due day resets `repeat_starts_on` to the due day. Clearing the repeat clears all three columns.
- **Screens:** `TodoForm` gets `RepeatField` and `RepeatSheet` (`components/repeat`), disabled without a due day; rows show `RepeatMark`; the todo page shows `repeatText`; delete on a repeating todo opens a native `<dialog>` with "Skip this one", "Delete and stop repeating" and Cancel.
- **Calendars and emails:** nothing new. Only the current occurrence is a calendar item; the next appears when it is created.
- **Seeds:** the reminder in `seeds/appointments.ts` becomes a todo; `seeds/todos.ts` gains a repeating todo (weekly) and a done occurrence of it.

## Testing Decisions

Tests check behaviour through public interfaces, as the area docs describe.

- **Unit:** `entryTiming` (notes refused ahead); `todoRepeat` (next day after a late tick, an ended rule, monthly ordinals, the anchor with every-2-weeks, the id); `calendarItems` and `calendarText` (no reminder kind, a future note gives no item); `reminderPlan`; `upcoming`, `upcomingLabels`, `todayStatus`; quick entry's vocabulary rows and `noteReading` (a future note line gives `addTodo`); `todoRules` where the repeat checks live.
- **Integration:** `timelineEntryService` (a future note refused on create and on a moved time; a leftover one still editable); the series service (a note series refused; `topUp` skips one); `todoService` (`complete` makes the next once, twice is idempotent, a viewer's own tick, `reopen` removes an untouched next, `skip`); the sync upload of the twin; the reminder sweep (`reminders.int.test.ts`); the feed and Google plans; the connector (`readTools.int.test.ts`: `upcoming` with todos; `mcpWrites.int.test.ts`: the refusal).
- **Component:** the Planner (`planner.browser.test.tsx`: the Add menu, no reminder rows), `plannerRemind`, the Today card and simple Next, the entry page's note time chip, the todo form's Repeat field, the todo list and page (the mark, the wording, tick and Undo), the delete dialog. On the fixed clock the Planner tests already use; read after render with polling.
- **End to end:** one step added to `roundtrip`: tick a repeating todo offline on one device; the other device and the server show it done and one next todo. No new check.

## Out of Scope

- Converting or deleting stored future notes and note series (staging is reseeded).
- Dropping `timeline_entry`'s all-day and series columns for notes, or `appointment_series.kind`.
- Creating a repeating todo from the connector (`add_todo`) or from quick entry ("bins out every monday"): filed as backlog items.
- A todo attached to a note (B-245, `planner-3`).
- The Planner's chips and Upcoming | Past control (B-247) and its Filter menu (`list-filters`, B-249).
- Due doses in the Planner (B-246) and a connector tool for the dosing schedule (B-252).
- Showing future occurrences of a repeating todo, on screens or calendars.

## Further Notes

- **Order:** `quick-entry` (B-220) in `dev` before the quick-entry slice; B-247 in `dev` before the Planner slice. `list-filters` slice 4 and this PRD's Planner slice touch the same files: whichever comes second syncs first.
- **After the deploy to staging:** reseed (the user).
- At landing, [appointments](../docs/domain/appointments.md)'s "a future note a reminder" line, [calendars](../docs/domain/calendars.md)'s kinds, [todos](../docs/domain/todos.md) (repeats), [assistant](../docs/domain/assistant.md) and [connectors](../docs/domain/connectors.md) take the lasting decisions.
