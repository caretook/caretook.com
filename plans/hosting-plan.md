# Plan: Hosting

> Source PRD: [`plans/hosting-prd.md`](hosting-prd.md). User-story numbers (US) refer to it. Backlog items B-33 and B-68. Topic `hosting`.

## Status

**Landing mode: run everything through** (queued with `pnpm prd queue hosting`, 2026-11-20): start every ready slice, land each green wave without asking, clean up; ask only real questions. Slice 7 is still done with the user.

| Slice | Wave | State                                   | Merge into `prd/hosting` (slice commits) |
| ----- | ---- | --------------------------------------- | ---------------------------------------- |
| 1     | 1    | merged                                  | 7ce4336 (e459365, ec506bd, 7ada5b5)      |
| 2     | 1    | merged                                  | 738b731 (3f0ca96, 53adf98)               |
| 3     | 1    | merged                                  | 5d64d38 (6179cd8)                        |
| 4     | 2    | merged                                  | d01cb41 (7d0be1d)                        |
| 5     | 2    | merged                                  | b1d13f5 (d9aa875)                        |
| 8     | 2    | merged                                  | afda535 (734907d); fix 05b709f           |
| 6     | 3    | merged                                  | 4a9cd0f (24a3f02)                        |
| 9     | 4    | in flight: respawned (opus), 2026-11-20 |                                          |
| 7     | 5    | blocked by 9                            |                                          |

