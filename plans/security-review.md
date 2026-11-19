# Security review (B-77, B-57)

Status: **reviewed with the user**, 2026-11-19, on `plan/encryption`. Scope: what's in `dev` today (`a781757`) plus what launch adds (hosting, B-33; email setup, B-68). Every finding below names the code it comes from; nothing here is built yet.

Agreed with the user (2026-11-19):

- **Threats that matter:** a server or database breach, insider and vendor access, a lost or shared device, and account takeover.
- **End-to-end encryption:** lay out the options and what each costs; the user decides afterwards (_E2E options_, below).
- **Output:** this review plus a fix list. Small fixes become `quick-fixes` items, bigger ones PRDs.
- **Timing:** each finding is tagged **launch** (must be done before real users' data goes in) or **later**. Launch items that need hosting join the parked launch work (B-33, B-68).

## Summary

The app layer is in good shape: permissions are enforced in SQL on every query, uploads go through the same services as the API, sign-up needs a ticket, tokens are hashed or sealed, and sensitive emails are blanked after delivery. The gaps are around it:

1. **"Delete" keeps everything** (S-1). Soft-deleted entries, providers and medications keep their text, and it keeps syncing to every member's device.
2. **A device keeps its data after the session ends** (S-2), and there's no way to sign a lost device out (S-3).
3. **The public privacy promises aren't backed yet** (S-4): "staff see care data only with permission, recorded" has no audit trail behind it, and "encrypted at rest" depends on hosting that isn't chosen.
4. **No browser security headers** (S-5): no CSP, HSTS or framing rules.
5. **Care data has several copies outside Postgres** (S-6): PowerSync's bucket storage, PowerSync Cloud, backups and logs. Each needs the same rules as the database.

None of these needs end-to-end encryption. E2E answers a different threat (us, or a full compromise of our servers) and costs a large part of what's built (_E2E options_).

## Where the data lives

| Copy                                        | What it holds                                                                              | Who can read it today                                                         | Encrypted at rest                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------- |
| Postgres                                    | everything, including soft-deleted content                                                 | the app (scoped per user in SQL); anyone with database credentials            | depends on the host (❓ B-33)      |
| PowerSync bucket storage (its own Postgres) | every synced row of every group, including soft-deleted rows                               | PowerSync; anyone with its credentials or Cloud dashboard                     | depends on PowerSync Cloud         |
| Each device: SQLite in IndexedDB or OPFS    | every group the user belongs to, including deleted rows                                    | anyone using that browser profile; the cached user offline with no time limit | no (the OS disk encryption, if on) |
| Each device: `localStorage`                 | the cached user (id, name, email), settings, last group, theme                             | anyone using that browser profile                                             | no                                 |
| `notification_outbox`                       | rendered emails; sensitive ones (links, codes, invites) blanked after delivery or failure  | staff with database access                                                    | with Postgres                      |
| Resend                                      | each email's content and address                                                           | Resend                                                                        | Resend's                           |
| Server logs (Vercel)                        | 500s log the whole `AppError` (`packages/api/src/errors.ts`); auth failures log `authUser` | anyone with hosting access                                                    | the host's                         |
| Backups                                     | everything Postgres holds                                                                  | depends on the host                                                           | ❓                                 |
| AI vendors (not built)                      | whatever `assistant` sends                                                                 | the vendor                                                                    | n/a                                |

## Findings

Severity is the harm if it's exploited and how easily, for this app's data. **Fix** says where the work goes.

| Id   | Finding                                              | Threat           | Severity | When               | Fix                                  |
| ---- | ---------------------------------------------------- | ---------------- | -------- | ------------------ | ------------------------------------ |
| S-1  | Soft delete keeps content, and it syncs to devices   | breach, device   | high     | launch             | `data-rights` PRD (with B-52, B-53)  |
| S-2  | Device data outlives the session                     | device           | high     | launch             | quick fix                            |
| S-3  | No way to see or end sessions                        | device, takeover | high     | launch             | quick fix (account settings)         |
| S-4  | Staff access isn't limited or recorded below the app | insider          | high     | launch             | hosting (B-33) + legal text (B-54)   |
| S-5  | No security headers                                  | takeover         | medium   | launch             | quick fix                            |
| S-6  | Copies outside Postgres have no stated rules         | breach, vendor   | medium   | launch             | hosting (B-33)                       |
| S-7  | Rate limits are per serverless instance              | takeover         | medium   | launch             | hosting (already in AGENTS.md, B-68) |
| S-8  | Logs can carry care data                             | insider, vendor  | medium   | launch             | quick fix                            |
| S-9  | No second factor; no breached-password check         | takeover         | medium   | later              | small PRD                            |
| S-10 | Co-members can read each other's full `user` row     | insider (member) | low      | later              | quick fix                            |
| S-11 | Device database isn't encrypted                      | device           | low      | later              | with Capacitor                       |
| S-12 | Rules for AI vendors aren't written down             | vendor           | n/a now  | before `assistant` | a section of the `assistant` PRD     |

### S-1 · Soft delete keeps content, and it syncs to devices (high, launch)

- `timeline_entry`, `provider` and `medication` delete by setting `deleted_at`. The title, body, `details` and the linked `note_document` (snapshot and text) stay. There's no purge (AGENTS.md, _Timeline entries_).
- The `care_groups` stream syncs soft-deleted rows on purpose (`powersync/sync-config.yaml`), so a deleted note's full text sits on every member's device, and in PowerSync's bucket storage, indefinitely.
- The draft privacy page promises deletion by request. A user who deletes a wrong or sensitive entry would reasonably expect it gone.
- **Fix:** on soft delete, scrub the content (title, body, `details`, the document's snapshot, text and pending updates) and keep a tombstone: id, group, kind, times, `deleted_at`, `deleted_by`. Devices then sync the scrub. Then a purge job for tombstones past a retention period. This is `data-rights` work: it shares the rules with "delete all data" (B-53) and the open question about a last owner deleting their account.
- **Decided (2026-11-19):** the details (scrub at once or after an undo window, how long tombstones stay, what "restore" means) need more discussion, so they're left for the `data-rights` PRD interview.

### S-2 · Device data outlives the session (high, launch)

- `lib/session.ts`: when `getSession` fails without a status (offline), the cached last user carries on, **with no time limit**. Someone who picks up a lost laptop can read every group offline, indefinitely.
- When the session has ended (expired, or a 401), the app sends the user to sign-in but **leaves the SQLite file and `localStorage`** in place. They're only wiped at sign-out or when a different user signs in.
- **Fix:**
  - Wipe the device copy (the same path as sign-out: `disconnectAndClear`, delete the file, forget the cached user, settings and last group) when the server says the session has ended.
  - Cap offline use: allow the cached user only within **3 days** of the last confirmed session, then require sign-in, and wipe once back online and still signed out.
- **Decided (2026-11-19): 3 days.** Each successful online session check restarts the 3 days, so only a device offline for 3 days in a row is locked. A locked device keeps its local copy until it's back online (a wipe needs the server's word), so unsynced writes still upload after sign-in. The lock screen should say why ("You've been offline for 3 days. Sign in to keep going.").
- Later, with Capacitor: an optional app lock (biometric or PIN) on resume.

### S-3 · No way to see or end sessions (high, launch)

- There's no session list and no "sign out everywhere". A password reset revokes sessions (`revokeSessionsOnPasswordReset: true`), but that's the only remote sign-out, and most users won't think of it.
- PowerSync JWTs last 15 minutes, so a revoked session stops syncing within 15 minutes. With S-2's wipe, the device's copy goes on its next online start.
- **Fix:** an account settings subpage **Devices**: this device, other sessions (browser and OS from the user agent, last active), Sign out on each, and Sign out everywhere else. It uses Better Auth's built-in session endpoints (`listSessions`, `revokeSession`, `revokeOtherSessions`), so no new dependency. Group owners can already remove a member, which is the group-level equivalent.

### S-4 · Staff access isn't limited or recorded below the app (high, launch)

- In the app, staff (global `admin`) get no care data: `/admin` shows access codes, the waitlist and new groups only. That part is right.
- Below the app there's nothing: anyone with the database URL, a database console, PowerSync's dashboard, or a backup reads everything, and nothing records it. The draft privacy and health-data pages promise that staff see care data **only with permission, recorded**.
- **Fix (with hosting, B-33):**
  - Separate database roles: the app's (read and write, no DDL), migrations' (DDL, used only by the deploy), PowerSync's replication role (column-limited grants, already open in AGENTS.md), and no shared superuser for people.
  - Human access only through named, time-limited credentials, with the host's audit logging (or `pgaudit`) on and kept.
  - A written break-glass procedure: who may look, when, and how the group is told.
  - **Until then, the legal pages should promise only what's built** (B-54 is their review).

### S-5 · No security headers (medium, launch)

- Nothing sets `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options` or `Permissions-Policy` (no `headers` export, no `entry.server.tsx`, no host config).
- Why it matters here: a CSP is the backstop against script injection reaching the synced database and the session; `frame-ancestors 'none'` stops clickjacking of the role and remove controls; `Referrer-Policy: no-referrer` keeps `/invite/:token` and `/join/:code` out of any outbound request.
- The inline `THEME_SCRIPT` needs a hash in the CSP (or a nonce). Two `dangerouslySetInnerHTML` uses exist: `THEME_SCRIPT` (a constant) and the server-rendered QR SVG on `/admin/access-codes/:id/print` (generated from `APP_URL` and the code, not user input). Both are fine.
- **Fix:** one place that sets the headers for every web response, with a strict CSP (`default-src 'self'`, `connect-src` for PowerSync and the API, `frame-ancestors 'none'`). The dev mailbox's sandboxed iframe needs its own rule in dev. Capacitor's WebView gets the same CSP as a meta tag.

### S-6 · Copies outside Postgres have no stated rules (medium, launch)

- PowerSync's bucket storage is a second full copy of every synced row. On PowerSync Cloud it's a vendor holding all care data.
- **Fix (with hosting):** for each copy (Postgres, its backups, PowerSync storage, Resend, logs), write down the region, encryption at rest, retention, who can access it, and the vendor's breach notification terms (the FTC Health Breach Notification Rule applies to us). Prefer a PowerSync Cloud plan where bucket storage is ours, or self-host the service on AWS if not. Turn off Resend's open and click tracking (already in B-68).

### S-7 · Rate limits are per serverless instance (medium, launch)

- Better Auth's limiter and `packages/api/src/rateLimit.ts` are in memory, so on Vercel each instance counts separately. Already listed under _Auth_ in AGENTS.md and B-68. Email codes are 6 digits with 3 attempts and a 5-minute expiry, and magic links last 5 minutes, so the exposure is mainly password guessing.
- **Fix:** shared limiter storage (Postgres or Redis) at launch. Fold it into B-68; nothing new to file.

### S-8 · Logs can carry care data (medium, launch)

- `toORPCError` logs the whole `AppError` on every 500 (`packages/api/src/errors.ts`), and its `meta` can hold the failing values. `routes/rpc.ts` and `.server/admin.ts` log the `authUser` lookup error. Hosting logs are a vendor copy (S-6).
- **Fix:** log the error code, the request's procedure name and ids only. Never values, bodies or `meta`. A unit test that a care field never reaches the log line.

### S-9 · No second factor; no breached-password check (medium, later)

- Passwords are 12 characters minimum. Accounts can be taken over by a reused password. Owners and admins can add and remove people, so their accounts matter most.
- **Fix:** Better Auth's built-in `twoFactor` (TOTP and backup codes) and `haveIBeenPwned` plugins (no new dependency; the second sends a 5-character hash prefix to the Pwned Passwords API, so it's named on the privacy page).
- **Decided (2026-11-19): required for owners and admins** of a care group, optional for everyone else. Things the PRD must settle:
  - Everyone who creates a group (New care group, an access code, an owner invite) becomes an owner, so setting up two-factor becomes part of creating or taking over a group.
  - Being promoted to admin or owner asks for it before the first manager action.
  - Existing owners and admins get a grace period, then their manager actions (invites, roles, removals, group settings) wait until it's on. Timeline writes don't wait.
  - Recovery: backup codes, and what happens when an owner loses both (another owner, or support with an audited check, S-4).
  - Global staff (`/admin`) are required too.

