# Plan: Contract migrations

> Source PRD: [`plans/contract-migrations-prd.md`](contract-migrations-prd.md). User-story numbers (US) refer to it. Backlog items B-455 (step one), B-456, B-625 (step one). B-457 dropped at planning (a427: no data migration for rows that don't exist). Topic `contract-migrations`. Cut at planning: the column drops to the follow-on topics `contract-migrations-2` and `contract-migrations-3` (new items), each held until the step before it is on `origin/staging`.

## Status

**From the user:** a426 (2026-11-28): delete the note series; their notes may go too, whichever makes the simpler migration (the series-only delete, as planned); the user resets staging afterwards. a427 (2026-11-28): no backfill or conversion for rows that don't exist (production has no data; the user resets staging after): plan the schema change alone, keeping data handling to what it needs to apply. B-457 dropped.

| Slice | Wave | State   | Merge into `prd/contract-migrations` (slice commits) |
| ----- | ---- | ------- | ---------------------------------------------------- |
| 1     | 1    | planned |                                                      |
| 2     | 2    | planned |                                                      |
| 3     | 1    | planned |                                                      |
| 4     | 3    | planned |                                                      |
| 5     | 2    | planned |                                                      |

**Backlog:** claim each item when its first slice starts; `risa backlog done` when its last slice merges.

| Item                                | Slices  |
| ----------------------------------- | ------- |
| B-625 `todo.event_id`, step one     | 1, 2, 4 |
| B-456 note kind of series           | 3       |
| B-455 simple-mode columns, step one | 6       |

## Architectural decisions

Durable decisions every slice follows:

- **Expand, then contract, a deploy apart.** Code that is live or rollback-able must work with the schema after each migration. Drizzle selects every column its schema names, so a column leaves the Drizzle schema one deploy before it is dropped. This topic drops no column.
- **Nothing a member sees changes.** No screen, API shape or permission changes but the two retired member fields leaving `PERMISSIONS`. An existing test that fails for another reason means stop and tell the orchestrator.
- **Migrations:** one per migration slice (2, 4, 5), one migration slice per wave. Generate with `pnpm datastore:generate` on the slice's base (`--custom` for hand-written SQL, which keeps the previous snapshot). A column leaves the Drizzle schema through a plain generate whose `DROP COLUMN`s are replaced by a comment: its snapshot drops the column, the database keeps it; hand-written statements go after generated ones; read the SQL order. Say "adds a migration", never a number.
- **`todo.event_id` stays in the Drizzle and device schemas** in this topic; only its writes, upload and stream go.
- **Other topics' hot files stay untouched:** `packages/data/src/domain/todos/todoRules.ts` (`code-health-4`) above all. This topic runs after `data-rights` (its migrations folder, `todoService.ts`, `lib/todos/`).
- **Shared registries** (`sync-config.yaml`, `REPLICATION_WHOLE_TABLES`): edit only the lines named.
- **Comments say what the code does.** No new comment names a slice, a PRD or this plan.
- **Loops don't edit AGENTS.md or existing docs.** The orchestrator folds the docs at landing.

## How to run this plan

- **Waves:** (1, 3) → (2, 5) → (4). 2 follows 1 (the tests 1 moves); 4 follows 2 (both touch `syncEventTodos.int.test.ts`); 5 follows 3 (one migration per wave).
- **Gates:** integration tier; no browser checks (no screen changes); the roles guards cover the stream change.
- **Shared files inside a wave:** none. Wave 1: slice 1 four test files' setups, slice 3 the series schema, service and migration. Wave 2: slice 2 the three todo services and `todo.int.test.ts`; slice 5 the care-group schema, permissions, its migration and the easy-mode tests. Wave 3: slice 4 `syncRegistry.ts`, `sync-config.yaml`, `rolesSql.ts`, `syncEventTodos.int.test.ts`.
- **No data migration for rows that don't exist** (a426, a427): production has no data and the user resets staging after. A migration carries only what its schema change needs to apply.
- **Docs at landing (the orchestrator):** `care-groups.md` and `data-layer.md` (the simple-mode columns: out of the Drizzle schema, dropped by `contract-migrations-2`), `appointments.md` (`kind`: events only, no stored note series), `todos.md` (`todo.event_id`: no service writes it, unsynced, leaves Drizzle in `-2`, dropped in `-3`), `ops/runbook.md` _Migrations_ (a column leaves the Drizzle schema a deploy before its drop, through a generated migration whose drops are replaced by a comment).
- **When it's done:** set `contract-migrations` done. `contract-migrations-2` stays on `hold` until `origin/staging` contains this topic (the user's promotion); its hold reason says so.

---

## Slice 1: Old-client todo tests write the column directly

Stack: no · Reads: docs/domain/todos.md · Tests: integration · Check: packages/data/src/services/entryTodo.int.test.ts

**Backlog:** B-625. **User stories:** 5.

Test setups only, no service change: they pass before and after slice 2. Four test files, one change each.

### What to build

- Where a test stands for an old client by passing `eventId` to `todoService.create` or `update` and then expects `todo.event_id` set, write the column with the todo model as the system instead (`packages/data/src/services/todo.int.test.ts`, `packages/data/src/services/entryTodo.int.test.ts`, `packages/api/src/syncEventTodos.int.test.ts`, `packages/data/src/db/todoRename.int.test.ts`). A case that only proves the mirror makes a link row stays for now (slice 2 replaces it).

### Acceptance criteria

- [ ] The four files pass unchanged in meaning; `entryTodo.int.test.ts` passes.
- [ ] `risa check` green.

**Blocks:** 2.

---

