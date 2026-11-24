# Plan: Symptom catalog

> Source PRD: [`plans/symptom-catalog-prd.md`](symptom-catalog-prd.md). User-story numbers (US) refer to it. Backlog item B-549. Topic `symptom-catalog`.

## Status

**Where it stands (hand-over, 2026-11-24):** **wave 1 landed** in dev as ca4dbb54 (PR #149, tier full, `--no-review`: Codex out of credits). Gate run 45402448788 was a flake in `calendarCron.int.test.ts` (not ours, filed B-743). Report filed as ask a181; to-test file `to-test/2026-11-24-0831-symptom-catalog.md`. Docs folded into timeline.md. No slice in flight; slice 1's worktree removed. B-549 stays claimed (done when the last slice merges).

**Wave 2 (2026-11-24):** boundary done (ingest: nothing new; nothing to propose), sync: already up to date with dev. Slice 2 handed off (e4e6310b, migration 0044_symptom_entry_type, must stay last: regenerate if dev brings a 0044) and merged as b7b7a990. Wave gate: full run 45407562750 was cancelled (components-2 hung after its last passing file, 13:58 → job timeout 14:10; blame: unknown, no failure); re-requested once: green, run 45411480362 on cbb5b074. Slice 2 worktree removed. Dev sync merged (tooling, CI, browser checks; no migration or seed). Next: full run on the synced tip, browser checks, PR, Codex review, land. Next: green → `pnpm prd rm symptom-catalog-2`, sync, PR, review, land.

**Slice 1 hand-off notes, for slice 2:** `symptomTypeService.ensure(ctx, groupId, name)` is ready for the write path (advisory lock on the derived id); extend `symptomTypeService.backfill` with the pointer step; `SYMPTOM_NAME_MAX` is separate from `timelineEntry.ts` so the composite FK has no import cycle; the backfill runs from `scripts/migrate.ts` (not test setup), so integration tests call it directly; migration `0043_symptom_catalog.sql` has a redundant `symptom_type_group_idx` to drop when slice 2 regenerates it (one pending migration for the topic: since 0043 landed, slice 2 adds the next number).

**For slice 3:** dev's new `sync-writers` test (`scripts/browser-checks/sync-writers.mjs`) needs an app writer for every uploadable table: add one for `symptom_type` with its upload entry. Also add `symptom_type` to `FIXTURE_SCHEMAS` in `apps/web/test/fixtureShape.ts` (drop its `NO_FIXTURE_SCHEMA` reason) and a case in `packages/api/src/accessSweep.int.test.ts` when it adds the upload entry.

**Lessons from wave 1:** an `<input list>` is a `combobox`, not a `textbox`, in tests. `--force --by-user` resting only on a memory is classifier-blocked; land through the gate instead. A dev sync can bring registry-style tests that need a new table registered: check new `*Sweep`/`fixtureShape`-style tests after each sync.

**Landing mode:** run everything through (start every ready slice, land each green wave, clean up; questions and reports go through `pnpm prd ask`).

**Models:** every slice on opus (each has real logic: a table, the write path, a gate, a filter, groupings).

| Slice | Wave | State       | Merge into `prd/symptom-catalog` (slice commits) |
| ----- | ---- | ----------- | ------------------------------------------------ |
| 1     | 1    | landed      | cebc11e8 (9e8dc3d9, 02e638f2)                    |
| 2     | 2    | merged      | b7b7a990 (e4e6310b)                              |
| 3     | 3    | not started |                                                  |
| 4     | 4    | not started |                                                  |
| 5     | 3    | not started |                                                  |
| 6     | 3    | not started |                                                  |

**Backlog:** claim B-549 when slice 1 starts; run `pnpm backlog done B-549` when the last slice merges.

## Architectural decisions

Durable decisions every slice follows:

- **One pure catalog module** owns the key, the id, the default set and the similar-name rule. Nothing else folds a symptom name.
- **A type's id is derived** from the group and the key, on device, server and backfill alike. Never `randomUUID` for a catalog row.
- **`details.name` stays as written.** No slice rewrites an existing entry's wording.
- **The server derives `symptom_type_id`** from the name on every symptom write; a device's value is only its local copy.
- **Additive only:** one pending migration for the topic, regenerated on sync. Say "adds a migration"; take the next number when it lands.
- **Offline first:** the picker, gate, filter and groupings read the local database.
- **No new dependency or Postgres extension.**
- **Loops don't edit docs.** The orchestrator folds decisions into [timeline](../docs/domain/timeline.md), [sync](../docs/domain/sync.md) and [assistant](../docs/domain/assistant.md) at landing.

## How to run this plan

- **Waves:** 1 → 2 → (3, 5, 6) → 4.
- **Gates:** each slice hands off on `pnpm prd check --quick "slice hand-off"`; wave gates are quick checks. Slice 1 appends a server-written `symptom_type` row to the sync matrix (a tooling test requires one for every device table); slice 3 adds the two-client step to `roundtrip`.
- **Ownership:** slice 1 the table, catalog module, group creation and the backfill step; slice 2 the entry column and write path; slice 3 the symptom sheet and the Easy feelings form; slice 4 quick entry and connectors; slice 5 the timeline filters; slice 6 day summaries, visit prep and quick-entry predictions.
- **Beside other topics:** append to the shared registries (`sync-config.yaml`, device schema, upload registry, `services/` and `models/` indexes, `sync-matrix.mjs`). `quick-entry-2` and `dose-accuracy` land first (the parser; the entry service, assistant runner and visit prep). `ui-kit-3` holds `QuickEntryCard`: slice 4 syncs first and keeps its card change small. `code-health` may move parser files: if so, `pnpm prd sync` and carry on in the new place.

---

## Slice 1: Every group has a symptom catalog

Stack: yes · Reads: docs/domain/timeline.md, docs/domain/sync.md, docs/domain/data-layer.md, docs/domain/care-groups.md · Tests: unit, integration, component, e2e:roundtrip

**User stories:** 1, 2, 3.

### What to build

Adds a migration for `symptom_type`, its model and service, and the pure catalog module. Permissions: read and list for any group role, create for `LOGGERS`, no update or delete. All three group-creation paths add the defaults. One exported backfill function, run by the migrate command and as seeding's last step, adds defaults and live history names to existing groups. The table syncs to every member, with a server-written row in the sync matrix, and the symptom sheet's name field suggests catalog names through a `datalist`; the field still accepts any text.

### Acceptance criteria

- [ ] Integration: after seeding, a seeded group has the defaults and its history names.
- [ ] Integration: a name found only on a soft-deleted entry adds no type.

- [ ] Unit: `symptomKey` folds case and spaces; `symptomTypeId` is stable across case and spacing and differs by group.
- [ ] Integration: a group made by a member, an access code and staff each has all 23 defaults.
- [ ] Integration: the backfill gives an existing group the defaults and one type per distinct key; a second run changes nothing.
- [ ] Integration: every group role reads the catalog; a non-member reads nothing.
- [ ] `syncRegistry` and roles tests pass with the new table in the stream and publication.
- [ ] Component: the symptom sheet suggests catalog names from the local database.

**Blocked by:** none. **Blocks:** 2.

## Slice 2: Every symptom entry points at its type

Stack: yes · Reads: docs/domain/timeline.md, docs/domain/sync.md, docs/domain/data-layer.md · Tests: unit, integration

**User stories:** 7, 9, 12.

### What to build

Adds `symptom_type_id` to the same pending migration, with its composite foreign key and index. `timelineEntryService` resolves the type on create and on any update that changes the name, creating it when needed. The column syncs down; devices write the derived id locally. The backfill step fills live entries' null pointers without touching wording, `updated_at` or `updated_by` (raw SQL, or `updated_at` set to itself: Drizzle's `$onUpdate` bumps it otherwise). `symptom_type_id` is in the entry's `serverSet`.

