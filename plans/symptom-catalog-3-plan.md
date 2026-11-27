# Plan: Symptom catalog, part 3: delete with a replacement

> Source PRD: [`plans/symptom-catalog-2-prd.md`](symptom-catalog-2-prd.md) (shared with `symptom-catalog-2`). User-story numbers (US) refer to it. Backlog: B-920 (B-890's delete half, split off at planning). Topic `symptom-catalog-3`, run after [`symptom-catalog-2`](symptom-catalog-2-plan.md), which adds the columns, the procedures file and the Symptoms page this builds on.

## Status

| Slice | Wave | State  | Merge into `prd/symptom-catalog-3` (slice commits)  |
| ----- | ---- | ------ | --------------------------------------------------- |
| 1     | 1    | landed | a84e4d658 (b74850034); wave 1 landed via PR #287    |
| 2     | 2    | landed | 3ca82c624 (7a584c4cd, aa5ef7fcc); slice check green |
| 3     | 2    | landed | 82766a2a1 (075716d6c); slice check green            |
| 4     | 3    | merged | 692385602 (75e0681fa); slice check green            |

- **Landing mode: run everything through** (started run-through; land each green wave, ask only real questions via `risa ask`).
- **Wave 3 running** (session 3): slice 4 (the delete dialog, opus) merged as 692385602, B-920 ready; CI components gate requested; dev sync not needed (no shared files). B-920 claimed. Slice 2's API for it: `timeline.symptomTypes.replace({ groupId, id, replacementId })` answers `{ moved }`; 403 non-owner, 400 same id, 404 missing row or replacement, 409 a tombstone as either. Slice 3's note: before saving, the sheet and quick entry still show a deleted name as typed (suggestions leave tombstones out); only the stored entry changes. Mark B-920 done at wave 3.
- **B-992** (triaged under this topic, for the user's review): Codex's two P2 races on PR #289, a server entry edit or an alias create concurrent with `replace` can leave an entry on a tombstone. Proposed fix: one per-group lock taken by `replace` and every symptom entry write. Not started (build only what's asked).
- 2026-11-27, session 2: wave 2 slices 2 and 3 (both opus) merged as 3ca82c624 and 82766a2a1; CI green at components (run 46082505274); no dev sync needed; timeline doc folded; Codex: 2 findings, both tracked as B-992, then clean. **Wave 2 landed** through PR #289 (dev pushed to 6dbbbd9); to-test/2026-11-27-1842-symptom-catalog-3.md. Slice worktrees removed.

## Architectural decisions

- **No migration:** `replaced_by_id` already exists (`symptom-catalog-2` slice 1).
- **A catalog row is never removed.** A delete turns it into a tombstone, because its derived id would otherwise come back.
- **`resolveSymptom` is the one rule** for following a tombstone (pure, in `symptomCatalog`). The server and the device both call it, and nothing follows `replaced_by_id` by hand.
- **The entry write path resolves the name:** on every symptom write the server stores the resolved row's id and name, and a device does the same with its synced copy.
- **`replace` is online and atomic:** one oRPC call, one transaction, for owners only, with the actor in `updated_by` on the row and on every moved entry.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** 1 (slice 1) → 2 (slices 2 and 3 at once) → 3 (slice 4).
- **What each slice owns:** 1 tombstone resolution on the server; 2 `replace` and its procedure; 3 tombstone resolution on the device; 4 the delete dialog on the Symptoms page.
- **Across PRDs:** slice 3 touches `apps/web/app/lib/timeline/` and `lib/assistant/quickEntry.sync.ts`; slice 4 touches `routes/app/groups/settings/symptoms/` (this PRD's own page). Slice 3's component test sits under `routes/app/groups/timeline/` (`todo-subtasks-2`'s hot prefix), and slice 1 edits `packages/data/src/services/timelineEntryService.ts` (a hot file of the held `sync-safety-2`). The row lists both, so the dispatcher keeps the topics apart; sync `dev` first if either landed since the slice's base.
- **Gates:** slices 1 and 2 run the integration tests they add; slices 3 and 4 the quick check.
- **Docs at landing:** [timeline](../docs/domain/timeline.md) every wave (delete, tombstones, the resolved name); [care-groups](../docs/domain/care-groups.md) wave 3 (owners delete).
- **When it's done:** `pnpm prd rm symptom-catalog-3`.

---

## Slice 1: The server follows a deleted name

Stack: no · Reads: docs/domain/timeline.md, docs/domain/data-layer.md, docs/domain/sync.md · Tests: unit, integration

**Backlog:** B-920. **User stories:** 6, 7.

**What to build:**

- Add a new `resolveSymptom(name, catalog)` to `packages/data/src/db/schema/timeline/symptomCatalog.ts`. It finds the row for the name's key and follows one `replacedById` step.
- In `symptomTypeService.ts`, `ensure` returns the resolved row for a tombstone's name, and the backfill's `fillPointers` points at the resolved id.
- `symptomTypeFor` in `packages/data/src/services/timelineEntryService.ts` returns the resolved id and name, and the create and update writes store that name in `details.name`.
- `assistantActionService`'s spelling lookup uses the resolved row.

**Acceptance criteria:**

- [ ] Unit (`symptomCatalog.test.ts`): `resolveSymptom` finds a row by key in any case, follows a tombstone one step, and returns null for an unknown name.
- [ ] Integration (`symptomEntryType.int.test.ts`), with a tombstone inserted directly:
  - Creating or updating an entry with the deleted name, in any case, stores the replacement's id and name.
  - A connector log does the same.
- [ ] Integration (`syncSymptomTypes.int.test.ts`):
  - An offline device's upload naming the deleted symptom lands on the replacement.
  - Its PUT of the old name's catalog row adds nothing.

**Blocked by:** none. **Blocks:** 2, 3.

---

## Slice 2: Replace on the server

Stack: no · Reads: docs/domain/timeline.md, docs/domain/data-layer.md, docs/domain/api.md · Tests: integration

**Backlog:** B-920. **User stories:** 4, 6.

**What to build:**

- Add `replace(ctx, { groupId, id, replacementId })` to `symptomTypeService.ts`, for owners only:
  - It locks both ids, and refuses the same id, another group's replacement and a tombstone replacement.
  - One raw `UPDATE` moves every entry pointing at `id`, soft-deleted ones too, setting `symptom_type_id`, `details.name`, `updated_at` and `updated_by`.
  - It repoints tombstones that pointed at `id`.
  - It marks `id` as a tombstone, setting `archived_at` when it's empty and `updated_by` to the actor.
  - It returns `{ moved }`.
- Add the new error codes to `packages/data/src/errors/timeline.ts`.
- Add a `replace` procedure to `packages/api/src/timeline/symptomTypes.ts`, and add it to the procedure sweep.

**Acceptance criteria:**

- [ ] Integration (`symptomType.int.test.ts`):
  - An owner's `replace` moves live and soft-deleted entries (pointer and name, with `updated_by` the owner), repoints an older tombstone, and returns the count.
  - An admin and a caretaker are refused.
  - The same id, another group's replacement and a tombstone replacement are refused.
  - A rerun on a tombstone is refused and changes nothing.
- [ ] Integration: `replace` passes the procedure sweep.

**Blocked by:** 1. **Blocks:** 4.

---

## Slice 3: Devices follow a deleted name

Stack: no · Reads: docs/domain/timeline.md, docs/domain/sync.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-920. **User stories:** 7.

**What to build:**

- `addSymptomTypeIn` (`apps/web/app/lib/timeline/symptomTypes.sync.ts`) resolves with `resolveSymptom` over the local copy and returns `{ id, name }`.
- `createEntry` and `updateEntry` (`apps/web/app/lib/timeline/timeline.sync.ts`, with `symptomTypeColumn`) store that name and id, and so does quick entry's batch (`apps/web/app/lib/assistant/quickEntry.sync.ts`).

**Acceptance criteria:**

- [ ] Unit (`timeline.sync.test.ts`): with a tombstone in the local copy, a created or renamed symptom stores the replacement's name and id.
- [ ] Component (`timelineSymptomCatalog.browser.test.tsx`): with a synced tombstone, logging the deleted name in the sheet and in quick entry saves the replacement's name, and the timeline row shows it at once.

**Blocked by:** 1. **Blocks:** 4.

---

## Slice 4: Delete on the Symptoms page

Stack: no · Reads: docs/domain/care-groups.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component

**Backlog:** B-920. **User stories:** 4, 5.

**What to build:**

- Add a new `routes/app/groups/settings/symptoms/DeleteSymptomDialog.tsx`: a native `<dialog>` with a select of the other active symptoms, how many entries will move, and a Delete button that calls `replace`.
- `routes/app/groups/settings/symptoms/route.tsx` shows Delete for owners (`symptomCatalogAccess(...).replace`). A deleted symptom leaves the list after sync.

**Acceptance criteria:**

- [ ] Component (`symptomCatalog.browser.test.tsx`):
  - An owner deletes "Nauseous" into "Nausea". The dialog shows the count, and after sync the page lists only "Nausea", with the summed count.
  - A caretaker sees no Delete.
  - Offline, the dialog says it needs a connection.

**Blocked by:** 2, 3. **Blocks:** none.
