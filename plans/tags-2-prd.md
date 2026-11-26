# PRD: Tags, part 2: colors, a tags page, quick tagging and tag search

Topic `tags-2`, the follow-on of [`tags`](tags-prd.md). Backlog items: B-891 (tags page), B-892 (quick tag add and remove), B-893 (tag colors), B-894 (richer seed data), B-895 (search by tag), B-899 (the timeline's copy link into ⋯). Plans: [`tags-2-plan.md`](tags-2-plan.md) (colors, seeds, quick tags) and its follow-on [`tags-3-plan.md`](tags-3-plan.md) (copy link, the Tags page, merge, search), cut so each topic stays about six slices. Area doc: [tags](../docs/domain/tags.md).

## Decisions

| Decision                                                                                                                                                                                                                                                                                                      | Why                                                                                                                        | Source                       | Cost to change later                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| A tag's color is a new nullable `color` column on `tag` (an additive migration), synced to every device; ids are the ten avatar colors, checked in SQL like the `user` avatar checks                                                                                                                          | "like avatar colors" (B-893); one palette, one set of tokens with their light and dark contrast                            | assumed                      | high: a migration and the sync shape                    |
| The migration gives every existing tag a color: per group, in creation order, cycling through the palette (no two alike until all ten are used)                                                                                                                                                               | "each tag gets a color" (B-893); only staging and dev data exist, and no tag's name, links or meaning change               | assumed                      | medium: data already written                            |
| A new tag's color is picked on the device that adds it: a random palette color no group tag uses yet, any when all are taken; an upload or server call without one gets the same pick on the server; two offline devices may pick one color (fine)                                                            | B-893's words; the device writes first, offline too                                                                        | assumed                      | medium                                                  |
| Recoloring follows rename's rule (`canRenameTag`: owners, admins, caretakers; an Easy helper only on a tag they created): it's an update of the same row, so no permission changes                                                                                                                            | least new surface; the existing SQL scope decides                                                                          | assumed                      | low: one rule                                           |
| Merge is included: an owner merges tag A into tag B; every live record carrying A gets B (if it hasn't already), then A is deleted with its links                                                                                                                                                             | B-891 asks "(and merge?)" and its note leaves it to the planner; merging removes a tag, so it follows delete (owners only) | assumed                      | medium: owners-only is one rule, the semantics are data |
| Merge runs on the device as existing uploads (`record_tag` PUTs under derived ids, then the `tag` DELETE), with no new server operation; links on soft-deleted records aren't moved (the link service refuses non-live records) and go with A, so a restored record carries neither, as delete already does   | device-first, like every tag write; a merge replayed or run on two devices lands on the same rows                          | assumed                      | medium                                                  |
| The tags page is a new group settings subpage, "Tags", at the end of the list, for every member who can open group settings (Easy roles can't, as today); viewers see the list read-only                                                                                                                      | B-891 "under group settings"; every member already reads tags                                                              | assumed                      | low                                                     |
| The page lists the group's tags A to Z, each with its color, name and how many live records carry it, plus Rename and Color (`canRenameTag`), Delete and Merge (owners); no Add on the page (tags are made while tagging)                                                                                     | the smallest page that covers B-891 and B-893's picking                                                                    | assumed                      | low                                                     |
| One shared quick-tags component (`QuickTags`): the record's chips, each with a remove button, then an "Add tag" button that opens the existing picker sheet; read-only chips for anyone `canTagRecord` refuses; the picker's Add-new only for `canCreateTag`; the caller sets how many chips show before "+N" | B-892's words, the third note in full                                                                                      | preference (the user's note) | low                                                     |
| `QuickTags` goes on timeline rows in the condensed and full views and the easy view, every record's page (entry, todo, provider, medication) and every edit sheet that edits a taggable record (the timeline's symptom and vital sheet, the todo, provider and medication edit sheets)                        | B-892's second note: "the edit and view pages of everything taggable"                                                      | preference (the user's note) | low: one slice adds a place                             |
| It replaces ⋯ > Tags on timeline rows and cards, the entry page and the todo page, the provider page's Tags button and the medication edit sheet's Tags button; Planner rows keep ⋯ > Tags (the item doesn't name the Planner, and its screen is a running topic's hot file)                                  | B-892 "no ⋯ menu", within the screens it names                                                                             | assumed                      | low                                                     |
| A chip's remove is one tap with no confirm or undo (adding it back is one tap)                                                                                                                                                                                                                                | "a tap on a chip to remove, one to add"                                                                                    | assumed                      | low                                                     |
| On timeline rows and cards, "Copy link" moves into the entry's ⋯ menu, before Print, for every role (the menu now always shows there); a copy shows a "Link copied" toast, a failure the existing dialog; the day header keeps its link button; the easy view has no copy link, as today                      | B-899                                                                                                                      | assumed                      | low                                                     |
| Search's tag filter becomes a row of tag chips in their colors, one on at a time (tap again to clear), with a filter box once the group has more than 12 tags                                                                                                                                                 | B-895 "a filter you can see and tap (not a dropdown)"                                                                      | assumed                      | low                                                     |
| Typed search text matches tag names: a tag matches when every positive word of the search is a prefix of a word in its name (folded as `tagKey` folds); the items carrying it join each section ranked with the title matches, exclusions still drop items, and each such result shows the matched tag's chip | B-895; mirrors the query language's "words all match, each as a prefix"; tags stay out of the index                        | assumed                      | low: a query change, no index bump                      |
| Server search (`search.query`) and connectors don't learn tag names                                                                                                                                                                                                                                           | the tags area's _Limits_; connectors-5 owns connector tags                                                                 | assumed                      | low                                                     |
| Seeds: every seed group gets several fictional tags, each on records of more than one kind, with colors                                                                                                                                                                                                       | B-894                                                                                                                      | assumed                      | low                                                     |

