# Plan: Conditions

> Source PRD: [`plans/conditions-prd.md`](conditions-prd.md). User-story numbers (US) refer to it. Backlog item B-181 (a conditions list on the care recipient's profile). Topic `conditions`.

## Status

| Slice | Wave | State           | Merge into `prd/conditions` (slice commits) |
| ----- | ---- | --------------- | ------------------------------------------- |
| 1     | 1    | not started     |                                             |
| 2     | 2    | blocked by 1    |                                             |
| 4     | 2    | blocked by 1    |                                             |
| 5     | 2    | blocked by 1    |                                             |
| 3     | 3    | blocked by 2    |                                             |
| 6     | 4    | blocked by 2, 3 |                                             |

**Start conditions:** none for slice 1. Slice 2 waits for quick-fixes slice 51 (the timeline's Filter sheet, B-187) to be in `dev`, and slice 6 for quick-fixes slice 48 (the connector's timeline text, B-189 and B-190). Check with `pnpm backlog show B-187` / `B-189` that they've landed, and `pnpm prd sync` before starting either slice. If quick-fixes hasn't landed them, the slice may start and leave its filter or text line to a short follow-up once they do (say so in the hand-off).

**Landing:** this PRD adds migrations (slices 1, 2, 3 and 4) and synced tables, so hold landing until every slice is merged, then run the checks once at the end. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. Never `--suite` without asking.

**Backlog:** claim B-181 when slice 1 starts; `done B-181` after slice 6 merges.

**New dependencies:** none.

Fold into the area docs at each landing (only rules and pointers into AGENTS.md itself):

- **Slice 1:** conditions in `docs/domain/profiles.md` (the table, the flag, the service, the card and sheets, suggestions, seeds, tests); the stream, device schema, upload op and matrix row in `sync.md`; the permission row in `care-groups.md`.
- **Slice 2:** the `conditionChange` kind in `timeline.md` (label, wording, filter, simple mode) and `profiles.md`; the condition search document in `search.md`.
- **Slice 3:** the managers link and the provider page's section in `providers.md` and `profiles.md`.
- **Slice 4:** `medication_condition` and the For field in `medications.md`.
- **Slice 5:** the print sections in `profiles.md` (emergency sheet) and `medications.md` (sheets).
- **Slice 6:** `recipient_profile` and `list_timeline` in `connectors.md` (and drop "There is no conditions field yet (B-181)").

## Architectural decisions

- **Area:** conditions belong to **profiles** (`db/schema/profiles/recipientCondition.ts`, `lib/profiles/conditions.ts` and `conditions.sync.ts`, the profile's sheets). Medication and provider screens read them through `lib/profiles`.
- **`recipient_condition`** (synced; slice 1's migration): `id`, `group_id`, `recipient_id` (composite FK to the recipient, NO ACTION, like `recipient_allergy`), `name` (≤ 200), `status` (`active | resolved`, DB check), `since_year`, `since_month` (optional; a month needs a year; DB checks), `note` (≤ 300), `diagnosed_by_id` (optional, composite FK to a provider in the group, NO ACTION, like `medication.prescriber_id`), `deleted_at`, timestamps and audits. Unique `(group_id, id)`. **`care_recipient.no_known_conditions_at`** in the same migration.
- **`condition_manager`** (slice 3's migration) and **`medication_condition`** (slice 4's migration): link tables whose id is a UUID v5 of the pair (`db/schema/core/uuidV5.ts`, as `entryProviderId`), composite FKs in the group (cascading), hard delete on unlink. Both synced.
- **`conditionChange`** (slice 2's migration re-makes `timeline_entry_kind_check`): a system-written kind (`SYSTEM_WRITTEN_KINDS`). Details: `conditionId`, `change` (`added | changed | resolved | reactivated`), and for `changed` the `fields` with `before` and `after` summaries. Tracked fields: name, status, since, note (slice 2), diagnosed by and managed by (slice 3). Its id is derived from the condition id and the time, like `medicationChangeId`. Delete writes no entry. One pure **`conditionChange(before, after)`** builds it for both writers.
- **Writes:** the device writes locally (`conditions.sync.ts`) in one transaction with its change entry, and uploads; the server's `recipientConditionService` applies the same rules and writes the same entry. Links only to live rows in the group; a deleted provider or condition is refused; another group's id is `unauthorized`. Errors are returned.
- **Permissions** follow `recipient_allergy`: read and list any group role; create, update, delete writers; `group_id`, `recipient_id`, `deleted_at` system only. The link tables likewise.
- **"No known conditions"**: adding a live condition clears the flag; setting it with live conditions on file is refused (as `hasAllergies` does).
- **Suggestions** (`lib/profiles/conditionSuggestions.ts`, pure): a curated static list of about 150 plain-language conditions common in older adults, plus the group's own names (first), every typed word matched, de-duplicated case-insensitively, capped at 20. Free text is always allowed. No dependency, nothing fetched.
- **Registries take additive entries at the end of their group:** the schema index, `PERMISSIONS`, `sync-config.yaml`, the device schema, the upload switch, the sync matrix, `TIMELINE_ENTRY_KINDS`, `KIND_META`, the timeline filter kinds, `SEARCH_ITEM_TYPES`, the profile's `PROFILE_SHEETS` and routes.
- **Seeds** (`seeds/conditions.ts`, own ids, appended last): Dev Family's recipient gets three active conditions and one resolved, linked to seeded providers (slice 3) and medications (slice 4). All fictional.

## How to run this plan

- **Wave 1: slice 1** (the tracer bullet: the list end to end on the profile; it owns the conditions migration and every registry entry for `recipient_condition`).
- **Wave 2: slices 2, 4, 5.**
  - Slice 2 owns the timeline kind, its migration, the row wording, the filter and search.
  - Slice 4 owns `medication_condition`, its migration and the medication form and page.
  - Slice 5 owns the print sections. No shared files with 2 and 4 except additive lines.
- **Wave 3: slice 3** (managers and diagnosed by; extends the timeline diff from slice 2).
- **Wave 4: slice 6** (the connector).
- Merge in number order within a wave, with no checks between merges.
- **Migrations:** slices 1, 2, 3 and 4 each add one (say "adds a migration"; it takes the next number when it lands). When a later one merges into `prd/conditions`, regenerate it on top of the earlier ones (`pnpm datastore:generate`) and reread the SQL; keep each migration's hand-written `ALTER PUBLICATION … ADD TABLE` for its new synced table.
- **Stacks:** only slice 1 needs one (seeds on a fresh device, the sync matrix row, `--changed`). The others are stackless: integration tests on the shared test Postgres, component tests on the test device. A stackless slice whose `--changed` names a browser check reports it for the orchestrator to run at landing.
- **Checks:** every slice runs `pnpm check`. Screen slices run `pnpm test:components --changed prd/conditions`. No slice adds an end-to-end step. Every slice runs `pnpm prd browser --changed` once before hand-off and reports what it named.
- **Running beside other PRDs:**
  - `quick-fixes` (wave 13): slice 51 rewrites `TimelineFilters.tsx` (slice 2 adds its kind there, after it); slice 48 rewrites `listTimeline.ts`'s text (slice 6 adds condition changes there, after it). Slice 50 touches the Today card (no overlap).
  - `appointments-2` (running): hot on the timeline rows, `entryActionItems`, the sync and upload registries and the sync matrix. Slice 1's and 2's registry edits are additive lines at the end; sync `dev` before each.
  - Others: no overlap.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: Conditions on the profile, end to end

Stack: yes · Reads: docs/domain/profiles.md, docs/domain/medications.md, docs/domain/sync.md, docs/domain/data-layer.md, docs/domain/components.md, docs/domain/care-groups.md · Tests: unit, integration, component

**User stories:** 1–6, 10–19, 34.

**Build.**

- Schema `recipientCondition.ts` (columns, checks, limits, the Zod content schema with the since rules), `care_recipient.no_known_conditions_at`. **Adds a migration** (with the publication's `ADD TABLE`).
- `PERMISSIONS.recipient_condition` as allergies'; `recipientConditionService`: `list`, `get`, `create`, `update`, `resolve`, `reactivate`, `remove` (soft), `setNoKnownConditions` (refused with live conditions), the flag cleared on create.
- Sync: `sync-config.yaml` (explicit columns, soft-deleted rows included), `pnpm db:roles` output, the device schema, the upload switch's op onto the service, the sync matrix row.
- `lib/profiles/conditions.ts` (pure): order (active by most recent since then name; then resolved), the since text, the one-line summary. `conditionSuggestions.ts` with the curated list.
- `lib/profiles/conditions.sync.ts`: the list, one condition, the group's names; local create, update, resolve, reactivate, remove, the flag.
- Screens: the profile's **Conditions** card after Basics (every role): active, a Past group, "No known conditions" or "Conditions not recorded". Writers: Add, "No known conditions". Sheets `profile/conditions/new`, `profile/conditions/:conditionId` (view: note, since, status; Resolve or Reactivate; Edit; Delete behind a `ConfirmDialog`), `…/edit`. The name field is a `ComboBox` over the suggestions; since is an optional year and optional month. Viewers get the card and the view, no actions. Works offline (local writes).
- Seeds: three active, one resolved (no provider or medication links yet).

**Acceptance criteria.**

- [ ] Unit tests: the order, the since text and validation (a month without a year refused), `conditionSuggestions` (every word matched, group names first, case-insensitive de-duplication, the cap of 20).
- [ ] Integration tests (`recipientCondition.int.test.ts`): writers create, edit, resolve, reactivate and delete; viewers refused; another group's recipient `unauthorized`; the flag cleared on add and refused with live conditions; a soft-deleted condition gone from `list`.
- [ ] Integration test (like `syncPasses.int.test.ts`): an upload of each op lands through the service, and a viewer's upload is refused.
- [ ] The sync matrix test passes with the new row; `roles.int.test.ts` covers the new table's grants.
- [ ] Component tests (`profile/conditions.browser.test.tsx` on `profileWorld.tsx`): the card by role and state (active and past, no known, not recorded); add with a suggestion and with free text; resolve and reactivate; delete after the confirm; edit offline then synced; a viewer sees no actions.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** none. **Blocks:** 2, 4, 5.

## Slice 2: Condition changes on the timeline, and search

Stack: no · Reads: docs/domain/timeline.md, docs/domain/search.md, docs/domain/profiles.md, docs/domain/medications.md · Tests: unit, integration, component

**User stories:** 25–28.

**Build.**

- The `conditionChange` kind in `TIMELINE_ENTRY_KINDS`, `SYSTEM_WRITTEN_KINDS` and its details schema. **Adds a migration** (re-making `timeline_entry_kind_check`).
- Pure `conditionChange(before, after)` (name, status, since, note) and `conditionChangeId`. The device writes (`conditions.sync.ts`) and the service each write the entry in the same transaction: added, changed (only when a tracked field changed), resolved, reactivated; delete none.
- Timeline: `KIND_META` (label "Condition change", an icon from `lucide-react`), the row wording in `EntryBody` ("Added Type 2 diabetes", "Since: 2015 → 2014", "Resolved Hip fracture"), the kind in the filter sheet's Kind choices (quick-fixes slice 51's UI), left out of simple mode as `medicationChange` is.
- Search: a condition search document (name, note) in `SEARCH_ITEM_TYPES` with its builder, results opening the condition's sheet; bump `SEARCH_INDEX_VERSION`. Condition changes are found through their entry text.

**Acceptance criteria.**

- [ ] Unit tests: `conditionChange` for each tracked field, a no-op edit (no entry), resolve, reactivate; the wording for each change.
- [ ] Integration tests: each service write records one entry in its transaction with matching details; a hand create of `conditionChange` is refused; the upload of a device-written entry is accepted with the derived id.
- [ ] Component tests: the row's wording and icon; the filter shows only condition changes; simple mode has none; search for "diabetes" finds the condition and its change.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 1; quick-fixes slice 51 in `dev` (see the start conditions). **Blocks:** 3, 6.

## Slice 3: Who diagnosed it and who manages it

Stack: no · Reads: docs/domain/providers.md, docs/domain/profiles.md, docs/domain/components.md, docs/domain/sync.md · Tests: unit, integration, component

**User stories:** 7–9, 16, 24, 26, 35.

**Build.**

- `condition_manager` link table (UUID v5 id from the pair). **Adds a migration.** Its permissions, stream, device schema, upload op and matrix row.
- The service: `diagnosedById` checked as a live provider in the group (as the prescriber is); `setManagers` (add, remove; replays succeed); deleted providers refused.
- The sheets: a single "Diagnosed by" pick (reuse `ProviderPickerField`) and a multi "Managed by" pick (reuse the multi-link picker, `LinkPickerField` or the With row's `ComboBox` pattern), each with "Add "<typed>" as a provider". The view lists both; a deleted provider is greyed "(removed)" and not a link.
- `conditionChange` tracks diagnosed by and managed by (names in the summaries).
- The provider page: a **Conditions** section (what they diagnosed or manage, active first), left out when empty.
- Seeds: link the seeded conditions to seeded providers.

**Acceptance criteria.**

- [ ] Unit tests: the diff for diagnosed by and managed by (added, removed, replaced).
- [ ] Integration tests: a provider in another group `unauthorized`; a deleted provider refused; manager links replay; the upload ops.
- [ ] The sync matrix test passes with the new row.
- [ ] Component tests: picking both on the sheet (and adding a new provider from the picker); "(removed)" for a deleted provider; the provider page's section (`providerWorld.tsx`) shows and hides correctly.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 2. **Blocks:** 6.

## Slice 4: Medications for a condition

Stack: no · Reads: docs/domain/medications.md, docs/domain/profiles.md, docs/domain/components.md, docs/domain/sync.md · Tests: integration, component

**User stories:** 20–23, 34.

**Build.**

- `medication_condition` link table (UUID v5 id from the pair). **Adds a migration.** Its permissions, stream, device schema, upload op and matrix row.
- The service: `setMedicationConditions` (live medication and live conditions in the group; replays succeed). A deleted condition's links are hidden everywhere.
- The medication form: a multi-pick **For** field over the recipient's live active conditions (resolved ones only if already linked), beside the free-text reason, which stays.
- The medication page: "For: Atrial fibrillation, …" linking each condition's sheet, then the reason.
- The condition's view sheet: its current medications, linking each medication.
- Seeds: link two seeded medications to seeded conditions.

**Acceptance criteria.**

- [ ] Integration tests: links only in-group and to live rows; replays; a deleted condition's links gone from the medication's list; the upload ops.
- [ ] The sync matrix test passes with the new row.
- [ ] Component tests (`medicationWorld.tsx`): the For field picks several and keeps the reason; the medication page shows "For: …"; the condition sheet lists its current medications; a deleted condition disappears from both.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 1. **Blocks:** none.

## Slice 5: Conditions on the printed sheets

Stack: no · Reads: docs/domain/profiles.md, docs/domain/medications.md · Tests: unit, component

**User stories:** 29, 30.

**Build.**

- The emergency sheet builder: a conditions section after allergies (active only, with since; "No known conditions"; left out when not recorded), in `EMERGENCY_SECTION_ORDER`.
- A shared `PrintConditions` beside `PrintAllergies`, under it on the medication sheet and the weekly chart.
- Keep the seeded profile's emergency sheet to one Letter page.

**Acceptance criteria.**

- [ ] Unit tests: the builder's conditions section (active only, order, no known, not recorded).
- [ ] Component tests: the emergency sheet page and the medication sheets show the conditions (`commands.printMedia`); the seeded emergency sheet still fits one page.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 1. **Blocks:** none.

## Slice 6: Conditions for a connected assistant

Stack: no · Reads: docs/domain/connectors.md, docs/domain/profiles.md · Tests: integration

**User stories:** 31–33.

**Build.**

- `recipient_profile`: conditions (name, status, since, note, diagnosed by and managed by names, active first) and `noKnownConditions`, in the structured output and the text; the tool's description says so.
- `list_timeline`: condition changes' text in full (the change and before → after), in quick-fixes slice 48's style.
- The consent and privacy text name conditions (`CONNECTOR_CONSENT_TEXT`, the marketing privacy page). Bump `CONNECTOR_CONSENT_VERSION` only if the meaning changes (it already says "medical profile"); say which in the hand-off.

**Acceptance criteria.**

- [ ] Integration tests (`readTools.int.test.ts`): `recipient_profile` lists conditions in order with providers' names and the flag; a deleted condition is absent; the sweep test still passes (no contact details).
- [ ] Integration test: `list_timeline` text for added, changed, resolved and reactivated condition changes.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 2, 3; quick-fixes slice 48 in `dev` (see the start conditions). **Blocks:** none.
