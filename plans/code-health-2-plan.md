# Plan: Code health 2

> Source PRD: [`plans/code-health-2-prd.md`](code-health-2-prd.md). User-story numbers (US) refer to it. Backlog item B-362. Topic `code-health-2`. Cut at planning: B-363 (the role table) to the new topic `code-health-4`; B-362's device half, the server's one `invalid` and `todoService`'s upsert to `code-health-3`, as a new item (it touches `data-rights`' hot files, so `code-health-3`'s row gains `data-rights` in its After). `code-health-4`'s row notes that its call-site sweep waits for `data-rights` and `account-security-2`.

## Status

**From the user:** none yet.

**Landing mode:** run everything through (started run-through by the dispatcher): start every ready slice, land each green wave, ask only real questions via `risa ask`.

**Where it stands (2026-11-28):** wave 1 merged (slices 1, 4); its CI run (`integration`, the tier `risa tier` proposed) requested. Slices 2 and 5 start now on the merged tip; they merge only after wave 1 lands. B-362 claimed (done when 3 and 6 merge).

| Slice | Wave | State   | Merge into `prd/code-health-2` (slice commits) |
| ----- | ---- | ------- | ---------------------------------------------- |
| 1     | 1    | merged  | 1db82d0fd (14daac802, 1b8bc1242)               |
| 2     | 2    | planned |                                                |
| 3     | 3    | planned |                                                |
| 4     | 1    | merged  | 854cbfb0a (7bdbfcd3a)                          |
| 5     | 2    | planned |                                                |
| 6     | 3    | planned |                                                |

**Backlog:** claim B-362 when slice 1 or 4 starts; run `risa backlog done B-362` when slices 3 and 6 have both merged.

| Item                                 | Slices           |
| ------------------------------------ | ---------------- |
| B-362 soft-delete models, one upsert | 1, 2, 3, 4, 5, 6 |

## Architectural decisions

Durable decisions every slice follows:

- **No behaviour change, no migration, no new dependency.** Every existing test passes unchanged; an error code, a refusal, an order or a result that would differ means stop and tell the orchestrator.
- **No caller changes.** A model or service keeps every name it exports today; a refactor that needs a caller edited outside the slice's files is reported, not done.
- **Counts are re-derived.** The PRD's _Notes_ has the planner's lists; each slice checks its own files on its own base. A file whose block differs from the shared shape in anything but names keeps that function, and the hand-off says why.
- **Other topics' hot files stay untouched:** `todoService.ts` (`data-rights`) above all. No slice here edits a file another topic has hot.
- **Comments say what the code does.** No new comment names a slice, a PRD or this plan.
- **Loops don't edit AGENTS.md or existing docs.** The orchestrator folds the docs at landing (below).

## How to run this plan

