# Plan: Admin

> Source PRD: [`plans/admin-prd.md`](admin-prd.md) (B-91). Topic `admin`.

## Status

| Slice | State               | Merge into `prd/admin` (slice commits) |
| ----- | ------------------- | -------------------------------------- |
| 1     | not started (ready) |                                        |
| 2     | blocked by 1        |                                        |
| 3     | blocked by 2        |                                        |
| 4     | blocked by 1        |                                        |
| 5     | blocked by 1        |                                        |
| 6     | blocked by 5        |                                        |

Backlog: B-91 is `triaged`. Claim it when slice 1 starts; mark it `done` after the last slice merges. Start after `profiles` lands: both change `PERMISSIONS`, `db/schema/index.ts` and the `user`-adjacent registries. Landing mode: not chosen yet (the orchestrator asks).

## Architectural decisions

Durable decisions every slice follows:

- **Routes** (web only, under the existing `admin` layout, server loaders through `.server/admin.ts`, paths from `adminUrls`): `admin/users`, `admin/users/:userId`, `admin/groups`, `admin/groups/:groupId`, `admin/audit`, `admin/settings`, beside the existing access codes, new group and waitlist. `/admin` redirects to Users. The nav lists Users, Groups, Access codes, New group, Waitlist, Audit, Settings and scrolls horizontally on phones.
- **Roles:** global `admin | support | member`. One pure, client-safe staff rules module owns `STAFF_CAPABILITIES`, `staffCan`, `isStaff`, `roleChangeRefusal` and `disableRefusal`; nothing else names `support`. Support's capabilities: `users.read`, `users.help`, `groups.read`, `accessCodes.write`, `staffGroups.create`, `waitlist.read`, `audit.read`, `settings.read`. Admin: all of those plus `users.disable`, `users.setRole`, `groups.manage`, `settings.write`.
- **Access:** `requireStaff` admits admin and support (others get the 404) and returns the capabilities; pages render only the controls the viewer may use. `staffProcedure(capability)` guards every admin procedure and replaces `adminProcedure`.
- **Never care data:** admin procedures select named columns only; DTOs carry no content from care tables (entries, documents, providers, medications, recipient profile fields beyond name and preferred name). Counts come from `count(*)`.
- **Audit:** every staff write runs in a transaction that calls `adminAuditService.record(tx, …)`; a refusal writes no row. Changed fields go through the pure `auditChanges(before, after, fields)` with each action's own field list. Page views (`user.view`, `group.view`) are recorded in the background. Actions are constants in one list. Every changing action requires a reason (1–500 characters) in the UI and API.
- **Schema** (one pending migration for the PRD, made in slice 1; regenerate on top if a sync brings another in): the `support` value in the user role check; `user.disabled_at`, `disabled_by`, `disabled_reason`; `admin_audit_log`; `app_setting`. Nothing is added to PowerSync's publication or streams.
- **Disable** is enforced only in `packages/auth` (the session-creation hook, the token endpoint, `getAuthUser`, and the email senders), answering as a wrong password or an unknown address does. No Better Auth admin plugin.
- **Settings** go through the typed `APP_SETTINGS` registry and `getSetting`/`setSetting` (30 s cache); consumers never read `app_setting` directly.
- **Shared files** (additive only): `USER_ROLE_NAMES`, `db/schema/index.ts`, `PERMISSIONS`, the API router, `routes.ts`, `adminUrls`, the account menu items, `packages/auth`'s config, seeds (a new file with its own ids), `scripts/loops/check-areas`. Slice 6 adds one region to the `/app` layout (a hot file).

## How to run this plan

- **Waves:** 1 → (2, 4, 5) → (3, 6).
- **Browser check:** slice 1 creates `admin.mjs` (in the suite) and its `check-areas` rule (`routes/admin/**`, `.server/admin.ts`, the admin API and services); later slices extend it. Slices 1 and 5 also run `groups.mjs` (access codes, new group, `/join/:code`); slice 1 runs `app-shell.mjs` (the account menu); slices 3 and 5 run `invites.mjs` and `sign-in.mjs` (auth and invite flows); slice 6 runs `app-shell.mjs` and `first-sync.mjs`.
- `admin.mjs` signs in as `admin@` and `support@` and works on accounts and groups it creates and tags (`adm<run>-…@example.com`, `ADM<run>` groups), deleting them at the end. Settings steps restore every value they change.
- After the slice 1 merge and every sync that touches it: `pnpm datastore:reset`.
- All seed and test data is fictional.

