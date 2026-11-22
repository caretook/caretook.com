# Plan: A note links todos and events; quick entry reads a repeat

> Source PRD: [`plans/planner-3-prd.md`](planner-3-prd.md). User-story numbers (US) refer to it. Backlog items B-245, B-254. Topic `planner-3`.

## Status

**Where it stands:** planned (2026-11-21), not started. Waits for `simple-mode` to land in `dev` (the permissions parts and `sync-config.yaml`); then wave 1 can start.

| Slice | Wave | State       | Merge into `prd/planner-3` (slice commits) |
| ----- | ---- | ----------- | ------------------------------------------ |
| 1     | 1    | not started |                                            |
| 2     | 2    | not started |                                            |
| 3     | 2    | not started |                                            |
| 4     | 3    | not started |                                            |
| 5     | 1    | not started |                                            |
| 6     | 2    | not started |                                            |

**Backlog:** claim a slice's item when it starts; run `pnpm backlog done` on an item when its last slice merges.

| Item                                     | Slices     |
| ---------------------------------------- | ---------- |
| B-245 a note links todos (and events)    | 1, 2, 3, 4 |
| B-254 quick entry makes a repeating todo | 5, 6       |

## Architectural decisions

Durable decisions every slice follows:

- **One migration, in slice 1, and nothing else adds one.** No new dependency, no new route.
- **The link table copies the provider links.** `timeline_entry_link` is built, permitted, synced and uploaded as `timeline_entry_provider` is: a derived id (`entryLinkId`, UUID v5 of the pair), composite keys that cascade, hard-delete unlink, PUT → link, DELETE → unlink, PATCH refused. Where this plan is silent, do what the provider links do.
- **The source is always a note; the target is a todo or an event,** exactly one. The service enforces the kinds; the keys enforce the group.
- **`todo.event_id` and `todoService`'s link checks are not touched.**
- **Readers join live rows:** a link to a soft-deleted note, todo or event is never shown and never counted.
- **One live query per list, never one per row** (the timeline's mark).
- **Registries are composed from area parts** ([rules across PRDs](../docs/agents/orchestrator.md#rules-across-prds)): the table, permission, errors and procedures go in the `timeline` area's parts (the provider links it copies live in the `providers` area: copy the shape, not the place), and each frozen list (the schema's `index.test.ts`, the permissions test) gains its entry. Additive edits only, at the end of the group, in `sync-config.yaml`, the device schema, the upload switch and the `services/` and `models/` indexes.
- **Wording says "event".** New labels, messages and tests say event, never appointment; existing labels are left alone.
- **The parser stays free of `rrule`:** a repeat is built with `ruleText` and plain date arithmetic. Nothing in `schema/assistant/` imports `@caretook/data/series`.
- **A kind-picking word is a vocabulary row plus a test row** ([assistant](../docs/domain/assistant.md)); every new parser rule adds a row to `quickEntry.test.ts`.
- **Component tests** run on the fixed clock their neighbours use and read after render with polling ([components](../docs/domain/components.md#component-tests)).
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing (below).

## How to run this plan

- **Waves:** (1, 5) → (2, 3, 6) → 4. The two items are independent: slices 1 to 4 are B-245, slices 5 and 6 are B-254. Land each wave when green.
- **Wave 1 lands a table nobody sees yet** (slice 1) and a parser reading that already saves a repeating todo (slice 5). Both are safe alone.
- **Slice 4 is the user's "similarly any event", as the planner read it.** If the user vetoes that reading, drop slice 4 only: the table's event column then stays unused, and nothing else changes.
- **Gates:** slice 1 adds a migration and a sync stream, so wave 1's check runs full, and the orchestrator runs `roundtrip` by name at that landing. Later waves are quick checks where the check plan allows, with the lean browser suite once per landing that changes screens.
- **The migration:** one, in slice 1. When a sync brings another topic's migration, keep `dev`'s and regenerate this one on top; reread the SQL for the hand-kept parts the provider links' migration has (the publication line).
- **Shared files inside a wave:**
  - The note's entry page: slice 2 adds the Todos section; slice 4 (a wave later) adds the Events section under it. Slice 3 doesn't touch it.
  - `lib/timeline/entryLinks.sync.ts`: slice 1 writes all of it, the event functions included; slices 2 to 4 only read it, and add a query there only if one is missing.
  - `lib/todos/urls.ts` and the `todos/new` route: slice 2 adds the `noteId` prefill, slice 6 the `repeatRule` prefill, in the same wave. Different lines; merge in plan order.
- **Files other topics have hot:**
  - `simple-mode` (running): the permissions parts, `sync-config.yaml`, `roles.ts`. This topic starts after it lands; use its role names for "the roles that write timeline entries".
  - `sync-safety` (planned): the upload switch and `services/`. Slice 1 adds one case and one service; keep both sides at a sync.
  - `fixes-bug` (running): `lib/todos/`, the timeline and todos routes. Slices 2 and 3 add components and one row prop.
  - `quick-entry-2` (to write): `schema/assistant/quickEntry.ts` and `components/quick-entry/`. Slice 5 puts its reading in a new module; if `quick-entry-2` is mid-wave when wave 1 would start, tell its orchestrator and sync after its landing.
  - `dose-accuracy` (planned): `assistantActionService.ts`. Slice 6 adds a test and at most one passed-through field.
  - `connectors-3` (to write): the connector's tools. Slice 5 changes only the fields `add_todo` leaves out.
- **Ownership:**
  - Slice 1: the table, migration, model, service, permission, errors, stream, device schema, upload case, `entryLinks.sync.ts`, the matrix row and its id copy, the check-areas line, the test world's link helper, seeds (its own file and ids).
  - Slice 2: `NoteTodos`, the entry page's use of it, the `noteId` prefill and the save that links.
  - Slice 3: the todo page's Note rows, the timeline row's mark.
  - Slice 4: the note page's Events section, an event page's Notes list, the link's part in reschedule and series edits.
  - Slice 5: `quickEntryRepeat`, the vocabulary rows, the splitter and ranking in the parser, the `addTodo` action, the connector's left-out field.
  - Slice 6: the preview wording and the moved repeat line, the runners' tests, the card's Edit prefill, the `todos/new` repeat prefill, the quick-entry component tests.
- **Docs at landing (the orchestrator):**
  - Wave 1: [timeline](../docs/domain/timeline.md) (the table, its rules, the service), [sync](../docs/domain/sync.md) (the stream and the upload line), [care-groups](../docs/domain/care-groups.md) (the permission line), [assistant](../docs/domain/assistant.md) (the repeat phrases, the `repeatWord` role, `addTodo.repeatRule`, the ranking and the provider warning), [connectors](../docs/domain/connectors.md) (`add_todo` leaves `repeatRule` out until B-253).
  - Wave 2: [todos](../docs/domain/todos.md) (the note's Todos section, the Note rows, the `noteId` prefill), [timeline](../docs/domain/timeline.md) (the mark), [assistant](../docs/domain/assistant.md) (the card's wording and prefill).
  - Wave 3: [timeline](../docs/domain/timeline.md) or [appointments](../docs/domain/appointments.md) (the Events section and the Notes list).
  - Trim at least what is folded in: `todos.md` and `assistant.md` are near their budgets.
- **When it's done:** `pnpm prd rm planner-3` sets the row done. Tell `connectors-3`'s planner or orchestrator that `addTodo.repeatRule` exists, so B-253 is opening the field in the tool.

---

## Slice 1: The link table, through sync

Stack: yes · Reads: docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/providers.md, docs/domain/timeline.md, docs/domain/care-groups.md · Tests: unit, integration, e2e:roundtrip

**Backlog:** B-245. **User stories:** 4, 11, 13.

**What to build**

A link between a note and a todo, or a note and an event, can be made and removed on a device or the server and reaches every other device. No screen yet.

- **Table `timeline_entry_link`** (adds a migration): `id`, `group_id`, `entry_id`, `todo_id`, `linked_entry_id`, timestamps, audits; a check for exactly one target; composite keys to `timeline_entry` (source and target) and `todo`, cascading; unique per pair (two constraints, one per target, since each target column is nullable); in the publication.
- **`entryLinkId(entryId, targetId)`**, a UUID v5 as `entryProviderId` is, with its own namespace, in the timeline area's schema part.
- **`entryLinkService`** over its model (RBAC in SQL): `link` and `unlink`, with the refusals the PRD lists (a non-note source, a non-event entry target, a deleted or other-group record, a note linking itself); linking a pair twice returns the one row. Errors in the area's errors part.
- **Permissions:** read any member; create and delete the roles that write timeline entries; update `system`.
- **Sync:** the stream in `care_groups`, the device schema, the upload case (PUT, DELETE; PATCH refused).
- **The device** (`lib/timeline/entryLinks.sync.ts`): `linkTodo`, `linkEvent`, `unlink` (the same checks locally), `noteTodosQuery`, `noteEventsQuery`, `notesLinkingQuery`, `openTodoCountsQuery`; all join live rows.
- **Seeds** (a file and ids of its own): one seeded note linking one open todo, one done todo and one event.
- **Test plumbing:** a link helper in the component-test world (`apps/web/test/fixtures.ts`, as provider links have), so slices 2 to 4 don't each add one; the area's `check-areas.d/timeline` rule maps the new schema file to `roundtrip`, as the provider links' file is mapped.

**Acceptance criteria**

- [ ] Unit: `entryLinkId` is the same for a pair on both sides and differs per pair; the link schema refuses no target and two targets.
- [ ] Integration (`entryLinkService`): a writer links and unlinks a todo and an event; linking twice leaves one row; each refusal above; a viewer and a non-member are refused, and a member of another group reads nothing (RBAC in SQL); hard-deleting a todo removes its links.
- [ ] Integration (the sync upload's tests): PUT links, DELETE unlinks, PATCH is `sync:readOnlyTable`; a PUT for a pair the server already has is accepted.
- [ ] Integration (the device queries, where the provider links' are tested): a soft-deleted todo, event or note drops out of every query and of the counts.
- [ ] The frozen lists gain their entries (the schema's `index.test.ts`, the permissions test).
- [ ] Integration (`roles.int.test.ts`): the replication role reads the new table, as every synced table.
- [ ] End to end (`roundtrip`): a `timeline_entry_link` row in the sync matrix, after the `todo` row (rows are in upload order): a link made on one device reaches the server and the other device. The matrix's own copy of `entryLinkId` and its cleanup line are added, and `pnpm test:tooling` (`sync-matrix.test.mjs`) asserts the copy matches the data package. No new step; unlinking is covered by the upload's integration test.
- [ ] `pnpm datastore:reset` seeds the links.

**Blocked by:** nothing. **Blocks:** slices 2, 3, 4.

---

## Slice 2: A note's page lists, adds and links todos

Stack: no · Reads: docs/domain/todos.md, docs/domain/live-notes.md, docs/domain/providers.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-245. **User stories:** 1, 2, 3, 5, 6, 8, 10, 12, 23.

**What to build**

- **`NoteTodos`** on a stored note's entry page, under the text: linked open todos (`todoOrder`) with tick and Undo, then done ones (`doneOrder`, at most 20) with `doneText` and reopen for whoever may complete. It reuses `TodoTick`, the Undo status and the row wording `LinkedTodos` has. Hidden from a reader when empty.
- **Add todo** (writers): opens `todos/new` with a `noteId` prefill (`TODO_PREFILL_PARAMS`); the sheet's save writes the todo and the link in one local transaction and returns to the note. A `noteId` that isn't a live note in the group is ignored.
- **Link a todo** (writers): a `ComboBox` over the group's open todos not linked to this note, by title, up to 20, as the With row's provider picker; choosing one links it.
- **Remove** (writers) on a row unlinks; the todo stays.
- An event's page keeps `LinkedTodos` as it is.

**Acceptance criteria**

- [ ] Unit: the picker's options (open, not linked, matching, capped), where the With row's options are tested.
- [ ] Component (the entry page's tests): a note shows its linked open and done todos; a tick offers Undo and moves the todo to the done list with "Done by …"; a done one reopens; a viewer ticks only their own and sees no actions; a reader with nothing linked sees no section.
- [ ] Component: Add todo opens the sheet, and saving shows the new todo on the note, linked; Link a todo links an existing one and it leaves the picker; Remove takes it off and the todo still exists; all three work offline (the device writes).
- [ ] Component: the same todo linked from two notes shows on both.
- [ ] The picker and the remove buttons have text names.

**Blocked by:** slice 1. **Blocks:** slice 4.

---

## Slice 3: A todo shows its notes, and the timeline marks notes with open todos

Stack: no · Reads: docs/domain/todos.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-245. **User stories:** 7, 9, 23.

**What to build**

- **The todo page:** Linked to shows a "Note" row for each note linking the todo (`notesLinkingQuery`), newest first: the note's first line as its timeline row words it, and its day, opening the entry page. The section shows when the todo has any link.
- **The timeline:** one live `openTodoCountsQuery` for the group; the full view's note rows show "1 todo" / "2 todos" as text. Nothing on other rows, in the simple view, or for done todos.

**Acceptance criteria**

- [ ] Unit: the count wording (1, 2; none at 0), wherever the row's labels are tested.
- [ ] Component (the todo page): a todo linked from two notes shows two Note rows that open them; a deleted note's row is gone; a todo with no links is unchanged.
- [ ] Component (the timeline): a note linking one open todo shows "1 todo"; ticking the todo removes the mark; the simple view shows none.
- [ ] The mark is text a screen reader reads; the icon is decorative.

**Blocked by:** slice 1. **Blocks:** slice 4.

---

## Slice 4: A note links events, and an event shows its notes

Stack: no · Reads: docs/domain/timeline.md, docs/domain/appointments.md, docs/domain/todos.md, docs/domain/components.md · Tests: unit, integration, component

**Backlog:** B-245. **User stories:** 14, 15, 23.

**What to build**

- **An Events section** on a stored note's page, under Todos: linked events with title, day and time (a cancelled one struck through and labelled, as the todo page shows a linked event), each opening its page. Writers get "Link an event" (a `ComboBox` over upcoming and recent events not linked yet, the todo form's event choices) and Remove.
- **An event's page** lists the notes that link it ("Notes"), the row slice 3 uses on the todo page. Hidden when empty.
- **A link survives the event changing id.** Rescheduling makes a new event: the notes' links are copied onto it, as provider links are (device and server). A repeating event's visit that a note links counts as touched, so a series edit keeps it instead of deleting and remaking it (the device's and the server's series code, where a visit with notes or a linked todo already counts).

**Acceptance criteria**

- [ ] Unit: the event picker's options (live events, not linked, capped).
- [ ] Component (the entry page's tests): a note shows its linked events; Link an event links one, offline too; Remove unlinks and the event still exists; a reader sees the list and no actions, and no section when empty; a cancelled event reads as cancelled.
- [ ] Component: an event linked from two notes lists both under Notes; a deleted note drops out.
- [ ] Integration (the reschedule and series tests, server side) and unit or component (their device twins, where reschedule and series edits are tested today): a rescheduled event's note links are on the new event; a series edit keeps a visit a note links, and the link.
- [ ] New wording says "event"; no existing label changes.

**Blocked by:** slices 2 and 3. **Blocks:** nothing.

---

## Slice 5: Quick entry reads a repeat

Stack: no · Reads: docs/domain/assistant.md, docs/domain/todos.md, docs/domain/connectors.md · Tests: unit, integration

**Backlog:** B-254. **User stories:** 16, 17, 18, 21, 22.

**What to build**

The parser turns "bins out every monday" into an `addTodo` action due the next Monday (today, on a Monday) with a weekly-on-Monday rule. Saving it already makes a repeating todo, since both runners write a todo through the todo create schema; slice 6 proves that and words the card.

- **`quickEntryRepeat`** (pure, in `schema/assistant/`): `readRepeat(tokens, today)` → the rule, its first day and the tokens it used, for the phrase families in the PRD's _Decisions_ table. Rules are built with `ruleText`; the first day by date arithmetic, today included; no `rrule`.
- **Vocabulary rows** with role `repeatWord` for the words that start a repeat; "every" before hours or minutes isn't one.
- **The splitter** keeps "every mon, wed and fri" in one part.
- **The action:** `addTodo.repeatRule` (optional RRULE text).
- **The reading:** `todoReading` sets `repeatRule`, `dueOn` (the first day), `dueTime` (a clock time in the line) and a title without the repeat words; "for Sam" / "@Sam" still assigns. Ranking: a part with a repeat and no vital, dose, pass or symptom reading is Todo, then Note (now, the whole line), then Event. A part with a clearly named provider or an appointment word keeps its event first with the non-blocking warning "Quick entry can't make a repeating event. Set Repeat on the event.", then the repeating todo.
- **The connector's `add_todo`** builds its input from the action's shape, so it leaves `repeatRule` out in this same slice (as it leaves `assigneeId` out).

**Acceptance criteria**

- [ ] Unit (`quickEntryRepeat`): daily, every other day, every N days; one weekday, several, "every weekday"; weekly, every other week, every N weeks; monthly, "every month on the 15th", "on the 1st of every month", a 31st in a short month; the first day with today included; "every 4 hours" gives no repeat; limits (`SERIES_LIMITS.interval`).
- [ ] Unit (`quickEntry.test.ts` rows): "bins out every monday"; with "7am" and "for Sam"; `todo:` with a repeat; "gave tylenol every 4 hours" stays a dose or note with no todo first; a provider line's order and warning; the weekday list as one part; a row per new vocabulary phrase; an unrelated "every" ("everyone was tired") reads as before.
- [ ] Unit (the action schema's test): `addTodo` takes a valid `repeatRule` and refuses text `parseRule` refuses.
- [ ] Integration (`mcpWrites.int.test.ts`): a `repeatRule` sent to `add_todo` is ignored: the todo doesn't repeat.
- [ ] Nothing from `@caretook/data/series` joins the parser's imports.

**Blocked by:** nothing. **Blocks:** slice 6.

---

## Slice 6: Saving the line makes a repeating todo; the card says so and can be edited

Stack: no · Reads: docs/domain/assistant.md, docs/domain/todos.md, docs/domain/components.md · Tests: unit, integration, component

**Backlog:** B-254. **User stories:** 16, 19, 20, 23.

**What to build**

- **Preview:** a repeating todo's card reads "Todo · Due Mon · Repeats weekly on Monday". The wording (`todoRepeatLine`, in the web app's todo display today) moves into the schema package's todo display module beside `dueText`; the web module re-exports it, so the todo page's line is unchanged.
- **The runners:** the device runner and `assistantActionService.run` write the action's `repeatRule` (they pass the action to the todo create schema already; pass the field through wherever a test shows it dropped).
- A todo card's Edit passes `repeatRule` with the other prefills; `TODO_PREFILL_PARAMS` gains it; the `todos/new` form's Repeat control starts from it (with the due day it needs), so the sheet can add an end or change the days.
- An invalid or stale `repeatRule` in the URL is ignored, not an error.

**Acceptance criteria**

- [ ] Unit (`quickEntryPreview`, and the moved wording's tests moved with it): the repeat wording on a todo's preview; a todo without a repeat reads as before.
- [ ] Integration (`assistantActionService`): `addTodo` with `repeatRule` and `dueOn` makes a todo with the three repeat columns set; with no `dueOn` it is refused.
- [ ] Component (`timelineQuickEntryTodos.browser.test.tsx`): the item's line shows a Todo card with "Repeats weekly on Monday"; Save writes one todo whose page says it repeats; Undo removes it; a provider line with a repeat shows the warning on its event card.
- [ ] The entry chunk budget still passes (`pnpm build:budget` at the gate).
- [ ] Unit (`quickEntryCards`, the todo URLs test): the Edit link carries `repeatRule`; a card without a repeat carries none.
- [ ] Component (the todo sheets): `todos/new` with `dueOn` and `repeatRule` shows "Repeats weekly on Monday" and saves a repeating todo; a `repeatRule` that doesn't parse opens the form with no repeat.
- [ ] Component (`timelineQuickEntryTodos.browser.test.tsx`): Edit on a repeating todo card opens the sheet with title, due day and repeat filled in, and nothing is saved until the sheet's Save.

**Blocked by:** slice 5. **Blocks:** nothing.