### S-10 · Co-members can read each other's full `user` row (low, later)

- An open question in AGENTS.md: `PERMISSIONS.user` lets co-members read email, role and preferences in the data layer; only the API's public-profile shape hides them. A future procedure could leak them by mistake.
- **Fix:** a field-limited read for co-members (id, name, image) in the permission map, and the one place that needs email (invites) reads it as `system`.

### S-11 · Device database isn't encrypted (low, later)

- Browsers give no usable at-rest encryption for IndexedDB or OPFS, so the web relies on S-2 and the OS's disk encryption. In Capacitor, SQLCipher (an encrypted SQLite) with its key in the platform keychain is possible, alongside the bearer token in secure storage (already open in AGENTS.md).

### S-12 · Rules for AI vendors aren't written down (before `assistant`)

- The compliance rules say AI vendors must not retain or train on our data. The `assistant` PRD should also set: zero-retention terms in writing, the least data per request, no health data in prompts' logs, a per-group opt-in by an owner, and which features run on-device instead.

### Checked and fine

- **Tokens:** invite tokens are SHA-256 hashed, link tokens sealed with AES-256-GCM (`INVITE_LINK_KEY`; production refuses to create a link without it), magic links and email codes hashed by Better Auth, and every token-carrying email (`magicLink`, `signInCode`, `resetPassword`, `verifyEmail`, `groupInvite`, `ownerInvite`) marked `sensitive` and blanked in the outbox once delivered or failed. Access codes are stored plain by design (sign-up tickets, not data). Rotating `INVITE_LINK_KEY` would break active links; write the rotation down with S-4.
- **Authorization:** every model query is ANDed with the actor's scope in SQL; uploads go through services; streams filter by `auth.user_id()`'s memberships, and the publication's column list keeps emails, roles and preferences out of replication. A removed member's rows leave their device on the next sync (covered by `app-shell.mjs`).
- **Auth:** no public sign-up; email verification required; sign-in emails read the same whether or not an account exists; password reset revokes sessions; JWTs last 15 minutes.
- **Email:** links only from `APP_URL`, never the Host header; no health details in emails; the dev mailbox 404s in production builds.
- **API:** CSRF tokens, an origin allowlist for CORS, GET refused, 100 operations per upload, 1,000,000 characters per note update.

