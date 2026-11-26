# Plan: Tags

> Source PRD: [`plans/tags-prd.md`](tags-prd.md). User-story numbers (US) refer to it. Backlog item B-548. Topic `tags`.

## Status

**Where it stands:** wave 1 starting (2026-11-25). `symptom-catalog` is done.

**Landing mode:** run everything through (started run-through by the dispatcher): start every ready slice, land each green wave, ask only real questions via `pnpm prd ask`.

**Models:** slice 1 opus.

**Wave 1:** slice 1 worktree `tags-1` (slot 3) made, opus agent spawned 2026-11-25. B-548 claimed.

| Slice | Wave | State       | Merge into `prd/tags` (slice commits) |
| ----- | ---- | ----------- | ------------------------------------- |
| 1     | 1    | started     |                                       |
| 2     | 2    | not started |                                       |
| 3     | 3    | not started |                                       |
| 4     | 3    | not started |                                       |
| 5     | 3    | not started |                                       |
| 6     | 4    | not started |                                       |

**Backlog:** claim B-548 when slice 1 starts; run `pnpm backlog done B-548` when the last slice merges.

## Architectural decisions

Durable decisions every slice follows:

- **One pure rules module** owns the tag key, both derived ids, the name schema, `canTagRecord` and `?tag=`. Nothing else folds a tag name or decides who may tag.
- **Ids are derived,** on device and server alike. Never `randomUUID` for a tag or link.
- **Tagging never borrows a record's update permission:** viewers and Easy roles hold `update` on todos only to tick them.
- **Tags stay in the app:** no connector tool, calendar feed, email, print view or search index reads them.
- **Additive only:** one pending migration for the topic, in slice 1. Say "adds a migration"; take the next number when it lands.
- **Offline first:** the picker, chips and filters read the local database.
- **No new dependency.**
- **Loops don't edit docs.** The orchestrator adds `docs/domain/tags.md` and its _Area index_ entry at landing, and folds changes into [sync](../docs/domain/sync.md) and [care-groups](../docs/domain/care-groups.md).

## How to run this plan

- **Waves:** 1 → 2 → (3, 4, 5) → 6.
- **Gates:** each slice hands off on `pnpm prd check --quick "slice hand-off"`; wave gates are quick checks. Slice 1 appends device-written `tag` and `record_tag` rows to the sync matrix, the tag before the link, with the derived ids copied into `sync-matrix.mjs` as `entryProviderId` is, and their `cleanupSql` deletes.
- **Ownership:** slice 1 the tables, rules, create and link services, sync and device module; slice 2 the picker, chips, entries and the `EntryFilters` tag field; slice 3 rename and delete, service to screen; slice 4 todos, repeating todos and the Planner's filter; slice 5 providers and medications; slice 6 the timeline's filter and search.
- **Beside other topics:** append to the shared registries (`sync-config.yaml`, device schema, upload registry, `services/` and `models/` indexes, `sync-matrix.mjs`). `symptom-catalog` lands first because of the timeline's filter files.

---

## Slice 1: Tags and links, through sync

Stack: yes · Reads: docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/care-groups.md, docs/domain/todos.md · Tests: unit, integration, e2e:roundtrip

**Backlog:** B-548. **User stories:** 5, 6, 7, 14.

### What to build

