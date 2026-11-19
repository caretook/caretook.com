# Plan: Profiles

> Source PRD: [`plans/profiles-prd.md`](profiles-prd.md) (B-45, B-46). Topic `profiles`.

## Status

| Slice | State               | Merge into `prd/profiles` (slice commits) |
| ----- | ------------------- | ----------------------------------------- |
| 1     | not started (ready) |                                           |
| 2     | blocked by 1        |                                           |
| 3     | blocked by 2        |                                           |
| 4     | blocked by 1        |                                           |
| 5     | blocked by 3 and 4  |                                           |
| 6     | blocked by 5        |                                           |

Backlog: B-45 and B-46 are `triaged`. Claim both when slice 1 starts; mark B-45 `done` after slice 3 merges and B-46 after slice 5 (or both after slice 6). The PRD and this plan are on `plan/profiles` until they land in `dev`.

## Architectural decisions

Durable decisions every slice follows:

- **Routes** (children of the group route `/app/groups/:groupId`, built through `appUrls`):
  - `profile`: the recipient's profile page (not a group section; no tab-bar entry). `appUrls.profile(groupId)`.
  - Edit sheets as children of the profile (the routing sheet pattern): `profile/basics`, `profile/contact`, `profile/insurance`, `profile/emergency`.
  - `profile/print`: the emergency sheet (writers only; anyone else is redirected to the profile).
  - Account settings gains a **Contact details** subpage (`ACCOUNT_SETTINGS`, `appUrls.settings("contact")`).
- **Visibility** (one pure, client-safe module; screens, services and tests all use it):

  | What                                                            | Read                       | Edit                                    |
  | --------------------------------------------------------------- | -------------------------- | --------------------------------------- |
  | Name, preferred name, birthday, basics, the note for helpers    | every member               | owners, admins, caretakers              |
  | Recipient's phones, email, address, insurance, outside contacts | owners, admins, caretakers | same (outside contacts: owners, admins) |
  | Emergency rank and primary contact on members                   | every member               | owners, admins                          |
  | A member's contact details (account)                            | that member                | that member                             |
  | A member's shared fields and relationship (per group)           | every member of the group  | that member                             |

