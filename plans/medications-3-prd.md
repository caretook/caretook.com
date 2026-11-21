# PRD: Medications 3: medication types and quick add from a dose

Backlog: B-200 (a type field), B-199 (adding a medication from log a dose). Area: [medications](../docs/domain/medications.md). Plan: [medications-3-plan.md](medications-3-plan.md).

## Problem Statement

A caretaker's list mixes prescriptions with over-the-counter painkillers, vitamins and herbal supplements, and nothing tells them apart: the list, the medication page, the printed sheet a clinician reads and what an assistant sees all treat them the same, and the form asks for a prescriber, refills and an Rx number for a bottle of vitamin D.

And when a caretaker gives something that isn't on the list yet (a Tylenol for a headache), the Log a dose sheet has no way to log it: they have to leave, fill in the full medication form, and come back. With no medications at all, the sheet just says there's nothing to log.

## Solution

Every medication has a **type**: Prescription, Over the counter, Supplement or Other. New medications start on Prescription and must have one; existing medications show "Type not set" until edited. The list shows a badge with each medication's type and filters by type; the medication page shows it; the printed medication list groups current medications by type; search and the connector's `list_medications` know it. For a type other than Prescription, the prescription-only fields fold into a "Prescription details" section.

In the Log a dose sheet, a last **"+ New medication"** choice opens name, dose and type fields in place. Log dose creates the medication (as needed, no maximum) and logs the dose in one step, offline too; the sheet closes with "Added Ibuprofen · Add details", which opens the new medication's edit sheet. With no medications yet, the sheet opens straight onto that form.

## User Stories

1. As a caretaker, I want to mark a medication as a prescription, over the counter, a supplement or other, so that the list says what kind of thing each one is.
2. As a caretaker adding a medication, I want the type to start on Prescription, so that the usual case needs no extra tap.
3. As a caretaker, I want the form to insist on a type for a new medication, so that every new medication has one.
4. As a caretaker with medications added before types existed, I want them to show "Type not set" rather than a guess, so that I know which ones to fix.
5. As a caretaker editing an old medication, I want to set its type, so that it joins the rest.
6. As a caretaker adding a supplement, I want prescriber, refills and Rx number tucked into a collapsed "Prescription details" section, so that the form is short for things without a prescription.
7. As a caretaker, I want that section open when any of those fields is already filled in, so that I never lose sight of data I entered.
8. As a caretaker, I want pharmacy and last filled to stay visible for every type, so that I can track where I buy over-the-counter items.
9. As a caretaker scanning the list, I want a badge with each medication's type (Rx, OTC, Supplement, Other), so that I can tell them apart at a glance.
10. As a caretaker, I want no badge on a medication whose type isn't set, so that the list doesn't claim something it doesn't know.
11. As a caretaker, I want to filter the list by one type, so that I can see just the supplements.
12. As a caretaker, I want the type filter to combine with the status filter and the search, so that "discontinued prescriptions matching 'statin'" works.
13. As a caretaker, I want the type filter in the URL, so that a link or the back button keeps it.
14. As a caretaker, I want the medication page to show the type (or "Type not set"), so that the details are complete.
15. As a caretaker printing the medication list for a visit, I want current medications grouped Prescriptions, Over the counter, Supplements, Other, then Type not set, so that the clinician sees the prescriptions first and every supplement in one place.
16. As a caretaker, I want each group in print sorted by name, so that it reads like the list.
17. As a caretaker, I want searching "supplement" or "over the counter" to find those medications, so that search knows the type.
18. As a member using an AI assistant through the connector, I want `list_medications` to return each medication's type, so that the assistant can answer "what supplements is Mom taking?".
19. As a caretaker, I want changing a type not to add an entry to the timeline, so that history stays about what matters clinically.
20. As a caretaker logging a dose of something not on the list, I want a "+ New medication" choice in the Log a dose sheet, so that I don't have to leave the sheet.
21. As a caretaker, I want that choice to ask only for the name, the dose and the type, so that it takes seconds.
22. As a caretaker, I want the new medication's type to start on Prescription and be required, like the full form.
23. As a caretaker, I want the amount to follow the dose I type for the new medication until I change it, as it does for existing ones.
24. As a caretaker, I want Log dose to create the medication and log the dose together, so that I never end up with one without the other.
25. As a caretaker, I want the quick-added medication to be "as needed" with no maximum, so that it doesn't start showing due or missed doses until someone gives it a schedule.
26. As a caretaker offline, I want the quick add to work and sync later, so that it works in a basement or a hospital.
27. As a caretaker, I want the name warnings the full form gives (an allergy match), so that the shortcut isn't less safe.
28. As a caretaker, I want a clear error on the name if I leave it empty, so that I know what's missing.
29. As a caretaker, after logging, I want a notice "Added Ibuprofen · Add details", so that I can fill in strength, directions and the rest when I have time.
30. As a caretaker, I want "Add details" to open the new medication's edit sheet, so that I land where the details go.
31. As a caretaker with no medications yet, I want the Log a dose sheet to open the new medication fields directly, so that the first dose is as easy as any.
32. As a viewer, I want none of this offered to me, so that read-only members can't add medications (the sheet already sends viewers away).
33. As a caretaker, I want the quick-added medication to appear in the list, on the timeline as "added", and in the history, like any other new medication.
34. As a caretaker, I want the quick add's dose warnings to stay out of the way (a new medication has no earlier doses), so that nothing asks "Log anyway?" needlessly.

## Implementation Decisions