- **Resumed (2026-11-20, new orchestrator):** reconciled with git: slice 9's branch had no commits and a clean worktree, no live agent. Respawned it with `--continue` on opus, with the hand-off's notes. B-161 (sign-in.mjs flake) is not hosting's; left for its owner.
- **Hand-off (2026-11-20):** the user stopped this orchestrator to save context. Next orchestrator: slice 9's worktree `.loops/hosting-9` is kept with its agent stopped mid-work; respawn it (model opus) with `pnpm prd prompt slice hosting 9 --continue`, plus the orchestrator notes from this session: Node 24 PATH setup, B-158 research Better Auth 1.7.25's jwt plugin first, `deploy.yml`'s env step must equal `DEPLOY_ENV_VARIABLES`, generous timeouts on role tests, list but don't run browser checks. Then merge, fold docs (Slice 9 line), land (run-through), then slice 7 with the user (ops/runbook.md, staging first). B-158–B-160 are claimed by prd/hosting.
- 2026-11-20: synced `dev` in; claimed B-33, B-68 and B-141 (B-141 is slice 3's work, `done` with it). Added slice 8 for B-142 and B-143 (triaged to hosting by the backlog agent), in wave 2 after 1 and 3.
- B-134 (visitPrep test) was fixed in `dev` and came in with the sync.
- Done (05b709f): `deploy.yml`'s env step gets `NATIVE_APP_ORIGINS` and `CLIENT_IP_HEADER`. B-68, B-141, B-142 and B-143 are `done`; B-33 waits for slice 7.
- Slice 6 (docs only) merged into this landing. Its gaps are filed as B-158 (rotating `BETTER_AUTH_SECRET` breaks sync), B-159 (narrow `staff_` roles: no auth tables) and B-160 (staging seed password rotation), proposed for hosting. Open for the user: break-glass tells owners "within 3 days of the revoke" (slice 6's proposal).
- **Waves 1–3 landed in `dev` as a187dc2** (2026-11-20; `pnpm check` passed on f1fef23 after syncing dev's hotfixes). Then the user chose (2026-11-20) to fix B-158, B-159 and B-160 first: slice 9, wave 4; slice 7 becomes wave 5. Break-glass's owner notice stays "within 3 days of the revoke" (user confirmed). Adopted the check gate and models rules (ab204ec). Earlier notes: synced `dev` (c8432ca; the tasks PRD's `0022_tasks` kept, ours regenerated as `0023_rate_limits_suppression`, SQL identical; `admin.mjs` deleted in dev, so slice 4's nav line went with it). B-134's test fix came in from dev. Folded the area docs and AGENTS.md. Lean set + `groups`: 13/13 passed (8m03s, on 4a9cd0f's code; later commits are docs). `pnpm prd check`: failed once on dev's admin nav test (fixed, 22eb94d), once on load timeouts (passed alone; roles tests given 20 s, b781fea), then passed on b781fea. Synced dev's sign-in hotfix (clean); final `pnpm prd check`, then land.
- Landing: wave 1 is not landed on its own. Slice 4 regenerates slice 3's migration so the PRD lands one migration, and the user prefers one suite at the end for migration PRDs. So waves 1 and 2 land together once 4, 5 and 8 are merged, with the lean set run once (the user chose this, 2026-11-20).
- Decided (user, 2026-11-20): PowerSync's snapshot runs `SELECT *`, so column-only replication grants fail on 7 partly-synced tables. The six whose unsynced columns are only timestamps and audits get them added to their streams; `user` gets a table-level SELECT for the replication role (emails reach PowerSync's storage, not devices; the publication keeps its column list). Ask PowerSync Cloud at slice 7 whether it snapshots with `SELECT *`. Done in slice 2 (53adf98): `REPLICATION_WHOLE_TABLES` is `user`, `note_document` and `timeline_entry` (the last two for the hand-written `search_vector` column, derived from synced text); a snapshot test fails on any synced table the role can't `SELECT *`.

**Landing:** land each wave as soon as it's green. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued. Record it here. Slice 7 is done with the user, not by a loop. Slice 9's model: opus (security design); slice 7 has no agent.

Backlog: claim B-68 when slice 3 starts (`done` after slice 4) and B-33 when slice 1 starts (`done` after slice 7). B-141 is `done` with slice 3; B-142 and B-143 are claimed when slice 8 starts and `done` with it. B-158, B-159 and B-160 are claimed when slice 9 starts and `done` with it.

Fold into the area docs at each landing:

- **Slice 1:** `APP_ENV`, `checkDeployEnv` and the server-start refusal go in `docs/domain/api.md`. The Vercel preset and `waitUntil` go in `docs/domain/notifications.md`. The seed guard goes in `docs/domain/data-layer.md`. Staging noindex goes in `docs/domain/marketing.md`. The header-merge answer goes in `docs/domain/security-headers.md`.
- **Slice 2:** roles and grants go in `docs/domain/data-layer.md` and `docs/domain/sync.md`, closing the "Production" ❓.
- **Slice 3:** rate-limit storage goes in `docs/domain/auth.md`, closing its ❓.
- **Slice 4:** suppression and the webhook go in `docs/domain/notifications.md`, and the suppressions screen in `docs/domain/admin.md`.
- **Slice 8:** the native-origins flag and the client-IP header go in `docs/domain/api.md` and `docs/domain/auth.md`.
- **Slice 9:** personal access exclusions in `docs/domain/data-layer.md`; JWKS rotation (and any versioned secrets) in `docs/domain/auth.md`; the staging seed's password update in `docs/domain/data-layer.md`.
- **Slice 6:** a pointer to `ops/` goes in AGENTS.md (_Hosting_, the _Area index_, _Open questions_, _Next steps_, and the Stack's "check that Vercel runs pnpm 12" line once slice 7 confirms it).

## Architectural decisions

Durable decisions every slice follows:

- **Two environments, one build per environment.**
  - `APP_ENV` (`staging` | `production`; unset in dev, tests and check builds) names the target, since both run with `NODE_ENV=production`.
  - Prerendered marketing pages read `APP_ENV` at build time.
  - Each environment has its own Neon project, PowerSync instance, Vercel project environment, secrets and Resend settings.
- **Region:** Vercel `cle1`, Neon `aws-us-east-2`, PowerSync Cloud US (us-east-1).
- **Connections:**
  - The app uses Neon's **pooled** URL as the app role (`DATABASE_URL`).
  - Migrations and the roles script use the **direct** URL as the migrations role (`MIGRATIONS_DATABASE_URL`, held only in GitHub environment secrets).
  - PowerSync uses the direct URL as the replication role, with `sslmode: verify-full`.
- **Migrations are additive.** Expand in one deploy, contract (drop or rename) in a later one, so Vercel's instant rollback is always safe.
- **Deploy order:** env check → migrate → roles SQL → PowerSync sync config → Vercel deploy → smoke. A failure at any step leaves the previous deploy live.
- **Dependencies (approved 2026-11-19):**
  - `@vercel/react-router` and `@vercel/functions`, pinned exactly, in slice 1 only.
  - The Vercel and PowerSync CLIs run through `pnpm dlx <pkg>@<exact version>` in Actions, never as repo dependencies.
  - Svix verification uses `node:crypto`.
  - Nothing else new.
- **The grants come from `sync-config.yaml`.** The replication role's column grants and the `powersync` publication's column lists are generated from the streams' column lists, never written by hand.
- **Audit:** new `AUDIT_ACTIONS` entries are appended at the end: `db.accessGranted`, `db.accessRevoked` and `mail.suppressionCleared`. Scripts record with the system actor and the staff member as subject. Clearing a suppression needs a reason (`staffReasonZSchema`).
- **Staff capabilities:** no new ones. Listing suppressions needs `users.read`, and clearing one needs `users.help`.
- **One pending migration per PRD.** Slice 3 adds it; slice 4 regenerates it with its table added (`pnpm datastore:generate`), so the PRD lands one migration.
- **`ops/` is a new top-level folder** for the runbook, the data-copy register and the break-glass procedure. Loops may write it (it isn't `docs/`). No secrets, real hostnames' credentials or personal data in it.
- **No secret is ever logged.** That covers webhook bodies, database URLs and seed passwords.

## How to run this plan

- **Wave 1: slices 1, 2 and 3 at once.** All are stackless; integration tests use the shared test Postgres.
  - 1 owns the web build, `vercel.json`, `APP_ENV`, the env check, noindex and the seed.
  - 2 owns the roles generator and the access scripts (`packages/data/scripts/`).
  - 3 owns the limiter and Better Auth's rate-limit config.
  - 1 and 3 both touch `packages/auth` lightly: 1 only reads env, 3 changes `rateLimit`. Merge in number order.
- **Wave 2: slices 4, 5 and 8.** 4 extends 3's migration; 5 adds `.github/` and `scripts/deploy/`; 8 changes `routes/rpc.ts`, `packages/auth` and `checkDeployEnv` lightly. Merge in the order 4, 5, 8.
- **Wave 3: slice 6** (the `ops/` docs, written from what 1–5 built).
- **Wave 4: slice 7**, run by the orchestrator with the user. It's not a loop: the user creates the accounts, DNS and secrets following the runbook. The orchestrator fixes the runbook where reality differs (on `prd/hosting`, committed as `docs(hosting): …`), and records the answers (pgaudit, PowerSync region, header merge).
- Merge in number order within a wave, with no checks between merges.
- **Checks:** every slice runs `pnpm check`. Slice 4 adds a screen, so it runs `pnpm test:components --changed prd/hosting`. No browser checks are added, and `pnpm prd browser --changed` should name only what the diff touches (slice 1's root layout change may name the lean set's shell checks; run what it names once).
- **Running beside other PRDs:**
  - `assistant`: its migration may land first. Regenerate on top.
  - `check-migration`: touches `scripts/loops/check-areas` additively; add your rules at the end.
  - `loop-recovery`: no overlap.
- Every slice ends with a hand-off (AGENTS.md, _Loop rules_), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: Vercel build, env check, staging noindex and the seed guard

Stack: no · Reads: docs/domain/notifications.md, docs/domain/security-headers.md, docs/domain/marketing.md, docs/domain/data-layer.md, docs/layout.md · Tests: unit, integration

**User stories:** 6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 40, 41.

**What to build:**

- **The Vercel build.**
  - Add `@vercel/react-router` (pinned) and use its preset in the React Router config for the web target only; the native build is unchanged.
  - `vercel.json` gains `regions: ["cle1"]` and a cron `* * * * *` on `/api/cron/outbox` (Vercel sends `Authorization: Bearer $CRON_SECRET`), keeping the headers.
  - Confirm locally with `vercel build` (`pnpm dlx`) if it runs without an account. Otherwise note it for slice 7.
- **`waitUntil`.** Add `@vercel/functions` (pinned) and call `setBackgroundRunner(waitUntil)` once at server start. Outside Vercel the current runner stays.
- **`checkDeployEnv(target, env)`**, pure and in a client-unsafe server module. It returns `{ variable, problem }[]`:
  - the required variables per target;
  - `APP_URL` is https and its host is `caretook.com` (production) or `staging.caretook.com` (staging);
  - `BETTER_AUTH_URL === APP_URL`, and `POWERSYNC_URL === VITE_POWERSYNC_URL`;
  - `MAIL_SENDER=resend` with `RESEND_API_KEY`, `MAIL_FROM` on a `mail.` subdomain, and `SUPPORT_EMAIL` set;
  - `BETTER_AUTH_SECRET`, `CRON_SECRET`, `INVITE_LINK_KEY` and `RESEND_WEBHOOK_SECRET` long enough (`whsec_` prefix for the last);
  - `DATABASE_URL` is pooled (Neon's `-pooler` host) and not the migrations role;
  - staging's `SEED_USER_PASSWORD` set and not the dev default; production with `MAIL_ALLOWLIST` empty, and staging with it set.

  A CLI wrapper (`pnpm deploy:env <target>`) prints the problems and exits non-zero.

- **The server-start refusal.** With `APP_ENV` set, the server runs `checkDeployEnv` on its first request (lazily, as config is read today) and answers 503 with a logged list of variable names (never values) until it's fixed.
- **Staging noindex.** With `APP_ENV=staging`:
  - robots.txt is `Disallow: /`;
  - the sitemap is empty;
  - every page (marketing and app) gets `<meta name="robots" content="noindex, nofollow">`;
  - responses carry `X-Robots-Tag: noindex`.
- **The seed guard and password.**
  - The seed refuses with `APP_ENV=production`, and refuses any non-localhost database unless `APP_ENV=staging`.
  - It requires a non-default `SEED_USER_PASSWORD` on staging.
- **`.env.example`** in apps/web and packages/data gains `APP_ENV`, `RESEND_WEBHOOK_SECRET` (used in slice 4) and `MIGRATIONS_DATABASE_URL` (slice 2 and 5), each with a comment.

**Acceptance criteria:**

- [ ] `checkDeployEnv` unit tests cover every rule above for both targets, plus a complete valid env for each.
- [ ] `pnpm deploy:env staging` with an incomplete env exits 1 and prints variable names only.
- [ ] A unit test of the server-start check: 503 and names only when invalid, normal when `APP_ENV` is unset.
- [ ] robots, sitemap and the meta tag under `APP_ENV=staging` are unit-tested beside `seo.test.ts`; production and unset are unchanged.
- [ ] An integration test: the seed refuses under `APP_ENV=production`, and refuses staging with the default password.
- [ ] `pnpm build` and `pnpm build:native` both pass; the native build has no Vercel preset output.
- [ ] `vercel.json` has the region and the cron; the headers are unchanged.
- [ ] The hand-off says whether `vercel build` ran locally, and what it showed about function headers versus `vercel.json`'s.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 5, 6, 8.

---

## Slice 2: Database roles and personal access

Stack: no · Reads: docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/admin.md · Tests: unit, integration

**User stories:** 22, 23, 24, 26, 27, 28, 29, 30.

**What to build:**

- **`rolesSql({ syncConfig, tables, names })`**, pure, returning idempotent SQL:
  - **`caretook_migrations`:** owns the schema and has DDL.
  - **`caretook_app`:** `CONNECT`, `USAGE`, `SELECT/INSERT/UPDATE/DELETE` on every table, `USAGE` on sequences, no `CREATE`. `ALTER DEFAULT PRIVILEGES` grants the same on tables the migrations role creates later.
  - **`caretook_replication`:** `REPLICATION`, and `SELECT` on exactly the columns each stream lists, per table (the union across streams).
  - **The `powersync` publication:** created or altered with the same per-table column lists.
  - Tables in no stream get no replication grant.
- **A parser** for `sync-config.yaml` that extracts `table → columns` from each stream's `SELECT` lists. It fails loudly on a `*` or on a column it can't resolve against the schema.
- **`pnpm db:roles`** (`packages/data/scripts/`) applies the SQL with `MIGRATIONS_DATABASE_URL`. It creates roles without passwords (the runbook sets them in Neon) and prints a summary of grants per role.
- **`pnpm db:access grant <email> --hours N`:**
  - Creates a `LOGIN` role `staff_<slug>` with a random password, `VALID UNTIL` now + N hours (max 24), and read-only grants on every table.
  - Prints the connection string once.
  - Records `db.accessGranted` with the hours in the audit log (system actor, the staff user as subject; the account must be staff).
- **`pnpm db:access revoke <email>`:** drops the role, records `db.accessRevoked`, and is safe to run twice.
- **`pnpm db:access list`:** shows active personal roles and their expiry.
- **The production PowerSync config.** A `powersync/service.production.example.yaml` documents the Cloud settings: `sslmode: verify-full`, the replication role, the JWKS at `<APP_URL>/api/auth/jwks`, the audience, and no admin token. It's for the runbook; Cloud reads the dashboard.

**Acceptance criteria:**

- [ ] `rolesSql` unit tests use a fixture sync config: the column grants per table, a table in two streams gets the union, an unsynced table gets nothing, and `*` or an unknown column fails. Assertions are on the parsed grants, not string snapshots.
- [ ] A unit test runs the real `powersync/sync-config.yaml` through the parser without error.
- [ ] Integration tests (test Postgres) apply the SQL twice (idempotent), then, connected as each role:
  - the app role can insert into and select from a table but `CREATE TABLE` and `ALTER TABLE` fail;
  - the replication role can select a synced column and fails on an unsynced one (e.g. `account.password`);
  - the publication's column lists match.
- [ ] Integration tests:
  - `grant` creates a role that can read but not write, and that expires (checked through `rolvaliduntil`);
  - `revoke` drops it;
  - both write the audit entries;
  - a non-staff email is refused.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 5, 6.

---

## Slice 3: Shared rate limits

Stack: no · Reads: docs/domain/auth.md, docs/domain/api.md, docs/domain/data-layer.md, docs/domain/notifications.md · Tests: unit, integration

**User stories:** 34, 35, 36, 37.

**What to build:**

- **`RateLimiter.hit` becomes async.** `createRateLimiter({ limit, windowMs, store })` takes a store:
  - `memoryStore` (today's behaviour) for unit tests and dev;
  - `postgresStore` in production and check builds.
- **The Postgres store** (adds the PRD's migration): a `rate_limit_hit` table (key, hit_at) indexed on (key, hit_at). The window is counted and the hit inserted in one statement, so two instances can't both pass the last slot. A fixed-window counter row is fine instead, if the sliding window proves awkward; say which in the hand-off.
- **Callers** (`packages/api` public forms, access codes, and any other `hit`) await it. Behaviour is unchanged.
- **Better Auth:** `rateLimit.storage = "database"`, with its table added through Better Auth's schema into the same migration. The rules stay (get-session 100 per 10 s, on only with `NODE_ENV=production`).
- **The purge.** The outbox cron's `sweepOutbox` also deletes rate-limit rows older than the longest window and Better Auth's expired rows.

**Acceptance criteria:**

- [ ] The limiter unit tests pass with `memoryStore`, unchanged apart from `await`.
- [ ] Integration tests:
  - two limiter instances sharing `postgresStore` together allow exactly `limit` hits in the window, run concurrently with `Promise.all`;
  - the window frees after `windowMs` (an injected `now`);
  - the purge deletes only old rows.
- [ ] An integration test of Better Auth's get-session limit across two `getAuth()` instances on the database store, through `getAuth().handler(new Request(…))`: the 101st request in 10 s is a 429 with `x-retry-after`.
- [ ] The migration is generated on the current base and its SQL order is reread.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 4, 6, 8.

---

## Slice 4: Bounces, complaints and suppression

Stack: no · Reads: docs/domain/notifications.md, docs/domain/admin.md, docs/domain/components.md, docs/domain/api.md, docs/domain/security-headers.md · Tests: unit, integration, component

**User stories:** 42, 43, 44, 45, 46.

**What to build:**

- **`verifyWebhook({ headers, body, secret, now })`**, pure. Svix's scheme: `svix-id`, `svix-timestamp`, `svix-signature`, and base64 HMAC-SHA256 over `${id}.${timestamp}.${body}`, keyed by the base64 secret after `whsec_`. It accepts any of several space-separated `v1,` signatures, rejects a timestamp more than 5 minutes off, and compares in constant time.
- **`email_suppression`** (regenerate slice 3's pending migration with it): address (lower-cased), reason (`bounce` | `complaint`), event id, created at, cleared at, cleared by, and the clear reason. One active row per address.
- **`emailSuppressionService`:**
  - `suppress(address, reason, eventId)` is idempotent on the event id.
  - `isSuppressed(address)`.
  - `clear(ctx, address, reason)` is staff-only (`users.help`) and records `mail.suppressionCleared` in its transaction.
  - `list(ctx, { query, page })` needs `users.read`.
- **`notify`.** Before delivery, a suppressed recipient's row is marked `skipped` with error `suppressed`, except for `magicLink`, `signInCode`, `resetPassword` and `verifyEmail`, which always send.
- **`/api/webhooks/resend`** (web only, appended to `routes.ts`):
  - It reads the raw body and verifies it with `RESEND_WEBHOOK_SECRET`; a failure is a 401.
  - `email.bounced` with a hard (permanent) bounce and `email.complained` suppress the address and mark the matching outbox row (by Resend's message id, stored at send) as bounced or complained.
  - Other events are a 200 and nothing else. A repeated Svix id is a 200 and nothing else.
  - It never logs the body.
  - It's exempt from the CSRF and origin rules that `/rpc` has; check the security-headers doc for anything it needs.
- **Resend message ids.** If the outbox doesn't store the provider's id yet, the `resend` sender saves it on send.
- **The `/admin` Suppressions page** (`routes/admin/…`, appended to `ADMIN_SECTIONS`, needing `users.read`):
  - a search by address, the list (address, reason, date), and an empty state;
  - a Clear action with a reason field, shown only with `users.help`;
  - the account page's outbox list shows "suppressed" for skipped rows.

  It uses the `ui/` primitives (`Field`, `IconButton`, …) and follows `docs/domain/components.md`.

**Acceptance criteria:**

- [ ] `verifyWebhook` unit tests use Svix's published test vector, plus: a wrong secret, a tampered body, an old timestamp, several signatures (one valid), and a secret with or without `whsec_`.
- [ ] Integration tests:
  - a signed bounce suppresses the address and marks its outbox row;
  - the same Svix id twice changes nothing;
  - a soft bounce changes nothing;
  - a complaint suppresses;
  - an unsigned request is a 401.
- [ ] Integration tests:
  - `notify` to a suppressed address skips `groupInvite` and still sends `signInCode`;
  - `clear` needs `users.help`, needs a reason, and writes the audit entry;
  - support can list.
- [ ] Component tests (`*.browser.test.tsx`) for the Suppressions page: the list, the empty state, search in the URL, Clear with a reason through the API stub, and no Clear without `users.help`.
- [ ] A rule for the new screen is appended to `scripts/loops/check-areas`.
- [ ] One pending migration for the PRD (slice 3's, regenerated).
- [ ] `pnpm check` passes.

**Blocked by:** 3. **Blocks:** 6.

---

## Slice 5: Deploy Actions and the smoke check

Stack: no · Reads: docs/domain/sync.md, docs/domain/notifications.md · Tests: unit

**User stories:** 1, 2, 3, 4, 5, 7, 8, 9, 10, 33.

**What to build:**

- **`smoke({ appUrl, powersyncUrl, fetch })`**, pure apart from the injected fetch. It returns named results:
  - `home`: 200 with HSTS, CSP and `X-Frame-Options`;
  - `jwks`: 200 with at least one key;
  - `rpc-unauthenticated`: a session-less `/rpc` call gives the expected unauthorized error;
  - `cron-locked`: `/api/cron/outbox` without a bearer is a 401;
  - `powersync`: the instance's health endpoint is OK;
  - `noindex` (staging only): `X-Robots-Tag` is present.

  `pnpm deploy:smoke <target>` prints a table and exits non-zero on any failure.

- **`.github/workflows/deploy.yml`:**
  - Runs on push to `staging` (environment `staging`) and `main` (environment `production`), with concurrency one per environment and no cancelling.
  - Steps:
    1. checkout;
    2. pnpm 12.21.0 and Node from `.nvmrc`;
    3. install (frozen lockfile);
    4. `pnpm deploy:env`;
    5. `pnpm datastore:migrate` with `MIGRATIONS_DATABASE_URL`;
    6. `pnpm db:roles`;
    7. the PowerSync CLI (`pnpm dlx` at a pinned version) deploys `powersync/sync-config.yaml` to the environment's instance;
    8. the Vercel CLI (`pnpm dlx` pinned) runs `pull`, `build` and `deploy --prebuilt --prod`;
    9. `pnpm deploy:smoke`.
  - Secrets come from GitHub environments only. Their names are listed at the top of the file.
- **`.github/workflows/admin-grant.yml`:** `workflow_dispatch` with an environment and an email input; it runs `pnpm admin:grant`.
- **`.github/workflows/seed-staging.yml`:** `workflow_dispatch`, staging only; it runs the seed (slice 1's guard applies).
- **`.github/workflows/db-access.yml`:** `workflow_dispatch` with an environment, `grant` or `revoke`, an email and hours. It runs slice 2's script and writes the connection string to the job summary, masked. If that can't be made safe, the hand-off says so and it prints only the role name, with the runbook covering the password.
- **Vercel auto-deploy** for `staging` and `main` is turned off in `vercel.json` (`git.deploymentEnabled`). Other branches stay off too: there are no previews.
- **Pinned versions** of the CLIs are kept in one place, read by the workflows.

**Acceptance criteria:**

- [ ] `smoke` unit tests run against a stub fetch: all pass, each check failing by name, a timeout counted as a failure, and `noindex` only on staging.
- [ ] `actionlint` through `pnpm dlx`, if it runs, or a YAML parse test (`scripts:unit`): the workflows parse and the deploy steps run in the order above.
- [ ] A unit test checks every secret the workflows reference is one `checkDeployEnv` knows, or is in the listed CI-only set (Vercel token, PowerSync token, `MIGRATIONS_DATABASE_URL`).
- [ ] `vercel.json` turns Git deploys off; slice 1's region and cron are kept.
- [ ] `pnpm check` passes.

**Blocked by:** 1, 2. **Blocks:** 6.

---

## Slice 6: The ops docs

Stack: no · Reads: docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/notifications.md, docs/domain/auth.md, docs/domain/admin.md, plans/security-review.md · Tests: none

**User stories:** 31, 32, 47, 48, 49, 50, 51.

**What to build** (in `ops/`, plain Markdown, in the house style of the area docs):

- **`ops/runbook.md`.** A setup checklist per environment, in order:
  1. GitHub: gh access, environments `staging` and `production`, every secret by name, and rulesets requiring PRs into `main` and `staging`.
  2. Neon: the project in `aws-us-east-2`, logical replication on, role passwords for slice 2's roles, `pnpm db:roles`, the pooled and direct URLs, PITR retention, log retention, and pgaudit if the plan offers it.
  3. PowerSync Cloud: the US instance, the replication connection (`verify-full`, the direct URL, the replication role), client auth (JWKS URL, audience), the admin token for the Action, and a question to PowerSync about us-east-2.
  4. Vercel Pro: the project, root directory, `cle1`, env vars per environment, domains (`caretook.com`, `www` → apex, `staging.caretook.com`), log retention, and auto-deploy off.
  5. Resend: the `mail.caretook.com` domain with SPF, DKIM and DMARC records; open and click tracking off; the webhook to `/api/webhooks/resend` for bounced and complained events; and the signing secret.
  6. DNS.
  7. The first deploy, then `admin-grant`, then on staging `seed-staging`.

  It also covers:
  - **Rotation:** how to rotate each secret and what breaks. `INVITE_LINK_KEY` breaks active invite links, `BETTER_AUTH_SECRET` signs everyone out, and the JWKS key rotation is Better Auth's.
  - **Rollback:** Vercel instant rollback, and the additive-migration rule.
  - **A failed deploy:** what to look at.

- **`ops/data-copies.md`, the data-copy register (S-6).** One row each for Postgres (Neon), Neon backups and PITR, PowerSync bucket storage (Cloud, us-east-1), the device databases, Resend (message bodies and retention), Vercel logs and Neon logs. Columns: region, encryption at rest, retention, who can access, and breach terms. Where a vendor's terms aren't known yet, the cell says "to confirm" and a link.
- **`ops/break-glass.md` (S-4).**
  - Who may look at care data (named staff, by role) and when: a user's written request, or a security incident.
  - How: `db:access grant` for at most the needed hours, read-only, and the audit entry.
  - Afterwards: revoke, write what was looked at and why, and tell the group's owners within a stated time.
  - Never: exports to laptops, screenshots of care data.
- **The legal pages are not edited** (B-54). The hand-off lists what the register and procedure let them promise.

**Acceptance criteria:**

- [ ] Every secret named in the workflows and in `checkDeployEnv` appears in the runbook with where it comes from.
- [ ] Every copy listed in the security review's S-6 has a row in the register.
- [ ] The break-glass procedure names the scripts and audit actions exactly as slice 2 built them.
- [ ] `pnpm format:check` passes on `ops/`.

**Blocked by:** 1, 2, 3, 4, 5, 8. **Blocks:** 7.

---

## Slice 7: Going live (with the user)

Stack: no · Reads: docs/loops.md · Tests: none (the live smoke check)

**User stories:** 1, 2, 7, 14, 15, 21, 25, 31, 38, 39, 51.

**What to do:** not a loop. The orchestrator works through `ops/runbook.md` with the user, who creates the accounts, DNS records and secrets. Staging comes first.

1. **Staging:**
   1. Set it up, then merge `dev` into `staging` by PR on GitHub (the user), which runs the deploy Action.
   2. `seed-staging`, then `admin-grant`.
   3. By hand: sign in on two devices as seeded users, make an edit and see it sync; send an invite to an allowlisted address and see it arrive (inbox, not spam) with no tracking.
2. **Production:** the same setup, the PR from `staging` into `main`, then `admin-grant` for the user's account.
3. **Recording:**
   - The orchestrator fixes the runbook where steps differed (on `prd/hosting`, `docs(hosting): …`).
   - It fills the register's "to confirm" cells it can.
   - It records pgaudit's availability, PowerSync's region answer, the header-merge answer and the pnpm version Vercel used.

**Acceptance criteria:**

- [ ] `pnpm deploy:smoke staging` and `pnpm deploy:smoke production` pass from the Action's last step.
- [ ] Hand tests on staging pass: a two-device sync, an invite email delivered and authenticated (SPF, DKIM and DMARC pass in its headers), and robots.txt disallowing everything.
- [ ] A deploy with a deliberately failing step (e.g. a smoke check pointed at a wrong URL, on staging) leaves the previous deploy live; then fix it.
- [ ] The rulesets on `main` and `staging` require PRs.
- [ ] The runbook and register are updated with what was learned.
- [ ] B-33 and B-68 are `done`.

**Blocked by:** 6, 9. **Blocks:** none.

---

## Slice 8: Native origins behind a flag, and the client IP from the host

Stack: no · Reads: docs/domain/api.md, docs/domain/auth.md, docs/domain/security-headers.md · Tests: unit, integration

**Backlog:** B-142, B-143. Added by the orchestrator on 2026-11-20 from the backlog agent's triage.

**What to build:**

- **Native origins, defined once and off by default (B-142).**
  - Today `capacitor://localhost` and `https://localhost` are hard-coded as trusted origins, with credentials, in `apps/web/app/routes/rpc.ts` and `packages/auth/src/auth.ts`. Define the list once (a small client-unsafe module in `packages/auth`, imported by both) and trust it only when `NATIVE_APP_ORIGINS=1` (env, read lazily like the rest of config).
  - Unset, neither CORS on `/rpc` nor Better Auth's `trustedOrigins` includes them. Dev, tests and checks run unset.
  - `checkDeployEnv` (slice 1) accepts it unset or `1` and rejects anything else; `.env.example` gains it with a comment.
- **The client IP from the host's own header (B-143).**
  - `clientIpOf` (`routes/rpc.ts`) and Better Auth's `advanced.ipAddress.ipAddressHeaders` both take one configured header, `CLIENT_IP_HEADER` (default: today's behaviour, the first `x-forwarded-for` entry, which the browser checks rely on through `cdp.mjs`'s per-page header).
  - On Vercel the deploy env sets `CLIENT_IP_HEADER=x-vercel-forwarded-for`; `checkDeployEnv` requires it on both targets. The value is a single header name, lower-cased; the first comma-separated entry is taken.
  - Define the header choice once and use it from both callers, so the limiter (slice 3) and Better Auth key on the same IP.

**Acceptance criteria:**

- [ ] Unit tests: the origin list is empty unless the flag is `1`; `clientIpOf` with the default, with `CLIENT_IP_HEADER` set (a spoofed `x-forwarded-for` is ignored), and with the header missing (null).
- [ ] An integration test through `getAuth().handler(new Request(…))`: with the flag unset, a sign-in POST from `Origin: capacitor://localhost` is refused; with it set, accepted.
- [ ] The `/rpc` CORS answer for `capacitor://localhost` is unit-tested both ways.
- [ ] `checkDeployEnv` tests cover both new variables.
- [ ] Nothing else still hard-codes the native origins (`grep`).
- [ ] `pnpm check` passes.

**Blocked by:** 1, 3. **Blocks:** 6.

---

## Slice 9: Secret rotation and narrower personal access

Stack: no · Reads: docs/domain/auth.md, docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/admin.md · Tests: unit, integration

**Backlog:** B-158, B-159, B-160 (gaps slice 6 found). Added by the orchestrator on 2026-11-20 at the user's choice, before going live.

**What to build:**

- **Personal access without the auth secrets (B-159).** `pnpm db:access grant` gives `staff_` roles SELECT on every table **except** the secrets: Better Auth's `account`, `session`, `verification` and `jwks`, the rate-limit tables, and any column holding a token, hash or sealed value elsewhere (e.g. the invite tables' sealed or hashed tokens). Keep one explicit, commented list (`PERSONAL_ACCESS_EXCLUDED`: tables, and `table.column` entries that become column grants), and a test that fails when a new table or column looks secret (a name matching `token|secret|hash|password|private`) and isn't listed or deliberately allowed. `revoke` revokes exactly what `grant` gave, including column grants.
- **Rotating `BETTER_AUTH_SECRET` without breaking sync (B-158).** Find out from the installed Better Auth (1.7.25, in `node_modules`) how its `jwt()` plugin stores the JWKS private key and whether it supports a versioned secret list (`BETTER_AUTH_SECRETS` or similar) for gradual rotation. Then:
  - if it does, support it in `packages/auth` config and `checkDeployEnv`, and document the two-step rotation;
  - either way, add `pnpm auth:rotate-jwks` (`packages/auth` or `packages/data/scripts/`): it marks or deletes the current key so Better Auth makes a new one, and records an audit entry with the system actor (append an `AUDIT_ACTIONS` entry, e.g. `auth.jwksRotated`). Say what happens to devices holding a token signed by the old key (15-minute tokens; does PowerSync refetch the JWKS?).
- **Staging's seed password rotation (B-160).** With `APP_ENV=staging`, the seed updates the seeded `@example.com` accounts' password hash to the current `SEED_USER_PASSWORD` (idempotent; no other change to existing rows). Dev keeps today's behaviour.
- **The runbook** (`ops/runbook.md`, `ops/break-glass.md`): replace the gaps' interim steps with the new commands, and add `pnpm auth:rotate-jwks` to the `db-access`-style manual Actions only if it can run safely from one (else the runbook says to run it from a laptop with the migrations URL).

**Acceptance criteria:**

- [ ] Integration: a granted `staff_` role reads a care table but is refused `account.password`, `session.token`, `jwks` and the invite token columns; `revoke` leaves no grants (`information_schema.column_privileges` / `role_table_grants` empty for the role).
- [ ] Unit: the secret-looking-column test runs over the Drizzle schema and passes on the current schema.
- [ ] Integration: after `auth:rotate-jwks`, `/api/auth/jwks` serves a new key and a token signed by it verifies; the audit entry is written.
- [ ] If a versioned secret list exists: a test that sessions made under the old secret still work after adding a new one first.
- [ ] Integration: the staging seed with a new `SEED_USER_PASSWORD` lets a seeded user sign in with it, and dev's seed is unchanged.
- [ ] `pnpm check` passes.

**Blocked by:** 6. **Blocks:** 7.
