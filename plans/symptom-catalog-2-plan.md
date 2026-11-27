# Plan: Symptom catalog, part 2: archive, the Symptoms page and quick entry's default

> Source PRD: [`plans/symptom-catalog-2-prd.md`](symptom-catalog-2-prd.md). User-story numbers (US) refer to it. Backlog items B-890 (its archive half and the page), B-898. Topic `symptom-catalog-2`, the follow-on of [`symptom-catalog`](symptom-catalog-plan.md). The PRD's delete with a replacement is [`symptom-catalog-3`](symptom-catalog-3-plan.md), cut off so each topic stays about six slices.

## Status

| Slice | Wave | State   | Merge into `prd/symptom-catalog-2` (slice commits) |
| ----- | ---- | ------- | -------------------------------------------------- |
| 1     | 1    | running |                                                    |
| 2     | 1    | merged  | 284076ebd (e5905ecec)                              |
| 3     | 2    | merged  | 2dbdae37a (c97cfb1c9)                              |
| 4     | 3    | planned |                                                    |
| 5     | 3    | planned |                                                    |

**Landing mode:** run everything through (dispatcher start, 2026-11-27): start every ready slice, land each green wave, ask only real questions via `risa ask`. **Amended (ask a333, decided by skeptic s76):** hold landing until every slice is merged; one lean browser suite and one landing at the end (the user can veto under "decided for you").

**Now (2026-11-27):** wave 1 merged (slices 1, 2 on opus), full CI green on 51acfc09 (run 46065323091); `risa sync`: no merge needed. Landing held to the end (a333). Slice 3 merged (opus); wave 3 (slices 4, 5, opus) running in `.loops/symptom-catalog-2-4`, `-5`. Slice 3 added `archived_at`, `replaced_by_id` to the device schema and as serverSet in `syncRegistry.ts`. B-898 done; B-890 spans slices 1, 3-5. Slice worktrees 1-3 kept until landing.

**For later slices:** slice 1 already appended `archived_at, replaced_by_id` to `sync-config.yaml` (rolesSql test needs whole-table streams), so slice 3 adds them only to the device schema (and the roundtrip matrix may need them as server-set). `ensure`/backfill keep an archived row archived. Quick entry no longer uses `SymptomGate` (its `takeFocus={false}` has no caller). At landing: `docs/domain/assistant.md` (symptom cards save the closest name, no wait), timeline.md catalog line.

## Architectural decisions

- **One migration** (slice 1): `symptom_type.archived_at` and `symptom_type.replaced_by_id`, both nullable, with a same-group composite foreign key and no self-reference. `replaced_by_id` is added here so the follow-on needs no migration. It takes the next number when it lands.
- **Three states:** active, archived (`archived_at`), tombstone (`replaced_by_id`, written only by `symptom-catalog-3`). This topic already hides tombstones wherever it lists rows.
- **Server-set and online:** archive and unarchive are oRPC calls under `timeline.symptomTypes`. The two new columns are synced but never uploaded (the `symptom_type` upload stays PUT-only). The service checks the group role (`WRITERS`), writes past the system-only permission map, and records the actor in `updated_by`.
- **The archived rule lives in the pure `symptomCatalog` module** (`similarSymptoms`), shared by the device and the server.
- **Loops don't edit AGENTS.md or `docs/`.** The orchestrator folds the docs at each landing.

## How to run this plan

