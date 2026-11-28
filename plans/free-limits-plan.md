# Plan: Free plan limits (free-limits)

> Source PRD: [`plans/free-limits-prd.md`](free-limits-prd.md). User-story numbers (US) refer to it. Backlog item B-1012 (B-1013 is `free-limits-2`'s).

## Status

### From the user

- (none yet)

**Landing mode: run everything through** (started run-through, 2026-11-28): start every ready slice, land each green wave, ask only real questions.

**Models:** slices 1 to 4 on opus (real logic: locking, a migration, RBAC, a form).

**Now (2026-11-28):** wave 3 landed in dev through PR #337. Wave 4 started in a fresh session: prd/free-limits was already up to date with dev; slice 4 (opus) handed off and merged as 65213b017; CI run 46166324466 braked: plan format (fixed here) and users.browser.test.tsx (the openAdmin stub for groupLimit missing in adminWorld): fix 16b0b7fee merged as 76a46e674; CI rerun out. No new backlog items for free-limits at this boundary. **Next: merge slice 4, CI gate, PR + Codex, land; last wave: then mark B-1012 done and `risa rm free-limits`.**

| Slice | Wave | State  | Merge into `prd/free-limits` (slice commits) |
| ----- | ---- | ------ | -------------------------------------------- |
| 1     | 1    | landed | e66e2fecf (f04414fb5)                        |
| 2     | 2    | landed | 5e65f672a (68577a4fd)                        |
| 3     | 3    | landed | 194d554f9 (db891e817, 6c6f7341f)             |
| 4     | 4    | merged | 65213b017 (0751afb6c)                        |

## Architectural decisions

- **One rule, one place:** `groupLimitService` (new, `packages/data/src/services/`) owns the count, the limit and the refusal; `careGroupService.create` only calls it. Nothing else counts groups.
- **What counts:** groups whose `created_by` is the user and where they are still an owner. Invited, promoted, staff-started and access-code groups don't.
- **The user row is locked** (`FOR UPDATE`) before counting, so two creates at once can't both take the last slot.
- **The per-user limit is `user.group_limit`**, nullable (null: the `limits.groupsStarted` setting), written only as the system through `setForUser`. Never synced, never self-writable.
- **Staff writes follow the admin pattern:** `staffRefusal`, `auditActorId`, a reason, `adminAuditService.record` in the same transaction.
- **Adds one migration** (slice 2). Registries take additive edits at the end: `APP_SETTINGS`, `STAFF_CAPABILITIES`, `AUDIT_ACTIONS`, the services index, the care-groups errors.
- Stays clear of account-security's hot files: no change to `accountAdminService.ts`, `adminAuditService.ts`, `packages/auth/` or `packages/api/src/procedures.ts` (only imported).
- All test data is fictional (`@example.com`).

## How to run this plan

- One slice per wave, in order: each builds on the last (`groupLimitService` in 1, its override and staff calls in 2 and 3, the page in 4).
- Slices 1 and 2 share `groupLimit.int.test.ts` (different waves).
- account-security slice 4 also appends to `AUDIT_ACTIONS` and edits `usersAdmin.int.test.ts` (not its hot files): additive, so whichever lands second resolves a small conflict.
- **Hot files:** `packages/data/src/services/careGroupService.ts`, `packages/data/src/services/groupLimitService.ts`, `packages/data/src/db/schema/admin/appSettings.ts`, `packages/data/src/db/schema/admin/staffRules.ts`, `packages/data/src/db/schema/admin/adminAudit.ts`, `packages/data/src/db/schema/auth/user.ts`, `packages/data/src/db/migrations/`, `packages/data/src/permissions/auth.ts`, `packages/api/src/admin/usersAdmin.ts`, `apps/web/app/routes/admin/user/`.

## Slice 1: The cap on starting a care group

Stack: no · Reads: docs/domain/care-groups.md, docs/domain/admin.md, docs/domain/data-layer.md · Tests: integration · Blocked by: none · Check: packages/data/src/services/groupLimit.int.test.ts

**User stories:** US 1, 2, 3, 4.

**Build:** _The limit rule (`groupLimitService`, new)_ (its `refusal`) and the `APP_SETTINGS` bullet of _Schema_.

- `packages/data/src/db/schema/admin/appSettings.ts` `APP_SETTINGS`: `limits.groupsStarted` at the end (`wholeNumber(1, 100)`, default 3, not public, label "Care groups one account can start", `defaultText` "3").
- `packages/data/src/services/groupLimitService.ts` (new) `refusal(tx, userId)`: lock the user row `FOR UPDATE`, count started-and-owned groups, compare with the setting; `groupLimitService:atLimit` when at or over. Export it from the services index (at the end).
- `packages/data/src/errors/care-groups.ts`: `groupLimitService:atLimit`, 409, "You've started as many care groups as the free plan allows. Contact us if you need more."
- `packages/data/src/services/careGroupService.ts` `create`: call `refusal` first in its transaction, skipped for the system actor.
- Check the seeds (moreGroups and secondGroup, read only): any seed user a test or browser check uses to start a group stays under 3; if not, the test sets the setting, never the seed data. The first-sync browser check starts (and deletes) one group as caretaker@; it stays under the default.

**Acceptance criteria:**

- Integration (`groupLimit.int.test.ts` (new)):
  - a user who started 3 groups is refused the 4th with `groupLimitService:atLimit` and its message; nothing is created;
  - groups they were invited to, made owner of by another owner, or that staff (`createWithOwnerInvite`) or an access code started don't count;
  - a group they started but no longer own (ownership handed on, then left) doesn't count;
  - the setting at 1 refuses the 2nd;
  - two creates at once with one slot left: exactly one succeeds.
  - tests that change the setting call `clearSettingsCache()` first (the setting is cached per process).
- `pnpm prd check --quick` green.

**Blocks:** slice 2.

## Slice 2: One account's own limit

Stack: no · Reads: docs/domain/data-layer.md, docs/domain/admin.md · Tests: integration · Blocked by: 1 · Check: packages/data/src/services/groupLimit.int.test.ts

**User stories:** US 6, 7.

**Build:** the `user.group_limit` bullet of _Schema_; `refusal` reading it.

- `packages/data/src/db/schema/auth/user.ts` `userSchema`: `groupLimit` (`group_limit`, integer, nullable, check 1 to 1000). **Adds a migration** (`pnpm datastore:generate`).
- `packages/data/src/permissions/auth.ts` `AUTH_PERMISSIONS.userSchema.update.fields`: `groupLimit: SYSTEM_ONLY`.
- `groupLimitService.refusal`: the limit is `group_limit` when set, else the setting.
- Confirm the sync config's `user` stream still names only its columns (no change expected).

**Acceptance criteria:**

- Integration (`groupLimit.int.test.ts` (new in slice 1)):
  - a user with `group_limit` 5 (set as the system) starts a 4th and 5th group and is refused the 6th;
  - `group_limit` 1 refuses the 2nd even with the setting at 3; null falls back to the setting;
  - the user updating their own row with `groupLimit` is refused, and the column is unchanged;
  - the database refuses 0 and 1001.
- `pnpm prd check --quick` green.

**Blocks:** slice 3.

## Slice 3: Staff read and change the limit

Stack: no · Reads: docs/domain/admin.md, docs/domain/api.md · Tests: integration · Blocked by: 2 · Check: packages/api/src/admin/usersAdmin.int.test.ts

**User stories:** US 5, 6.

**Build:** `forUser` and `setForUser` in _The limit rule (`groupLimitService`, new)_; the capability and audit bullet of _Schema_; _API_'s admin procedures.

- `packages/data/src/db/schema/admin/staffRules.ts` `STAFF_CAPABILITIES`: `users.limits` for both roles, at the end of the users group.
- `packages/data/src/db/schema/admin/adminAudit.ts`: a new `user.setGroupLimit` in `AUDIT_ACTIONS` and its label "Changed the care group limit".
- `groupLimitService` `forUser(ctx, userId)` (`users.read`) and `setForUser(ctx, { userId, limit, reason })` (`users.limits`): one transaction, system write, `adminAuditService.record` with `auditChanges`; unchanged records nothing; an unknown user is `accountAdmin:notFound`.
- `packages/api/src/admin/usersAdmin.ts`: new `groupLimit` (`staffProcedure("users.read")`) and new `setGroupLimit` (`staffProcedure("users.limits")`), returning `{ started, limit, override }`.

**Acceptance criteria:**

- Integration (`usersAdmin.int.test.ts`):
  - support reads `{ started, limit, override }` for a member;
  - support and admin set a limit with a reason; one user.setGroupLimit audit row with `{ groupLimit: [null, 5] }`; setting it again to 5 adds none; null resets to the default;
  - a member calling either procedure is refused; a missing reason or 0 is a validation error.
- `pnpm prd check --quick` green.

**Blocks:** slice 4.

## Slice 4: The limit on the admin account page

Stack: no · Reads: docs/domain/admin.md, docs/domain/components.md · Tests: component · Blocked by: 3 · Check: apps/web/app/routes/admin/user/user.browser.test.tsx

**User stories:** US 5, 6.

**Build:** _Screens_' admin bullet.

- `apps/web/app/routes/admin/user/route.tsx`: load the new `admin.users.groupLimit` with the account; the action handles a `setGroupLimit` intent as the other help actions do (`accountActions.ts`).
- `apps/web/app/routes/admin/adminWorld.tsx`: stub the new procedure for `openAdmin` and `adminFx`; the no-`users.limits` case is a faked capability set (both roles hold it).
- `apps/web/app/routes/admin/user/AccountSections.tsx` `GroupsSection`: "Started n of limit" ("(default)" when no override) and, with `users.limits`, a Change limit form (number, blank for the default; reason), built from the page's existing help-action form pieces (HelpAction and adminForms, unchanged).

**Acceptance criteria:**

- Component (`user.browser.test.tsx`, with `adminFx`):
  - the Groups section shows "Started 2 of 3 (default)";
  - a staff viewer without `users.limits` sees no form;
  - changing the limit to 5 with a reason posts `setGroupLimit` with both, and the section then shows "of 5".
- `pnpm prd check --quick` green.

**Blocks:** none.