### Acceptance criteria

- [ ] Integration: an Easy helper logging an unknown name succeeds and adds the type; renaming their own entry does too.
- [ ] Integration: after seeding, seeded symptom entries have pointers.

- [ ] Integration: creating a symptom sets the pointer and adds an unknown name to the catalog.
- [ ] Integration: renaming an entry moves its pointer; an upload with a missing, stale or other-group id still stores the derived one.
- [ ] Integration: an upload from an older device (no pointer) gets one.
- [ ] Integration: the backfill fills pointers, joins "knee pain" and "Knee Pain", and leaves each `details.name` and `updated_at` unchanged.
- [ ] Integration: non-symptom kinds never carry a pointer.
- [ ] Unit: the device's local write stores the same id the server derives.

**Blocked by:** 1. **Blocks:** 3, 5, 6.

## Slice 3: Add a symptom quickly, with a similar-name check

Stack: yes · Reads: docs/domain/timeline.md, docs/domain/components.md, docs/domain/sync.md, docs/domain/care-groups.md · Tests: unit, integration, component, e2e:roundtrip

**User stories:** 3, 4, 5, 6, 7.

### What to build

Saving the symptom sheet with a new name runs `similarSymptoms` on the local catalog. An exact match reuses that type. A similar match shows the inline choice, "Use <name>" or "Add new", before saving. A new name adds the catalog row and the entry in one local write. The Easy feelings form's optional field gets the same suggestions, reuse and gate; left empty it saves "Feeling" as today, with no gate. Upload of `symptom_type` is an idempotent PUT, open to every logger role (`LOGGERS`, Easy helpers included) and refused for viewers.

