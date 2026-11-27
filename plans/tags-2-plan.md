# Plan: Tags, part 2: colors, seeds and quick tags

> Source PRD: [`plans/tags-2-prd.md`](tags-2-prd.md). User-story numbers (US) refer to it. Backlog items B-892, B-893, B-894. Topic `tags-2`, the follow-on of [`tags`](tags-plan.md); the PRD's copy link, Tags page, merge and search are [`tags-3`](tags-3-plan.md), cut off so each topic stays about six slices.

## Status

| Slice | Wave | State   | Merge into `prd/tags-2` (slice commits) |
| ----- | ---- | ------- | --------------------------------------- |
| 1     | 1    | landed  | 5cb59418 (af753337, 46b45b17, a5b7e245) |
| 2     | 2    | landed  | 7b892610 (d362bd70)                     |
| 3     | 3    | landed  | 8cc6a9c5 (ca9829f5)                     |
| 4     | 4    | merged  | 09a762ee (0cd98a93)                     |
| 5     | 5    | planned |                                         |
| 6     | 5    | planned |                                         |

**Landing mode:** run everything through (dispatcher start; land each green wave, ask only real questions).

**Now:** wave 4: slice 4 (opus) handed off (slice check passed on 0cd98a93) and merged as 09a762ee; wave gate CI tier `components` requested. Worktree tags-2-4 kept until green. B-892 stays claimed (done after slices 5 and 6). Slice 4 notes for 5/6: rows pass `max={2}` and `tags={byRecord.get(id) ?? []}`; "Add tag" text may be wide on rows (a compact variant is a small change in `QuickTags`); timeline, Planner and provider ⋯ `onTags` paths still to remove. `Badge` takes `fill` (`tagColorClass`). After a seed change, the stack needs `pnpm datastore:reset` before browser checks.

## Architectural decisions