## E2E options (B-57)

The question: should only the people in a care group be able to read its data, and not us? Four options, from least to most change. Each includes the ones above it.

| Option                              | Protects against                                                                  | What it costs                                                                                                                                                                                                                                                                                                                                             | Size                      |
| ----------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **A. Harden what's there**          | stolen backups and disks, casual insider access, lost devices, account takeover   | nothing built is lost. It's the launch items above (S-1 to S-8).                                                                                                                                                                                                                                                                                          | the fix list              |
| **B. Server-side field encryption** | a database or backup leak on its own (the key is held separately, in a KMS)       | the app server still reads everything, so it doesn't stop us or a compromised server. Encrypted columns can't be searched or filtered in SQL (`search` slice 6), and PowerSync would replicate ciphertext, so devices can't read them without the key. Realistic only for a few non-synced columns.                                                       | small to medium           |
| **C. E2E for uploaded files only**  | us and our vendors reading ID cards, insurance cards and DNRs (`documents`, B-56) | each group gets a key, wrapped for each member's device. **Joining needs an online member's device** to hand over the key. **Losing every device loses the files** unless there's a recovery code. No server thumbnails or AI reading of files. The timeline stays as it is.                                                                              | one PRD, with `documents` |
| **D. E2E for all care content**     | us, our vendors, and a full server compromise                                     | the server can't validate uploads (Zod, kinds, the medication and provider rules), so devices must, and a bad device can write junk the others accept. No server-side Yjs compaction, search, emails with content or AI. Key rotation when someone is removed. Recovery codes. Migrating the existing data. A large rewrite of sync, upload and services. | months                    |