## Slice 2: No service writes `todo.event_id`

Stack: no · Reads: docs/domain/todos.md, docs/domain/data-layer.md · Tests: integration · Check: packages/data/src/services/todo.int.test.ts · Blocked by: 1

**Backlog:** B-625. **User stories:** 4, 5.

### What to build

- `packages/data/src/services/todoService.ts`: remove `mirrorEvent` and its calls in create and update; create and update ignore an `eventId` field (no link row, column untouched); remove `releaseEvent`. Keep `eventId` in the `Links` check only if a caller still passes it as a link (`assistantActionService`'s `addTodo`); otherwise remove it.
- `packages/data/src/services/timelineEntryService.ts` `remove`: drop the `releaseEvent` call and import.
- `packages/data/src/services/entryTodoService.ts` `unlink`: drop the clear of `todo.event_id`; rewrite its header comment.
- `todo.int.test.ts`: replace the mirror cases with the new assertions. The comment naming `releaseEvent` in `apps/web/app/lib/timeline/timeline.sync.ts` (`fixes-bug`'s hot prefix) is left for `contract-migrations-2`.

### Acceptance criteria

- [ ] `todo.int.test.ts`: `create` and `update` with an `eventId` make no link row and leave the column as it was; deleting an event and unlinking leave `event_id` untouched.
- [ ] `git grep -n "releaseEvent\|mirrorEvent" -- packages/data/src/services ':!*.test.ts'` is empty.
- [ ] `risa check` green.

**Blocks:** 4.

---

## Slice 3: No note series

Stack: no · Reads: docs/domain/appointments.md, docs/domain/data-layer.md · Tests: integration · Check: packages/data/src/services/appointmentSeries.int.test.ts

**Backlog:** B-456. **User stories:** 2, 3.

### What to build

- `packages/data/src/db/schema/appointments/appointmentSeries.ts`: `SERIES_KINDS = ["event"]`; the comment says series are events only.
- Adds a migration: hand-written first, `DELETE FROM "appointment_series" WHERE "kind" = 'note';` (soft-deleted ones too; visits keep their rows, `series_id` set null by the FK); then the generated check change (`kind IN ('event')`). If another table referencing a series refuses the delete (`seriesEdit`), delete its rows for those series first, in the same migration.
- `packages/data/src/services/appointmentSeriesService.ts` `topUp`: remove the note skip.
- `appointmentSeries.int.test.ts`: a `kind = 'note'` insert (written as the system, past the Zod schema) is refused by the check.

### Acceptance criteria

- [ ] `appointmentSeries.int.test.ts` passes, with the refused note insert.
- [ ] `risa check` green.

**Blocks:** 5 (one migration per wave).

---

## Slice 4: No upload or stream carries `todo.event_id`

Stack: no · Reads: docs/domain/sync.md, docs/domain/todos.md · Tests: integration · Check: packages/api/src/syncEventTodos.int.test.ts · Blocked by: 2

**Backlog:** B-625. **User stories:** 4, 5.

### What to build

- `packages/api/src/syncRegistry.ts` `TODO_CONTENT`: remove `event_id`. An upload carrying it is still accepted, the field ignored (if the registry refuses unknown columns, accept and drop this one).
- `powersync/sync-config.yaml`: remove `event_id` from the todo stream's column list (that line only).
- `packages/data/src/db/roles/rolesSql.ts` `REPLICATION_WHOLE_TABLES`: add `"todo"` at the end, with a comment bullet: `event_id` is no longer synced and stays until its drop.

### Acceptance criteria

- [ ] `syncEventTodos.int.test.ts`: a todo PUT and a PATCH carrying `event_id` (an old client) are accepted, the column stays as it was, no link row is made.
- [ ] `rolesSql.test.ts` and `roles.int.test.ts` pass.
- [ ] `risa check` green.

**Blocks:** `contract-migrations-2`.

---

## Slice 5: The simple-mode columns leave the Drizzle schema

Stack: no · Reads: docs/domain/care-groups.md, docs/domain/data-layer.md · Tests: integration · Check: packages/data/src/services/easyMode.int.test.ts · Blocked by: 3

**Backlog:** B-455. **User stories:** 1.

### What to build

- `packages/data/src/db/schema/care-groups/careGroupMember.ts`: remove `simpleMode`, `simpleModeLocked`. `packages/data/src/db/schema/care-groups/careGroup.ts`: remove `simpleTiles`.
- `packages/data/src/permissions/care-groups.ts`: remove the two `SYSTEM_ONLY` entries and their comments.
- Adds a migration with a plain `pnpm datastore:generate` (not `--custom`, which keeps the previous snapshot): replace its three `DROP COLUMN`s with a comment (the columns stay in the database until `contract-migrations-2` drops them) and keep its snapshot, which no longer has them, so no later generate emits their drop.
- `packages/data/src/db/roles/rolesSql.ts`: unchanged (the two tables stay whole until the drop); update only the comment bullets' wording if they name the Drizzle schema.
- Delete `packages/data/src/db/easyMigration.int.test.ts` and `packages/data/src/db/easyRolesMigration.int.test.ts`; remove the "retired easy-mode member columns" `describe` in `easyMode.int.test.ts`.

### Acceptance criteria

- [ ] `easyMode.int.test.ts` passes; `pnpm datastore:generate` afterwards finds nothing to generate.
- [ ] `git grep -n -E "simpleModeLocked|simpleTiles|simple_mode|simple_tiles" packages/data/src --  ':!packages/data/src/db/migrations'` finds only `rolesSql.ts`'s comment.
- [ ] `risa check` green.

**Blocks:** `contract-migrations-2`.
