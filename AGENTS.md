# Caretook: Project Context

Read this first. It records decisions, conventions and gotchas so a new session can pick up without re-deriving them. Git history has the build logs; this file has what is still true.

Legend: ✅ decided/built · 🟡 proposed, not built · ❓ open.

## Working rules

- **Build only what the user asks for.** Planned work lives in the backlog and in PRDs (below); don't start a PRD or slice until the user says so.
- **No new dependencies without the user's approval.** Pin approved ones exactly.
- **Commit only when the user explicitly asks.** "Run before committing" is not a request to commit. Exceptions: once the user has started a PRD's loops, loops commit on their `slice/` branch and the orchestrator merges them into `prd/<topic>`; anyone may commit `plans/inbox.md` and `plans/backlog.md` onto `dev` through `pnpm backlog`; and an orchestrator lands its branch with `pnpm prd land` once the user says to land it (see _PRDs and parallel loops_). Never commit on `staging` or `main`.
- **Small changes go straight onto `dev`**, in the main checkout, with no worktree, PRD or orchestrator: a tooling or docs tweak, a config change, a contained fix the user asks for in the session. Run `pnpm check`, and commit when the user asks. Use a PRD (or a `quick-fixes` slice) when the work needs its own stack, will run alongside other work in parallel, touches a hot file a running PRD is changing, or adds a migration. **If you're unsure which it is, ask the user** before starting.
- **Every commit subject is a [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/)**, merges included: `<type>(<scope>)!: <description>`. The `commit-msg` hook refuses anything else.
  - Types: `feat` (something a user can see or do), `fix` (a bug), `docs` (plans, PRDs, this file, the README), `test` (tests and browser checks only), `refactor`, `perf`, `style`, `build`, `ci`, `chore` (tooling, syncing `dev`, the backlog), `revert`.
  - The scope is the PRD topic for PRD work (`feat(app-shell): group settings page (B-9)`), otherwise the area (`fix(sign-in): …`). Backlog ids go in parentheses at the end of the subject. Add `!` (and a `BREAKING CHANGE:` footer) for a breaking change.
  - A merge says what it brings, not which branch it merged: `git merge --no-ff -m "feat(app-shell): theme choice (slice 2, B-8)" slice/app-shell/2`. `pnpm prd sync`, `pnpm prd land` and `pnpm backlog` write theirs for you.
- **All seed and test data is fictional.** Never put real people's health information in the repo, even anonymized.
- Keep this file current: when a slice lands, fold its lasting decisions into the right section and delete anything it made stale.

## PRDs and parallel loops

Feature work goes through a PRD, then a plan cut into slices that loops (parallel agents) pick up. Several PRDs run at once, each with its own orchestrator and branch, and everything planned is tracked in one live backlog.

1. **PRD:** `write-a-prd` (interview, explore, sketch modules), saved as `plans/<topic>-prd.md`, then filed as a GitHub issue. `gh` can't see `caretook/caretook.com` yet (git over SSH works); file the issues once it can.
2. **Plan:** `prd-to-plan` turns the PRD into tracer-bullet vertical slices in `plans/<topic>-plan.md`. Each slice says what it **blocks and is blocked by**, so independent slices can run at once. `prd-to-issues` makes one issue per slice.
3. **Loops:** one agent per slice, each in its own worktree, branch and Docker stack, run by the PRD's orchestrator. See _Running loops_.
4. When a PRD is done, move its lasting decisions into this file and mark the PRD done.

### Branches and roles

| Branch              | What it is                                          | How it changes                                                 |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| `main`              | Live.                                               | Only by PR merge from `staging` on GitHub.                     |
| `staging`           | What goes live next.                                | Only by PR merge from `dev` on GitHub.                         |
| `dev`               | Active work, and the trunk every PRD branches from. | `pnpm prd land`; `pnpm backlog` commits; small direct changes. |
| `prd/<topic>`       | One PRD's integration branch.                       | Its orchestrator merges its slices, and syncs `dev` in.        |
| `slice/<topic>/<n>` | One slice of that PRD.                              | Its loop agent commits.                                        |
| `plan/<topic>`      | Writing a PRD or plan (docs only).                  | Its agent commits; lands in `dev` like a PRD branch.           |

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
- **Never on your own branch.** Neither file is edited or committed on `prd/`, `slice/` or `plan/` branches; the copies there are stale. Read them with `pnpm backlog list` and `pnpm backlog inbox`.
- **Fields:** type, status, `prd` (the topic it belongs to), `owner` (the branch that claimed it), `commit`, and free notes (`note` appends a dated, signed line).
- **Statuses:** inbox → triaged (has a PRD) → in-progress (claimed) → ready → landed → staging → live, or dropped.
  - `claim B-<n>` takes an item for your branch; **the first claim wins**, and others get an error.
  - `done B-<n>` (by the orchestrator, after merging the slice into `prd/<topic>`) records the commit and sets ready.
  - From then on the status is **worked out from git**: landed once `dev` contains the commit, staging and live once `origin/staging` and `origin/main` do. `list` shows it; `refresh` fetches and writes it.
- **The PRD table** at the top (topics, dependencies, hot files) says which PRDs can run at the same time. Change it when you add, reorder or finish a PRD.
- Orchestrators run `pnpm backlog ingest` and reread the backlog **at every wave boundary**. A new item for a running PRD becomes a slice in a later wave; a running slice never changes scope.

### Running loops

**`pnpm prd <command>`** is the one front door (`scripts/loops/prd.sh`; run it from any worktree, and `pnpm prd help` lists it):

