# Plan: Shared displays

> Source PRD: [`plans/shared-displays-prd.md`](shared-displays-prd.md). User-story numbers (US) refer to it. Backlog item B-961. Topic `shared-displays`, after `todo-subtasks-3` and `tags-3` (both done).

## Status

| Slice | Wave | State   | Merge into `prd/shared-displays` (slice commits) |
| ----- | ---- | ------- | ------------------------------------------------ |
| 1     | 1    | planned |                                                  |
| 2     | 2    | planned |                                                  |
| 3     | 3    | planned |                                                  |
| 4     | 3    | planned |                                                  |
| 5     | 3    | planned |                                                  |
| 6     | 4    | planned |                                                  |
| 7     | 1    | planned |                                                  |

## Architectural decisions

- **Displays only:** no migration, no sync, API, route or URL change.
- **Each kind's display lives in its feature folder** (`components/entry`, `components/todos`, `components/providers`, `components/medications`) and keeps its existing contract for existing callers; new needs are optional props. Callers pass data, labels, callbacks and small slots (PRD _Implementation decisions_), never React Aria parts.
- **Data hooks stay:** each display passes through `data-*` attributes (`MedicationCard` already does; `ProviderCard` gets it in slice 4, `TimelineEntryRow` and `TodoRow` in slice 5), so `data-result`, `data-result-id`, `data-provider-id`, `data-medication-id`, `data-todo-link`, `data-upcoming-item` and the rest keep their places for existing tests.
- **One live query per list, never per row:** tags come from `useGroupRecordTags` per kind and members from the group's members query, read once by the list (search's in `SearchResults.tsx`, slice 2).
- **Hands off `routes/app/groups/medications/` and `apps/web/app/lib/todos/`** (med-intervals' and sync-safety-2's hot files); `apps/web/test/device.tsx` is onboarding-2's: add fixtures nowhere but in the slice's own test file or a `*World.tsx`.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the inventory (PRD _Inventory (today)_, as built) into [components](../docs/domain/components.md) _Rules_ at landing.

## How to run this plan

- **Waves:** 1 (slices 1 and 7 at once) → 2 (slice 2) → 3 (slices 3, 4 and 5 at once) → 4 (slice 6).
- **What each slice owns:** 1 the search page's split into one result file per kind (no behaviour change); 2 `SearchResults.tsx`: the results' tags (named first) and members, read once and passed to every item; 3 `MedicationCard` and the medication result and provider-page rows; 4 `ProviderCard` and the provider result, directory and medication-page rows; 5 the entry and todo results and the two rows' `data-*` passthrough; 6 the todo page's link rows and the "Link to" picker's icons; 7 the Planner's cards. Wave 3's slices each touch only their own kind's result file (slice 1 made them), never `SearchResults.tsx` (slice 2 passes them everything).
- **Across PRDs:** no running topic's hot file is touched. If med-intervals starts, it shares nothing with this plan (its folder is out of bounds here).
- **Gates:** screens only: the quick check.
- **Docs at landing:** [components](../docs/domain/components.md) (a "Shared displays" rule: each kind's display, its looks and the exceptions; the `components/todos/` and `components/entry/` lists), [search](../docs/domain/search.md) (results as the shared displays, their tags named first), [providers](../docs/domain/providers.md) (`ProviderCard`), [medications](../docs/domain/medications.md) (`MedicationCard`'s new props).
- **When it's done:** `risa rm shared-displays`.

---

## Slice 1: Search results one file per kind

Stack: no · Reads: docs/domain/search.md, docs/domain/components.md · Tests: component · Check: apps/web/app/routes/app/groups/search/search.browser.test.tsx

**Backlog:** B-961. **User stories:** 8 (the regions the kinds change apart).

