# Plan: Timeline entries link todos; quick entry reads a repeat

> Source PRD: [`plans/planner-3-prd.md`](planner-3-prd.md). User-story numbers (US) refer to it. Backlog items B-245, B-254. Topic `planner-3`.

## Status

**Where it stands:** replanned 2026-11-23, not started.

| Slice | Wave | State       | Merge into `prd/planner-3` (slice commits) |
| ----- | ---- | ----------- | ------------------------------------------ |
| 1     | 1    | not started |                                            |
| 2     | 2    | not started |                                            |
| 3     | 3    | not started |                                            |
| 4     | 3    | not started |                                            |
| 5     | 1    | not started |                                            |
| 6     | 2    | not started |                                            |

**Backlog:** claim a slice's item when it starts; run `pnpm backlog done` on an item when its last slice merges.

| Item                                     | Slices                    |
| ---------------------------------------- | ------------------------- |
| B-245 entries and todos, many to many    | 1, 2, 3, 4, and part of 6 |
| B-254 quick entry makes a repeating todo | 5, 6                      |

## Architectural decisions

- **One migration, in slice 1.** No new dependency, extension or route.
- **The link table copies the provider links:** a derived id (`entryTodoId`), cascading composite keys, hard-delete unlink, PUT and DELETE only, through `linkTable`. Where this plan is silent, do what the provider links do.
- **No kind check in the table or service.** Screens show links on `NOTE_DOCUMENT_KINDS` only.
- **New clients never write `todo.event_id`.** Only the server's mirror, `releaseEvent` and `unlink` touch it, until a contract migration drops it.
- **Readers join live rows.** Soft deletes keep link rows.
- **Who links:** `WRITERS`. Viewers and both Easy roles only tick a todo assigned to them.
- **One live query per list, never one per row.**
- **Registries are composed from area parts** ([rules across PRDs](../docs/agents/orchestrator.md#rules-across-prds)). Additive edits only, at the end of the group.
- **The parser stays free of `rrule`.** Every new parser rule adds a row to `quickEntry.test.ts`.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** (1, 5) → (2, 6) → (3, 4). Slices 1 to 4 are B-245; 5 and 6 are B-254.
- **Gates:** slice 1 adds a migration and a sync stream, so wave 1 runs the full check and `roundtrip`. Slice 2 moves existing behaviour, so wave 2 runs `roundtrip` too.
- **The migration:** when a sync brings another topic's migration, keep `dev`'s and regenerate this one on top, then reread the hand-kept parts: the publication line, the backfill and the throwaway functions.
- **Shared files:** slices 2 and 6 both edit `lib/todos/urls.ts` and `todos/new`, on different lines; merge in plan order. Slice 6 alone owns the `addTodo` blocks in both runners. Slices 3 and 4 share only the query module from slice 1.
- **Other topics' hot files:** `dose-accuracy` (`assistantActionService.ts`), `connectors-3` (connector tools). Keep edits there small and sync after their landings.
- **Docs at landing:** wave 1 [todos](../docs/domain/todos.md), [sync](../docs/domain/sync.md), [care-groups](../docs/domain/care-groups.md), [assistant](../docs/domain/assistant.md); wave 2 [appointments](../docs/domain/appointments.md), [connectors](../docs/domain/connectors.md), [todos](../docs/domain/todos.md); wave 3 [timeline](../docs/domain/timeline.md), [live-notes](../docs/domain/live-notes.md), [todos](../docs/domain/todos.md).
- **When it's done:** `pnpm prd rm planner-3`. Tell `connectors-3` that `addTodo.repeatRule` exists.

---

## Slice 1: The link table, backfill, sync and server mirror

Stack: yes · Reads: docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/providers.md, docs/domain/todos.md, docs/domain/care-groups.md · Tests: unit, integration, e2e:roundtrip

**Backlog:** B-245. **User stories:** 4, 11, 13, 14, 15.

**What to build**

- **`timeline_entry_todo`** (adds a migration) with `entryTodoId`, keys, unique pair and publication, as the PRD describes.
- **The backfill** from `todo.event_id`, using a SHA-1 and UUID v5 SQL function created and dropped in the migration.
- **`entryTodoService`** over its model, its permission entry and errors.
- **Sync:** the stream, the device schema, the `linkTable` upload entry.
- **The device module** `lib/todos/entryTodos.sync.ts`: `linkTodo`, `unlinkTodo`, and live-row queries for an entry's todos, a todo's entries and open counts per entry.
- **The mirror** in `todoService` create and update. `releaseEvent` keeps link rows. `unlink` clears `todo.event_id` when it names that entry.
- **The server's touched rule:** `isUntouchedNext` drops its column check, and `todoService` counts a next occurrence with a link row as touched.
- **Plumbing:** a fixture helper, the seeds, the check-areas line, the sync matrix row with its id copy, and the table's name in the unsaved-changes `KINDS`.

**Acceptance criteria**

- [ ] Unit: `entryTodoId` is stable, case-insensitive and differs per pair.
- [ ] Integration: backfilled ids equal `entryTodoId`; a todo with no event gets no row; the helper functions no longer exist.
- [ ] Integration (`entryTodoService`): a writer links and unlinks on a note and an event; twice is one row; a viewer, an Easy role and a non-member are refused; another group reads nothing; a hard delete cascades.
- [ ] Integration (upload): PUT links, DELETE unlinks, PATCH is refused, a repeated PUT is accepted.
- [ ] Integration (mirror): an old client's create links; a change swaps the pair; clearing removes it; an update with an unchanged `eventId` relinks nothing; a soft-deleted event keeps its rows and readers don't show them; unlinking clears a matching column.
- [ ] Integration: reopening keeps a next occurrence that has a link row.
- [ ] Integration: the replication role reads the table; the frozen lists gain their entries.
- [ ] End to end (`roundtrip`): a link made on one device reaches the server and the other device.

**Blocked by:** nothing. **Blocks:** 2, 3, 4, 6.

---

## Slice 2: Existing event and todo behaviour moves onto links

Stack: yes · Reads: docs/domain/todos.md, docs/domain/appointments.md, docs/domain/components.md · Tests: unit, component, e2e:roundtrip

**Backlog:** B-245. **User stories:** 8, 14, 16.

**What to build**

Nothing looks different; the device's readers and writers of a todo's event move to link rows: the series touched check and delete, the device's entry removal, device todo queries, `LinkedTodos`, the todo page's links and loader, the form's event picker on create, and the device's touched check on reopen. `updateTodo` stops carrying `eventId`, so saving the edit form leaves links alone. `todos/new` gains the `entryId` prefill for any live note or event, saving the todo and its link in one local transaction; the old `eventId` URL still works.

**Acceptance criteria**

- [ ] Apart from the quick-entry runner (slice 6), no web-app code writes `event_id`.
- [ ] Component: a backfilled event shows its todos; the form's picker writes one link; removing an event offline keeps the todo.
- [ ] Component: editing a backfilled todo's title keeps its link, and uploads no `event_id` change.
- [ ] Component: `todos/new` with a note's `entryId` saves a linked todo; an id that isn't a live note or event is ignored.
- [ ] Device tests: a series edit keeps a visit with a linked todo; reopening keeps a linked next occurrence.
- [ ] A rescheduled event's todos stay on the cancelled event, pinned by a test.

**Blocked by:** 1. **Blocks:** 3, 4.

---

## Slice 3: An entry's page lists, adds, links and removes todos

Stack: no · Reads: docs/domain/todos.md, docs/domain/live-notes.md, docs/domain/providers.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-245. **User stories:** 1, 2, 3, 5, 6, 10, 12, 24.

**What to build**

The Todos section on a stored note or event, replacing `LinkedTodos`, with Add todo (the `entryId` prefill from slice 2), Link a todo and Remove, as the PRD describes.

**Acceptance criteria**

- [ ] Unit: picker options (open, not linked, matching, capped).
- [ ] Component, on a note and an event: open and done todos; tick and Undo; add, link and remove, offline too; a viewer ticks only their own and sees no actions.
- [ ] Component: a vital, symptom and dose page show no section; one todo shows on two entries.
- [ ] Picker and remove buttons have text names.

**Blocked by:** 1, 2. **Blocks:** nothing.

---

## Slice 4: The todo page links many entries; the timeline marks open todos

Stack: no · Reads: docs/domain/todos.md, docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-245. **User stories:** 4, 7, 9, 10, 24.

**What to build**

Linked to on the todo page lists every linked entry and lets writers link or remove. Note and event rows in the full timeline show the open-todo mark from one live query.

**Acceptance criteria**

- [ ] Unit: the mark's wording (1, 2, none at 0).
- [ ] Component: a todo with two entries lists both and opens them; a deleted entry drops out; a reader sees no actions.
- [ ] Component: the mark shows on a note and an event, leaves when the todo is ticked, and is absent in the simple view.
- [ ] The mark is text a screen reader reads.

**Blocked by:** 1, 2. **Blocks:** nothing.

---

## Slice 5: Quick entry reads a repeat

Stack: no · Reads: docs/domain/assistant.md, docs/domain/todos.md, docs/domain/connectors.md · Tests: unit, integration

**Backlog:** B-254. **User stories:** 17, 18, 19, 22, 23.

**What to build**

`quickEntryRepeat`, the `repeatWord` rows, the splitter's weekday list, `addTodo.repeatRule`, the reading and ranking from the PRD, and the connector's `add_todo` leaving the field out. Build on the parser as quick-entry-2 left it; its negation, count and time rules must still pass.

**Acceptance criteria**

- [ ] Unit (`quickEntryRepeat`): each phrase family, the first day with today included, a 31st in a short month, "every 4 hours" gives none, the interval limits.
- [ ] Unit (`quickEntry.test.ts`): the item's line; with "7am" and "for Sam"; `todo:` with a repeat; the dose line stays a log; the provider line's order and warning; the weekday list as one part; "everyone was tired" reads as before.
- [ ] Unit: `addTodo` takes a valid `repeatRule` and refuses an invalid one.
- [ ] Integration: a `repeatRule` sent to `add_todo` is ignored.
- [ ] Nothing from `@caretook/data/series` joins the parser's imports.

**Blocked by:** nothing. **Blocks:** 6.

---

## Slice 6: Saving makes a repeating todo; the card says so and can be edited

Stack: no · Reads: docs/domain/assistant.md, docs/domain/todos.md, docs/domain/connectors.md, docs/domain/components.md · Tests: unit, integration, component

**Backlog:** B-254, and B-245's quick-entry and connector part. **User stories:** 8, 14, 17, 20, 21, 24.

**What to build**

The card reads "Todo · Due Mon · Repeats weekly on Monday", with `todoRepeatLine` moved to the schema package and re-exported. Both runners write the rule, and an `addTodo` naming an entry writes a link row instead of the column. Edit passes `repeatRule`, and `todos/new` starts from it, ignoring one that doesn't parse. Connector `list_todos` keeps `eventId` as the first linked event and adds `linkedEntryIds`.

**Acceptance criteria**

- [ ] Integration and device tests: `addTodo` naming an entry writes the link on both runners, and the device runner writes no `event_id`.
- [ ] Integration: `list_todos` returns both fields for a todo with two linked entries.

- [ ] Unit: the preview's repeat wording; the Edit link carries `repeatRule` only when there is one.
- [ ] Integration (`assistantActionService`): a repeat with `dueOn` sets the three repeat columns; without `dueOn` it is refused.
- [ ] Component: the item's line shows the card, Save makes one repeating todo, Undo removes it, and Edit opens the filled sheet and saves nothing until Save.
- [ ] Component: a `repeatRule` that doesn't parse opens the form with no repeat.
- [ ] `pnpm build:budget` passes.

**Blocked by:** 1, 5. **Blocks:** nothing.
