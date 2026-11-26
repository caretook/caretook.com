# PRD: Data rights (deletion that removes, consent evidence that stays, deleting a care group)

Topic `data-rights`. Items: B-84, B-357, and the group half of B-53. The account half of B-53, B-565, B-52, B-356, B-358, B-562 and B-831 go to the follow-on topic `data-rights-2` (_Out of scope_).

## Decisions

The costliest to change first.

| Decision                                                                                                                                                                                                                                              | Why                                                                                                                                  | Source                                                  | Cost to change later               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------- |
| A delete scrubs at once: entries lose title, text, details and live notes; providers, medications, conditions and places lose everything, names too ("Removed medication"); rows already deleted are scrubbed by the migration                        | a medication's or provider's name can be health data; matches "permanently removed" on the privacy page; no undo-after-delete exists | asked: as recommended                                   | high: content is gone for good     |
| Consent, legal acceptance, the invite's consent attestation and the staff audit log survive an account or group deletion, keeping bare ids, versions and times (no name, email or health data) until a retention period; a later topic purges past it | proof of consent outlives the person who gave it; nothing health-related is kept                                                     | asked: as recommended                                   | high: deleted rows can't come back |
| The attestation is copied onto the consent row (attester id, time, version) at join, and backfilled from the invites, so the invite (which holds an email) can still go with its group                                                                | keeps the evidence without keeping an address                                                                                        | assumed                                                 | high: a migration                  |
| A deleted dose log keeps its slot and time, and a deleted medication-change line keeps only its schedule (times, dose amounts, no name) while the medication is live; both lose everything when the medication is deleted                             | schedule history and missed-dose counts read them on purpose                                                                         | asked: as recommended (a243, after two plan send-backs) | high: past schedules               |
| Deleting a medication or condition also scrubs the summaries in its change entries (name, strength, form, dose, directions, schedule), leaving "Removed medication changed"                                                                           | "names too" would otherwise leak through the timeline                                                                                | assumed                                                 | high: content is gone for good     |
| A last owner deleting their account is blocked until each shared group is handed over or deleted (built in `data-rights-2`)                                                                                                                           | the user's answer                                                                                                                    | asked: as recommended                                   | high                               |
| The scrub is a Postgres trigger on every soft-delete table and the live-note tables, written by hand in the migration, held to a pure spec by a drift test                                                                                            | every write path (sync upload, connectors, staff, future code) scrubs alike; one migration                                           | assumed                                                 | medium: a migration to replace     |
| Deleting a group is online only (oRPC) and owner only (the existing `care_group` delete permission)                                                                                                                                                   | deletions are server work; the permission map already says so                                                                        | preference                                              | low                                |
| Deleting a group disconnects each member's Google Calendar as leaving does (revoked after commit; Caretook's calendar stays in their Google account); removing that calendar is later work                                                            | the client seam has no calendar delete                                                                                               | assumed                                                 | low                                |
| Confirming a group delete means typing the group's name                                                                                                                                                                                               | hard to do by accident                                                                                                               | assumed                                                 | low: UI                            |
| Hand-over, account deletion, export, staff tooling, legal text, legal-change notice and the inactive-group scrub move to `data-rights-2`                                                                                                              | a PRD stays about six slices                                                                                                         | preference                                              | low: a row move                    |

Skeptic (plan, send-back s49), what changed: the attestation now survives a group delete (copied onto the consent row); change entries of a deleted medication or condition are scrubbed; the removed-names work is three slices with the full list of places (after the second skeptic, s51); todo restore paths and CHECK constraints are in slice 1; the hot files are complete; hand-over and account deletion (and the open "Former member" and invite-email points the skeptic raised about them) moved to `data-rights-2`, whose planner asks the "entries of a deleted account stay with the group" rule as a compliance question.

## Problem

A caretaker who deletes a wrong or sensitive entry expects it gone. Today it stays, whole, on the server and on every member's device (security review S-1), and a deleted medication's name lives on in its change entries. Nobody can delete a care group: only a hand-written database delete could, which would take the record of who consented with it and leave Google tokens live.

## Solution

Deleting anything scrubs it: its content is cleared on the server, sync clears it from every device, and only a tombstone remains (id, group, kind, times, who deleted it). Screens name what's gone "Removed provider", "Removed medication" and the like. Owners can delete a whole care group from its settings. Consent and acceptance records survive, detached and without health data or addresses, until their retention period ends.

## User stories

