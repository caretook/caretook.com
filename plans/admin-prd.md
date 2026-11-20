# Admin: PRD

Status: 📝 **written**, not yet sliced. Backlog item: B-91 (an admin panel for Caretook's global administrators). Topic `admin`. Interview: 2026-11-19.

Builds on `invites` (done: `/admin`, access codes, staff-made groups, the outbox) and `marketing` (done: the waitlist). Two-factor sign-in for staff (B-85, `account-security`) comes **after** this PRD. Deleting a whole group stays with `data-rights` (B-53). It changes `PERMISSIONS`, `db/schema/index.ts` and the `user` table, which `profiles` is also changing, so it should start after `profiles` lands.

## Problem Statement

Caretook's staff can make access codes, set up a group with an owner invite, and read the waitlist, and nothing else. When someone writes in with "I never got the email", "I'm locked out", "my mother's account was used by someone else", or "our only owner died and nobody can manage the group", staff have no screen to look anything up or fix it. Today that means a database console, with no record of who did what.

Before launch there will be a small support team, not one person, so not everyone on staff should be able to do everything. Some settings (pausing new sign-ups, a maintenance notice, the email allowlist, a few limits) can only change with a deploy.

Staff also have no way into `/admin` from the app: they type the URL.

Through all of this, staff must never see a group's care data. The privacy pages promise it, and AGENTS.md makes it a rule.

## Solution

- **Two staff roles.** The global roles become `admin`, `support` and `member`. **Support** looks things up and does everyday account help: resend a verification email, send a password reset, sign someone out, create access codes and staff-made groups, export the waitlist. **Admin** can also disable and re-enable accounts, change staff roles, act on a group's members (owner recovery, role changes, removal), and change settings. One capability table decides this, and every procedure and screen asks it.
- **Users** (`/admin/users`): search by name or email. A user's page shows:
  - the account: name, email, verified, global role, created, sign-in methods (password, emailed link or code), and whether it's disabled, with the reason;
  - its sessions, with the device or browser and when each was last active;
  - its groups: display name, role, joined and invited by, each linking to the staff group page;
  - recent mail to the address: template name, status, sent time and error, never the body.

  Actions, each with a reason where it changes something: resend verification, send a password reset, sign out one session or all of them, disable or re-enable (admins), and make someone support or admin or remove the role (admins).

- **Disabling an account** revokes every session and refuses new ones. Password sign-in, emailed links and codes, resets and sync tokens all answer as a wrong password or an unknown address would. PowerSync keeps the token it has for up to 15 minutes. Memberships and data stay, and re-enabling restores everything. Nobody can disable or change their own role, and the last admin can't be disabled or demoted.
- **Care groups** (`/admin/groups`): search by group or recipient name, with member count, owners and created date, and a "no owner" filter. A group's page lists members with roles, who invited them and when they joined, plus counts (entries, providers, medications) and dates. Never the content. Admins can recover an owner (promote a member, or send an owner invite to an address), change a member's role, or remove a member, always with a reason. A group always keeps at least one owner.
- **Audit log** (`/admin/audit`): every staff write and every time a staff member opens a user's or group's page is recorded. Each entry has who, what, the target user or group, the reason, and the changed fields before and after (never care data). Entries are append-only, every staff member can read them, and they filter by actor, target, action and date.
- **Settings** (`/admin/settings`, admins change, support reads), stored in the database and effective within a minute, no deploy:
  - sign-up switches: access-code sign-up, link invites and email invites, each on or off;
  - an announcement banner for `/app`, with a tone and an optional end time;
  - the email allowlist for non-production environments (falls back to `MAIL_ALLOWLIST`);
  - limits: the default and longest invite link expiry, the most uses per link, and the public forms' rate limit.
- **Getting there:** staff (admin and support) get an **Admin** item in the app's account menu, after Settings. Nobody else sees it. In the native build it opens the web `/admin`. `/admin`'s nav grows to Users, Groups, Access codes, New group, Waitlist, Audit and Settings.
- **The first admin in production** comes from a server command: `pnpm admin:grant <email> [--role admin|support]`, recorded in the audit log as the system.

## User Stories

### Getting to admin

1. As a staff member, I want an Admin item in the app's account menu, so that I don't have to type the URL.
2. As a member who isn't staff, I want no Admin item and a 404 at `/admin`, so that the app never advertises a staff area.
3. As a staff member in the native app, I want Admin to open the web admin in my browser, so that I can still reach it from my phone.
4. As a staff member, I want one nav across all admin sections, so that I can move between Users, Groups, Access codes, New group, Waitlist, Audit and Settings.
5. As a staff member, I want "Back to the app" in admin's header, so that I return to my own care groups.

### Staff roles

6. As an admin, I want a support role with fewer powers, so that support staff can help people without being able to disable accounts or change settings.
7. As support, I want to search users and groups and see their pages, so that I can answer questions.
8. As support, I want to resend verification, send a password reset and sign someone out, so that I can fix common sign-in problems myself.
9. As support, I want to create and revoke access codes, set up staff-made groups and export the waitlist, so that onboarding doesn't wait for an admin.
10. As support, I want admin-only actions to be absent rather than failing, so that I know what I can do.
11. As an admin, I want to make someone support or admin, or remove their staff role, with a reason, so that the team can change.
12. As an admin, I want to be stopped from changing my own role or disabling myself, so that I can't lock myself out by mistake.
13. As an admin, I want the last admin to be impossible to demote or disable, so that there's always someone who can run admin.
14. As the operator, I want a server command that grants the first admin, so that a new production database can be set up without SQL.

### Users

15. As a staff member, I want to search accounts by name or email, part of either, so that I can find someone from a support email.
16. As a staff member, I want results paged and newest first, with the verified, disabled and staff role shown, so that I can pick the right account.
17. As a staff member, I want a user's name, email, verified state, role, created date and sign-in methods, so that I understand how they use their account.
18. As a staff member, I want to see their active sessions with the device or browser and when each was last active, so that I can tell where they're signed in.
19. As a staff member, I want to see their groups with display name, role, joined and invited by, so that I can follow up on group problems.
20. As a staff member, I want each group to link to its staff page, so that I can move from a person to their group.
21. As a staff member, I want the recent mail sent to their address (template, status, sent time, error), so that I can answer "I never got the email".
22. As a staff member, I never want to see an email's body, so that no care or sign-in detail leaks through support.
23. As support, I want to resend a verification email, so that someone who lost theirs can finish signing up.
24. As support, I want to send a password reset email, so that someone locked out can recover their account themselves.
25. As support, I want to sign out one session or all of them, so that a lost phone or a shared computer stops having access.
26. As an admin, I want to disable an account with a required reason, so that a compromised or abusive account stops at once.
27. As a disabled user, I want sign-in to fail like a wrong password, so that nobody learns the account exists or was disabled.
28. As an admin, I want disabling to sign out every session and stop new sync tokens, so that access ends within 15 minutes everywhere.
29. As an admin, I want disabling to keep the user's memberships and data, so that re-enabling restores everything.
30. As an admin, I want to re-enable a disabled account with a reason, so that a mistake or a resolved case can be undone.
31. As a staff member, I want a disabled account's page to show who disabled it, when and why, so that the next person has context.

### Care groups

32. As a staff member, I want to search groups by group or recipient name, so that I can find the group a support email is about.
33. As a staff member, I want each group's member count, owners and created date in the list, so that I can tell groups apart.
34. As a staff member, I want to filter to groups with no owner, so that I can find ones that need recovery.
35. As a staff member, I want a group's page to list members, roles, who invited them and when they joined, so that I understand who's in it.
36. As a staff member, I want counts and dates (entries, providers, medications, last activity) but never their content, so that I can judge activity without seeing care data.
37. As an admin, I want to promote a member to owner, with a reason, so that a group without an owner can be managed again.
38. As an admin, I want to send an owner invite to an address, so that a group with nobody suitable gets a new owner.
39. As an admin, I want to change a member's role, with a reason, so that I can act on an owner's request when they can't.
40. As an admin, I want to remove a member, with a reason, so that I can act on a verified request.
41. As an admin, I want a group to always keep at least one owner, so that a staff action never leaves it unmanaged.
42. As a group's members, we want staff changes to show in Members like any other change, so that nothing happens silently.

### Audit log

43. As a staff member, I want every staff change recorded with who, what, the target, the reason and before and after, so that every action is accountable.
44. As a staff member, I want opening a user's or group's page recorded too, so that lookups are accountable as well as changes.
45. As a staff member, I want to filter the log by staff member, target, action and date, so that I can answer "who touched this account?".
46. As a staff member, I want each user's and group's page to show its recent audit entries, so that I see its history in place.
47. As the business, we want audit entries impossible to edit or delete from the app, so that the record can be trusted.
48. As the business, we want audit entries never to contain care data, so that the log itself isn't a second copy of health information.
49. As an admin, I want an action and its audit entry to commit together, so that there's never a change without a record.

### Settings

50. As an admin, I want to turn access-code sign-up off, so that I can pause new groups without a deploy.
51. As an admin, I want to turn link invites and email invites off separately, so that I can stop one abused path without breaking the other.
52. As someone using a switched-off path, I want a plain "not available right now" message, so that I know to try later.
53. As an admin, I want to post an announcement banner in the app, with a tone and an end time, so that I can warn people about maintenance or an outage.
54. As a member, I want the banner at the top of `/app` until it ends or I dismiss it, so that I see it once without it getting in the way.
55. As a member offline, I want the last banner I saw to stay, so that offline and native behave the same.
56. As an admin on staging, I want to change the email allowlist, so that testers get real email without a deploy.
57. As an admin, I want to change the default and longest invite link expiry and the most uses per link, so that I can tighten invites if they're abused.
58. As an admin, I want to change the public forms' rate limit, so that I can respond to spam.
59. As an admin, I want each setting checked when saved, with its default shown, so that a typo can't break sign-up.
60. As support, I want to read the settings, so that I can tell people why something is off.
61. As an admin, I want every settings change in the audit log, so that we know who paused sign-up and why.

## Implementation Decisions

- **Global roles:** `USER_ROLE_NAMES` becomes `admin`, `support`, `member`, with the database check updated in the migration. `support` gets no care-data access, exactly like `admin`. `PERMISSIONS` treats both as staff where staff read today (users, access codes, redemptions, the waitlist). Staff writes go through services running as `system` after the capability check.
- **Staff rules** (one pure, client-safe module, the only place that knows the two roles):
  - `STAFF_CAPABILITIES`: a typed table from capability to roles: `users.read`, `users.help` (resend, reset, sign out), `users.disable`, `users.setRole`, `groups.read`, `groups.manage`, `accessCodes.write`, `staffGroups.create`, `waitlist.read`, `audit.read`, `settings.read`, `settings.write`.
  - `staffCan(roleNames, capability)` and `isStaff(roleNames)`.
  - Guards: `roleChangeRefusal({ actorId, targetId, from, to, adminCount })` and `disableRefusal({ actorId, targetId, targetRole, adminCount })` return a reason code or nothing. Not yourself; never the last admin.
  - Every changing action takes a reason (1–500 characters).
- **API:** `staffProcedure(capability)` replaces `adminProcedure`, which becomes `staffProcedure` with the right capability on each existing procedure (access codes and staff groups: `accessCodes.write` and `staffGroups.create`, open to support). New routers: `admin.users` (`search`, `get`, `resendVerification`, `sendReset`, `revokeSession`, `revokeAllSessions`, `disable`, `enable`, `setRole`), `admin.groups` (`search`, `get`, `promoteOwner`, `inviteOwner`, `changeRole`, `removeMember`), `admin.audit.list`, `admin.settings.list|set`, and a public `public.announcement` (the active banner or none). Results are DTOs with no care columns. Group member lists include email only for staff.
- **Audit log:** an `admin_audit_log` table: id, `actor_id` (null for the system command), `action` (a constant from one list), `target_user_id`, `target_group_id` (both nullable, set null on delete), `reason`, `changes` jsonb (`{ field: [before, after] }`), `created_at`. Writes are `system` only, reads are staff; no update or delete permission for anyone. `adminAuditService.record(tx, entry)` runs inside the action's transaction. A pure `auditChanges(before, after, fields)` keeps only the named fields, and each action lists its fields, so no care column can get into the log. Page views are recorded as `user.view` and `group.view` (in a background write, not blocking the page).
- **Disable:** columns on `user`: `disabled_at`, `disabled_by`, `disabled_reason`. Enforced in one place in `packages/auth`: a Better Auth database hook on session creation refuses a disabled user. The JWT (`/api/auth/token`) and `getAuthUser` refuse too, and the magic-link, OTP, reset and verification senders skip a disabled address (sending nothing, with the same response). Disabling revokes every session through Better Auth's internal adapter in the same transaction as the update and its audit entry. Better Auth's admin plugin is **not** used (it brings its own roles, ban fields and impersonation).
- **Sessions:** listed from the `session` table (user agent, IP for display only, created and updated). "Last sign-in" is the newest session's `created_at`. Revoking deletes the rows. Sign-in methods come from `account` rows (password) and `verification` history is not shown.
- **Recent mail:** the outbox rows to the address (template name, status, attempts, sent and error times, last error code), at most 20, newest first. Never `data` or the rendered body.
- **Group admin:** `groupAdminService` acts as `system` after the capability check, through `careGroupMemberService`'s rules, so last-owner protection still applies. `promoteOwner` and `changeRole` set `invited_by` untouched. `inviteOwner` reuses `careGroupInviteService.createEmail` as `system` with the staff member as attester (as `createWithOwnerInvite` does). Counts are SQL `count(*)` per table; no content columns are selected.
- **App settings:** an `app_setting` table (`key` primary key, `value` jsonb, `updated_at`, `updated_by`). A typed registry `APP_SETTINGS` (never `Record<string, …>`), each key with a Zod schema, a default and whether it's public: `signup.accessCodes`, `signup.linkInvites`, `signup.emailInvites` (booleans, default on), `announcement` (`{ text, tone: info|warning, endsAt? }` or null; public), `mail.allowlist` (string list; default from env), `invites.linkDefaultDays`, `invites.linkMaxDays`, `invites.linkMaxUses`, `publicForms.perMinute`. `getSetting(key)` caches per process for 30 s; `setSetting(key, value, ctx)` validates, writes and audits in one transaction and clears the cache. Consumers: the access-code, link and email invite services refuse with `settings:signupClosed` (a 403 with a plain message), `linkRules` reads the expiry and uses limits, the notifications sender reads the allowlist, and the public forms' limiter reads its rate.
- **Banner on the device:** `/app`'s layout reads `public.announcement` when online, caches it per device, and shows it above the outlet (dismissed per announcement, in localStorage). Offline and native show the cached one until it ends. Not synced through PowerSync.
- **Screens** (web only, server loaders through `.server/admin.ts`; `requireStaff` admits admin and support and returns their capabilities so pages hide what they can't do): Users (search, page), Groups (search with the no-owner filter, page), Audit (filters in the URL, paged), Settings (one form per setting, with its default). Each changing action is a `ConfirmDialog` or sheet with a required reason. Nav grows as listed; on phones it scrolls horizontally.
- **The account menu:** an Admin item for staff, from the session user's role (added to the session data the layout already loads). In the native build it opens the web `/admin` on `VITE_API_ORIGIN`.
- **The command:** `pnpm admin:grant <email> [--role admin|support]` in `packages/data` sets the role as `system`, writes an audit entry with no actor, and refuses an unknown address.
- **Migration:** one, adding the role value, the disable columns, `app_setting` and `admin_audit_log`. None of them is published to PowerSync.
- **Seeds:** append `support@example.com` (verified, role `support`, in no group), beside `admin@`.

## Testing Decisions

- Tests check what callers see (results, refusals, audit rows, emails queued), never internals.
- **Staff rules (unit):** every capability for admin, support and member; the self, last-admin and reason guards. Prior art: `inviteRules` and `linkRules` tests.
- **Services (integration, test Postgres):** account, group, audit and settings services. Each action writes exactly one audit row in its transaction; a refusal writes none; support is refused admin capabilities; no result or audit row contains a care column (asserted against the care tables' column names). Prior art: `careGroupInviteService` and `accessCodeService` integration tests, with their own fixtures.
- **Disable enforcement (integration):** a disabled account can't sign in by password, emailed link or code, gets no reset or verification email and no token, and gets the same answer as a wrong password or unknown address; its sessions are gone; re-enabling restores sign-in. Prior art: `auth.int.test`.
- **Settings registry (unit + integration):** defaults, invalid values refused per key, the cache expiring, and each consumer obeying a change (switches refuse, the allowlist filters, the limits apply).
- **Browser check:** a new `admin.mjs` (admin@ and support@; tagged accounts it creates and deletes): the Admin item for staff only, the 404 for others, user search and page, sign out and disable for a tagged account (its next request signs out), role changes and their guards, group search, the no-owner filter and owner recovery on a tagged group, the audit log showing each action, settings (switching access-code sign-up off refuses `/join/:code`, then restoring it), the banner in `/app` and offline, and support not seeing admin-only actions. `groups.mjs` keeps covering access codes, new group and waitlist. Add `/admin`, the admin services and `.server/admin.ts` to `check-areas`.

## Out of Scope

- Any staff access to care data, including an audited support grant.
- Impersonating a user.
- Deleting a group or an account (`data-rights`, B-53).
- Two-factor sign-in, for staff or anyone (`account-security`, B-85).
- Fine-grained per-person staff permissions beyond the two roles.
- A shared admin header with the app, and a side nav (the account menu item is the navigation change).
- Editing a user's name or email for them.
- Contact messages in admin (they go to `SUPPORT_EMAIL`).
- Hosting-level settings (env, secrets, cron, DNS; B-33, B-68).

## Further Notes

- Disabling cuts access within 15 minutes because PowerSync tokens can't be revoked early. That's acceptable for now; shorter tokens are an `account-security` question.
- Once `account-security` lands, staff will be required to enrol in two-factor before `/admin` opens.
- The privacy pages already say staff see care data only with permission, recorded. This PRD keeps staff at none, so they need no change. The audit log is the record for account and membership actions.
- B-90 (more seed groups and users) would help manual testing here.