Skeptic pass: the first (s58) sent the plan back. It said the edit sheets B-892 names were dropped, slices were too big, and a backfill test couldn't work. The rework covers every edit sheet, cuts the work into `tags-2` and `tags-3`, and tests the backfill from the migration's SQL. The second (s59) said go; its two small notes, a cross-PRD line for `tags-3` and a tighter backfill test, are taken. Declined: nothing.

## Problem

Tags work, but they're slow to use and hard to look after. Adding a tag to a timeline entry takes ⋯, Tags, then a toggle; on a provider it's a header button, on a medication a button inside the edit sheet. Nothing lists the group's tags: renaming or deleting one means opening the picker on some record. Every chip looks the same, so a glance at the timeline tells you little. Search's tag filter is a dropdown that hides what's there, and typing a tag's name finds nothing unless the word happens to be in the text. And the seed data has three tags, so none of this can be tried properly.

## Solution

Each tag gets a color, picked for you when it's made and changeable later, and every chip shows it. A Tags page in group settings lists the group's tags with how much each is used; there you rename, recolor, delete or merge them. Wherever a record shows its tags (timeline rows in every view, and each record's page), the chips have a remove button and an "Add tag" button beside them, so tagging is a tap away. The timeline row's link button moves into its ⋯ menu to make room. Search shows the tags as colored chips to tap, and typing a tag's name finds what carries it. The seeds get enough tags to see all of it.

## User stories

1. As a caretaker, I want each tag to have its own color, so that I can tell tags apart at a glance on the timeline and in lists.
2. As a caretaker adding a new tag, I want it to get a color no other tag in the group has yet, so that I don't have to pick one.
3. As a caretaker, I want to change a tag's color, so that colors can mean something to my family.
4. As any member who can open group settings, I want a Tags page listing every tag with how many items carry it, so that I can see how the group uses them.
5. As a caretaker, I want to rename a tag from the Tags page, so that I don't have to find a record that carries it.
6. As an owner, I want to delete a tag from the Tags page, after seeing how many items carry it, so that I can clean up the list.
7. As an owner, I want to merge one tag into another, so that duplicates like "Insurance" and "Insurance forms" become one without retagging each record.
8. As a viewer, I want to see the Tags page without being offered changes, so that I know what tags exist.
9. As a caretaker, I want to add a tag to a timeline entry right on its row, in the condensed, full and easy views, so that tagging is one tap away.
10. As a caretaker, I want to remove a tag from a row or a record's page with one tap on its chip, so that fixing a mistake is quick.
11. As a caretaker, I want the same tag controls on every taggable record's page and edit sheet (entries, events, todos, providers, medications), so that tagging works the same way everywhere.
12. As an Easy helper, I want the tag controls only on my own entries, and as a viewer only the chips, so that the controls match what I'm allowed to do.
13. As a member, I want the timeline row's "copy link" in its ⋯ menu, so that rows have room for tags.
14. As a member searching, I want the group's tags shown as colored chips I can tap to filter, so that I can see what's there without opening a dropdown.
15. As a member searching, I want typing a tag's name to find the items carrying it, with the tag shown on each result, so that a tag is as findable as words.
16. As a developer or tester, I want the seed groups to carry several colored tags on records of every taggable kind, so that tag features can be tried without setting them up.

## Implementation decisions

### Tag colors (data and sync)

- **The rules module** (`tagRules`, client-safe) gains `TAG_COLORS` (the avatar color ids, one list) with its Zod schema, and `pickTagColor(used, random)`: a random color from those not in `used`, any color when all are used. Pure; the random source is passed in so tests fix it.
- **The `tag` table** gains `color` (nullable text, checked against the palette like the `user` avatar columns); an additive migration adds it and backfills existing tags per group in creation order, cycling through the palette. A null color (an old row or a newer device's unknown id) renders as today's neutral chip.
- **`tagService.create`** takes an optional `color`; without one it picks with `pickTagColor` over the group's colors inside its advisory lock. A new **`tagService.recolor(ctx, id, color)`** writes `color` as the actor, so the tag's update scope decides (rename's rule), and refuses an unknown color.
- **The upload** (`tag` in the sync registry): `color` becomes a content column; a PUT passes it to `create`, a PATCH of `color` is `recolor` (a PATCH may carry `name`, `color` or both).
- **Sync config and the device schema:** `color` on the `tag` row, appended.
- **Device module** (`tags.sync.ts`): `createTag` picks the color from the group's local tags; a new `recolorTag(db, tagId, color)` checks `canRenameTag`. `tagsQuery`, `recordTagsQuery` and `groupRecordTagsQuery` return the color.

### Chips and seeds

- **One tag-look map** in `ui/` beside `avatarLook` (`tagColorClass(color)`): whole Tailwind class names over the existing `--color-avatar-*` tokens and `--color-avatar-content` text, so contrast in light and dark is the avatars'. `TagChips` and the picker's toggles show it.
- **Seeds** (`seeds/tags.ts`, append-only, derived ids): more fictional tags on Dev Family and the other seed groups, each on several kinds (notes, events, todos, providers, medications), each with a color. Its unit test checks every seed tag lands on a seeded record and colors are palette ids.

### The Tags page (group settings)

- **A settings subpage `tags`** in the group settings registry (`GROUP_SETTINGS_PAGES`, `groupSettingsPages`, the settings routes), reading only the local database.
- **One live query for the page:** the group's tags with their live use counts (`groupTagUsesQuery`, beside `tagUsesQuery`, one row per tag, never a query per tag).
- **Per tag:** the color swatch, name and "n items"; Rename reuses `TagEditor`; Color is a radio group of the palette (the avatar card's swatches moved into a shared `ui/` component and reused by both); Delete reuses the existing confirm naming the count; **Merge** (owners) picks another tag and confirms with both names and the count.
- **`mergeTags(db, fromId, intoId)`** (device module): in one local transaction, for each live record carrying `from`, a link to `into` under `recordTagId(into, record)` unless one exists, then `deleteTag(from)`. Owners only (`canDeleteTag`); same group only. Its uploads are the existing `record_tag` PUT and `tag` DELETE, so a replay or a second device's merge writes the same rows.

### Quick tags

- **`QuickTags`** (`components/tags/`), a deep component: props `target`, `recordId`, `label` (the picker's title), `createdBy` (for `canTagRecord`), `max` (chips before "+N"; null shows all), and optionally the record's tags when a list already has them (rows pass theirs from the one group query; pages let it read `useRecordTags`). It decides read-only versus editable from the role, renders the chips with a remove button each, "Add tag" opening the picker (`useTagPicker`, Add-new only for `canCreateTag`), and sits above a row's stretched open target so taps never open the entry.
- **Places:** timeline rows and cards (condensed, full and easy), the entry page header, the todo page, the provider page, the medication page header, and the edit sheets: the timeline's symptom and vital sheet, the todo, provider and medication edit sheets (the last replacing `MedicationTags`'s button). On an edit sheet each add or remove is its own local write, never part of Save, as the medication sheet's toggles are today. The ⋯ Tags item goes from those places (callers stop passing `onTags`); the Planner still passes it.

### Copy link in ⋯

- **`useCopyLink`**, taken out of `CopyLinkButton`: copy an absolute `appUrls` path to the clipboard, "Link copied" as a toast, the existing manual-copy dialog on failure. `CopyLinkButton` (the day header) is built on it.
- **`entryActionItems`** gains a `copyLink` action (before Print) offered when the caller passes one; timeline rows and cards pass it, and their `EntryCopyLink` button goes. The entry page, Upcoming and the easy view are unchanged.

### Search by tag

- **The tag filter** (`TagField`) becomes chips: the group's tags in their colors as toggle buttons (`aria-pressed`), one on at a time, writing `?tag=` as today; a filter box above them once there are more than 12.
- **Tag-name matching** (`search.sync.ts`): `matchingTagIds(tags, parsed)` (pure, folds through `tagKey`: every positive word is a prefix of a word in the name; none for an exclusion-only search) and a condition that adds the items carrying those tags to `searchGroup`'s sections, ranked as title matches, with the search's exclusions still applied. `taggedItems` and `?tag=` behave as today; with both, the tag filter narrows and the text (words or tag names) matches within it.
- **Results** show the matched tag's chip (`loadSearch` returns which tag matched an item).

## Testing decisions

- **Unit:** `pickTagColor` and `TAG_COLORS` in `tagRules.test.ts`; `matchingTagIds` (folding, word prefixes, exclusions); the seed test; `entryActionItems` with `copyLink`.
- **Integration** (`packages/api` sync tests, prior art `syncTags.int.test.ts`): a PUT with a color, a PUT without one getting an unused color, a PATCH of `color` by a caretaker and an Easy helper on someone else's tag (refused), an unknown color refused; `tags.int.test.ts` for `recolor` and `create`'s pick.
- **Component** (`renderWithDevice`, prior art `timelineTags.browser.test.tsx`, `entryTags.browser.test.tsx`, `searchTags.browser.test.tsx`): chips in color; the Tags page (counts, rename, recolor, an owner's delete and merge, a viewer's read-only page); `QuickTags` on a row and on each page (remove, add, read-only for a viewer, an Easy helper on their own entry only); Copy link in ⋯; the search chips and a typed tag name finding a tagged item.
- **End to end:** none. Color rides the existing `tag` row, covered by `roundtrip` and the sync matrix's device rows; merge uses existing uploads.

## Out of scope

- Quick tags on Planner rows (they keep ⋯ > Tags).
- Adding a tag from the Tags page; nested tags; more than one tag per filter.
- Tag names in server search, the search index, connectors (connectors-5), calendar feeds, emails or print views.
- Undo for removing a tag or a merge.

## Notes

- `todo-subtasks-2` is running with `routes/app/groups/timeline/` and `routes/app/groups/planner/` as hot files; in `tags-2`, slice 4 touches `todos/` (the todo edit sheet) and slice 6 `timeline/`, each one running topic's hot file; none touches the Planner. `tags-3` runs after `tags-2`.
- The migration takes the next number when it lands (rules across PRDs).
- B-884 (the timeline loader's tag read, fixes-perf) is unaffected: rows already get their tags from the one group query.