| Command                               | What it does                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm prd status`                     | every worktree: branch, commits ahead, dirty or clean, containers, and its dev server link                                            |
| `pnpm prd start <topic>`              | create (or find) the PRD's worktree and stack, and print the command that opens its orchestrator                                      |
| `pnpm prd plan <topic>`               | a docs-only worktree for writing a PRD or plan                                                                                        |
| `pnpm prd slice <topic> <n>`          | a slice's worktree and stack                                                                                                          |
| `pnpm prd serve [name] [--restart]`   | run that worktree's dev server in the background (it outlives the session) and print the link; `--built` serves a check build instead |
| `pnpm prd check`                      | `pnpm check`, then record that this commit passed                                                                                     |
| `pnpm prd browser <check> [args…]`    | run one check under a machine-wide lease (four at once); `--changed` for what the diff needs; `--suite`; `--timeout <s>`              |
| `pnpm prd sync`                       | merge `dev` into this PRD branch                                                                                                      |
| `pnpm prd ready [topic]`              | the ready-to-land report: the link, the backlog items it addresses, what changed, any blockers                                        |
| `pnpm prd land <topic> [-m subject]`  | merge `prd/<topic>` into `dev` in the main checkout: **only when the user says to land it**                                           |
| `pnpm prd rm <name>`                  | remove a worktree, its stack, its dev server and, if merged, its branch                                                               |
| `pnpm prd prompt orchestrator\|slice` | the first prompt for a session                                                                                                        |

**Isolation** (the scripts behind those commands, in `scripts/loops/`; `lib.sh` holds the shared parts):

- `new.sh <kind> …` makes a worktree in `.loops/`:
  - `new.sh prd <topic>`: `.loops/<topic>` on `prd/<topic>` from `dev`, with a stack. It prints the command that starts its orchestrator.
  - `new.sh slice <topic> <n>`: `.loops/<topic>-<n>` on `slice/<topic>/<n>` from `prd/<topic>`, with a stack.
  - `new.sh plan <topic>`: `.loops/plan-<topic>` on `plan/<topic>` from `dev`, **without** a stack.
  - Options before the kind: `--slot N`, `--stack`/`--no-stack`, `--base B`. If the branch already exists it's checked out instead, which resumes a removed worktree.
- **Slots.** A stacked worktree **leases the lowest free slot (1–19)**: lock directories in `.loops/.slots/<N>`, taken atomically, so two orchestrators never get the same one. A slot is also busy while a worktree's `.env` names it or one of its ports listens.
  - Ports: slot N in 1–9 is web 6N73, Postgres 6N34, test Postgres 6N35, PowerSync 6N80. Slots 10–19 use 7(N−10) in place of 6N (7073 … 7980). CDP and proxy ports shift by N×1000. Compose projects are `caretook-loopN` and `caretook-loopN-test`.
  - The files it writes (all gitignored): the root `.env` (Compose's project name and ports), `packages/data/.env` and `.env.test.local` (database URLs and `PG_TEST_PORT`), `apps/web/.env` (auth and PowerSync URLs, `WEB_PORT`), and `.env.loop` (`SLOT`, `BASE_BRANCH`, `BASE`, `CDP_PORT_OFFSET`, `PG_CONTAINER`, `SEED_USER_PASSWORD`). Secrets are copied from the main checkout's `packages/data/.env` and `apps/web/.env`.
  - Without a stack, `.env.test.local` points at a closed port, so `pnpm test:integration` fails instead of reaching the main checkout's test database. Run `typecheck`, `lint`, `format:check` and the unit projects there.
- `ls.sh` lists every worktree: slot, branch, commits ahead of the branch it merges into, dirty or clean, its stack, the PRD count against the cap, and stale leases.
- `rm.sh <name> [--force] [--keep-branch]` stops the worktree's containers, deletes its database files, removes the worktree and releases its slot. Then it **deletes the branch if it's merged** into its parent (`slice/…` into `prd/<topic>`; `prd/` and `plan/` into `dev`), and keeps it otherwise. It refuses uncommitted changes, and a PRD worktree whose slices still have worktrees, unless `--force`.
- `prompt.sh orchestrator <topic>` and `prompt.sh slice <topic> <n>` print the first prompt for those sessions.
- The main checkout keeps the default ports (5173, 5434, 5435, 8080).
- Every port, the Compose project name and the PowerSync audience come from env, defaulting to the main checkout's values. If you add a service, a port or a hardcoded container name, make it configurable the same way.

**Capacity.** One stack uses about 250 MB idle (the Docker VM has 32 GB), so the limits are CPU and attention: `pnpm check`, Vite and Chrome on 10 cores, and each orchestrator's context. Three PRDs with two or three slices each, plus their integration worktrees, is about 12 slots. Stagger `pnpm check` runs when several loops finish together. Six busy stacks at once (three loops plus two other PRDs) pushed the load average past 500: `pnpm check` took 25 minutes, tests hit their 5 s timeouts, and sign-ins in browser checks timed out. Rerun a failure like that once the load drops before debugging it.

**Browser check budget.** Browser checks were 63% of all tool time across the first PRDs (850 runs, about 10 h), and about 30% of runs failed, mostly on timeouts and PowerSync 401s under load, which caused more reruns and more load. So:

- **Run every check through `pnpm prd browser`** (`scripts/loops/browser.sh`), never `node <check>.mjs` directly. It holds one of four machine-wide leases (`.loops/.browser/<N>` in the main checkout; `CARETOOK_BROWSER_SLOTS` changes the limit), waits while all are taken (polling every 5 s, up to `CARETOOK_BROWSER_WAIT` s, default 20 min), takes over a lease whose holder is gone, and releases it on every exit. It sources the worktree's `.env.loop`, prints the load average at start and end, and logs to the worktree's git dir. `pnpm prd status` shows who holds the leases.
- **The diff picks the checks: `pnpm prd browser --changed`.** It maps every changed file (committed since the base, staged, unstaged and untracked) through `scripts/loops/check-areas`, the table below as globs, and runs only those checks, in suite order, with a table. Docs, plans, tests, tooling and the data layer below the upload switch need none, and it says so and exits 0. A lib module with a sibling unit test needs none. Build config, dependencies, sync rules and migrations need the full suite. A file no rule covers runs `sign-in`, `phase2` and `roundtrip`, with a warning: **add a rule to `check-areas`** when you add a screen, a check or a shared module. `--base REF` sets what it diffs against (default: the worktree's `BASE_BRANCH`, else `origin/dev`), `--head REF` a commit instead of the working tree, and `--list` shows each file's checks without running anything.
- **One automatic retry.** A failed check is rerun once when the failure looks like contention: load above 40 at its start or end (`CARETOOK_BROWSER_BUSY`), a timeout, a 401 or PSYNC_S2101 in its log. It first waits up to 5 minutes for the load to drop. A pass on the retry is **FLAKY**: it counts as passing, and it's recorded in `.loops/.browser-flakes.log` (the date, worktree, check, why, and the first run's log), so the flaky steps can be fixed. A failure that repeats, or one that doesn't look like contention, is a real failure: debug it. Don't rerun by hand on top of this.
- **While building, a loop runs only the check for what it's changing** (`pnpm prd browser <check>`), never the whole suite.
- **Before hand-off, a loop runs `pnpm prd browser --changed`** once (it diffs against the PRD branch).
- **After each merge, an orchestrator runs `pnpm prd browser --changed --base HEAD^`** in its integration worktree: the checks for what that merge brought in.
- **At landing** (step 1 of _Landing a wave_): a wave that changes screens (any UI PRD) runs the **full suite once**, against a freshly restarted server. A wave that doesn't (quick fixes, tooling, the data layer, docs) runs `pnpm prd browser --changed --base dev` instead, which is often nothing.
- **The backstop:** the dev keeper runs the full suite on `dev` (`pnpm prd browser --suite` from any synced worktree, on a quiet machine) **before opening the PR to `staging`**. It catches breaks between areas that `--changed` doesn't see.
- **This overrides any plan** that says "rerun every browser check after each merge".
- **Don't run two checks at once in one worktree.** The lease already limits how many run on the machine, so there's no need to stagger checks by hand.
- **Check builds (opt-in for now):** `pnpm prd serve --built` serves a production build (about 5 s to build) with `VITE_CHECK_BUILD=1`, which keeps `window.caretookSync` and `window.caretookModules` (the device modules, which `providers.mjs` loads) for the checks. It has no Vite websocket, no dependency re-optimization reloads and no stale deps. `pnpm prd browser` rebuilds and restarts it by itself when the source is newer than the build. `--dev` (or a plain `--restart` after `--dev`) goes back to the dev server. **Not the default yet:** on 2026-11-18 `providers.mjs` and `phase2.mjs` passed on the dev server but failed on the build (a deleted provider's 404 rendered a blank page, a viewer's `…/providers/new` didn't redirect, a PowerSync "Sync aborted" warning). Those are filed as B-38, since they may be production bugs. Make it the default once they're fixed.

| Area changed                                                                 | Checks                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| the timeline screen, rows and cards, filters, vitals strip                   | `phase2.mjs`                                                  |
| add and edit sheets, `EntryForm`, local timeline writes                      | `roundtrip.mjs`                                               |
| the entry page, live notes, `note_document`, editors, Live now               | `live-notes.mjs`                                              |
| the `/app` frame, menus, theme, group settings, members                      | `app-shell.mjs`                                               |
| routes, `routes.ts`, `appUrls`, sheet URLs, settings subpages                | `routing.mjs`                                                 |
| settings saves, `lib/me.ts`                                                  | `settings-layout.mjs`, `layout-offline.mjs` (timeout)         |
| session, sign-in, sign-out, sync client, first sync                          | `sign-in.mjs`, `first-sync.mjs`, `signout-wipe.mjs` (timeout) |
| account emails, `/reset-password`, `/verify-email`, `packages/auth`          | `invites.mjs` (and `sign-in.mjs` for the account pages)       |
| a feature's own screens                                                      | its own check (`providers.mjs`, `medications.mjs`, …)         |
| the marketing site (`routes/marketing/`, `public/`)                          | `marketing.mjs` (`--timeout 120`)                             |
| schema, migrations, sync-config, the upload switch, seeds                    | the checks for every screen that reads those tables           |
| docs, plans, scripts outside `browser-checks/`, pure modules with unit tests | none                                                          |

The table's machine-readable form is `scripts/loops/check-areas`; keep the two in step.

**Starting a PRD (the user):** `pnpm prd start <topic>`, then run the command it prints in a new terminal (`cd .loops/<topic> && claude --remote-control prd-<topic> "$(scripts/loops/prompt.sh orchestrator <topic>)"`). From then on the user steers that PRD from its orchestrator's console: which slices to run, and when to land.

**Keep each orchestrator's context small.** A session may run wave after wave; start a fresh one (the same command) whenever it gets slow or confused. The plan's _Status_ section makes that safe at any wave boundary.

- It works from its plan's _Status_ section, the backlog, the loops' hand-offs, `git diff --stat` and `pnpm check` output. It doesn't read whole diffs or debug inside a loop: it sends the problem back to that loop's agent with SendMessage.
- Before it ends, it updates its plan's _Status_ section (what's merged, with SHAs; what's ready; open issues) and its backlog items. Those are the hand-off to the next orchestrator.

**PRD orchestrator, per wave:**

1. Read your plan and `pnpm backlog list --prd <topic>`. A slice is **ready** when every slice it's blocked by has been merged into `prd/<topic>`. Start only what the user asks for, and `claim` its items.
2. For each ready slice: `pnpm prd slice <topic> <n>`.
3. Spawn one background agent per slice (not with `isolation: worktree`; it already is one), with the prompt from `pnpm prd prompt slice <topic> <n>` plus anything the slice needs that the plan doesn't say.
4. As each loop hands off, review its branch: `git diff prd/<topic>...slice/<topic>/<n>`, its hand-off, and that the acceptance criteria are covered.
5. Merge **in plan order** into `prd/<topic>`, in your integration worktree, with `git merge --no-ff -m "feat(<topic>): <what it adds> (slice <n>, B-<n>)" slice/<topic>/<n>`. Resolve conflicts in the shared files yourself. After each merge, run `pnpm check` and `pnpm prd browser --changed --base HEAD^` (the checks for what the merge touched), there. Fix it or send it back before merging the next one.
6. Once merged: `pnpm backlog done B-<n>` for its items, then `pnpm prd rm <topic>-<n>` (it deletes the merged branch). Start the slices it unblocked.
7. **Land the wave** when it's green. Don't wait for the whole PRD: small, frequent landings keep PRDs from drifting apart.

**Landing a wave in `dev`:**

1. **Sync and check.** In the integration worktree: `pnpm prd sync` (merges `dev`; resolve conflicts there, regenerate your migration if `dev` gained one, `pnpm datastore:reset`), `pnpm prd serve --restart`, the wave's browser checks (a UI wave: `pnpm prd browser --suite`, the **full suite once**, one check at a time under one lease, with a pass/fail table; any other wave: `pnpm prd browser --changed --base dev`; see _Browser check budget_), then `pnpm prd check`. Backlog-only commits on `dev` don't count as drift, so `pnpm backlog` writes never force another sync.
2. **Serve it and report.** `pnpm prd serve --restart`, then show the user the output of `pnpm prd ready`: the dev server link and seed accounts, the backlog items this landing addresses (grouped as bugs fixed, features, changes), what's still open in the PRD, the commits, and warnings for a migration, seed, sync-config or dependency change. Add the browser checks you ran and two or three things worth trying by hand. If it lists blockers, fix them first.
3. **Wait for the user.** They may try it at the link, ask for changes (send those back to a loop, then repeat from step 1), or say to land it.
4. **Land on their word only:** `pnpm prd land <topic> -m "feat(<topic>): <what the wave adds> (B-<n>, …)"`. It refuses unless the branch is synced and `pnpm prd check` passed on its tip, so the code landing in `dev` is exactly the code that was checked; no recheck on `dev` is needed. It prints what the main checkout needs afterwards (`pnpm datastore:reset`, a PowerSync restart after a sync-config change, `pnpm install`) and never pushes: `git push origin dev` is the user's.
5. Other orchestrators run `pnpm prd sync` at their next wave boundary, not mid-wave.
6. When a PRD is finished and landed, `pnpm prd rm <topic>` removes its worktree and deletes `prd/<topic>`.

A go-ahead covers one landing. An agent never lands on its own judgment, never with `--force` unless the user says so, and never for another PRD.

**Rules across PRDs** (they keep many PRDs mergeable):

- **Migrations take the next number when they land, not when they're planned.** Plans say "adds a migration", not "0008". A loop generates whatever is next on its base. When a sync brings in another PRD's migration, keep `dev`'s, regenerate yours on top (`pnpm datastore:generate`), and reread its SQL order. Keep one pending migration per PRD where you can.
- **Seeds are append-only.** `timelineEntries.ts` ids follow position, so never insert in the middle: append at the end, or give a new feature's seeds their own file and ids.
- **Additive edits to shared registries.** In `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the device schema, the `sync.ts` upload switch, `routes.ts` and `KIND_META`, add entries at the end of their group and never reorder or reformat, so concurrent additions merge as adjacent hunks.
- **Hot files get regions first.** When two PRDs will change one screen (the backlog's PRD table lists hot files), a small slice first splits it into regions or components that each PRD fills (as `EntryHeader` did for live notes), and lands before both.
- **AGENTS.md:** loops never edit it. An orchestrator edits it at landing only, to fold in that wave's lasting decisions, and keeps in-flight status in its plan.

**Loop rules** (`prompt.sh slice` points every loop here):

- Work only inside your worktree. Run `source ~/.nvm/nvm.sh && nvm use` in every shell (Node 24; browser checks need its global `WebSocket`).
- Your stack is your own. Run `pnpm datastore:reset`, `pnpm test`, `docker compose …` and `pnpm dev` freely from your worktree; they use your ports. Never touch the main checkout, other worktrees or other Compose projects.
- Run the dev server with `pnpm prd serve` (background, `WEB_PORT` pins the port; `--restart` after merges). Run browser checks with `pnpm prd browser <check>` while building and `pnpm prd browser --changed` before hand-off: it sources `.env.loop` and waits its turn for one of the four machine-wide leases, and its `■ <check>: <result> … load at start …, at end …` lines and table go in the hand-off. New browser checks use `process.env.PG_CONTAINER` for `psql`, and launch Chrome and proxies through `cdp.mjs` and `proxy.mjs` (which apply the offset), never fixed container names or ports.
- After editing `powersync/sync-config.yaml`, restart your own PowerSync: `docker compose restart powersync`.
- Follow the rules across PRDs (migrations, seeds, registries). Edits to shared files stay small and are listed in the hand-off. Don't edit AGENTS.md, and change the backlog only through `pnpm backlog note`.
- No new dependencies. All data stays fictional.
- Browser checks follow the _Browser check budget_: while building, only the check for what you're changing; before hand-off, `pnpm prd browser --changed` once. Never the full suite; the orchestrator runs that at landing. A new screen or check adds its rule to `scripts/loops/check-areas`.
- When `pnpm check` and the slice's browser checks pass, **commit on your `slice/<topic>/<n>` branch** (coherent Conventional Commits scoped to the topic, ending with the attribution line). Don't merge, rebase or push any other branch, and never set `CARETOOK_ALLOW_PROTECTED`.
- **Hand-off** (the final message): what was built, grouped by area, with every shared-file edit called out; each acceptance criterion marked met or not met, with evidence; the `pnpm check` and browser-check output; anything skipped or surprising that later slices need; and the commit SHAs.

**Gotchas:**

- The first visit to a route on a fresh loop can make Vite re-optimize dependencies and reload the page mid-check. If a browser check times out on its first run, run it once more before debugging.
- Merging two branches that each generated a migration conflicts in drizzle's `meta/_journal.json` and snapshots. Keep the one already in the target (`dev`'s, at a sync), then regenerate yours on top (`pnpm datastore:generate`) and recheck its SQL order.
- After a merge or sync that changes seeds or migrations, run `pnpm datastore:reset` in that worktree; the merged seeds can differ from either side's.
- **Running `new.sh` for several worktrees at once** can fail at migrate with "Connection terminated unexpectedly": a fresh Postgres restarts once after its first-boot init. The containers are fine; rerun `pnpm datastore:start && pnpm datastore:start:test` in each.
- **The first check run after a PowerSync restart** (`docker compose restart powersync`, after editing `sync-config.yaml`) can fail on slow first sync (`live-notes.mjs` timing steps). Rerun once before debugging. `pnpm datastore:reset` doesn't need this: it restarts PowerSync with empty bucket storage and waits until it's ready.
- **Merges can break another slice's browser check** without either slice being wrong (live notes slices 4 and 8 both filled the header's `actions`). After each merge, run the checks for every area the merge touched (the _Browser check budget_ table), not only the new slice's own check; the full suite at landing catches the rest.
- **Long-running dev servers** can serve stale optimized deps after merges ("Invalid hook call"). Run merged checks against a freshly started server.

