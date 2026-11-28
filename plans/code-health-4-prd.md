# PRD: Code health 4 — one role-capability table

Backlog item B-363. Topic `code-health-4`. Follow-on topic `code-health-5` (a new item) takes the services' and API's call-site sweep.

## Decisions

| Decision                                                                                                                                                                                                                                           | Why                                                                                                                                                                                                 | Source  | Cost to change later                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------- |
| The services' and the API's role-name checks, and the screens in `data-rights`' hot files, move to a follow-on topic `code-health-5` (a new backlog item, after `data-rights` and `account-security-2`)                                            | the six-slice cap; and `careGroupInviteService`, `careGroupService` and the details and profile routes are `data-rights`' (running) hot files, `groupAdminService` `account-security-2`'s (planned) | assumed | low: the item moves back with one `risa backlog set` |
| Every capability is one row per role in one table (`GROUP_ROLE_CAPABILITIES`), typed so a new role can't compile without a value for each; the role sets are worked out from it                                                                    | the item's "before any role is added": adding a role becomes filling one row                                                                                                                        | assumed | low: pure module, one unit test                      |
| Keep today's check names (`isWriterRole`, `isLoggerRole`, `isManagerRole`, `isEasyRole`, `isOwnRowLogger`, `hasGroupRole`) and add `isOwnerRole` and `completesOnlyAssigned` (the todo completers), rather than rename to `canWrite`/`canComplete` | simple-mode's names already have about 60 readers; the item's names were examples                                                                                                                   | assumed | low: a rename                                        |
| No behaviour change                                                                                                                                                                                                                                | a refactor; the connect page's viewer check becomes a module check with the same result (the easy roles get no connector scopes, so never reach that line)                                          | assumed | —                                                    |
| A lint rule refuses a group-role name compared to a role (`role === "owner"`) outside the role module, with an exempt list that the sweep empties; staff (user) role checks stay exempt for good                                                   | the kit guard's pattern (`no-kit-classes`): it lands after this topic's sweep, so its list holds only the staff-role files and `code-health-5`'s, and only shrinks                                  | assumed | low: a list                                          |
| The invitable-by-link and staff-settable lists stay literal tuples (Drizzle's enum, the database check and `z.enum` need them) and a unit test ties each to the table                                                                              | deriving them changes their types; the test catches drift as well                                                                                                                                   | assumed | low                                                  |
| `powersync/sync-config.yaml`'s hand-listed non-writers stay hand-listed (PowerSync has no `IN` over a list); a unit test ties them to the table                                                                                                    | the file can't import                                                                                                                                                                               | assumed | low                                                  |
| `isUserRoleName` removed (no reader); `isGroupRoleName` kept (three readers)                                                                                                                                                                       | dead code                                                                                                                                                                                           | assumed | low                                                  |
| No migration, no new dependency, no docs beyond `care-groups.md` at landing                                                                                                                                                                        | refactor                                                                                                                                                                                            | assumed | —                                                    |

Skeptic (second pass, go): slice 1 keeps the todo completers' set exported from the domain; slice 6 counts browser-check specs as tests; the row's hot files name every path the slices touch. Declined: per-line disables instead of exempting the staff-role files by path (the kit guard's pattern; the staff files compare user roles, which `staffRules.ts` owns).

## Problem

Which group role may do what is written in several places: role sets in the role module, a todo-completer set in the todo rules, the invitable and staff-settable lists in their own modules, a non-writer list in the sync config, copied role enums in the email templates, and about 25 files that compare a role to its name (`role === "owner"`). Simple-mode gathered most of the sets into one module, but nothing forces new code to use it. Adding a seventh role today means finding every copy by hand; missing one gives the new role the wrong access somewhere, silently.

## Solution

One table in the role module says, per role, what it may do: write, log care, complete only its assigned todos, manage members, own the group, get the easy view, be invited by link, be set by staff. Every role set and check is worked out from that table. The copies that can't import it (the sync config) and the lists that must stay literal (database enums) are tied to it by unit tests that fail on drift. A lint rule refuses new role-name comparisons outside the module; this topic moves the web app's checks onto the module, and its follow-on moves the services' and API's.

## User stories

1. As a developer adding a role, I want one table row to fill in, with the compiler refusing a missing capability, so that the new role's access is decided in one place.
2. As a developer, I want every role set (writers, loggers, managers, owners, easy roles, todo completers) worked out from that table, so that the sets can't disagree.
3. As a developer, I want the invitable-by-link and staff-settable lists tied to the table by a test, so that a role change that forgets them fails before it lands.
4. As a developer, I want the sync config's non-writer list and the email templates' role enums tied to the table, so that a device never holds data its role may not see because a copy went stale.
5. As a developer, I want the linter to refuse `role === "<name>"` outside the role module, so that new code asks the table instead of naming a role.
6. As a developer, I want the web app's screens to check roles through the module, so that the guard's exempt list shrinks to the services the follow-on topic sweeps.

## Implementation decisions

### The role-capability table (the role module)

- `GROUP_ROLE_CAPABILITIES`: a record keyed by every group role name, each value naming every capability as a boolean: `write`, `log`, `completeAssignedOnly`, `manage`, `own`, `easyView`, `linkInvitable`, `staffSettable`. Typed with `satisfies Record<GroupRoleName, …>` so a missing role or capability fails to compile.
- The sets (`WRITER_ROLES`, `LOGGER_ROLES`, `GROUP_MANAGER_ROLES`, `OWNER_ROLES`, `EASY_ROLE_NAMES`, and the todo completers, moved in from the todo rules as `TODO_COMPLETER_ROLES`) keep their names and values; each is either worked out from the table or a literal the unit test ties to it, whichever keeps its exported type (`as const` tuples where a reader needs one).
- The checks keep their names and gain `isOwnerRole(role)` and `completesOnlyAssigned(role)`; the todo rules' `isTodoCompleter` stays as an alias the todo rules re-export, so its readers don't change.
- `isUserRoleName` goes; `isGroupRoleName` stays.
- The invite rules' link list and the admin rules' staff-settable list stay where they are, as literals, and the unit test checks each equals the roles the table marks `linkInvitable` / `staffSettable`.

### The copies outside the module

- The email templates (`@caretook/notifications`, which already depends on `@caretook/data`) build their role enums from the role module instead of copying the names.
- The timeline's invite card's manager list and the members page's revoke check use the module. (The device's `WRITER_ROLES` already re-exports the module's set.)
- `powersync/sync-config.yaml` keeps its `role != '…'` chain; a unit test reads the file and checks the chain lists exactly the non-writers.

### The guard

- A rule in the ESLint plugin (`caretook/no-role-names`): an `===`/`!==` comparison of a string literal naming a group role with an identifier or member named `role` or ending in `Role`, and `includes`/`some` over an array literal of group role names, is an error outside the role module, tests, seeds and the exempt list.
- The exempt list lives beside the kit guard's in its own module, by exact path, each entry with a reason: "staff roles" (permanent) or "swept by code-health-5" (temporary). Its role names are a literal list a test ties to the role module.

### The sweep (this topic: the web app outside other topics' hot files)

- Each comparison becomes the matching check (`isOwnerRole`, `isManagerRole`, `isWriterRole`, …); behaviour stays the same. A file leaves the exempt list when it's swept.

## Testing decisions

- Unit: the role module's table and sets (extends the existing role test), the copies test (new, reads the sync config), the lint rule (the plugin's rule test, valid and invalid cases, the exempt list's names tied to the module).
- The sweep: the existing unit or component test of a swept file, extended where a check's behaviour is visible (group setup's first-owner rule, the roles a manager may give).
- No integration or browser checks: no service, query or sync behaviour changes.
- Prior art: `scripts/eslint/kit-guard.mjs` and its tests in `scripts/eslint/rules.test.mjs`; `packages/data/src/db/roles/rolesSql.test.ts` reads the real sync config.

## Out of scope

- The services' and the API's role-name checks (`careGroupMemberService`, `careGroupInviteService`, `careGroupService`, `groupAdminService`, `assistantRequestService`, `calendarSettingService`, the connectors' `connect` and `groupOverview`), the group details settings page, the profile test world: `code-health-5`.
- Staff (user) role checks (`admin`, `support`): their rules live in `staffRules.ts`; the guard exempts them.
- Renaming the checks to `can…`.
- Any new role, or any change to what a role may do.

## Notes

- The planner's count on 2026-11-28: 33 comparisons in 25 non-test files; 8 of them staff roles. Each slice re-derives its own on its base.
- The profile test world's `isWriter = role !== "viewer"` treats the easy roles as writers; `code-health-5` fixes it with the sweep (it's in `data-rights`' hot folder).
