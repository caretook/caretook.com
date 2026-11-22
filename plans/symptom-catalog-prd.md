# PRD: Symptom catalog

Backlog item: B-549. Topic `symptom-catalog`.

## Decisions

| Decision                                                                                                                            | Why                                                                                                       | Source                | Cost to change later                                    |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------- |
| A catalog row's id is a version 5 UUID of its group and folded name                                                                 | two offline devices adding "Nausea" land on one row, with no merge step; the prior art is `seriesVisitId` | assumed               | high: ids are stored on entries                         |
| One catalog per group (`symptom_type`), the defaults copied into each group                                                         | fits the group-scoped streams and RBAC; no global table to sync                                           | assumed               | high: a migration and a resync                          |
| Entries keep `details.name` as written and gain a nullable `symptom_type_id`                                                        | no existing wording changes, old devices keep working, the change stays additive                          | assumed               | medium: dropping the name is a later contract migration |
| The server derives `symptom_type_id` from `details.name` on every write and ignores a device's value                                | old devices, quick entry, connectors and uploads can't disagree                                           | assumed               | medium                                                  |
| The backfill folds only case and spaces: "knee pain" and "Knee Pain" are one type, "knee ache" stays its own                        | never merges two things a person wrote differently                                                        | assumed               | medium: a wrong merge is hard to separate               |
| The backfill is an idempotent step in `pnpm datastore:migrate`, in TypeScript, and doesn't touch `updated_at` or `updated_by`       | SQL can't produce the same ids without a new extension; an edit made on a device still wins               | assumed               | medium                                                  |
| Everyone who can log (owners, admins, caretakers, Easy helpers) may add a symptom; viewers can't                                    | Easy helpers can log any symptom name today, and a refused log would lose a care observation              | asked: as recommended | low: one permission                                     |
| No rename, merge or delete of catalog rows in this topic                                                                            | the item doesn't ask for them; ids and names stay stable                                                  | assumed               | low: a follow-on topic                                  |
| Connectors reuse an exact match and otherwise add the name, with no similar-name gate                                               | an AI tool call has no person to answer a prompt, and a refused log loses care information                | assumed               | low                                                     |
| Default set: the 23 names under _Implementation decisions_                                                                          | common caretaking symptoms, including quick entry's "Fall"                                                | assumed               | low: the backfill step adds new defaults                |
| Similar means the same words in any order, one name's words inside the other's, or a small typo distance; at most three suggestions | catches duplicates without a dependency, and works offline                                                | assumed               | low: one pure function                                  |
| The gate is inline in the sheet: "Use <name>" or "Add new"                                                                          | the smallest step that stops a duplicate                                                                  | assumed               | low                                                     |
| The name field is a native input with a `datalist`                                                                                  | native elements come first                                                                                | assumed               | low                                                     |
| Several symptoms filter as "any of", `?symptom=<id>` repeated, only under the symptom kind                                          | mirrors `?vital=`; "all of" can't match a one-symptom entry                                               | assumed               | low                                                     |
| The filter lists only types the group has live entries of                                                                           | mirrors the vital-type filter, and keeps the sheet short                                                  | assumed               | low                                                     |

**Skeptic pass:** seven findings, all accepted, none declined and none moved to a question. Seeds now run the backfill; the Easy form gets the picker and gate; the logger permission moved to slice 1; slice 1 adds the sync-matrix row; the filter reads only the stored pointer; predictions belong to slice 6 alone, and the topic runs after `dose-accuracy` too; the backfill preserves `updated_at` explicitly and skips soft-deleted names.

## Problem

A symptom's name is free text. One recipient's nausea can be "Nausea", "nausea " and "nauseous", so a caretaker can't reliably see every time it happened, and each person retypes names the group already uses. The timeline can show symptoms, but can't narrow to the two or three a caretaker is watching.

## Solution

Every group has a symptom catalog from the start, filled with a common default set. Logging a symptom means picking from it or quickly adding a new one; when the new name looks like an existing one, the app offers the existing one first. Existing entries are linked to the catalog with their wording unchanged. The timeline can filter by several symptoms at once. All of it works offline.

## User stories

1. As a caretaker in a new group, I want common symptoms already available, so that I can log without typing a full name.
2. As a member of an existing group, I want the same default set, plus the names we've already used, so that the catalog reflects our history.
3. As a caretaker, I want to pick a symptom as I type, so that logging is quick and spelled the same each time.
4. As someone who may add symptoms, I want to add a new one in the same sheet without a separate setup step, so that logging isn't interrupted.
5. As someone adding a symptom, I want to be shown similar existing symptoms before it's added, so that the group doesn't collect duplicates.
6. As someone adding a symptom that really is different, I want to add it anyway in one tap, so that the check never stops me logging.
7. As a caretaker offline, I want picking and adding to work, and two devices adding the same name to end up with one symptom, so that offline use doesn't create duplicates.
8. As a caretaker using quick entry, I want a typed symptom matched to the catalog, and to be offered a similar one, so that the fast path keeps the catalog clean too.
9. As a member using a connected AI assistant, I want a logged symptom to join the catalog, so that its entries filter and group like any other.
10. As a caretaker, I want to filter the timeline by several symptoms at once, so that I can follow related symptoms together.
11. As a caretaker preparing for a visit, I want visit prep and day summaries to group by symptom, so that the same symptom isn't counted as two.
12. As a member, I want my past entries to read exactly as they were written, so that the record isn't rewritten.

