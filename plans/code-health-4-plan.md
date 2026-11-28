# Plan: Code health 4

> Source PRD: [`plans/code-health-4-prd.md`](code-health-4-prd.md). User-story numbers (US) refer to it. Backlog item B-363. Topic `code-health-4`. Cut at planning: the services' and API's role-name checks and the screens in other topics' hot files go to the follow-on topic `code-health-5` (a new item, after `data-rights` and `account-security-2`).

## Status

**Where it stands:** planned; nothing started.

| Slice | Wave | State   | Merge into `prd/code-health-4` (slice commits) |
| ----- | ---- | ------- | ---------------------------------------------- |
| 1     | 1    | planned |                                                |
| 2     | 1    | planned |                                                |
| 3     | 2    | planned |                                                |
| 4     | 2    | planned |                                                |
| 5     | 2    | planned |                                                |
| 6     | 3    | planned |                                                |

**Backlog:** claim B-363 when slice 1 starts; run `risa backlog done B-363` when slice 6 has merged.

| Item                            | Slices           |
| ------------------------------- | ---------------- |
| B-363 one role-capability table | 1, 2, 3, 4, 5, 6 |

## Architectural decisions

Durable decisions every slice follows:

- **No behaviour change, no migration, no new dependency.** Every existing test passes unchanged; a role that would gain or lose access means stop and tell the orchestrator.
- **Names stay.** Every role set and check keeps the name it exports today; the new ones are the capability table, `isOwnerRole`, `completesOnlyAssigned`, and the todo completers' set moved into the role module.
- **Other topics' hot files stay untouched.** The services, the API package and the group details and profile route folders are `code-health-5`'s; slice 6's guard exempts them, marked "swept by code-health-5".
- **Comments say what the code does.** No new comment names a slice, a PRD or this plan.
- **Loops don't edit AGENTS.md or existing docs.** The orchestrator folds the docs at landing.

## How to run this plan

- **Waves:** (1, 2) → (3, 4, 5) → 6. Slices 3–5 need slice 1's `isOwnerRole`; slice 6's guard lands last, so its exempt list holds only what stays: the staff-role files and `code-health-5`'s.
- **Gates:** the tier the check plan proposes; no browser checks (no flow across the server and sync changes).
- **Shared files inside a wave:** none. Each slice's files are in its _What to build_.
- **Docs at landing (the orchestrator):** `docs/domain/care-groups.md`: the capability table as the one place a role's access is decided, the guard, and that a new role fills one row and the sync config's non-writer chain.
- **When it's done:** set `code-health-4` done; check that `code-health-5`'s item lists the guard's "swept by code-health-5" entries.

---

## Slice 1: The capability table

Stack: no · Reads: docs/domain/care-groups.md · Tests: unit · Check: packages/data/src/constants/roles.test.ts

**Backlog:** B-363. **User stories:** 1, 2, 3.

**What to build**

- `packages/data/src/constants/roles.ts`: the capability table (new, `GROUP_ROLE_CAPABILITIES`; PRD _The role-capability table (the role module)_), one row per role, every capability a boolean, `satisfies Record<GroupRoleName, …>`. The sets keep their names, values and exported types, worked out from the table where the type allows, else literal and tested. New: `isOwnerRole`, `completesOnlyAssigned`, and the todo completers' set (moved). Remove `isUserRoleName`.
- `packages/data/src/domain/todos/todoRules.ts`: its completers' set and `isTodoCompleter` come from the role module (`isTodoCompleter` and the completers' set stay exported from the domain too, `isTodoCompleter` equal to `completesOnlyAssigned`).
- The staff-settable list (the admin group rules) and the link list (the invite rules) stay literal and unchanged.
- `packages/data/scripts/googleSmoke.ts`: its viewer refusal becomes `!isWriterRole(role)` (it refuses the easy roles too, as its message already says: "Use a writer").

**Acceptance criteria**

- [ ] `roles.test.ts`: every set equals the roles the table marks for it (writers, loggers, managers, owners, easy roles, todo completers); `LINK_ROLES` equals the link-invitable roles and `STAFF_SETTABLE_GROUP_ROLES` the staff-settable ones; `isOwnerRole` and `completesOnlyAssigned` are true for exactly their roles and false for null and an unknown name.
- [ ] The todo rules' and invite rules' existing tests pass unchanged; `pnpm typecheck` finds no reader of `isUserRoleName`.

**Blocks:** 3, 4, 5.

---

## Slice 2: The copies tied to the table

Stack: no · Reads: docs/domain/sync.md, docs/domain/notifications.md · Tests: unit · Check: packages/data/src/constants/roleCopies.test.ts

**Backlog:** B-363. **User stories:** 4.

**What to build**

