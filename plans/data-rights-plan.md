# Plan: Data rights

> Source PRD: [`plans/data-rights-prd.md`](data-rights-prd.md). User-story numbers (US) refer to it. Items B-84, B-357, B-53 (the group half). Topic `data-rights`.

## Status

### From the user

- 2026-11-28 (relayed by the backlog session), asked to switch sessions to the personal account: "Yes, switch now"

**Landing mode:** run everything through (start every ready slice, land each green wave, ask only real questions via `risa ask`).

**Where it stands:** wave 1 landed in dev 2026-11-28 (PR #341, run 46177793758; to-test `2026-11-28-1355-data-rights.md`). **Wave 2 (2026-11-28):** slice 5 (B-357) built on **opus**, merged `40be45d26`; full-tier gate run 46179659218 braked: 2 integration failures (groups.int access codes, roles.int audit log), both the branch's; tests' old expectations; fix bf3ffd351 merged (`3859f5c03`); rerun 46180632079 green on f8b7daa5. Slice 5 worktree removed. `risa sync --force` (pr refused an unsynced tip) merged dev `72b86bc3a` (no migration clash); components recheck running. Browser `--changed`: invites.spec FAIL (8m54s, on a stale server: serve wasn't restarted), rerunning alone after a restart and datastore reset Slice 5 notes: the inviter's version column is `consent_attested_version` (`consent_version` already exists, the joiner's); a link's consent row is written at `requestWithLink`, not `approve`; a joiner still reads their own consent row after the group goes. Sync before it: no merge needed. Then wave 3 = slice 6 (B-53 group half). Follow-ups for this topic: B-1049 (a deleted pass's name blank in the connector's `listMedications`), B-1053 (a note upload racing a delete keeps content). Lesson for the next plan: slices 1 to 3 ran 14 to 21 files, past the hook's 12.

**Open:** slice 3 saw a scrubbed (empty-name) place drop out because `toProvider` returned null; slice 2's `toProvider` now keeps a deleted row with no name, so check at the wave gate that a scrubbed place reads "Removed place" (and `toMedication` likewise) before filing a follow-up. Slices 2 (21 files) and 3 (14) passed the file-count warning: note for the next plan.

| Slice | Wave | State       | Merge into `prd/data-rights` (slice commits) |
| ----- | ---- | ----------- | -------------------------------------------- |
| 1     | 1    | landed      | `acdee49b7` (4b41a05d2..5ee4f0e4c), mig 0051 |
| 2     | 1    | landed      | `288ff6273` (2677eadb0, e4cf04280)           |
| 3     | 1    | landed      | `bfcdf7504` (60e80fbe7..f0745418d)           |
| 4     | 1    | landed      | `9a7856062` (4b511c986)                      |
| 5     | 2    | merged      | `40be45d26` (e959f31a6, 9091b891c), mig 0052 |
| 6     | 3    | not started |                                              |

**Backlog:** claim each slice's item when it starts. Run `pnpm backlog done` for B-84 after slices 1 to 4 and for B-357 after slice 5. B-53 stays open after slice 6 with a note: its account half is `data-rights-2`'s.

## Architectural decisions

Durable decisions every slice follows:

- **One scrub spec** (pure, client-safe, in the data layer) says what a delete clears, per table, including the change entries that summarize a row. The trigger SQL is written to match it, and tests tie it to the upload registry and the live triggers. Nothing else decides what a delete keeps.
- **Whatever brings a deleted row back supplies its content.** A scrubbed row has none to return to.
- **Deletion is server work:** online only, through the services, as `system` in one transaction. Work outside the database (Google) runs after commit and never blocks.
- **Evidence never cascades** after slice 4: consent (with its attestation), legal acceptance and the audit log keep bare ids. Invites still go with their group, since they hold addresses.
- **Migrations:** slices 1 and 4 each add one, in different waves, so only one is pending at a time. Say "adds a migration"; take the next number when it lands.
- **No new dependency, no new synced table.**
- **Loops don't edit docs.** At landing the orchestrator folds the rules into [care-groups](../docs/domain/care-groups.md), [data-layer](../docs/domain/data-layer.md), [sync](../docs/domain/sync.md), [timeline](../docs/domain/timeline.md) and [medications](../docs/domain/medications.md). It also writes the answered last-owner rule into care-groups, for `data-rights-2`.

## How to run this plan

- **Waves:** (1, 2, 3, 4) → 5 → 6.
- **Gates:** each slice hands off on `pnpm prd check --quick "slice hand-off"`. Wave gates are quick checks, plus the named browser check for a slice with `e2e:`.
- **Ownership:**
  - slice 1: the scrub spec, triggers, backfill and restore paths;
  - slice 2: removed names for providers;
  - slice 3: removed names for places and todo links;
  - slice 4: removed names for medications and conditions;
  - slice 5: the evidence migration and the attestation on consent;
  - slice 6: deleting a group.
- **Beside other topics:**
  - **Running now:** slices 2 and 4 touch `fixes-ui`'s hot `components/entry/`, and slice 4 its `routes/app/groups/timeline/` (the dose page). If a `fixes-ui` wave holds those files when this topic starts, run those slices after it lands.
  - **Planned, not running:** `routes/app/groups/entry/`, `todo/`, `todos/`, `lib/todos/` and the `todoService` are hot for `tags` and `todo-subtasks`. If either is running when slices 1 to 4 start, the orchestrator runs this topic's slices touching them after that wave.
  - **Shared registries:** append only.

---

## Slice 1: A delete scrubs, everywhere

Stack: yes · Reads: docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/timeline.md, docs/domain/live-notes.md, docs/domain/todos.md · Tests: unit, integration, e2e:roundtrip

**Backlog:** B-84. **User stories:** 1, 2, 4, 5.

### What to build

- **The scrub spec** for the nine soft-delete tables and the dependent change entries, with the schedule history carve-out (_Implementation decisions_, **Scrub rules**).
- **One migration** of hand-written triggers that clear the spec's columns, the change entries' summaries and the live-note tables. The same migration scrubs every row already deleted (**The scrub migration**).
- **Restore paths:** `todoService.restoreOccurrence` passes content to `todoModel.restore` (`insertNext` already does), and the device's restore in `lib/todos/` sends every content column.
- **Unchanged:** the models. A soft delete still only sets `deleted_at`, and the trigger does the rest.

### Acceptance criteria

- [ ] Unit: every upload-registry content column has a rule, and every rule names a real column. Every scrubbed value meets the column's NOT NULL and CHECK constraints.
- [ ] Integration:
  - for each table, a soft delete through the service and through a sync upload leaves only the tombstone columns;
  - a deleted entry's, provider's and medication's document is empty and its updates are gone;
  - a deleted medication's and condition's change entries lose their summaries;
  - deleting a dose log or a change line of a live medication leaves its past schedule and missed-dose counts unchanged (the carve-out);
  - a restored dose and a restored todo occurrence carry their content;
  - rows deleted before the migration are scrubbed;
  - the live triggers match the spec (drift).
- [ ] e2e (`roundtrip`, one step): a writer deletes a note. After sync, the second device's local row has no title or body.

**Blocked by:** none. **Blocks:** 5 (migration order).

---

## Slice 2: Removed names: providers

Stack: no · Reads: docs/domain/providers.md, docs/domain/medications.md, docs/domain/profiles.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-84. **User stories:** 3.

### What to build

A deleted provider or practice reads "Removed provider" wherever it's named today with "(removed)" (**Removed names on screens**, _Providers_):

- the helpers `entryProviders` and `providerPicker`;
- the With row, the two provider pickers and the provider header's practice;
- `MedicationProviders`, `ConditionProviders` and `conditionProviders.sync`.

The wording works on scrubbed rows and on rows deleted before slice 1 reaches a device.

### Acceptance criteria

- [ ] Unit: each helper gives the removed wording for a deleted row and the name for a live one.
- [ ] Component: an entry, a medication and a condition linked to a deleted provider show "Removed provider", greyed, not a link; a picker with a deleted choice does too.

**Blocked by:** none. **Blocks:** none.

---

## Slice 3: Removed names: places and todo links

Stack: no · Reads: docs/domain/care-periods.md, docs/domain/todos.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-84. **User stories:** 3.

### What to build

A deleted place reads "Removed place", and a todo link to a deleted item reads "Removed item" (**Removed names on screens**, _Places and todo links_). The places are `periodPlaces`, `PeriodList`, `PeriodPlace`, `TodoLinks` and `todoLinks`.

### Acceptance criteria

- [ ] Unit: `periodPlaces` and `todoLinks` give the removed wording for a deleted row and the name for a live one.
- [ ] Component: a period at a deleted place and a todo linked to a deleted entry show the removed wording.

**Blocked by:** none. **Blocks:** none.

---

## Slice 4: Removed names: medications and conditions

Stack: no · Reads: docs/domain/medications.md, docs/domain/profiles.md, docs/domain/timeline.md, docs/domain/appointments.md, docs/domain/components.md · Tests: unit, component

**Backlog:** B-84. **User stories:** 3.

### What to build

A deleted medication or condition reads "Removed medication" or "Removed condition" (**Removed names on screens**, _Medications and conditions_). The places are:

- `MedicationEntryText` and the entry body's "with …";
- the dose page (`timeline/pass`), `medicationEntries` and visit prep;
- `medicationConditions.sync`;
- the change-row text in `entryDisplay`, which shows "Removed medication changed" when a summary is empty.

### Acceptance criteria

- [ ] Unit: the change-row text for a scrubbed summary; the medication and condition labels for deleted and live rows; visit prep's line for a deleted medication.
- [ ] Component: a dose of a deleted medication, on the timeline and on its page, and its change entry show the removed wording.

**Blocked by:** none. **Blocks:** none.

---

## Slice 5: Consent evidence survives deletion

Stack: no · Reads: docs/domain/care-groups.md, docs/domain/auth.md, docs/domain/admin.md, docs/domain/data-layer.md · Tests: integration

**Backlog:** B-357. **User stories:** 9.

### What to build

- **One migration** (**Evidence survives deletion**):
  - adds the attestation columns to `care_group_consent` and backfills them from the invites;
  - drops the evidence foreign keys, keeping the bare ids.
- **Writers of the new columns:** `careGroupInviteService.accept` and `joinRequestService.approve`.

### Acceptance criteria

- [ ] Integration:
  - an email join copies the attestation onto the consent row, a link approval copies whatever the link carries, and the backfill fills existing rows;
  - deleting a user row (as `system`) keeps their consent, legal acceptance and audit rows with the bare id;
  - deleting a group row keeps its consent rows with the attestation, while its invites go;
  - a member can't read an orphaned row, and staff with `audit.read` can;
  - connector grants still go with the account.

**Blocked by:** 1 (migration order). **Blocks:** 6.

---

## Slice 6: Delete a care group

Stack: yes · Reads: docs/domain/care-groups.md, docs/domain/calendars.md, docs/domain/connectors.md, docs/domain/notifications.md, docs/domain/sync.md, docs/domain/app-shell.md · Tests: integration, component, e2e:app-shell

**Backlog:** B-53 (group half). **User stories:** 6, 7, 8.

### What to build

- **The service and procedure:** `careGroupService.remove` and `careGroup.delete` (**Deleting a group**). The inner step is exported for `data-rights-2`.
- **The card:** Group settings → Details gets an owners' "Delete care group" card, with a confirm that asks for the group's name. Afterwards the device goes to `/app`.

### Acceptance criteria

- [ ] Integration:
  - an owner's delete empties every care table for the group, and its invites are gone;
  - assistant grants are revoked;
  - every member's Google connection is revoked after commit (the fake client), and a Google failure still deletes the group;
  - pending outbox rows are skipped with `groupDeleted`;
  - consent and audit rows are kept;
  - an admin and a wrong name are refused;
  - the router has one pass-through test.
- [ ] Component: the card shows for owners only. Delete stays disabled until the name matches, and success opens `/app`.
- [ ] e2e (`app-shell`, one step): an owner makes a fresh group and adds the second device's member. Deleting it removes the group from that device on the next sync.

**Blocked by:** 5. **Blocks:** none (`data-rights-2`'s account deletion).
