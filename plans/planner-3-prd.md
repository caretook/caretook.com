# PRD: Timeline entries link todos; quick entry reads a repeat

Topic `planner-3`. Backlog items B-245 (attach todos to notes) and B-254 (quick entry: "bins out every monday" makes a repeating todo). Areas: [todos](../docs/domain/todos.md), [timeline](../docs/domain/timeline.md), [live-notes](../docs/domain/live-notes.md), [appointments](../docs/domain/appointments.md), [assistant](../docs/domain/assistant.md), [connectors](../docs/domain/connectors.md).

## Decisions

Costliest to change first. The user set the link's shape in a note on B-245: events and notes are both timeline entries; entries and todos are many to many; hide links on entries that aren't "live note" entries; no UX-based limit; redo any one-to-many between events and todos.

| Decision                                                                                                                                                                                                                                                                                                                          | Why                                                                                                                  | Source                                            | Cost to change later                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------- |
| Timeline entries and todos are many to many: an entry links any number of todos, and a todo any number of entries                                                                                                                                                                                                                 | the user's call                                                                                                      | asked: chose many to many                         | high: table, migration, sync stream |
| One new table, `timeline_entry_todo`, built as `timeline_entry_provider` is: a derived id per pair, hard-delete unlink, PUT and DELETE only                                                                                                                                                                                       | two devices linking one pair offline must make one row; the pattern is proven                                        | assumed                                           | high                                |
| A todo's one event link (`todo.event_id`) is redone as link rows. A migration copies every existing link, and the column stays until a later contract migration                                                                                                                                                                   | the user's "redo any one-to-many"; migrations stay additive                                                          | asked (the redo), assumed (expand, then contract) | high                                |
| Backfilled ids equal `entryTodoId`. The migration creates a throwaway SQL SHA-1 and UUID v5 function and drops it again                                                                                                                                                                                                           | Postgres has no built-in v5 and no extension may be added; a different id would double a link a device makes offline | assumed                                           | high once run                       |
| While the column exists, new clients never write it. The server mirrors an old client's `eventId` into link rows on create and update; a change removes the old pair and adds the new                                                                                                                                             | a device on an old build keeps working through a deploy                                                              | assumed                                           | medium                              |
| Soft-deleting an entry keeps its link rows, and `releaseEvent` still clears `todo.event_id` for old clients. Readers join live rows only. Entries have no restore today and this topic adds none                                                                                                                                  | the todo stays; the rows cost nothing and a later restore would find them                                            | assumed                                           | low                                 |
| Unlinking also clears `todo.event_id` when it names that entry                                                                                                                                                                                                                                                                    | otherwise old clients keep showing a removed link                                                                    | assumed                                           | low                                 |
| "Live note" entries are `NOTE_DOCUMENT_KINDS` (note and event). Their pages show links; vitals, symptoms and doses hide them. The table and service impose no kind check                                                                                                                                                          | the user's words: hide, with no UX-based limit                                                                       | asked                                             | low                                 |
| Who links: `WRITERS`, the set that may set a todo's event today (`isTodoWriter`). Viewers and both Easy roles read links and tick a todo assigned to them, nothing more                                                                                                                                                           | keeps today's set exactly                                                                                            | assumed                                           | low: one permission entry           |
| A rescheduled event's todos stay on the old, cancelled event, as they do today. The new event does not gain them. A follow-up item asks whether they should follow                                                                                                                                                                | no item asks to change this, and the old PRD's claim that they follow was wrong                                      | assumed                                           | low                                 |
| A repeating todo's next occurrence does not inherit links, as today. A next occurrence with a link row counts as touched on server and device, so reopening never deletes it                                                                                                                                                      | a link is someone's deliberate work                                                                                  | assumed                                           | low                                 |
| The new-todo form keeps its event picker (writes one link). On edit, links are managed in the todo page's Linked to section, and saving the edit form never changes a link                                                                                                                                                        | smallest change to a form people know; an edit must not clear a link it doesn't show                                 | assumed                                           | low                                 |
| Add todo from a note or event uses a new `entryId` prefill on `todos/new`, which accepts any live note or event in the group. The old `eventId` URL still works                                                                                                                                                                   | the sheet is the only place with due day and assignee, and it refuses a note id today                                | assumed                                           | low                                 |
| The connector keeps `eventId` on `list_todos` (the first linked event) and adds `linkedEntryIds`. Its write tools gain nothing                                                                                                                                                                                                    | existing clients keep working                                                                                        | assumed                                           | low                                 |
| A repeat phrase makes the line a todo with no `todo:` prefix, unless it reads as a vital, dose, pass or symptom                                                                                                                                                                                                                   | the item's example has no prefix; "gave tylenol every 4 hours" is a log                                              | assumed                                           | low                                 |
| A line naming a provider or an event word with a repeat stays an event first, with the repeating todo second and a note that quick entry can't make a repeating event                                                                                                                                                             | dropping "every tuesday" silently would mislead                                                                      | assumed                                           | low                                 |
| Phrases read: daily, every day, every other day, every N days; every monday (one or several days, "every weekday"); weekly, every week, every other week, every N weeks; monthly, every month, "every month on the 15th", "on the 1st of every month". Ends, "last friday", "twice a week" and yearly are set in the Repeat sheet | covers what people type                                                                                              | assumed                                           | low                                 |
| The first due day is the first day the rule gives, today included                                                                                                                                                                                                                                                                 | "every monday" on a Monday means today, as "monday" does                                                             | assumed                                           | low                                 |
| The connector's `add_todo` still takes no repeat                                                                                                                                                                                                                                                                                  | that is B-253 (connectors-3)                                                                                         | assumed                                           | low                                 |

