# PRD: Hosting

> Backlog: B-33 (production hosting and launch) and B-68 (email sending setup). Topic `hosting`. Covers the security review's S-4 (staff access below the app), S-6 (copies outside Postgres) and S-7 (rate limits per instance). Written 2026-11-19 from an interview with the user.

## Problem Statement

Caretook runs only on a laptop. Everything a real deploy needs is either undecided or only works locally:

- **No hosted database.** There's no choice of provider, region, pooling, or how production migrations run, and no rule that keeps DDL credentials away from the app.
- **No production sync.** PowerSync runs from a local container with `sslmode: disable`, a dev admin token and a JWKS on `localhost`. There's no Cloud instance, no replication role, and no way for `sync-config.yaml` to reach one.
- **No deploy.** `apps/web/vercel.json` holds only headers. There's no Vercel build preset, no region, no cron for the outbox and no `waitUntil` for background email. No GitHub Actions exist, and `gh` can't see the repository yet.
- **No staging.** `staging` is a branch with nowhere to deploy, so the first time code meets real infrastructure would be production.
- **Rate limits don't hold** (S-7). Better Auth's limiter and `packages/api/src/rateLimit.ts` are in memory, so on serverless every instance counts on its own, and password guessing isn't really limited.
- **Email isn't launch-ready** (B-68). Resend tracking is still on, there are no SPF, DKIM or DMARC records and no bounce webhook, and nothing stops mail to an address that bounces or complains.
- **The privacy promises have nothing below the app** (S-4, S-6). Anyone with the database URL reads everything, unrecorded. Nobody has written down where each copy of care data lives (Postgres, backups, PowerSync's bucket storage, Resend, logs) or who can reach it.
- **Dev-only shortcuts could leak into a deploy.** The seed has no production guard, its password is public, and a deploy has no check that its environment is complete and consistent.

## Solution

Two hosted environments, **staging** and **production**, deployed by a GitHub Action, with least-privilege database roles and written operating procedures.

- **Providers and region:**
  - **Vercel Pro** for the web app, with functions in `cle1` (Cleveland, AWS us-east-2).
  - **Neon** Postgres in `aws-us-east-2`, through its pooler.
  - **PowerSync Cloud** in its US region (us-east-1, the closest it offers). The config stays portable so it can be self-hosted in us-east-2 later, and we ask PowerSync about us-east-2.
- **Environments:**
  - **Production** on `caretook.com` (`www` redirects to it), deployed from `main`.
  - **Staging** on `staging.caretook.com`, deployed from `staging`. Each has its own Neon project and PowerSync instance.
  - Staging is public, but seeded only with fictional data under a secret seed password, marked noindex everywhere, and emails only the allowlist.
  - No per-PR previews.
- **The deploy** is driven by an Action on a push to `staging` or `main`, with Vercel's Git auto-deploy off for those branches:
  1. check the environment;
  2. migrate (with the migrations role);
  3. push `sync-config.yaml` with the PowerSync CLI;
  4. deploy with the Vercel CLI;
  5. run the smoke check.

  If any step fails, the previous deploy stays live. Rollback is Vercel's instant rollback, which is safe because migrations are additive (expand now, contract in a later deploy).

- **Database roles:**
  - the **app** role (reads and writes, no DDL);
  - the **migrations** role (DDL, held only by the Action);
  - the **replication** role (column-limited grants matching the sync streams, and a publication with the same column lists).

  The grants are generated from `sync-config.yaml`, so they can't drift from it. People get only named, time-limited read roles from a script that records each grant in the audit log.

- **Rate limits** live in Postgres: Better Auth's `database` storage, and our limiter on a small table. Each keeps the same interface.
- **Email:**
  - Resend's open and click tracking are off on the domain.
  - SPF, DKIM and DMARC are set up on `mail.caretook.com`.
  - The outbox sweep runs every minute (Vercel cron).
  - `waitUntil` keeps background sends alive.
  - A Svix-signed bounce and complaint webhook marks the outbox row and **suppresses** the address. `notify` skips suppressed addresses except for sign-in emails, and `/admin` lists suppressions and can clear one.
- **Ops docs** in a new top-level `ops/` folder:
  - the **runbook** (setting up and rotating every provider, DNS and GitHub);
  - the **data-copy register** (each copy's region, encryption at rest, retention, access and breach terms);
  - the **break-glass procedure** (who may look at care data, when, and how the group is told).
- **The first staff account** is granted by a manually dispatched Action, so no laptop needs production credentials.

## User Stories

### Deploying

1. As the dev keeper, I want a push to `staging` to deploy staging without my touching a dashboard, so that every release is tried on real infrastructure first.
2. As the dev keeper, I want a push to `main` to deploy production the same way, so that production deploys are repeatable.
3. As the dev keeper, I want migrations to run before the new code goes live, so that the new code never meets an old schema.
4. As the dev keeper, I want a failed migration to stop the deploy and leave the old version live, so that a bad migration doesn't take the site down.
5. As the dev keeper, I want `sync-config.yaml` pushed to the environment's PowerSync instance in the same deploy, after the migration and before the app, so that streams never reference columns that don't exist yet, and the app never expects streams that aren't there.
6. As the dev keeper, I want the deploy to refuse to start when an environment variable is missing, malformed or inconsistent, so that a misconfigured deploy fails in CI, not in front of users.
7. As the dev keeper, I want a smoke check after each deploy, which fails the workflow and emails me through GitHub, so that I learn about a broken deploy within minutes.
8. As the dev keeper, I want to roll back with Vercel's instant rollback, so that recovering from a bad release takes seconds.
9. As a developer, I want a rule that migrations are additive and a contract step waits a deploy, so that rollback stays safe.
10. As the dev keeper, I want staging and production to use separate databases, PowerSync instances, secrets and Resend settings, so that staging can never touch real data.
11. As the dev keeper, I want the Vercel functions in the same AWS region as the database, so that every request's database round trips stay short.
12. As the dev keeper, I want `www.caretook.com` to redirect to `caretook.com`, so that there's one canonical origin.
13. As the dev keeper, I want the production server to refuse to start with an incomplete environment, so that a config change made in Vercel's dashboard can't silently break production.
14. As the dev keeper, I want to confirm Vercel builds with pnpm 12.21.0 and Node 24, so that the deploy uses the same toolchain as development.
15. As the dev keeper, I want to know whether Vercel merges or replaces function headers with `vercel.json`'s, so that the CSP and HSTS are what the security-headers doc says.

### Staging

16. As the dev keeper, I want staging seeded with the fictional seed, so that I can click through every screen on real infrastructure.
17. As the dev keeper, I want staging's seed accounts to use a secret password, so that a public staging isn't an open door.
18. As the dev keeper, I want staging marked noindex in robots.txt and on every page, so that search engines never list it.
19. As the dev keeper, I want staging to email only allowlisted addresses, so that tests never mail strangers.
20. As the dev keeper, I want the seed to refuse to run against production, so that fictional data never lands next to real data.

### Sync

21. As a caretaker, I want my devices to sync with production through PowerSync Cloud, so that real-time and offline sync work outside the laptop.
22. As the dev keeper, I want PowerSync to connect with `sslmode: verify-full`, so that replication can't be intercepted.
23. As the dev keeper, I want PowerSync's replication role to see only the columns the sync streams list, so that unsynced columns (password hashes, sealed tokens) never reach the vendor's bucket storage.
24. As the dev keeper, I want the replication grants and the publication's column lists generated from `sync-config.yaml`, so that adding a column to a stream can't be forgotten in the grants.
25. As the dev keeper, I want PowerSync Cloud to reach each environment's JWKS at its public `/api/auth/jwks`, with the audience set to the instance's URL, so that device tokens verify.

### Database access

26. As the dev keeper, I want the app to connect with a role that can't run DDL, so that a bug or an injection can't drop or alter tables.
27. As the dev keeper, I want the migrations role's credentials only in GitHub's environment secrets, so that nothing at runtime holds DDL rights.
28. As the dev keeper, I want the role and grant SQL generated and applied by a script, so that the roles are reproducible in staging and production.
29. As staff, I want a personal read-only database role that expires on its own, so that looking at production for a support case doesn't need a shared password.
30. As the dev keeper, I want every personal role grant and revoke recorded in the audit log, so that "staff see care data only with permission, recorded" is true below the app.
31. As the dev keeper, I want pgaudit (or Neon's own records) on wherever the plan allows, and the runbook to say exactly what is recorded, so that the legal pages promise only what's real.
32. As the dev keeper, I want a written break-glass procedure, so that whoever looks at care data in an emergency knows who may, when, and how the group is told.
33. As the dev keeper, I want the first staff account granted by a manually dispatched Action, so that bootstrapping `/admin` needs no production credentials on a laptop.

### Rate limits

34. As a caretaker, I want sign-in attempts limited across every server instance, so that my password can't be guessed by spreading attempts across instances.
35. As the dev keeper, I want the public forms' limiter (waitlist, contact, access codes) shared across instances too, so that the forms can't be flooded.
36. As a developer, I want the limiter's interface unchanged apart from becoming async, so that its callers barely change.
37. As the dev keeper, I want old rate-limit rows cleaned up, so that the table doesn't grow forever.

### Email

38. As a caretaker, I want emails from Caretook to arrive in my inbox, not spam, so that I get invites and sign-in codes. That needs SPF, DKIM and DMARC on `mail.caretook.com`.
39. As a caretaker, I want no tracking pixels or rewritten links in my emails, so that Caretook doesn't watch what I open.
40. As a caretaker, I want sign-in emails to go out at once even on serverless, so that I'm not left waiting. `waitUntil` runs the background sender.
41. As a caretaker, I want a failed email retried within minutes, so that a provider blip doesn't lose my invite. The outbox sweep runs every minute.
42. As the dev keeper, I want Resend's bounce and complaint webhooks verified by their Svix signature, so that nobody can forge them.
43. As the dev keeper, I want a hard bounce or complaint to mark the outbox row and suppress the address, so that we stop mailing addresses that harm our sender reputation.
44. As a caretaker whose address was suppressed, I want sign-in emails still sent, so that I can always get back into my account.
45. As staff, I want to see suppressed addresses in `/admin` with the reason and date, and clear one, so that a fixed mailbox can get mail again.
46. As the dev keeper, I want clearing a suppression recorded in the audit log, so that staff actions stay accountable.

### Records and compliance

47. As the dev keeper, I want a data-copy register listing every copy of care data (Postgres, its backups, PowerSync bucket storage, Resend, Vercel and Neon logs) with region, encryption at rest, retention, access and breach terms, so that the FTC Health Breach Notification Rule's questions have answers.
48. As the dev keeper, I want Vercel's and Neon's log retention set to the shortest useful window, so that logs, which may carry care data until S-8's fix, live briefly.
49. As the dev keeper, I want a runbook covering setup and rotation for Neon, PowerSync Cloud, Vercel, Resend, DNS and GitHub (environments, secrets, rulesets), so that the setup can be rebuilt or handed over.
50. As the dev keeper, I want the runbook to say how to rotate each secret, including `INVITE_LINK_KEY` (which breaks active links), so that rotation isn't improvised.
51. As the dev keeper, I want GitHub rulesets requiring PRs into `main` and `staging`, so that the branch rules hold on the server, not only in local hooks.

## Implementation Decisions

- **Providers (decided):** Vercel Pro (`cle1`), Neon (`aws-us-east-2`, pooled connection for the app, direct connection for migrations and replication), PowerSync Cloud (US). Asking PowerSync about us-east-2 is a runbook step; the bucket copy's region goes in the register.
- **Approved dependencies (2026-11-19):** `@vercel/react-router` and `@vercel/functions`, pinned exactly, added in the Vercel slice. The PowerSync CLI and Vercel CLI run in the Action through `pnpm dlx` at pinned versions: tools, not repo dependencies. Svix verification uses `node:crypto`, with no Svix package.
- **Deploy env check (deep module):** `checkDeployEnv(target, env)` returns a list of problems.
  - Required variables per target.
  - `APP_URL` is https and matches the target's host.
  - `BETTER_AUTH_URL` equals `APP_URL`.
  - `POWERSYNC_URL` equals `VITE_POWERSYNC_URL`.
  - `MAIL_SENDER=resend`, with `RESEND_API_KEY`.
  - `CRON_SECRET`, `BETTER_AUTH_SECRET`, `INVITE_LINK_KEY` and the webhook secret are long enough.
  - `DATABASE_URL` is pooled and isn't the migrations role.
  - Staging's `SEED_USER_PASSWORD` isn't the dev default.
  - A small `APP_ENV` (`staging` | `production`) names the target, since both run with `NODE_ENV=production`.

  The Action runs it first, and the production server runs it at start (refusing to serve, in the way production already refuses without `RESEND_API_KEY`).

- **Role and grant generator (deep module):** `rolesSql({ syncConfig, tables })` returns idempotent SQL for three roles:
  - **app:** `CONNECT`, `USAGE`, DML on every table, sequences; no `CREATE`.
  - **migrations:** owns the schema.
  - **replication:** `REPLICATION`, `SELECT` on exactly the synced columns, and a publication `powersync` with column lists.

  It parses the streams' explicit column lists (sync config already lists columns). A script applies it with the migrations role, and the deploy re-runs it after each migration, so new tables get grants. Default privileges keep new tables reachable by the app role.

- **Personal access:** `grant-access <email> --hours N` creates a `LOGIN` role named after the staff member, read-only and `VALID UNTIL` now plus N hours, and `revoke-access` drops it. Both write an audit-log entry (system actor, with the staff member as subject). They run as manual Actions or from a laptop with the migrations URL, which the runbook says when to use.
- **pgaudit:** enable it where the Neon plan allows; otherwise the runbook records what Neon's console logs. The first slice that touches Neon checks this and writes the answer in the register.
- **Shared rate limiter:** `RateLimiter.hit` becomes async, with a Postgres store: a table of (key, hit time) with a sliding window counted in one statement, or a fixed-window counter if that proves simpler. The in-memory store stays for unit tests. Better Auth's `rateLimit.storage = "database"` uses its own table. Expired rows are purged by the outbox cron's sweep. Adds a migration.
- **Email suppression:** a new `email_suppression` table (address, reason: bounce | complaint, source event, created, cleared at and by). `notify` checks it and marks the row `skipped` (reason suppressed), except for the sign-in kinds (`magicLink`, `signInCode`, `resetPassword`, `verifyEmail`). Staff read and clear suppressions through an admin oRPC procedure (a new staff capability), and clearing writes the audit log. It goes in the same migration as the limiter where both land together; otherwise its own.
- **Webhook:** a web-only `/api/webhooks/resend` route checks the Svix signature with `verifyWebhook(headers, rawBody, secret, now)`: base64 HMAC-SHA256 over `id.timestamp.body`, `whsec_` secrets, several `v1,` signatures, and a 5-minute tolerance. It maps `email.bounced` (hard only) and `email.complained` to the suppression service, and `email.delivered` to nothing. It's idempotent on the Svix message id. It never logs the body.
- **Vercel wiring:**
  - The `@vercel/react-router` preset in the React Router config, for the web target only (native unchanged).
  - `setBackgroundRunner(waitUntil)` at server start.
  - `vercel.json`: `regions: ["cle1"]`, a cron `* * * * *` on `/api/cron/outbox` (Vercel sends `CRON_SECRET` as the bearer), and the existing headers. The `www` redirect is set in Vercel's domain settings.
  - The project's root directory, and whether function headers merge with `vercel.json`'s, are confirmed and written into the security-headers doc at landing.
- **Staging noindex:** with `APP_ENV=staging`, robots.txt disallows everything and the root layout adds `noindex`. Prerendered pages read `APP_ENV` at build time, since each environment builds separately.
- **Seed guard:** the seed refuses when `APP_ENV=production`, or when the database URL's host is the production one named in the env. Staging runs the seed from a manual Action.
- **Smoke check (deep module):** `smoke({ appUrl, powersyncUrl, fetch })` checks that:
  - the home page returns 200 with the security headers;
  - `/api/auth/jwks` returns keys;
  - a session-less `/rpc` call returns the expected unauthorized error;
  - `/api/cron/outbox` without a bearer returns 401;
  - PowerSync's health endpoint is up.

  It's a script the Action runs, and it exits non-zero on any failure.

- **GitHub Actions:**
  - `deploy.yml` runs on push to `staging` and `main`, using GitHub environments `staging` and `production` with their secrets: env check → migrate → roles SQL → PowerSync sync config → Vercel deploy (`--prod` for each project) → smoke. One concurrency group per environment.
  - `admin-grant.yml`, `seed-staging.yml` and `db-access.yml` are manual dispatches.
  - The rulesets requiring PRs into `main` and `staging` are runbook steps once `gh` can see the repo.
  - `pnpm check` in CI on PRs is out of scope (see below).
- **`ops/` folder (new):** `runbook.md`, `data-copies.md` and `break-glass.md`. Loops may write it, since it isn't `docs/`. The orchestrator adds a pointer to it in AGENTS.md and the area index, and closes the open questions it answers (the hosted database, migrations, PowerSync production, rate-limit storage) in AGENTS.md, `docs/domain/data-layer.md`, `sync.md`, `auth.md`, `notifications.md` and `security-headers.md`.
- **Manual setup is the user's:** creating the Neon, PowerSync, Vercel and Resend accounts, DNS and GitHub secrets follows the runbook and is done by the user. The plan's last slice is going live on staging, then production, with the smoke check passing against each.

## Testing Decisions

- Good tests check behaviour through the module's interface, such as the grants a role ends up with or whether an email was sent, not how the SQL string is built.
- **Unit (`data:unit`, `scripts:unit`):**
  - `checkDeployEnv`: each rule, both targets.
  - `rolesSql`, run against a fixture sync config: the grants per table and column, and the publication's column lists. No string snapshots.
  - `verifyWebhook`: known vectors, a bad signature, an expired timestamp, multiple signatures, a secret with and without the prefix.
  - `smoke`: against a stub fetch, each failure reported by name.
  - robots and noindex under `APP_ENV`.
- **Integration (`integration`, test Postgres):**
  - The shared limiter counts across two limiter instances and frees the window over time.
  - Better Auth's database storage limits get-session across instances.
  - `notify` skips suppressed addresses except sign-in kinds.
  - The webhook handler, end to end with a signed body: marks the row, suppresses, and is idempotent.
  - Clearing a suppression writes the audit log.
  - The seed guard refuses.
  - `grant-access` and `revoke-access` create and drop a role and audit each.
  - Applying the generated roles SQL to the test database: the app role can't `CREATE` or `ALTER`, and the replication role can't select an unsynced column.
- **Component (`web:components`):** the `/admin` suppressions screen: the list, an empty state, and clearing one through the API stub. Prior art: the admin screens' tests.
- **End to end:** none new. Nothing here is a device sync flow, and the lean set's budget stays as it is.
- **Live:** the last slice's acceptance is the smoke check passing against staging and production, plus a sign-in and a synced edit on staging done by hand from the runbook.
- **Prior art:** `packages/api/src/*.int.test.ts` for services, the outbox's tests in `packages/notifications`, `seo.test.ts` for robots, and the admin screens' component tests.

## Out of Scope

- Capacitor, native bearer storage and `VITE_API_ORIGIN` for native.
- Self-hosting PowerSync on AWS (later; the config stays portable).
- Per-PR preview environments and Neon branches for them.
- AWS long-running work (AI jobs on SQS).
- An error-tracking vendor or log drain; the S-8 code fix to keep care data out of logs (a quick fix).
- CI running `pnpm check` on PRs (a later small change; the loops run it locally).
- Rewriting the legal pages (B-54), which should read the register and the break-glass procedure once they exist.
- Two-factor sign-in (B-85, `account-security`).
- Infrastructure as code (Terraform, Pulumi).

## Further Notes

- Whether Neon's plan offers pgaudit, and PowerSync's answer on us-east-2, are recorded when known; neither blocks the build.
- Production is invitation-only already (sign-up needs a ticket), so going live doesn't open public sign-up.
- `marketing` (B-40, B-54) and launch email (B-68's parts here) need production to go live; B-56 (`documents`) needs file storage, which this PRD doesn't add.
