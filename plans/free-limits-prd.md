# PRD: Free plan limits (free-limits)

Backlog: B-1012. B-1013 (sign-ups per address) moved to the follow-on topic `free-limits-2` (see _Out of scope_).

## Decisions

| Decision                                                                                                                                                                                                                       | Why                                                                                                                                                                                                           | Source                                                  | Cost to change later               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| B-1013 (sign-ups per address, IP and device) moves to a follow-on topic `free-limits-2`, after account-security                                                                                                                | every part of it changes `packages/auth/src/tickets.ts`, a hot file of the running account-security topic, whose slice 2 rewrites link sign-up there and adds the per-IP and per-link limits B-1013 builds on | assumed                                                 | low: the item waits in its own row |
| The cap counts groups the user **started** (`care_group.created_by` is them) **and still owns**; groups they were invited to or made owner of by someone else don't count, nor groups staff or an access code started for them | the item: "count groups the user created or owns, not ones they were invited to"; handing a group on frees a slot                                                                                             | assumed                                                 | low: one query                     |
| A per-user limit is a nullable `user.group_limit` column (null: the default), writable only by the system                                                                                                                      | staff lift it per user; one value per account, beside `disabled_*`                                                                                                                                            | assumed                                                 | medium: adds a migration           |
| The default is an app setting, `limits.groupsStarted`, 3 (1 to 100), admins change it (`settings.write`)                                                                                                                       | the item: "pick a default (e.g. 3)"; settings change without a deploy                                                                                                                                         | assumed                                                 | low                                |
| Support and admin can lift one user's limit (new capability `users.limits`), each change with a reason and an audit row                                                                                                        | a help action for one person, no care data, reversible                                                                                                                                                        | asked: decided by the skeptic (a391), Support and admin | low: one line in `staffRules.ts`   |
| The cap is checked only on `careGroup.create`, the member's own New care group; staff groups with an owner invite and access-code sign-up are not capped                                                                       | staff choose to make those; a new account owns nothing yet                                                                                                                                                    | assumed                                                 | low                                |
| Users already over the cap keep every group; only starting another is refused                                                                                                                                                  | no change to existing data                                                                                                                                                                                    | assumed                                                 | none                               |
| A staff limit is a number from 1 to 1000; there is no "unlimited"                                                                                                                                                              | the smallest form; 1000 is unlimited in practice                                                                                                                                                              | assumed                                                 | low                                |
| The refusal shows on the New care group sheet when the person submits, through the sheet's existing error message: "You've started as many care groups as the free plan allows. Contact us if you need more."                  | the sheet already shows API refusals; the limit isn't on the device                                                                                                                                           | assumed                                                 | low: wording                       |
| The admin account page's Groups section shows "Started n of limit" and, for `users.limits`, a Change limit form (a number, blank for the default, and a reason)                                                                | the place staff already see the person's groups                                                                                                                                                               | assumed                                                 | low                                |

## Problem

Caretook is free for now. Nothing stops one account from starting any number of care groups, so the free plan has no reasonable bound, and staff have no way to give one person more room when they need it.

## Solution

Each account may start a few care groups (3 by default, an app setting). Starting one more is refused with a clear message. Staff (support and admin) can raise one account's limit from its admin page, with a reason, and the change is audited. Groups someone joins, or is made owner of by someone else, never count.

## User stories

1. As a member at the free plan's limit, I want a clear message when I try to start another care group, so that I know why and what to do.
2. As a member who was invited to several groups, I want those not to count, so that joining a family's group never stops me starting my own.
3. As a member who handed a group I started to someone else, I want it to stop counting, so that I can start another.
4. As a Caretook admin, I want to change the default limit without a deploy, so that the free plan can be tuned.
5. As support or an admin, I want to see how many groups an account has started and its limit, so that I can answer their question.
6. As support or an admin, I want to raise (or reset) one account's limit with a reason, so that a person with a real need isn't blocked, and the change is on the record.
7. As a member, I want my limit to be something I can't change myself, so that the limit means something.

