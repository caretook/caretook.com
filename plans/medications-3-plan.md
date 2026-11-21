# Plan: Medications 3

> Source PRD: [`plans/medications-3-prd.md`](medications-3-prd.md). User-story numbers (US) refer to it. Backlog items B-200 (a medication type field) and B-199 (adding a medication from log a dose). Topic `medications-3`.

## Status

| Slice | Wave | State        | Merge into `prd/medications-3` (slice commits) |
| ----- | ---- | ------------ | ---------------------------------------------- |
| 1     | 1    | in progress (opus, slot 3) |                                                |
| 2     | 2    | blocked by 1 |                                                |
| 3     | 2    | blocked by 1 |                                                |
| 4     | 2    | blocked by 1 |                                                |

**Landing mode: run everything through** (queued with `pnpm prd queue medications-3`): start every ready slice, land each green wave, clean up; ask only real questions.

**Now (2026-11-20):** `conditions` landed in `dev` (`a95acb73`); synced into `prd/medications-3`. B-200 claimed. Slice 1 started: worktree `.loops/medications-3-1` (slot 3, stack up after a B-207 migrate flake on the first try), agent spawned on opus. Wave 2 waits on its merge; before wave 2, check `quick-fixes`' open slices for the Dose sheet or the medication list.

**Start conditions:** `conditions` landed in `dev` (its slice 4 changes the medication form and page; both PRDs touch `sync-config.yaml`, the device schema and the upload switch). Check its PRD row says done, then `pnpm prd sync` before slice 1.

**Landing:** slice 1 adds a migration and a synced column, so hold landing until every slice is merged, then run the checks once at the end. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. Never `--suite` without asking.

**Backlog:** claim B-200 when slice 1 starts and B-199 when slice 4 starts; `done B-200` after slices 2 and 3 merge, `done B-199` after slice 4.

**New dependencies:** none.

Fold into the area docs at each landing (only rules and pointers into AGENTS.md itself):

- **Slice 1:** the `type` column, the required-where-asked rule, "not tracked", the form's collapse, the badge and the page in `docs/domain/medications.md`; the column in `sync.md` if it lists columns.
- **Slice 2:** `?type=` and the print grouping in `medications.md`.
- **Slice 3:** the type in `medicationSearchDocument` and the index version in `search.md`; `list_medications`'s `type` in `connectors.md`.
- **Slice 4:** the quick add (the option, the one transaction, the toast, the empty state) in `medications.md`.

## Architectural decisions