**Decided (2026-11-19): A for launch, and C planned with `documents`** (B-56): files are the most sensitive and least structured data, and C costs the least there. D is not planned; it removes much of what makes the timeline useful together (search, AI, server rules). Revisit only if users ask for it.

## Decisions

| Question                              | Answer (2026-11-19)                                        |
| ------------------------------------- | ---------------------------------------------------------- |
| E2E (B-57)                            | A now; C (files only) with the `documents` PRD             |
| S-1: when a delete scrubs content     | open: for the `data-rights` PRD interview                  |
| S-2: offline use before sign-in       | 3 days                                                     |
| S-9: two-factor                       | required for owners, admins and staff; optional for others |
| S-4: soften the draft legal pages now | open: with B-54                                            |

## Fix list (proposed backlog items)

**Launch** items that need hosting go with B-33 and B-68.

| Finding | Proposed item                                                                                       | PRD                     | When               |
| ------- | --------------------------------------------------------------------------------------------------- | ----------------------- | ------------------ |
| S-1     | Scrub a deleted entry's, provider's or medication's content, keep a tombstone, purge later          | `data-rights`           | launch             |
| S-2     | Wipe the device copy when the session has ended; require sign-in after 3 days offline               | `quick-fixes`           | launch             |
| S-3     | Devices page in account settings: list sessions, sign out one or all others                         | `quick-fixes`           | launch             |
| S-4     | Database roles, named and audited human access, a break-glass procedure                             | hosting (B-33)          | launch             |
| S-4     | Legal pages promise only what's built (note on B-54)                                                | `marketing`             | launch             |
| S-5     | Security headers and a CSP for every web response (and the native meta tag)                         | `quick-fixes`           | launch             |
| S-6     | A data-copies register: region, encryption, retention, access, breach terms per copy (note on B-33) | hosting (B-33)          | launch             |
| S-7     | Shared rate-limit storage (already in B-68; note only)                                              | hosting (B-68)          | launch             |
| S-8     | Log codes and ids only, never values or `meta`                                                      | `quick-fixes`           | launch             |
| S-9     | Two-factor sign-in (required for owners, admins and staff) and a breached-password check            | new: `account-security` | later              |
| S-10    | Field-limited co-member reads of `user`                                                             | `quick-fixes`           | later              |
| S-11    | Encrypted device database in Capacitor (note for the Capacitor work)                                | (Capacitor)             | later              |
| S-12    | AI vendor rules (note on B-12 and B-58)                                                             | `assistant`             | before `assistant` |
