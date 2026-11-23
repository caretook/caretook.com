# Plan: Member avatars

> Source PRD: [`plans/member-avatars-prd.md`](member-avatars-prd.md). User-story numbers (US) refer to it. Backlog item B-593. Topic `member-avatars`.

## Status

| Slice | Wave | State       | Merge into `prd/member-avatars` (slice commits) |
| ----- | ---- | ----------- | ----------------------------------------------- |
| 1     | 1    | not started |                                                 |
| 2     | 2    | not started |                                                 |
| 3     | 3    | not started |                                                 |
| 4     | 4    | not started |                                                 |

**Start conditions:** `onboarding` and `ui-kit-5` have landed.

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