- **Types:** `MEDICATION_TYPES = ["prescription", "otc", "supplement", "other"]`, client-safe in the medications schema. Labels "Prescription", "Over the counter", "Supplement", "Other"; badges "Rx", "OTC", "Supplement", "Other"; null reads "Type not set". One pure wording module beside `medicationDisplay` gives labels, badges and the group order; every screen, print, search and the connector use it.
- **Column:** `medication.type`, nullable text with a DB check, no backfill (slice 1's migration). In the `care_groups` stream's medication columns, the device schema and `medicationOp`.
- **Required where it's asked:** the medication form's and the quick add's schemas require a type (Prescription is the default on new); the service, the upload and the column accept null (existing rows, uploads from older builds).
- **Not tracked:** a type change writes no `medicationChange` entry.
- **URLs:** the list's `?type=<one type>` beside `?status=` and `?q=`; the quick add's "Add details" goes to the medication's edit sheet through `appUrls`. No new routes.
- **Quick add:** a reserved option value in the Dose sheet's choices; the device writes the medication (as needed, no maximum, current), its create change entry and the dose in **one local transaction**; the upload's medication op writes the change entry idempotently, as today.
- **Seeds:** the seeded medications get types: at least one of each, one left unset. All fictional.

## How to run this plan

- **Wave 1: slice 1** (the tracer bullet: it owns the migration, every registry entry for the column, `MedicationForm.tsx` and the wording module).
- **Wave 2: slices 2, 3, 4.**
  - Slice 2 owns `medicationList.ts`, `MedicationFilters.tsx` and `printSheet`.
  - Slice 3 owns the search document and `list_medications`.
  - Slice 4 owns the Dose sheet (`new-dose/`, `DoseForm.tsx`, `doseFormData.ts`) and the device's `logDose` path. No shared files between them except additive lines.
- Merge in number order within a wave, with no checks between merges.
- **Migration:** slice 1 adds one (say "adds a migration"; it takes the next number when it lands). If `dev` gains one first, regenerate it (`pnpm datastore:generate`) and reread the SQL.
- **Stacks:** only slice 1 needs one (the migration on a fresh database, seeds, the sync matrix, `--changed`). The others are stackless: integration tests on the shared test Postgres, component tests on the test device. A stackless slice whose `--changed` names a browser check reports it for the orchestrator to run at landing.
- **Checks:** every slice runs `pnpm check`. Screen slices run `pnpm test:components --changed prd/medications-3`. No slice adds an end-to-end step. Every slice runs `pnpm prd browser --changed` once before hand-off and reports what it named.
- **Running beside other PRDs:**
  - `appointments-2` (running): hot on the sync and upload registries and the sync matrix; slice 1's edits there are additive lines; sync `dev` before it.
  - `quick-fixes`: check its open slices for the Dose sheet or the medication list before wave 2.
  - Others: no overlap.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: Medication types, end to end

Stack: yes · Reads: docs/domain/medications.md, docs/domain/sync.md, docs/domain/data-layer.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** 1–10, 14, 19.

**Build.**

- `MEDICATION_TYPES`, the nullable `type` column with its check, the Zod content schemas (required on the form's create and edit, nullable for the service and upload). **Adds a migration.**
- Sync: `sync-config.yaml` (the column), `pnpm db:roles` output if it changes, the device schema, `medicationOp`, the sync matrix.
- `medicationChange`: `type` stays out of the tracked fields.
- The pure wording module (labels, badges, the print group order, "Type not set").
- The form: a Type choice, Prescription first and the default for a new medication; an old medication with no type starts unselected and must be set to save. For any other type, Prescriber, Refills left and Rx number move into a native `<details>` "Prescription details", open when any has a value; values kept and saved whatever the type. Pharmacy, Last filled and Quantity stay put.
- The page: "Type: …" or "Type: not set" in the details. The list row: the badge for every set type, none for null.
- Seeds: types on the seeded medications (one of each, one unset).

**Acceptance criteria.**

- [ ] Unit tests: the wording module (each label and badge, null, the group order).
- [ ] Integration tests (medication service): a known type and null accepted, an unknown one refused; a type change writes no change entry; the upload op round-trips `type` (`syncMedications.int.test.ts`).
- [ ] The sync matrix test passes with the column.
- [ ] Component tests (`medicationForm.browser.test.tsx`, `medicationList.browser.test.tsx` on `medicationWorld.tsx`): a new medication defaults to Prescription and saves it; an old one with no type is refused until set; choosing OTC collapses the three fields and an OTC with an Rx number starts open; the list shows each badge and none for null; the page shows the type and "not set".
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** none (start condition: `conditions` landed). **Blocks:** 2, 3, 4.

## Slice 2: The type filter and the printed list by type

Stack: no · Reads: docs/domain/medications.md, docs/domain/components.md · Tests: unit, component

**User stories:** 11–13, 15–16.

**Build.**

- `medicationList.ts`: `type` in the filters (`?type=`, one or none; unknown values read as no filter and are tidied on the next change, as `status`), applied with status and search; `setType`, `clearType`.
- The filter UI beside the status filter: All types and each type.
- `printSheet`: current medications grouped Prescription, Over the counter, Supplement, Other, Type not set, a heading per non-empty group, each by name; stopped medications stay one list. The weekly sheet is unchanged.

**Acceptance criteria.**

- [ ] Unit tests (`medicationList.test.ts`): parse, set, clear and tidy `?type=`; combined with status and search; other params kept.
- [ ] Unit tests (`printSheet.test.ts`): the group order, empty groups left out, null last, by name within a group, stopped ungrouped.
- [ ] Component tests: the list filters by type and the URL keeps it with status; the printed sheet shows the group headings (`print.browser.test.tsx`).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 1. **Blocks:** none.

## Slice 3: Types in search and the connector

Stack: no · Reads: docs/domain/search.md, docs/domain/connectors.md, docs/domain/medications.md · Tests: unit, integration

**User stories:** 17–18.

**Build.**

- `medicationSearchDocument`: the type label in the body; bump `SEARCH_INDEX_VERSION`. Server medication matching follows if it reads the same builder; if it doesn't, say so in the hand-off rather than widening it.
- `list_medications`: `type` (stored value or null) in each medication, and the label in the text line ("Vitamin D 1000 IU · Supplement · …").

**Acceptance criteria.**

- [ ] Unit tests: the search document carries the label; null adds nothing.
- [ ] Integration tests (`readTools.int.test.ts`): `list_medications` returns `type` (and null) and the label in the text.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 1. **Blocks:** none.

## Slice 4: Add a medication from the Log a dose sheet

Stack: no · Reads: docs/domain/medications.md, docs/domain/timeline.md, docs/domain/sync.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** 20–34.

**Build.**

- The Dose sheet's options end with "+ New medication" (a reserved value). Picking it shows Name (with `NameField`'s allergy warning), Dose and Type (Prescription default, required) under the Medication choice; Amount follows the typed dose until typed; Status, When and Note unchanged. No `doseWarnings` for a new medication.
- A pure planner beside `doseRows`: the medication row (as needed, no maximum, current, name, dose, type, the group's recipient), its create change entry and the dose row; validation errors on name and type.
- The device's `logDose` path writes all three in one local transaction.
- On success the sheet closes and a `Toast` shows "Added <name> · Add details" (about 10 s, gone on navigation), the action opening the medication's edit sheet.
- With no current medications, the sheet shows the quick add directly instead of the empty message.

**Acceptance criteria.**

- [ ] Unit tests: the planner (the rows, the as-needed schedule, the change entry id, name and type required).
- [ ] Integration test (`syncMedications.int.test.ts`): an offline quick add (medication, change entry, dose) uploads in one batch; replaying it succeeds.
- [ ] Component tests (`timelineDoses.browser.test.tsx` on `medicationWorld.tsx`): "+ New medication" shows the fields; the amount follows the dose; an allergy match warns; Log dose creates both (the medication in the list, the dose and the "added" change on the timeline); an empty name is refused; the toast's Add details opens the edit sheet; with no medications the form shows directly.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 1. **Blocks:** none.
