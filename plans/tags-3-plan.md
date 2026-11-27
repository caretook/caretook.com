# Plan: Tags, part 3: copy link, the Tags page, merge and search

> Source PRD: [`plans/tags-2-prd.md`](tags-2-prd.md). User-story numbers (US) refer to it. Backlog items B-955, B-891, B-895 (B-899 moved to `fixes-ui`). Topic `tags-3`, the follow-on of [`tags-2`](tags-2-plan.md) (colors, seeds and quick tags), which it runs after.

## Status

**Landing mode: run everything through** (dispatcher start, 2026-11-27): start every ready slice, land each green wave, ask only real questions via `risa ask`.

**2026-11-27, orchestrator start:** slice 1 rewritten for B-955 (the one tag control; filed by the user's word as tags-3's first slice); the copy-link slice it replaces (B-899) went to `fixes-ui` and is in `dev`. Slices 2 and 3 run beside it (no shared files; reason under _How to run_). Wave 1 started: slices 1, 2, 3 on opus, worktrees `.loops/tags-3-<n>`, watch running. Backlog session updated the registry's hot files and sees no reason to hold slice 1; if `todo-subtasks-3` (its slice 9, B-974 near `planner/`) lands first, `risa sync` before merging slice 1.

| Slice | Wave | State         | Merge into `prd/tags-3` (slice commits) |
| ----- | ---- | ------------- | --------------------------------------- |
| 1     | 1    | merged (opus) | f4d6d931c (53bebe24b, daf58de41)        |
| 2     | 1    | merged (opus) | 6b4e1a82c (c93f944f7)                   |
| 3     | 1    | merged (opus) | 4138c986e (9d6e835f8)                   |
| 4     | 2    | merged (opus) | 964cfbcf2 (47b5b39f7)                   |

**Wave 1 merged** at 4138c986e; B-955 and B-895 done (B-891 waits for slice 4). Wave 1's CI run requested at components (`risa tier`: app code). Slice 4 merged too; every slice is in, so the whole PRD lands as one: a components CI run on the tip with slice 4 follows the wave 1 run. **Wave 1 run 46056991136: file**, 3 failures, all the branch's (blame): `settings/calendar.browser.test.tsx` (Tags entry where Calendar was expected) sent to slice 2; `providers/providers.browser.test.tsx` (an extra QuickTags div on an untagged row) and `todo/todo.browser.test.tsx` (an ambiguous tag locator behind the edit sheet) sent to slice 1. Fixes merged: slice 2 a908d32bd (9d28d744b), slice 1 8e49e757b (b2f1d2ba5). Components run on the tip next. Docs to fold at wave 1's landing: tags (QuickTags always icon-only `TagPlus`, Undo toast on remove, list rows carry it, no ⋯ Tags anywhere; the Tags page, `groupTagUsesQuery`, `DeleteTagDialog`; search chips, `matchingTagIds`, `TagSwatch`, `searchGroup`'s `namedTags`; drop "Only Planner rows keep ⋯ Tags"), search, app-shell (Tags subpage), ui-kit (`Swatch`), components. Slices 1-3 changed 17, 19, 14 files (the hook's limit is 12): note for later plans. Context past the soft limit: rotate at the wave boundary after landing wave 1 and merging slice 4.

## Architectural decisions

- **No migration, no sync change:** `tags-2` built the color column, `recolorTag` and the chips; merge uses the existing `record_tag` PUT and `tag` DELETE.
- **One live query per list, never one per row** (the Tags page uses one counts query).
- **Tags stay out of the search index:** tag-name matching joins `record_tag` at query time, so no `SEARCH_INDEX_VERSION` bump.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** 1 (slices 1, 2 and 3 at once) → 2 (slice 4). Slices 2 and 3 don't wait for slice 1: neither uses the add or remove control it changes (the Tags page manages tags, search filters by one; both show tags through `TagChips` as it is), and they share no file with it.
- **What each slice owns:** 1 the tag control (`QuickTags`, `TagChips`, the list rows' tags, the Planner's ⋯); 2 the settings subpage; 3 the search page and `search.sync.ts`; 4 `mergeTags` and the page's Merge.
- **Across PRDs:** slice 1 touches `components/todos/TodoRow.tsx` and `routes/app/groups/planner/UpcomingList.tsx`, hot files of `todo-subtasks-3` (its last slice works in `lib/todos` and the services); sync `dev` before merging it if that topic lands first.
- **Gates:** screens only: the quick check.
- **Docs at landing:** [tags](../docs/domain/tags.md) (the page, merge, search; drop "no merge" from _Limits_), [search](../docs/domain/search.md), [components](../docs/domain/components.md) (the tag control on list rows), [app-shell](../docs/domain/app-shell.md) (the settings subpage): wave 1; tags again wave 2.
- **When it's done:** `pnpm prd rm tags-3`.

---

## Slice 1: One tag control everywhere tags show

Stack: no · Reads: docs/domain/tags.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component

**Backlog:** B-955 (replaces the copy-link slice: B-899 moved to `fixes-ui` and is in `dev`).

**What to build:** `QuickTags` (`components/tags/QuickTags.tsx`) always shows Add as an icon-only button with lucide `TagPlus` (its name and tooltip stay "Add tag"; the `compact` prop goes), with a wider gap between the chips and Add (`gap-1` today) so a tap meant for one doesn't hit the other. In `TagChips` (`components/tags/TagChips.tsx`) the × sits closer to the name (the badge's `pr-1` and the `size-4` button tightened), its hit area kept. A remove untags at once, then `toast({ message: "Removed <name>", undo })` (`components/ui/Toast.tsx`) whose Undo re-tags through `tagRecord` with the same derived link id. List rows that show read-only chips today get `QuickTags` (`max` 2, "+N" opens the picker, the list's one tags query passed as `tags`; chips alone for whoever can't `canTagRecord`): `components/todos/TodoRow.tsx`, `routes/app/groups/planner/UpcomingList.tsx` (its entries), `routes/app/groups/providers/ProviderListItem.tsx`, `routes/app/groups/medications/MedicationListItem.tsx`. The Planner's ⋯ Tags goes, and `EntryActions`' `onTags` with it if no caller is left. Each row keeps its stretched link (`relative z-10`, `w-fit`, as on timeline rows).