**What to build:** a move, no behaviour change. Split `routes/app/groups/search/ResultItems.tsx` into one file per kind: `EntryResultItem.tsx` (new), `ProviderResultItem.tsx` (new), `MedicationResultItem.tsx` (new), `TodoResultItem.tsx` (new), `ConditionResultItem.tsx` (new), and their shared bits (`STRETCHED`, `OpenName`, `Marked`, `NotesSnippet`, `NamedTags`) into `resultParts.tsx` (new); `ResultItems.tsx` goes and `SearchResults.tsx` imports from the new files.

**Acceptance criteria:**

- [ ] Component: the existing search tests (`search.browser.test.tsx`, `searchTags.browser.test.tsx`, `searchTodos.browser.test.tsx`, `searchConditions.browser.test.tsx`, `easyResultSheet.browser.test.tsx`) pass unchanged; no test is edited.

**Blocked by:** none. **Blocks:** 2.

---

## Slice 2: Search results' tags and authors, read once

Stack: no · Reads: docs/domain/search.md, docs/domain/tags.md, docs/domain/components.md · Tests: unit, component · Blocked by: 1 · Check: apps/web/app/routes/app/groups/search/searchTags.browser.test.tsx

**Backlog:** B-961. **User stories:** 6, 7.

**What to build:** `routes/app/groups/search/SearchResults.tsx` reads the shown results' tags live with `useGroupRecordTags` (entry, provider, medication, todo: one query each) and the group's members once (`membersQuery`, as a provider's linked entries do), and passes each item its `tags`, ordered by a new pure `namedFirst` in `lib/tags/tagPicker.ts` (the tags the text names first, then A to Z), and `nameOf`/`imageOf`. The four items (new `EntryResultItem.tsx`, new `ProviderResultItem.tsx`, new `MedicationResultItem.tsx`, new `TodoResultItem.tsx`) show their tags as `QuickTags` (`max` 2, "+N"; `readOnly` for the easy roles, as on the Planner) in place of `NamedTags` (which goes from new `resultParts.tsx`); conditions have no tags. The items take `nameOf`/`imageOf` now and use them in slice 5.

**Acceptance criteria:**

- [ ] Unit (`lib/tags/tagPicker.test.ts`): the new `namedFirst` puts named tags first, keeps the rest A to Z, and leaves a list with none named in A to Z order.
- [ ] Component (`searchTags.browser.test.tsx`): a result carrying a named tag and two others shows the named one among its first two chips; a writer adds a tag from a result row without opening it; a viewer and an easy role see chips with no Add; a tag added on another device (`sync()`) shows on the row.
- [ ] The existing search tests pass.

**Blocks:** 3, 4, 5.

---

## Slice 3: One medication display

Stack: no · Reads: docs/domain/medications.md, docs/domain/providers.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component · Blocked by: 2 · Check: apps/web/app/components/medications/medicationCard.browser.test.tsx (new)

**Backlog:** B-961. **User stories:** 1, 6, 7.

**What to build:** `components/medications/MedicationCard.tsx` gains new optional props: `title` (a node in place of the name, for search's marks), `open` (its page, the default; a callback, rendered as a button, for easy roles' sheets; `null`: a plain name, no link), `removed` (greyed "<name> (removed)", no link or actions), `label` (a quiet line above the name) and `trailing` (above the stretched link, like `actions`). A new `MedicationIcon` (new) beside it (the pill circle, muted when stopped) replaces the hand-made one inside the card; export both from `components/medications/index.ts`. Callers: new `routes/app/groups/search/MedicationResultItem.tsx` (title marked, `open` the easy roles' `onOpen`, summary, notes snippet and its `QuickTags` (slice 2's) as children); `routes/app/groups/provider/ProviderMedications.tsx` (label "Prescribes" / "Fills" / both, the summary line, its tags from one `useGroupRecordTags` query as `QuickTags` children). The medication list (`routes/app/groups/medications/`) is untouched.

**Acceptance criteria:**

- [ ] Component (new `medicationCard.browser.test.tsx`): the same medication on the provider's page and in search shows `data-medication-name` linking to its page, the summary, a stopped one muted with its marker, and its tags' chips; an easy role's search result opens its read-only sheet, not the page; a `removed` one reads "(removed)" with no link, and `open={null}` shows a plain name.
- [ ] The existing provider, search and medications tests pass (data hooks kept).