### Acceptance criteria

- [ ] Unit: `similarSymptoms` covers exact, reordered words, contained words, a typo, unrelated names and the cap of three.
- [ ] Component: an exact match saves with no prompt; a similar name prompts; both choices save the right type; the sheet works offline.
- [ ] Component: the Easy form reuses an exact match, gates a similar name, and saves "Feeling" with no prompt when empty.
- [ ] Integration: two uploads of the same new name leave one row; owners, admins, caretakers and Easy helpers may add, viewers and Easy viewers may not.
- [ ] E2E (`roundtrip`): two clients add the same new symptom and converge on one catalog row.

**Blocked by:** 2. **Blocks:** 4.

## Slice 4: Quick entry and connectors use the catalog

Stack: no · Reads: docs/domain/assistant.md, docs/domain/connectors.md, docs/domain/timeline.md · Tests: unit, integration, component

**User stories:** 8, 9.

### What to build

Quick entry takes the catalog as context: a symptom reading that exactly matches uses the catalog's name; a similar one shows the same "Use <name>" or "Add new" choice on its card before saving. `log_symptom` reuses an exact match and otherwise adds the name, ungated.

### Acceptance criteria

- [ ] Unit: "nausea 3" reads as the catalog's "Nausea"; existing parser rows are unchanged.
- [ ] Component: a card with a similar name offers both choices and saves the chosen type.
- [ ] Integration: `log_symptom` with an existing name in a different case reuses its type; a new name adds one.

**Blocked by:** 3. **Blocks:** none.

## Slice 5: Filter the timeline by several symptoms

Stack: no · Reads: docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**User stories:** 10.

### What to build

`timelineFilters` gains the repeated `?symptom=<id>` filter under `kind=symptom`. The filter sheet lists the group's types with live entries as a multi-select; each selection is a removable chip; the badge counts them. The device query is `symptom_type_id IN (…)` on the stored pointer only, since SQLite can't derive the key or id and a JavaScript filter would break paging. Day summaries stay off under this filter, like other filters.

### Acceptance criteria

- [ ] Unit: parse, add, remove and clear; unknown ids dropped; changing the kind clears symptoms; other params kept.
- [ ] Component: selecting two symptoms lists entries of either; removing a chip widens the list; paging still fills a window under the filter.

**Blocked by:** 2. **Blocks:** none.

## Slice 6: Summaries and visit prep group by type

Stack: no · Reads: docs/domain/timeline.md, docs/domain/appointments.md · Tests: unit

**User stories:** 11.

### What to build

Day summaries, visit prep and quick-entry predictions drop their own folds and group through the catalog module. Each keeps showing the name as written.

### Acceptance criteria

- [ ] Unit: day summaries treat "Knee pain" and "knee pain" as one symptom, for both highest severity and "(new)".
- [ ] Unit: visit prep does the same, including names differing only by inner spaces.
- [ ] Unit: predictions count both spellings as one.

**Blocked by:** 2. **Blocks:** none.
