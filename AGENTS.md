# Caretook: Project Context

Read this first. It's the **core**: the rules, the process and the architecture every session needs. Each area's rules and decisions live in a doc under `docs/` (the _Area index_ at the end says which to read when); read the ones your work touches, and use the index to find a rule your work didn't anticipate. Git history has the build logs; these files have what is still true.

Legend: ✅ decided/built · 🟡 proposed, not built · ❓ open.

## Working rules

- **Build only what the user asks for.** Planned work lives in the backlog and in PRDs (below); don't start a PRD or slice until the user says so.
- **No new dependencies without the user's approval.** Pin approved ones exactly.
- **Commit only when the user explicitly asks.** "Run before committing" is not a request to commit. Exceptions: once the user has started a PRD's loops, loops commit on their `slice/` branch and the orchestrator merges them into `prd/<topic>`; anyone may commit `plans/inbox.md` and `plans/backlog.md` onto `dev` through `pnpm backlog`; and an orchestrator lands its branch with `pnpm prd land` once the user says to land it (see _PRDs and parallel loops_). Never commit on `staging` or `main`.
- **Small changes go straight onto `dev`**, in the main checkout, with no worktree, PRD or orchestrator: a tooling or docs tweak, a config change, a contained fix the user asks for in the session. Run `pnpm check`, and commit when the user asks. Use a PRD (or a `quick-fixes` slice) when the work needs its own stack, will run alongside other work in parallel, touches a hot file a running PRD is changing, or adds a migration. **If you're unsure which it is, ask the user** before starting. When the user asks for a small fix in its own worktree, use a hotfix (`pnpm prd hotfix <name>`; _Hotfixes_ in `docs/loops.md`), and ask the user before each long test, commit, sync and landing unless they say not to.
- **Docs-only changes skip `pnpm check`.** When every changed file is Markdown (`AGENTS.md`, `docs/`, `plans/`, a README), run only `pnpm exec prettier --check <the changed files>` instead of `pnpm check` (or `pnpm prd check`), wherever a rule here asks for it. Any other file in the change, even a comment in code, means the full `pnpm check`.
- **Every commit subject is a [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/)**, merges included: `<type>(<scope>)!: <description>`. The `commit-msg` hook refuses anything else.
  - Types: `feat` (something a user can see or do), `fix` (a bug), `docs` (plans, PRDs, AGENTS.md, `docs/`, the README), `test` (tests and browser checks only), `refactor`, `perf`, `style`, `build`, `ci`, `chore` (tooling, syncing `dev`, the backlog), `revert`.
  - The scope is the PRD topic for PRD work (`feat(app-shell): group settings page (B-9)`), otherwise the area (`fix(sign-in): …`). Backlog ids go in parentheses at the end of the subject. Add `!` (and a `BREAKING CHANGE:` footer) for a breaking change.
  - A merge says what it brings, not which branch it merged: `git merge --no-ff -m "feat(app-shell): theme choice (slice 2, B-8)" slice/app-shell/2`. `pnpm prd sync`, `pnpm prd land` and `pnpm backlog` write theirs for you.
- **All seed and test data is fictional.** Never put real people's health information in the repo, even anonymized.
- Keep these files current: when a slice lands, fold its lasting decisions into the matching area doc (_Area index_), keep this core to rules and pointers, and delete anything the slice made stale.

## PRDs and parallel loops

Feature work goes through a PRD, then a plan cut into slices that loops (parallel agents) pick up. Several PRDs run at once, each with its own orchestrator and branch, and everything planned is tracked in one live backlog.

1. **PRD:** `write-a-prd` (interview, explore, sketch modules), saved as `plans/<topic>-prd.md`. No GitHub issues: the PRD, the plan and the backlog are the record.
2. **Plan:** `prd-to-plan` turns the PRD into tracer-bullet vertical slices in `plans/<topic>-plan.md`. Each slice says what it **blocks and is blocked by**, so independent slices can run at once.
   - `pnpm prd plan <topic> --open [B-<n> …]` does both in one planning session: it makes the docs-only worktree and starts an agent there (`prompt.sh plan`) that interviews the user, writes both files, updates the backlog and lands them (see the planning exception under _Landing a wave_ in `docs/loops.md`).