**Blocks:** 6.

---

## Slice 4: One provider display

Stack: no · Reads: docs/domain/providers.md, docs/domain/medications.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component · Blocked by: 2 · Check: apps/web/app/components/providers/providerCard.browser.test.tsx (new)

**Backlog:** B-961. **User stories:** 2, 6, 7.

**What to build:** a new `components/providers/ProviderCard.tsx`: the markup of `routes/app/groups/providers/ProviderListItem.tsx`'s full and condensed rows moved there (`look: "full" | "condensed"`, its badges, `QuickTags`), with the same optional `title`, `open`, `removed`, `label` and `trailing` as `MedicationCard` (slice 3's shape; the two are written apart, so match the names in the PRD) and a `contact` slot, a `data-*` passthrough on its row, (the directory passes `ProviderRowContact`) and `actions` (`ContactActions`; condensed's default stays `quickActions`' first). Export it from `components/providers/index.ts`. `ProviderListItem` becomes a thin caller. Callers: new `routes/app/groups/search/ProviderResultItem.tsx` (from slice 1; `full`, title marked, the type · specialty · practice line, notes snippet, `open` the easy roles' `onOpen`); `routes/app/groups/medication/MedicationProviders.tsx` (the condensed look, label "Prescriber" / "Pharmacy", all quick actions, a deleted one `removed`, tags from one `useGroupRecordTags` query).

**Acceptance criteria:**

- [ ] Component (new `providerCard.browser.test.tsx`): one provider in the directory, in search and on a medication's page shows `data-provider-name` linking to its page, its type icon, Primary/Past badges and tag chips; Call works from each; a deleted prescriber reads "(removed)" with no link or actions; an easy role's search result opens its sheet.
- [ ] The existing providers, medication and search tests pass (data hooks kept).

**Blocks:** 6.

---

## Slice 5: Entries and todos in search as on the timeline and Todos page

Stack: no · Reads: docs/domain/search.md, docs/domain/timeline.md, docs/domain/todos.md, docs/domain/components.md · Tests: component · Blocked by: 2 · Check: apps/web/app/routes/app/groups/search/searchRows.browser.test.tsx (new)

**Backlog:** B-961. **User stories:** 3, 4, 7.

**What to build:** new `routes/app/groups/search/EntryResultItem.tsx` renders `TimelineEntryRow` (`components/entry/TimelineEntryRow.tsx`) with `elsewhere`, `search`, `tags`, its `open` (`entryOpen`, as today: a page, a writer's sheet, or nothing), the author's name and picture from slice 2's `nameOf`/`imageOf`, and no `onEdit`/`onDelete` (the ⋯ keeps Copy link and Print). new `routes/app/groups/search/TodoResultItem.tsx` renders `TodoRow` (`components/todos/TodoRow.tsx`, `list`, no `onTick`), which gains an optional `search` (its title's matches marked) and `footer` (search's notes snippet, under the due line); the assignee chip takes slice 2's `nameOf`. Both rows render their own `<li>`, so each gains a `data-*` passthrough onto it (as `MedicationCard` has), which keeps search's `data-result`/`data-result-id`/`data-opens`/`data-done`. Five files with the test.

**Acceptance criteria:**

- [ ] Component (new `searchRows.browser.test.tsx`): an entry result has the timeline row's parts (kind icon, day and time, author avatar, the ⋯ with Copy link and no Delete) and opens as before for a writer (a symptom's sheet) and a viewer (a note's page); a todo result has the Todos row's due line, assignee chip and repeat mark, its title marked, its notes snippet, and no tick.
- [ ] The existing search and todos tests pass.

**Blocks:** 6.

---

## Slice 6: A todo's links as the shared displays

Stack: no · Reads: docs/domain/todos.md, docs/domain/timeline.md, docs/domain/components.md · Tests: component · Blocked by: 3, 4, 5, 7 · Check: apps/web/app/routes/app/groups/todo/todoLinks.browser.test.tsx

**Backlog:** B-961. **User stories:** 1, 2, 3, 6, 7.

**What to build:** in `routes/app/groups/todo/TodoLinks.tsx`, `ProviderLink` renders `ProviderCard` (`condensed`, label "Provider", all quick actions, `removed` once deleted, `open={null}` when `linkPages` is off (the easy roles), `trailing` the writer's `RemoveLink`) and `MedicationLink` renders `MedicationCard` (label "Medication", same rules), both with their tags (one `useGroupRecordTags` query each in `TodoLinks`). In `routes/app/groups/todo/TodoEntryLinks.tsx`, `EntryLinkRow` renders `TimelineEntryRow` (`elsewhere`, its `open` carrying the opener state, tags, `trailing` the writer's Remove), which gains that optional `trailing` slot in its right column and carries `data-todo-link` through slice 5's passthrough; `IconDot` and the hand-picked icons go. `components/todos/LinkToBox.tsx` takes its option icons from `KIND_META` (notes, events) and `MedicationIcon`.

**Acceptance criteria:**

- [ ] Component (`todoLinks.browser.test.tsx`): a todo's linked provider, medication, note and event show their shared displays (`data-provider-name`, `data-medication-name`, the timeline row's kind icon and author), each opening its page; a writer's Remove unlinks it and leaves both records; a viewer sees no Remove; a cancelled event is struck through with its label; a removed provider reads "(removed)"; the "Link to" picker's event option shows the timeline's event icon.
- [ ] The existing todo and links tests pass.

**Blocks:** none.

---

## Slice 7: The Planner's cards as the entry display's Planner look

Stack: no · Reads: docs/domain/appointments.md, docs/domain/timeline.md, docs/domain/components.md · Tests: component · Check: apps/web/app/components/entry/plannerLook.browser.test.tsx (new)

**Backlog:** B-961. **User stories:** 5, 6, 7.

**What to build:** move the card of `routes/app/groups/planner/UpcomingRow.tsx` (which goes) to `components/entry/UpcomingEntryCard.tsx` (new), exported from `components/entry/index.ts`, taking `EntryViewProps` (`components/entry/TimelineEntryRow.tsx`) plus its extras as plain props: `now`, `readOnly`, the computed `place` (text and "from"), `rescheduledTo` (`{ id, label }`), `openState` (the Planner's return state) and a `footer` slot. The planner's helpers (place and contact actions, the opener, the rescheduled target) stay in the route, called only by `routes/app/groups/planner/UpcomingList.tsx`, which computes and passes them, so `components/entry` never imports from the planner. Its ⋯ is `EntryMenu`, which gains an `onPrepare` passthrough to `EntryActions` and an optional `label` (the Planner keeps "Actions for <title>", so the planner tests' menu lookups hold) (Edit with its series scope is the caller's `onEdit`), so the Planner gets Copy link; tags are `RowTags`, which gains `readOnly` (the easy roles' chips only, as today); the author is `AuthorFilterLink`/`AuthorCircle` as on the timeline (`readOnly` the plain one), so `UpcomingRowAuthor` goes from `routes/app/groups/planner/UpcomingRowParts.tsx` (`UpcomingRowActions` stays there, passed as the `footer`). `UpcomingList.tsx` passes callbacks (`onEdit`, `onPrepare`, `onRemind`, `cancel`, `onDelete`) instead of building `EntryActions`, and `tags` instead of a `QuickTags` node. Seven files with the test.

**Acceptance criteria:**

- [ ] Component (new `plannerLook.browser.test.tsx`): a Planner event card shows its time range, place, Call and Directions, tags and the timeline's author avatar; its ⋯ has Copy link, and for a writer Prepare, Cancel, Delete and, on a series event only, Edit; an easy role's card has no menu, its avatar isn't a filter, and its tags are chips with no Add tag; a cancelled one rescheduled links its new event.
- [ ] The existing planner tests pass.

**Blocks:** 6.
