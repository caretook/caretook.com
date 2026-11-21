# Conditions PRD (B-181)

Status: planned (2026-11-20). Plan: [`conditions-plan.md`](conditions-plan.md). Builds on the [profiles PRD](profiles-prd.md) and the medications area's allergies, whose shape it follows: a synced list on the care recipient, written on the device, every member reads, writers edit.

## Problem Statement

A care group knows its medications and allergies, but not **why**: the diagnoses behind them. A new aide sees lisinopril and metformin and has to guess at high blood pressure and diabetes. A sibling at the ER can't say when the AFib started or which cardiologist manages it. The printed emergency sheet has no history section. A connected assistant (Claude, ChatGPT) answers questions about the recipient without knowing what they have: the connector's `recipient_profile` promised conditions, and its privacy text dropped the word because there was nothing to send (B-181). Medications carry a free-text reason ("for BP"), which can't be listed, searched by condition or kept in step when a condition is resolved.

## Solution

A **Conditions** list on the care recipient's profile, for every member to read and writers to keep:

- Each condition has a name (with plain-language suggestions as you type), a status (active or resolved), an optional "since" (a year, or a month and year), a short note, **who diagnosed it** (one provider) and **who manages it** (any number of providers).
- "No known conditions" can be recorded, so an empty list and an unrecorded one look different.
- Resolving moves a condition to _Past_; deleting is only for a mistake.
- A medication can say what it's **for**: any number of the recipient's conditions, a free-text reason, or both.
- Every add, change, resolve and reactivate writes a **Condition change** to the timeline (like medication changes), with before → after values. Search finds conditions and their changes.
- Conditions show on the profile, on a provider's page (what they diagnosed or manage), on the medication page and form, on the printed emergency sheet and medication sheet, and to a connected assistant (read only).
- It works offline like allergies: edits are made on the device and upload later.

## User Stories

1. As a caretaker, I want to add a condition to the recipient's profile, so that everyone helping knows what they have.
2. As a caretaker, I want name suggestions in plain words as I type ("High blood pressure", "Type 2 diabetes"), so that I enter conditions quickly and consistently.
3. As a caretaker, I want to type any name when the suggestion list doesn't have it, so that rare conditions fit.
4. As a caretaker, I want names already used in this group to be suggested too, so that we don't create near-duplicates.
5. As a caretaker, I want to record roughly since when ("2015", "March 2021"), so that a doctor gets the history without exact dates.
6. As a caretaker, I want a short note on a condition ("diet-controlled"), so that the detail that matters is kept with it.
7. As a caretaker, I want to pick the provider who diagnosed it from the group's providers, so that we know where the diagnosis came from.
8. As a caretaker, I want to pick every provider who manages it, so that I know whom to call about it.
9. As a caretaker, I want to add a provider who isn't in the list yet from the picker, so that I don't have to leave the form.
10. As a caretaker, I want to mark a condition resolved, so that past conditions stay as history without cluttering the current list.
11. As a caretaker, I want to mark a resolved condition active again, so that a recurrence is recorded.
12. As a caretaker, I want to delete a condition entered by mistake (after a confirm), so that errors don't linger as history.
13. As a caretaker, I want to record "No known conditions", so that helpers know someone checked rather than nobody entered anything.
14. As a caretaker, I want adding a condition to clear "No known conditions", so that the two never contradict each other.
15. As any member, I want the profile's Conditions card to show active conditions first, then past ones, so that what matters now is on top.
16. As any member, I want to open a condition and see its note, since, who diagnosed and who manages it, and the medications for it, so that I have the whole picture in one place.
17. As a viewer, I want to read conditions but not edit them, so that I can help safely without changing the record.
18. As any member, I want conditions offline, so that I can see them at a clinic with no signal.
19. As a caretaker, I want to add or edit conditions offline and have them upload later, so that I can update the record anywhere.
20. As a caretaker, I want to say which conditions a medication is for, so that the medication list explains itself.
21. As a caretaker, I want to keep a free-text reason on a medication as well as or instead of linked conditions, so that "for sleep" doesn't need a condition.
22. As any member, I want the medication page to show "For: Atrial fibrillation" with a link to the condition, so that I can see why it's taken.
23. As any member, I want a condition's sheet to list the current medications linked to it, so that I see how it's treated.
24. As any member, I want a provider's page to list the conditions they diagnosed or manage, so that I know what each doctor is for.
25. As any member, I want a Condition change on the timeline when a condition is added, changed, resolved or reactivated, so that the history is in one place.
26. As any member, I want a changed condition's timeline entry to show before → after (status, since, name, providers), so that I see exactly what changed.
27. As any member, I want to filter the timeline to condition changes, so that I can review the history alone.
28. As any member, I want search to find conditions and their changes by name, so that "diabetes" brings them up.
29. As a family member at the ER, I want active conditions on the printed emergency sheet, so that staff get the history on paper.
30. As a caretaker, I want conditions at the top of the printed medication sheet, under allergies, so that a pharmacist or a doctor sees why each medication is taken.
31. As a member with a connected assistant, I want it to read the recipient's conditions (name, status, since, note, providers), so that its answers account for them.
32. As a member with a connected assistant, I want the assistant's timeline to describe condition changes in full, so that it can summarize what changed.
33. As an owner, I want the connector's consent and privacy text to name conditions, so that members know what an assistant can read.
34. As a caretaker, I want a deleted condition to disappear everywhere (profile, medications, providers, print, the assistant), so that a mistake doesn't spread.
35. As a caretaker, I want a deleted provider who diagnosed or manages a condition to show as "(removed)" on it, so that the history isn't silently lost.

