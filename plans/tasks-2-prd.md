# PRD: tasks-2 (todos, and the Planner)

B-222. Tasks become **todos**, everywhere from the database to the words on screen, and Upcoming and Tasks merge into one section, **Planner**, with three tabs: Planner, Todos and Past.

## Problem Statement

A caretaker sees "Tasks" in the tab bar, ticks "todos" in quick entry (`todo: call the pharmacy`), and finds the same items again under Upcoming, merged by day with the appointments. Two sections show the same things, the app uses two words for one idea, and the tab bar has five destinations where four would do. People don't know where to look for "what's coming and what do I have to do".

## Solution

- **One word: "Todo".** Every label, empty state, Undo line, search section, email, calendar text and connector tool says todo. Underneath, the table, the synced table, the services, the permissions, the error codes and the code names say todo too, so nobody reading the code meets a second word.
- **One section: Planner** (lucide `CalendarCheck`), in Upcoming's place in the tab bar. Tasks' tab goes away, so a group has four sections: Timeline, Providers, Medications, Planner.
  - **Planner tab** (`/planner`): today's Upcoming list: appointments, reminders, due doses and dated todos, merged by day, with its kind and author filters.
  - **Todos tab** (`/todos`): today's Tasks list: Mine, Unassigned and Everyone, sections by due day, No date, then Done.
  - **Past tab** (`/planner/past`): past appointments, as today.
  - One header for all three: the "Planner" title, the tabs, and for writers one **+ menu** (Appointment, Reminder, Todo) that's the same on every tab.
- A todo's page is `/todos/:todoId` and its sheets are `/todos/new` and `/todos/:todoId/edit`. All of them sit in the Planner section, so the tab bar stays highlighted.
- **No redirects.** Nothing is in production, so old `/upcoming` and `/tasks` links (sent emails, calendar descriptions, assistant answers, bookmarks) are only on staging, and they get the usual 404.

## User Stories

1. As a caretaker, I want one word for the things I have to do, so that I'm not unsure whether a task and a todo are different.
2. As a caretaker, I want the tab bar to show one Planner tab instead of Upcoming and Tasks, so that I know where to look for what's ahead.
3. As a caretaker, I want the Planner tab to show appointments, reminders, due doses and dated todos by day, so that I see my day in one list.
4. As a caretaker, I want a Todos tab with Mine, Unassigned and Everyone, so that I can still see everything assigned to me, including undated todos.
5. As a caretaker, I want the Todos tab to keep No date and Done (newest first, paged by 20), so that nothing I relied on in Tasks is lost.
6. As a caretaker, I want a Past tab in the same header, so that last month's appointments are still one tap away.
7. As a writer, I want one + menu with Appointment, Reminder and Todo on every Planner tab, so that I can add anything from wherever I am.
8. As a writer, I want the todo sheet opened from the Planner tab to close back to the Planner tab, so that adding a todo doesn't move me.
9. As a viewer, I want no + menu, so that I'm not offered what I can't do, while I can still tick a todo assigned to me.
10. As a caretaker, I want a todo's page to keep the Planner tab highlighted, so that I know where I am.
11. As a caretaker, I want going back from a todo's page to return to the Todos tab with the chip I had, so that my place is kept.
12. As a caretaker, I want the Today card and the simple view to say "My todos" and "Todo", so that the words match the Planner.
13. As a caretaker, I want "Add todo" on an appointment's, provider's or medication's page (linked todos), so that the backlinks use the same word.
14. As a caretaker, I want search to list a "Todos" section, so that results use the same word.
15. As a caretaker, I want quick entry to keep accepting `t:`, `task:`, `todo:` and `to-do:`, so that my habits keep working, while its preview and help say "Todo".
16. As a caretaker, I want reminder emails and calendar items for a todo to say "Todo for Pat", so that outside Caretook the word is the same.
17. As a caretaker with Google Calendar connected, I want my todo events updated in place, not duplicated, so that my calendar doesn't fill with copies.
18. As a caretaker subscribed to the iCal feed, I want todo items to keep working after the change, so that my calendar app shows them.
19. As a member using Claude or ChatGPT, I want the tools to be `add_todo` and `list_todos`, with descriptions and answers that say todo, so that the assistant uses the app's word.
20. As a caretaker on a device that was offline during the update, I want my device to sync the todos again after updating, so that I see the group's todos. (Before launch, edits queued under the old name on a staging device may be lost: an accepted cost.)
21. As a privacy reader, I want the privacy pages to say todos, so that they describe the app as it is.
22. As a developer, I want the table, the code and the docs to say todo, so that there's one word to search for.
23. As a developer, I want the section list to have four entries, Planner matching `/planner` and `/todos`, so that the shell needs no special case.

