# PRD: App shell (user menu, group switcher, group nav, group settings)

Status: 🟡 written, not planned. Backlog items: B-8, B-9. Topic `app-shell`.

## Problem Statement

The app's frame is a stopgap. The header lists the signed-in name, a Settings link and a Sign out button side by side, and it gets cramped on a phone. Someone in two care groups (two parents, say) has no way to switch between them except going back to the list at `/app`. There's no screen for the group itself: nobody can rename it, correct the care recipient's name or date of birth, change someone's role or remove someone, even though the data layer already has the rules for all of these. Medications, Providers and an Assistant are planned, and they'll need somewhere to live in each group. Today a group is just its timeline.

## Solution

A shared frame for every `/app` screen:

- **A user menu** behind the user's avatar (initials when there's no image): their name and email at the top, then Settings, a theme choice (System, Light, Dark) and Sign out.
- **A group menu** on the current group's name in the header. It lists every group you're in, to switch, plus "Group settings". `/app` opens the group you used last on this device.
- **Group sections:** a bottom tab bar on phones, and a nav in the header on wide screens. Only **Timeline** ships now. Later PRDs (Medications, Providers, Assistant) add a tab to a registry.
- **Group settings** (`/app/groups/:groupId/settings`): the group's name, the care recipient's profile (name, preferred name, date of birth), and the members with their roles. Owners and admins manage members, and anyone can leave. Changes save through the route's action, online only, under the rules the services already enforce.
- **Settings** also gets the timeline layout (Rows or Cards). The toggle stays on the timeline too, and both change one preference.

## User Stories

1. As a caretaker on a phone, I want my account actions behind one avatar button, so that the header has room for what I'm looking at.
2. As a user, I want the avatar to show my initials when I have no photo, so that it's still recognisably mine.
3. As a user, I want the user menu to show my name and email, so that I know which account I'm signed in as on a shared device.
4. As a user, I want Settings in the user menu, so that I can change units and the timeline layout.
5. As a user, I want Sign out in the user menu, so that I can hand the device to someone else.
6. As a user, I want to choose System, Light or Dark in the user menu, so that the app suits the room I'm in.
7. As a user, I want my theme choice to apply before the page draws, so that it doesn't flash the wrong theme.
8. As a user, I want the theme to work offline and stay on this device, so that a dark phone and a light laptop don't fight.
9. As a user in two care groups, I want to switch groups from the header, so that I can move between my parents' timelines in one tap.
10. As a user in several groups, I want `/app` to open the group I used last on this device, so that I land where I left off.
11. As a user, I want `/app` to show the list of groups when the remembered group is gone (I left it, or it was deleted), so that I'm never stuck on an error.
12. As a user in a single group, I want `/app` to keep going straight to its timeline, so that nothing changes for the common case.
13. As a user, I want the header to show the group I'm in (the recipient's display name), so that I don't log something in the wrong group.
14. As a user on a phone, I want a bottom tab bar for the group's sections, so that they're within thumb reach.
15. As a user on a wide screen, I want the sections in the header instead, so that the layout uses the space.
16. As a user, I want the current section marked in the nav, and announced to screen readers, so that I know where I am.
17. As a developer of a later PRD, I want to add a section by adding one registry entry, so that Medications or Providers don't have to edit the shell.
18. As a user, I want the tab bar hidden on the entry page (`/entries/:id`), so that the editor and keyboard have the whole screen.
19. As an owner or admin, I want to rename the group, so that its name stays meaningful.
20. As an owner, admin or caretaker, I want to edit the care recipient's name, preferred name and date of birth, so that the profile is correct.
21. As a viewer, I want to see the group's details read-only, so that I know who's in it without being able to change it.
22. As any member, I want to see the members with their names, avatars and roles, so that I know who can see and write in the timeline.
23. As an owner or admin, I want to change a member's role, so that I can give or take away write access.
24. As an owner, I want to be the only one who can make someone an owner or demote an owner, so that admins can't take over the group.
25. As an owner, I want the app to refuse to remove or demote the last owner, with a message saying why, so that the group is never left without one.
26. As an owner or admin, I want to remove a member after confirming, so that someone who's no longer involved loses access.
27. As a member, I want to leave a group after confirming, so that I can step away. If I'm the last owner, I'm told to name another owner first.
28. As a user who has just left a group, I want to be taken to `/app`, so that I don't sit on a page I can no longer see.
29. As a user offline, I want group settings to say it needs a connection rather than fail silently, so that I know why I can't save.
30. As a user, I want a role change or removal by someone else to show up in my members list without reloading, so that what I see stays current.
31. As a user whose role was just lowered to viewer, I want writer-only controls to disappear on my next screen, so that I don't try edits that will be rejected.
32. As a user, I want Settings to include the timeline layout (Rows or Cards), so that I can find it in the place I expect.
33. As a user, I want the timeline's layout toggle and Settings to change the same preference, so that they never disagree.
34. As a keyboard or screen reader user, I want both menus to be real menus (arrow keys, Escape, focus return), so that the frame is usable without a pointer.

## Implementation Decisions

**Frame and regions**

- The `/app` layout becomes a frame with named regions: the header (group menu on the left, then the section nav on wide screens, the sync indicator, the user menu), the outlet, and the bottom tab bar on phones. Later PRDs fill the regions and never restructure the frame, which is the hot file the backlog's PRD table names.
- The frame knows the current group from the route's `groupId` param. Screens outside a group (`/app`, `/app/settings`) show the header without a group menu or tabs.
- The timeline's own heading (recipient name over group name) becomes redundant with the header's group menu. Keep it as a smaller page title, and leave the rest of the timeline screen alone (it's `timeline-polish`'s).