---

## Slice 1: Staff foundation

**User stories:** US 1–6, 9, 10, 14, 43, 45, 47–49. **Blocked by:** none. **Blocks:** 2, 4, 5.

### What to build

The PRD's migration and schema (role value, disable columns, `admin_audit_log`, `app_setting`) with `PERMISSIONS` entries; the staff rules module; `staffProcedure` and the existing admin procedures moved onto it (support may create and revoke access codes, set up staff-made groups and read and export the waitlist); `adminAuditService` (`record`, `list` with filters and paging) and `admin.audit.list`; the existing staff writes (access code create and revoke, staff-made group) recording audit entries; `requireStaff` for both roles; the new nav and the Audit page (filters in the URL: actor, target, action, date range; 50 a page, newest first); the Admin item in the account menu (staff only; native opens the web `/admin`); `pnpm admin:grant <email> [--role]`; the `support@example.com` seed; `admin.mjs` with its `check-areas` rule.

### Acceptance criteria

- [ ] Unit tests: every capability for admin, support and member; `roleChangeRefusal` and `disableRefusal` (self, last admin, unknown role); `auditChanges` keeps only listed fields.
- [ ] Integration tests: support can create an access code and gets a 403 on nothing it should have; a member gets a 403 on every admin procedure; creating and revoking a code each write one audit row in the same transaction, and a refused call writes none; audit rows can't be updated or deleted through any service; `admin:grant` sets the role and writes an actor-less entry, and refuses an unknown address.
- [ ] `admin.mjs`: admin@ and support@ see the Admin item and reach `/admin`; member@ sees no item and gets the 404; support sees access codes, new group and the waitlist and can create a code; the Audit page lists that action with the right actor, and its filters narrow it.
- [ ] `groups.mjs` and `app-shell.mjs` pass; the migration's SQL is read and in order; `pnpm check` passes.

---

## Slice 2: Users

**User stories:** US 7, 8, 15–25, 44, 46. **Blocked by:** 1. **Blocks:** 3.

### What to build

`accountAdminService` reads and help actions, and `admin.users.search|get|resendVerification|sendReset|revokeSession|revokeAllSessions`. The Users page (search by part of a name or email, paged, newest first, with verified, disabled and staff role badges) and the user's page: account basics and sign-in methods, sessions (device or browser from the user agent, created, last active), groups (display name, role, joined, invited by; each a link to the staff group page, which slice 4 fills), recent mail (outbox rows to the address: template, status, attempts, sent, last error code; never data or body), and the user's recent audit entries. Help actions sit behind a `ConfirmDialog` with a reason. Opening the page records `user.view`. Resend and reset reuse the auth emails through the outbox.

### Acceptance criteria

