# Plan: One "Link to…" box and quick add where you are

> Source PRD: [`plans/todo-links-prd.md`](todo-links-prd.md). User-story numbers (US) refer to it. Backlog items B-944, B-945, B-946, B-947, B-948. B-964 (the split view) moved to the follow-on topic `todo-links-2`. Topic `todo-links`, after [`todo-subtasks-3`](todo-subtasks-3-plan.md).

## Status

**Planned 2026-11-27** by the dispatcher's planner. Six slices, three waves; each small (B-947's suggestions are split from the recently viewed store so neither passes about eight files; B-964, unrelated to links, went to `todo-links-2`). Skeptic s74's go added `searchTables.sync.ts` to slice 3 and `updateTodo`'s no-`entryIds` rule to slice 2. Reworked after skeptic s71's send-back: med conditions indexed (B-946), slice 5 blocked by 2, `chosenLinkChip` stays put, B-964 cut.

| Slice | Wave | State   | Merge into `prd/todo-links` (slice commits) |
| ----- | ---- | ------- | ------------------------------------------- |
| 1     | 1    | planned |                                             |
| 2     | 2    | planned |                                             |
| 3     | 2    | planned |                                             |
| 4     | 1    | planned |                                             |
| 5     | 3    | planned |                                             |
| 6     | 1    | planned |                                             |

## Architectural decisions