- **Types:** `MEDICATION_TYPES = ["prescription", "otc", "supplement", "other"]` in the medications schema (client-safe through `@caretook/data/schema`). Labels "Prescription", "Over the counter", "Supplement", "Other"; badges "Rx", "OTC", "Supplement", "Other"; "Type not set" for null. One pure wording module beside `medicationDisplay` gives labels, badges and the print group order; every screen, print, search and the connector read it.
- **Column:** `medication.type`, nullable text with a DB check (`enumCheck`), no backfill. **Adds a migration.** It's added to the `care_groups` stream's medication columns in `sync-config.yaml`, the device schema and the upload op (`medicationOp`).
- **Required where it's asked:** the medication form's and the quick add's Zod schemas require a type; the service, the upload and the column accept null (existing rows, and uploads from builds before this change). Editing an old medication with no type starts the choice on nothing selected and requires one on save.
- **Not tracked:** `type` is not a tracked field in `medicationChange` (like refills and providers): a change to it writes no entry.
- **The form:** a Type choice (`ChoiceGroup`, Prescription first and the default on a new medication) near the top. For any type other than Prescription, Prescriber, Refills left and Rx number sit in a native `<details>` "Prescription details" section, open when any of them has a value; their values are kept and saved whatever the type. Pharmacy, Last filled and Quantity stay where they are. The form owned by `conditions` slice 4 (the For field) is already in `dev` before this starts.
- **The list:** `medicationList.ts` gains `type` in `MedicationFilters` (`?type=`, one type or none; unknown values read as no filter and are tidied on the next change, as `status` is) and filters on it before status and search. The filter UI sits with the status filter in `MedicationFilters.tsx`. `MedicationListItem` shows the badge for every set type, none for null.
- **The page:** the details show "Type: Over the counter" or "Type: not set".
- **Print:** `printSheet(...)` groups current medications by type in the order Prescription, Over the counter, Supplement, Other, Type not set (each by name, a heading per non-empty group); stopped medications stay one list. The weekly bedside sheet is unchanged.
- **Search:** `medicationSearchDocument` adds the type label to the body; `SEARCH_INDEX_VERSION` is bumped. Server medication matching follows if it reads the same builder.
- **Connector:** `list_medications` returns `type` (the stored value or null) and adds the label to each text line ("Vitamin D 1000 IU · Supplement · …").
- **Quick add (B-199):**
  - The Dose sheet's options gain a last option, "+ New medication" (a reserved option value). Picking it shows Name (with `NameField`'s allergy warning), Dose and Type in place, under the Medication choice; Status, Amount, When and Note stay as they are, and Amount follows the typed dose until typed.
  - A pure planner (beside `doseRows`) turns the form into the medication row (as needed, no maximum, status current, type, name, dose, `recipient_id` from the group), its `medicationChange` create entry and the dose row; `logDose` on the device writes all three in **one local transaction**; the upload's medication op writes the change entry idempotently, as today.
  - `doseWarnings` isn't asked for a new medication.
  - On success the sheet closes and a `Toast` reads "Added <name> · Add details", the action opening `appUrls` medication edit sheet for it; it goes away after about 10 s or on navigation.
  - With no current medications, the sheet shows the quick add form directly (the only option) instead of the empty message.
  - `newDoseGuard` is unchanged: viewers never see the sheet.
- **Out of the hot files:** quick entry (the assistant) and the connector's write tools don't create medications.

## Testing Decisions

Good tests check behaviour through a module's public interface (inputs and what the user or caller sees), not its internals.

- **Unit (pure):** the type wording (labels, badges, group order); `medicationList.ts` (`?type=` parse, set, clear, tidy, combined with status and search); `printSheet` grouping and order, null last; the quick add planner (rows, the as-needed schedule, the change entry id, a required name and type); `medicationSearchDocument` with a type. Prior art: `medicationList.test.ts`, `printSheet.test.ts`, `passLogs.test.ts`.
- **Integration:** the service validates `type` (a known value or null) and round-trips it through the upload op; a change to `type` writes no change entry; an offline quick add (the medication, its change entry and the dose) uploads in one batch, and replaying it succeeds; `list_medications` returns `type` and the label in the text. Prior art: `syncMedications.int.test.ts`, `readTools.int.test.ts`.
- **Component** (`medicationWorld.tsx`): the form (default Prescription; required on a new and on an old medication; the collapsed section for OTC, open when filled); the list badge and the type filter; the page's type and "not set"; the print sheet's groups; the Dose sheet's "+ New medication" (fields, amount follows dose, the allergy warning, Log dose writes both, the toast and its link) and the empty state. Prior art: `medicationForm.browser.test.tsx`, `medicationList.browser.test.tsx`, `timelineDoses.browser.test.tsx`, `print.browser.test.tsx`.
- **No new e2e step:** integration covers the upload.

## Out of Scope

- Backfilling or guessing types for existing medications.
- More types (vitamin vs herbal, supplies and devices).
- Hiding (not collapsing) fields by type, or a type-specific form beyond the collapse.
- A type change on the timeline.
- The weekly bedside sheet showing types.
- Quick entry (the assistant) creating a medication from an unknown name; connector write tools for medications.
- Inline add anywhere but the Log a dose sheet (Today, the pass sheet, the dose edit sheet).
- A schedule in the quick add.

## Further Notes

- Starts after `conditions` lands in `dev`: its slice 4 changes the medication form and page, and both PRDs touch the sync config, device schema and upload switch.
- All seed and test data is fictional. Seeds give the seeded medications types (one of each, one left unset).
