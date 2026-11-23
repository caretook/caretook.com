# Plan: Member avatars

> Source PRD: [`plans/member-avatars-prd.md`](member-avatars-prd.md). User-story numbers (US) refer to it. Backlog item B-593. Topic `member-avatars`.

## Status

| Slice | Wave | State       | Merge into `prd/member-avatars` (slice commits)   |
| ----- | ---- | ----------- | ------------------------------------------------- |
| 1     | 1    | landed      | 816ac0c5 (aa217ed2, cd475969, 0cd26332, 129dbb45) |
| 2     | 2    | landed      | a8f52f91 (567e2913), opus                         |
| 3     | 3    | merged      | 3c244581 (14c5af53), opus                         |
| 4     | 4    | not started |                                                   |

**Landing mode:** run everything through (started run-through). Land each green wave, clean up, and ask only real questions through `pnpm prd ask`.

**Now (2026-11-23):** wave 1 landed as a3e635e2 (PR #125). Wave 2 landed in `dev` as b1ee1d19 through PR #128, at tier `components` (CI run 45245508309 green on 38582b4d), with the browser suite 11 of 11. Codex did not review either wave (out of credits, `--no-review`). Report a156 is filed. **Wave 3:** slice 3 is merged (3c244581) and `dev` is merged in (42926067, which brings migration 0042 from another PRD). CI `components` is green on 5c165580 (run 45250105596) and the slice worktree is removed. Browser checks for the diff: live-notes, app-shell and first-sync passed; `ui` failed once (the phone add sheet measured zero size), then passed 3 of 3 alone, filed as B-727 (ui browser check: the phone add sheet intermittently measures zero size), cause unknown. `pnpm prd pr` refused the unsynced tip, so `dev` was merged again (a0e7157b, app code from other PRDs) and PR #133 is open. **Next:** the `components` CI run on this tip and the Codex review, then land wave 3. B-593 stays claimed until slice 4 merges.

**For slice 4 (from slice 3's hand-off):** use `<MemberAvatar userId name image />` from `components/members`. `KindIcon`, `PlannerHeader` and `TimelineFilters` still use plain `UserAvatar`. `ProfileHeader` does too and isn't in slice 4's list: decide at slice 4. Known limits: past ten members a leaver can move someone on a repeated color to the freed one; avatars can show neutral briefly on entering a group; a quick A to B to A change can briefly show B.

**No local quick check when CI will run (the user, 2026-11-23):** after a merge or dev sync, go straight to `pnpm prd ci run`. The slice agent's own check on its branch stays. Order per wave: merge, `pnpm prd sync`, one CI run on that tip, land on its verdict, with no quick check after the sync. Only docs commits go on top of the green tip, so the verdict still counts.
**Rechecks:** the user's "skip rechecks after a clean dev sync" covered wave 1 only. Later waves recheck after each dev sync unless the user repeats it.

**Docs:** `sync` and `care-groups` are folded for waves 1 and 2 (the device queue is in `sync`). `app-shell` (the picker) and `ui-kit` (`UserAvatar` looks, tokens) are still to fold, at the waves that finish them. Both sit a few bytes under their 10 KB budget, so trim as much as you add.

**For later slices:** slice 3: an icon-only avatar sits on `bg-primary` until the per-group default exists. The overlay can read `useMyAvatar`, which already returns the pending choice first. Another device's change reaches the header only on the next page load until the synced row does it, and other open tabs don't update live. Known limit from slice 2: a choice refused during a background send is dropped with no message and isn't on "Changes not saved".

**Start conditions:** `onboarding` and `ui-kit-5` have landed (both confirmed done on `dev`, 2026-11-23).

**Landing:** one additive migration (slice 1), a sync-config and publication change, no new dependency. After pulling it, run `pnpm datastore:reset` locally.

**Backlog:** claim B-593 when slice 1 starts; `done` it when slice 4 merges.

Fold into the area docs at landing: [profiles](../docs/domain/profiles.md) or [app-shell](../docs/domain/app-shell.md) (the picker and the device queue), [sync](../docs/domain/sync.md) (the `user` columns in the publication and stream), [care-groups](../docs/domain/care-groups.md) (the public profile fields), [ui-kit](../docs/domain/ui-kit.md) (`UserAvatar` looks and tokens).

## Architectural decisions

- **Stored:** two nullable `user` columns, a color id and an icon id, from a fixed client-safe catalog. Never free text or URLs. Checked by Zod and a database check.
- **Visible to:** co-members, through the public profile fields, the user model's co-member row and the `member_profiles` stream. Never email or preferences.
- **Written:** only by the member, through a self-only `me` procedure. `user` stays out of the upload registry.
- **The publication changes by dropping and re-adding `user` in the migration.** Never `SET TABLE` there: it would remove every other table.
- **The offline queue is the avatar's own,** with `null` meaning cleared. It never goes through `updatePreferences`.
- **Default colors are derived, never stored,** by one pure resolver: chosen colors reserved, then join order (`created_at`, then membership id), hashed color or next free.
- **An unknown id reads as unset,** so an older device survives a newer catalog.
- **No external requests;** the CSP doesn't change.
- `UserAvatar` stays pure in `ui/`; only the member-aware avatar reads group data.

## How to run this plan

Four waves, one slice each, because each builds on the last. Slice 1 owns the migration and sync config. Slice 2 owns the device queue. Slice 3 owns the resolver and provider. Slice 4 owns the Timeline and Planner call sites.

## Slice 1: Choose your avatar (online)

Stack: yes · Reads: docs/domain/sync.md, docs/domain/data-layer.md, docs/domain/api.md, docs/domain/app-shell.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: unit, integration, component, e2e:roundtrip

**User stories:** US 1, 2, 3, 8, 9, 10.

**Build:** the catalog; the color tokens; adds a migration (the two `user` columns, checks, `user` dropped from and re-added to the publication with its new column list); public profile fields, the user model's co-member row and type, `member_profiles` stream and device schema; the `me` read and self-only write; `UserAvatar` looks; the Avatar card in Account settings with a live preview, saving online; the header showing your choice.

**Acceptance criteria:**

- [ ] Unit: the catalog's schema refuses unknown ids and free text; its reader treats an unknown id as unset.
- [ ] Unit: every avatar color reaches 4.5:1 against its content color in both themes and keeps its hue distance from the status and section colors.
- [ ] Integration: a member sets and clears only their own choice; invalid ids are refused by the API and the database.
- [ ] Integration: a co-member's read includes both ids and no email or preferences; after the migration every other table is still in the publication; the roles and permissions tests that pin the public column list are updated and pass.
- [ ] Component: the picker saves and clears; `UserAvatar` renders color only, icon only, both and neither; the header shows the choice.
- [ ] E2E: one short `roundtrip` step: one member chooses, the other's device receives the ids. It stays within the lean ceiling.

**Blocked by:** none. **Blocks:** 2.

## Slice 2: Choose while offline

Stack: no · Reads: docs/domain/sync.md, docs/domain/app-shell.md, docs/domain/components.md · Tests: unit, component

**User stories:** US 4.

**Build:** the avatar's own device cache and pending entry, with its send step on save and on refresh, cleared at sign-out; the picker and header reading it, so a choice shows at once offline.

**Acceptance criteria:**

- [ ] Unit: a queued avatar and a queued units change both reach the server; a refused avatar doesn't drop the units change, or the reverse; a queued clear is sent as `null`; sign-out forgets the queue.
- [ ] Component: a choice made offline shows in the picker and header, and survives a reload.

**Blocked by:** 1. **Blocks:** 3.

## Slice 3: A different default color in each group

Stack: no · Reads: docs/domain/care-groups.md, docs/domain/live-notes.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: unit, component

**User stories:** US 5 (Members, live-note editors), 6, 7.

**Build:** the pure resolver; a device query for a group's looks; the per-group looks provider, overlaying your own choice until the synced row matches what was sent; the member-aware avatar; use it on the Members page and in live-note editors.

**Acceptance criteria:**

- [ ] Unit: the resolver gives the same answer for any input order; distinct colors up to ten members; chosen colors reserved; a joiner with no chosen color moves nobody; a joiner with one moves only its holder and anyone that shift pushes on; a leaver moves only members pushed off their hashed color; colors repeat past ten; join-time ties break on membership id.
- [ ] Component: the Members page and `EditorAvatars` show chosen looks and defaults; a former member stays neutral with initials; a member with no icon still shows their initials; your own look doesn't revert between the server accepting a choice and the synced row arriving.

**Blocked by:** 2. **Blocks:** 4.

## Slice 4: Avatars on the Timeline and Planner

Stack: no · Reads: docs/domain/timeline.md, docs/domain/components.md, docs/domain/ui-kit.md · Tests: component

**User stories:** US 5 (Timeline, Planner, filters).

**Build:** replace the author circles and avatars in Timeline rows and cards, dose passes, Planner rows, and the author filter chips and tooltips with the member-aware avatar, in the easy and read-only variants too. Remove the `image` props this leaves unused.

**Acceptance criteria:**

- [ ] Component: Timeline rows, pass rows and Planner rows show the author's look, and keep `data-author`, the filter link's name and the screen-reader name.
- [ ] Component: the easy and read-only author circles show the look; the filter chip and tooltip match the row.
- [ ] No screen still renders author initials outside the shared avatar (checked by a search in the handoff).

**Blocked by:** 3. **Blocks:** none.