- **Schema** (one pending migration for the PRD, made in slice 1; regenerate on top if a sync brings in another):
  - `care_recipient` + `code_status` (`fullCode | dnr | dnrPolst`), `blood_type` (eight values), `primary_language`, `pronouns`; the existing `notes` is the note for helpers (length-limited) and becomes synced.
  - `care_recipient_details` (1:1, unique `group_id`, composite FK to the recipient, cascading): `phones` jsonb (≤ 6, the providers' shape), `email`, `address`, `insurance` jsonb (≤ 6: `id`, `rank`, `insurer`, `planName?`, `memberId`, `groupNumber?`, `phone?`), `outside_contacts` jsonb (≤ 10: `id`, `name`, `relationship?`, `phone`, `emergencyRank?`). Viewers `none` in `PERMISSIONS`.
  - `care_group_member` + `relationship`, `shared_fields` (`phones | email | address`, default empty), `emergency_rank` (nullable), `is_primary_contact` (one per group, partial unique index).
  - `user_contact` (1:1 with the user: `phones`, `contact_email`, `address`), self only, never replicated.
  - `member_contact_share` (one row per membership: only the shared values), written only by the services in the same transaction as any change to contact, sharing or membership; read by any member of the group.
- **Sync:** `care_groups` gains the new recipient and member columns and `member_contact_share`; a new `care_group_writers` stream carries `care_recipient_details` for groups where the user is owner, admin or caretaker. None of these tables are in the upload switch: **every profile write is online only**, through oRPC, with controls disabled offline (as group settings do).
- **API:** extended `careGroup.updateRecipient`; new `careGroup.recipientDetails`, `updateRecipientDetails`, `updateOutsideContacts`, `setEmergencyContacts`, `setPrimaryContact`, `updateMySharing`; `me.contact`, `me.updateContact`. Non-members get not-found, the wrong role a 403; public member profiles never include the sign-in email.
- **Emergency order** is one sequence across members and outside contacts; the service renumbers on every change. Only members sharing phones can be on it; a member who stops sharing phones loses rank and primary.
- **Print:** the emergency sheet reuses the medications sheet's print CSS and `print:hidden` frame, built by a pure builder from local data only.
- **Shared files** (additive only): `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the device schema, `routes.ts`, `appUrls`, `ACCOUNT_SETTINGS`, the group menu, the router, `scripts/loops/check-areas`. The timeline header gets one small region for the profile card.

## How to run this plan

- **Waves:** 1 → (2, 4) → 3 → 5 → 6.
- **Browser check:** slice 2 creates `profiles.mjs` (in the suite) with its `check-areas` rules; later slices extend it. Slice 2 also runs `app-shell.mjs` (group menu, group settings Details) and `phase2.mjs` (the timeline card); slice 4 runs `app-shell.mjs` (Members) and `settings-layout.mjs` (account settings).
- After the slice 1 merge and every sync that touches it: `pnpm datastore:reset` and a PowerSync restart (new stream).
- All seed and test data is fictional; checks tag and restore what they change.

---

## Slice 1: The data layer

**User stories:** US 13, 17, 37, 40, 50. **Blocked by:** none. **Blocks:** 2, 4.

### What to build

The migration, tables, Zod schemas and `PERMISSIONS` for everything above; the pure visibility module and validation schemas with unit tests; the services (recipient basics, recipient details, outside contacts, emergency order and primary, user contact, per-group sharing) with the projection rebuilt in the same transaction, and memberships removing their share row; the oRPC procedures; the stream changes and new writers stream; the device schema; append-only seeds for Dev Family (basics, a note, two insurance plans, an outside contact, contact details and sharing for member@ and caretaker@, an emergency order and a primary contact). No screens.

### Acceptance criteria

- [ ] Unit tests: visibility (each role × each field group; sharing → visible fields) and validation (phones, insurance, outside contacts, code status, blood type, sharing, length limits).
- [ ] Integration tests: viewers can't read details, writers can; only owners and admins set the order and primary; one primary per group; the projection follows contact, sharing and membership changes and disappears on leave; unsharing phones drops rank and primary; non-members get not-found.
- [ ] On devices (through `window.caretookSync`): caretaker@ has Dev Family's details row, viewer@ doesn't; demoting caretaker@ removes it after sync and promoting brings it back; viewer@ sees member@'s shared phone and not unshared fields; nobody's device has `user_contact` or a sign-in email.
- [ ] The migration's SQL is read and in order; `pnpm check` passes; seeds validate.

---

## Slice 2: The profile page and basics

**User stories:** US 1–7, 12, 15, 16, 18, 19, 49. **Blocked by:** 1. **Blocks:** 3.

### What to build

`/profile` for every member: name, preferred name, birthday and age (in the recipient's zone), a Basics card (code status, blood type, language, pronouns; each shown only when set) and the note for helpers. Writers get Edit, opening `profile/basics` (name, preferred name, birthday, basics, note) that saves online through `careGroup.updateRecipient`; offline the button is disabled with "Needs a connection to edit". Viewers see "More details are visible to caretakers." Entry points: "<Name>'s profile" in the group menu (before Group settings) and a compact recipient card at the top of the timeline header. Group settings Details keeps only the group's name, with a link to the profile. The pure display module (`ageText`, code status and blood type labels).

### Acceptance criteria

- [ ] Unit tests for the display module (`ageText` across birthdays and time zones; labels).
- [ ] Owner, caretaker and viewer each see the right parts; the viewer has no Edit and sees the caretakers line.
- [ ] A writer edits the basics and the note; a second device shows the change after sync; field errors show on their fields.
- [ ] Offline: the page reads, Edit is disabled with the message.
- [ ] The group menu link and the timeline card open the profile at 420 and 1280; group settings Details no longer has the recipient card and links to the profile.
- [ ] `profiles.mjs` covers it and is in the suite with `check-areas` rules; `app-shell.mjs` and `phase2.mjs` pass.

---

## Slice 3: Writers' details

**User stories:** US 8–11, 14, 17. **Blocked by:** 2. **Blocks:** 5.

### What to build

For writers, the profile gains Contact (phones with call and text, email, address with maps, through `ContactActions`) and Insurance (each plan by rank, member ID, group number, with a call action) from the synced details row. Edit sheets `profile/contact` and `profile/insurance` (add, edit, remove plans; up to 6 phones and plans) save online. Viewers never see these sections, their devices never have the data, and a deep link to a writers' sheet sends them to the profile.

### Acceptance criteria

- [ ] A caretaker adds phones, email, address and two insurance plans; they show with working actions, and on a second writer's device after sync.
- [ ] A viewer sees neither section and is redirected from the sheet URLs; their device has no details row.
- [ ] A writer offline reads contact and insurance; edits are disabled.
- [ ] A member demoted to viewer loses the sections after sync, without a reload.
- [ ] `profiles.mjs` covers it.

---

## Slice 4: Members' contact details

**User stories:** US 31–40. **Blocked by:** 1. **Blocks:** 5.

### What to build

Account settings' **Contact details** subpage: phones, contact email (with a line that the sign-in email stays private), address, saved online through `me.updateContact`, with "Each group chooses what it sees." On the Members page: each member's relationship and shared details with call, text, email and map actions; on your own row, "What this group sees" (checkboxes for the fields you've entered, a link to Contact details when there are none) and your relationship, saved through `careGroup.updateMySharing`. Offline, reading works and controls are disabled.

### Acceptance criteria

- [ ] caretaker@ enters contact details and shares phones (not address) with Dev Family; member@ on a second device sees the phone and relationship, never the address or sign-in email.
- [ ] Changing a phone on the account updates the group's view after sync; unsharing removes it.
- [ ] Leaving the group removes the shared details from the others' devices.
- [ ] Nothing is shared by default; the checkboxes offer only fields that have values.
- [ ] Offline: shared details read, controls disabled.
- [ ] `profiles.mjs` covers it; `app-shell.mjs` and `settings-layout.mjs` pass.

---

## Slice 5: Emergency contacts

**User stories:** US 41–48. **Blocked by:** 3, 4. **Blocks:** 6.

### What to build

For owners and admins, the profile's `profile/emergency` sheet: add members who share a phone, add, edit and remove outside contacts (name, relationship, phone), reorder the combined list with Move up and Move down buttons, and choose the primary contact (one member, or none). Writers see the ordered list on the profile (members' and outside contacts' phones with call actions, primary marked). Every member sees "Emergency contact" and "Primary contact" badges on the Members page. A member who stops sharing phones drops off the list, and the managers see a note about it on the profile.

### Acceptance criteria

- [ ] An owner builds a list of two members and one outside contact, reorders it, and sets a primary; a caretaker sees it in order on the profile, a viewer sees the badges only.
- [ ] Members not sharing a phone can't be added; a caretaker can't open the sheet.
- [ ] A member unsharing their phone drops off the list and loses primary; the managers' note appears.
- [ ] Reordering is by keyboard and buttons, announced; offline the sheet's button is disabled.
- [ ] `profiles.mjs` covers it; `app-shell.mjs` passes.

---

## Slice 6: The emergency sheet

**User stories:** US 20–30. **Blocked by:** 5. **Blocks:** none.

### What to build

The pure `emergencySheet(...)` builder (sections in order: the recipient's basics and code status, the note, address and phones, insurance, emergency contacts with the primary marked, current medications with dose and schedule, allergies when present, primary providers and pharmacy with phones; empty sections left out; the date in the recipient's zone), with unit tests. `profile/print` renders it from local data with the shared print CSS and a Print button; a Print link on the profile for writers only; anyone else is redirected.

### Acceptance criteria

- [ ] Unit tests: section order, empty sections omitted, primary marked, the combined emergency order, current medications only, age and date in the recipient's zone.
- [ ] In print media at 420 and 1280 the sheet is black on white, fits one page for the seeded profile, and has no app frame.
- [ ] It opens and prints offline.
- [ ] A viewer has no Print link and is redirected from the URL.
- [ ] `profiles.mjs` covers it; `medications.mjs` passes (shared print CSS).
