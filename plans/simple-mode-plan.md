# Plan: Easy roles

> Source PRD: [`plans/simple-mode-prd.md`](simple-mode-prd.md). User-story numbers (US) refer to it. Backlog items B-221 (locked simple mode becomes member roles) B-236 (dead links in locked simple mode) and B-400 (the Easy mode toggle moves into the timeline's header). Topic `simple-mode`.

## Status

| Slice | Wave | State                                                                                    | Merge into `prd/simple-mode` (slice commits)                        |
| ----- | ---- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1     | 1    | merged                                                                                   | cf858018 (f6723b7e, 8bd0f639); worktree removed                     |
| 2     | 2    | merged b07a18e8 (slice commits 1191b873, a38ef708, 1e4caeed, 4d6f08e3); worktree removed |                                                                     |
| 3     | 3    | merged                                                                                   | c790740e (55489df5, 5575d0f4, ec6dbe43, cc5c16d9); worktree removed |
| 4     | 4    | to do                                                                                    |                                                                     |
| 5     | 4    | to do                                                                                    |                                                                     |

**Landing mode: run everything through** (queued with `pnpm prd queue simple-mode`, 2026-11-21): start every ready slice, land each green wave, clean up; ask only real questions. Models: slice 1 sonnet (mechanical rename), slice 2 opus, slice 3 opus, slice 4 opus, slice 5 sonnet. Slice 3 notes: migration 0036 (locked → easy roles, `group` preference dropped); `care_group_member` in `REPLICATION_WHOLE_TABLES`; `timelineWorld.chooseEasyMode()` exists for slice 5. Slice 2 notes: migration 0035 (role checks); todo completion: the user chose (2026-11-21) one rule for viewer and both easy roles, own todos only, so the two errors became one, `todoService:completionOnly` (orchestrator fix on `prd/simple-mode`); viewers now get 403 on entry update/delete; screens still gate on `canWrite` (slice 3 uses `canLog`, `easyRole`, `canChangeEntry`); its quick check timed out under load (4 files, all passed alone). Slice 1 notes: migration 0034 (`care_group.easy_tiles`, `preferences.easyMode`); `care_group` added to `REPLICATION_WHOLE_TABLES`; stacks merging it need `pnpm datastore:reset`; its browser checks passed only on per-spec reruns after a mid-run reset.

**Synced dev** at the wave 3→4 boundary (24527743: ui-kit primitives and orchestration-3 wave 1); conflicts resolved in code (the role picker on ui-kit's `Field kind="select"`, Members error as `Message`, `simpleModeMembers` test dropped), so the pre-PR check is full. **Open:** `docs/domain/care-groups.md` is over its 10 KB budget (trim at landing); slice 3 doc folds (`resolveEasyMode`, `canLog`, `easyRole`, no Members switches, `care_group_member` whole-table replication, row menus by ownership, the entry page's `canSetUp`) still to do; `EasyModeToggle.tsx`'s "locked" comment is slice 5's.

**Start conditions (met 2026-11-21: list-filters, planner-2 and quick-fixes wave 17 in `dev`):** slice 1 renames files across the timeline, quick entry, todos and the app shell, which `list-filters` (the shared Filter dropdown, B-249), `planner-2` (remove reminders, repeating todos, B-248) and the current `quick-fixes` wave also touch. Start once those three are in `dev` (check `pnpm prd status`), and `pnpm prd sync` first. If the user starts it earlier, slice 1 syncs `dev` again right before its merge and redoes the rename over whatever arrived.

**Landing:** this PRD adds migrations (slices 1, 2 and 3) and changes the sync config, so hold landing until every slice is merged, then check once at the end (`pnpm prd check --quick` unless a full check is needed). Never `--suite` without asking. The landing mode is the orchestrator's first question unless the PRD was queued; record it here.

**Backlog:** claim B-221 and B-236 when slice 1 starts; `done B-236` after slice 4 merges, `done B-221` after slice 4 too (the roles aren't usable end to end before it). Claim B-400 when slice 5 starts and `done B-400` after it merges.

**New dependencies:** none.

Fold into the area docs at each landing:

- **Slice 1:** every "simple" in `app-shell.md`, `timeline.md`, `care-groups.md`, `assistant.md`, `search.md`, `todos.md`, `sync.md`; the new column and preference key in `care-groups.md` and `data-layer.md`.
- **Slice 2:** the two roles, `LOGGERS`, `EASY_ROLES` and the own-rows scope in `care-groups.md` and `data-layer.md`; the writers stream and upload rules in `sync.md`; the refusal in `connectors.md`; completion-only in `todos.md`; the own-rows rule for notes in `live-notes.md` and entries in `timeline.md`.
- **Slice 3:** `resolveEasyMode`, `canLog`, `easyRole`, the Members page and the picker in `app-shell.md` and `care-groups.md`; row menus by ownership in `timeline.md`.
- **Slice 4:** the allow-list in `app-shell.md`; the read-only Planner and todo page in `todos.md`; the read-only sheets in `search.md`.
- **Slice 5:** the toggle's place in `timeline.md` (the full view's header, the View options menu) and `app-shell.md` (Easy mode).

## Architectural decisions

- **Words:** "easy" everywhere a person, a doc or code names this feature. Stored role values `easy_helper` and `easy_viewer`; labels "Easy helper" and "Easy viewer". The topic slug, landed migrations and their snapshots, the archive and finished PRDs and plans keep "simple": never sweep them.
- **Role sets, one source:** `ANY_GROUP_ROLE` (six roles), `WRITERS` (owner, admin, caretaker: unchanged), `LOGGERS` (`WRITERS` + `easy_helper`), `EASY_ROLES` (the two), `MANAGERS`, `OWNERS`. Defined beside `GROUP_ROLE_NAMES` (client-safe) and re-exported by the permission blocks. No comparison to a role string outside them, in TypeScript or (as far as PowerSync allows) the sync config, whose writers stream lists its excluded roles with a comment naming this rule.
- **Own-rows scope:** `PermissionEntry` gains `groupOwn: readonly GroupRoleName[]`: with one of these roles in the row's group, the permission holds only on rows whose `created_by` is the actor. The models enforce it in SQL alongside `group`; `hasPermission` (UI) takes the row's creator. Used by `timeline_entry` update and delete and the live-note document's update.
- **An Easy helper's writes:** create on hand-written timeline kinds, dose logs, pass logs; update and delete on own entries; completing a todo assigned to them. Everything else is refused by the models' permissions first, the services second. An Easy viewer reads what a viewer reads and may only complete a todo assigned to them (the viewer's rule: one rule and one error, `todoService:completionOnly`, for all three).
- **Gates on the device:** `canWrite` (setup, `WRITERS`), `canLog` (`LOGGERS`), `easyRole` from the group context. Local `*.sync.ts` writes check the same sets before writing, so a refused upload is never queued.
- **Migrations stay additive:** new column and key in slice 1, the role check in slice 2, the conversion in slice 3. Old columns and the old key are left unread for a later contract migration. Say "adds a migration", never a number; a slice merging second regenerates on top.
- **No manager switch:** `setMemberMode` and `setMode` are deleted in slice 3, not deprecated.
- **One toggle, one place:** `EasyModeToggle` is the only control that flips this device's toggle on a timeline, on the right of the page header in both views ("Easy mode" on the full timeline, "Full app" on the easy one), and renders nothing when the member can't toggle.
- **Seeds:** Dev Family gains one Easy helper and one Easy viewer (fictional, own ids, appended last) in slice 2.

## How to run this plan

- **Wave 1: slice 1** (the rename; alone, because it touches every file the others edit). Gate: `pnpm check`, and a grep for `simple` showing only the deliberate old names.
- **Wave 2: slice 2** (the roles on the server and the picker). It owns the role constants, the permission scope, the sync config and the seeds.
- **Wave 3: slice 3** (the role decides the view). It owns `easyMode.ts`, the group context, the frame, the Members page and the conversion migration.
- **Wave 4: slice 4** (pages). It owns the allow-list, the Planner's and todo page's easy variants and the search sheets.

- **Wave 4 also: slice 5** (the toggle in the header), beside slice 4. It owns `TimelineHeader.tsx`, `TimelineViewMenu.tsx`, `EasyModeToggle.tsx`, the timeline route's wiring of the two and `timelineHeader.browser.test.tsx`; in the easy timeline's tests it changes only the lines that switch views. Slice 4 stays out of those files.

One slice per wave until wave 4: each of slices 2, 3 and 4 needs the one before it merged into `prd/simple-mode`; slices 4 and 5 both need slice 3 and run at once.

## Slice 1: Simple becomes easy

Stack: yes · Reads: docs/domain/app-shell.md, docs/domain/timeline.md, docs/domain/care-groups.md, docs/domain/sync.md, docs/domain/data-layer.md · Tests: unit, integration, component

**User stories:** 30–33.

**Build.**

- Text: every label, heading, menu item, hint, error and email that says "simple" ("Simple mode" → "Easy mode", "simple view" → "easy view").
- Code: files, components, functions, types, constants, tests and data attributes (`simpleMode.ts` → `easyMode.ts`, `SimpleTimeline` → `EasyTimeline`, `resolveSimpleMode` → `resolveEasyMode`, `simpleModeLock` → `easyModeLock`, `SIMPLE_*` → `EASY_*`, `check-areas.d` entries, browser-check selectors). The device toggle's localStorage key too; an old key is ignored.
- Database (**adds a migration**, additive): `care_group.easy_tiles` copied from `simple_tiles`; `user.preferences.easyMode` copied from `simpleMode` with the value `simple` → `easy`. The Zod schemas (`easyTilesZSchema`, `EASY_MODE_SETTINGS`: `group | easy | full` for now), the services, the oRPC inputs, `sync-config.yaml`, the device schema and `pnpm db:roles` follow. The old column and key stop being read or written.
- **Not renamed here:** `care_group_member.simple_mode` and `simple_mode_locked` (slice 3 retires them; their TypeScript property names stay until then) and the deliberate old names above.
- Docs: the area docs' wording.

**Acceptance criteria.**

- [ ] `grep -ri simple` over `apps`, `packages`, `powersync`, `scripts` and `docs/domain` finds only: the two member columns and their properties, landed migrations and snapshots, and unrelated uses of the word.
- [ ] Integration test: after the migration a group's saved tiles and a user's own setting read back unchanged through the new column and key.
- [ ] The sync matrix and `roles.int.test.ts` pass with the new column.
- [ ] Existing unit, integration and component tests pass under their new names with no behaviour change.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** the start conditions. **Blocks:** 2.

## Slice 2: Easy helper and Easy viewer on the server

Stack: yes · Reads: docs/domain/care-groups.md, docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/timeline.md, docs/domain/live-notes.md, docs/domain/todos.md, docs/domain/medications.md, docs/domain/connectors.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** 1–5, 9–17, 25, 27, 34.

**Build.**

- `GROUP_ROLE_NAMES` and `GROUP_ROLES` gain the two roles with the PRD's descriptions and a `group: "regular" | "easier"` field for the picker. **Adds a migration** (the role check re-made on memberships, invites, join requests and access codes, wherever a role is stored).
- The role sets (`LOGGERS`, `EASY_ROLES`) beside the constants; replace every role-string comparison with a set check (`todos.sync.ts`, `connectGuide.ts`, `WRITER_ROLES` users, the sync config's writers stream).
- The `groupOwn` permission scope in the types, the SQL builder and `hasPermission`, with unit and integration tests of its own.
- `PERMISSIONS`: timeline entries (create `LOGGERS`; update and delete `WRITERS` + own rows for `easy_helper`), dose and pass logs (`LOGGERS`), the live-note document (own rows), todos (`todoService`: a viewer and both easy roles complete only todos assigned to them, with one returned error). Every other table: read for `ANY_GROUP_ROLE`, write for `WRITERS` as now.
- Services and upload handlers: refuse an Easy helper's system-written kinds, another member's entry, and every setup op; errors are returned.
- Sync: `care_group_writers` excludes both easy roles; the matrix rows.
- Connectors: authorisation and tool calls refused for `EASY_ROLES`; the guide's entry points hidden for them.
- The role picker (`ui/`-level only if an existing control can't group; otherwise a native grouped control) on invite, the Members page and join approval: two groups, "Easier to use" second, each role's description.
- The group context's `canWrite`, `canLog`, `easyRole`; local `*.sync.ts` writes for entries, doses, passes and todos check `canLog`, or for todos the completion rule for the role (own todos only for the easy roles), instead of `canWrite`.
- Seeds: one Easy helper, one Easy viewer in Dev Family.

**Acceptance criteria.**

- [ ] Unit tests: the role sets; `groupOwn` in `hasPermission`; picker grouping.
- [ ] Integration tests: the role matrix (each of six roles against each table's create, read, update, delete); an Easy helper edits and deletes their own entry and note, and is refused on another's, in SQL; logs a dose and a pass and undoes it; both easy roles tick a todo assigned to them and are refused on another member's and an unassigned one, and can't edit any; a viewer ticks only their own too; an Easy viewer is refused every other write.
- [ ] Integration tests: uploads as an Easy helper (each allowed op lands, each setup op is refused); the writers stream holds no rows for either easy role; a connector authorisation and a tool call are refused, and an existing connection stops working after a role change.
- [ ] Integration test: invites, join approvals and access codes accept the two roles; only managers assign them; only owners change an owner.
- [ ] Component tests: the picker's groups and descriptions on invite and Members; a member row shows "Easy helper".
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 1. **Blocks:** 3.

## Slice 3: The role decides the view

Stack: yes · Reads: docs/domain/app-shell.md, docs/domain/timeline.md, docs/domain/care-groups.md, docs/domain/sync.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** 6–8, 18, 24, 26, 28, 29.

**Build.**

- `resolveEasyMode({ role, ownSetting, deviceToggle })`: easy roles always easy, no toggle; otherwise toggle, then own setting. `EASY_MODE_SETTINGS` becomes `easy | full` (a stored `group` reads as full); the Timeline layout card loses "Follow the group".
- The frame and user menu key on `easyRole` where they keyed on `locked` (no "Full app", "Your care groups" when several).
- The easy timeline: inputs by `canLog`; row ⋯ menus and edit sheets for writers on every row and an Easy helper on own rows; an Easy viewer gets ticks on their own todos and nothing else. The My todos card already lists only the member's own.
- The lock module redirects by `easyRole` (same allow-list as today: timeline and `entries/*`; slice 4 widens it).
- The Members page: remove both switches, `memberAccess().simpleMode` and `.lock`; delete `careGroup.setMemberMode`, `careGroupMemberService.setMode` and their errors.
- **Adds a migration:** locked caretakers → `easy_helper`, locked viewers → `easy_viewer`, locked owners and admins unchanged. `simple_mode` and `simple_mode_locked` leave the Drizzle reads and writes, the sync config, the device schema and the grants (the columns stay for a later contract migration).

**Acceptance criteria.**

- [ ] Unit tests: `resolveEasyMode` for each role, setting and toggle; the redirect by role.
- [ ] Integration test: the conversion (locked caretaker, locked viewer, locked admin, unlocked members untouched); `setMemberMode` is gone from the router.
- [ ] Component tests: an Easy helper's timeline (box, tiles, Given all; a menu on their own row, none on another's; no "Full app"); an Easy viewer's (no inputs, ticks on their own todos work); a caretaker who chose Easy mode keeps every menu and "Full app"; the Members page has no switches.
- [ ] The sync matrix passes without the two columns.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 2. **Blocks:** 4, 5.

## Slice 4: Pages for the easy roles

Stack: yes · Reads: docs/domain/app-shell.md, docs/domain/todos.md, docs/domain/search.md, docs/domain/providers.md, docs/domain/medications.md, docs/domain/profiles.md, docs/domain/components.md · Tests: unit, component, e2e:app-shell

**User stories:** 19–24.

**Build.**

- The allow-list gains the Planner, todo pages and search; everything else still redirects to the timeline.
- The Planner for `easyRole`: the list in the reduced frame; no add, edit sheets, tabs or filters. "See all" on the Upcoming card reaches it (B-236).
- A todo page for `easyRole`: its details, and the tick only when it's assigned to them; no edit, assign or delete. Todo links on the easy timeline open it.
- Search for `easyRole`: the magnifier in the reduced header; all result types. A provider, medication or condition result opens a read-only sheet over the search page (a provider's name, role, phone with call and directions; a medication's name, dose and schedule; a condition's name, status and note), built from the existing read components, with no links onward.
- The browser check that owns the app shell gains one step for an Easy helper.

**Acceptance criteria.**

- [ ] Unit tests: the allow-list for each allowed and refused path, for both easy roles and a regular role.
- [ ] Component tests: "See all" opens the read-only Planner; a todo link opens its page; the tick works on their own todo and is absent on another member's (both roles); search shows every type and opens the three read-only sheets; a typed URL for Medications redirects to the timeline.
- [ ] `e2e:app-shell`: an Easy helper signs in, logs an entry, opens "See all" and search, and is redirected from Medications.
- [ ] No link an easy role can tap leads to a redirect.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 3. **Blocks:** none.

## Slice 5: Easy mode in the timeline's header

Stack: no · Reads: docs/domain/timeline.md, docs/domain/app-shell.md, docs/domain/components.md · Tests: component

**User stories:** 35 (and 28, 29).

**Build.**

- The full timeline's header (`TimelineHeader`) takes the easy-mode state and passes `EasyModeToggle` as `PageHeader`'s `actions`: a ghost button, icon and the label "Easy mode", on the right of "Timeline" at every width (B-400).
- `EasyModeToggle` says "Easy mode" on the full timeline (it said "Easy view" after slice 1's rename) and "Full app" on the easy one, with the same size and data attribute in both, and still renders nothing when the member can't toggle.
- `TimelineViewMenu` loses its `easyMode` prop, the item and the separator; its doc comment and `chooseViewOption`'s follow.
- The tests' way into the easy view becomes the header button (a `timelineWorld` helper) instead of the View options item.
- Unchanged: the top app bar, the user menu's "Full app", the Timeline layout page's setting, and what the toggle stores.

**Acceptance criteria.**

- [ ] Component tests (`timelineHeader.browser.test.tsx`): a caretaker's full timeline shows "Easy mode" in the header beside "Timeline"; pressing it shows the easy view, whose "Full app" brings the full timeline back; the choice survives a reload on this device.
- [ ] Component tests: the View options menu has Layout and Day summaries and no view-switch item; a viewer gets the button too; a member who can't toggle (an Easy helper) gets no button in either view.
- [ ] Component test: at phone width the title and the button stay on one row with a 44 px target.
- [ ] The easy timeline's existing tests pass, switching views through the header button.
- [ ] `pnpm check` passes (no browser check changes: none selects the old menu item).

**Blocked by:** 3. **Blocks:** none.