- **Waves:** 1 (slices 1 and 2 at once) → 2 (slice 3) → 3 (slices 4 and 5 at once).
- **What each slice owns:** 1 the migration and the service's archive; 2 quick entry's cards (B-898); 3 the procedures, sync config and device schema; 4 the device catalog and the sheet's and Easy form's suggestions; 5 the Symptoms settings page.
- **Across PRDs:** slices 2 and 4 touch `routes/app/groups/timeline/` or `components/quick-entry/` (the first is `todo-subtasks-2`'s hot prefix). Slice 3 touches `sync-config.yaml` and `lib/sync/schema.ts` (`tags-2`'s). Slice 5 touches `routes/app/groups/settings/` and `lib/care-groups/urls.ts` (`tags-3`'s, which also adds a subpage). The row runs `after` `tags-3`, and the dispatcher keeps colliding topics apart. If one of them landed since the slice's base, sync `dev` first and add at the end of each shared list (the settings pages, `GROUP_SETTINGS_PAGES`, the routes, the sync query's columns, the device table).
- **Gates:** slices 1 and 3 run the integration tests they add; slices 2, 4 and 5 are screens and pure modules: the quick check.
- **Docs at landing:** [timeline](../docs/domain/timeline.md) every wave (the catalog line: archive, quick entry's default); [care-groups](../docs/domain/care-groups.md) wave 3 (the Symptoms subpage and who manages it).
- **When it's done:** `pnpm prd rm symptom-catalog-2`; `symptom-catalog-3` runs after it.

---

## Slice 1: Archive in the data

Stack: no · Reads: docs/domain/timeline.md, docs/domain/data-layer.md · Tests: integration

**Backlog:** B-890. **User stories:** 2, 3, 8.

**What to build:**

- Add `archivedAt` and `replacedById` to `symptomTypeSchema` (`packages/data/src/db/schema/timeline/symptomType.ts`), with the composite foreign key and the no-self check. This adds a migration.
- In `packages/data/src/services/symptomTypeService.ts`, add `archive(ctx, { groupId, id })` and `unarchive(…)`:
  - The role check uses `isWriterRole` (`packages/data/src/constants/roles.ts`), the way `add` uses `isLoggerRole`.
  - Both are idempotent, and both refuse a tombstone and another group's row.
  - The write sets `updated_by` to the actor.
- Add the new error codes to `packages/data/src/errors/timeline.ts`.
- `packages/data/src/models/symptomType/symptomTypeModel.ts` exposes an update function for the service, and its "never changed" comment goes.

**Acceptance criteria:**

- [ ] Integration (`packages/data/src/services/symptomType.int.test.ts`):
  - A caretaker and an admin archive and unarchive, and `updated_by` names them.
  - An Easy helper and a viewer are refused.
  - A repeat changes nothing.
  - A tombstone (inserted directly) and another group's row are refused.
  - The backfill doesn't add back an archived default.

**Blocked by:** none. **Blocks:** 3.

---

## Slice 2: Quick entry saves the similar symptom by default

Stack: no · Reads: docs/domain/timeline.md, docs/domain/assistant.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-898. **User stories:** 10, 11.

**What to build:**

- Change `withSymptomGates` in `apps/web/app/components/quick-entry/quickEntryCards.ts`:
  - With no answer, a card with similar names applies the first (closest) one to its action and carries a new `symptomDefault: { typed, using, others }` in place of `symptomGate`.
  - An answer is used as today, and "Add new" keeps the typed name.
  - `waits` no longer counts a default, so `canSaveCards` and Enter go ahead.
- Add a new `apps/web/app/components/quick-entry/QuickEntrySymptomDefault.tsx`. It shows "Saves as <name>" with "Use <other>" buttons and "Add “<typed>” as new". `QuickEntryCard.tsx` shows it, wired through `QuickEntryBox.tsx` (`onSymptomChoice`) and `useQuickEntry.ts`'s `chooseSymptom`.
- The timeline's `SymptomGate.tsx` doesn't change.

**Acceptance criteria:**

- [ ] Unit (`quickEntryCards.test.ts`):
  - An unanswered near-match card's action has the closest catalog name.
  - `symptomDefault` lists the typed name and the others, and `canSaveCards` is true.
  - "Add new" restores the typed name.
  - An exact match has no default.
- [ ] Component (`timelineQuickEntry.browser.test.tsx`):
  - Typing a near-match and pressing Enter saves one symptom under the existing name.
  - Tapping "Add … as new" and then Enter saves the typed name and adds it to the catalog.
  - Tapping another similar name uses it.

**Blocked by:** none. **Blocks:** none.

---

## Slice 3: Archive through the API and sync

Stack: no · Reads: docs/domain/timeline.md, docs/domain/sync.md, docs/domain/api.md · Tests: integration

**Backlog:** B-890. **User stories:** 2, 3.

**What to build:**

- Add a new `packages/api/src/timeline/symptomTypes.ts` with `archive` and `unarchive` procedures (`groupId`, `id`). Register them under `timeline.symptomTypes` in `packages/api/src/timeline/timeline.ts`, and add them to `packages/api/src/procedureSweep.int.test.ts`.
- Append `archived_at` and `replaced_by_id` to the `symptom_type` select in `powersync/sync-config.yaml`.
- Append them to `symptomTypes` in `apps/web/app/lib/sync/schema.ts`.
- The `symptom_type` upload (`packages/api/src/syncRegistry.ts`) doesn't change: PUT-only, taking neither column.

**Acceptance criteria:**

- [ ] Integration (`packages/api/src/syncSymptomTypes.int.test.ts`):
  - The new columns reach every role's device.
  - A device PUT with `archived_at` doesn't set it.
  - A PATCH or DELETE of `symptom_type` is refused.
- [ ] Integration: the two procedures pass the procedure sweep, and a caretaker's `archive` call answers the archived row.

**Blocked by:** 1. **Blocks:** 4, 5.

---

## Slice 4: Archived symptoms leave the suggestions

Stack: no · Reads: docs/domain/timeline.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-890. **User stories:** 2, 9.

**What to build:**

- `similarSymptoms` (`packages/data/src/db/schema/timeline/symptomCatalog.ts`) takes rows with an optional `archived`. `exact` still matches them, and `similar` skips them.
- `useSymptomTypes` and `symptomTypesQuery` (`apps/web/app/lib/timeline/symptomTypes.sync.ts`) return active and archived rows, each with `archived`, and no tombstones.
- `SymptomFields.tsx` and `FeelingFields.tsx` (`routes/app/groups/timeline/`) list only active rows in their `datalist`. Quick entry and the sheet's gate (`useSymptomGate.ts`, which calls `similarSymptoms`) keep passing every returned row, so an exact archived name keeps its spelling.

**Acceptance criteria:**

- [ ] Unit (`symptomCatalog.test.ts`): an archived row is an `exact` match, never a `similar` one.
- [ ] Component (`timelineSymptomCatalog.browser.test.tsx`):
  - The sheet's and the Easy form's suggestions leave out an archived symptom and a tombstone.
  - Typing an archived name exactly saves it with no gate, pointing at its row.
  - A name that's only like an archived one asks nothing.

**Blocked by:** 3. **Blocks:** none.

---

## Slice 5: The Symptoms settings page, with archive

Stack: no · Reads: docs/domain/care-groups.md, docs/domain/app-shell.md, docs/domain/components.md, docs/domain/timeline.md · Tests: unit, component

**Backlog:** B-890. **User stories:** 1, 2, 3, 8.

**What to build:**

- Append a `"symptoms"` page to `GROUP_SETTINGS_PAGES` (`apps/web/app/lib/care-groups/urls.ts`), to `groupSettingsPages` (`routes/app/groups/settings/layout/settingsPages.ts`) and to `routes/app/groups/settings/routes.ts`.
- Add a new `apps/web/app/lib/timeline/symptomCatalogPage.sync.ts`: the group's active and archived rows, A to Z, each with its live-entry count, as a live query. No tombstones.
- Add a new `symptomCatalogAccess(groupId, role)` to `routes/app/groups/settings/groupSettings.ts`: archive for writers, and replace for owners (which the follow-on uses).
- Add a new `routes/app/groups/settings/symptoms/route.tsx`:
  - The active list with counts, then an "Archived" section.
  - Archive and Unarchive (writers) call slice 3's procedures, and say `NEEDS_CONNECTION` when offline, through the existing `failedSave` in `routes/app/groups/settings/api.ts` (imported, not changed).

**Acceptance criteria:**

- [ ] Unit (`groupSettings.test.ts`): `symptomCatalogAccess` for every role.
- [ ] Component (new `routes/app/groups/settings/symptomCatalog.browser.test.tsx`):
  - The list shows counts and the archived section.
  - A caretaker archives a symptom, and it moves to Archived after sync. Unarchive moves it back.
  - A viewer sees no controls.
  - Offline, a tap says it needs a connection.

**Blocked by:** 3. **Blocks:** none.
