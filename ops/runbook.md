# Runbook: hosting Caretook

How staging and production are set up, deployed, rotated and recovered. Written for whoever rebuilds or takes over the setup (the hosting PRD, `plans/hosting-prd.md`). The register of where care data lives is [`data-copies.md`](data-copies.md); who may look at it, and how, is [`break-glass.md`](break-glass.md).

- **No secret, password, connection string or real address goes in this folder.** Values are placeholders: `<…>`.
- Cells marked **to confirm** are checked when going live (hosting slice 7) and filled in here.
- Set up **staging first, then production**, following the same checklist. Everything is per environment unless it says otherwise.

## The shape of it

| Piece               | Staging                                  | Production                                     |
| ------------------- | ---------------------------------------- | ---------------------------------------------- |
| Branch that deploys | `staging`                                | `main`                                         |
| Web origin          | `https://staging.caretook.com`           | `https://caretook.com` (`www` redirects to it) |
| Vercel              | its own Pro project, functions in `cle1` | its own Pro project, `cle1`                    |
| Postgres            | its own Neon project, `aws-us-east-2`    | its own Neon project, `aws-us-east-2`          |
| Sync                | its own PowerSync Cloud instance (US)    | its own PowerSync Cloud instance (US)          |
| Email               | Resend, allowlisted recipients only      | Resend, everyone                               |
| GitHub environment  | `staging`                                | `production`                                   |
| Data                | fictional seed only                      | real users                                     |

- `APP_ENV` (`staging` | `production`) names the target; both run with `NODE_ENV=production`. The deploy derives it from the branch.
- **The deploy** (`.github/workflows/deploy.yml`, on a push to `staging` or `main`): env check (`pnpm deploy:env`) → migrate (`pnpm datastore:migrate`, as the migrations role) → roles (`pnpm db:roles`) → sync config (PowerSync CLI) → `vercel pull`, `vercel build`, `vercel deploy --prebuilt --prod` → smoke check (`pnpm deploy:smoke`). A failed step stops the run and the previous deploy stays live. One deploy per environment at a time; a newer push waits.
- **Manual Actions** (GitHub → Actions → Run workflow): `Grant staff` (`admin-grant.yml`), `Seed staging` (`seed-staging.yml`), `Database access` (`db-access.yml`), `Rotate JWT keys` (`rotate-jwks.yml`).
- Vercel's own Git deploys are off (`apps/web/vercel.json`: `git.deploymentEnabled: false`). The Action is the only way code goes live. There are no per-PR previews.
- Tool versions: the Vercel and PowerSync CLIs are pinned in `.github/cli-versions.env` and run through `pnpm dlx`. Node comes from `.nvmrc`, pnpm from `package.json`'s `packageManager`.

## Secrets and variables

