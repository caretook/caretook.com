# Plan: App shell

> Source PRD: [`plans/app-shell-prd.md`](app-shell-prd.md). User-story numbers (US) refer to it. Backlog items B-8 (user menu) and B-9 (group menu, nav and settings). Topic `app-shell`.

## Status

| Slice | State                                        | Merge into `prd/app-shell` (slice commits) |
| ----- | -------------------------------------------- | ------------------------------------------ |
| 1     | **landed** in `dev` (`49b66b9`)              | `697c39b` (`e9d37c3`, `4606dcd`)           |
| 2     | **merged**, ready to land (wave 2)           | `9e5f7c2` (`fb225b0`)                      |
| 3     | **merged**, ready to land (wave 2)           | `e3d7119` (`650c0f0`); check fix `fb9f6b1` |
| 4     | **merged**, ready to land (wave 2)           | `ac4eea3` (`d0d5c63`)                      |
| —     | `dev` synced (quick-fixes wave 1)            | `66255e2`; `first-sync.mjs` fix `aaf2f99`  |
| 5     | **merged**, ready to land (wave 3)           | `7fb947a` (`01cc17f`, `5ede338`)           |
| 6     | **running** in `.loops/app-shell-6` (wave 4) |                                            |
| 7     | **merged**, ready to land (wave 3)           | `0795604` (`08cabee`, `1d6cdc1`)           |
| —     | `dev` synced (docs and backlog only)         | `bbeb2c9`                                  |

Backlog: B-8 is landed (slices 1–2); slice 7 is noted on it. B-9 is in progress (claimed by `prd/app-shell`) until slice 6.

Wave 3 notes, for the next orchestrator:

- **Slice 6** branched from `7fb947a` (slice 5 merged, before slice 7 and the sync). It must update slice 5's `app-shell.mjs` assertions (the section list, and a viewer's zero controls), run its block last, and restore the seeded memberships.
- **`phase2.mjs`:** slice 7's `1d6cdc1` makes the sticky-header step scroll into the middle of a day. `timeline-polish` may touch the same hunk; the commit is safe to redo.
- **Wave 3's checks, all green on the synced branch:** `app-shell` (76), `phase2` (36), `settings-layout` (14), `roundtrip` (20), `sign-in`, `first-sync`, `layout-offline` (12), `live-notes` (91), `signout-wipe`. `app-shell.mjs` failed once on `openDevFamily` right after a server restart, and passed on the rerun.
- **Not done:** units still save online only (moving them onto `saveSettings` is out of scope); no native build was run for the new route.

Wave 2 notes, for the next orchestrator:

