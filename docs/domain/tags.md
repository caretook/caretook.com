# Tags

One shared tag list per care group; tags go on timeline entries (events included), todos, providers and medications. PRD: [`tags-prd`](../../plans/tags-prd.md). ✅ data and sync (wave 1); 🟡 the picker, chips, filters, rename and delete (later waves).

## Data

- **Schema area `tags`** (`packages/data/src/db/schema/tags/`): `tag` (`name`, `name_key`, unique per group on each of `name_key` and `id`; hard delete, cascades with the group) and `record_tag` (`tag_id` plus one nullable column per target: `entry_id`, `todo_id`, `provider_id`, `medication_id`). Every foreign key is composite on `group_id`, so a link never crosses groups; a `num_nonnulls(…) = 1` check allows exactly one target. Hard-deleting a target or the tag removes its links; **a soft-deleted record keeps its links**, hidden from every list.
- **The rules module** `tagRules.ts` (client-safe) is the only place that folds a name or decides who tags: `tagKey` (case and spaces folded), the name schema (1–40 characters), `tagId(groupId, key, counter)` and `recordTagId(tagId, recordId)` (version 5 UUIDs), `nextTagId` (the first counter free locally, below `TAG_COUNTER_LIMIT` 1000), `targetOf`, `canCreateTag`, `canTagRecord`, and the `?tag=` helpers. **Ids are derived, never `randomUUID`:** two offline devices adding "Urgent" land on one tag and one link.
- **Who:** read any member. Create a tag: loggers. Tag and untag: writers on any target; an Easy helper only on a timeline entry they created, whoever made the tag. **Tagging never borrows a record's update permission** (viewers and Easy roles hold `update` on todos only to tick). Rename (slice 3): writers, and Easy helpers on tags they created (`groupOwn` on `created_by`); delete: owners only. `record_tag` update is `system`.
- **Services:** `tagService.create` is idempotent on id and returns the tag even after a rename; a name held by another id is `tagService:nameTaken` (with its dependent link, it shows in "Changes not saved"). It takes a group advisory lock. `recordTagService.link`/`unlink` check both ends are live and in the group (cross-group is `recordTagService:immutable`) and read the target's `created_by` in SQL.

## Sync

- Both tables are in the `care_groups` stream for every role and the device schema (`tags`, `recordTags`). Upload: `tag` PUT → `create` (PATCH and DELETE read-only until slice 3); `record_tag` has its own small handler: PUT → link with null targets as null, DELETE → unlink, PATCH `sync:readOnlyTable`.
- Device module `lib/tags/tags.sync.ts` (`caretookModules.tags`): `tagsQuery`, `recordTagsQuery`, `groupRecordTagsQuery` (live records only); `createTag` reuses a local tag with the same key, else takes `nextTagId`; `tagRecord`/`untagRecord` check `canTagRecord` first.
- `roundtrip` covers two offline devices adding the same tag to one entry; the sync matrix has device rows for both tables.

## Limits

- Tags stay in the app: no connector tool, calendar feed, email, print view or search index reads them.
- Not tagged: conditions, allergies, care periods, a repeating series as a whole. One tag per filter; no merge, colors or nesting.
- Known limit: a device that never saw a rename can add the old name and land on the renamed tag.
- Seeds: `seeds/tags.ts`, three fictional tags on Dev Family's records with derived ids.