## Implementation Decisions

**Data**

- New table `recipient_condition`: `group_id`, `recipient_id` (composite FK to the recipient, like `recipient_allergy`), `name` (required, ≤ 200), `status` (`active | resolved`, DB check), `since_year` and `since_month` (both optional; a month needs a year; a sane year range), `note` (≤ 300), `diagnosed_by_id` (optional; composite FK to a provider in the same group, NO ACTION, like the medication's prescriber), `deleted_at`, `timestamps`, `audits`. Unique `(group_id, id)`.
- New link table for **who manages it**: a condition ↔ provider pair, its id a UUID v5 of the pair (like `timeline_entry_provider`), composite FKs in the group, hard delete on unlink.
- New link table `medication_condition`: medication ↔ condition, UUID v5 id from the pair, composite FKs in the group, hard delete on unlink. The medication's free-text `reason` stays.
- `care_recipient.no_known_conditions_at`, like `no_known_allergies_at`: cleared when a condition is added; recording it with live conditions on file is refused.
- A new system-written timeline kind, `conditionChange` (in `SYSTEM_WRITTEN_KINDS`; hand creates and edits are refused). Its details: the condition id and `change` (`added | changed | resolved | reactivated`), and for `changed` the tracked `fields` with `before` and `after` summaries (name, since, note, diagnosed by, managed by). Delete writes no entry. The entry's id is derived from the condition id and time, as `medicationChangeId` is.
- **Adds a migration:** the three tables and the column, the timeline kind check re-made with the new kind, and the publication's `ADD TABLE` for the new tables.
- Permissions follow `recipient_allergy`: read and list for any group role, create, update and delete for writers; `group_id`, `recipient_id`, `deleted_at` system only. The link tables likewise.

**Pure modules (client-safe, shared by device and server)**

- `conditionChange(before, after)`: which tracked fields changed and the change type, used by both writers so device and server entries match.
- Conditions wording and order: active first (most recent since first, then by name), then resolved; the since text ("since 2015", "since March 2021"); a condition's one-line summary for print and the assistant.
- `conditionSuggestions(query, groupNames)`: matches every typed word against a curated, static, plain-language list (about 150 conditions common in older adults) plus the group's own names, group names first, de-duplicated case-insensitively, capped. Free text is always allowed.

**Services and API**

- `recipientConditionService`: create, update, resolve, reactivate, remove (soft), set managers, set or clear "no known conditions", and set a medication's conditions. Each write that changes a condition writes its `conditionChange` entry in the same transaction. Links only to live rows in the same group (a deleted provider or condition is refused; another group's id is `unauthorized`). Errors are returned.
- Deleting a provider leaves its condition links in place; the screens grey it "(removed)", as providers already do. Deleting a condition hides it and its medication links from every list.
- Uploads: handlers in the upload switch for the condition, the manager links, the medication links and the recipient's flag, all onto the service. No new oRPC procedures beyond what profile reads already need.