Every secret the workflows and `checkDeployEnv` (`apps/web/app/.server/deployEnv.ts`) name. Each app variable lives **twice**: in the GitHub environment (the deploy's env check reads it) and in the Vercel project's Production environment (the server reads it). Keep the two equal: the server checks itself on its first request and answers 503, logging the missing or wrong names (never values), until they are.

### GitHub environment secrets (both `staging` and `production`)

| Name                      | Where it comes from                                                                                                     | Also in Vercel |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------- |
| `APP_URL`                 | the origin: `https://staging.caretook.com` or `https://caretook.com` (https, no path, the target's host)                | yes            |
| `BETTER_AUTH_SECRET`      | `openssl rand -base64 32` (at least 32 characters)                                                                      | yes            |
| `BETTER_AUTH_URL`         | the same value as `APP_URL`                                                                                             | yes            |
| `DATABASE_URL`            | Neon's **pooled** URL (host ends in `-pooler`) as `caretook_app`, with `?sslmode=verify-full`                           | yes            |
| `POWERSYNC_URL`           | the PowerSync Cloud instance URL (https)                                                                                | yes            |
| `VITE_POWERSYNC_URL`      | the same value as `POWERSYNC_URL`                                                                                       | yes            |
| `MAIL_SENDER`             | `resend`                                                                                                                | yes            |
| `RESEND_API_KEY`          | Resend → API keys: a sending-only key restricted to this environment's domain                                           | yes            |
| `MAIL_FROM`               | e.g. `Caretook <no-reply@mail.caretook.com>`; the domain must start with `mail.`                                        | yes            |
| `SUPPORT_EMAIL`           | the team's real support inbox (not `@example.com`)                                                                      | yes            |
| `CRON_SECRET`             | `openssl rand -base64 32`; Vercel sends it as the outbox cron's bearer                                                  | yes            |
| `INVITE_LINK_KEY`         | `openssl rand -base64 32`                                                                                               | yes            |
| `RESEND_WEBHOOK_SECRET`   | Resend → Webhooks → this environment's endpoint → signing secret (`whsec_…`)                                            | yes            |
| `CLIENT_IP_HEADER`        | `x-vercel-forwarded-for`                                                                                                | yes            |
| `NATIVE_APP_ORIGINS`      | **leave unset** until the native app ships; then `1`. Anything else fails the check.                                    | same           |
| `BETTER_AUTH_SECRETS`     | **unset** until the first rotation of `BETTER_AUTH_SECRET`; then `<version>:<secret>`, current first (see _Rotation_)   | same           |
| `MIGRATIONS_DATABASE_URL` | Neon's **direct** URL (no `-pooler`) as `caretook_migrations`, with `?sslmode=verify-full`. Only here, never in Vercel. | **no**         |
| `VERCEL_TOKEN`            | Vercel → Account settings → Tokens, scoped to the team; CI only                                                         | no             |
| `POWERSYNC_ADMIN_TOKEN`   | PowerSync dashboard → personal access token; the Action passes it to the CLI as `PS_ADMIN_TOKEN`; CI only               | no             |

Staging only:

| Name                 | Where it comes from                                                                                          | Also in Vercel |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | -------------- |
| `MAIL_ALLOWLIST`     | comma-separated addresses or `@domain`s that staging may mail (the team's). Must be **empty** in production. | yes            |
| `SEED_USER_PASSWORD` | a password manager's random password, 16+ characters, not the dev default. The seed Action uses it.          | **no**         |

### GitHub environment variables (not secret)

| Name                    | Where it comes from                                                          |
| ----------------------- | ---------------------------------------------------------------------------- |
| `VERCEL_ORG_ID`         | the Vercel team id (`.vercel/project.json` after `vercel link`, or Settings) |
| `VERCEL_PROJECT_ID`     | this environment's Vercel project id                                         |
| `POWERSYNC_INSTANCE_ID` | this environment's PowerSync instance id (its dashboard URL)                 |

### Vercel only

| Name                | Value                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| `APP_ENV`           | `staging` or `production` (GitHub derives it from the branch, Vercel needs it set) |
| `DATABASE_MAX_POOL` | optional, e.g. `5`: each function instance has its own pool (the default is 10)    |

- **Build-time values must not be Vercel "sensitive" variables.** `vercel pull` leaves sensitive values empty, and the build reads `APP_ENV`, `APP_URL` and `VITE_POWERSYNC_URL` (prerendered pages and the client bundle). Mark the real secrets sensitive; leave those plain.
- Never set in Vercel: `MIGRATIONS_DATABASE_URL`, `SEED_USER_PASSWORD`, `VERCEL_TOKEN`, `POWERSYNC_ADMIN_TOKEN`.

## Setup checklist (per environment)

### 1. GitHub

0. **The plan:** environments, environment secrets and rulesets need a **public** repository on GitHub Free, or GitHub Team for a private one. `caretook/caretook.com` is **public** (org on Free). So nothing secret is ever committed, and no workflow may run on `pull_request` or `pull_request_target` (forks could then reach the Actions); every workflow is `push` to `staging`/`main` or `workflow_dispatch`.
1. Make the repository visible to `gh` (`gh auth login`, `gh repo view` works). If it says "not found", the token lacks the org: `gh auth refresh -h github.com -s repo,admin:org`.
2. **Environments** (Settings → Environments): `staging` and `production`.
   - Deployment branches: `staging` only for `staging`, `main` only for `production`. This also limits the manual Actions to those branches' code.
   - `production` has the dev keeper as **required reviewer** (self-review allowed). Each workflow has one job in the environment, so it's one Approve per production deploy and per manual Action there. `staging` has none.
3. Every secret and variable in the tables above, in each environment.
4. **Ruleset** (Settings → Rules) `main and staging: PR only`, on `main` and `staging`: require a pull request (0 approvals: one maintainer can't approve their own PR), block force pushes, block deletion, no bypass. `staging` takes PRs from `dev`, `main` from `staging`; the ruleset doesn't check the source branch, so that and the local hooks (`.githooks/`) are the guard.
5. Actions settings: default workflow permissions read-only; artifact and log retention 7 days; fork PR workflows need approval for all outside contributors.
   - **Run logs are public** (public repo) for those 7 days. Secrets are masked, but a manual Action's inputs print: never put health details or anyone else's address in one, and delete a run that shows a staff email (`gh run delete <id>`) until B-183 masks the inputs.
6. Org security: **require two-factor** for members (Settings → Authentication security; the web UI only, the API ignores it).

### 2. Neon (Postgres)

0. **A Neon-managed org, not a Vercel-managed one.** An org made through Vercel's Neon integration can only create projects from Vercel, which connects them to Vercel projects and injects the owner's `DATABASE_URL`, `POSTGRES_URL`, `PG*` vars there, and puts the contract through Vercel. Caretook's Neon org is a direct Neon account (console.neon.tech, billed by Neon); never connect Neon to the Vercel projects through the integration.
1. A project per environment in **AWS us-east-2**, Postgres at the same major version as local development (18, which Neon offers). Plan: the one that gives the restore window and compliance features below (**to confirm**).
2. **Logical replication on** (Project settings → Logical replication). It restarts the compute and can't be turned off.
3. **The migrations role**: create `caretook_migrations` in Neon's console (console-made roles get Neon's `neon_superuser` membership, which gives `CREATEROLE` and the right to make `REPLICATION` roles; **to confirm** on the plan). Create the database (e.g. `caretook`) **owned by `caretook_migrations`**, so it owns the tables it creates and the default privileges for the app role apply.
   - On Neon's create-project screen keep the default database name (it belongs to `neondb_owner`) and leave every other service off (object storage, functions, AI gateway, realtime, Neon's Better Auth): only Postgres. Create `caretook` afterwards, owned by `caretook_migrations`.
   - Don't create `caretook_app` or `caretook_replication` in the console: `pnpm db:roles` creates them with SQL, without `neon_superuser` and without passwords.
4. **The other two roles (bootstrap, once):** the deploy runs `db:roles` after every migration, but the first deploy needs the roles to exist with passwords first. From a laptop, once per environment, with the migrations role's **direct** URL:

   ```sh
   cd <repo or worktree> && nvm use
   read -rs 'MIGRATIONS_DATABASE_URL?Direct URL: ' && export MIGRATIONS_DATABASE_URL   # zsh; bash: read -rsp
   export APP_ENV=<staging|production>
   pnpm datastore:migrate
   pnpm db:roles

   read -rs 'APP_PW?caretook_app password: ' && echo && export APP_PW
   read -rs 'REPL_PW?caretook_replication password: ' && echo && export REPL_PW
   psql "$MIGRATIONS_DATABASE_URL&sslrootcert=system" <<'SQL'
   \getenv app_pw APP_PW
   \getenv repl_pw REPL_PW
   ALTER ROLE caretook_app PASSWORD :'app_pw';
   ALTER ROLE caretook_replication PASSWORD :'repl_pw';
   SQL
   unset APP_PW REPL_PW MIGRATIONS_DATABASE_URL
   ```

   - The direct URL with `?sslmode=verify-full` (nothing else after `?`); `psql` also needs `sslrootcert=system` to trust the system CAs.
   - **Neon rejects `\password`** ("Neon only supports being given plaintext passwords"): it checks strength (about 60 bits; 32 random characters), so it takes the plaintext over TLS. `read -s` and `\getenv` keep it out of shell history, `~/.psql_history`, the process list and Neon's SQL editor. Store both in the password manager.
   - Then **reset `caretook_migrations`' password** in Neon's console and put the new direct URL in `MIGRATIONS_DATABASE_URL` (GitHub). From now on only the Action holds it.

5. **URLs:** the pooled one (`-pooler` host) as `caretook_app` → `DATABASE_URL`; the direct one as `caretook_migrations` → `MIGRATIONS_DATABASE_URL`; the direct one as `caretook_replication` → PowerSync (step 3). All with `sslmode=verify-full`.
6. **Restore window** (Neon's history retention, which is PITR): production at least 7 days (**to confirm** the plan's limit); staging the plan minimum. Record the value in `data-copies.md`.
7. **Compute:** turn **scale to zero off for production**. The pool waits only 2 s for a connection (`connectionTimeoutMillis: 2000`, `packages/data/src/db/client.ts`), which a compute waking from suspend may miss. Watch for connection timeouts after quiet periods on staging.
8. **Logs and audit:** pgaudit, or Neon's own records, if the plan offers it (**to confirm**). Write in `data-copies.md` exactly what is recorded and for how long, so the legal pages promise only that. Don't create production branches except for a restore: a branch is a full copy.
9. **Console access:** only the named people (`break-glass.md`), with two-factor sign-in. The SQL editor is not a way to read care data.

### 3. PowerSync Cloud

1. An instance per environment in the **US region** (us-east-1, the closest Cloud offers). Ask PowerSync:
   - whether Cloud can run in **us-east-2**, beside the database;
   - whether Cloud's first snapshot of a table runs `SELECT *` as the self-hosted service does (it's why the replication role reads `user`, `note_document` and `timeline_entry` whole: `REPLICATION_WHOLE_TABLES`);
   - whether Cloud serves `/probes/liveness` (the smoke check's `powersync` step uses it);
   - where bucket storage lives, how it's encrypted, how long it keeps removed rows, and the breach-notification terms (for `data-copies.md`).
2. **Create and deploy the instance once in the dashboard** before the first Action run; the Action only pushes sync configs to an instance that exists. `powersync/service.production.example.yaml` is the reference for every setting:
   - Database connection: the **direct** Neon host, the database, `caretook_replication` and its password, SSL mode **verify-full**. The publication is `powersync`, kept by `db:roles`.
   - Client auth: JWKS URI `<APP_URL>/api/auth/jwks`; audience = the instance's own URL (the value of `POWERSYNC_URL`). Development tokens off. PowerSync fetches the keys on its first request, so this can be set before the app is up.
   - A first sync config: paste `powersync/sync-config.yaml` (the Action replaces it on every deploy).
3. `POWERSYNC_INSTANCE_ID` (variable) and the personal access token `POWERSYNC_ADMIN_TOKEN` (secret) into the GitHub environment. The CLI needs only the instance id (`deploy sync-config --dry-run --instance-id <id>` with `PS_ADMIN_TOKEN` set checks the token without deploying).
4. Dashboard access: only the named people, with two-factor sign-in. The dashboard can show synced data.

### 4. Vercel (Pro)

1. **A project per environment** (e.g. `caretook-staging`, `caretook-production`) on the team, linked to the repository.
   - Root Directory `apps/web`; framework React Router; Node 24. Confirmed on staging: `vercel build` from the repo root follows the Root Directory, and installs with the workflow's pnpm 12.21.0 (its "Using pnpm@10.x based on project creation date" line is only detection; the install runs on the `pnpm` on `PATH`).
   - Functions run in `cle1` (`vercel.json` `regions`, Pro).
   - Auto-deploy is off through `vercel.json`; also leave "Ignored build step" alone, since the Action builds itself.
2. **Env vars** in each project's Production environment: the "Also in Vercel" rows above, plus `APP_ENV`.
3. **Domains:**
   - production: `caretook.com`, and `www.caretook.com` redirecting (308) to it;
   - staging: `staging.caretook.com`. Its noindex comes from `APP_ENV=staging` (robots.txt and the page meta) and `vercel.json`'s `X-Robots-Tag` on that host.
4. **Off:** Web Analytics, Speed Insights and log drains (no analytics that can see health data). Don't buy longer log retention (Observability Plus). Record the runtime log retention in `data-copies.md` (**to confirm**).
5. **Cron:** `vercel.json` runs `/api/cron/outbox` every minute; Vercel sends `CRON_SECRET` as the bearer. Crons run on production deployments only, which is what both projects deploy.
6. **Headers:** confirmed on staging: on a function's response the function's own header wins (one `Content-Security-Policy`, the full nonce policy; `/app`, `/sign-in`); prerendered and static files (`/`, `/features/`) get `vercel.json`'s short policy plus the page's `<meta>` CSP. Both match `docs/domain/security-headers.md`.
7. `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and `VERCEL_TOKEN` into the GitHub environment.

### 5. Resend

1. **Separate settings per environment.** Prefer a separate Resend team (or account) for staging: webhooks belong to the account, so a shared account would send production's bounces, with real addresses, to staging's endpoint (**to confirm** whether Resend can filter webhooks by domain).
2. **Domains:** production `mail.caretook.com`; staging e.g. `mail.staging.caretook.com` (any `mail.` subdomain passes the check). Sending region us-east-1.
3. **Records:** add the SPF, DKIM and return-path (MX) records Resend shows to DNS (step 6), plus DMARC. Wait until the domain shows verified.
4. **Open and click tracking off** on each domain (they're domain settings, not per message).
5. **Webhook:** `https://<host>/api/webhooks/resend` for `email.bounced` and `email.complained` only. Its signing secret (`whsec_…`) → `RESEND_WEBHOOK_SECRET`. A hard bounce or a complaint suppresses the address (`/admin/suppressions` lists and clears them); sign-in, reset and verification mail still go.
6. **API key:** sending access, restricted to the environment's domain → `RESEND_API_KEY`.
7. Record Resend's message retention in `data-copies.md` (**to confirm**).

### 6. DNS

`caretook.com`'s DNS is on **Cloudflare**. Every record below is **DNS only** (grey cloud), never proxied: a proxied record puts Cloudflare in front of Vercel, which breaks Vercel's certificate issuance and lets Cloudflare cache or rewrite responses (headers included).

| Record                             | Type       | Value                                                                                      |
| ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `caretook.com`                     | A or ALIAS | what Vercel shows for the domain                                                           |
| `www.caretook.com`                 | CNAME      | what Vercel shows (the redirect is set in Vercel)                                          |
| `staging.caretook.com`             | CNAME      | what Vercel shows for the staging project                                                  |
| Resend's DKIM, SPF and MX records  | TXT, MX    | exactly as Resend shows them, for `mail.` and `mail.staging.`                              |
| `_dmarc.mail.caretook.com`         | TXT        | `v=DMARC1; p=none; rua=mailto:<reports inbox>`, then `p=quarantine` once reports are clean |
| `_dmarc.mail.staging.caretook.com` | TXT        | the same                                                                                   |

- The apex's own mail records follow whoever hosts `SUPPORT_EMAIL`'s inbox. If nothing sends from the apex, publish `v=spf1 -all` there.
- Optional: a CAA record allowing the certificate authorities Vercel uses.

### 7. First deploy, staff, seed

1. **Deploy:** staging gets code by a PR from `dev` into `staging` on GitHub; merging it runs the deploy. Watch the run; the smoke check's table is in its last step. `origin/dev` must hold the deploy tooling (push `dev` first if the local one is ahead): a push without `.github/workflows/deploy.yml` runs nothing.
   - **Manual Actions need the workflows on `main`** (GitHub runs `workflow_dispatch` only for workflows on the default branch). Before production exists, merge `staging` into `main` by PR once and **cancel** the production Deploy run it starts (it waits for the required reviewer). Then run each manual Action with the branch of its environment (`gh workflow run seed-staging.yml --ref staging`). `gh run list --workflow …` also 404s until then.
2. **Staff:** sign up the first staff account through an invite or access code (it must exist), then run **Grant staff** (`admin-grant.yml`): environment, the account's email, role `admin`. It's recorded in the audit log with the system as actor. `/admin` then opens for that account.
3. **Staging only: Seed staging** (`seed-staging.yml`). The fictional seed, idempotent; seeded accounts use `SEED_USER_PASSWORD`. The seed refuses production.
4. **Hand checks on staging:** sign in on two devices as seeded users and see an edit sync; send an invite to an allowlisted address and check it arrives in the inbox with SPF, DKIM and DMARC passing and no tracking; `robots.txt` disallows everything.
5. Production: the same, by a PR from `staging` into `main`, then Grant staff for the dev keeper's account. No seed.

## Rotation

Rotate on a schedule you choose, when someone with access leaves, and at once on any suspicion. Change the value in **both** GitHub and Vercel where it lives in both, then redeploy (Vercel's env changes only with a new deploy): re-run the last Deploy run, or push.

| Secret                                  | How                                                                                                                                             | What breaks                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                    | the versioned list, below                                                                                                                       | **everyone is signed out** (session cookies and bearer tokens are checked against the current secret alone), and unused email-verification links stop working; sync carries on (below)                                                                                                                                                                   |
| `INVITE_LINK_KEY`                       | new value, both places, redeploy                                                                                                                | links already shared still work (they're checked by hash), but owners can't **copy an active link again** (`linkKeyMissing`); they make a new link instead                                                                                                                                                                                               |
| `CRON_SECRET`                           | new value, both places, redeploy                                                                                                                | nothing (Vercel sends the new one); the outbox sweep pauses until the deploy is live                                                                                                                                                                                                                                                                     |
| `RESEND_WEBHOOK_SECRET`                 | Resend → the endpoint → roll the secret; both places; redeploy                                                                                  | webhooks between the roll and the deploy get 401 and Resend retries them                                                                                                                                                                                                                                                                                 |
| `RESEND_API_KEY`                        | create a new key, both places, redeploy, then delete the old key                                                                                | nothing if done in that order                                                                                                                                                                                                                                                                                                                            |
| `caretook_app` password                 | `ALTER ROLE caretook_app` as in Neon step 4 (psql as the migrations role), new `DATABASE_URL` both places, redeploy                             | the live deploy can't connect between the two steps: do it right before the redeploy                                                                                                                                                                                                                                                                     |
| `caretook_replication` password         | `ALTER ROLE caretook_replication` as in Neon step 4, then update the PowerSync dashboard's connection                                           | sync pauses until PowerSync reconnects                                                                                                                                                                                                                                                                                                                   |
| `caretook_migrations` password          | Neon console → reset, new `MIGRATIONS_DATABASE_URL` in GitHub                                                                                   | nothing at runtime                                                                                                                                                                                                                                                                                                                                       |
| `VERCEL_TOKEN`, `POWERSYNC_ADMIN_TOKEN` | make a new one, update GitHub, revoke the old                                                                                                   | nothing at runtime                                                                                                                                                                                                                                                                                                                                       |
| `SEED_USER_PASSWORD` (staging)          | new value in GitHub, then run **Seed staging**                                                                                                  | nothing: the seed moves every seeded (`@example.com`) password account to the current value (`accounts.rotateStagingPasswords`) and changes nothing else                                                                                                                                                                                                 |
| JWKS signing key                        | **Rotate JWT keys** (`rotate-jwks.yml`: environment and reason), or `pnpm auth:rotate-jwks --reason "…"` with that environment's `DATABASE_URL` | nothing: devices fetch a new token every 15 minutes, signed by the new key, and tokens the old key signed verify until they expire (its public key stays in the JWKS for an hour). PowerSync should fetch the JWKS again when a token names a key it hasn't seen (**to confirm** on staging: rotate, then check a device still syncs within 15 minutes). |

### Rotating `BETTER_AUTH_SECRET`

Better Auth (1.7.25) encrypts the JWT signing key's private half (`jwks.private_key`) with the current secret. A new `BETTER_AUTH_SECRET` alone can't read it, so device tokens, and sync, would fail until the key was rotated. `BETTER_AUTH_SECRETS` (`<version>:<secret>`, comma-separated, **current first**) keeps the old one readable: the current entry signs cookies and encrypts new keys (recording its version), every listed version and the legacy `BETTER_AUTH_SECRET` still decrypt. The deploy's env check refuses a malformed list, a repeated version, or an entry under 32 characters.

1. **New secret current.** `openssl rand -base64 32`. Set `BETTER_AUTH_SECRETS` to `<n+1>:<new>` (the first time, `1:<new>`; later, `<n+1>:<new>,<n>:<current>`), and leave `BETTER_AUTH_SECRET` as it is. Both places; redeploy. Everyone is signed out (no way round it: cookies are checked against the current secret alone). After signing back in, sync works at once: the old key still decrypts.
2. **Rotate the key**: run **Rotate JWT keys** with the reason (e.g. "BETTER_AUTH_SECRET rotation"). The next token makes a key encrypted with the new version. It's in the audit log (`auth.jwksRotated`).
3. **Retire the old secret** (any later deploy): set `BETTER_AUTH_SECRET` to `<new>` and drop older entries from `BETTER_AUTH_SECRETS` (leaving `<n+1>:<new>`). Both places; redeploy. Nothing breaks. Keep the list from now on: the key is encrypted with its version.

- **In a hurry** (a leaked secret): leave the leaked value nowhere. Set `BETTER_AUTH_SECRETS` to `<n+1>:<new>` alone and `BETTER_AUTH_SECRET` to `<new>`, redeploy, and run **Rotate JWT keys** as soon as the deploy is live. Nothing can read the old key, so tokens fail between the two and sync pauses for those minutes.
- **A Vercel rollback** past a rotation brings back the older secret, which can't read the new key: run **Rotate JWT keys** again after the rollback (and again after the next deploy).
- Without Actions: `pnpm auth:rotate-jwks --reason "…"` from a laptop with that environment's `DATABASE_URL` (the app role: it's an ordinary write, and needs no auth secret).

## Rollback

- **Vercel instant rollback** (the project → Deployments → a previous one → Instant Rollback). Seconds, no rebuild.
- It's safe because **migrations are additive**: expand in one deploy (new tables, nullable columns), contract (drop, rename, make required) in a later one, once no live or rollback-able code uses the old shape. A migration that drops or renames something waits a deploy.
- Rolling back doesn't roll back the database or the sync config. The previous code must work with the newer schema and streams, which the additive rule guarantees.
- After a rollback, fix forward with a new push; the next deploy replaces the rolled-back one.

## A failed deploy

The previous deploy is still live. GitHub emails the pusher. Look at the run's failed step:

| Step      | Usual causes                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| env check | a missing or malformed secret: the log names the variable (never the value)                                                                                                                    |
| migrate   | a migration error, or `MIGRATIONS_DATABASE_URL` wrong. Migrations run in a transaction each; fix the migration and push.                                                                       |
| roles     | a stream column the schema doesn't have, a `*` in `sync-config.yaml`, or a synced table the replication role can't `SELECT *` (add its columns to the stream or to `REPLICATION_WHOLE_TABLES`) |
| powersync | the instance id or token, or the instance not set up yet (it must be deployed once in the dashboard), or a sync config PowerSync rejects                                                       |
| vercel    | the token or project ids, or a build error (reproduce with `pnpm build`)                                                                                                                       |
| smoke     | the check's table names what failed: `home` (status or security headers), `jwks`, `rpc-unauthenticated`, `cron-locked`, `powersync`, `noindex` (staging)                                       |

- **Smoke fails after the Vercel deploy:** the new code **is** live. Roll back in Vercel first, then investigate.
- **A 503 "configuration is incomplete":** the server's own env check; Vercel's function log names the variables. Fix them in Vercel and redeploy.
- Connection timeouts right after a quiet spell: the Neon compute waking (see Neon, step 7).
