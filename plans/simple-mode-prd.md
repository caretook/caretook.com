# Easy roles PRD (B-221, B-236, B-400)

Status: to run. Plan: [`simple-mode-plan.md`](simple-mode-plan.md). Topic `simple-mode` (the slug keeps the old word; everything it builds says "easy"). Builds on the [assistant PRD](assistant-prd.md) (simple mode and its lock) and the `hotfix/simple-mode` decisions (B-208).

## Problem Statement

A care group often includes someone who isn't comfortable with apps, or who has memory or thinking difficulties: a spouse, an older sibling, a neighbor. Simple mode was built for them, and a manager can lock a member into it. In practice the lock confuses everyone:

- **Setting it up.** A manager faces two switches per member (Simple mode, Locked), and the result also depends on the member's own setting and a toggle on each device. Nobody can predict what the member will see.
- **Dead ends.** A locked member sees links that look tappable and bounce back to the timeline ("See all" on Upcoming, todo links: B-236), and has no search.
- **What they may do.** The lock limits pages, not actions. A locked caretaker can still edit and delete anyone's entries through the row menus; the server knows nothing about the lock at all.
- **Who it is for.** The lock sits on top of any role, so it's unclear whether a locked member is a trusted caretaker with a simpler screen or a less trusted helper.

## Solution

Replace the lock with **two new member roles**, picked like any other role when inviting someone or on the Members page, and call the whole thing **easy** instead of simple.

- **Easy helper**: logs care in the easy view. They can add notes, events, symptoms and vitals, log doses and "Given all", tick the todos assigned to them, and edit or delete **their own** entries. They can't change medications, providers, the profile, care periods, todos, members or settings, and the server refuses it.
- **Easy viewer**: reads in the easy view. They change nothing except ticking the todos assigned to them (a regular Viewer can tick any todo).
- The role decides the view: an easy role always gets the easy view and can't leave it. There are no manager switches any more. Owners, admins, caretakers and viewers can still choose Easy mode for themselves (their setting, and the toggle on a device).
- The easy roles can open the timeline, entries, the **Planner** (read-only), **todo pages** and **search**, all in the reduced frame. Nothing they can tap bounces back.
- The role picker groups the two under **"Easier to use"** and tells the manager, and only the manager, who they're for: someone who isn't comfortable with apps or who has memory or thinking difficulties. The role's name never says so.
- Everything a person reads, the docs, the code and the database say **easy** where they said simple.
- The way into the easy view becomes a visible **"Easy mode"** button in the full timeline's page header, where the easy view has its "Full app" button, instead of the last item of the View options (eye) menu (B-400).

## User Stories