## Implementation decisions

- **The symptom catalog module** (pure, client-safe, in the timeline schema area): the one home for `symptomKey(name)` (trim, collapse spaces, lower-case in `en-US`), `symptomTypeId(groupId, name)`, `DEFAULT_SYMPTOMS` and `similarSymptoms(name, catalog)` (returns an exact match, or up to three similar names). The device, server and backfill all call it. The separate folds in day summaries, visit prep and quick-entry predictions move onto `symptomKey`.
- **Default set:** Pain, Headache, Nausea, Vomiting, Dizziness, Fatigue, Shortness of breath, Cough, Fever, Chills, Constipation, Diarrhea, Loss of appetite, Trouble sleeping, Confusion, Anxiety, Low mood, Agitation, Swelling, Rash, Itching, Numbness or tingling, Fall.
- **Table `symptom_type`:** `id`, `group_id` (cascade with the group), `name` (the first spelling, capped at the existing symptom-name limit), `name_key`, `timestamps`, `audits`. Unique on `(group_id, name_key)` and on `(group_id, id)`. No soft delete, since rows are never removed in this topic.
- **`timeline_entry.symptom_type_id`:** nullable, with a composite foreign key on `(group_id, symptom_type_id)` so an entry can't point into another group. Set only on symptoms, and an index supports the filter.
- **Permissions on `symptom_type`:** read and list for any group role; create for `LOGGERS`; no update or delete for anyone but the system.
- **Catalog service:** `ensure(ctx, groupId, name)` inserts or returns the row by key, idempotently, inside the caller's transaction, under the actor's own context. `addDefaults(tx, groupId)` runs in all three group-creation paths (members, access codes, staff).
- **Entry writes:** `timelineEntryService` create and update resolve the catalog row from `details.name` for symptoms. Assistant actions and connectors go through it, so they need no separate path.
- **Sync:** `symptom_type` joins the `care_groups` stream for every role, and `symptom_type_id` joins the entry query. Upload accepts PUT on `symptom_type` (idempotent; other ops are read-only). `symptom_type_id` on an entry is server-set.
- **Backfill step:** one exported idempotent function, run by `datastore:migrate` after SQL migrations and again as the last step of seeding (seeds insert groups directly, after migrate has run). It adds missing defaults to every group, creates a type for each distinct key in **live** symptom entries, and fills their null pointers, in batches, keeping `updated_at` as it was (Drizzle's `$onUpdate` would otherwise bump it). A soft-deleted entry adds no name, because this topic has no way to remove one from the picker; its pointer stays null until it's written again. A rerun changes nothing. An entry whose name can't be read stays null and is logged.
- **Null pointers:** rare after the backfill (an entry the old server writes between the migrate step and the new deploy, healed by the next migrate). JavaScript readers (summaries, visit prep, predictions) group by `symptomKey(name)`, so they need no pointer. The timeline filter is SQL on paged windows and matches the stored pointer only.
- **The Easy form:** the feelings form's optional "What's wrong?" field gets the same suggestions, exact-match reuse and inline gate. Left empty, it saves "Feeling" as today, with no gate; "Feeling" is an ordinary type added on first use, not a default.
- **Timeline filters:** `timelineFilters` gains a list-valued `symptoms` filter with the same rules as `vital`: ignored unless the kind is symptom, unknown values dropped, changing the kind clears it.

## Testing decisions

- **Unit:** the catalog module (keys, stable ids, similar and exact matches, the cap), `timelineFilters`, day summaries and visit prep, quick entry's matching. Prior art: `repeatRule.test.ts`, `timelineFilters.test.ts`.
- **Integration:** defaults on all three creation paths, the backfill (idempotent, wording and `updated_at` unchanged, case variants joined), the write path with a stale or missing pointer, a cross-group pointer refused, role checks on upload, connector logging. Prior art: `syncConditions.int.test.ts`, `roles.int.test.ts`.
- **Component:** the symptom sheet's pick, gate and add; the filter sheet's multi-select; the quick-entry card. Prior art: `timelineSheets`, `timelineFilters` and `timelineQuickEntry` browser tests.
- **End to end:** one step in the existing `roundtrip` check: two clients add the same new symptom and converge on one catalog row. No new check.

## Out of scope

- Renaming, merging, hiding or deleting catalog rows, and any catalog management screen.
- Rewriting the wording of past entries, or dropping `details.name` (a later contract migration).
- Global tags (the `tags` topic), and symptom charts or trends.

## Notes

- Quick entry's parser files are in `quick-entry-2`'s scope, and `dose-accuracy` changes the entry service, the assistant runner and visit prep, so this topic runs after both.
- All seed and test data stays fictional. No new vendor or dependency is involved; catalog names travel in the same group bucket as the entries they came from, and are removed with the group.