## Implementation decisions

### The limit rule (`groupLimitService`, new)

- `refusal(tx, userId)`: locks the user's row (`FOR UPDATE`, so two creates at once can't both pass the last slot), counts the groups the user started and is still an owner of, and returns `groupLimitService:atLimit` (409, the message above) when the count is at or over the user's limit, else nothing. The limit is `user.group_limit` when set, else the `limits.groupsStarted` setting (`appSettingService.getSetting`).
- `careGroupService.create` calls it first, inside its transaction, for a non-system actor. Nothing else changes in create.
- `forUser(ctx, userId)` (staff `users.read`): `{ started, limit, override }` (`override` null when the default applies).
- `setForUser(ctx, { userId, limit, reason })` (staff `users.limits`; `limit` a whole number 1 to 1000, or null for the default; `staffReasonZSchema`): in one transaction, writes the column as the system, records `user.setGroupLimit` with `{ groupLimit: [before, after] }` through `adminAuditService.record`; an unchanged value records nothing. Starts with `staffRefusal(ctx, "users.limits")` and `auditActorId(ctx)` as every staff service does.

### Schema

- **Adds a migration:** `user.group_limit` integer, nullable, with a check that it is 1 to 1000. Not synced (the sync config names its `user` columns), not in `PUBLIC_PROFILE_FIELDS`, `SYSTEM_ONLY` in the user update fields, so no member sets their own.
- `APP_SETTINGS` gains `limits.groupsStarted` at the end: `wholeNumber(1, 100)`, default 3, not public. The settings page renders it from the registry.
- `STAFF_CAPABILITIES` gains `users.limits` (both roles). `AUDIT_ACTIONS` gains `user.setGroupLimit` ("Changed the care group limit"; no DB check, so no migration).

### API

- `careGroup.create`'s refusal reaches the client as any service error does (`unwrap`, then `toActionResult` on the sheet).
- `admin.users.groupLimit({ userId })` (`users.read`) and `admin.users.setGroupLimit({ userId, limit, reason })` (`users.limits`), in the users admin router, returning `{ started, limit, override }`.

### Screens

- The New care group sheet is unchanged: it already shows the action's error.
- The admin account page loads the group limit beside the account and shows it in the Groups section; the Change limit form shows only with `users.limits`, and posts through the page's action like the other help actions.

## Testing decisions

- **Integration** (`packages/data`, a new `groupLimit.int.test.ts`, as `careGroup.int.test.ts` and `accountAdmin.int.test.ts` do): the cap at create, what counts, two creates at once, the override, the member can't write the column, staff capability, audit rows.
- **Integration** (`packages/api`, `usersAdmin.int.test.ts`): the two procedures' capabilities and shapes.
- **Component** (`routes/admin/user/user.browser.test.tsx`, with `openAdmin` and the `adminFx` builders): the count and limit, the form only for `users.limits`, a change posting with its reason.
- No end-to-end step: nothing here crosses sync.
- All test data fictional (`@example.com`).

## Out of scope

- **B-1013, sign-ups per address** (normalized aliases, IP and device windows): moved to `free-limits-2`, after account-security, whose slice 2 adds per-IP and per-link limits to link sign-up and whose slice 7 owns the IP helper. Its planner works on account-security's version of `tickets.ts`.
- Paid plans, billing, or a limit on anything other than groups started.
- Showing the limit to members before they hit it.
- Limits on groups staff or access codes start.

## Notes

- Seed users who start groups in tests must stay under the default; the slice checks `moreGroups.ts` and `secondGroup.ts` (groups with `createdBy` an owner) against it.
- At landing, the rule goes into [care-groups](../docs/domain/care-groups.md) and the capability, setting and audit action into [admin](../docs/domain/admin.md).