3. **Loops:** one agent per slice, each in its own worktree and branch (a Docker stack only for `Stack: yes`), run by the PRD's orchestrator. See [`docs/loops.md`](docs/loops.md).
4. When a PRD is done, move its lasting decisions into the area docs and mark the PRD done.

### Branches and roles

| Branch              | What it is                                          | How it changes                                                 |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| `main`              | Live.                                               | Only by PR merge from `staging` on GitHub.                     |
| `staging`           | What goes live next.                                | Only by PR merge from `dev` on GitHub.                         |
| `dev`               | Active work, and the trunk every PRD branches from. | `pnpm prd land`; `pnpm backlog` commits; small direct changes. |
| `prd/<topic>`       | One PRD's integration branch.                       | Its orchestrator merges its slices, and syncs `dev` in.        |
| `slice/<topic>/<n>` | One slice of that PRD.                              | Its loop agent commits.                                        |
| `plan/<topic>`      | Writing a PRD or plan (docs only).                  | Its agent commits; lands in `dev` like a PRD branch.           |
| `hotfix/<name>`     | One contained fix in its own worktree, no PRD.      | Its session commits when asked; lands like a PRD branch.       |

- **The dev keeper is the user.** The main checkout is theirs and **always stays on `dev`**. Orchestrators and loops never work in it; they reach it only through `pnpm backlog` (the two backlog files) and `pnpm prd land` (the landing merge). A session the user opens there may make small changes directly (see _Working rules_).
- **A PRD orchestrator** is a top-level session (spawned agents can't spawn more), one per PRD, opened by the user in the PRD's integration worktree `.loops/<topic>`. It reads `dev` but works on `prd/<topic>`, and is where the user steers that PRD. **At most three run at once** (`CARETOOK_MAX_PRDS`).
- **A loop** is one background agent working one slice in `.loops/<topic>-<n>`.
- **Protection** (`.githooks/`, turned on by `pnpm hooks:install`, which sets `core.hooksPath` for every worktree of the clone; `new.sh` runs it too):
  - `main` and `staging`: no commits, merge commits or pushes, and no local moves except a fast-forward to `origin`'s copy (`git fetch && git branch -f main origin/main`).
  - `dev`: not restricted by hooks. It takes landings, backlog commits and small direct changes.
  - On `main` and `staging`, the dev keeper overrides with `CARETOOK_ALLOW_PROTECTED=1`, and the hook says it was used. Agents never set it.
  - Every branch: `commit-msg` checks the subject is a Conventional Commit (skip one commit with `--no-verify`).
  - GitHub rulesets (PRs required on `main` and `staging`) come once `gh` can see the repo.

### The live backlog (`plans/inbox.md` and `plans/backlog.md`)

Everything planned (bugs, changes, features, big plans, questions) lives in two files, **only on `dev`**:

- **`plans/inbox.md` is the user's.** Plain bullets under `##` headings (Bugs, Changes, Features, Big plans, Questions; the heading sets the type), with indented lines for details. No ids or fields.
- **`plans/backlog.md` is the tracker** that agents keep and the user reviews: one item per bullet, with id `B-<n>`, status, PRD, owner, commit and notes, and a summary table at the top.
- **Ingest links them.** `pnpm backlog ingest` files every untagged inbox bullet as a tracker item (status `inbox`) and appends its id to the bullet: `- Login link can be clicked twice (B-1)`. That's the only change agents make to the inbox, so they rarely write while the user is editing it. Editing or deleting a filed bullet doesn't change its item; say so in a new bullet, or change the tracker. `pnpm backlog inbox` shows bullets not filed yet.
  - **When:** orchestrators run it at every wave boundary, and the user runs it whenever they like. Nothing ingests on its own, so a half-typed bullet is never filed.
- **Triage: agents propose, the user reviews.** An orchestrator or planning agent sets a new item's PRD (`set B-<n> prd=<topic> status=triaged`) and adds a note saying why. The user reviews that in the summary table and changes it if it's wrong.

`pnpm backlog` (`scripts/backlog/`) runs from any worktree. Each write takes a lock, edits the main checkout's copies, and commits only those two files onto `dev`, so the lists are live for everyone without merges. The top of `scripts/backlog/backlog.mjs` lists the commands.

- **Who writes:** the user (the inbox, and anything in the tracker), orchestrators, PRD-writing agents and loop agents. Others are writing too, so agents always change the tracker through `pnpm backlog`, which rereads it under the lock, never by writing back a copy read earlier. Hand edits in the main checkout are fine; `pnpm backlog commit` commits them, and the next tool write includes them. Agents may commit backlog changes without asking: that's the only exception to "commit only when asked".
- **Never on your own branch.** Neither file is edited or committed on `prd/`, `slice/`, `plan/` or `hotfix/` branches; the copies there are stale. Read them with `pnpm backlog list` and `pnpm backlog inbox`.
- **Fields:** type, status, `prd` (the topic it belongs to), `owner` (the branch that claimed it), `commit`, and free notes (`note` appends a dated, signed line).
- **Statuses:** inbox → triaged (has a PRD) → in-progress (claimed) → ready → landed → staging → live, or dropped.
  - `claim B-<n>` takes an item for your branch; **the first claim wins**, and others get an error.
  - `done B-<n>` (by the orchestrator, after merging the slice into `prd/<topic>`) records the commit and sets ready.
  - From then on the status is **worked out from git**: landed once `dev` contains the commit, staging and live once `origin/staging` and `origin/main` do. `list` shows it; `refresh` fetches and writes it.
- **The PRD table** at the top (topics, dependencies, hot files) says which PRDs can run at the same time. Change it when you add, reorder or finish a PRD.
- **Writes commit only what they changed** (`backlog.md`; the inbox only for `ingest` and `archive`'s removals), never your uncommitted inbox lines or staged work, and recompute git-derived statuses. `pnpm backlog doctor [--fix]` finds mis-tags, duplicate ids, stale statuses and summary drift (`--fix`: statuses and summary only). `pnpm backlog archive` moves finished items to `plans/backlog-archive.md`; `show` and `list --all` read it, and ids are never reused.
- Orchestrators run `pnpm backlog ingest` and `doctor`, and reread the backlog **at every wave boundary**. A new item for a running PRD becomes a slice in a later wave; a running slice never changes scope.

### Running loops

Orchestrators and loops read the handbook, [`docs/loops.md`](docs/loops.md), before running anything: `pnpm prd`, worktrees and slots, the browser check budget, steering, running and landing a wave, the browser checks and their gotchas. In brief:

- **`pnpm prd <command>`** is the one front door (`pnpm prd help`).
- **A wave:** `pnpm prd slice <topic> <n>` per ready slice, one background agent each (`pnpm prd prompt slice <topic> <n>`); review each hand-off, merge **in plan order** into `prd/<topic>` with no checks between merges, `pnpm backlog done`, `pnpm prd rm <topic>-<n>`.
- **Landing:** `pnpm prd sync`, the lean end-to-end set once (`pnpm prd browser --suite`), `pnpm prd check`, show the user `pnpm prd ready`, then `pnpm prd land <topic>` **only on their word** (or the landing mode they chose).
- **Browser checks** run only through `pnpm prd browser` (a machine-wide lease); `--changed` picks them from the diff. Never rerun one that passed.
- **Recovery:** `pnpm prd down` before a planned restart, `pnpm prd recover` after a restart, crash or usage limit; a resumed orchestrator reconciles _Status_ with git first (`docs/loops.md`, _Isolation_ and _Starting and steering_).

### Rules across PRDs

- **Migrations take the next number when they land, not when they're planned.** Plans say "adds a migration", not "0008". A loop generates whatever is next on its base. When a sync brings in another PRD's migration, keep `dev`'s, regenerate yours on top (`pnpm datastore:generate`), and reread its SQL order. Keep one pending migration per PRD where you can.
- **Seeds are append-only.** `timelineEntries.ts` ids follow position, so never insert in the middle: append at the end, or give a new feature's seeds their own file and ids.
- **Additive edits to shared registries.** In `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the device schema, the `sync.ts` upload switch, `routes.ts` and `KIND_META`, add entries at the end of their group and never reorder or reformat, so concurrent additions merge as adjacent hunks.
- **Hot files get regions first.** When two PRDs will change one screen (the backlog's PRD table lists hot files), a small slice first splits it into regions or components that each PRD fills (as `EntryHeader` did for live notes), and lands before both.
- **AGENTS.md and `docs/`:** loops never edit them. An orchestrator edits them at landing only, folding that wave's lasting decisions into the matching area doc (and only rules and pointers into this core), and keeps in-flight status in its plan.

### Loop rules

- Work only inside your worktree. Run `source ~/.nvm/nvm.sh && nvm use` in every shell (Node 24; browser checks need its global `WebSocket`).
- Your stack is your own. Run `pnpm datastore:reset`, `pnpm test`, `docker compose …` and `pnpm dev` freely from your worktree; they use your ports. Never touch the main checkout, other worktrees or other Compose projects.
- Run the dev server with `pnpm prd serve` (background, `WEB_PORT` pins the port; `--restart` after merges). New browser checks use `process.env.PG_CONTAINER` for `psql`, and launch Chrome and proxies through `cdp.mjs` and `proxy.mjs`, never fixed container names or ports.
- After editing `powersync/sync-config.yaml`, restart your own PowerSync: `docker compose restart powersync`.
- Follow the rules across PRDs (migrations, seeds, registries). Edits to shared files stay small and are listed in the hand-off. Read the docs your slice's `Reads` field names. Don't edit AGENTS.md or `docs/`, and change the backlog only through `pnpm backlog note`.
- No new dependencies. All data stays fictional.
- **Screens get component tests; cross-cutting flows get end-to-end checks** (`docs/loops.md`, _Browser check budget_). While building, `pnpm test:components --changed <base>`, plus `pnpm prd browser <check>` only for a flow you touch; before hand-off, `pnpm check` and `pnpm prd browser --changed` once (its ■ lines and table go in the hand-off). Never the suite; the orchestrator runs it at landing. A new screen, check or shared module adds its rule to `scripts/loops/check-areas`.
- When `pnpm check` and the slice's browser checks pass, **commit on your `slice/<topic>/<n>` branch** (coherent Conventional Commits scoped to the topic, ending with the attribution line). Don't merge, rebase or push any other branch, and never set `CARETOOK_ALLOW_PROTECTED`.
- **Hand-off** (the final message): what was built, grouped by area, with every shared-file edit called out; each acceptance criterion marked met or not met, with evidence; the `pnpm check` and browser-check output; anything skipped or surprising that later slices need; and the commit SHAs.

### Slice fields (`Stack`, `Reads`, `Tests`)

Every slice in a plan has a fields line directly under its heading (blank lines allowed between):

```
## Slice 3: Backlog write safety

Stack: no · Reads: docs/loops.md, docs/domain/sync.md · Tests: unit, e2e:invites
```

- **`Stack: yes|no`**: whether the slice's worktree needs a Docker stack (database, PowerSync, dev server). `new.sh slice` reads it.
- **`Reads:`** the docs the loop reads besides this core (comma-separated; `none` for nothing extra).
- **`Tests:`** what the slice adds or runs: `unit`, `integration`, `component`, `e2e:<check>` (comma-separated).
- `·`, `;` or `|` separate fields; names are case-insensitive. A missing field means **no stack, read nothing extra**, and `prompt.sh slice` warns. The parser is `scripts/loops/slice-fields.mjs`.

## Product

Caretook (caretook.com) is a mobile-responsive set of tools that help caretakers manage someone else's care, possibly packaged later with Capacitor. Feature areas (for stack decisions only):

- **Care timeline:** daily entries, symptoms, vitals and events. Real-time **and** offline sync between users is a hard requirement.
- **Medication list:** current, past and discontinued, plus a printable sheet.
- **Provider and contact directory.**
- **Later:** AI (reviewing timelines, appointment notes, questions for visits), and calendar (iCal feeds, Google Calendar).

## Stack

- ✅ **TypeScript 5.9** everywhere, with types inferred from backend to frontend (no codegen).
- ✅ **pnpm 12.21.0** workspaces (`apps/*`, `packages/*`) on **Node 24 LTS** (`.nvmrc`; run `nvm use`, since the machine default is older).
  - Settings live only in `pnpm-workspace.yaml`; pnpm 11+ ignores `.npmrc` and the `"pnpm"` field, and fails on unknown keys.
  - Keep `minimumReleaseAge` at its default (a supply-chain guard). If a package is too new, wait a day.
  - Build scripts need `allowBuilds`. Only `esbuild` is approved.
  - Check that the first Vercel deploy really runs pnpm 12 (the lockfile says `lockfileVersion: '9.0'`).
- ✅ **Lint, format and test** (root):
  - **ESLint 10**, flat config, type-aware `typescript-eslint` (`recommendedTypeChecked` with `projectService`), `consistent-type-imports`, `react-hooks` and `jsx-a11y` (it runs on ESLint 10 despite its peer range; don't switch to the `-x` fork without the user).
  - **Prettier 3** on its own (`printWidth` 110), with `eslint-config-prettier`.
  - **Vitest 5** projects in the root `vitest.config.ts`:
    - `data:unit` runs `*.test.ts` with no database.
    - `scripts:unit` runs the tooling's tests (`scripts/`) with a 20 s timeout: they spawn git and shells, which pass 5 s under load.
    - `integration` runs every package's `*.int.test.ts` against the test Postgres on :5435. Its globalSetup clears and migrates once per run, refuses any other host or port, and runs files one at a time. Tests build their own fixtures (`packages/data/test/fixtures.ts`).
    - `web:unit` runs apps/web's pure `app/**/*.test.ts` (no PowerSync; apps/web's vite.config isn't loaded, so tests import relatively, not through `~/`).
    - `web:components` runs `*.browser.test.tsx` in headless Chromium (Vitest browser mode) on the test device, under a `browser` lease: see [components](docs/domain/components.md).
- ✅ **React Router 8.5.1** (framework mode) with Vite 8, chosen over Next.js and TanStack Start: reads come from the local sync database, so server-centric frameworks gain little.
- ✅ **UI:** Tailwind v4 + **daisyUI 5** for styling, **React Aria Components** only where HTML falls short (DateField, Menu, Modal, ComboBox…), and `lucide-react` icons. Mobile-first, with daisyUI themes following the device.
  - Prefer native elements (`<dialog>` with `showModal()` for simple confirms).
- ✅ **Components** (`app/components/`; the full rules and every primitive's contract are in [`docs/domain/components.md`](docs/domain/components.md): read it before UI work): `ui/` holds the primitives, and **only `ui/` imports `react-aria-components`**; `ui/` imports nothing from feature folders. Feature folders are imported through each folder's `index.ts`, and a route never imports another route's folder. Every menu is `ui/Menu`, every labelled control a `Field`, every one-of-a-few choice a `ChoiceGroup`, every icon-only button an `IconButton`. **Hooks own state; components own markup**; a route only composes (about 100 lines). Light pages import from `~/components/ui/plain`.
- ✅ **Drizzle ORM 0.45** (`pg`), `drizzle-zod` and **Zod 4**; **oRPC 1.16.2**; **Better Auth 1.7.25**; **PowerSync** (web 2.7.0, drizzle-driver 0.8.0); **Yjs 13.6.33** and **Tiptap 3.34.0**.
- ❓ Turborepo.
- 🟡 Later: Playwright (+ `@axe-core/playwright`), Capacitor (`webDir` = `apps/web/build/native/client`), the Vercel AI SDK with Claude, print CSS (then `@react-pdf/renderer` if needed), an iCal feed and Google Calendar OAuth.

## Architecture

### Two build targets, one codebase

- `BUILD_TARGET` (`apps/web/build-target.ts`) selects the target:
  - **web** (the default) is SSR on Vercel, output in `build/web/`.
  - **native** is a static SPA (`ssr: false`) in `build/native/client/`, which is what Capacitor ships.
- `app/routes.ts`:
  - `/app/*` and `/sign-in` and `/sign-out` are shared by both targets.
  - `/`, `/api/auth/*` and `/rpc/*` are web only.
  - Native `/` redirects to `/app`.
- **Shared routes never export a server `loader` or `action`.** They use `clientLoader`/`clientAction`, read the local sync database, and call oRPC for anything server-side. The native build fails on violations ("SPA Mode: invalid route export(s)"). Web-only routes may use server loaders.
- `HydrateFallback` may only be exported from `root.tsx` (SPA mode).
- Why: Capacitor has no server, and pointing it at the live URL breaks offline use and risks App Store rejection (guideline 4.2).

### Data layer: `packages/data` (details: [`docs/domain/data-layer.md`](docs/domain/data-layer.md))

- `@caretook/data` is **server only**; `/schema`, `/errors` and `/permissions` are client-safe. In apps/web, server code imports through `app/.server/data.ts`.
- **Layers, bottom up:** `errors/` (errors are **returned, not thrown**; narrow with `isError()`), `permissions/` (`PERMISSIONS[table][action][role]`), `models/` (`baseModel`, with **RBAC enforced in SQL**: every query is ANDed with the actor's scope) and `services/` (business rules, side effects and transactions; they never read requests; `SYSTEM_USER` for internal work). **Write through the services.**
- UUID primary keys (clients create rows offline), `timestamps` and `audits` on every table. Adding a table, migrations and the DB client: the data-layer doc.

### Sync: PowerSync (details: [`docs/domain/sync.md`](docs/domain/sync.md))

- Postgres is the source of truth. Each device keeps a SQLite copy, and writes upload through **our** API (`sync.upload`), mapped onto services, so permissions, validation and audits all apply. Last write wins per row; live notes merge through Yjs.
- Sync Streams (`powersync/sync-config.yaml`) list their columns explicitly; restart PowerSync after editing it. Device code is `apps/web/app/lib/sync/`; its client loads lazily, never statically.
- Screens read the local database (`useLiveQuery`); anything server-side goes through oRPC ([`docs/domain/api.md`](docs/domain/api.md)).

### Hosting

- 🟡 **Vercel** for request/response work (CRUD, auth, uploads, calendar cron and webhooks). **AWS** for long-running work (AI jobs on SQS with Lambda or ECS, and the sync service if self-hosted).
- Live appointment audio would go from the client straight to the AI provider, with a short-lived token.
- Costs of the split: JWT auth that works everywhere, CORS, Postgres pooling, and functions in the database's region.

## Compliance

- ✅ **Deliberately outside HIPAA scope:** no BAAs, and no work on behalf of covered entities.
- Still applies: the FTC Health Breach Notification Rule and state laws (e.g. Washington's My Health My Data Act). In practice:
  - no ad or analytics tools that can see health data;
  - consent before sharing, and user data deletion;
  - encryption at rest;
  - AI vendors that don't retain our data or train on it.

## Open questions

- ❓ Account deletion by a group's last owner currently leaves the group ownerless. Block it, delete the group, or auto-promote?
- ❓ Hosted database, PowerSync production setup, rate-limit storage, native token storage (see the sections above).

## Dev workflow

### Commands (repo root, after `nvm use`)

| Command                                                       | What it does                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm --filter @caretook/web dev:native`         | dev server, SSR or SPA mode                                                                       |
| `pnpm build` / `pnpm build:native`                            | `apps/web/build/web/` or `apps/web/build/native/client/`                                          |
| `pnpm datastore:start`                                        | start Postgres, migrate, seed; needs `packages/data/.env` and `apps/web/.env` (from the examples) |
| `pnpm datastore:up` / `stop` / `logs`                         | the dev Postgres container                                                                        |
| `pnpm datastore:generate` / `migrate` / `seed` / `studio`     | generate a migration, apply them, insert dev data (idempotent), Drizzle Studio                    |
| `pnpm datastore:clear` / `reset`                              | drop everything (localhost only), or clear, migrate, seed and reset PowerSync                     |
| `pnpm datastore:start:test` / `reset:test` / `stop:test`      | the test database on :5435 (migrated, not seeded)                                                 |
| `pnpm lint` / `lint:fix`, `pnpm format` / `format:check`      | ESLint and Prettier                                                                               |
| `pnpm test` / `test:unit` / `test:integration` / `test:watch` | Vitest (integration needs `pnpm datastore:up:test`)                                               |
| `pnpm typecheck`                                              | tsc everywhere; apps/web checks the **web** target only (it covers every shared file)             |
| `pnpm check`                                                  | typecheck, lint, format check and tests: run it before handing off                                |
| `pnpm backlog …`                                              | the live backlog on `dev` (`ingest`, `list`, `claim`, `done`, …)                                  |
| `pnpm prd …`                                                  | parallel PRD worktrees (`status`, `start`, `check`, `land`, …; see `docs/loops.md`)               |
| `pnpm hooks:install`                                          | turn on the branch protection hooks (`.githooks/`): once, after cloning                           |

## Area index

Read a doc when your work touches its area. A slice's `Reads` field names the ones it needs; this table finds the rest. Orchestrators fold each landing's lasting decisions into the matching doc, and add a row here for a new area.

| Doc                                                 | Read it when your work touches                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| [loops](docs/loops.md)                              | running PRDs and slices, `pnpm prd`, stacks, browser checks, landing            |
| [orchestration](docs/orchestration.md)              | the human guide to the process                                                  |
| [layout](docs/layout.md)                            | where a package, route or module lives                                          |
| [components](docs/domain/components.md)             | any UI: `ui/` primitives, feature folders, settings pages, component tests      |
| [app-shell](docs/domain/app-shell.md)               | the `/app` header and menus, theme, sections, group route, `appUrls`, settings  |
| [timeline](docs/domain/timeline.md)                 | entry kinds, vitals, preferences, the timeline screen, filters, sheets          |
| [live-notes](docs/domain/live-notes.md)             | note and event documents, Yjs, the entry page, the editor                       |
| [care-groups](docs/domain/care-groups.md)           | groups, roles, the permission table, invites, join requests, access codes       |
| [providers](docs/domain/providers.md)               | the directory, provider pages, links from notes and events                      |
| [medications](docs/domain/medications.md)           | medications, doses, changes, what's due, the print sheet                        |
| [appointments](docs/domain/appointments.md)         | future events, Upcoming, cancel and reschedule                                  |
| [care-periods](docs/domain/care-periods.md)         | the period track, its screens, timeline markers                                 |
| [search](docs/domain/search.md)                     | the query language, the device index, search screens, server search             |
| [profiles](docs/domain/profiles.md)                 | the recipient's profile, contact sharing, emergency contacts                    |
| [marketing](docs/domain/marketing.md)               | public pages, SEO, brand assets, waitlist and contact                           |
| [notifications](docs/domain/notifications.md)       | email, the outbox, senders, the dev mailbox                                     |
| [auth](docs/domain/auth.md)                         | Better Auth, sign-in methods, sign-up tickets, account pages                    |
| [api](docs/domain/api.md)                           | oRPC procedures, errors, logging, DTOs                                          |
| [data-layer](docs/domain/data-layer.md)             | tables, permissions, models, services, migrations                               |
| [sync](docs/domain/sync.md)                         | PowerSync, streams, uploads, the device database, session, settings cache       |
| [security-headers](docs/domain/security-headers.md) | the CSP, a new script, origin or inline style                                   |
| [admin](docs/domain/admin.md)                       | staff roles and capabilities, `/admin`, the audit log, app settings, the banner |
| [assistant](docs/domain/assistant.md)               | quick entry: the actions, the parser, the runner, the box and its suggestions   |
| [tasks](docs/domain/tasks.md)                       | the task table and rules, the Tasks section, the task page, links               |

## Next steps

1. **The backlog** (`pnpm backlog list`): write the PRDs its table marks "to write" (`pnpm prd plan <topic>`, one `write-a-prd` interview each), then run them, at most three at once.
2. **Tests:** cover every role against every table (the integration tests are independent now: each builds its own fixtures).
3. **Hosting:** choose the hosted database and how production migrations run. Set up PowerSync Cloud.
4. **After invites:** the launch work in `docs/domain/notifications.md`. Then Capacitor (bearer storage, `VITE_API_ORIGIN`).