1. As an owner or admin, I want to invite someone as an Easy helper or an Easy viewer, so that they get the easy view from their first sign-in.
2. As an owner or admin, I want to change an existing member to an easy role (or back) on the Members page, so that I set their experience in one place.
3. As an owner or admin, I want the role picker to group the two roles under "Easier to use", so that I see what they're for before reading further.
4. As an owner or admin, I want each easy role's description to say who it's for and what the person can and can't do, so that I choose correctly.
5. As a member with an easy role, I want my role's name to describe the experience ("Easy helper"), so that nothing I or others see labels my abilities.
6. As an owner or admin, I want no Simple mode or Locked switches on the Members page, so that the role is the only thing I set.
7. As a member who was locked in simple mode, I want to become an Easy helper (if I was a caretaker) or an Easy viewer (if I was a viewer) automatically, so that my screen doesn't change.
8. As an owner or admin who was locked, I want to keep my role and simply be unlocked, so that I don't lose management rights.
9. As an Easy helper, I want to add a note, event, symptom or vital from the tiles and the entry box, so that I can log what happened.
10. As an Easy helper, I want to log a dose and tap "Given all" on a due pass, with Undo, so that giving medications is one tap.
11. As an Easy helper or Easy viewer, I want to tick and untick the todos assigned to me, so that I can mark what I did.
12. As an Easy helper, I want to edit or delete an entry I made, so that I can fix my own mistake.
13. As an Easy helper, I want no edit or delete on other people's entries, so that I can't change someone else's record by accident.
14. As an owner, I want the server to refuse an Easy helper's change to a medication, provider, the profile, a care period, a todo's content, another member's entry, a member or a setting, so that the role is a real boundary and not just hidden buttons.
15. As an owner, I want an Easy helper's writes made offline to follow the same rules when they upload, so that being offline isn't a way around the role.
16. As an owner, I want the easy roles unable to tick a todo assigned to someone else or to nobody, so that they can't mark another person's work done by mistake.
17. As an owner, I want the devices of easy-role members never to hold the recipient's sensitive details (phones, address, insurance, outside contacts), so that a less trusted member's phone carries less.
18. As a member with an easy role, I want the easy view always, with no "Full app" switch, so that I can't get lost.
19. As a member with an easy role, I want "See all" on Upcoming to open the Planner, so that the link does what it says.
20. As a member with an easy role, I want the Planner to be read-only (no adding, editing or filters I don't need), so that I can look ahead without changing anything.
21. As a member with an easy role, I want a todo link to open the todo's page, where I can read its notes and tick it if it's mine.
22. As a member with an easy role, I want search in the header, so that I can find an entry, a todo, a provider, a medication or a condition.
23. As a member with an easy role, I want a provider, medication or condition from search to open as a read-only sheet over the search page, so that I get the phone number or the dose without entering a section I can't use.
24. As a member with an easy role, I want every page I can reach to use the reduced header, so that the app looks the same everywhere.
25. As a member with an easy role in one group and a regular role in another, I want each group to follow its own role, so that my other group is unaffected.
26. As a member with an easy role, I want account settings and my list of care groups to stay reachable, so that I can sign out, change my name or switch groups.
27. As an owner, I want the easy roles unable to connect an AI assistant, so that setup tasks stay with technical members.
28. As a caretaker, viewer, admin or owner, I want to choose Easy mode for myself in Timeline layout and switch on a device, so that I can use the easy view when I prefer it.
29. As a caretaker using Easy mode by choice, I want my full permissions and "Full app" to stay, so that the view is only a preference.
30. As any member, I want the app to say "Easy mode" and "Easy view" everywhere, so that the words match the roles.
31. As an owner or admin, I want the tiles card in group Details to keep its saved choice after the rename, so that I don't set it up again.
32. As a member who chose simple mode for themselves, I want my setting carried over to Easy mode, so that my view doesn't change.
33. As a developer, I want code, docs and the database to use "easy" for this feature, so that there's one vocabulary.
34. As an owner, I want an easy-role member unable to be the group's only owner or to manage members, so that roles stay exclusive: a member has exactly one role.
35. As a caretaker, viewer, admin or owner on the full timeline, I want an "Easy mode" button on the right of the "Timeline" heading, so that switching views is one visible tap in the same place as "Full app" on the other side.

## Implementation Decisions

**Roles**

- `GROUP_ROLE_NAMES` gains `easy_helper` and `easy_viewer` (stored values; labels "Easy helper", "Easy viewer"). A member has exactly one role. **Adds a migration** (the role check re-made).
- Role sets in one place (the permission blocks, mirrored client-safe): `ANY_GROUP_ROLE` includes both; `WRITERS` (owner, admin, caretaker) is unchanged and means "may change setup and anyone's data"; a new **`LOGGERS`** = `WRITERS` + `easy_helper`; a new **`EASY_ROLES`** = the two. No code compares a role to a string literal outside these sets (today's `role === "viewer"` and `role != 'viewer'` checks become set checks).
- **Own-rows permission.** `PermissionEntry` gains a group scope that grants a permission only on rows the actor created (`created_by`), enforced in SQL by the models like every other scope. Timeline entries: create for `LOGGERS`; update and delete for `WRITERS`, and for `easy_helper` on own rows. The same scope covers a live note's document updates (an Easy helper edits only notes they created).
- **What an Easy helper may write** (services and upload handlers apply it; everything else is `notAllowed`): hand-written timeline kinds (note, event, symptom, vitals), dose logs and pass logs ("Given all" and its undo), todo completion on todos assigned to them (today's viewer rule, `todoService:viewerCompletionOnly`, stays "completion only, any todo" for viewer; both easy roles get "completion only, own todos", enforced by the service and the upload handler). System-written entries that follow from an allowed write (a dose's entry) are still written by the system.
- **Easy viewer** reads what a Viewer reads; its one write is completing a todo assigned to them.
- **Assigning roles:** unchanged rules (managers set roles; only owners touch owners). Invites, join-request approvals and access codes accept the two roles wherever caretaker and viewer are accepted.
- **Sync:** the `care_group_writers` stream (the recipient's sensitive details) goes to owners, admins and caretakers only: both easy roles are excluded alongside viewer. The upload path refuses an easy role's disallowed op as it refuses a viewer's.
- **Connectors:** authorising a connection, and every tool call on an existing one, is refused for the easy roles (a role change to easy cuts a connected assistant off). The connect guide and its entry points aren't shown to them.
- **Notifications, calendars, feeds:** unchanged; an easy-role member is a member like any other for reads.

**The view**

- `resolveEasyMode({ role, ownSetting, deviceToggle })`: an easy role is always easy and can't toggle; otherwise this device's toggle, then the user's own setting (`easy | full`, default full). The owner default and the lock are gone; the setting value `group` ("follow the group") goes away and reads as full.
- `inputs` (the box, tiles, Given all) follow `LOGGERS`. Row ⋯ menus and edit sheets: writers on every row; an Easy helper on rows they created; nobody else.
- **The toggle's place (B-400):** one `EasyModeToggle` button serves both views, in the same spot: the right of the page header. The easy view's says "Full app" (as now); the full timeline's says "Easy mode" and sits in `PageHeader`'s `actions` beside "Timeline", at every width. The View options menu loses its item and separator and keeps Layout and Day summaries. Nothing is shown to a member who can't toggle (the easy roles). The button stays this device's toggle; the user's own setting is still on the Timeline layout page. The top app bar and the user menu don't change.
- The group context exposes `canWrite` (setup: `WRITERS`), **`canLog`** (`LOGGERS`) and **`easyRole`**. Screens gate on these, never on role names.
- The Members page loses the Simple mode and Locked switches; `careGroup.setMemberMode` and `careGroupMemberService.setMode` are removed. The role picker (invite, Members, join approval) shows two groups, the four regular roles and "Easier to use", with descriptions from `GROUP_ROLES`.
- **Conversion (adds a migration):** `simple_mode_locked` caretakers become `easy_helper`, locked viewers `easy_viewer`; locked owners and admins keep their role. Both member columns stop being read, written and synced; a later contract migration drops them.

**Pages**

- The lock module becomes the easy roles' route allow-list, keyed by role instead of a flag: the timeline and its sheets, `entries/*`, the Planner, todo pages, search. Every other group route redirects to the timeline, enforced once in the group layout route as today. Account settings and the group list stay outside it.
- The Planner for an easy role: the list only, read-only (no add, no edit sheets, no filters). A todo page: read, and tick when it's assigned to them (otherwise the tick isn't shown).
- Search for an easy role: every result type. Entries and todos open their pages; a provider, medication or condition opens a **read-only sheet** over the search page (name, the key facts, call and directions for a provider), never its section.
- The reduced frame (no group menu, sections or tab bar) on every allowed page, now with the search magnifier.

**The rename**

- User-facing text, docs, code names (files, functions, components, tests, data attributes, the localStorage toggle key) and the database say "easy".
- **Adds a migration**, additive: `care_group.easy_tiles` (copied from `simple_tiles`), the `easyMode` key in `user.preferences` (copied from `simpleMode`, with `simple` → `easy`). The old column and key stop being read; a later contract migration drops them. The two member columns aren't renamed: slice 3 retires them.
- Sync config, the device schema and the replication grants follow the new column. A device toggle saved under the old key is forgotten (the view falls back to the user's setting).
- Deliberate old names stay: this topic's slug, landed migrations and their snapshots, the archive, finished PRDs and plans.

## Testing Decisions

- Tests check behaviour through public interfaces: what a service returns and stores, what an upload does, what a screen shows and allows.
- **Unit:** `resolveEasyMode` (each role, setting and toggle), the route allow-list (each allowed and refused path, by role), the role sets, role-picker grouping and descriptions.
- **Integration:** the role matrix: each role against each table (the standing "every role against every table" priority), with the own-rows scope (an Easy helper edits and deletes their own entry, is refused on another's; SQL-level, not just service-level); todo completion: any todo for a viewer, only their own for both easy roles (another member's and an unassigned todo refused); uploads of each allowed and refused op as an easy role (prior art `syncPasses.int.test.ts`); the writers stream excluding both roles (the sync matrix and `roles.int.test.ts`); connector authorisation and tool calls refused; the conversion migration (locked caretaker, locked viewer, locked admin); the rename migration (tiles and preference copied).
- **Component:** the role picker (groups, descriptions) on invite and Members; the Members page without switches; the easy timeline as Easy helper (inputs, menus only on own rows) and Easy viewer (no inputs; a tick on their own todos only); the Planner and a todo page in the reduced frame; search with read-only sheets; a regular role choosing Easy mode keeps "Full app"; the full timeline's header shows "Easy mode", it switches the view and "Full app" switches back, the View options menu has no such item, and an easy role sees neither.
- **End to end:** the existing lean check that owns the app shell gains one step: an Easy helper signs in, logs an entry, opens "See all", and can't reach Medications. No new check.

## Out of Scope

- New easy-view features (larger tiles, voice, pictures, reminders) and any redesign of the easy timeline itself.
- Finer per-member permissions or custom roles.
- An Easy helper adding todos, medications or providers (including quick-add from Log a dose).
- Letting the easy roles connect an assistant.
- Dropping the old columns and preference key (a later contract migration).
- The care recipient as a user type with their own view.
- Native (Capacitor) specifics beyond what the shared routes already do.

## Further Notes

- **Compliance:** the role name and everything stored or synced about a member stay free of health inferences; the "who it's for" wording lives only in the picker's description shown to managers. Easy-role devices hold less (no sensitive recipient details).
- Nothing is live in production; staging memberships are converted by the migration.
- All seed and test data is fictional: the seeds add one Easy helper and one Easy viewer to Dev Family.
- A `GROUP_ROLES` description is reused by the picker, so the wording is in one place: "For someone who isn't comfortable with apps or who has memory or thinking difficulties. Large type, one screen, a few big buttons. They can log care and tick their own todos but can't change medications, providers or settings." (Easy helper) and "… Large type, one screen. They can read and tick their own todos but can't change anything else." (Easy viewer).