Adds a migration for `tag` and `record_tag` with their final keys, their models, final permissions, errors, `tagService.create`, `recordTagService` and the pure rules module in a new `tags` schema area. Both tables join the `care_groups` stream, the device schema and the upload registry (PUT on both, DELETE on `record_tag`; `record_tag`'s handler passes null targets as null). `lib/tags/` holds the device queries and local writes (create, link, unlink); a new tag takes the next free counter locally. Seeds get their own file and ids: a few fictional tags on Dev Family's records of each type. A `check-areas.d/tags` rule maps the area to `roundtrip`. No screen yet.

### Acceptance criteria

- [ ] Unit: `tagKey` folds case and spaces; `tagId` and `recordTagId` are stable and differ by group, counter and pair; the counter skips every taken id; `canTagRecord` is right for every role and target, including an Easy helper on own and others' entries and a viewer on a todo.
- [ ] Integration: a writer tags each target type; tagging twice leaves one row; a link with no target or two targets is refused, through the service and through upload.
- [ ] Integration: an Easy helper creates a tag and tags and untags their own entry, whoever added the tag; they're refused on another's entry, a todo, a provider and a medication.
- [ ] Integration: a viewer and Easy viewer are refused every write, a todo included; a non-member reads nothing; a cross-group tag or target is refused.
- [ ] Integration: a replayed create returns the tag; a create whose name is held by another id is `tagService:nameTaken`, and it and its dependent link are recorded as not saved; hard-deleting a target removes its links.
- [ ] Integration (upload): PUT works on both tables and DELETE on `record_tag`; PATCH on `record_tag` is `sync:readOnlyTable`; PATCH and DELETE on `tag` are refused until slice 3.
- [ ] `syncRegistry` and roles tests pass with both tables in the stream and publication.
- [ ] E2E (`roundtrip`): two clients add the same new tag to a record and converge on one tag and one link.

**Blocked by:** none. **Blocks:** 2.

## Slice 2: Tag a timeline entry or event

Stack: no · Reads: docs/domain/timeline.md, docs/domain/appointments.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-548. **User stories:** 1, 4, 6, 7, 15.

### What to build

The picker sheet: the group's tags with a filter box, toggles, and adding a typed new name. A "Tags" item in the entry's ⋯ menu opens it for every kind, for those the rule allows. Chips show on timeline rows and the entry page (two, then "+N"), for every role and in the easy view. Rescheduling copies the tags to the new event in its one local transaction. `EntryFilters` gains its own `tag` field (a `record_tag` subquery, ANDed with `match`), for slices 4 and 6 to use.

### Acceptance criteria

- [ ] Unit or component: an `EntryFilters` tag narrows a window, and with a search both apply.
- [ ] Component: a writer applies, removes and adds a tag on a note, a symptom and a dose entry, and chips update live.
- [ ] Component: an Easy helper gets "Tags" on their own entry only; viewers and Easy viewers see chips and no "Tags" item.
- [ ] Component: rows show two chips, then "+N"; a soft-deleted tagged entry shows nowhere.
- [ ] Component: rescheduling keeps the tags on the new event.
- [ ] Unit: the picker's matching and exact-name reuse.

**Blocked by:** 1. **Blocks:** 3, 4, 5, 6.

## Slice 3: Rename and delete a tag

Stack: no · Reads: docs/domain/data-layer.md, docs/domain/components.md, docs/domain/sync.md, docs/domain/care-groups.md · Tests: unit, integration, component

**Backlog:** B-548. **User stories:** 8, 9.

### What to build

Adds `tagService.rename` and `remove`, `canRenameTag`, and the `tag` name PATCH and DELETE upload (the server derives `name_key`; a refused own-row update reads as `permissions:unauthorized`). In the picker, owners, admins and caretakers rename any tag in place, and Easy helpers only tags they created; a taken name shows an inline error. Owners also get Delete, with a native `<dialog>` naming how many records carry it. The device removes the links and tag in one local transaction, and the records stay.

### Acceptance criteria

- [ ] Component: a caretaker renames any tag and an Easy helper one they created, and every chip updates; an Easy helper gets no rename on another's tag; a taken name is refused inline.
- [ ] Component: only an owner sees Delete; the dialog states the count; after it, the tag is off every record and the records remain.
- [ ] Unit: `canRenameTag` is right for every role, including an Easy helper on own and others' tags.
- [ ] Integration: a replayed create after a rename returns the renamed tag; deleting a tag cascades to its links and leaves the records; a `name_key` sent in a PATCH is ignored.
- [ ] Integration: two people create one tag offline, the second an Easy helper; their rename PATCH is `permissions:unauthorized`, the name is unchanged, and it shows in "Changes not saved".
- [ ] Integration: an Easy helper's rename of a tag someone else created is refused in SQL, including by upload; only owners delete; admins, caretakers and Easy helpers are refused; a rename to a taken name is `tagService:nameTaken`; a later link to a deleted tag is refused and appears in "Changes not saved".

**Blocked by:** 2. **Blocks:** none.

## Slice 4: Todos and the Planner

Stack: no · Reads: docs/domain/todos.md, docs/domain/appointments.md, docs/domain/components.md · Tests: unit, integration, component

**Backlog:** B-548. **User stories:** 2, 7, 11.

### What to build

Writers open the picker from a todo's page; chips show on todo rows and the todo page. The Todos tab's filter and the Planner's filter gain a "Tag" section. On the Planner it narrows events (through the `EntryFilters` tag field) and todos, on Upcoming and on Past (which gains the tag filter as a chip carried from Upcoming). A repeating todo's next occurrence copies the ticked todo's tags: on the server as the system, and in the device's twin with the same link ids.

### Acceptance criteria

- [ ] Integration: a viewer ticks a tagged repeating todo; the next occurrence has the tags, and the device twin's upload is a replay.
- [ ] Component: a writer tags a todo; a viewer who can tick an assigned todo sees chips and no tag control.
- [ ] Component: `?tag=` narrows the Todos tab and the Planner's events and todos, survives a reload, and a deleted tag reads as no filter.
- [ ] Unit: the todo list and Planner filter options with and without a tag.

**Blocked by:** 2. **Blocks:** none.

## Slice 5: Providers and medications

Stack: no · Reads: docs/domain/providers.md, docs/domain/medications.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-548. **User stories:** 3, 7, 12.

### What to build

Writers open the picker from a provider's page and a medication's edit sheet; chips show on their list rows and pages. The Providers filter and the Medications list filter gain a "Tag" section (not the Schedule tab).

### Acceptance criteria

- [ ] Component: a writer tags a provider and a medication; a viewer sees chips and no control.
- [ ] Component: `?tag=` narrows each list, keeps the other filters and the provider search, and a group with no tags shows no Tag section.
- [ ] Unit: the provider and medication filter functions with a tag.

**Blocked by:** 2. **Blocks:** none.

## Slice 6: Filter the timeline and search by tag

Stack: no · Reads: docs/domain/timeline.md, docs/domain/search.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-548. **User stories:** 10, 13, 14.

### What to build

`timelineFilters` gains `tag`, with a section in the filter sheet and a removable chip, applied through the `EntryFilters` tag field to the timeline's history. The Next strip and Latest vitals ignore it. The search page gains a tag filter: it narrows every section, and with no text lists all live records with that tag, conditions left out.

### Acceptance criteria

- [ ] Unit: `timelineFilters` parses, sets and clears `tag`, keeps the other filters, and `clearFilters` clears it.
- [ ] Component: the timeline narrows to a tag, alone and with a kind, an author and a search; it works offline.
- [ ] Component: search with a tag narrows each section; a tag with no text lists each type's tagged records and no conditions; soft-deleted records never appear.

**Blocked by:** 2. **Blocks:** none.