- **No migration, no sync rule change, no API change.** Links are the existing `provider_id` and `medication_id` slots and `timeline_entry_todo` rows, all device-written today.
- **One link search, one box** (`lib/todos/linkSearch.sync.ts`, `components/todos/LinkToBox.tsx`): the sheets and the todo page use the same; no screen keeps its own picker. Its pure parts (options, type words, suggestions) are in `lib/todos/linkOptions.ts`, tested as units.
- **The box reads site search's index through `lib/search`'s exports, unchanged** (`searchGroup`, `matchingTagIds`, `parseSearch`; `compareHits` from `searchResults.ts`). Only slice 3 edits `lib/search/` (two files, additively: `search.sync.ts` and `searchTables.sync.ts`): it's `fixes-bug`'s hot prefix.
- **One shared quick add** (`TodoQuickAdd`): the Todos list, the todo page and now the provider, medication, note and event pages. It takes a parent todo, a link, or both; nothing else adds a todo inline.
- **Writers only** for every link and add control (`isTodoWriter`); readers see links as today.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** 1 (slices 1, 4, 6) → 2 (slices 2, 3) → 3 (slice 5). Slices 2 and 3 both build on slice 1's box; 2 owns the sheets and `todos.sync.ts`, 3 the box's chips, the link search and the index. Slice 5 needs 1, 2 (it edits the rewritten `TodoLinkFields`), 3 (the chips it narrows by) and 4 (the store).
- **What each owns:** 1 the link search and box and the todo page's Linked to; 2 the sheets and the device writes; 3 type filter and the index; 4 the recently viewed store; 5 the suggestions; 6 quick add on linkable pages.
- **Gates:** the quick check. No integration tests (no service change); component tests over a real index use `renderWithDevice({ search: true })`.
- **Docs at landing:** [todos](../docs/domain/todos.md) every wave; [search](../docs/domain/search.md) at wave 2 (phone, version 6; the box as a search consumer); [components](../docs/domain/components.md) at waves 1, 2 (the box, the quick add's link).
- **When it's done:** `pnpm prd rm todo-links`.

---

## Slice 1: The link search and box, on the todo page

Stack: no · Reads: docs/domain/todos.md, docs/domain/search.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-944. **User stories:** 1, 2, 3, 10.

Size: six code files (two edited, three new, the index export) and three tests; no file another slice of this wave touches.

**Build:** PRD _The link search (new, device)_ (without the type word) and _The box (new shared component)_ (without chips and suggestions), then _The sheets and the todo page_'s todo page part.

- New `lib/todos/linkSearch.sync.ts` `searchLinkables(db, groupId, text, { exclude, limit })`: `parseSearch`, `matchingTagIds`, `searchGroup` with todos and conditions at 0, entries over-fetched and kept only for live notes and live, not cancelled events; rows read for display; one list by `compareHits`.
- New `lib/todos/linkOptions.ts` `linkOptions(candidates, now)`: `{ id, type, label, description }` (event when via `eventWhen`, provider specialty or type · practice · Past, medication strength, note day). Reuse `todoLinks.ts`'s describers (`eventWhen`) by import; `todoLinks.ts` keeps `eventWhen` and `chosenLinkChip` (slice 2 removes only its three option builders), so slices 2 and 3 never edit the same module.
- New `components/todos/LinkToBox.tsx`: combo box over `searchLinkables` (debounced as the search page's field), type icons, the description line, "Preparing search…" while the index isn't ready; `onPick({ type, id })`; export it from `components/todos/index.ts`.
- `routes/app/groups/todo/TodoLinks.tsx` `TodoLinks`: `LinkToBox` for writers, excluding what's linked; an entry pick `linkTodo`, a provider or medication pick `updateTodo` (replacing the slot). Provider and medication rows get writers' Remove (`updateTodo` with null).
- `routes/app/groups/todo/TodoEntryLinks.tsx`: `LinkEntryPicker` and `EntrySearch` removed (`EntryLinkRow` stays).

**Acceptance:**

- [ ] `lib/todos/linkOptions.test.ts` (new, unit): each type's label and second line; linked ones left out; a past provider marked.
- [ ] `components/todos/linkToBox.browser.test.tsx` (new, component, real index): typing finds a provider, a medication, a note and an event in one list, a title match first; never a todo, a condition, a dose or a cancelled event; each option has its icon and line.
- [ ] `routes/app/groups/todo/todoLinks.browser.test.tsx` (changed): a writer links a provider, a medication and a note from the page; a second provider replaces the first; Remove unlinks each; a reader sees no box or Remove.

**Blocked by:** none. **Blocks:** 2, 3, 5.

---

## Slice 2: The sheets use the box

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-944. **User stories:** 1, 3.

Size: six code files (one removed) and four tests.

**Build:** PRD _The sheets and the todo page_ (the sheets and device writes).

- `routes/app/groups/todos/TodoLinkFields.tsx` `TodoLinkFields`: one `LinkToBox`, chosen links as chips with × (`ChipList`: one provider, one medication, any notes and events); hidden fields `providerId`, `medicationId`, repeated `entryIds`; the edit sheet shows notes and events too (`withEvent` goes).
- `routes/app/groups/todos/LinkPickerField.tsx`: removed. `routes/app/groups/todos/todoLinks.ts`: the three option builders removed; `eventWhen` and `chosenLinkChip` stay there.
- `routes/app/groups/todos/todoFormData.ts` (`FIELD.entryIds`, read all), `routes/app/groups/todos/TodoForm.tsx` (initial links: the todo's, or the prefill's `providerId`, `medicationId`, `eventId`/`entryId` as `entryIds`; the hidden `entryId` input goes). The prefill params (`lib/todos/urls.ts` `TODO_PREFILL_PARAMS`, `todos/new/route.tsx`) stay as they are: `TodoForm` maps them, so neither changes.
- `lib/todos/todos.sync.ts` `TodoInput.entryIds`; `createTodo` writes a link row per live note or event in the group (others ignored); `updateTodo` writes the difference against the todo's link rows (`entryTodoRow`, delete), in its transaction, only when `entryIds` is given: without it (slice 1's page picks, every other caller) link rows are left alone; never `eventId`.

**Acceptance:**

- [ ] `routes/app/groups/todos/todoFormData.test.ts` (changed, unit): `entryIds` read, repeated and empty.
- [ ] `lib/todos/todos.sync.browser.test.tsx` (changed, component): `updateTodo` with `entryIds` adds and removes link rows; without `entryIds` (a title or provider change) the note and event links stay.
- [ ] `routes/app/groups/todos/todoLinks.browser.test.tsx` (changed, component): a new todo saved with a provider, a medication, a note and an event has all four; opened from an event's or provider's page it starts with that link; the edit sheet adds a note and removes an event on Save, and Cancel changes nothing.
- [ ] `routes/app/groups/todos/todoLinks.test.ts`: the removed builders' cases deleted; what stays passes.

**Blocked by:** 1. **Blocks:** 5.

---

## Slice 3: Type chips, type words and phone matching

Stack: no · Reads: docs/domain/search.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-945, B-946. **User stories:** 4, 5, 6.

Size: about nine code and test files; `search.sync.ts` and `searchTables.sync.ts` are in one running topic's (`fixes-bug`'s) hot prefix, edited additively.

**Build:** PRD _The link search_ (the type word), _The box_ (chips), _Search index (B-946)_.