- **Slice 5:** "Group settings" goes at the marked comment at the end of `GroupMenu`'s `Menu` (after a `Separator`). `/app/groups/:groupId/settings` will show the tab bar with no section current; that's intended (it isn't a section).
- **Seeds:** member@ has two groups now. Browser checks get Dev Family through `cdp.mjs`'s `signIn` (`openDevFamily`; `{ home: true }` to skip it). Filter psql seed queries by Dev Family's id. Slice 6's role-change checks should use Dev Family (where caretaker@ and viewer@ are).
- **Merging `app-shell.mjs`:** every slice appends to it, and the header comment conflicts each time. Slices 2 and 3 also clashed at runtime: slice 2 kills the viewer's browser to reuse port 9472, so any later step on the viewer page must run before that (`fb9f6b1`). Run the whole file after each merge.
- **Slice 7:** quick-fixes slice 2's `saveSettings(userId, change)` (`lib/me.ts`) is in `dev`; write the layout through it.
- **Flaky checks seen this wave** (they passed on a rerun, or on a quiet machine): the old `live-note.mjs` step 4 or 8, and `editors.mjs` right after other checks typed (both now folded into live-notes-ux's order-independent `live-notes.mjs`); `app-shell.mjs` group-menu Escape and "/app after a reload", once each on a first run. `layout-offline.mjs` doesn't exit after printing its result: run it with a timeout.
- **Browser checks after the second `dev` sync:** live-notes-ux slice 10 replaced `editors`, `live-note`, `live-now`, `share`, `title-chips` and `entry-header` with one `live-notes.mjs`; slice 3's Dev Family filters in the old files were dropped with them. The wave's set is now `app-shell`, `phase2`, `live-notes`, `roundtrip`, `signout-wipe`, `first-sync`, `sign-in` and `layout-offline`.

## Architectural decisions

Durable decisions every slice follows:

- **Routes:** everything stays under the shared `/app` layout (no server loaders or actions; `clientLoader`/`clientAction` + oRPC). One new route: `/app/groups/:groupId/settings`, appended to `routes.ts`.
- **Frame regions:** the `/app` layout is a frame with named regions: header **group** (left), header **sections** (wide screens), header **status** (sync indicator), header **user**, the **outlet**, and the phone **tab bar**. Slices fill regions; none restructures the frame after slice 1.
- **Section registry:** `GROUP_SECTIONS`, an ordered list of `{ id, label, icon, path(groupId), match }`. Only `timeline` now. Later PRDs append entries (additive registry rule).
- **Per-device storage** (localStorage, every access in try/catch): `caretook:theme` and `caretook:lastGroup:<userId>`. Sign-out clears the last-group keys (as `forgetSettings` does for settings).
- **Group settings writes:** online only, one `clientAction` with an `intent` field, calling new `careGroup.*` oRPC procedures over the existing services. No schema change, no migration, no sync-config change.
- **Member DTOs** stay public profiles: name, image, role. Never email.
- **Seeds:** a second fictional group in its own seed file (append only).
- **Hot files:** `layout.tsx` (slice 1 owns its structure), `routes.ts` (slice 5 appends one route), `root.tsx` (slice 2's theme script), `home.tsx` (slice 3), and `timeline.tsx` (slice 1 shrinks its heading only; it's also hot for `timeline-polish`, `live-notes-ux` slice 7 and quick-fixes slice 2).

## How to run this plan

- **Slice 1 runs alone.** It lays out the frame's regions that every other slice fills.
- Then **2, 3 and 4 run in parallel**: each fills its own region (2: the user menu's theme item and `root.tsx`; 3: the group region and `home.tsx`; 4: the sections region and the tab bar).
- **5 after 3** (it adds "Group settings" to the group menu), **6 after 5** (same page).
- **7 any time**, but best after quick-fixes slice 2 lands, so it reuses that slice's `saveSettings`. If it runs first, it writes through `me.updatePreferences` directly and quick-fixes 2 switches it over.
- Merge in number order. After each merge, rerun every merged slice's browser check plus `phase2.mjs` (the frame wraps the timeline).
- Every slice ends with `pnpm check` passing, a browser check for its behaviour, and a hand-off (AGENTS.md, _Loop rules_). Run `pnpm datastore:reset` after slice 3 (seeds).

```
1 ──┬── 2
    ├── 3 ── 5 ── 6
    └── 4
7 (independent)
```

---

## Slice 1: The frame and the user menu

**User stories:** US 1–5, 34 (user menu part). **Blocked by:** none. **Blocks:** 2, 3, 4.

### What to build

Rebuild the `/app` layout as the region frame above. Replace the header's name, Settings and Sign out with a user menu: an avatar button opening a React Aria menu with a non-interactive header (name, email), Settings (a link to `/app/settings`) and Sign out (POST to `/sign-out`, as today). Extract a shared `UserAvatar` (image, or initials from the name and then the email) out of `EditorAvatars`, which then uses it. Leave the group, sections and tab-bar regions empty but in place, and shrink the timeline's own heading to a smaller page title (nothing else on the timeline changes).

### Acceptance criteria

- [ ] The header shows Caretook, the sync indicator and an avatar button on a 420-wide window, without wrapping.
- [ ] The avatar shows initials for the seeded users (no images) and has an accessible name ("Account menu for …").
- [ ] The menu opens by tap and keyboard (Enter, arrows, Escape, focus returns to the button), and shows the name and email.
- [ ] Settings navigates to `/app/settings`; Sign out signs out and `signout-wipe.mjs` still passes.
- [ ] `EditorAvatars` uses `UserAvatar` and `editors.mjs` still passes.
- [ ] Unit test for the initials helper (name, single name, email fallback, empty).
- [ ] New `app-shell.mjs` browser check covers the menu; `phase2.mjs` passes.

---

## Slice 2: Theme choice

**User stories:** US 6–8. **Blocked by:** 1. **Blocks:** none.

### What to build

A Theme item in the user menu: a radio group with System, Light and Dark. The choice is saved per device (`caretook:theme`) and applied as `data-theme` on `<html>`; System removes it so daisyUI follows the device. An inline script in `root.tsx` applies the saved theme before the page draws, in both build targets.

### Acceptance criteria

- [ ] Choosing Dark switches the page at once, and a reload stays Dark with no light flash (the attribute is set before first paint: check `document.documentElement.dataset.theme` from the first script that runs, or a screenshot taken at first paint).
- [ ] System follows `prefers-color-scheme` (emulate both in the check).
- [ ] With storage unavailable (it throws), the app still renders and uses System.
- [ ] The choice works offline and isn't sent to the server.
- [ ] The native build (`pnpm build:native`) succeeds with the script.
- [ ] `app-shell.mjs` covers theme persistence across reload.

---

## Slice 3: Group menu and last group

**User stories:** US 9–13, 34 (group menu part). **Blocked by:** 1. **Blocks:** 5.

### What to build

In the header's group region, on any `/app/groups/:groupId/*` route: the current group's display name (the recipient's preferred name or name, and then the group name) as a menu button. The menu lists every group from the local database (live, works offline), the current one checked; choosing one goes to its timeline. Every group route remembers its group per device and user. `/app` redirects to the remembered group if you're still a member, else to the only group, else shows the list (a pure `resolveHomeGroup` holds the rule). Add a second fictional group, in its own seed file, with member@ as owner and a few entries, so switching can be checked.

### Acceptance criteria

- [ ] The header shows "Grandma Pat" (the seeded recipient) on the Dev Family timeline, and the second group's recipient on its timeline.
- [ ] member@ switches groups from the menu in one tap, and the menu marks the current group.
- [ ] Opening `/app` after visiting the second group lands on the second group; after a reload too.
- [ ] A remembered group you're no longer in falls back to the list (or the only group) without an error.
- [ ] caretaker@ and viewer@ (one group each) still go straight to the timeline from `/app`.
- [ ] Off group routes (`/app/settings`), the group region is empty.
- [ ] Sign-out clears the remembered groups.
- [ ] Unit tests for `resolveHomeGroup` (remembered and present, remembered and gone, one group, none, several with none remembered).
- [ ] `app-shell.mjs` covers switching and the `/app` redirect; `phase2.mjs` passes after `datastore:reset`.

---

## Slice 4: Group sections nav

**User stories:** US 14–18. **Blocked by:** 1. **Blocks:** none.

### What to build

The `GROUP_SECTIONS` registry with one entry (Timeline), and two renderings of it on group routes: a bottom tab bar on phones, and links in the header's sections region on wide screens. The active section is marked and announced (`aria-current="page"`). The tab bar is hidden on the entry page (`/entries/:id` and `/entries/new`) and leaves room for the timeline's quick-add bar and bottom sheet (no overlap). A pure helper resolves the active section and whether the bar shows.

### Acceptance criteria

- [ ] At 420 wide, the timeline shows a bottom tab bar with Timeline marked current; nothing in the timeline (quick-add, the last entry, `EntrySheet`) is hidden behind it.
- [ ] At 1280 wide, the bar is gone and the header shows the section links.
- [ ] On `/entries/:id`, no tab bar, and the editor's toolbar and keyboard area are unaffected.
- [ ] Adding a section is one registry entry plus its route (the hand-off shows a throwaway example, not committed).
- [ ] Unit tests for the active-section and hidden-bar rules.
- [ ] `app-shell.mjs` covers both widths; `phase2.mjs` and `live-note.mjs` pass.

---

## Slice 5: Group settings: details

**User stories:** US 19–21, 29. **Blocked by:** 3. **Blocks:** 6.

### What to build

The route `/app/groups/:groupId/settings`, reached from "Group settings" at the bottom of the group menu. It shows the group's name and the care recipient's name, preferred name and date of birth. Owners and admins rename the group; owners, admins and caretakers edit the recipient; viewers see everything read-only. Names come from the local database; the date of birth (not synced) comes from a new `careGroup.recipient` call. Offline, the page renders read-only from local data with a "Needs a connection to edit" notice. Saves go through the route's `clientAction` (`intent` = `renameGroup` | `updateRecipient`) to new oRPC procedures `careGroup.update`, `careGroup.recipient` and `careGroup.updateRecipient`, thin over the existing services. A non-member gets the `/app` 404.

### Acceptance criteria

- [ ] member@ (owner) renames the group and edits the recipient; the header and the timeline show the new names without a reload (through sync).
- [ ] caretaker@ edits the recipient but not the group name; viewer@ sees both read-only, with no edit controls.
- [ ] Invalid input (an empty name, a date of birth that isn't a date; the shared Zod schema has no future-date rule, so don't add one here) shows the field's error and saves nothing.
- [ ] Offline (through `proxy.mjs`), the page loads from local data, shows the notice, and no save is attempted.
- [ ] A non-member's `/app/groups/<id>/settings` is a 404 that shows no names.
- [ ] Integration tests for the three procedures: owner, admin, caretaker, viewer and non-member, each with its own group.
- [ ] `app-shell.mjs` covers owner and viewer.

---

## Slice 6: Group settings: members

**User stories:** US 22–28, 30–31. **Blocked by:** 5. **Blocks:** none.

### What to build

A Members section on the group settings page: every member with avatar, name and role, from local data (live). Owners and admins change roles and remove members; only owners give or take the owner role; anyone can leave. Removing and leaving go through a `ConfirmDialog`. The last owner can't be demoted, removed or leave: the 409 (`careGroupMemberService:lastOwner`) and the owner-only refusal (`careGroupMemberService:ownerOnly`) show their messages. After leaving, the user goes to `/app`. New oRPC procedures `careGroup.changeRole` and `careGroup.removeMember` (removing yourself is leaving), thin over `careGroupMemberService`, with member DTOs that carry no email.

### Acceptance criteria

- [ ] member@ (owner) changes caretaker@ to viewer; caretaker@'s other device (a second Chrome) shows the change in the members list, and their next timeline screen has no writer controls.
- [ ] An admin can't make anyone an owner or change an owner (the control isn't offered; a forged request gets the owner-only message).
- [ ] The only owner trying to leave, or to demote or remove themselves, sees "A care group needs at least one owner. Make someone else an owner first." and nothing changes.
- [ ] viewer@ leaves after confirming, lands on `/app`, and the group is gone from their group menu.
- [ ] Removing a member asks for confirmation, and the removed member loses the group on their next sync.
- [ ] Integration tests: every role against `changeRole` and `removeMember`, owner-only rules, last owner, leaving, and no email in any response.
- [ ] `app-shell.mjs` covers role change, last-owner refusal and leave; run `pnpm datastore:reset` afterwards.

---

## Slice 7: Timeline layout in Settings

**User stories:** US 32–33. **Blocked by:** none (best after quick-fixes slice 2). **Blocks:** none.

### What to build

A "Timeline layout" choice (Rows or Cards) on `/app/settings`, writing `preferences.timelineView`: the same preference the timeline's toggle writes, through the same device-side save (quick-fixes slice 2's `saveSettings` if it has landed). The timeline's toggle stays.

### Acceptance criteria

- [ ] Choosing Cards in Settings, then opening the timeline, shows cards; flipping the timeline's toggle back to Rows, then opening Settings, shows Rows.
- [ ] The choice follows the account to another signed-in browser.
- [ ] `phase2.mjs` passes, and `app-shell.mjs` (or a small new check) covers the Settings choice.

---

## For the orchestrator

- **Claim:** B-8 for slice 1 (and 2); B-9 for slices 3–6. Mark B-8 `done` after slice 2 merges, and B-9 after slice 6. Slice 7 has no item of its own; note it on B-8.
- **Land early:** slice 1 alone is worth landing in `dev` before the next wave, because `timeline-polish`, `providers` and `medications` all wait on the frame.
