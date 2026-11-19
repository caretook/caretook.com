# Profiles: PRD

Status: 📝 **written**, not planned or sliced. Backlog items: B-45 (the recipient's profile), B-46 (members' contact details). Topic `profiles`. Interview: 2026-11-19.

Depends on `invites` (done) and `medications` slice 1 (done: the synced date of birth and time zone). Its emergency sheet reads medications and providers (both in `dev`) and will show allergies once B-26 lands. Touches none of the timeline's hot files, so it can run beside `search`.

## Problem Statement

A care group knows its recipient by name and, since medications, by date of birth and time zone. Everything else a caretaker needs at a pharmacy counter, on the phone with an insurer, or in an emergency room lives in their head or on paper: the recipient's phone and address, insurance member IDs, whether there's a DNR, what language they prefer, and who to call. When a new caretaker joins, or a paid aide fills in, they have to ask.

The same gap exists between members. A care group is often siblings, a spouse, a neighbour and an aide, and the app shows them each other's names and avatars but no way to reach each other. Who's the emergency contact, who should a doctor's office call, and what's the neighbour's number are all answered outside the app.

Some of this is sensitive (insurance, address), so not everyone in a group should see all of it, and members must choose what they share about themselves.

## Solution

- **A profile page for the recipient** (`/profile` in the group), from the group menu and a card on the timeline header. Everyone sees the name, preferred name, birthday and age, and the medical basics: code status (full code, DNR, DNR/POLST), blood type, primary language, pronouns, and a free-text note for helpers ("hard of hearing on the left; uses a walker"). Writers (owners, admins, caretakers) also see the recipient's phones, email and address, insurance plans, and the emergency contacts. Viewers see a line saying caretakers can see more.
- **Editing is online only**, from the profile page, in sheets: basics and the note by writers, contact and insurance by writers, emergency contacts by owners and admins. Offline, everything reads (writers' details are synced to writers' devices only) and the edit controls say they need a connection.
- **A printable emergency sheet** (`/profile/print`, writers only): the recipient's basics and code status, the note, address and phones, insurance, the ordered emergency contacts with the primary contact marked, current medications, allergies once B-26 exists, and the primary providers and pharmacy with phones. One page where it fits, black on white in every theme, and it works offline.
- **Members' contact details:** each member enters their phones, a contact email (not their sign-in email, which stays private) and an address once, on their account. In each group they tick which of those that group sees (nothing by default), and say how they're related to the recipient. Everyone in the group sees what's shared, on the Members page, with call, text, email and map actions.
- **Emergency contacts:** owners and admins build one ordered list from members who share a phone and from outside contacts (a neighbour without an account: name, relationship, phone), and mark one member as the primary contact (the person providers should call). Members show "Emergency contact" and "Primary contact" badges on the Members page; the list itself is on the profile page and the sheet.

## User Stories

### The recipient's profile

1. As a caretaker, I want a profile page for the person I care for, so that their key details are in one place.
2. As a caretaker, I want to reach the profile from the group menu and from a card at the top of the timeline, so that it's one tap from anywhere.
3. As any member, I want to see the recipient's name, preferred name, birthday and age, so that I address them correctly and know their age at a glance.
4. As any member, I want the age worked out on the recipient's day in their time zone, so that it changes on the right birthday.
5. As any member, I want to see the recipient's code status (full code, DNR, DNR/POLST), so that I know their wishes in an emergency.
6. As any member, I want to see their blood type, primary language and pronouns, so that I can help them and tell responders.
7. As any member, I want a short free-text note for helpers ("hard of hearing on the left"), so that practical things anyone helping should know are written down.
8. As a writer, I want to add the recipient's phones (labelled) and email, with call, text and email actions, so that I can reach them or give their number to a provider.
9. As a writer, I want to add the recipient's address with a maps action, so that aides and drivers can find them.
10. As a writer, I want to add one or more insurance plans (insurer, plan name, member ID, group number, phone, primary or secondary), so that I can answer an insurer, pharmacy or front desk without the card.
11. As a writer, I want to call an insurer from the plan, so that I don't have to look up the number.
12. As a viewer, I want to see that more details exist and that caretakers can see them, so that I know who to ask.
13. As a viewer, I never want the recipient's address, contact details or insurance on my device, so that the group's sensitive details stay with the people caring hands-on.
14. As a writer offline, I want the whole profile readable, so that a hospital with no signal doesn't stop me.
15. As a writer, I want to edit the basics, the note, contact details and insurance in sheets on the profile page, so that I can keep them current.
16. As a writer offline, I want edit controls to say they need a connection, so that I don't think a change was saved.
17. As a member who's demoted to viewer, I expect the writers-only details to leave my device on the next sync, so that access follows my role.
18. As an owner, I want the recipient's name and preferred name edited on the profile page (no longer in group settings), so that everything about the recipient lives in one place.
19. As a member, I want field errors (a bad phone, an empty member ID) shown on the field, so that I can fix them.