- `lib/todos/linkOptions.ts` `linkTypeWord(text)` (new): `{ type, rest }` for a first or last type word (the PRD's list, folded), else `{ type: null, rest: text }`.
- `lib/todos/linkSearch.sync.ts` `searchLinkables`: a `type` option (only that type); the type word read first.
- `components/todos/LinkToBox.tsx`: the chips (`ChipGroup`, as `TagField`): All, Providers, Events, Meds, Notes; one on; a typed type word turns its chip on.
- `packages/data/src/db/schema/search/searchDocument.ts`: `providerSearchDocument` (`phones` in the body, as stored and digits only); `medicationSearchDocument` (`conditionNames`, the names of its linked conditions from `medication_condition`, in the body).
- `apps/web/app/lib/search/search.sync.ts`: `readProviders` selects the phones; `readMedications` selects the linked condition names; the dirty-id query re-indexes a medication when its `medication_condition` rows or a linked condition's name change; `SEARCH_INDEX_VERSION` 6 (additive edits only).
- `apps/web/app/lib/search/searchTables.sync.ts` `SOURCES`: `medication_condition` added (its trigger records changed ids), so the dirty-id query sees link changes.

**Acceptance:**

- [ ] `lib/todos/linkOptions.test.ts` (unit): type words first and last, plural and short forms, a word alone, no word.
- [ ] `packages/data/src/db/schema/search/searchDocument.test.ts` (unit): a provider's phones in its body, digits only too; a medication's linked condition names in its body.
- [ ] `components/todos/linkToBox.browser.test.tsx` (component, real index): a chip narrows; "provider lee" turns Providers on and finds Dr. Lee; finds a provider by practice and phone, a medication by brand, reason and a linked condition's name (and after that condition is renamed), an event by place and its provider, a note by its text, an item by its tag name.

**Blocked by:** 1. **Blocks:** 5.

---

## Slice 4: Recently viewed

Stack: no · Reads: docs/domain/search.md, docs/domain/auth.md · Tests: unit, component

**Backlog:** B-947. **User stories:** 7.

**Build:** PRD _The box_'s **Recently viewed** bullet.

- New `lib/core/recentlyViewed.ts`: `recordView(userId, { type, id })`, `recentlyViewed(userId)` (newest first, distinct, at most 10), `forgetRecentlyViewed()`, `useRecordView(type, id)` (records once a live record shows); storage that throws means none (like `lib/search/recentSearches.ts`).
- `lib/auth/forgetUserData.ts`: calls `forgetRecentlyViewed()`.
- `useRecordView` in `routes/app/groups/provider/route.tsx`, `routes/app/groups/medication/route.tsx` and `routes/app/groups/entry/route.tsx` (notes and events only).

**Acceptance:**

- [ ] `lib/core/recentlyViewed.test.ts` (new, unit): order, distinct, cap, per user, throwing storage, forget.
- [ ] An existing page test (`routes/app/groups/provider/provider.browser.test.tsx`, component): opening a provider records it; a deleted one isn't.

**Blocked by:** none. **Blocks:** 5.

---

## Slice 5: Suggestions before typing

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-947. **User stories:** 7.

**Build:** PRD _The box_'s **Suggestions** bullet.

- `lib/todos/linkOptions.ts` `linkSuggestions({ cameFrom, upcoming, recent, linked, type })` (new, pure): came-from first, the next 3 upcoming events, the last 5 recently viewed; distinct, linked ones out, narrowed by the chip.
- `lib/todos/linkSearch.sync.ts`: read the rows for the suggested ids (live only) and the next events (as `eventLinkOptions` did).
- `components/todos/LinkToBox.tsx`: a `cameFrom` prop; suggestions while the text is empty (and while the index prepares).
- `routes/app/groups/todos/TodoLinkFields.tsx`: `cameFrom` from the prefill (the page the sheet opened from).

**Acceptance:**

- [ ] `lib/todos/linkOptions.test.ts` (unit): order, dedupe, linked left out, chip narrowing, none at all.
- [ ] `components/todos/linkToBox.browser.test.tsx` (component): an empty box from a provider's sheet lists that provider first, then upcoming events, then a recently viewed medication; a chip narrows them; typing replaces them with results.

**Blocked by:** 1, 2, 3, 4. **Blocks:** none.

---

## Slice 6: Quick add on linkable pages

Stack: no · Reads: docs/domain/todos.md, docs/domain/components.md · Tests: component

**Backlog:** B-948. **User stories:** 8, 9, 10.

**Build:** PRD _Quick add from linkable pages_.

- `components/todos/TodoQuickAdd.tsx` `TodoQuickAdd`: `parent` and `ancestors` become optional and a new optional `link` (a provider, medication or entry id) joins them, so today's callers (`TodoTree`, `TodoSections`, `TodoSubtasks`) stay unchanged. With a link and no parent, `createTodo` adds a top-level todo with `providerId`, `medicationId` or `entryId`; with both, a linked subtask. The full form's labels say "Add a todo" without a parent. `mayAddSubtask` stays; add `mayAddTodo(role)`.
- `components/todos/LinkedTodos.tsx`: the full quick add replaces "Add todo" (writers); each open row gets the compact subtask quick add carrying the link.
- `routes/app/groups/entry/EntryTodos.tsx`: the same, with the entry as the link (Link a todo stays).

**Acceptance:**

- [ ] `components/todos/todoQuickAdd.browser.test.tsx` (changed): a link target adds a top-level todo with the link; a parent plus link adds a linked subtask; a reader sees nothing.
- [ ] `components/todos/linkedTodos.browser.test.tsx` (changed): on a provider page a writer adds "Call to confirm" and it lists there, linked; a subtask under it lists too.
- [ ] `routes/app/groups/entry/entryTodos.browser.test.tsx` (changed): on an event page a writer adds a todo, linked (`timeline_entry_todo` row); Enter keeps the field for the next.

**Blocked by:** none. **Blocks:** none.