- **One migration** (slice 1): `tag.color`, nullable, checked against the palette, existing tags backfilled. It takes the next number when it lands.
- **One palette:** tag colors are the avatar color ids and tokens (`TAG_COLORS` in `tagRules`, one class map in `ui/`); a null or unknown color renders as the neutral chip.
- **Device first:** create with a color and recolor are local writes uploaded through the existing `tag` handler; `recolor` is the only new service operation, and it follows rename's update scope.
- **One live query per list, never one per row** (rows keep the group's record-tag query).
- **`QuickTags` is the one tag control** on rows, pages and edit sheets; places only pass the record, the author and `max`.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** 1 → 2 → 3 → 4 → 5 (slices 5 and 6 at once).
- **What each slice owns:** 1 the data and service; 2 the upload, sync config, device schema and device module; 3 the chip look and seeds; 4 `QuickTags`, the entry and todo pages and the todo edit sheet; 5 the provider and medication pages and sheets; 6 the timeline rows and the timeline's edit sheet.
- **Across PRDs:** slice 4 touches `routes/app/groups/todos/` (the todo edit sheet) and slice 6 `routes/app/groups/timeline/`, both hot files of the running `todo-subtasks-2` (one each). If that topic is still running when they start, sync `dev` first. No slice touches `routes/app/groups/planner/`.
- **Gates:** slices 1 and 2 run the integration tests they add; the rest are screens: the quick check.
- **Docs at landing:** [tags](../docs/domain/tags.md) every wave (colors, `QuickTags`; drop "colors" from _Limits_); [timeline](../docs/domain/timeline.md) wave 5.
- **When it's done:** `pnpm prd rm tags-2`; `tags-3` runs after it.

---

## Slice 1: Tag colors in the data

Stack: no · Reads: docs/domain/tags.md, docs/domain/data-layer.md · Tests: unit, integration

**Backlog:** B-893. **User stories:** 2, 3.

**What to build:** `TAG_COLORS` (the avatar ids) and `pickTagColor(used, random)` in `packages/data/src/db/schema/tags/tagRules.ts`; `color` on `tagSchema` (`packages/data/src/db/schema/tags/tag.ts`) with its check, and `tagCreateZSchema` taking an optional color; adds a migration (the column, the check, the backfill per group in creation order). `tagService.create` (`packages/data/src/services/tagService.ts`) picks an unused color when none is given, inside its lock; new `tagService.recolor`.

**Acceptance criteria:**

- [ ] Unit (`tagRules.test.ts`): `pickTagColor` never returns a used color while one is free, returns a palette color when all are used, and follows the given random source.
- [ ] Integration (`packages/data/src/services/tags.int.test.ts`): `create` without a color takes one no group tag has; `recolor` by a caretaker passes, by an Easy helper on someone else's tag is refused, an unknown color is refused.
- [ ] Integration (the backfill, prior art `packages/data/src/services/entryTodo.int.test.ts`'s "the migration's backfill": read the migration's backfill `UPDATE` from its file (not the column or check statements, as that test filters) and run it on a group the test builds): the `UPDATE` touches only tags with no color yet; a group's colorless tags get distinct colors in creation order until ten are used, and another group's are its own.

**Blocked by:** none. **Blocks:** 2.

---

## Slice 2: Tag colors through sync

Stack: no · Reads: docs/domain/tags.md, docs/domain/sync.md · Tests: integration, component

**Backlog:** B-893. **User stories:** 2, 3.

**What to build:** the `tag` upload in `packages/api/src/syncRegistry.ts`, where the new color column is a content column: a PUT passes it to `create`, a PATCH of `color` is `recolor` (with or beside `name`). `color` appended to the `tag` select in `powersync/sync-config.yaml` and to `tags` in `apps/web/app/lib/sync/schema.ts`. In `apps/web/app/lib/tags/tags.sync.ts`: `createTag` picks with `pickTagColor` over the group's local tags; new `recolorTag(db, tagId, color)` (`canRenameTag`); `TagRow`, `GroupTagRow` and their three queries carry `color`.

**Acceptance criteria:**

- [ ] Integration (`packages/api/src/syncTags.int.test.ts`): a `tag` PUT with a color stores it, one without gets an unused color; a PATCH of `color` recolors; an Easy helper's PATCH of someone else's tag's color is refused; an unknown column still fails as before.
- [ ] Component (`entryTags.browser.test.tsx`, `renderWithDevice`): adding a tag in the picker writes a color no other group tag has.

**Blocked by:** 1. **Blocks:** 3.

---

## Slice 3: Colored chips and richer seeds

Stack: no · Reads: docs/domain/tags.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: unit, component

**Backlog:** B-893, B-894. **User stories:** 1, 16.

**What to build:** new `apps/web/app/components/ui/tagLook.ts` (`tagColorClass`, whole class names over the `--color-avatar-*` tokens and `--color-avatar-content`, beside `avatarLook.ts`); `TagChips` and `TagPickerSheet`'s toggles show each tag's color. `packages/data/src/db/seeds/tags.ts`: more fictional tags (append only, derived ids, a color each) on every seed group, each on several kinds of record (notes, events, todos, providers, medications).

**Acceptance criteria:**

- [ ] Unit (`packages/data/src/db/seeds/tags.test.ts`): every seed group has tags; every taggable kind carries at least one; every link names a seeded record; every color is a palette id.
- [ ] Unit (`apps/web/app/components/ui/avatarTokens.test.ts`): `tagColorClass` maps every `TAG_COLORS` id and gives nothing for null or an unknown id.
- [ ] Component (`entryTags.browser.test.tsx`): the entry page's chip carries its tag's color class; a tag with no color shows the neutral chip.

**Blocked by:** 2. **Blocks:** 4. Its merge runs `pnpm backlog done B-893 B-894` (picking a color by hand is the Tags page's, B-891 in `tags-3`).

---

## Slice 4: Quick tags, on the entry and todo pages

Stack: no · Reads: docs/domain/tags.md, docs/domain/components.md · Tests: component

**Backlog:** B-892. **User stories:** 10, 11, 12.

**What to build:** new `apps/web/app/components/tags/QuickTags.tsx` (exported from `components/tags/index.ts`): chips with a remove button each, "Add tag" opening the picker, read-only by `canTagRecord`, Add-new in the picker only by `canCreateTag`, a `max` prop, optional tags from the caller. Placed in `routes/app/groups/entry/EntryPageHeader.tsx` (its ⋯ Tags goes), `routes/app/groups/todo/route.tsx` with `TodoActions.tsx` (⋯ Tags goes), and the todo edit sheet `routes/app/groups/todos/edit/route.tsx` (each tap its own write, not part of Save).

**Acceptance criteria:**

- [ ] Component (`entryTags.browser.test.tsx`): a caretaker removes a tag with one tap on its chip and adds one through "Add tag"; a viewer sees chips and no buttons; an Easy helper gets the buttons on their own entry only; ⋯ has no Tags.
- [ ] Component (`routes/app/groups/todo/todo.browser.test.tsx`): the todo page and its edit sheet tag and untag through `QuickTags`; ⋯ has no Tags; a viewer sees chips only.

**Blocked by:** 3. **Blocks:** 5, 6.

---

## Slice 5: Quick tags on providers and medications

Stack: no · Reads: docs/domain/tags.md, docs/domain/components.md · Tests: component

**Backlog:** B-892. **User stories:** 11, 12.

**What to build:** `QuickTags` on `routes/app/groups/provider/route.tsx` (the header Tags button goes from `ProviderHeader.tsx`), the provider edit sheet `routes/app/groups/providers/edit/route.tsx`, `routes/app/groups/medication/MedicationHeader.tsx`, and the medication edit sheet through `routes/app/groups/medications/MedicationTags.tsx` (its Tags button goes).

**Acceptance criteria:**

- [ ] Component (`providerTags.browser.test.tsx`): the provider page and its edit sheet tag and untag; the header Tags button is gone; a viewer sees chips only.
- [ ] Component (`medicationTags.browser.test.tsx`): the medication page and its edit sheet tag and untag, never through Save; a viewer sees chips only.

**Blocked by:** 4. **Blocks:** none.

---

## Slice 6: Quick tags on timeline rows

Stack: no · Reads: docs/domain/tags.md, docs/domain/timeline.md, docs/domain/components.md · Tests: component

**Backlog:** B-892. **User stories:** 9, 10, 12.

**What to build:** slice 4's quick tags control (`max` 2, the tags from the list's one query) in place of `TagChips` in `routes/app/groups/timeline/TimelineEntryRow.tsx` and `TimelineEntryCard.tsx`, for the condensed, full and easy views; `TimelineEntryList.tsx` stops passing `onTags`, so rows' ⋯ loses Tags. The symptom and vital edit sheet `routes/app/groups/timeline/edit/route.tsx` gets the control too.

**Acceptance criteria:**

- [ ] Component (`timelineTags.browser.test.tsx`): on a condensed row, a full card and an easy row, a caretaker adds and removes a tag without opening the entry; a viewer sees chips only; "+N" past two; an Easy helper gets the buttons on their own entries only; rows' ⋯ has no Tags.
- [ ] Component (`timelineTagEdit.browser.test.tsx`): the symptom edit sheet tags and untags, never through Save.

**Blocked by:** 4. **Blocks:** none. Its merge runs `pnpm backlog done B-892` once slice 5 is merged too.
