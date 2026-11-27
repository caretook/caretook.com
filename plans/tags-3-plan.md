# Plan: Tags, part 3: copy link, the Tags page, merge and search

> Source PRD: [`plans/tags-2-prd.md`](tags-2-prd.md). User-story numbers (US) refer to it. Backlog items B-891, B-895, B-899. Topic `tags-3`, the follow-on of [`tags-2`](tags-2-plan.md) (colors, seeds and quick tags), which it runs after.

## Status

| Slice | Wave | State   | Merge into `prd/tags-3` (slice commits) |
| ----- | ---- | ------- | --------------------------------------- |
| 1     | 1    | planned |                                         |
| 2     | 1    | planned |                                         |
| 3     | 1    | planned |                                         |
| 4     | 2    | planned |                                         |

## Architectural decisions

- **No migration, no sync change:** `tags-2` built the color column, `recolorTag` and the chips; merge uses the existing `record_tag` PUT and `tag` DELETE.
- **One live query per list, never one per row** (the Tags page uses one counts query).
- **Tags stay out of the search index:** tag-name matching joins `record_tag` at query time, so no `SEARCH_INDEX_VERSION` bump.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** 1 (slices 1, 2 and 3 at once) → 2 (slice 4).
- **What each slice owns:** 1 copy link (`CopyLinkButton`, `entryActionItems`, `EntryActions`, the timeline row and card); 2 the settings subpage; 3 the search page and `search.sync.ts`; 4 `mergeTags` and the page's Merge.
- **Across PRDs:** slice 1 touches `routes/app/groups/timeline/` (the row and card), a hot file of `todo-subtasks-2`; if that topic is still running when it starts, sync `dev` first. No slice touches the Planner.
- **Gates:** screens only: the quick check.
- **Docs at landing:** [tags](../docs/domain/tags.md) (the page, merge, search; drop "no merge" from _Limits_), [search](../docs/domain/search.md), [timeline](../docs/domain/timeline.md) (copy link in ⋯), [app-shell](../docs/domain/app-shell.md) (the settings subpage): wave 1; tags again wave 2.
- **When it's done:** `pnpm prd rm tags-3`.

---

## Slice 1: Copy link into the entry's ⋯ menu

Stack: no · Reads: docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-899. **User stories:** 13.

**What to build:** new `useCopyLink` out of `routes/app/groups/timeline/CopyLinkButton.tsx` (clipboard, a "Link copied" toast, the manual-copy dialog on failure); the day header's `CopyLinkButton` is built on it. `components/entry/entryActionItems.ts` and `EntryActions.tsx` gain a `copyLink` action before Print, offered when the caller passes one; `TimelineEntryRow.tsx` and `TimelineEntryCard.tsx` pass it and drop `EntryCopyLink`, so their ⋯ always shows.

**Acceptance criteria:**

- [ ] Unit (`entryActionItems.test.ts`): `copyLink` sits before Print when offered and is absent otherwise.
- [ ] Component (`timelineCopyLink.browser.test.tsx`): Copy link in a condensed row's and a full card's ⋯ copies the entry's link and shows "Link copied"; a clipboard failure shows the dialog; a viewer's row has ⋯ with Copy link; the day header's button still works; the easy view has none.

**Blocked by:** `tags-2` (all of it). **Blocks:** none. Its merge runs `pnpm backlog done B-899`.

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

**What to build:** new `mergeTags(db, fromId, intoId)` in `lib/tags/tags.sync.ts` (one local transaction: a link to `into` under `recordTagId(into, record)` for each live record carrying `from` that lacks one, then `deleteTag(from)`; owners only by `canDeleteTag`, same group only). On the Tags page (`settings/tags/route.tsx`), an owner's Merge picks another tag and confirms with both names and the count.

**Acceptance criteria:**

- [ ] Component (`settings/tagsSettings.browser.test.tsx`): an owner merges "A" into "B": every record that carried A shows B once (one that carried both keeps one link), A is gone from the page and the picker; a caretaker has no Merge, and `mergeTags` refuses one.

**Blocked by:** 2. **Blocks:** none. Its merge runs `pnpm backlog done B-891`.