- [ ] Integration tests: search matches part of a name or email and pages; `get` returns no care columns and no mail `data`; resend and reset queue one email each and write one audit row; revoking one session leaves the others, and revoking all leaves none; support may do each; every action without a reason is refused.
- [ ] `admin.mjs`: support finds a tagged account by part of its email, sees its group and a sign-in session from a second browser, signs that session out (the second browser's next request goes to sign-in), sends a reset (it appears in `/dev/mail.json` and in recent mail), and the audit log shows the view and both actions.
- [ ] `pnpm check` passes.

---

## Slice 3: Disable and staff roles

**User stories:** US 11–13, 26–31. **Blocked by:** 2. **Blocks:** none.

### What to build

Disable enforcement in `packages/auth`: the session-creation hook, the token endpoint and `getAuthUser` refuse a disabled user, and the magic-link, OTP, reset and verification senders send nothing for a disabled address, each with the same response as a wrong password or unknown address. `accountAdminService.disable|enable|setRole`: disabling revokes every session in the same transaction as the update and its audit row; the guards from the staff rules (not yourself, never the last admin). `admin.users.disable|enable|setRole`, the user page's Disable / Re-enable (admins; reason required; who, when and why shown) and staff role control (admins; Member, Support, Admin).

### Acceptance criteria

- [ ] Integration tests: a disabled account can't sign in by password, emailed link or code, gets no reset or verification email and no token, and each answer matches the wrong-password or unknown-address answer; its sessions are gone; re-enabling restores sign-in; you can't disable yourself or change your own role; the last admin can't be demoted or disabled; support gets a 403 on all three.
- [ ] `admin.mjs`: an admin disables a tagged, signed-in account (its other browser is signed out on its next request and can't sign in again), re-enables it (sign-in works), makes it support (it sees the Admin item) and back to member; support sees none of these controls.
- [ ] `invites.mjs` and `sign-in.mjs` pass; `pnpm check` passes.

---

## Slice 4: Care groups

**User stories:** US 32–42. **Blocked by:** 1. **Blocks:** none.

### What to build

`groupAdminService` and `admin.groups.search|get|promoteOwner|inviteOwner|changeRole|removeMember`, acting as `system` after the capability check and through `careGroupMemberService`'s rules (a group keeps at least one owner). The Groups page (search by group or recipient name; member count, owners, created; a "No owner" filter) and the group's page: members with role, invited by and joined (each a link to the user's staff page), counts of entries, providers and medications, created and last activity dates, and the group's recent audit entries. Admin actions behind a `ConfirmDialog` or sheet with a reason: Make owner, Invite an owner (an address; reuses the owner invite flow), Change role, Remove. Opening the page records `group.view`.

### Acceptance criteria

- [ ] Integration tests: `get` selects no content columns (asserted against the care tables' column names); the no-owner filter finds a group whose only owner left; promoting, changing a role and removing each write one audit row; removing or demoting the last owner is refused; `inviteOwner` queues the owner invite email; support gets a 403 on every write.
- [ ] `admin.mjs`: an admin finds a tagged ownerless group through the filter, invites an owner (the invite appears in `/dev/mail.json`) and promotes a member to owner; the member's own Members page shows the new role after sync; support sees the page without controls.
- [ ] `pnpm check` passes.

---

## Slice 5: Settings

**User stories:** US 50–52, 56–61. **Blocked by:** 1. **Blocks:** 6.

### What to build

The `APP_SETTINGS` registry (each key's Zod schema, default and public flag) and `appSettingService` (`getSetting` with a 30 s per-process cache, `setSetting` validating, writing and auditing in one transaction and clearing the cache); `admin.settings.list|set`. The consumers: access-code sign-up, link invites and email invites refuse with `settings:signupClosed` and a plain "not available right now" message on `/join/:code`, `/invite/:token` and the invite controls; `linkRules` and the link service read the default and longest expiry and the most uses; the notifications sender reads the allowlist (env as the default); the public forms' limiter reads its rate. The Settings page: one form per setting showing its value and default, read-only for support. The `announcement` key exists here; slice 6 shows it.

### Acceptance criteria

- [ ] Unit tests: each key's schema (valid, invalid, default).
- [ ] Integration tests: the cache expires; each setting change writes one audit row with before and after; with access-code sign-up off, `accessCode.signUp` is refused and nothing is created; with link invites off, `createLink` is refused; the longest expiry caps `createLink`; the allowlist filters a non-production send; support gets a 403 on `set`.
- [ ] `admin.mjs`: an admin turns access-code sign-up off, `/join/CARE-DEMO-0001` says it isn't available, then turns it back on; support sees the page read-only.
- [ ] `groups.mjs` and `invites.mjs` pass; `pnpm check` passes.

---

## Slice 6: Announcement banner

**User stories:** US 53–55. **Blocked by:** 5. **Blocks:** none.

### What to build

The public `public.announcement` (the active banner, or none once `endsAt` passes). In `/app`'s layout, one new region above the outlet: an announcement banner (info or warning tone, a dismiss button). The client reads it when online on `/app` loads, caches it per device, and shows the cached one offline and in the native build until it ends; a dismissal is remembered per announcement in localStorage (storage that throws means it shows). The Settings page's announcement form gets a preview.

### Acceptance criteria

- [ ] Unit tests: the pure rule that picks what to show (active, ended, dismissed, cached vs fetched).
- [ ] `admin.mjs`: an admin posts a banner; member@ sees it in `/app`, dismisses it, and doesn't see it again after a reload; a new banner shows again; offline the cached banner still shows; after its end time it's gone. The banner is cleared at the end.
- [ ] `app-shell.mjs` and `first-sync.mjs` pass; no CSP violations; `pnpm check` passes.