### Active PRDs

The backlog's PRD table lists them all, with their dependencies.

- ✅ [`plans/live-notes-ux-prd.md`](plans/live-notes-ux-prd.md) (topic `live-notes-ux`): **done**, all ten slices in `dev`. Notes and events _are_ their live document: Note/Event opens the editor in one tap, the entry is saved on the first keystroke, and others join in one tap through a row tap, the Live now banner, a live dot or a Share link. Its lasting decisions are under _Timeline entries_ and _Live notes_; follow-ups are in _Next steps_.
- 🟡 [`plans/quick-fixes-plan.md`](plans/quick-fixes-plan.md) (topic `quick-fixes`, no PRD): small standalone fixes, one slice and one backlog item each, appended as they come. **Slices 1–9 (B-1, B-17, B-22, B-28, B-29, B-34, B-27, B-35, B-36) are in `dev`**; nothing is in flight. `prompt.sh` handles a topic without a PRD file.
- ✅ [`plans/app-shell-prd.md`](plans/app-shell-prd.md) (topic `app-shell`): **done**, all seven slices in `dev`: the `/app` frame, the user menu with theme, the group menu with the last group, the sections nav and tab bar, group settings (details and members), and the timeline layout choice in Settings. Sliced in [`plans/app-shell-plan.md`](plans/app-shell-plan.md); its lasting decisions are under _The `/app` frame_. `timeline-polish`, `providers` and `medications` build on the frame.
- 🟡 [`plans/timeline-polish-prd.md`](plans/timeline-polish-prd.md) (topic `timeline-polish`): the timeline's filters, day headers, vitals line, wide layout and infinite scroll. Sliced in [`plans/timeline-polish-plan.md`](plans/timeline-polish-plan.md). **Slices 1–3 (the filter module with the kind icon, the day headers, and the one-line vitals) are in `dev`.** It's **paused**: slices 4 (filter by author), 5 (full width), 6 (author tooltip) and 7 (infinite scroll) wait for `routing` and `components`, and get replanned then. `search` builds on slices 1, 4 and 7.
- 🟡 [`plans/marketing-prd.md`](plans/marketing-prd.md) (topic `marketing`, B-32): the public site. Sliced in [`plans/marketing-plan.md`](plans/marketing-plan.md). **Slice 1 (the frame, home, brand assets, SEO, prerendering) is in `dev`**; its decisions are under _Marketing site_. Slices 2 (features, about, FAQ) and 3 (legal pages) are next; 4 and 5 wait for `invites` slices 1 and 5.
- 🟡 [`plans/providers-prd.md`](plans/providers-prd.md) (topic `providers`): the provider directory and links from notes and events. Sliced in [`plans/providers-plan.md`](plans/providers-plan.md). **Slices 1–4 (the data layer and the directory: list, add/edit/delete sheets, the provider page with live notes) are in `dev`**; their decisions are under _Providers_. Slices 5–7 (linking from notes and events) wait for `components`.
- 🟡 [`plans/components-prd.md`](plans/components-prd.md) (topic `components`, B-24): UI primitives, feature folders, thin routes. Sliced in [`plans/components-plan.md`](plans/components-plan.md). **Slices 1–2 (the menu primitive, the feature folders, one entry actions menu; sheets, popovers, dialogs, avatars, chips, fields) are in `dev`**; their decisions are under _Components_ below. Slices 3 (the timeline, split) and 4 (the entry page, split) are next. It runs alone among UI PRDs: new UI elsewhere uses `components/ui/` and the feature folders.
- 🟡 [`plans/invites-prd.md`](plans/invites-prd.md) (topic `invites`, B-30): sign-up, invites, consent and account emails. Sliced in [`plans/invites-plan.md`](plans/invites-plan.md). **Slices 1–2 (the notifications package and outbox; sign in by emailed link or code, password reset, email verification) are in `dev`**; their decisions are under _Notifications_ and _Auth_. Slice 3 (email invites with consent) is next, then 4 (link invites, join requests) and 5 (creating groups, access codes) in parallel.
- ✅ [`plans/routing-prd.md`](plans/routing-prd.md) (topic `routing`, B-23): **done**, all five slices in `dev`: the group route with its middleware, `appUrls`, a folder per route, add- and edit-sheet URLs, and account and group settings subpages. Its lasting decisions are under _The `/app` frame_ and _Timeline screen_. `components` and `timeline-polish` 4–7 can start.

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
    - `integration` runs every package's `*.int.test.ts` against the test Postgres on :5435. Its globalSetup clears and migrates once per run, refuses any other host or port, and runs files one at a time. Tests build their own fixtures (`packages/data/test/fixtures.ts`).
    - `web:unit` runs apps/web's pure `app/**/*.test.ts` (no PowerSync; apps/web's vite.config isn't loaded, so tests import relatively, not through `~/`).
- ✅ **React Router 8.5.1** (framework mode) with Vite 8, chosen over Next.js and TanStack Start: reads come from the local sync database, so server-centric frameworks gain little.
- ✅ **UI:** Tailwind v4 + **daisyUI 5** for styling, **React Aria Components** only where HTML falls short (DateField, Menu, Modal, ComboBox…), and `lucide-react` icons. Mobile-first, with daisyUI themes following the device.
  - Prefer native elements (`<dialog>` with `showModal()` for simple confirms).
  - Wrap repeated daisyUI + RAC pairs in `app/components/`.
- ✅ **Components** (`app/components/`, from the `components` PRD):
  - `ui/`: primitives that import nothing from feature folders: `Menu` (with `SEPARATOR`), `Sheet`, `Popover` (children may be a function of `close`), `ConfirmDialog`, `Field`, `ChipGroup`, `UserAvatar` (`size`), `AvatarStack`, `IconButton`. `ui/date/` (its own index, so the ~42 KB date picker stays off every page): `DateTimeField`, a RAC `DatePicker` with typed segments and a "Pick a date" calendar popover, with an `error` prop. **Only `ui/` imports `react-aria-components`.** Feature folders: `entry/` (`EntryActions`, `KindIcon`), `notes/` (`LiveNotesEditor`, `EditorAvatars`; kept apart so Tiptap never reaches the timeline through an index), `providers/` (`ContactActions`, `ProviderTypeIcon`), `settings/` (`SettingsFrame`), `shell/` (`FirstSyncPending`). **Import through each folder's `index.ts`**, never a file inside it. A route that imports an index gets that folder's whole chunk, so keep heavy pieces out of indexes light routes use.
  - **Every menu is `ui/Menu`**: callers pass data (`label`, `menuLabel`, `items`, optional `className` on the trigger), never React Aria parts. Items (`menuModel.ts`, pure, tested) have a label, description, icon, danger tone, disabled, and `onAction` or `href` (links navigate through React Router). Sections can have a title, a non-interactive `header`, and `selection: { selected, onChange }` (`menuitemradio`, a check on the right). No feature file imports `react-aria-components` for a menu.
  - **One entry actions menu** (`entry/EntryActions`, items from the pure `entryActionItems(kind, { canEdit })`): Edit then Delete for symptoms and vitals, Delete only for notes and events, on rows, cards and the entry page alike.
  - **Primitives' contracts:** `Sheet` is a bottom sheet on phones and a modal on wide screens, above the tab bar, and returns focus to its opener on close. `ConfirmDialog` waits for an open menu to close before `showModal()` (so focus returns to the ⋯ button), and Escape closes only the dialog. `Field` gives its control the `id`, `aria-invalid` and `aria-describedby` (`labelHidden` for the entry title). `ChipGroup` link chips are a `nav` with `aria-current="true"`; button chips are a `ul`, with `aria-pressed` when they toggle. `AvatarStack` shows up to N, then "+N"; each avatar has `data-person`. `IconButton` requires a `label` (its name and tooltip). Menus and popovers share one surface class (`ui/styles.ts`).
  - `ui.mjs` checks every menu, sheet, popover, dialog, field and chip group by tap and keyboard at 420 and 1280, light and dark, including focus return. It turns on `Emulation.setFocusEmulationEnabled` (headless Chrome otherwise loses page focus after a native `<dialog>` closes) and presses Delete items with real taps.
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

### API: `packages/api` (oRPC)

- Chosen over tRPC for OpenAPI output (AI tools, MCP, integrations), contract-first, files and streaming, and fetch, Node and Lambda adapters. It has no runtime dependency, so it mounts in a resource route, runs directly from server loaders, or runs in an AWS worker.
- **Procedures:** `publicProcedure`/`authedProcedure` with context `{ authUser }`, resolved by the mount point (`getAuthUser`). Procedures never read requests.
- **Errors:** handlers call services and `unwrap()`. `toORPCError` maps an AppError's `statusCode` (400/401/403/404/409) to an oRPC code with `data: { code, issues? }`. Anything else becomes a logged, generic 500.
- **DTOs:** `dto.ts` turns timestamps into ISO 8601. Inputs reuse the client-safe Zod schemas from `@caretook/data/schema`.
- **Public profiles only:** `careGroup.members` returns name, image and role, never email. Keep it that way for new procedures.
- **HTTP:** `createRpcHandler({ prefix, allowedOrigins })`:
  - CSRF through `SimpleCsrfProtection` (the client link sends `x-csrf-token`).
  - CORS for Capacitor's origins and `AUTH_TRUSTED_ORIGINS` only.
  - GET is refused.
- **Mounting:** apps/web mounts it at `/rpc/*` through `app/.server/api.ts`. The browser client (`app/lib/rpc.ts`) uses a type-only router import and sends cookies.
- **Procedures:**
  - `me.get` and `me.updatePreferences`;
  - `careGroup.listMine` and `careGroup.members`;
  - `careGroup.update` (the name; owners and admins), `careGroup.recipient` (the profile with the date of birth, which isn't synced; any member) and `careGroup.updateRecipient` (owners, admins and caretakers; fields left out keep their value, and an empty preferred name clears it). A non-member gets a 404, and a member without the role a 403 (the `updated()` helper maps `baseModel:update:nothingUpdated`, which has no status code);
  - `careGroup.changeRole` and `careGroup.removeMember` (removing yourself is leaving), thin over `careGroupMemberService`, returning public profiles only. The `removed()` helper maps `baseModel:remove:nothingRemoved` to a 403, as `updated()` does;
  - `timeline.list`, `create`, `update`, `remove` and `latestVitals`;
  - `sync.upload`.

  No screen calls the timeline or careGroup reads now (screens read local data); they stay for API, AI and worker use.

- **Notes' and events' text:** `timelineEntryService.getById`/`list` (and so `timeline.list` and `timeline.update`) fill a note's or event's `body` from its document's **compacted** `text` (`withDocumentText`, one query in the actor's scope). No document or empty text → the stored body (null). Deleted entries never get their text. Pending updates are only in `noteDocumentService.currentText`.

### Data layer: `packages/data` (`@caretook/data`)

- **Entry points:**
  - `@caretook/data` is **server only**: never import the root from client code.
  - `/schema`, `/errors` and `/permissions` are client-safe.
  - In apps/web, server code imports through `app/.server/data.ts`.
- **Layers, bottom up:**
  - `errors/`: typescript-errors, with every code in `errors/constants.ts`. Errors are **returned, not thrown**; narrow with `isError()`. Wrap db calls as `dbMayFail(() => …, code)`.
  - `permissions/`: `PERMISSIONS[table][create|read|update|delete|list][role] = all | owned | none | { group: [...] }`, plus `ownerField` and field-level write restrictions.
    - Roles are `admin` and `member` (`user.role`), `system` and `unauthenticated`. A resolved scope is `all` or an OR of `owned`, `group` and `groupUser` rules.
    - `hasPermission()` is for UI checks.
  - `models/`: `baseModel.getFunctions(...)` gives `create/get/getById/list/update/remove/upsert`, with **RBAC enforced in SQL**.
    - Every query is ANDed with the actor's scope; group rules become subqueries on `care_group_member`.
    - Writes must land inside the scope.
    - Update and remove refuse an empty filter.
    - Filters are serializable (`{ field: { type: "eq", value } }`) and checked against the table's columns.
  - `services/`: `getService(model)` with `ServiceContext = { authUser, tx? }`. Business rules, side effects and transactions go here. Services never read requests; use `SYSTEM_USER` for internal work.