1. As a caretaker, I want a deleted note to be gone from every member's phone, so that a sensitive mistake doesn't linger.
2. As a caretaker, I want a deleted provider, medication or condition cleared everywhere it was named, its change history included, so that the timeline no longer shows it.
3. As a member, I want history that pointed at a deleted provider, place, todo link, medication or condition to say "Removed …", so that the timeline still reads cleanly.
4. As a member, I want entries deleted before this change scrubbed too, so that the promise covers old data.
5. As a member, I want a deleted todo occurrence I restore to come back with its title, so that restoring still works.
6. As an owner, I want to delete our whole care group, so that its records are removed for everyone when the family is done.
7. As a member of a deleted group, I want it to disappear from my device on the next sync, so that nothing is left behind.
8. As a member with Google Calendar or an AI assistant connected, I want Caretook to stop acting for a deleted group, so that nothing reaches into a group that is gone.
9. As the company, I want proof of who consented to what, and who attested the invite, to survive deletion without health data or addresses, so that we can show consent was given.

## Implementation decisions

- **Scrub rules** (pure, client-safe, in the data layer). There is one spec per soft-delete table: `timeline_entry`, `provider`, `medication`, `medication_pass`, `recipient_allergy`, `recipient_condition`, `care_period`, `todo` and `appointment_series`.
  - **What a scrub clears:** each spec names the columns and what each becomes: null, empty text, an empty JSON value, or a value that satisfies the column's NOT NULL and CHECK constraints (such as `todo_repeat_due_check`, where `repeat_rule` needs `due_on`, and `appointment_series_time_check`). Names go too.
  - **What stays:** id, group and recipient ids, kind or type, status, the times, audits, and the ids other rows point at.
  - **Schedule history carve-out** (the user's answer to the twice-sent-back plan, a243): a deleted dose log (`medication_pass` and dose entries) keeps its slot and time, and a deleted `medicationChange` line keeps only its schedule (times and dose amounts, no name, strength, form or directions) while its medication is live. `scheduleHistory`, `dueDoses` and visit prep read those on purpose. Once the medication itself is deleted, they lose everything.
  - **Dependent summaries:** the spec also names the change entries whose details summarize a scrubbed row (`medicationChange` and `conditionChange`, by the id in their details). Their summary fields are cleared too.
  - **The unit test** reads the upload registry's `content` lists and fails when a content column has no rule or a rule names no column.
- **The scrub migration:** hand-written trigger functions, one per table, `BEFORE UPDATE` when `deleted_at` goes from null to set, clearing the spec's columns.
  - **The medication and condition triggers** also clear their change entries' summaries.
  - **Live notes:** the entry, provider and medication triggers clear their `note_document`'s `snapshot`, `text` and `editors` and delete its `note_update` rows.
  - **Existing rows:** the same migration scrubs every row already deleted.
  - **Drift:** an integration test reads the live trigger definitions and compares them with the spec.
  - **Restore paths:** each path that brings a deleted row back must supply content.
    - `timelineEntryModel.restore` and the dose upload path already do.
    - `insertNext` already passes the next occurrence's content: leave it.
    - `todoService.restoreOccurrence` calls `todoModel.restore` with no content and relies on the device's PATCH. It now passes the row's content from the request, and the device's restore (`lib/todos/`) sends every content column.
  - **Sync:** a hard delete still cascades, and devices receive the scrubbed row through the `care_groups` stream as an ordinary update.
- **Removed names on screens:** every place that now appends "(removed)" to a deleted row's name reads "Removed provider", "Removed place", "Removed medication" or "Removed condition" instead, never the now-empty name.
  - **Providers:** `entryProviders`, `providerPicker`, the With row (`EntryWithRow`), the provider pickers (`ProviderPickerField`, `ProvidersPickerField`), the provider header's practice, `MedicationProviders`, `ConditionProviders`, `conditionProviders.sync`.
  - **Places and todo links:** care-period places (`periodPlaces`, `PeriodList`, `PeriodPlace`), `TodoLinks` and `todoLinks`.
  - **Medications and conditions:** `MedicationEntryText`, the entry body's "with …" (`EntryBody`), the dose page (`timeline/pass`), `medicationEntries`, visit prep, `medicationConditions.sync`, and the change-row text (`entryDisplay`), which shows "Removed medication changed" when a summary is gone.
- **Evidence survives deletion:**
  - **Attestation on the consent row:** `care_group_consent` gains the invite's attestation (`consent_attested_by`, `consent_attested_at`, `consent_version`), copied from the invite whenever it has one (email invites carry it; a link invite may carry none, and then the columns stay null), written by `careGroupInviteService.accept` and `joinRequestService.approve` and backfilled from the invites by the migration.
  - **Foreign keys dropped:** the migration drops them from `care_group_consent.group_id` and `.user_id`, `legal_acceptance.user_id`, and `admin_audit_log.target_user_id` and `.target_group_id`, keeping the bare ids.
  - **What still cascades:** invites go with their group (they hold addresses), and `connector_grant` still cascades (a grant is access, not evidence).
  - **Reads of orphaned rows:** a consent row whose group is gone matches no group rule and a legal acceptance whose account is gone has no owner, so the existing permission map leaves both to `system` and staff with `audit.read` already. A test pins it.
- **Deleting a group:** `careGroupService.remove(ctx, { groupId, confirmName })`, owner only.
  - **In one transaction as `system`:**
    - lock the group and check the name;
    - revoke every assistant grant (`revokeForGroup`);
    - disconnect every member's Google connection (`disconnectForMember`: revoked after commit, logged, never blocking);
    - mark the group's pending outbox rows `skipped` (error `groupDeleted`);
    - record `group.deleted` in the audit log (the owner as actor, the bare group id, no content);
    - hard-delete the group, and everything cascades except the evidence.
  - **For `data-rights-2`:** the inner step is exported so account deletion can reuse it.
  - **Procedure:** `careGroup.delete`.
  - **Screen:** Group settings → Details gets a "Delete care group" card for owners, a confirm that asks for the group's name. Afterwards the device goes to `/app`, and the next sync drops the group's buckets.
- **No new dependency.** No new synced table. The scrub changes no stream query: scrubbed columns sync as empty.

## Testing decisions

- **Unit:** the scrub spec against the upload registry's content columns and the tables' constraints; each removed-name label helper.
- **Integration** (services, `createWorld`; prior art `timelineEntry.int.test.ts`, `todoRepeat.int.test.ts`, `careGroupMember.int.test.ts`, `connectorGrant.int.test.ts`, `googleCalendar.int.test.ts` with the fake Google client):
  - **Scrub:**
    - a soft delete of each table, through the service and through a sync upload, leaves only the tombstone columns;
    - a deleted entry's document is empty and its updates are gone;
    - a deleted medication's and condition's change entries lose their summaries;
    - deleting a dose log or a change line of a live medication leaves its past schedule and missed-dose counts unchanged;
    - a restored dose and a restored todo occurrence carry their content;
    - rows deleted before the migration are scrubbed;
    - the live triggers match the spec (drift).
  - **Evidence:** consent rows carry the attestation for new joins and for the backfill. Deleting a user or a group as `system` keeps consent, legal acceptance and audit rows with bare ids, and the attestation survives a group delete. A member can't read an orphaned row.
  - **Group delete:**
    - every care table is empty for the group, and its invites are gone;
    - grants are revoked;
    - Google is revoked after commit, and a Google failure still deletes;
    - outbox rows are skipped;
    - a non-owner and a wrong name are refused;
    - the router keeps one pass-through test (`clientFor`).
- **Component:** the removed wording on every screen listed; the Details delete card (prior art `groupSettings.browser.test.tsx`).
- **End to end:** only the flows across server and sync.
  - `roundtrip`: one step, a deleted note's text gone from the second device's local copy.
  - `app-shell`: one step, a fresh group deleted by its owner leaves a member's device. This closes [sync](../docs/domain/sync.md)'s "untested end to end".

## Out of scope

To `data-rights-2` (to write, after this topic):

- ownership hand-over (B-565);
- account deletion, the account half of B-53. It follows the asked rule: a last owner is blocked until hand-over or group deletion, and a sole-member group goes with the account. It also reuses group deletion's inner step. Its planner asks whether a deleted account's entries stay with the group as "Former member", and covers the invites and outbox rows that hold the account's address.
- export (B-52);
- staff tooling for deletion requests (B-356);
- legal pages that promise only what's built, with the placeholders the user fills (B-358);
- notice before a material legal change (B-562);
- the inactive-group scrub (B-831);
- the retention sweep for kept evidence and tombstones;
- removing Caretook's calendar from members' Google accounts on delete (a `deleteCalendar` on the client seam).

Also out: import, a restore-after-delete feature, and backups (Neon's retention is the user's to set, hosting).

## Notes

- Security review S-1 is closed by slices 1 to 4.
- The privacy draft still says deletion means writing in. `data-rights-2` rewrites it (B-358). Until then the claim is narrower than what's built, which is allowed.
- AGENTS.md's open question on a last owner deleting their account is answered (the second asked row). The orchestrator moves it into [care-groups](../docs/domain/care-groups.md) at landing, as the rule `data-rights-2` builds.
