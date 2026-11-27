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
- **Manual Actions** (GitHub → Actions → Run workflow): `Grant staff` (`admin-grant.yml`), `Seed staging` (`seed-staging.yml`), `Reset staging` (`reset-staging.yml`), `Database access` (`db-access.yml`), `Rotate JWT keys` (`rotate-jwks.yml`).
- **CI** (`.github/workflows/ci.yml`) runs only when requested: `risa ci run <tier>` pushes the commit to a `ci/<tier>/<name>` ref. No PR or push to `dev`, `staging` or `main` starts it. It reads no secrets, its env is fictional and generated per job, and its logs are public. The `components` tier adds three Chromium shards (`components-1` to `components-3`); `full` adds a `build` job (build budget, `build:native`, a grep of both built clients for `caretookSync`) with its env from `node scripts/ci/env.mjs build`; `candidate` adds a `browser` job (35-minute limit, about 7 in practice): the Docker stack, then the served check build and `browser.sh --suite` in America/Los_Angeles, with its env from `node scripts/ci/env.mjs browser`. A narrowed run never starts it, and a failure before its setup finishes reads as `infra`. Lint runs with a 6 GB heap, since type-aware ESLint outgrew Node's default on the runner.
- **A run's verdict** has a kind, and `risa ci run --wait` exits by it: 0 green, 1 brake, 2 file, 3 flake, 4 infra, 5 unknown, 64 usage, 75 timeout. A failed test file reruns once in its job. A flake's GitHub run shows `success`, so read the verdict, not the colour.
  - `scripts/ci/brake-list.txt` (edited by hand; a line matching no test fails `lists.test.mjs`) names the tests whose failure is a brake, and with `check:<name>` a whole browser check (the five sync checks). Its flakes are filed and never quarantined.
  - **Browser checks** reach the verdict by name as `pass`, `flake`, `fail` or `not-run`. A failed check reruns once in the job, unless the runner already retried it; a pass on the rerun, or the runner's FLAKY, is a `flake`. Browser flakes are filed, never quarantined. A check the job never reached reads as `infra`. Blaming a browser failure needs a whole `candidate` run on dev.
  - **The `release` tier** adds two more browser suite jobs (`browser-2`, `browser-3`, each with its own 35-minute limit) and a second-zone run in America/New_York (`zone-browser`, `zone-components-1`, `zone-components-2`). A check failing in all three suites blocks, and failing in some is a flake. `SECOND_ZONE_MODE` in `scripts/ci/zones.mjs` is `report` (the default) or `block`. On `report`, zone failures can't fail the verdict, so **GitHub can show a release run red under a green verdict**. `risa ci zone-file [<branch>] [--run <id>]` files one `fixes-bug` item per test file, at most 10 a run, with the rest on B-372. A rerun of the same commit files nothing new.
  - **The main gate:** `risa ci release [--wait <min>] [--rerun]` runs or reads the `release` tier on the head of the open staging to main PR, writes the `release-gate` status from its verdict and files the zone failures. With no open PR it refuses. A newer commit needs a new run. **Agents write `release-gate` no other way**; `risa ci release-test <commit>` writes only `error`, only on a throwaway commit, and refuses anything on `staging` or `main`.
  - **The override (the user's, for an emergency):** `risa ci override <commit> --reason "…"` needs a real terminal, the typed short commit and the PR's head. It writes `release-gate` as passing with `OVERRIDE` in its description, comments on the PR and leaves a notice. The reason is public, so leave out health details and names. A later `ci release` on that commit replaces the override's status (B-722). It guards against accidents and isn't a security boundary.
  - `risa ci run candidate --force-flake <check>` proves the flake path: it forces one failure through a marker in a throwaway commit on its own ref. Its verdict never passes a gate and writes no status.
  - `scripts/ci/quarantine.txt` (`<file><TAB><full test name><TAB>B-n`) is skipped everywhere except a run's quarantine step, which can't fail the run. Closing an entry's item removes the entry.
  - `--files …` narrows a run: a throwaway commit adds `.ci-narrowed.json` on its own `ci/` ref, and its verdict never counts as the branch's.
  - An infra verdict is rerun once, and a rerun replaces the `verdict` artifact. A waiting whole-tier run writes the commit status `caretook-ci/<tier>`. `risa status` shows each branch's verdict, cached in the main checkout's `.loops/.ci-status/`.
  - `risa ci blame` compares a `file` or `brake` verdict with dev's tip and exits 0 all dev's, 2 some the branch's, 5 unknown (an infra, truncated or flaky dev result, a quarantined test that didn't pass on dev, or a named test in a file dev couldn't load stays unknown). `risa ci file` files flakes.
  - Filing keeps a `[ci-key <key>]` in the item's first note. `backlog ci-file` is one locked commit, never amended, pushed without force. A dev brake posts one notice, withdrawn by a later blame that passes its key. Done items' quarantine entries leave on any write and in `risa tidy`.
  - A dev commit changing only the brake list or the quarantine isn't drift and keeps a check pass; a branch changing only a list still needs a check.
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
| `CRON_SECRET`             | `openssl rand -base64 32`; Vercel sends it as the crons' bearer                                                         | yes            |
| `INVITE_LINK_KEY`         | `openssl rand -base64 32`                                                                                               | yes            |
| `GOOGLE_CLIENT_ID`        | optional until Google Calendar launches: Google Cloud → APIs & Services → Credentials → the OAuth client (step 5a)      | yes            |
| `GOOGLE_CLIENT_SECRET`    | the same OAuth client's secret                                                                                          | yes            |
| `GOOGLE_TOKEN_KEY`        | `openssl rand -base64 32`; seals Google refresh tokens. Connect is refused in production without it                     | yes            |
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
4. **Ruleset** (Settings → Rules) `main and staging: PR only`, on `main` and `staging`: require a pull request (0 approvals: one maintainer can't approve their own PR), block force pushes, block deletion, no bypass. `staging` takes release candidates (`rc/*`, cut from `dev`), `main` takes PRs from `staging`; the ruleset doesn't check the source branch, so that and the local hooks (`.githooks/`) are the guard. **The user's step, once a real green `release-gate` exists on a staging to main PR:** add `release-gate` as a required status check on `main` (from any source), with "require branches to be up to date" **off**, because `main` holds merge commits `staging` lacks. Until then the check is visible but not enforced. No tool edits a ruleset.
   4b. **Ruleset** `dev: no force push`, on `dev`: block force pushes and deletion, no bypass, **no** PR requirement (backlog commits are pushed straight to `dev`). The user's manual step.
   4c. **Codex** (ChatGPT's GitHub connector, bot `chatgpt-codex-connector`) auto-reviews every PR into `dev` and each push to it; `risa review` reads its verdict, and AGENTS.md's _Review guidelines_ steer it.
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
7. **Compute:** turn **scale to zero off for production**. The pool waits 10 s for a connection (`DATABASE_CONNECT_TIMEOUT_MS`, default 10000, `packages/data/src/config.ts`; B-342), which covers most wakes from suspend. Watch for connection timeouts after quiet periods on staging.
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
5. **Cron:** `vercel.json` runs `/api/cron/outbox` (email) and `/api/cron/calendar` (the calendar steps in order: reminders, Google push, Google pull, series top-up) every minute; Vercel sends `CRON_SECRET` as the bearer. Crons run on production deployments only, which is what both projects deploy.
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

### 5a. Google Calendar (the user's setup)

Members connect their own Google account per care group; Caretook makes a "Caretook: <recipient>" calendar there and pushes to it. Until the three `GOOGLE_*` values are set, the Google card says it isn't set up.

1. **A Google Cloud project** per environment (or one with a client per environment). Enable the **Google Calendar API**.
2. **OAuth consent screen:** external; app name Caretook, support email, the privacy policy and home page; the only scope `https://www.googleapis.com/auth/calendar.app.created` (make secondary calendars and manage their events; it covers `calendars.insert` and `events.insert`, `update`, `delete` and `list` with a sync token, checked 2026-11-20). Until Google verifies the app, add the testers as **test users** (fine for staging).
3. **Credentials:** an OAuth client ID, type Web application, authorised redirect URI `<APP_URL>/api/google/callback` (e.g. `https://staging.caretook.com/api/google/callback`). Its id and secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. `GOOGLE_TOKEN_KEY`: `openssl rand -base64 32`. Rotating it makes every member reconnect (their sealed tokens no longer open; the card says "Reconnect Google").
5. Pushes run right after a save and every minute from `/api/cron/calendar` (`googlePush`); pulls (members' changes in Google: moves, deletes, new events) run from the same cron (`googlePull`), each connection at most every 5 minutes. Nothing else to schedule.
6. **Smoke check before launch** (`pnpm calendar:google-smoke`, manual, never in `pnpm check`; `--help` lists its flags). It connects a member, adds two made-up appointments and pushes the group, then, through Google's API, moves one, deletes the other and makes a new event, pulls, checks Caretook took each change (the move, a cancel, a new appointment tagged as ours), and removes what it made. Run it from a checkout against a local stack, with the staging OAuth client:
   1. In Google Cloud, add `http://localhost:5173/api/google/callback` to the staging client's authorised redirect URIs, and the Google account you'll use as a test user.
   2. `pnpm datastore:reset`, then put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (staging's) in `packages/data/.env`; dev seals tokens with its fixed key, so `GOOGLE_TOKEN_KEY` can stay unset. The dev server needn't run.
   3. `pnpm calendar:google-smoke --email caretaker@example.com` (a writer in Dev Family only). Open the URL it prints, allow access, and paste back the address Google sends you to (the page itself may not load). Every line should be ✓; `--keep` leaves the appointments to look at in Google, `--disconnect` disconnects at the end.
   4. Then on staging itself, as a test member: Connect on Calendar & reminders, move an event in "Caretook: <recipient>" in Google, and within about 6 minutes see the new time in Caretook; remove the localhost redirect URI when done.

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

1. **Deploy:** staging gets code from a release candidate. `risa ci candidate cut --wait` fixes a `dev` commit on an `rc/*` branch, opens its PR into `staging` and runs the `candidate` tier; `risa ci candidate fix <commit>` adds a `fix` already in `dev`; `risa ci promote` merges only a tip that passes, and that merge runs the deploy. Agents never merge a candidate any other way; the user's hand merge on GitHub is the override. Watch the run; the smoke check's table is in its last step. `origin/dev` must hold the deploy tooling (push `dev` first if the local one is ahead): a push without `.github/workflows/deploy.yml` runs nothing.
   - **Manual Actions need the workflows on `main`** (GitHub runs `workflow_dispatch` only for workflows on the default branch). Before production exists, merge `staging` into `main` by PR once and **cancel** the production Deploy run it starts (it waits for the required reviewer). Then run each manual Action with the branch of its environment (`gh workflow run seed-staging.yml --ref staging`). `gh run list --workflow …` also 404s until then.
2. **Staff:** sign up the first staff account through an invite or access code (it must exist), then run **Grant staff** (`admin-grant.yml`): environment, the account's email, role `admin`. It's recorded in the audit log with the system as actor. `/admin` then opens for that account.
3. **Staging only: Seed staging** (`seed-staging.yml`). The fictional seed, idempotent; seeded accounts use `SEED_USER_PASSWORD`, the seeded invite link is sealed with `INVITE_LINK_KEY` (the staging environment's secret, Vercel's value; without it the seed and reset refuse). The seed refuses production.
   - **To start staging over: Reset staging** (`reset-staging.yml`; type `staging` to confirm). It deletes every row except real sign-ins (accounts that aren't `@example.com` keep their user, staff role, password and sessions; staff settings, bounced addresses and the signing keys stay too), then seeds again. Groups people made by hand, connector and Google links all go, so reconnect those afterwards. Nothing is dropped, so devices empty and refill through sync on their own.
   - On staging both Actions make every real account an **owner of each seeded group**, so a new tester sees the fictional data after the next seed without an invite.
4. **Hand checks on staging:** sign in on two devices as seeded users and see an edit sync; send an invite to an allowlisted address and check it arrives in the inbox with SPF, DKIM and DMARC passing and no tracking; `robots.txt` disallows everything.
   - **Connectors** ([connectors](../docs/domain/connectors.md)): as Dev Family's owner (its switch is seeded on), add `https://<staging host>/mcp` as a custom connector in Claude (Settings → Connectors) and in ChatGPT (developer mode). Each should register, send you to `/connect`, and come back connected. Ask it to read today's timeline, then to log a vital: the client asks before the write, and the entry shows "via <client>". Then disconnect in Settings → Devices, and the next call fails.
5. Production: the same, by a PR from `staging` into `main`, then Grant staff for the dev keeper's account. No seed.

## Rotation

Rotate on a schedule you choose, when someone with access leaves, and at once on any suspicion. Change the value in **both** GitHub and Vercel where it lives in both, then redeploy (Vercel's env changes only with a new deploy): re-run the last Deploy run, or push.

| Secret                                  | How                                                                                                                                             | What breaks                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                    | the versioned list, below                                                                                                                       | **everyone is signed out** (session cookies and bearer tokens are checked against the current secret alone), and unused email-verification links stop working; sync carries on (below)                                                                                                                                                                   |
| `INVITE_LINK_KEY`                       | new value, both places, redeploy                                                                                                                | links already shared still work (they're checked by hash), but owners can't **copy an active link again** (`linkKeyMissing`); they make a new link instead                                                                                                                                                                                               |
| `GOOGLE_TOKEN_KEY`                      | new value, both places, redeploy                                                                                                                | every Google connection stops (its sealed token no longer opens) and shows "Reconnect Google"; members connect again and keep their calendar                                                                                                                                                                                                             |
| `GOOGLE_CLIENT_SECRET`                  | Google Cloud → the OAuth client → add a secret, both places, redeploy, then delete the old secret                                               | nothing if done in that order                                                                                                                                                                                                                                                                                                                            |
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
- **The one exception:** `0032_todos` renamed `task` to `todo` in one step, so its migration and the sync config change (`FROM todo`) must deploy together (one `deploy.yml` run does both). A device offline across that deploy loses its queued `task` uploads, which the server refuses as an unknown table (accepted: production isn't live). Rolling back past it is not supported.
- After a rollback, fix forward with a new push; the next deploy replaces the rolled-back one.

## A failed deploy

The previous deploy is still live. GitHub emails the pusher. Look at the run's failed step:

| Step      | Usual causes                                                                                                                                                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| env check | a missing or malformed secret: the log names the variable (never the value)                                                                                                                                                                                            |
| migrate   | a migration error, or `MIGRATIONS_DATABASE_URL` wrong. Migrations run in a transaction each; fix the migration and push.                                                                                                                                               |
| roles     | a stream column the schema doesn't have, a `*` in `sync-config.yaml`, or a synced table the replication role can't `SELECT *` (add its columns to the stream or to `REPLICATION_WHOLE_TABLES`)                                                                         |
| powersync | the instance id or token, or the instance not set up yet (it must be deployed once in the dashboard), or a sync config PowerSync rejects                                                                                                                               |
| vercel    | the token or project ids, or a build error (reproduce with `pnpm build`)                                                                                                                                                                                               |
| smoke     | the check's table names what failed: `home` (status or security headers), `jwks`, `rpc-unauthenticated`, `cron-locked` (both cron routes answer 401), `mcp-unauthenticated` (`/mcp` without a token is 401 with `resource_metadata`), `powersync`, `noindex` (staging) |

- **Smoke fails after the Vercel deploy:** the new code **is** live. Roll back in Vercel first, then investigate.
- **A 503 "configuration is incomplete":** the server's own env check; Vercel's function log names the variables. Fix them in Vercel and redeploy.
- Connection timeouts right after a quiet spell: the Neon compute waking (see Neon, step 7).