- **`withTransaction(fn)` rolls back when `fn` returns an AppError.** A returned error would otherwise commit.
- **Arg types use `WithoutProtected<T>`:** a generic `Omit<DbInsert<K>, …>` silently drops optional columns such as `id`.
- **Table conventions:**
  - UUID PKs via `id()`: clients create rows offline, so `create`/`upsert` accept a caller-supplied id.
  - Every table spreads `timestamps` (timestamptz, string mode) and `audits` (`created_by`/`updated_by`, set by models, not FKs).
- **Adding a table:**
  1. Write `db/schema/<name>.ts` (table, types, Zod) and export it from `db/schema/index.ts`.
  2. Add a `PERMISSIONS` entry (the type requires one).
  3. Add `models/<name>/` and `services/<name>Service.ts`, and register both.
  4. If it syncs: `ALTER PUBLICATION powersync ADD TABLE …` in a migration, plus a stream query and a device schema entry.
- **Migrations:** generated into `src/db/migrations/` and applied in-process (`src/db/migrate.ts`). There are 0000–0009 so far.
  - **drizzle-kit can emit a unique constraint after the FK that needs it.** Read the generated SQL and reorder by hand.
  - Until the first deploy it's fine to delete and regenerate migrations.
- **DB client:** the pool is created lazily (importing never needs `DATABASE_URL`). Only the **pool** survives HMR (`utils/remember.ts`); the drizzle wrapper is rebuilt, so new tables work without a restart.
- **Env:** `loadEnv.ts` loads `.env.<NODE_ENV>`, then `.env`, from `packages/data` (Node's `process.loadEnvFile`). Real env vars win. `.env.test` is committed; `.env` isn't (copy `.env.example`).
- **Local Postgres:** Docker `postgres:18.7-alpine` with `wal_level=logical`, dev on :5434 and test on :5435, data in `.postgres/`.
  - `datastore:clear` refuses a non-localhost database, and drops the publication.
  - `datastore:seed` refuses production and uses `@example.com` accounts only.
- ❓ The hosted database (same region as Vercel functions, with pooling), and how production migrations run.

### Auth: `packages/auth` (Better Auth)

- **Tables:** it adopts our `user` table, and `session`/`account`/`verification`/`jwks` live in `db/schema/auth.ts`. These are exceptions to the table conventions:
  - **no audits**;
  - **date-mode timestamps** (Better Auth compares `Date`s, and string mode silently breaks expiry);
  - `system`-only permissions.
- **Ids and extra fields:** ids come from `generateId: "uuid"` (the Postgres default). `role`, `createdBy` and `updatedBy` are `additionalFields` with `input: false`, defaulting to `SYSTEM_USER`.
- **Settings:** `emailAndPassword` with `disableSignUp: true` and a 12-character minimum; telemetry off; `trustedOrigins` = Capacitor's origins + `AUTH_TRUSTED_ORIGINS`.
- **Plugins:** `bearer()` (native), and `jwt()`: 15-minute EdDSA tokens with `sub` and `role`, JWKS at `/api/auth/jwks`, and `aud` = `POWERSYNC_URL`.
- **Exports:** `getAuth()` (lazy) and `getAuthUser(headers)` → `AuthUser` with `groupRoles`. `@caretook/auth/client` has `createCaretookAuthClient`. apps/web imports through `app/.server/auth.ts` and `app/lib/auth-client.ts`.
- **Routes:** `/api/auth/*` is web only. `/sign-in` and `/sign-out` are shared and client-only (sign-out is POST only). The /app layout (`routes/app/layout/route.tsx`) redirects to `/sign-in?redirectTo=…`, checked by `safeRedirect`. The sign-in button stays disabled ("Signing in…") while any navigation is non-idle, so it can't be pressed again during the redirect's loaders.
- **Dev:** seeds give every `@example.com` user a password from `SEED_USER_PASSWORD` (`packages/data/.env`), hashed with `better-auth/crypto` (a dev dependency). The env is in `apps/web/.env`; `vite.config.ts` also loads `packages/data/.env`.
- ✅ **Sign-in methods** (`invites` slice 2): password, an emailed link (`magicLink`) and an emailed 6-digit code (`emailOTP`, stored hashed), all with `disableSignUp: true`, plus password reset and **`requireEmailVerification: true`**. `packages/auth/src/emails.ts` sends every auth email through `notify` (never awaited in the request). Every message about an address reads the same whether or not an account exists. Seed users are `email_verified = true`.
  - Shared, client-only routes `/reset-password` and `/verify-email` (`routes/account/`, on `AuthCard`); their paths come from `lib/accountUrls.ts`, their wording from `lib/authMessages.ts`. `requireSession` sends a signed-in but unverified user to `/verify-email`.
  - **Every account form submits through `useSubmitOnce()`** (`routes/account/AuthCard.tsx`): it ignores further submits until the request settles, so a double tap sends one email (B-1). A new account form uses it too.
  - 🟡 Sign-up only with a ticket (an invite or an access code) comes with `invites` slices 3 and 5.
- ❓ Before launch:
  - rate-limit storage (the default is in-memory, per serverless instance);
  - native bearer storage (secure storage) and `VITE_API_ORIGIN`.

### Sync: PowerSync

- Postgres is the source of truth. Each device keeps a SQLite copy, and writes upload through **our** API (`sync.upload`), so permissions, validation and audits all apply.
  - Ruled out: Zero (offline writes), ElectricSQL (read-only sync), Convex (offline, lock-in), and InstantDB, Triplit and Jazz (control).
- **Hosting:** PowerSync Cloud in production; locally the `journeyapps/powersync-service:1.28.3` container on :8080, with bucket storage in its own Postgres (`.postgres/powersync-storage`).
- **Sync Streams** (`powersync/sync-config.yaml`, edition 3; Sync Rules are deprecated). **Queries list their columns explicitly**, so a new column must be added there too.
  - `care_groups`: one bucket per group the user belongs to. It carries `care_group`, `care_group_member`, `care_recipient` (names only), `timeline_entry` (including soft-deleted rows), `note_document`, `note_update`, `provider` (including soft-deleted rows) and `timeline_entry_provider`.
  - `member_profiles`: co-members' `id`, `name` and `image`.
  - The service reads the file at startup: run `docker compose restart powersync` after editing it.
- **Publication** (`powersync`): the care tables plus `"user" (id, name, image)`. The column list keeps emails, roles and preferences out of replication.
- **Local JWKS:** the service fetches `PS_JWKS_URL` (default `http://host.docker.internal:5173/api/auth/jwks`). Docker Desktop forwards only to the host's IPv4 loopback, so Vite binds `127.0.0.1` and allows that Host header. `pnpm datastore:reset` ends with `pnpm datastore:powersync` (`packages/data/scripts/powersync.ts`): it stops this checkout's PowerSync (through `docker compose` from the repo root, so only its own project), drops its replication slot, empties its bucket storage (dropping the schema never reaches PowerSync as deletes, so old rows such as `note_update`s with old user ids would stay), starts it, and waits up to 60 s for the first replication and the JWKS. It skips with a note when PowerSync isn't running or belongs to another checkout, and only warns on a timeout (the dev server may be down; PowerSync then fetches keys on its first request). Devices synced before a reset re-sync from scratch once. Its admin token and container port are copied from `powersync/service.yaml`: change both together.
- **Upload** (`packages/api/src/sync.ts`): up to 100 CRUD ops, in order, mapped onto **services**.
  - `timeline_entry`:
    - PUT → `upsert` (idempotent on id). A changed group, kind or recipient → `immutable`, and an id in a group the actor can't see → `unauthorized`.
    - PATCH → `update`, or `remove` when it sets `deleted_at`.
    - DELETE → `remove`.
  - `note_document`/`note_update`: PUT → `create`/`appendUpdate`. Anything else → `sync:readOnlyTable`. A document PUT passes the device's `subject` (none means `entry`).
  - `provider`: like `timeline_entry` (PUT upsert, PATCH update or soft remove, DELETE soft remove; a changed group → `immutable`). `is_primary` arrives as 1/0 and `phones` as JSON text.
  - `timeline_entry_provider`: PUT → link, DELETE → unlink, PATCH → `sync:readOnlyTable`.
  - Other tables → `sync:readOnlyTable`.
  - 4xx outcomes are acknowledged as rejected, and the next sync restores the server's copy. Other errors throw, so the batch retries.
  - After each batch, touched documents are compacted when due (best effort).
- **Timestamps:** PowerSync syncs timestamptz as `2026-11-17T21:45:25.229000Z`. Local writes use exactly that form (`toLocalTimestamp`), so strings sort correctly; `fromLocalTimestamp` parses either form.
- **Device** (`apps/web/app/lib/sync/`):
  - `schema.ts`: Drizzle sqlite tables → `DrizzleAppSchema`.
  - `client.ts`: the database and connector, **loaded lazily** (never imported statically).
    - One user's data per device: the owner is in localStorage, and the file is wiped when someone else opens it.
    - Sign-out runs `disconnectAndClear`, then deletes the IndexedDB/OPFS file.
    - `fetchCredentials` calls `/api/auth/token`. A 401 leaves the device local-only.
  - `index.ts`: `openSync`, `getSync`, `closeSync`, `waitForFirstSync`, `isFirstSyncDone`, `useFirstSyncDone`, `useLiveQuery` and `useSyncState`. Dev builds expose `window.caretookSync`.
  - **The first sync** (measured at about 120–200 ms after the database opens locally): `waitForFirstSync(db)` waits at most 1 s (`FIRST_SYNC_WAIT_MS`) and resolves to `isFirstSyncDone(db)`. That's PowerSync's `hasSynced`, which persists with the local copy, so it's true at once on a synced device and offline. `useFirstSyncDone()` is the hook (below the /app layout only). Use it for anything that needs the local groups, such as a last-group redirect.
    - A loader whose group isn't on the device throws `notOnDevice(db)` (`lib/firstSync.ts`): a 404 once the first sync is done, otherwise a 503 "First sync pending" that `/app`'s `ErrorBoundary` shows as `FirstSyncPending` ("Getting your care groups…"), which reruns the loaders when the sync lands. `home` shows the same state while `synced` is false, and never says "not in a care group" before then.
  - `timeline.ts`: local queries, row → API-shape mapping (unknown kinds are skipped), and local writes. Writes validate with the shared Zod schemas, check the role locally, and update content columns only.
  - `lib/session.ts` `requireSession(request)`: one shared session check and DB open. Offline, the cached last user carries on. The /app layout's `clientMiddleware` calls it once per navigation and sets `sessionContext`; every /app loader and action reads `context.get(sessionContext)`, never `requireSession` again.
  - `lib/me.ts` caches settings per user (they aren't synced). **Change them with `saveSettings(userId, change)`**: it caches at once, records the change as pending (`caretook:settings-pending:<userId>`), and calls `updatePreferences`, resolving `"saved"` or, on a network failure, `"pending"`. Other errors reject (a refused change is dropped). `loadSettings` sends pending changes before reading `me.get`; offline it returns the cache with them on top. The last write wins across devices. `forgetSettings` (sign-out) clears pending changes too.
- **Conflicts:** last write wins per row. Live notes merge through Yjs.
- ❓ **Production:** a dedicated replication role with column-limited grants, `sslmode: verify-full`, the Cloud instance, and how Cloud reaches the JWKS.
- 🟡 Not built:
  - **Offline web reload** needs a service worker. Offline already works within a loaded session, and will in Capacitor.
  - `/app/settings` loads offline from the settings cache, and the timeline layout choice saves as pending, but **units still save online only** (through `me.updatePreferences`; offline the form says so).
  - Deleting a whole group dropping its buckets is untested end to end. (Losing a membership is covered: `app-shell.mjs` sees a removed member's timeline rows go without a reload.)

### Hosting

- 🟡 **Vercel** for request/response work (CRUD, auth, uploads, calendar cron and webhooks). **AWS** for long-running work (AI jobs on SQS with Lambda or ECS, and the sync service if self-hosted).
- Live appointment audio would go from the client straight to the AI provider, with a short-lived token.
- Costs of the split: JWT auth that works everywhere, CORS, Postgres pooling, and functions in the database's region.

## Domain

### Care groups

The shared space for the caretakers of one care recipient. Always say "care group" (never "care circle").

- **Tables:**
  - `care_group` (`name`).
  - `care_group_member` (`group_id`, `user_id`, `role`, unique per pair).
  - `care_recipient`: a profile, not an account; 1:1 through a unique `group_id`, so drop that constraint to allow several.
  - `care_group_invite` (email, role, SHA-256 `token_hash`, status `pending|accepted|declined|revoked`, `expires_at`, `accepted_by`; at most one pending invite per group and email).
  - Deleting a group cascades to everything in it. Deleting a user cascades to their memberships.
- **Two role systems:** global (`admin`, `member`) covers account access only. Group roles on the membership are `owner`, `admin`, `caretaker` and `viewer`. **Writers** = owner, admin and caretaker.
- **Permissions:**

  | Table                   | read/list                                 | create                             | update                     | delete                            |
  | ----------------------- | ----------------------------------------- | ---------------------------------- | -------------------------- | --------------------------------- |
  | care_group              | any member                                | any signed-in user (becomes owner) | owner, admin               | owner                             |
  | care_group_member       | any member                                | owner, admin                       | owner, admin (role only)   | owner, admin, or yourself (leave) |
  | care_recipient          | any member                                | owner, admin                       | owner, admin, caretaker    | owner, admin                      |
  | care_group_invite       | owner, admin                              | owner, admin                       | owner, admin (status only) | owner, admin                      |
  | user                    | self, staff, **co-members** (incl. email) | staff                              | self (no role/email)       | self, staff                       |
  | timeline_entry          | any member                                | writers                            | writers                    | writers (soft)                    |
  | note_document           | any member                                | writers (snapshot/text system)     | system                     | system                            |
  | note_update             | any member                                | writers                            | system                     | system                            |
  | provider                | any member                                | writers                            | writers                    | writers (soft)                    |
  | timeline_entry_provider | any member                                | writers                            | system                     | writers                           |
  - `system` has `all` everywhere.
  - Ids that point at the group can't be changed except by `system`.
  - **Staff get no default access to care data.** Support access, if ever needed, will be an explicit, audited grant.

- **Write memberships and invites through the services**, because they enforce what the map can't:
  - `careGroupService.create` makes the creator the first owner.
  - Only owners add, promote, demote or remove owners. A group keeps at least one owner (owner rows are locked `FOR UPDATE`).
  - `careGroupInviteService.create` (only owners invite owners) returns the raw token once (7-day expiry). `revoke` withdraws a pending invite.
- **Seeds:** "Dev Family" (recipient Grandma Pat), with member@ as owner, caretaker@ as caretaker and viewer@ as viewer. "Dev Family 2" (`seeds/secondGroup.ts`, recipient Grandpa Lou, five entries with their own ids) has member@ as its only member, so member@'s `/app` is the group list on a fresh device; caretaker@ and viewer@ have one group each. admin@ is deliberately not a member.

### Timeline entries

- **Table:** one `timeline_entry` table with a `kind` column.
  - `group_id` is on the row, because streams filter on it. `recipient_id` is there too, for several recipients later.
  - A composite FK `(group_id, recipient_id) → care_recipient`, which is `NO ACTION`: deleting a recipient with entries fails, but deleting the group still cascades.
  - `occurred_at` plus the device's IANA `time_zone`.
  - Optional `title`, `body`, and kind-specific `details` jsonb (a Zod discriminated union).
- **Rules:**
  - **Soft delete** (`deleted_at`), checked against the delete permission. Reads hide deleted rows unless `includeDeleted` is set, `update` refuses them. There is no purge function yet; a hard delete cascades to the entry's document.
  - **Keyset pagination** on `(occurred_at, id)`, because offline devices insert older entries.
  - `create` defaults `recipientId`, and checks the group first, so a non-member learns nothing.
  - `update` validates the **merged** row.
  - `occurredAt` reads back as Postgres text (`2026-11-17 10:00:00.000+00`); normalise it at the API.
- **Kinds.** When someone proposes a new thing to log, place it with these definitions first:
  - **Note:** free text about the day. **Its text is its live document**: `body` is always null (the content rules reject one), and the title is optional. Written at `/entries/:id`, not in the sheet.
  - **Symptom:** something the recipient **feels or reports**, or a problem described in words: a free-text `name` plus `severity` 0–10. **Pain is a symptom.**
  - **Vital:** something **measured, counted or observed**, with a fixed unit or scale. Without one (mood, confusion), it's a symptom. Bowel movement, urine output and sleep are vitals.
  - **Event:** something that happened (a visit, a fall, a pickup). Like a note, **its text is its live document** (`body` is always null) and it's written at `/entries/:id`. A title is required: the device saves `"Event"` (`DEFAULT_EVENT_TITLE`) when none is given, and the title field then shows empty with "Add a title" (`isUnnamedEvent`, `titleField`). Appointments (with place and provider) come later.
- **Vitals** (`db/schema/vitals.ts`, the single spec):
  - `details = { readings: [...] }`, at most one per type.
  - Types: `bloodPressure` (diastolic < systolic), `heartRate`, `temperature`, `spo2`, `respiratoryRate`, `weight`, `bloodGlucose`, `bowelMovement` (Bristol 1–7), `urineOutput` and `sleep` (0.25 h steps).
  - **Adding a type:** a `VITAL_TYPES` entry, a `VITALS` entry and one `reading(...)` line; new field keys also go in `VitalFieldSpec["key"]`.
  - Stored in canonical units (°C, kg, mg/dL, mL). Display and entry use the user's units: the form posts the units it showed, and `fromDisplay`/`toDisplay` convert.
  - Hard limits reject a value. A value outside the typical range gets the warning "That's unusual. Double-check it" but still saves.
  - `isKnownReading()` skips types this build doesn't know (forward compatibility across app versions).
  - Readings are jsonb, not a child table; charts can use `json_extract` locally.
- **User preferences:** `user.preferences` jsonb (`userPreferencesZSchema`, every field optional, so new settings need no migration).
  - `units`, via `resolveUnits()`, defaulting to °F, lb, mg/dL and mL.
  - `timelineView` (`rows | cards`), via `resolveTimelineView()`.
- **The `/app` frame** (`routes/app/layout/route.tsx`, a hot file): fixed regions that slices and PRDs fill through their components, never by restructuring the layout:
  - header `group` (left): the Caretook link, then `GroupMenu` on group routes;
  - header `sections` (`hidden sm:flex`): `SectionNav` on group routes;
  - header `status`: `SyncIndicator`;
  - header `user`: `UserMenu`;
  - the outlet, then `TabBar` (phones, group routes).
  - The `groupId` comes from `useParams()`; screens outside a group (`/app`, `/app/settings`) get the header only.
  - **Routes are a nested tree** in `routes.ts` (explicit config, no file-system routing): the `app` layout → `home`, `settings`, and the `group` layout (`/app/groups/:groupId`) → an index that redirects to the timeline, `timeline`, `entries/:entryId` and `settings`. **A folder per route:** `routes/app/<area>/<page>/route.tsx`, with the components and helpers only that route uses beside it; a file moves to `components/` only when a second route uses it.
  - **The group route** (`routes/app/groups/layout/route.tsx`): its `clientMiddleware` loads the group once per navigation, before any child loader. **Client middleware works in both builds** (React Router 8.5.1, no flag). `lib/group.tsx`: `setGroup` records the group, or the `notOnDevice` error, and **never throws**, because a middleware throw on native's first load renders the root boundary, not /app's. Every loader and action under the group route calls `getGroup(context)` first (it throws the recorded error into /app's boundary). Components read `useGroup()`: a typed, read-only `GroupContext` (`lib/groupContext.ts`: `userId`, `id`, `name`, `displayName`, `role`, `canWrite`, `recipient`), live through `myGroupQuery`, keeping the last value if the group leaves the device. Screens never query the group, role or membership themselves.
  - **`appUrls`** (`lib/appUrls.ts`, pure, tested) builds every `/app/…` path and carries search params through (`home`, `settings`, `groupHome`, `timeline(groupId, search)`, `entry`, `newEntry`, `groupSettings`). **Nothing else writes an `/app/…` string**; a new route adds its builder there.
  - **`UserMenu`:** a RAC menu on the avatar ("Account menu for …"): a name and email header, Settings, a **Theme** section (System, Light, Dark; its own `MenuSection` with `selectionMode="single"`, so its items are `menuitemradio`), and Sign out (POST to `/sign-out`).
  - **Theme** (`lib/theme.ts`): per device in `caretook:theme`, never sent to the server, and kept at sign-out. Light and Dark set `data-theme` on `<html>`; System removes it (and stores nothing), so daisyUI follows `prefers-color-scheme`. `THEME_SCRIPT`, inline first in `root.tsx`'s `<head>` (both targets), applies it before first paint; `<html>` has `suppressHydrationWarning` for it. Storage that throws falls back to System. (With storage blocked, React Router's own `ScrollRestoration` script throws a `SecurityError`; not ours.)
  - **`GroupMenu`:** the current group's display name (recipient's preferred name or name, then the group name) as a RAC menu ("…: switch care group") listing every local group (live, offline), the current one checked (`menuitemradio`); choosing one opens its timeline. After a separator, "Group settings" opens `/app/groups/:groupId/settings`. It reads the user id from the layout's loader data (`useRouteLoaderData`), not `getSync()`, which throws while signing out.
  - **Last group** (`lib/lastGroup.ts`): a group route you're a member of is saved as `caretook:lastGroup:<userId>`; sign-out runs `forgetGroups()`. `/app`'s loader redirects by the pure `resolveHomeGroup({ groups, remembered })`: the remembered group if you're still in it, else the only group, else the list.
  - **Group sections** (`lib/groupSections.ts`): `GROUP_SECTIONS`, an ordered `{ id, label, icon, path(groupId), match(subpath) }` list (Timeline only; `match` also claims `/entries/*`). **A later PRD adds a section by appending one entry and its route**; the shell needs no edit. `SectionNav` (header links) and `TabBar` (a daisyUI `dock`, `sm:hidden`, `z-40`) render it with `aria-current` (`"page"` on the section's page, `"true"` inside it). Both navs are named "Group sections"; only one shows. The bar is hidden on `/entries/*`; elsewhere it renders an in-flow spacer of `--tab-bar-height` (`app.css`), so screens never offset for it. Anything else fixed to the bottom of a group screen offsets by that variable. Modals (`z-50`) cover it.
  - **Group settings** (`/app/groups/:groupId/settings`, `routes/app/groups/settings/`; not a section, so the tab bar shows with nothing current): the same `SettingsFrame` as account settings, with the registry `groupSettingsPages(groupId)` (`layout/settingsPages.ts`) and `appUrls.groupSettings(groupId, page?)`. Subpages: **Details** (`details`; the `group-details` and `care-recipient` cards, intents `renameGroup` and `updateRecipient`, the date of birth from `careGroup.recipient`) and **Members** (`members`, `data-section="members"`; intents `changeRole` and `removeMember`). **Writes are online only**: each subpage's `clientAction` calls oRPC. Offline, or without the role, a card is a read-only `<dl>` with no controls, and the page says "Needs a connection to edit" (`SettingsPage` in `parts.tsx`; `api.ts` has `loadRecipientProfile` and `failedSave`). `groupSettings.ts` beside them has the pure parts: `groupSettingsAccess` (through `hasPermission`), `parseGroupName` and `parseRecipientProfile` (the shared Zod schemas, with the field messages). There's no future-date rule on the date of birth.
    - **Members:** every member (avatar, name with "(you)", role), live from local data, sorted by role then name (`sortMembers`, `memberAccess`, `roleLabel`). Online, owners and admins get a native role `<select>` and Remove; everyone gets Leave on their own row; both go through one `ConfirmDialog`. Only owners are offered Owner or controls on an owner's row. The service's owner-only and last-owner messages are shown as they are (`memberRefusal`).
    - **Leaving waits for the device:** `/app` reads the local copy, so the action waits up to 10 s for the membership to sync away (`waitForMembershipGone` in `lib/sync/members.ts`) before redirecting to `/app`. On a slower sync the user lands back on the group until it goes.
  - **Settings** (`/app/settings`, `routes/app/settings/`): a list of subpages from the `ACCOUNT_SETTINGS` registry (`id`, label, description, icon, path), rendered by `SettingsFrame` (`components/`, shared with group settings): one `nav[data-settings-nav]` with `aria-current` (`settingsCurrent` in `lib/settingsNav.ts`). On phones (below `md`) the index is the list and a subpage has a back link to it; from `md` the list is a side nav and the index redirects to the first subpage (`isWideSettings()`), and widening the window on the list opens it. Subpages, each its own route built by `appUrls.settings(page)`: **Units** (`units`), **Timeline layout** (`timeline`; Rows or Cards, saved on change through `saveSettings`, the same save as the timeline's toggle; read through `loadSettings`, so a pending change shows at once) and **Account** (`account`; name and email, read-only, and Sign out).
  - **Avatars:** `UserAvatar` (image, or initials if it's missing or fails to load) is shared by the user menu and `EditorAvatars`. `lib/initials.ts` has `initials(name)` and `userInitials({ name, email })` (name, then the email's first letter, then "?"). `SessionUser` carries an optional `image`.
- **Timeline screen** (`/app/groups/:groupId/timeline`):
  - Rows (the default) or cards, both rendered from `entrySummary()`.
  - Kind icons and colors in `KIND_META`. Vitals are pink, **not green** (green reads as "all good").
  - Sticky day headers (`text-base`, `lg:text-lg`, semibold, full contrast; 40 px tall, 44 px from `lg`), labelled by the pure `dayLabel(iso, timeZone, now, locale?)` in `lib/format.ts`: "Today", "Yesterday", then "Monday, Nov 16", with ", 2025" when the year isn't `now`'s. It compares calendar days in the zone, so midnight and DST hold. `formatDay` stays for the entry page.
  - **Filters live in the URL** (`?kind=<kind>&author=<userId>`), owned by the pure `lib/timelineFilters.ts`: `parseFilters(search)` (unknown kinds are ignored; an author must be UUID-shaped, and membership isn't checked) and `setKind`, `setAuthor`, `clearKind`, `clearAuthor`, `clearFilters`, each taking the current search string and returning the new one. A change that changes nothing returns its input, and other parameters are kept. **Every filter control is a `Link` built through it**, with `replace` and `preventScrollReset`. The kind chips and each entry's kind icon use it; the author isn't applied to the list yet (`timeline-polish` slice 4).
  - **Kind icon** (`KindFilterLink` in `KindIcon.tsx`): in rows and cards the icon is a link named "Show only <kind plural>", `relative z-10` above the row's open target, for viewers too.
  - **Latest vitals** (`LatestVitals`, `json_each` locally) is one 32 px line on every screen: a "Latest" label (screen-reader only below `sm`, so two readings fit on a phone), the readings newest first, clipped under a fade by CSS overflow (no measuring), and an "All vitals" disclosure button (`aria-expanded`, `aria-controls`) that's never clipped. Expanded, every type's latest reading wraps below; the state isn't remembered. It ignores the timeline's filters.
  - Quick-add: **Note** and **Event** link to `/entries/new?kind=…`; Symptom and Vitals are links to the **add-sheet route** `timeline/new/:kind` (`symptom` | `vital`, with `?type=<vitalType>`; `appUrls.newSheet`), a child of the timeline rendered in its `Outlet`: `EntrySheet` (a RAC Modal; a bottom sheet on phones) with `EntryForm` (symptoms and vitals only). The filters carry through. Its loader's `newSheetGuard` sends another kind, or a viewer, to the timeline, and drops an unknown `type`. The timeline's `shouldRevalidate` skips its loader when only the sheet changes (`onlySheetChanged`). Closing (`useCloseSheet`) goes back when the sheet was opened from the timeline (`SHEET_LINK_STATE`), and replaces it with the timeline when it was deep-linked, so Back after a save never reopens it. Sheet links use `prefetch="render"`, or the sheet can't open offline after a full load. **Editing** is the **edit-sheet route** `timeline/:entryId/edit` (`appUrls.editSheet`), the same sheet: its loader's `editSheetGuard` sends a note or event to its page, a viewer or a missing, deleted or other group's entry to the timeline (filters kept), and the sheet closes if the entry is deleted while open. The timeline prefetches its module once (`PrefetchPageLinks`) so it opens offline. A note's or event's row body is its document preview.
  - **Live now** (`LiveNowBanner`, between `LatestVitals` and `QuickAddBar`, viewers too): "<names> is writing · <title> · +N more" with a **Join** link, for the most recently edited document others are writing in; one polite `role="status"` announcement per document. Rows and cards show a `LiveDot` (`pointer-events-none`, so taps reach the open target; static under reduced motion; sr-only "Being written now by …"). Both come from `useLiveDocuments` and expire with the recent-editors window. The wording is in `lib/liveNow.ts` (`liveDocuments`, `writingLabel`, `liveDotLabel`, `announcementText`, `listNames`).
  - **Row taps** (`EntryOpenTarget` in `TimelineEntryRow.tsx`): a link stretched over the row or card (`absolute inset-0`), so it's one named, focusable control. Notes and events open `/entries/:id` for everyone; symptoms and vitals link to their edit-sheet URL for writers and have no target for viewers. The ⋯ button and the More/Less toggle sit above it (`relative z-10`), and each row is `relative isolate` so they stay under the sticky day headers.
  - The ⋯ menu (writers only) has Delete, plus Edit for symptoms and vitals.
  - The timeline's `shouldRevalidate` skips submissions (live queries already show them). "Show older" grows the query limit.
- **Seeds** (`seeds/timelineEntries.ts`): about 180 fictional entries over eight weeks for Grandma Pat, placed by `hoursAgo` or `at: { daysAgo, time }` (America/Los_Angeles).
  - **Ids follow position**, so adding or changing an entry needs `pnpm datastore:reset`.
  - `timelineEntries.test.ts` validates every seed entry against the content schema, because seeds bypass the service.
  - A note's or event's seed `body` is its document's text: the insert stores a null body plus a compacted `note_document` (`seedContentOf`, `noteDocFromText`), with `editors` set to its author at `occurredAt`.

### Live notes (collaborative documents)

Built by [`plans/live-notes-ux-prd.md`](plans/live-notes-ux-prd.md) (done).

- **What they are:** the text of every **note and event** (`NOTE_DOCUMENT_KINDS`), a Yjs document. **Its id is the entry's id**, so two devices adding one offline make the same row and merge.
- **Tables:**
  - `note_document`: `snapshot` (compacted Yjs, base64), derived `text`, and `editors` jsonb `{ [userId]: lastEditAt }` (default `{}`, system-only writes; a forged one in an upload is ignored).
  - **Its owner** is `subject` (`entry | provider`, default `entry`) with `entry_id` or `provider_id`: exactly one set, equal to `id`, each a cascading composite FK (a check enforces it). A provider's notes are its document. `useLiveDocuments` and the Live now banner join through `timeline_entry`, so provider documents never show there.
  - `note_update`: append-only, base64 `data`, at most 1,000,000 chars.
  - Composite FKs cascade from the entry. `timeline_entry` has a unique `(group_id, id)` for this.
- **Helpers** (`db/schema/noteYjs.ts`, client-safe): base64, `isYjsUpdate`, `buildNoteDoc`, `encodeNoteDoc`, `noteText` and its inverse `noteDocFromText` (one paragraph per line, `• ` lines as a bullet list). The fragment is `NOTE_FRAGMENT = "default"`.
- **`noteDocumentService`** (write through it):
  - `create` is idempotent and requires a live note or event.
  - `appendUpdate` is idempotent on the update id.
  - `currentText` includes pending updates (for AI and workers).
  - `compact` (system, row locked `FOR UPDATE`) folds pending updates into the snapshot and text, merges their authors into `editors` (`mergeEditors`, latest time per user), and deletes them.
- **Recent editors** (`db/schema/noteEditors.ts`, client-safe): `recentEditors({ editors, pending, now, excludeUserId })` combines `editors` with pending `note_update` rows. The window is 2 min (`RECENT_EDITORS_WINDOW_MS`, edge inclusive, up to one window of future skew allowed), re-evaluated every 15 s (`useNow`). On the device, `lib/sync/editors.ts` has `documentEditorsQuery`, `groupLiveEditorsQuery` and `useLiveDocuments` (the group's live, not deleted, notes and events, for the live dot and banner), `toRecentEditors` and `useRecentEditors`. `EditorAvatars` shows up to 3 initials then "+N", never the viewer. An update's `created_at` is the server's, so offline edits count as "now" for 2 min after they upload.
  - `compactIfDue`: at 20 pending updates, or after 60 s.
- **Device** (`lib/sync/notes.ts`):
  - `createNoteDoc` and `bindNoteDoc` are split so StrictMode's double effects can't destroy a live doc.
  - Typing bursts flush as one `note_update` 250 ms after the last keystroke, and at least every 1 s.
  - A viewer's changes are never written.
  - Previews rebuild text locally, so they include unsynced edits.
- **Entry page** (`routes/app/groups/entry/route.tsx`, `/entries/:id`; `/entries/new?kind=note|event` is a draft, the same route so the editor stays mounted):
  - Nothing is written until the first real change (`shouldMaterialize` in `lib/liveEntry.ts`: text in the document, or a title). Then `materializeLiveEntry` (`lib/sync/liveEntry.ts`) writes the entry and its document in one local transaction (idempotent on the id; for an older event it adds only the document), and the URL is **replaced** with `/entries/:id`.
  - `bindNoteDoc`'s `ensureSaved` holds a draft's Yjs changes in memory until then; leaving drops them.
  - `EntryHeader` has four regions:
    - **title:** `EntryTitle`, editable by writers for both kinds. `commitTitle` saves a new draft, or renames an existing entry. While an event is unnamed (`isUnnamedEvent`) and nothing is typed, writers see `EventTitleChips`: up to 5 of the group's recent event titles (`suggestTitles` in `lib/titleSuggestions.ts`: 14-day half-life, case-insensitive dedupe, no "Event" or deleted entries; read locally by `lib/sync/titleSuggestions.ts`, so they work offline). A tap goes through `commitTitle`, so a named event takes 2 taps.
    - **time:** `EntryTimeChip` for writers (a popover with `DateTimeField`; saved on close, only if changed; a time picked on a draft is the saved time, via `occurredAtRef`). Viewers get a plain `EntryTime`.
    - **editors:** `EditorAvatars`.
    - **actions:** once the entry exists, `ShareButton` for everyone, plus `EntryActions` (⋯ → Delete, with a `ConfirmDialog`, then back to the timeline) for writers.
  - **Share** (`share.ts` beside the entry route): the Web Share API when `canShare` allows it, else the clipboard with a "Link copied" status; a dismissed sheet shows nothing, and a failed copy shows the link to copy by hand. The origin is `VITE_API_ORIGIN || location.origin`.
  - Symptom or vital ids, and non-members, get a 404 that shows no title or text.
- **Editor:** `LiveNotesEditor` is Tiptap StarterKit (`undoRedo: false`, because Collaboration brings Yjs undo; `link: false`). Its chunk is about 140 KB gzipped and loads only on its route.
- **Vite:** `optimizeDeps.include` pre-bundles yjs and Tiptap, and `resolve.dedupe` keeps one yjs, React and ProseMirror. Without both, "Yjs was already imported" and broken hooks after re-optimization.
- **Latency:** a co-editor sees typing in about 0.5–0.8 s locally. Offline edits land about 2.5–3 s after reconnecting.
- ❓ Presence and cursors (a websocket relay such as Hocuspocus): decide after real use. 🟡 Not built: a compaction cron sweep, a snapshot size cap, an oRPC read for documents, search over `text`.

### Providers

Built so far by [`plans/providers-prd.md`](plans/providers-prd.md) slices 1–4 (the data layer and the directory); linking from entries comes in slices 5–7.

- **Tables:**
  - `provider`: `group_id`, `type` (`clinician | practice | pharmacy | other`), `name`, `specialty`, `practice_id` (composite FK in the group), `phones` jsonb `[{ label, number }]` (at most 6), `email`, `address`, `website`, `status` (`current | past`), **`is_primary`** (not `primary`, an SQL keyword in Postgres, SQLite and PowerSync), `deleted_at`. Unique `(group_id, id)`.
  - `timeline_entry_provider`: a link from a note or event to a provider. Its id is `entryProviderId(entryId, providerId)`, a UUID v5 (`db/schema/uuidV5.ts`, pure and synchronous), so the device and server derive the same id and a pair is one row. Composite FKs cascade; unlink is a hard delete.
- **Rules** (`providerService`, `entryProviderService`; write through them):
  - A practice must be a live practice or pharmacy in the same group, never the provider itself. Practices and pharmacies have no practice of their own. A practice or pharmacy can't become a clinician or `other` while live providers name it as their practice (`providerService:practiceInUse`, issue on `type`; the device's `updateProvider` refuses it the same way). Practice ↔ pharmacy is allowed. Deleting a practice still leaves its clinicians pointing at it (B-37).
  - Delete is soft and hides a provider from lists. Lists are in display order: primary, then current by name, then past by name.
  - Links go only to live notes and events in the same group; a deleted provider is refused; an id in another group is `unauthorized`; unlinking a missing link succeeds (replays).
- **Device** (`lib/sync/providers.ts`): queries (the list, one provider, an entry's providers including deleted ones for greyed names, a provider's entries, link history) and local writes (create, update, soft remove, link, unlink, and create-and-link in one transaction). Linking needs the entry to exist locally, so a draft must be materialized first. A device-created provider document writes `subject: "provider"` and `provider_id`.
- **Seeds** (`seeds/providers.ts`, own ids): six fictional providers for Dev Family (a practice and its clinician, a cardiologist, a pharmacy, a home health aide, a past provider) with provider notes and links to seeded events and notes, and one for Dev Family 2.
- **Screens** (children of the group route, built through `appUrls.providers`, `newProvider`, `editProvider`, `provider`; a Providers entry in `GROUP_SECTIONS`, lucide `Stethoscope`):
  - **The list** (`routes/app/groups/providers/`): live from local data. Search (`?q=`; every word in the name, specialty or practice name, case and accents ignored), type chips (`?type=`) and past providers behind "Show past (N)" (`?past=1`), all in the URL through the pure `lib/providerDirectory.ts`. Each row opens the provider page and has contact actions. Writers get "Add provider".
  - **Contact actions** (`lib/contactActions.ts`, pure): `tel:` keeps digits and a leading `+` and dials an extension after a pause (`x214` → `,214`); maps is a Google Maps search URL; a bare website gets `https://`, and only http(s) links are made. `components/ContactActions.tsx` renders them with names like "Call Dr. …, office".
  - **Sheets** `providers/new` (optional `?type=`) and `providers/:providerId/edit`, children of the list (routing's sheet pattern; `providerSheetGuard.ts`): `ProviderForm` with type, name, specialty, practice (clinicians and other contacts), up to 6 phones, email, address, website, primary and past; field messages from the shared Zod schema. Writes are local (`createProvider`, `updateProvider`, `removeProvider`) and upload later. Delete is soft, after a `ConfirmDialog`. Viewers and missing providers get the list, with no form.
  - **The provider page** (`routes/app/groups/provider/`, `providers/:providerId`): header regions (title, details with the practice as a link, editors, actions with Edit for writers), every contact action, and the provider's live notes in `LiveNotesEditor` (created on the first real change through `createProviderDocument`; read-only for viewers). Missing, deleted or other-group providers are the 404. `LiveNotesEditor` and `EditorAvatars` live in `components/notes/`, `ContactActions` and `ProviderTypeIcon` in `components/providers/`.
- **Browser check:** `providers.mjs` covers the device module (through `window.caretookModules()` against `window.caretookSync`, both set in dev and check builds only) and every screen: list, search and filters, sheets, offline add and edit, the page, two-browser notes, viewer and non-member. It cleans up its `PV-` providers.

### Marketing site

Built so far by [`plans/marketing-prd.md`](plans/marketing-prd.md) slice 1.

- **Web only:** a `marketing` layout route (`routes/marketing/layout/`) in `routes.ts`'s web-only list, with `/`, `/features`, `/faq`, `/about`, `/contact`, `/privacy`, `/terms`, `/health-data-privacy`, plus `sitemap.xml` and `robots.txt` resource routes. Native's `/` still redirects to `/app`. Marketing code never imports from `routes/app/`, `lib/sync/` or the editor.
- **Prerendered:** `react-router.config.ts` prerenders `PRERENDER_PATHS` for the web target only.
- **One page list:** `site/pages.ts` `MARKETING_PAGES` feeds the header, footer, sitemap and prerender. A new page is an entry there, a route in `routes.ts`, and a folder with `route.tsx` and `content.ts`.
- **Copy lives in typed content modules** (`<page>/content.ts`), rendered by `sections/` components; icons are named by string (`sections/icons.tsx`).
- **SEO:** `site/meta.ts` `marketingMeta({ title, description, path, siteUrl, image?, jsonLd? })`; the layout's loader gives `siteUrl` from `APP_URL` (default `https://caretook.com`). `robots.txt` disallows `/app /admin /invite /join /api /rpc /dev` by prefix, so public files that must stay crawlable avoid those prefixes (icons live in `/icons/`).
- **Brand assets** (drafts, in `apps/web/public/`): `favicon.svg`, `logo.svg`, `icons/*.png`, `og-default.png`, `site.webmanifest`. The PNGs are rendered from the SVG; regenerate them if it changes. `root.tsx` links the icons for both targets.
- **Theme:** the existing `THEME_SCRIPT`, unchanged; a stored app theme applies on the site.
- **No third-party requests and no analytics:** `MarketingAnalytics` is an empty hook point. The site makes public privacy promises, so anything that changes them updates the privacy page in the same change.
- **Browser check:** `marketing.mjs` (no sign-in; about 5 s). Screenshots only with `MARKETING_SHOTS=1`, viewport-only; never `captureBeyondViewport` (it hung headless Chrome for over an hour).

## Notifications (`packages/notifications`)

✅ Built by `invites` slices 1–2: `@caretook/notifications`, server only, usable from the API, Better Auth callbacks and workers. Nothing outside it calls Resend.

- **Built:**
  - `NOTIFICATIONS` (`registry.ts`): `testMessage`, `magicLink`, `signInCode`, `resetPassword`, `verifyEmail`. Templates are `react-email` 6.11.13 components (it replaced the deprecated `@react-email/components`), rendered to HTML and plain text by `@react-email/render` 2.3.1. Data is checked with Zod before rendering; links come only from `APP_URL` and must be app paths (`templates/appPath.ts`).
  - `notify(name, { to, actor?, data, idempotencyKey, tx?, deliver? })` writes a `notification_outbox` row in the caller's transaction (a repeated key queues nothing). **Every email goes through the outbox, auth emails included.** Outside a transaction it starts delivery at once; inside one, call `deliverSoon(id)` after commit. `setBackgroundRunner` is the hook for Vercel's `waitUntil`.
  - Delivery: `deliverDue({ limit ≤ 100 })` claims rows `FOR UPDATE SKIP LOCKED` (and retakes rows stuck in `sending` over 10 min); backoff doubles from 1 min to 6 h, failed after 8 attempts; `purgeSent` drops sent rows after 30 days. The web-only `/api/cron/outbox` runs `sweepOutbox` behind a `CRON_SECRET` bearer (401 without it, 503 when unset).
  - Senders by `MAIL_SENDER`: `log` (dev default; writes `dev_mail`), `memory` (tests), `resend` (checks `{ error }`, passes the idempotency key; outside production only `MAIL_ALLOWLIST` addresses or `@domain`s, others marked `skipped`). Production refuses to start without `RESEND_API_KEY` and `APP_URL`, and refuses `log` or `memory`.
  - **The dev mailbox:** web-only `/dev/mail` (list, `?to=`), `/dev/mail/:id` (HTML in a sandboxed iframe, text, links) and `/dev/mail.json` (`?to=`, `?limit=`, `?id=`; what browser checks read). All 404 under `NODE_ENV=production`, so mail checks need the dev server, not `pnpm prd serve --built`.
  - **Env** (documented in `apps/web/.env.example`): `APP_URL`, `MAIL_SENDER`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_ALLOWLIST`, `CRON_SECRET`, `INVITE_LINK_KEY`. `new.sh` sets each worktree's `APP_URL` to its own web port and gives it a random `CRON_SECRET` when the main checkout has none. Without `APP_URL` links default to `http://localhost:5173`, so an older worktree's mail points at the main checkout: add `APP_URL` to its `apps/web/.env`.
- **Before launch:** Resend's open and click tracking are settings on the sending domain, not per message, so turn them off there; plus SPF, DKIM and DMARC on the sending subdomain, the bounce webhooks, and the cron schedule on the host.
- **Design rules (still apply):**

- **Typed registry:** `defineNotification({ name, data: zod, email: (data, { recipient }) => ({ subject, react }), push? })` in `NOTIFICATIONS = { … } as const`, sent with `notify(name, { to, actor?, data })`.
  - Never type the registry as `Record<string, …>`: that makes every string a valid name and loses the link between name and data.
  - Validate data before rendering.
  - One function per channel.
- **Links and text:** templates get plain data plus a configured `APP_URL`. **Never build links from the request Host header** (password-reset poisoning). Always send a plain-text version.
- **Senders:** `resend` (production), `log` (dev) and `memory` (tests).
  - Check Resend's `{ error }`; it doesn't throw.
  - Production refuses to start without `RESEND_API_KEY`.
  - Outside production, only allowlisted recipients get real email.
- **Health-app rules:**
  - No health details in subjects or bodies by default (opt-in only, with consent recorded).
  - Resend open and click tracking off.
  - Tokens single-use, short-lived and stored hashed, never raw in the outbox.
  - Don't await auth emails (timing leaks whether an account exists), but don't leave them unawaited on Vercel either: use `waitUntil` or the outbox.
  - Verify the bounce webhooks (Svix).
  - Send from a subdomain with SPF, DKIM and DMARC.
  - `List-Unsubscribe` on optional mail.
  - Times in the recipient's zone.
- **Next:** invites through the outbox, with sign-up, accept and consent (`invites` slices 3–5); then tracking off, bounces and DNS. Later: digests, preferences, push through Capacitor, the AWS worker.

## Compliance

- ✅ **Deliberately outside HIPAA scope:** no BAAs, and no work on behalf of covered entities.
- Still applies: the FTC Health Breach Notification Rule and state laws (e.g. Washington's My Health My Data Act). In practice:
  - no ad or analytics tools that can see health data;
  - consent before sharing, and user data deletion;
  - encryption at rest;
  - AI vendors that don't retain our data or train on it.

## Open questions

- ❓ Invites: accept and decline (match the signed-in email, create the membership as `system`), and **consent** for sharing health data. Settled in the `invites` plan (slice 3: a `care_group_consent` row with the consent version); email delivery is built (_Notifications_).
- ❓ Account deletion by a group's last owner currently leaves the group ownerless. Block it, delete the group, or auto-promote?
- ❓ Co-members can read each other's full `user` row in the data layer. Only the API's public-profile shape protects it.
- ❓ Hosted database, PowerSync production setup, rate-limit storage, native token storage (see the sections above).

## Dev workflow

### Commands (repo root, after `nvm use`)

| Command                                                       | What it does                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm --filter @caretook/web dev:native`         | dev server, SSR or SPA mode                                                                                                        |
| `pnpm build` / `pnpm build:native`                            | `apps/web/build/web/` or `apps/web/build/native/client/`                                                                           |
| `pnpm datastore:start`                                        | start Postgres (waits for healthy), migrate, seed. Needs `packages/data/.env` and `apps/web/.env` (copy the examples; set secrets) |
| `pnpm datastore:up` / `stop` / `logs`                         | the dev Postgres container                                                                                                         |
| `pnpm datastore:generate` / `migrate` / `seed` / `studio`     | generate a migration, apply them, insert dev data (idempotent), Drizzle Studio                                                     |
| `pnpm datastore:clear` / `reset`                              | drop everything (localhost only), or clear + migrate + seed + a fresh PowerSync (`datastore:powersync`)                            |
| `pnpm datastore:start:test` / `reset:test` / `stop:test`      | the test database on :5435 (migrated, not seeded)                                                                                  |
| `pnpm lint` / `lint:fix`, `pnpm format` / `format:check`      | ESLint and Prettier                                                                                                                |
| `pnpm test` / `test:unit` / `test:integration` / `test:watch` | Vitest (integration needs `pnpm datastore:up:test`)                                                                                |
| `pnpm typecheck`                                              | tsc everywhere; apps/web runs typegen and tsc on the **web** target only (it includes every shared file)                           |
| `pnpm check`                                                  | typecheck, lint, format check and tests: run it before handing off                                                                 |
| `pnpm backlog …`                                              | the live backlog on `dev` (`ingest`, `list`, `claim`, `done`, …; see _The live backlog_)                                           |
| `pnpm prd …`                                                  | parallel PRD worktrees (`status`, `start`, `serve`, `check`, `sync`, `ready`, `land`, `rm`; see _Running loops_)                   |
| `pnpm hooks:install`                                          | turn on the branch protection hooks (`.githooks/`) for this clone: once, after cloning                                             |

### Browser checks (`scripts/browser-checks/`)

UI work is verified in headless Chrome over CDP with plain Node scripts (no Playwright yet).

- **Run:** `pnpm prd browser <check> [args…]` from the worktree (`phase2`, `phase2.mjs` or a path). It uses Node 24 from `.nvmrc` (the checks need the global `WebSocket`), the worktree's `.env.loop` (`BASE`, `CDP_PORT_OFFSET`, `PG_CONTAINER`; the main checkout's defaults when there is none, and `BASE` then defaults to `http://localhost:5176`), runs from `scripts/browser-checks/`, and holds a machine-wide lease (at most four checks at once). `--changed` runs only what the diff needs (see _Browser check budget_). `--timeout <s>` kills a check, and its Chrome, after that long. `--suite` runs every check in the _Browser check budget_ table, pausing 10 s between them for Better Auth's sign-in limit (`CARETOOK_BROWSER_SUITE` and `CARETOOK_BROWSER_PAUSE` override), and exits non-zero if any failed.
- **Scripts:** `cdp.mjs` (the harness, with `tap()` for real CDP mouse taps; it collects uncaught errors, rejections, `console.error` and failed loads in `page.uncaught`, and a `waitFor` timeout prints `page.diagnose()`: the URL, those errors and the start of `main`; pass `{ quiet: true }` for an expected timeout); `proxy.mjs` (offline, because CDP network emulation doesn't cut PowerSync's stream; it tunnels CONNECT, so WebSockets work, and going offline leaves Vite's `vite-hmr`/`vite-ping` sockets open, so a proxied page still gets Vite's reload after a re-optimization instead of loading two copies of React and Yjs); `live-notes.mjs` (the one notes and events check, about 2 min: drafts, one-tap note and event, title chips, Live now banner and live dot, avatars, convergence, offline, time chip, Delete, Share, 404s, with tap counts Note 1, Event 1, named event 2, Join 1); `roundtrip.mjs` (sheet entries: symptom add, edit, delete, validation, offline, viewer, sign-out wipe); `phase2.mjs` (the timeline layout and row taps, the kind icon filter, the day headings and the one-line vitals strip, writer and viewer in both views; Chrome in America/Los_Angeles, the seeds' zone; rerun it after any timeline change; its sticky-heading steps scroll relative to a day section, never to a fixed offset); `signout-wipe.mjs` (never exits on its own; `pnpm prd browser` stops it after its last line); `sign-in.mjs` (one sign-in request on a double click, by holding `/api/auth/token`); `layout-offline.mjs` (an offline layout change survives and reaches the server); `first-sync.mjs` (a slow first sync, held by its own proxy, shows the syncing state and never "no care groups"; `HOLD_MS`); `app-shell.mjs` (the frame: one-row header at 420, the user menu by keyboard, theme with no flash and with storage blocked, group switching and the last group, the tab bar at 420 and header links at 1280, Sign out, and group settings for owner, caretaker, viewer, a non-member and offline, then members: role change on a second device, the admin and last-owner refusals, remove and leave; it restores the seeded names and memberships, so no reset is needed afterwards); `settings-layout.mjs` (the timeline layout choice in Settings, as caretaker@ in two browsers; it restores the account's layout); `invites.mjs` (account emails through `/dev/mail.json`: emailed link, emailed code, reset, verification, unknown addresses getting the same message and no mail, one email per double press; it makes `inv<run>-…@example.com` accounts and deletes them, their mail, outbox and verification rows at the end; dev server only). `phase2.mjs`'s sticky-header step scrolls into the middle of a day, because seeds are placed by `hoursAgo` and a fixed offset can land on the seam between two days.
  - **They're order-independent:** each run tags the entries it makes, asserts against its own entries (never global idle state or seed order), moves only its own documents' edit times back before "who's typing" steps, and soft-deletes what it made at the end. They exit non-zero on failure.
  - Sign out in a check with `page.signOut()` (`cdp.mjs`), which goes through the account menu.
  - `page.signIn` retries once (with a log line) when `/api/auth/token` answers 401.
  - **member@ has two groups.** `page.signIn(email, pw)` goes on from the group list to Dev Family's timeline (`page.openDevFamily()`); pass `{ home: true }` to stay where `/app` lands. A check that needs a one-group user's "straight to the timeline" signs in as caretaker@ or viewer@. psql queries that pick seeded rows filter on Dev Family's id (`0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001`).
  - `layout-offline.mjs` and `signout-wipe.mjs` print their result and then don't exit (open proxy sockets). `pnpm prd browser` stops them 2 s after their last line (`N/M passed`; signout-wipe's `errors:`), with 300 s as a backstop (TIMEOUT if the last line never comes), and takes the verdict from the `N/M passed` line (`ended` for signout-wipe, which has no assertions: read its output). Don't wrap them in `timeout` yourself.
  - Headless Chrome's clipboard needs `Emulation.setFocusEmulationEnabled`. Pin the zone (`Emulation.setTimezoneOverride`, America/Los_Angeles) for layout checks.
- **Patterns:**
  - Use a 420×900 window.
  - Sign in as the `@example.com` seeds (`SEED_USER_PASSWORD`).
  - React Aria buttons and menu items need a `pointerdown` before `.click()`.
  - Set inputs through the native value setter, then dispatch `input`.
  - Collect console errors, and take screenshots.
  - **Better Auth allows about 3 sign-ins per 10 s.** Past that it answers like a wrong password. Pause between checks run back to back (`first-sync.mjs` waits 4 s before each sign-in).
- **Afterwards:** nothing; the checks clean up after themselves, so no reset is needed between runs.

### Gotchas

- **The dev server on another port:** Better Auth trusts only `BETTER_AUTH_URL` and `AUTH_TRUSTED_ORIGINS`, so use `BETTER_AUTH_URL=http://localhost:5176 AUTH_TRUSTED_ORIGINS=http://localhost:5176 pnpm --filter @caretook/web dev --port 5176 --strictPort`. PowerSync's JWKS then needs `PS_JWKS_URL` set to match.
- **After `pnpm build:native`:** lint can report `no-unsafe-argument` in `routes/rpc.ts` and `routes/api/auth.ts`, because the native typegen overwrote the web route types. Run `pnpm typecheck`.
- **`/app` error handling:** `/app` has its own `ErrorBoundary`. It keeps the frame, and avoids React's "script tag" warning from the root boundary.
- **Route discovery is `initial`** (`react-router.config.ts`). With the default (lazy), navigating to a path not seen yet (a note just saved offline, `/entries/:id`) asks the server for `/__manifest` first, and fails offline.

## Layout

```
docker-compose.yml        dev Postgres :5434, PowerSync :8080 + storage; docker-compose.test.yml → :5435
powersync/                service.yaml, sync-config.yaml (Sync Streams)
docs/                     orchestration.md: the human guide to branches, the inbox and running PRDs (README.md links it)
plans/                    inbox.md (the user's list) and backlog.md (the tracker), both only on dev; PRDs and slice plans
scripts/browser-checks/   headless Chrome checks
scripts/loops/            pnpm prd (prd.sh) → new/ls/rm/prompt/serve/ready/land/browser (+ lib.sh): worktrees in .loops/, slot and browser leases, a Docker stack each
scripts/backlog/          pnpm backlog: the live backlog CLI (format.mjs parses and renders)
.githooks/                protects main, staging and dev; commit-msg checks Conventional Commits (pnpm hooks:install)
apps/web/                 @caretook/web (React Router 8, Vite 8)
  build-target.ts, react-router.config.ts, vite.config.ts
  app/routes.ts, root.tsx, app.css
  app/routes/app/         shared screens, a folder per route (route.tsx + its private files; no server loaders):
                          layout/ (the /app frame: GroupMenu, SectionNav, SyncIndicator, UserMenu), home/, settings/,
                          groups/layout/ (the group route), groups/index/, groups/timeline/ (EntryForm,
                          QuickAddBar, TimelineEntryRow/Card, TimelineFilters, LatestVitals, LiveNowBanner, LiveDot,
                          VitalTypeMenu, VitalReadingsFields, entryFormData), groups/entry/ (EntryHeader,
                          EntryTimeChip, EventTitleChips, ShareButton, share),
                          groups/settings/ (groupSettings)
  app/routes/marketing/   web only; routes/api/auth.ts, routes/rpc.ts (web only); native-index.tsx
  app/routes/sign-in.tsx, sign-out.tsx; app/routes/account/ (reset-password, verify-email, AuthCard)
  app/routes/dev/mail/, app/routes/api/cron/outbox.ts   web only (the dev mailbox; the outbox sweep)
  app/.server/            data.ts, auth.ts, api.ts, notifications.ts: the server-only doors
  app/components/         shared by 2+ routes only, imported through each folder's index: ui/ (primitives), ui/date/,
                          entry/, notes/, providers/, settings/, shell/
  app/lib/                session, group, groupContext, appUrls, settingsNav, me, auth-client, rpc, api, initials, entryDisplay, format,
                          redirect, form, liveEntry, firstSync, liveNow, titleSuggestions, theme, lastGroup, groupSections,
                          timelineFilters, contactActions, providerDirectory
  app/lib/sync/           schema, client (lazy), index, timeline, notes, liveEntry, editors, titleSuggestions, members, providers
packages/auth/            @caretook/auth (emails.ts: auth emails through notify)
packages/notifications/   @caretook/notifications: registry, templates (react-email), notify + outbox, senders, cron, dev mail
packages/api/             @caretook/api: router, procedures, errors, dto, sync upload, HTTP handler
packages/data/            @caretook/data
  scripts/                migrate, seed, clear runners
  test/                   env guard, globalSetup, setup, fixtures
  src/constants/, errors/, permissions/
  src/db/                 client, types, migrate, clear, migrations/, seeds/
  src/db/schema/          tables + Zod (client-safe), vitals, userPreferences, noteDocument, noteYjs, noteEditors, provider, entryProvider, uuidV5
  src/models/, src/services/
```

## Next steps

1. **Live notes follow-ups** (the PRD is done): give `LiveNotesEditor` a focus handle (title chips focus `main [contenteditable]` directly). File the PRD and slice issues once `gh` can see the repo.
2. **The backlog** (`pnpm backlog list`): write the PRDs its table marks "to write" (`pnpm prd plan <topic>`, one `write-a-prd` interview each), then run them, at most three at once.
3. **Tests:** make the integration tests independent (`careGroup.int.test.ts` shares one group across `describe` blocks), then cover every role against every table.
4. **Hosting:** choose the hosted database and how production migrations run. Set up PowerSync Cloud.
5. **Invites** (`plans/invites-plan.md`): slice 3 (email invites with consent), then 4 and 5. Then Capacitor (bearer storage, `VITE_API_ORIGIN`).