- `packages/data/src/constants/roleCopies.test.ts` (new): reads the real PowerSync sync config, finds the writers stream's `role != '…'` chain, and checks it lists exactly the roles `isWriterRole` refuses (prior art: the roles SQL test reads the same file).
- `packages/notifications/src/templates/groupInvite.tsx`, `packages/notifications/src/templates/joinRequests.tsx`, `packages/notifications/src/templates/staffGroupChange.tsx`: role enums built from the role module's group role names and link roles (through `@caretook/data`'s client-safe exports) instead of copied names.

**Acceptance criteria**

- [ ] The new copies test passes on today's config and fails (checked by hand once, reverted) when a non-writer is dropped from the chain.
- [ ] The notifications package's existing tests (`packages/notifications/src/notifications.test.ts` renders the templates) pass unchanged; `pnpm typecheck` passes.

**Blocks:** none.

---

## Slice 3: The group setup screens' role checks

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/care-groups.md · Tests: unit · Blocked by: 1 · Check: apps/web/app/lib/app-shell/groupSetup.test.ts

**Backlog:** B-363. **User stories:** 6.

**What to build**

- Each role-name comparison becomes the matching check: `apps/web/app/lib/app-shell/groupSetup.ts` (the first owner), `apps/web/app/routes/app/groups/layout/setupRedirect.ts` (owners only), `apps/web/app/routes/app/groups/settings/assistants/assistants.ts` (toggle: owner; manage: manager).

**Acceptance criteria**

- [ ] `groupSetup.test.ts`: the first-owner rule holds for an owner and fails for an admin and an easy role.
- [ ] The setup redirect's and the assistants page's existing tests pass unchanged.

**Blocks:** 6.

---

## Slice 4: The member settings' and timeline's role checks

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/care-groups.md · Tests: unit · Blocked by: 1 · Check: apps/web/app/routes/app/groups/settings/groupSettings.test.ts

**Backlog:** B-363. **User stories:** 6.

**What to build**

- `apps/web/app/routes/app/groups/settings/groupSettings.ts`: the roles a manager may give (only an owner gives owner) through `isOwnerRole`.
- `apps/web/app/routes/app/groups/settings/members/invites.ts` `mayRevoke`: managers through `isManagerRole`.
- `apps/web/app/routes/app/groups/timeline/InviteSomeoneCard.tsx`: its own managers list becomes `isManagerRole`.

**Acceptance criteria**

- [ ] `groupSettings.test.ts`: an owner may give every role, an admin every role but owner, a caretaker none.
- [ ] The members page's `invites.test.ts` and the timeline's existing tests pass unchanged.

**Blocks:** 6.

---

## Slice 5: The admin and connect screens' role checks

Stack: no · Reads: docs/domain/admin.md, docs/domain/connectors.md · Tests: component · Blocked by: 1 · Check: apps/web/app/routes/connectors/connect/connect.browser.test.tsx

**Backlog:** B-363. **User stories:** 6.

**What to build**

- `apps/web/app/routes/admin/group/MemberList.tsx` and the admin group page (`apps/web/app/routes/admin/group/route.tsx`): owner checks through the role module's owner check.
- `apps/web/app/routes/connectors/connect/ConnectConsent.tsx`: the owner check through the role module, the viewer check through `isWriterRole` (same result: the easy roles get no connector scopes, so they never see the read-only line).

**Acceptance criteria**

- [ ] `connect.browser.test.tsx`: a viewer sees the read-only line, a caretaker doesn't, and an owner sees the owner's wording.
- [ ] The admin groups' existing tests pass unchanged.

**Blocks:** 6.

---

## Slice 6: The role-name guard

Stack: no · Reads: docs/domain/components.md · Tests: unit · Blocked by: 3, 4, 5 · Check: scripts/eslint/rules.test.mjs

**Backlog:** B-363. **User stories:** 5.

**What to build**

- `scripts/eslint/role-guard.mjs` (new): the group role names (literal), the allowed paths by exact path with a reason per entry ("staff roles" for good, or "swept by code-health-5"), and the exempt check, after the kit guard's list.
- `scripts/eslint/plugin.mjs`: the rule (new, `caretook/no-role-names`) refusing the comparisons the PRD's _The guard_ names; it skips the role module, tests (browser-check specs under `scripts/browser-checks/` count as tests), the test worlds, seeds and exempt paths.
- `eslint.config.js`: the rule on, as `error`.

**Acceptance criteria**

- [ ] `rules.test.mjs`, a "the role guard" block: `role === "owner"`, `m.role !== "viewer"`, `myRole === "admin"` and `["owner", "admin"].includes(role)` are refused; `isOwnerRole(role)`, `kind === "link"` and `role === other` pass; an exempt path passes; the guard's role names equal `GROUP_ROLE_NAMES`.
- [ ] `pnpm lint` passes on the branch with only staff-role and `code-health-5` entries on the list. A comparison no slice swept, in a file no other topic has hot, is swept here; one in another topic's hot file goes on the list as "swept by code-health-5" and the hand-off names it for that item.

**Blocks:** none.