**Group sections registry**

- `GROUP_SECTIONS`: an ordered list of `{ id, label, icon, path(groupId), match }`. Only `timeline` exists now. Additive, like the other shared registries: later PRDs append an entry and add their route.
- A pure helper resolves the active section from a pathname, and says whether the bar is hidden there (the entry route hides it).

**User menu**

- A React Aria `MenuTrigger` on an avatar button. The avatar comes from one shared `UserAvatar` (image, or initials from the name and then the email), the same initials rule `EditorAvatars` uses: extract it and share it.
- Items: a non-interactive header (name, email), Settings (link), Theme (a radio group: System, Light, Dark), Sign out (POSTs to `/sign-out`, as today).
- **Theme:** per device, in localStorage (`caretook:theme`), wrapped in try/catch. It sets `data-theme` on `<html>`; System removes it so daisyUI follows the device. An inline script in `root.tsx` applies it before hydration (both build targets).

**Group menu and last group**

- A RAC `MenuTrigger` on the current group's display name (the recipient's preferred name or name, and then the group name). It lists every group from the local `myGroupsQuery` (live, offline), the current one checked, then "Group settings".
- **Last group:** stored per device and per user (`caretook:lastGroup:<userId>`) whenever a group route loads. `/app`'s loader redirects to it if the user is still a member (checked against the local groups), else to the only group, else shows the list. A pure `resolveHomeGroup({ groups, remembered })` holds that rule.

**Group settings route** (`/app/groups/:groupId/settings`, shared, no server loader)

- `clientLoader`: the group, recipient and members come from the local database where they sync (names, roles). The recipient's date of birth doesn't sync (the stream sends names only), so it's read through a new oRPC call. Offline, the page renders read-only from local data with a "Needs a connection to edit" notice.
- `clientAction`: one action with an `intent` field (`renameGroup`, `updateRecipient`, `changeRole`, `removeMember`, `leave`). It validates with the shared Zod schemas and calls oRPC, then returns `ActionResult` (the settings pattern). A `leave` that succeeds redirects to `/app`.
- **New oRPC procedures** (in `packages/api`, thin over existing services, errors through `unwrap`/`toORPCError`):
  - `careGroup.update({ groupId, name })` → `careGroupService.update`.
  - `careGroup.recipient({ groupId })` → name, preferred name, date of birth (members only).
  - `careGroup.updateRecipient({ groupId, name?, preferredName?, dateOfBirth? })` → `careRecipientService.update`.
  - `careGroup.changeRole({ groupId, userId, role })` and `careGroup.removeMember({ groupId, userId })` → `careGroupMemberService`, which already enforces the owner rules and locks owner rows.
  - Removing yourself is leaving (the permission map allows it). The last-owner refusal comes back as a 409 with its code, and the UI turns it into the message in story 25/27.
- Members' DTOs stay public profiles (name, image, role, never email).
- UI checks use `hasPermission()` and the viewer's group role to show or hide controls; the server is the authority.
- **No schema change, no migration, no sync-config change.** Role and membership changes reach other devices through the existing `care_groups` stream.

**Settings**

- Adds a "Timeline layout" choice (Rows or Cards) that writes `preferences.timelineView` through `me.updatePreferences`, the same field the timeline toggle writes. (B-17, a toggle change made offline is lost, is a quick fix outside this PRD.)

## Testing Decisions

- Test behaviour through public interfaces: what a procedure returns or refuses for each role, what a helper returns for an input, what a user sees and can do. Not internal calls.
- **Integration** (`packages/api`, like `router.int.test.ts`, with fixtures from `packages/data/test/fixtures.ts`): each new procedure for owner, admin, caretaker, viewer and non-member, including the owner-only rules, the last-owner 409, leaving, and that member DTOs carry no email. Each test builds its own group (don't share one across `describe` blocks).
- **Unit** (`web:unit`): `resolveHomeGroup`, the section registry's active and hidden rules, and the initials helper.
- **Browser check** (a new `app-shell.mjs`, following `phase2.mjs`): the user menu (header, theme persists across reload with no flash, sign out); switching between two groups and the last group on `/app` (the seeds need a second group: append a fictional one, as a new seed file); tabs on a 420-wide window and nav on a wide one; group settings as owner (rename, recipient edit, role change, last-owner refusal) and as viewer (read-only); leave redirects. Rerun `phase2.mjs`, since the frame wraps the timeline.

## Out of Scope

- Invites, accepting them and consent (the Resend iteration).
- Creating a group from the UI, and deleting a group.
- Uploading photos for users or the recipient. Avatars use `user.image` when it exists, and initials otherwise.
- More recipient fields (allergies, conditions, primary doctor): the medications and providers PRDs add what they need.
- Offline edits to group settings.
- Medications, Providers and Assistant themselves: this PRD only gives them a place.
- Fixing B-17 (the quick-fixes PRD).

## Further Notes

- **Seeds:** a second fictional group (for example "Dev Family 2", recipient "Grandpa Lou", with member@ as owner) in its own seed file, so the switcher can be checked. Append only.
- **Hot files:** `layout.tsx`, `routes.ts`, `home.tsx`, `root.tsx` (theme script), and a small edit to `timeline.tsx`'s heading. Land the frame before `providers`, `medications` and `assistant` start, so they fill the regions instead of editing the frame.
- B-9's question about what group settings holds first is settled: the name, the recipient profile and members with roles.