### The emergency sheet

20. As a writer, I want a printable emergency sheet, so that I can put it on the fridge, in a go-bag, or hand it to paramedics.
21. As a writer, I want it to show the recipient's name, birthday and age, code status, blood type, language, pronouns, the note, address and phones, so that responders have the basics.
22. As a writer, I want it to show each insurance plan with member ID, group number and phone, so that admission paperwork goes faster.
23. As a writer, I want it to list the emergency contacts in order with phones, the primary contact marked, so that responders call the right person first.
24. As a writer, I want it to list current medications with dose and schedule, so that responders know what they take.
25. As a writer, I want it to list allergies once the app records them, so that the sheet stays the single emergency page.
26. As a writer, I want the primary providers and pharmacy with phones on it, so that responders can reach the care team.
27. As a writer, I want empty sections left out, so that a half-filled profile still prints a clean sheet.
28. As a writer, I want it printed black on white on one page where it fits, with the date printed, so that it's legible and I know how current it is.
29. As a writer offline, I want to open and print the sheet, so that it works when it's needed most.
30. As a viewer, I don't want a link to the sheet, so that I'm not shown something I can't open.

### Members' contact details

31. As a member, I want to enter my phones, a contact email and my address once on my account, so that I don't retype them per group.
32. As a member, I want my sign-in email never shown to the group unless I enter it as my contact email, so that my login stays private.
33. As a member, I want to choose, per group and per field, what that group sees, so that the siblings get my address but the aide's agency group doesn't.
34. As a member, I want nothing shared until I choose, so that joining a group doesn't publish my details.
35. As a member, I want to say how I'm related to the recipient in each group, so that others know who I am ("daughter", "neighbour", "aide from Sunrise").
36. As a member, I want changing a detail on my account to update every group I share it with, so that my number is never out of date.
37. As a member, I want to stop sharing a field and have it disappear from the group's devices on the next sync, so that I stay in control.
38. As any member, I want to see what co-members share on the Members page, with call, text, email and map actions, so that I can reach them from the app.
39. As any member offline, I want co-members' shared details readable, so that I can call my brother from a hospital basement.
40. As a member who leaves a group, I want my shared details gone from that group's devices, so that leaving really leaves.

### Emergency contacts

41. As an owner or admin, I want to mark members who share a phone as emergency contacts, so that the group agrees who to call.
42. As an owner or admin, I want to put the emergency contacts in order, so that responders call the right person first.
43. As an owner or admin, I want to add outside contacts (name, relationship, phone) to the emergency list, so that a neighbour without an account can be on it.
44. As an owner or admin, I want to mark one member as the primary contact, so that providers' offices know who to call.
45. As any member, I want "Emergency contact" and "Primary contact" badges on the Members page, so that everyone knows who they are.
46. As a writer, I want the ordered emergency list on the profile page, so that I have it without printing.
47. As a member who stops sharing my phone, I expect to drop off the emergency list (with a note to managers), so that the list never shows a contact with no number.
48. As an owner or admin offline, I want emergency contact controls to say they need a connection, like other edits.

### Everyone

49. As a keyboard or screen-reader user, I want every profile, sharing and contact control labelled and reachable, so that it's usable without sight or touch.
50. As a member of two groups, I want each group's profile and contacts kept separate, so that two people's care never mixes.

## Implementation Decisions

### Visibility

| What                                                            | Who reads                  | Who edits                                                     | On devices                 |
| --------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------- | -------------------------- |
| Name, preferred name, birthday, time zone (existing)            | every member               | owners, admins, caretakers                                    | every member               |
| Medical basics and the note for helpers                         | every member               | owners, admins, caretakers                                    | every member               |
| Recipient's phones, email, address, insurance, outside contacts | owners, admins, caretakers | owners, admins, caretakers (outside contacts: owners, admins) | writers only               |
| Emergency order and primary contact on members                  | every member (badges)      | owners, admins                                                | every member               |
| A member's contact details on their account                     | that member                | that member                                                   | never synced               |
| What a member shares with a group, and their relationship       | every member of that group | that member                                                   | every member of that group |