**Sync and device**

- The new tables join the `care_groups` stream with explicit columns; grants come from the generated roles. The device schema gains them; the sync matrix gains their rows.
- `lib/profiles/conditions.sync.ts`: queries (the list, one condition with its providers and medications, a provider's conditions, a medication's conditions, group names for suggestions) and local writes (each in one transaction with its change entry, using the shared `conditionChange`).

**Screens**

- **Profile:** a Conditions card after Basics (every role): active, then Past, or "No known conditions", or "Conditions not recorded". Writers get Add and "No known conditions". Sheets under the profile: new, edit, and a condition's view (note, since, diagnosed by, managed by, its current medications, Resolve or Reactivate, Delete behind a `ConfirmDialog`). The name field is a `ComboBox` over the suggestions. Providers are picked with the existing single and multi pickers (including "Add "<typed>" as a provider").
- **Medications:** the medication form gets a multi-pick "For" field over the recipient's live conditions, beside the free-text reason; the medication page shows "For: …" linking each condition.
- **Provider page:** a Conditions section (what they diagnosed or manage), left out when empty.
- **Timeline:** the kind's label and icon, its row wording (the change and before → after), its filter in the timeline's filter UI, and simple mode leaves it out as it does medication changes.
- **Print:** active conditions (and a "No known conditions" line) on the emergency sheet after allergies; on the medication sheet and the weekly chart under allergies.
- **Search:** a condition search document (name, note), with the search index version bumped; condition changes are found through their entry text.

**Connector**

- `recipient_profile` adds conditions (name, status, since, note, diagnosed by and managed by names) and "no known conditions", active first; the text lists them.
- `list_timeline`'s text describes condition changes in full (as quick-fixes slice 48 does for medication changes).
- The consent and privacy text name conditions again; bump the consent version only if the wording's meaning changes (it already says "medical profile").

**Running beside other work**

- Quick-fixes slice 48 (`listTimeline.ts`) and 51 (`TimelineFilters.tsx`) touch the same files: the slices touching them wait for those to be in `dev`.
- `appointments-2` (running) touches the timeline rows and sync registries too: merge order and the sync matrix are the conflict points.

## Testing Decisions

- Tests check behaviour through public interfaces: what a service returns and stores, what a screen shows and does, what a tool returns. Not internals.
- **Unit:** `conditionChange` (each tracked field, no-op edits, resolve and reactivate), the order and since wording, `conditionSuggestions` (word matching, group names first, de-duplication, the cap), the print builders' conditions section. Prior art: `medicationChange` tests, `emergencyPrintSheet` tests, `allergies` wording tests.
- **Integration:** the service (writers only, viewers refused, links in-group only, deleted providers refused, the flag's rules, the change entry written in the same transaction), the upload handlers (prior art `syncPasses.int.test.ts`), the sync streams and grants (`roles.int.test.ts`), and the connector (`readTools.int.test.ts`: conditions in `recipient_profile`, the sweep test still passing, condition changes in `list_timeline`).
- **Component:** the profile card and sheets by role, offline and online (`profileWorld.tsx`); the medication form's For field and the medication page (`medicationWorld.tsx`); the provider page section (`providerWorld.tsx`); the print sheets; the timeline row and filter.
- **No new end-to-end step:** the sync matrix rows and the upload integration tests cover syncing.

## Out of Scope

- An assistant adding or resolving conditions (B-197, connectors-2).
- Medical codes (ICD-10, SNOMED), a terminology service or any fetched list.
- Conditions on members or anyone but the care recipient.
- Reminders or care plans per condition, and condition-specific vitals targets.
- Turning existing free-text medication reasons into conditions automatically.
- Native (Capacitor) specifics beyond what the shared routes already do.

## Further Notes

- All seed data is fictional: the seeds give Dev Family's recipient a few active and one resolved condition, linked to seeded providers and medications.
- Compliance: conditions are health data; nothing new leaves the app except through a member's own connector, which the consent text covers.
- The curated suggestion list lives in the repo as a plain data file; wording is everyday language, not clinical terms.
