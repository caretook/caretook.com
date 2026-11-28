# PRD: Subtasks on their own, a view option (todo-links-2)

Backlog: B-964. Topic `todo-links-2`, after [`todo-links`](todo-links-prd.md). Planned 2026-11-27 by the dispatcher's planner; nothing was asked (no scope, permission, data, compliance or dependency choice).

## Decisions

| Decision                                                                                                                                                                                                                   | Why                                                                                                                                  | Source  | Cost to change later                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------ |
| The option is on the Todos tab and the Planner's Upcoming tab only; easy mode, the todo page's Subtasks band and the Today card keep what they show now                                                                    | the two lists where a tree hides a due step; the Subtasks band is the tree itself, and easy mode stays fixed and simple              | assumed | low: a slice per screen                    |
| Trees stay the default; the split is chosen per visit in the URL (`?subtasks=own`), carried between the Planner's tabs like `?who=`, and not remembered on the device                                                      | the item says trees stay the default; the Filter menu already keeps every choice in the URL, so the option is one more section there | assumed | low: a device store behind the same helper |
| Split means every open todo, subtasks included, is its own row in its own due section (Todos) or day (Upcoming), with "Part of <parent>" linking up; a parent still shows "n of m done" and its tick waits on its subtasks | "individual due todos": each placed by its own due, the tree rules unchanged                                                         | assumed | low: pure module                           |
| In the split, a filter or search keeps only the todos that match, with no ancestors as context                                                                                                                             | there is no tree to place them in                                                                                                    | assumed | low                                        |
| In the split, Done lists every done todo, subtasks of open trees too (no `doneListed` rule)                                                                                                                                | otherwise a done step of an open tree would show nowhere                                                                             | assumed | low                                        |
| One shared Filter menu section, "Subtasks": "In their tree" (default) and "On their own", with a chip when on; the same section on both tabs                                                                               | one control for one job (the user's guiding principle)                                                                               | assumed | low: wording                               |
| Clear filters also drops the view, back to trees                                                                                                                                                                           | Clear returns every menu section to its default                                                                                      | assumed | low                                        |
| Each split row keeps its compact quick add (writers), adding a subtask under that todo                                                                                                                                     | the same row control everywhere                                                                                                      | assumed | low                                        |
| No migration, no sync, API or permission change                                                                                                                                                                            | a view of rows the device already has                                                                                                | assumed | —                                          |

Skeptic s81 (go): nothing moved to ask; its fixes (a missed route file, `parentOf` for done rows, a revalidation note, counts) are in the plan. Declined: nothing.

## Problem

Since todo-subtasks-3 every list shows a subtask only inside its tree: a tree is placed by its most urgent open step, and on the Planner a step due on another day shows under its dimmed ancestors. That reads well for a plan with a few steps, but a caretaker who just wants "what's due, one line each" has to scan nested rows, and a deep tree shows a lot of context to get at one step. The user wants trees everywhere for now, with a way to split them later (B-964).

## Solution

A view option in the Filter menu of the Todos tab and the Planner's Upcoming tab: **Subtasks: In their tree** (the default, as today) or **On their own**. On their own, each open todo is a plain row under its own due section or day, ordered like any todo, with "Part of <parent>" linking up to its parent. Nothing else changes: ticking, Undo, the parent's progress and the quick add work as on a tree row. The choice rides in the URL, so a reload keeps it and switching between the Planner's tabs carries it, like the Assigned to filter.

## User stories

1. As a caretaker on the Todos tab, I want to switch to seeing each subtask as its own row under its own due section, so that I see everything due without opening trees.
2. As a caretaker, I want a split row to say which todo it's part of, linking to it, so that a step like "Pack the bag" still has its context.
3. As a caretaker, I want the trees to stay the default, so that the lists look as they do until I choose otherwise.
4. As a caretaker filtering or searching the split list, I want only the todos that match, so that the list stays one line per thing I asked for.
5. As a caretaker, I want done subtasks to show in Done when I'm in the split view, so that a finished step isn't lost.
6. As a caretaker on the Planner's Upcoming tab, I want the same option, so that each step due on a day is one card-row on that day among the events.
7. As a caretaker moving between Upcoming and Todos, I want my choice to come along, so that I don't set it twice.
8. As a writer, I want ticking, Undo and the quick add to work on a split row as on a tree row, so that nothing is learned twice.

## Implementation decisions

- **The view module (new, pure, client):** the URL parameter and its two values (tree, the default with no parameter, and own), read from a search string, set on one, and the Filter menu section built from a search string (title, the two options, the default, the chip label). Both tabs' Filter menus include this one section; both tabs' links carry the parameter (Todos' `listSearch`, Upcoming and Past's `tabSearch`). Past lists no todos, so its menu has no section, but its links keep the parameter so going back keeps it.
- **The tree view (`todoTreeView`) gains the split:** a function that turns a list's live todos and a match predicate into single-node trees, one per open matching todo, each its own lead, in `todoOrder`, with done and deleted ones dropped. Its output has `todoTrees`' shape, so `todoSections` (the Todos tab) and `plannerDayTrees` (Upcoming) take it unchanged: a single-node tree's only day is its own.
- **Part of:** `TodoRow` already shows "Part of <parent>" from a `parentOf` lookup in every look. The split lists pass one, built from the rows the list reads, open and done together (a parent in neither shows no line). Tree views pass none, as today.
- **The Todos tab:** with the split on, the open list is built with the split function, and the Done list's query drops `doneListed` (the loader and the live query alike, and the done count). The empty text is unchanged.
- **Upcoming:** with the split on, the day items come from the split function through `plannerDayTrees`; a split row is a tree's top row, so it shows in the `card` look like any day tree, with its "Part of" line.
- **Unchanged:** the queries' SQL other than the Done rule, the tree rules, the tick, `TodoTree` (a single-node tree renders as one row), the easy views and the todo page.

## Testing decisions

- **Unit** (`web:unit`, prior art `todoTreeView.test.ts`, `todoFilters.test.ts`, `upcomingFilters.test.ts`, `plannerTodos.test.ts`): the view module's parse, set and section; the split function (subtasks placed by their own due, done ones dropped, a match keeps no ancestors, order by `todoOrder`); the Todos and Upcoming menus include the section; the tab links carry the parameter; `plannerDayTrees` over split trees places a step on its own day.
- **Component** (prior art `routes/app/groups/todos/todoTree.browser.test.tsx`, `planner/plannerTodos.browser.test.tsx`): on the Todos tab, choosing On their own lists a seeded subtask under its own section with "Part of", and a done step in Done; on Upcoming, a step is its own row on its day.
- No integration or end-to-end tests: no server or sync change.

## Out of scope

- Remembering the choice on the device or in the user's settings (a later slice behind the same helper, if wanted).
- The split in easy mode, the Today card and the todo page's Subtasks band.
- Any change to the tree rules, rollup or due clamping.

## Notes

- B-964's note: the user wants trees everywhere for now; this toggle comes after todo-subtasks-3 (landed). It moved here from `todo-links` to keep that topic at six slices.
- Hot paths: the Todos route folder and the Planner route folder, `lib/todos/todoTreeView`, the new view module. No running topic's hot file is touched (`fixes-bug` holds `lib/todos/linkSearch`, unrelated).