The skeptic pass: see _Notes_.

## Problem

What happens in care often leaves something to do: "Dr. Alvarez said to book a follow-up", "the pharmacy is out, call back Thursday". A note has no tie to the todo that follows it, and an event can hold only todos that each point at that one event. A todo discussed at two visits can't show on both. Whoever picks a todo up can't see why it exists, and whoever reads the note can't see whether anyone followed up.

The quick entry box can make a todo but not a repeating one: "bins out every monday" makes one todo for next Monday.

## Solution

- **Notes and events link todos.** Their page has a Todos section: add a new todo, link one that exists, tick, or remove the link.
- **A todo lists every entry that links it,** and can link more.
- **The timeline marks entries that still have a todo open.**
- **Existing event-todo links carry over,** and everything that used them keeps working.
- **Quick entry reads a repeat,** and the card says so before Save.

## User stories

1. As a caretaker, I want to add a todo from a note's or event's page, so that what it asks for gets done.
2. As a caretaker, I want that todo to keep its own due day and assignee, so that the entry stays a record.
3. As a caretaker, I want to link an existing todo to an entry, so that an entry discussing it points at it.
4. As a caretaker, I want one todo linked from many entries, so that every note and visit about it leads to it.
5. As a caretaker, I want an entry's page to list open todos with a tick, so that I can finish one where I read about it.
6. As a caretaker, I want done todos to stay on the entry with who did them and when, so that it shows the follow-up happened.
7. As a caretaker, I want a todo's page to list its entries and link more, so that I know why it exists.
8. As a caretaker, I want linked todos to appear in the Planner, Today, calendars and emails as before, so that nothing is second-class.
9. As a caretaker, I want the timeline to show which notes and events have an open todo, so that I can spot what is waiting.
10. As a caretaker, I want to remove a link without deleting either side, so that a wrong link can be fixed.
11. As a caretaker, I want deleting an entry to keep its todos, so that nothing to do is lost with it.
12. As a helper with a linked todo assigned to me, I want to tick it on the entry's page, so that it works as it does elsewhere.
13. As a caretaker offline, I want linking, unlinking and ticking to sync later, with two devices linking one pair ending in one link.
14. As a caretaker with existing event todos, I want them still linked after this ships, so that nothing moves or disappears.
15. As a caretaker on a device that hasn't updated, I want setting a todo's event to keep working, so that a deploy doesn't lose my change.
16. As a caretaker, I want a series edit to keep a visit that has linked todos, so that the link isn't silently lost.
17. As a caretaker, I want "bins out every monday" to make a todo repeating weekly on Monday.
18. As a caretaker, I want daily, every-other, every-N, several-weekday and monthly phrases read too.
19. As a caretaker, I want a time in the line to be the due time and "for Sam" the assignee.
20. As a caretaker, I want the card to say "Repeats weekly on Monday" before I save.
21. As a caretaker, I want the card's Edit to open the form with the repeat filled in.
22. As a caretaker, I want "gave tylenol every 4 hours" to stay a dose or a note.
23. As a caretaker, I want a provider line with a repeat to tell me quick entry doesn't make a repeating event.
24. As a screen-reader user, I want the timeline mark, link pickers and repeat line to have text names.

## Implementation decisions

### The link table