## Implementation Decisions

### The data rename (one migration, one step)

- **An agreed exception to "migrations stay additive"** (the user's decision, 2026-11-21): production isn't live, so the rename is one step, with no view, no dual sync and no old upload name. Staging devices with queued `task` uploads lose them.
- The migration:
  - renames table `task` to `todo`, with its constraints and indexes renamed to match;
  - renames `note_document.task_id` to `todo_id`, and rewrites the `subject` value `task` to `todo`, with its check;
  - rewrites `calendar_sync_job.reason` `task` to `todo`, with its check;
  - rewrites every stored calendar uid `task:<id>` to `todo:<id>`: `google_event_link.item_uid`, and any reminder send record keyed by uid (the slice confirms which tables hold one). That way Google events update in place under their stored ids, and no reminder goes out twice.
- It keeps 0022's hand edits in effect: `event_id`'s `ON DELETE SET NULL ("event_id")` and the table's place in the `powersync` publication. The loop confirms both after the rename. The Drizzle snapshot must match, so a later `generate` makes nothing.
- **Code names:**
  - the schema becomes `db/schema/todos/` (`todo.ts`, `todoRules`, `todoDisplay`), with `todoState`, `todoOrder`, `TODO_WRITER_ROLES`, `isTodoWriter`, `canCompleteTodo` and so on;
  - the model becomes `todoModel`, the service `todoService` (the same methods: `releaseAssignee` and `releaseEvent` keep their names), permissions `PERMISSIONS.todo`, and errors `todoService:*`;
  - seeds become `seeds/todos.ts`, keeping their ids.
- **Search:** `SEARCH_ITEM_TYPES` has `todo`, and `todoSearchDocument` replaces the task one.
- **Live notes:** `NOTE_DOCUMENT_SUBJECTS` has `todo`, and the `todoId` column replaces `taskId`.
- **Calendars and email:**
  - uids are `todo:<id>` and the kind is `todo`;
  - `calendarText` says "Todo for Pat";
  - `TASK_LEADS` becomes `TODO_LEADS`;
  - the reminder email's wording says todo.
- **Sync:** the sync config's query reads `FROM todo`, the device schema's table is `todo`, the upload switch accepts `todo` and refuses `task` like any unknown table, and the sync matrix row is `todo`.

### The app

- `lib/tasks/` becomes `lib/todos/` (`todos.sync.ts`, `todoDisplay`, `todoList`, `todoStrip`, `todoUndo`, `todoSheets`, `todoSheetLink`, `plannerTodos`, today's `upcomingTasks`).
- `components/tasks/` becomes `components/todos/` (`TodoTick`, `useTodoTick`, `TodoUndoStatus`, `LinkedTodos`, `useLinkedTodos`).
- The list route becomes `routes/app/groups/todos/` and the page `routes/app/groups/todo/`.
- Simple mode's `SimpleTodos` and `useSimpleTodos`; the Today card's `useTodoStrip`.
- **`appUrls`:** `todos`, `todo`, `newTodo`, `editTodo` (paths under `/todos`); `planner`, `plannerPast`, `newPlannerEntry` (today's `upcoming`, `pastEvents`, `newUpcomingEntry`). The prefill params keep their names (`providerId`, `medicationId`, `eventId`, `dueOn`, `title`, `assigneeId`, `dueTime`).
- **Wording:** "Todo" and "Todos" in every label, button, empty state ("Nothing assigned to you.", "No open todos."), Undo ("Undo <title>"), the Today card, the simple view's "My todos", LinkedTodos' "Add todo", search's "Todos" section, quick entry's preview card ("Todo · Due tomorrow 17:00") and its help or rules text, `actionPreview`, the via tag's places and the privacy pages.
  - Where the app named the section "Upcoming" (a link to it, a heading that means the section), it now says "Planner".
  - "upcoming" as a time word (the Next strip, `lib/appointments/upcoming.ts`'s `entryTiming`, `upcomingOrder`) stays: it describes time, not the section.
- **Quick entry:** the prefix regex keeps `t:`, `task:`, `todo:`, `to-do:`, `to do:` and a bare `todo`. `todo:` is the one shown in help and examples.
- `scripts/loops/check-areas.d/tasks` becomes `todos`, with its paths.

### The Planner section

- **`GROUP_SECTIONS`:** the Upcoming and Tasks entries go, and one Planner entry takes Upcoming's place (after Medications): id `planner`, label "Planner", icon `CalendarCheck`, path `appUrls.planner`. Its `match` covers `/planner` and anything under it, and `/todos` and anything under it. This is a deliberate exception to "append only": the registry's comment says so.
- **Routes:**
  - `planner` (today's Upcoming route, folder `routes/app/groups/planner/`) and `planner/past`;
  - `todos` with its `new` and `:todoId/edit` sheets as children;
  - `todos/:todoId` (the page).
  - `upcoming` and `tasks` are gone, with no redirects.
- **`PlannerHeader`**, the shared header on all three tabs:
  - It builds on timeline-ux-2's `PageHeader`, with title "Planner" and no subtitle.
  - The actions slot, for writers only, is a `ui/Menu` "+" button named "Add" with Appointment and Reminder (today's `?when=pick` drafts) and Todo (`appUrls.newTodo` with the sheet state, so it closes back to where it opened).
  - Then the tab nav "Planner, todos or past": Planner, Todos, Past as links, with `aria-current="page"` on the current one. The Planner and Past links carry the filters each reads, as today's `tabSearch`; Todos carries `?who=` when set.
- **The Planner tab** is today's Upcoming page, renamed. **The Todos tab** is today's Tasks page under `PlannerHeader`: its own "Add task" button goes, because the + menu has Todo. **The Past tab** is today's Past page under `PlannerHeader`.
- The todo page keeps its own header (a detail header). Its back link goes to the Todos tab with the chip, as today.
- Page titles: "Planner · Caretook", "Todos · Caretook", "Past · Caretook".

### The connector

- `add_task` becomes `add_todo` and `list_tasks` becomes `list_todos`: the tool names, their files, their descriptions, `tools/index.ts`'s order kept, the action kind in `assistantActionService` (`addTodo`), the answers' wording (`actionPreview`'s) and links (`links.ts` equal to `appUrls`).
- connectors-2's MCP prompts and server instructions say todos where they say tasks.
- `search` still doesn't search todos (as today).

### Order and overlap

- The PRD starts once **timeline-ux-2** (its `PageHeader` and the Upcoming and Tasks headers) is in `dev`. **connectors-2** (`tools/writes.ts`, `tools/index.ts`, `assistantActionService`, the prompts) landed while this was planned (017a9b29).
- It touches nearly every todo file, so its slices run one after another until the rename is done.

## Testing Decisions

- Good tests check what a person or a client sees (names, headings, what a tap opens, what the server returns), never class names or the component tree. Renamed tests keep their assertions, with the wording changed.
- **Unit:**
  - `groupSections`: four sections in order (Timeline, Providers, Medications, Planner); Planner matches `/planner`, `/planner/past`, `/todos`, `/todos/new` and `/todos/<id>`; nothing matches `/upcoming` or `/tasks`.
  - The renamed pure modules (`todoRules`, `todoDisplay`, `todoList`, `todoStrip`, `plannerTodos`, `todoSheets`, `todoUndo`, quick entry's prefixes including `task:` and `t:`), and `calendarItems` and `reminderPlan` with `todo:` uids.
- **Integration:**
  - The migration: a database with a task, its notes document, a calendar job and a Google link before the migration has, after it, the same todo row, a `todo` subject with `todo_id`, the `todo` reason and a `todo:` uid. The `event_id` link still clears when its entry is hard-deleted.
  - The upload switch: a `todo` PUT, PATCH and DELETE work; `task` is refused.
  - The renamed `todoService` tests (the leaver, `releaseEvent`), `syncTodos`, the calendar tests (feed, push, pull, reminders) and `mcpWrites` and `readTools` with `add_todo` and `list_todos`.
- **Component:**
  - `planner.browser.test.tsx`: on each tab the `h1` is "Planner", the tab nav's current link is that tab, and the tabs go where they say.
  - Writers get the + menu with Appointment, Reminder and Todo, and Todo opens the sheet, which closes back to the tab it came from. Viewers get no + menu.
  - The tab bar's Planner tab is current on `/planner`, `/todos` and a todo's page.
  - The renamed `todos`, `todo`, `linkedTodos`, `searchTodos`, `timelineSimpleTodos`, `timelineQuickEntryTodos`, `plannerTodos` (today's `upcomingTasks`) and other Upcoming tests, run under their new routes.
  - Prior art: `upcoming.browser.test.tsx` and `upcomingWorld.tsx` (the fixed clock), `tasks.browser.test.tsx`, `frame.browser.test.tsx`.
- **End to end:** no new check. `roundtrip` (its `todo` matrix row, viewer@ ticking their todo offline, its `/mcp` write if it uses a todo), `phase2` and `live-notes` get their paths, selectors and table names updated.

## Out of Scope

- Redirects from `/upcoming/*` and `/tasks/*`.
- Keeping old `task` uploads from staging devices.
- Anything new about todos (recurring todos, priorities, sharing): this is a rename and a merge.
- Searching todos from the connector's `search`.
- Changing the Planner list itself (its filters, its rows, due doses' rules) beyond the header and tabs.
- The time words "upcoming" and "Next" in the timeline.

## Further Notes

- The user's choices (2026-11-21): "Todos" (not To-dos or Checklist); rename everything, table included; one step, as an exception to the additive rule because production isn't live; `todo:` calendar uids (the stored ones rewritten, so Google updates in place); "Planner"; tabs Planner, Todos, Past; `/planner` and `/planner/past` plus top-level `/todos`; no redirects; all quick-entry prefixes kept; one + menu on every tab; `CalendarCheck`; wait for timeline-ux-2; the connector rename after connectors-2; tests as sketched.
- At landing:
  - `docs/domain/tasks.md` becomes `docs/domain/todos.md`, and the core's _Area index_ entry follows.
  - The [appointments](../docs/domain/appointments.md) doc's Upcoming lines become the Planner.
  - [app-shell](../docs/domain/app-shell.md)'s sections line says four, with Planner's double match.
  - [calendars](../docs/domain/calendars.md), [connectors](../docs/domain/connectors.md), [search](../docs/domain/search.md), [assistant](../docs/domain/assistant.md), [timeline](../docs/domain/timeline.md), [live-notes](../docs/domain/live-notes.md), [sync](../docs/domain/sync.md) and [data-layer](../docs/domain/data-layer.md) say todo.
  - The [ops](../ops/runbook.md) runbook notes the one-step rename's deploy (the migration and sync config together).