- **Waves:** (1, 4) → (2, 5) → (3, 6). The model track (1 → 2 → 3) and the service track (4 → 5 → 6) are independent: the services read models only through `getById`, whose signature doesn't change.
- **Gates:** the tier the check plan proposes for each wave; no browser checks unless the check plan asks (nothing a screen does changes).
- **Shared files inside a wave:** none. The model slices own files under `packages/data/src/models/`, the service slices files under `packages/data/src/services/`; each slice's list is in its _What to build_.
- **Files other topics have hot:** none of this plan's. `code-health-3` (after this topic) has `packages/data/src/models/base/`; this topic lands first. `data-rights` has `todoService.ts`; slice 6's guard lists it, with `timelineEntryService.ts` (its dose upsert doesn't fit the helper).
- **Docs at landing (the orchestrator):** `docs/domain/data-layer.md`: the soft-delete factory as the way to write a soft-delete model, the create-if-absent helper as the way to write a device-uploadable service's `upsert`, and the two guards.
- **When it's done:** set `code-health-2` done; check that the new `code-health-3` item still names `todoService`'s upsert and the guard's exception.

---

## Slice 1: The soft-delete model factory

Stack: no · Reads: docs/domain/data-layer.md · Tests: integration · Check: packages/data/src/models/base/softDeleteModel.int.test.ts

**Backlog:** B-362. **User stories:** 1, 2.

**What to build**

- New `packages/data/src/models/base/softDeleteModel.ts` `softDeleteFunctions({ schemaName, dbToModel, defaultOrder? })` and the `IncludeDeleted` type, as the PRD's _Soft-delete model factory_ says, built on `getFunctions`. `remove`'s database error code is derived from the schema name (`recipientAllergySchema` → `recipientAllergyModel:remove`). Models import it from its file (the base index stays as it is).
- Convert `packages/data/src/models/recipientAllergy/recipientAllergyModel.ts` and `packages/data/src/models/recipientCondition/recipientConditionModel.ts`: each keeps `schemaName`, `dbToModel`, its order constant and its `IncludeDeleted` export, and takes the rest from the factory.

**Acceptance criteria**

- [ ] New `softDeleteModel.int.test.ts` (on the recipient allergy table, fictional data): a live read hides a deleted row; `includeDeleted` shows it; `update` leaves a deleted row alone; `remove` sets `deletedAt` and `updatedBy`, refuses an empty filter (`baseModel:noFilter`), and returns `baseModel:remove:nothingRemoved` for a role without the delete permission; `list` uses the default order when none is given.
- [ ] The integration tests that use allergies and conditions (`upsertReplay`, `recipientCondition`, `easyRoles`, `medicationPass`) pass unchanged.
- [ ] `risa check` passes.

**Blocked by:** nothing. **Blocks:** 2.

## Slice 2: Four more models on the factory

Stack: no · Reads: docs/domain/data-layer.md · Tests: integration · Blocked by: 1 · Check: packages/data/src/services/provider.int.test.ts

**Backlog:** B-362. **User stories:** 1, 2.

**What to build**

- Convert `carePeriodModel.ts`, `medicationModel.ts`, `providerModel.ts` and `medicationPassModel.ts` (each in its folder under `packages/data/src/models/`): delete the local `IncludeDeleted`, `live`, `get`, `getById`, `list`, `update` and `remove` and take them from `softDeleteFunctions` with the model's order constant. `lockLive` (provider, pass) stays, using the factory's `live` where it filters.

**Acceptance criteria**

- [ ] The care period, medication, provider and medication pass integration tests pass unchanged (the provider's is the narrow check).
- [ ] `git diff --stat` shows each model file shrinking, none growing; `risa check` passes.

**Blocked by:** 1. **Blocks:** 3.

## Slice 3: The last models, and the guard

Stack: no · Reads: docs/domain/data-layer.md · Tests: unit · Blocked by: 2 · Check: packages/data/src/models/modelLayout.test.ts

**Backlog:** B-362. **User stories:** 1, 2, 3.

**What to build**

- Convert `appointmentSeriesModel.ts`, `todoModel.ts` and `timelineEntryModel.ts` the same way. Every function beyond the factory's (the series' top-up queries, the todo's `lockById`, `transactionNow` and `restore`, the timeline entry's `listPage`, `latestReadings`, `mayChange`, cursor helpers and its dose-restore write, which clears `deletedAt`) stays, using the factory's `live`. The timeline entry passes no default order (its `list` has none today); its `update` and `remove` are the shared shape and come from the factory (`timelineEntryModel:remove`), and `createMany` stays.
- New `packages/data/src/models/modelLayout.test.ts`: reads every non-test file under `packages/data/src/models/` outside `base/` and fails, naming the file, on one that sets `deletedAt` to the current time or defines its own `live` filter. The todo's `restore` (which clears `deletedAt`) isn't a soft delete and passes.

**Acceptance criteria**

- [ ] `modelLayout.test.ts` passes on the repository, and its own case shows it fails on a fixture source with a hand-written soft delete.
- [ ] The series, todo and timeline entry integration tests pass unchanged.
- [ ] `risa check` passes.

**Blocked by:** 2. **Blocks:** nothing.

## Slice 4: The create-if-absent upsert helper

Stack: no · Reads: docs/domain/data-layer.md, docs/domain/sync.md · Tests: integration · Check: packages/data/src/services/upserted.int.test.ts

**Backlog:** B-362. **User stories:** 4, 5.

**What to build**

- In `packages/data/src/services/upserted.ts` add `createIfAbsent`, as the PRD's _Create-if-absent upsert_ says: it takes the context, the transaction, a read by id (deleted rows included, for a given actor), the id, a `create` thunk and an `immutable(visible)` check returning the error or nothing; it returns `Upserted<T> | AppError` with the fixed order inside it.
- Move `upsert` in `packages/data/src/services/providerService.ts` and `packages/data/src/services/recipientAllergyService.ts` onto it: each keeps its parse, its identity check and its error code; the lookups, the refusal and the result building go.

**Acceptance criteria**

- [ ] New `upserted.int.test.ts` (through the provider model, fictional data): absent → `created: true` with the row; the same PUT again with other field values → `created: false`, the row not edited; an id in a group the actor isn't in → the same refusal as an id that doesn't exist; a changed group → the immutable error.
- [ ] `upsertReplay.int.test.ts` and the provider integration tests pass unchanged.
- [ ] `risa check` passes.

**Blocked by:** nothing. **Blocks:** 5.

## Slice 5: Four more upserts on the helper

Stack: no · Reads: docs/domain/data-layer.md, docs/domain/sync.md · Tests: integration · Blocked by: 4 · Check: packages/data/src/services/upsertReplay.int.test.ts

**Backlog:** B-362. **User stories:** 4, 5.

**What to build**

- Move `upsert` in `recipientConditionService.ts`, `carePeriodService.ts`, `medicationService.ts` and `medicationPassService.ts` (under `packages/data/src/services/`) onto `createIfAbsent`, the same way as slice 4. The medication's create keeps its `changedAt` option; the pass's keeps its system read helper where it reads as the system.

**Acceptance criteria**

- [ ] `upsertReplay.int.test.ts` (one case per service: a replay changes nothing, another member's later edit stays, a changed group is refused) passes unchanged, as do the condition, care period, medication and medication pass integration tests.
- [ ] `risa check` passes.

**Blocked by:** 4. **Blocks:** 6.

## Slice 6: The last upserts, and the guard

Stack: no · Reads: docs/domain/data-layer.md, docs/domain/sync.md · Tests: unit · Blocked by: 5 · Check: packages/data/src/services/serviceLayout.test.ts

**Backlog:** B-362. **User stories:** 4, 5, 6.

**What to build**

- Move `upsert` in `appointmentSeriesService.ts` onto `createIfAbsent`; the series' kind joins its identity check.
- `timelineEntryService.ts`'s `upsert` stays as it is: after the identity check a dose records its upload, may restore a deleted dose as `created`, and checks the future and the medication, steps the helper doesn't model. The guard lists it as an exception with that reason.
- New `packages/data/src/services/serviceLayout.test.ts`: reads every non-test file in `packages/data/src/services/` and fails, naming the file, on one other than `upserted.ts` that imports `asCreated` or `unchanged`. Its two exceptions are listed with their reasons: `todoService.ts` (`data-rights` has it hot) and `timelineEntryService.ts` (the dose steps after the identity check), and the test fails when a listed exception no longer imports them, so the list only shrinks.

**Acceptance criteria**

- [ ] `serviceLayout.test.ts` passes on the repository; its own cases show it fails on a fixture service importing `asCreated`, and on an exception that no longer needs listing.
- [ ] `upsertReplay.int.test.ts` and the series integration tests pass unchanged (replays, refusals, immutable fields).
- [ ] `risa check` passes.

**Blocked by:** 5. **Blocks:** nothing.