A pure, client-safe **visibility module** holds these rules (role → recipient field groups; a member's sharing choices → the fields a group sees) and is used by the screens, the services and the tests.

### Schema (one pending migration for the PRD)

- **`care_recipient`** gains `code_status` (`fullCode | dnr | dnrPolst`, nullable), `blood_type` (the eight types, nullable), `primary_language`, `pronouns` (short text). The existing, unused `notes` column becomes the **note for helpers** (limited length) and is added to the synced columns. Permissions unchanged.
- **`care_recipient_details`**, new, 1:1 with the recipient (unique `group_id`, composite FK to the recipient, cascading): `phones` jsonb `[{ label, number }]` (at most 6, the providers' shape), `email`, `address`, `insurance` jsonb `[{ id, rank (primary | secondary | other), insurer, planName?, memberId, groupNumber?, phone? }]` (at most 6), `outside_contacts` jsonb `[{ id, name, relationship?, phone, emergencyRank? }]` (at most 10). Permissions: read and write for owners, admins and caretakers only; viewers `none`.
- **`care_group_member`** gains `relationship` (short text, set by the member), `shared_fields` (a set of `phones | email | address`, set by the member, default empty), `emergency_rank` (nullable integer, set by owners and admins) and `is_primary_contact` (boolean, at most one per group, set by owners and admins; a partial unique index).
- **`user_contact`**, new, 1:1 with the user: `phones`, `contact_email`, `address`. Read and write: the user only; never replicated.
- **`member_contact_share`**, new, one row per membership: `group_id`, `user_id`, and only the shared values (`phones`, `email`, `address`, null when not shared). A projection, **written only by the service**, rebuilt in the same transaction whenever the user's contact details, their sharing choices, or the membership change; deleted with the membership. Read: any member of the group. This keeps the sync streams simple: they replicate the projection, never `user_contact`.
- **Emergency list order** is one sequence across members (`emergency_rank`) and outside contacts (`emergencyRank`); the service renumbers on every reorder. A member who stops sharing phones loses their rank and the primary flag, and the service notes it for managers.

### Sync

- `care_groups` stream: `care_recipient` gets the new columns and `notes`; `care_group_member` gets `relationship`, `shared_fields`, `emergency_rank`, `is_primary_contact`; `member_contact_share` is added (and to the publication).
- A new **`care_group_writers`** stream: `care_recipient_details` for groups where the user's role is owner, admin or caretaker. A role change moves the device in or out of it on the next sync.
- The device schema gets the new tables and columns. Nothing new is uploaded: these tables stay out of the upload switch (writes are online only).

### Services and API

- `careRecipientService.updateProfile` extended to the basics and the note (writers). `careRecipientDetailsService`: `get`, `update` (phones, email, address, insurance; writers), `updateOutsideContacts` (owners, admins). `emergencyContactService.setOrder` (one ordered list of member and outside ids; owners and admins; only members sharing phones), `setPrimary` (one member or none). `userContactService.update` (self) and `memberSharingService.update` (self, per group: shared fields and relationship), both rebuilding the projection in their transaction.
- oRPC: `careGroup.updateRecipient` grows the new fields; `careGroup.recipientDetails` and `careGroup.updateRecipientDetails`; `careGroup.updateOutsideContacts`, `careGroup.setEmergencyContacts`, `careGroup.setPrimaryContact`; `me.contact` and `me.updateContact`; `careGroup.updateMySharing`. Non-members get not-found, the wrong role a 403, as today. Public member profiles still never include the sign-in email.
- All writes are online; the screens disable their controls offline, as group settings do.

### Screens

- **Profile page** (`appUrls.profile(groupId)`, a route under the group route; not a group section): header with name, preferred name, birthday and age; a Basics card (code status, blood type, language, pronouns) and the note; for writers, Contact (phones, email, address with `ContactActions`), Insurance (each plan, with a call action) and Emergency contacts (ordered, primary marked, members' and outside contacts' phones). Viewers get "More details are visible to caretakers." Edit buttons open sheets (`Sheet`, `Field`, `ChoiceGroup`), each saving through its oRPC call. Entry points: the group menu ("<Name>'s profile", before Group settings) and a compact recipient card at the top of the timeline header.
- **Emergency sheet** (`/profile/print`, writers only; viewers redirected to the profile): built by a pure `emergencySheet(...)` from local data (recipient, details, members and shares, outside contacts, current medications, primary providers and pharmacy, allergies when present, the date in the recipient's zone), rendered with the medications sheet's print CSS and `print:hidden` frame. Works offline.
- **Group settings Details** keeps only the group's name; the recipient card moves to the profile page (with a link from Details).
- **Account settings** gets a **Contact details** subpage (`ACCOUNT_SETTINGS`): phones, contact email, address, with a line saying each group chooses what it sees.
- **Members page:** each member's relationship, shared details with actions, and badges. On your own row, "What this group sees": checkboxes for phones, email and address (only fields you've entered, with a link to Contact details), and your relationship. Owners and admins get "Emergency contacts": add or remove members (only those sharing a phone), add outside contacts, reorder (move up and down buttons, not drag), and choose the primary contact.
- **Wording** in one pure display module: code status and blood type labels, `ageText` ("Age 87"), relationship and rank labels, the "visible to caretakers" line.

### Rules across PRDs

- One migration, numbered when it lands. Additive edits to `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml` (a new stream and new columns), the device schema, `routes.ts`, `appUrls`, `ACCOUNT_SETTINGS`, the group menu and the router.
- The timeline header card is a small, additive region; coordinate with `search` (which adds to the filter row) if both are running.
- Seeds: append-only additions for Dev Family (Grandma Pat's basics, a note, two insurance plans, an outside contact, member contact details and sharing for member@ and caretaker@, emergency order and a primary contact) in their own seed file and ids.

## Testing Decisions

- **Good tests check what a caller relies on**: given a role, data and choices, what's visible, valid, or printed; never internal helpers.
- **Unit tests:**
  - Visibility rules: each role against each recipient field group; a member's shared fields → what the group sees; flags only for members sharing phones.
  - Profile validation: phones, insurance plans (required member ID and insurer, rank), outside contacts, code status, blood type, sharing choices, length limits.
  - The emergency sheet builder: section order, empty sections left out, the primary contact marked, emergency order across members and outside contacts, current medications only, age and date in the recipient's zone.
  - Display wording: labels and `ageText` across birthdays and time zones.
- **Integration tests:** the services in the test Postgres: viewers can't read details (`none`), writers can; only owners and admins order contacts and set the primary; one primary per group; the projection rebuilt on contact, sharing and membership changes (and gone on leave); a member who stops sharing phones loses rank and primary; non-members get not-found.
- **Browser check:** a new `profiles.mjs` (in the suite, with `check-areas` rules): the profile page as owner, caretaker and viewer (viewer sees no details and no sheet link), edits through each sheet, offline read and disabled edits, the emergency sheet in print media at 420 and 1280 and offline, account contact details and per-group sharing seen by a co-member on a second device, unsharing removing them, emergency contacts ordering and badges, and a demoted member's device losing the details. Prior art: `app-shell.mjs` (group settings by role, online-only writes, two devices), `medications.mjs` (the print sheet).

## Out of Scope

- Photos or scans of insurance cards, IDs or a DNR form (B-56, documents).
- Allergies themselves (B-26, medications follow-up); the sheet shows them once they exist.
- Offline editing of any profile field; letting viewers see details; per-field visibility beyond the table above.
- Several recipients per group.
- Editing the recipient's time zone (a separate follow-up).
- Calling or texting through the app (actions use `tel:`, `sms:`, `mailto:` and maps links).
- Notifying emergency contacts, or reminders to keep details current.

## Further Notes

- **Order of slices (rough, for planning):** (1) the data layer: migration, tables, permissions, services, projection, streams, device schema, seeds; (2) the profile page with basics, the note and their edits (everyone's view), and moving the recipient out of group settings; (3) writers' details: contact and insurance, synced to writers, with their sheets; (4) members' contact details and per-group sharing, on account settings and the Members page; (5) emergency contacts (outside contacts, order, primary, badges); (6) the emergency sheet. 2 and 4 can run beside each other after 1; 5 needs 3 and 4; 6 needs 5.
- **Privacy:** the writers stream is the only place sensitive recipient details reach devices; viewers' devices never hold them. Member contact details reach a group only through what the member shared. Nothing here goes in emails.
- **Open questions:** ❓ whether pronouns belong in the basics for every recipient or only shown when set (proposed: only when set); ❓ whether the timeline header card should be dismissible.