**Acceptance criteria:**

- [ ] Component (`components/tags/quickTagsRow.browser.test.tsx`): Add is an icon-only "Add tag" button on rows, pages and sheets; removing a tag shows "Removed <name>" and Undo puts it back (one link); a viewer sees chips with no × or Add.
- [ ] Component (the todos, Planner, providers and medications tag tests): a writer adds and removes a tag from a list row without opening the record; a tap beside the chips still opens it; the Planner's ⋯ has no Tags.

**Blocked by:** `tags-2` (all of it). **Blocks:** none. Its merge runs `pnpm backlog done B-955`.

---

## Slice 2: The Tags page in group settings

Stack: no · Reads: docs/domain/tags.md, docs/domain/app-shell.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component

**Backlog:** B-891. **User stories:** 3, 4, 5, 6, 8.

**What to build:** `tags` in `GROUP_SETTINGS_PAGES` (`apps/web/app/lib/care-groups/urls.ts`), an entry at the end of `groupSettingsPages` (`settings/layout/settingsPages.ts`), its route in `settings/routes.ts`, and new `settings/tags/route.tsx`. One new live query, `groupTagUsesQuery` in `lib/tags/tags.sync.ts`. Per tag: swatch, name, "n items"; Rename (`TagEditor`), Color (`recolorTag`, through the avatar card's `Swatch`/`SwatchGroup` moved from `routes/app/settings/account/AvatarCard.tsx` into a new shared `ui/` component), Delete (owners, the existing count confirm).

**Acceptance criteria:**

- [ ] Component (new `settings/tagsSettings.browser.test.tsx`): the settings list shows "Tags"; the page lists the group's tags A to Z with colors and live counts; a caretaker renames and recolors one; an owner deletes one after the confirm names the count; a viewer sees the list with no actions.
- [ ] Component (the account settings' avatar test): the avatar color choice still works after the swatch move.

**Blocked by:** `tags-2` (all of it). **Blocks:** 4.

---

## Slice 3: Search by tag

Stack: no · Reads: docs/domain/tags.md, docs/domain/search.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-895. **User stories:** 14, 15.

**What to build:** `routes/app/groups/search/TagField.tsx` becomes colored toggle chips (one on at a time, `?tag=` as today, a filter box past 12 tags). In `apps/web/app/lib/search/search.sync.ts`: pure `matchingTagIds(tags, parsed)` and a condition that adds the items carrying the matched tags to `searchGroup`'s sections as title matches, exclusions still applied. `routes/app/groups/search/loadSearch.ts` returns each result's matched tag; `ResultItems.tsx` shows its chip.

**Acceptance criteria:**

- [ ] Unit (`matchingTagIds`, in a pure sibling of `search.sync.ts` with its test): folding, every word a prefix of a word in the name ("blood" and "press" match "Blood pressure", "pressure blood" too, "bloods" not), none for an exclusion-only search.
- [ ] Component (`searchTags.browser.test.tsx`): the tags show as chips and a tap filters, a second tap clears; typing a tag's name lists an item carrying it whose text doesn't contain the word, with the tag's chip on the result; `-word` still drops a tag-matched item containing it.
- [ ] Component (`lib/search/search.sync.browser.test.tsx`): the 2,000-entry timing budget still holds with tag matching on.

**Blocked by:** `tags-2` (all of it). **Blocks:** none. Its merge runs `pnpm backlog done B-895`.

---

## Slice 4: Merge tags

Stack: no · Reads: docs/domain/tags.md, docs/domain/components.md · Tests: component

**Backlog:** B-891. **User stories:** 7.

**What to build:** new `mergeTags(db, fromId, intoId)` in `lib/tags/tags.sync.ts` (one local transaction: a link to `into` under `recordTagId(into, record)` for each live record carrying `from` that lacks one, then `deleteTag(from)`; owners only by `canDeleteTag`, same group only). On the Tags page (slice 2's new `settings/tags/route.tsx`), an owner's Merge picks another tag and confirms with both names and the count.

**Acceptance criteria:**

- [ ] Component (slice 2's new `settings/tagsSettings.browser.test.tsx`): an owner merges "A" into "B": every record that carried A shows B once (one that carried both keeps one link), A is gone from the page and the picker; a caretaker has no Merge, and `mergeTags` refuses one.

**Blocked by:** 2. **Blocks:** none. Its merge runs `pnpm backlog done B-891`.