- **`timeline_entry_todo`** (one migration, area `todos`): `id`, `group_id`, `entry_id`, `todo_id`, timestamps, audits. Composite cascading keys with the group to `timeline_entry` and `todo`, a unique pair, in the publication.
- **`entryTodoId(entryId, todoId)`:** a UUID v5 with its own fixed namespace, lowercasing its inputs as `entryProviderId` does.
- **Backfill** in the same migration: one row per `todo.event_id` whose event exists, audit columns copied from the todo. An integration test proves backfilled ids equal `entryTodoId`, and the helper function is gone afterward.
- **`entryTodoService`** (RBAC in SQL in its model): `link` and `unlink`. It refuses a deleted entry or todo and anything across groups. Linking a pair twice returns the one row.
- **Permissions:** read any member; create and delete `WRITERS`; update system only.
- **Sync:** a stream in `care_groups`, the device schema, and a `linkTable` upload entry (PUT, DELETE; PATCH refused).
- **The mirror:** `todoService` create and update turn an old client's `eventId` into link rows. `releaseEvent` clears the column and leaves link rows. `unlink` clears the column when it names the unlinked entry.

### Existing behaviour moves onto links

These read or write `todo.event_id` today and move to link rows: the series edit's touched check and its delete, the device's entry removal, the device todo queries, `LinkedTodos`, the todo page's links and loader, the todo form and its link fields, the `todos/new` prefill, quick entry's `addTodo.eventId` (a create naming an entry writes the link) on both runners, and connector `list_todos`. `isUntouchedNext` drops its column check, and its callers check for link rows on both sides. The device's `updateTodo` stops carrying `eventId`, so saving the edit form leaves links alone.

### The entry's page

A Todos section on a stored note or event, replacing `LinkedTodos` there: open todos in `todoOrder` with tick and Undo, then done ones (`doneOrder`, at most 20). Writers get Add todo (a new todo, linked in one local transaction), Link a todo (a picker over open todos not yet linked), and Remove. It is hidden from readers when empty, and absent on other kinds.

### The todo page and the timeline

Linked to lists every linked entry, newest first, with its first line and day, and writers can link or remove. Note and event rows in the full timeline show "1 todo" or "2 todos" from one live group query, never one per row.

### Quick entry reads a repeat

- **`quickEntryRepeat`**, a new pure module: `readRepeat(tokens, today)` returns the rule, first day and tokens used. It builds rules with `ruleText` and plain date arithmetic, with no `rrule` import.
- **Vocabulary:** `repeatWord` rows with test rows. "every" before hours or minutes is not a repeat.
- **The splitter** keeps "every mon, wed and fri" in one part.
- **The reading** sets `repeatRule`, `dueOn`, `dueTime` and a title without the repeat words. It ranks as the Decisions table says, on top of the parser quick-entry-2 landed.
- **The action:** `addTodo.repeatRule` is optional and refused without `dueOn`. The connector's `add_todo` leaves it out.
- **Preview and Edit:** `todoRepeatLine` moves to the schema package's todo display module. The card's Edit passes `repeatRule` as a prefill.

## Testing decisions

- **Unit:** `entryTodoId`, the touched rule, the mark's wording, picker options, `quickEntryRepeat`, `quickEntry.test.ts` rows, preview and card prefill.
- **Integration:** the migration's backfill and id equality; `entryTodoService` (RBAC, refusals, one row per pair); the upload; the mirror; `releaseEvent`; unlink clearing the column; reopening with a linked next occurrence; the replication role; the connector's fields; `assistantActionService`.
- **Component:** the entry page's section on a note and an event, its absence on other kinds, the todo page's list, the timeline mark, the moved event-todo flows, quick entry's card and Edit.
- **End to end:** one `timeline_entry_todo` row in `roundtrip`'s sync matrix. No new check.
- **Prior art:** `entryProviderService`, the With row, the matrix's provider row, `todoRepeat.browser.test.tsx`, `quickEntry.test.ts`.

## Out of scope

- Dropping `todo.event_id` and the mirror (a new contract-migrations item).
- A Tiptap plugin to link or create todos while typing (a later follow-up, in the user's note).
- Links between two entries, and note-to-event links.
- Todos following a reschedule (a follow-up item).
- Connector tools that write links; `add_todo` taking a repeat (B-253).
- Repeat ends, "last friday" and yearly in quick entry; repeating events from quick entry.

## Notes

- **Replaces the plan of 2026-11-21,** whose `timeline_entry_link` table and note-to-event slice are gone after the user's correction on B-245.
- **The skeptic pass** changed: editing a todo no longer clears its link; Add todo from a note got a working path (`entryId`); the restore claim is gone, because entries have no restore; unlink clears the old column; slice 2 was cut by moving quick entry's link write and the connector into slice 6, which also removes a collision on the `addTodo` code; the unsaved-changes table names joined slice 1; an impossible test was dropped; the hot files were corrected.
- **Declined:** making old builds' series edits read link rows. They can't be changed, and the gap lasts only until a device updates: such a build could treat a visit whose only link is a new row as untouched.
- **Other topics:** `dose-accuracy` has `assistantActionService.ts` hot, `connectors-3` the connector tools, and `todo-subtasks` waits for this topic.
</content>
