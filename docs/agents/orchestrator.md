# Orchestrator handbook

For a PRD orchestrator: a top-level session (spawned agents can't spawn more), one per PRD, opened by the user in the integration worktree `.loops/<topic>` on `prd/<topic>`, where the user steers that PRD. It reads `dev`, never works in the main checkout, and runs loops ([loop](loop.md)). **At most three PRDs run at once** (`CARETOOK_MAX_PRDS`). Also here: the [rules across PRDs](#rules-across-prds) every slice follows. Hotfixes have [their own doc](hotfix.md). [orchestration](../orchestration.md) is the human guide.

## Branches and protection

- `main` (live) and `staging` change only by PR merge on GitHub (`staging` from `dev`, `main` from `staging`). `dev` takes landings, `pnpm backlog` commits and small direct changes. `prd/<topic>` takes its slices' merges and `dev` syncs; `slice/<topic>/<n>` its loop's commits; `plan/<topic>` (docs) and `hotfix/<name>` their session's commits; all three land in `dev` like a PRD.
- **Hooks** (`.githooks/`; `pnpm hooks:install` sets `core.hooksPath` for every worktree, and `new.sh` runs it): on `main` and `staging`, no commits, merges or pushes, and no local moves but a fast-forward to `origin`'s copy (`git fetch && git branch -f main origin/main`). The dev keeper overrides with `CARETOOK_ALLOW_PROTECTED=1` (the hook says so); agents never set it. `dev` isn't restricted. `commit-msg` checks Conventional Commits on every branch (`--no-verify` skips one). GitHub rulesets come once `gh` can see the repo.
- `pnpm prd sync`, `pnpm prd land` and `pnpm backlog` write their own commit subjects.

## Commands

`pnpm prd <command>` (`scripts/loops/prd.sh`, from any worktree) is the one front door; `pnpm prd help` lists every command, and each script's header has the details. `pnpm prd prompt orchestrator|plan|slice|hotfix|backlog|recover …` prints a session's first prompt (`orchestrator <topic> --auto` run-through, `--resume`; `slice <topic> <n> --continue`).

## Starting and steering

- **Starting (the user):** `pnpm prd start <topic>`, then the command it prints in a new terminal (`cd .loops/<topic> && claude --remote-control prd-<topic> "$(scripts/loops/prompt.sh orchestrator <topic>)"`).
- **The landing mode:** unless _Status_ records one, ask first: before each landing, run everything through (start every ready slice, land each green wave, clean up, ask only real questions), or land chosen waves or slices automatically. Record it in _Status_.
- **Queueing (the user):** `pnpm prd queue <topic>`, left running in its terminal, waits for fewer than `CARETOOK_MAX_PRDS` PRD worktrees (in queue order: tickets in `.loops/.queue/`, one lock in `.loops/.prd-start.lock`), then opens the orchestrator in run-through mode (`--manual` for the asking prompt). Queueing is the go-ahead for every landing of that PRD.
- **Waiting on another PRD:** ask its orchestrator (ListAgents, SendMessage) to message you when the work lands in `dev`, and set a background check that exits when `pnpm log dev` or `pnpm backlog list` shows it; then sync and carry on.
- **Keep your context small.** Work from _Status_, the backlog, hand-offs, `git diff --stat` and check output. Don't read whole diffs or debug inside a loop: send the problem back to its agent with SendMessage. Start a fresh session (the same command) when it gets slow or confused.
- **Update _Status_ at every step:** a slice started (worktree made, agent spawned), handed off, merged (with the SHA), a wave landed; plus what's ready, open issues and the landing mode. Write it as you go, and commit it with your merges and before `pnpm prd check`, so a fresh orchestrator loses nothing.
- **Capacity:** the limits are CPU and attention (a stack idles at about 250 MB); three PRDs with two or three slices each is about 12 slots. `pnpm prd check` takes one of three check leases, so loops finishing together queue. Under heavy load (six busy stacks pushed it past 500) tests and sign-ins time out: rerun once the load drops before debugging.

## Models

Use the cheapest model that does the job, with a tight brief asking for a short answer, and note each slice's in _Status_. **haiku:** reading long check output (report failures, ■ lines, the table), searches and summaries (sonnet when it needs judgement), backlog chores and triage proposals. **sonnet:** a mechanical slice (a rename, moving checks, a fix the plan spells out). **The session's own (opus):** a design-heavy slice (a table or permission, sync, new UX, a refactor). **You:** reviewing hand-offs, conflicts, choosing the check, landing, talking with the user. Redo a thin or wrong result on a stronger model rather than patching it.

## Running a wave

At every wave boundary: `pnpm backlog ingest`, `doctor` and `list`; propose new items for your topic ([backlog](backlog.md)). A new item becomes a slice in a later wave; a running slice never changes scope.

1. A slice is **ready** when every slice it's blocked by is merged into `prd/<topic>`. Start only what the user (or the landing mode) allows, and `claim` its items.
2. `pnpm prd slice <topic> <n>` for each.
3. Spawn one background agent per slice (not `isolation: worktree`: it already is one) with `pnpm prd prompt slice <topic> <n>`, plus anything it needs that the plan doesn't say. Mark it started.
4. On each hand-off, mark it, then review: `git diff prd/<topic>...slice/<topic>/<n>`, the hand-off, the acceptance criteria.
5. Merge **in plan order** in your worktree: `git merge --no-ff -m "feat(<topic>): <what it adds> (slice <n>, B-<n>)" slice/<topic>/<n>`. Resolve shared-file conflicts yourself. **No checks between merges**; a failure at landing goes back to the loop that caused it.
6. Record the merge SHA, `pnpm backlog done B-<n>`, `pnpm prd rm <topic>-<n>` (deletes the merged branch). Start what it unblocked.
7. **Land the wave** when it's green; don't wait for the whole PRD.

## Landing a wave

1. **Sync and check** in your worktree: `pnpm prd sync` (resolve conflicts; regenerate your migration if `dev` gained one; `pnpm datastore:reset`), `pnpm prd serve --restart`, then the browser checks: a wave that changes screens or flows runs `caffeinate -i pnpm prd browser --suite` (**the lean set, once**) plus, by name, any `e2e no` check `pnpm prd browser --changed --base dev --list` names; any other wave only `pnpm prd browser --changed --base dev`. Then the check the gate asks for. Backlog-only commits on `dev` don't count as drift.
2. **Report:** show the user `pnpm prd ready` (the link and seed accounts, the backlog items addressed, what's still open, commits, warnings for a migration, seed, sync-config or dependency change), plus the checks you ran and two or three things to try by hand. Fix any blockers it lists first.
3. **Wait for the user.** Changes go back to a loop, then repeat from step 1.
4. **Land on their word only:** `pnpm prd land <topic> -m "feat(<topic>): <what the wave adds> (B-<n>, …)"`. It refuses a branch that isn't synced or doesn't pass the check gate, and prints which pass it took. It prints what the main checkout needs next (`pnpm datastore:reset`, a PowerSync restart, `pnpm install`) and never pushes: `git push origin dev` is the user's.
5. **Fold the docs** (below), then tell other orchestrators to `pnpm prd sync` at their next wave boundary, never mid-wave. When the PRD is finished, `pnpm prd rm <topic>`.

- A go-ahead covers one landing, unless the landing mode or a queue covers more. Never land on your own judgement, never `--force` unless the user says so, never another PRD.
- **Run each browser check once:** never rerun one that passed, never `--suite` twice for a landing. This overrides any plan that asks for checks after each merge.
- **The backstop:** the dev keeper runs `pnpm prd browser --suite` on `dev` on a quiet machine before opening the PR to `staging`.

### The check gate

`pnpm prd land` and `ready` accept a tip on one of these, and say which (`lib.sh`, `checked_ok`, `checked_how`):

- **None needed:** everything `dev...<tip>` changes is Markdown, `scripts/loops/`, `scripts/backlog/` or `.githooks/`; later commits of only those also keep an earlier pass. Still run the tooling's own tests.
- **Full:** `pnpm prd check` (`pnpm check`, then `pnpm build:budget`: the entry and `/app` shell chunks under their gzip ceilings in `scripts/build/budget.json`, with no editor or PowerSync modules) passed on the tip.
- **Quick:** `pnpm prd check --quick "<why>"` passed on the tip: typecheck, lint, format and the tests related to the diff since the last full pass (`vitest run --changed`). The reason is shown at landing.

Quick is enough when everything since the last full pass is a conflict-free `pnpm prd sync` whose two sides share no file, slice merges whose slices each passed `pnpm check` with no code conflicts, or a hotfix. Run the full check when a conflict was resolved in code; when the diff touches a migration, seeds, `sync-config.yaml`, the lockfile or a `package.json`; when both sides changed a shared registry or hot file; or when unsure. Quick passes keep the last full pass as their base, so they don't drift.

### Docs at landing

- Fold the wave's lasting decisions into the matching area doc (add a doc and an _Area index_ entry for a new area), process changes into the role doc, and only rules every session needs into AGENTS.md. Keep in-flight status in your plan. Loops never edit AGENTS.md or `docs/`.
- **Byte budgets** (`scripts/loops/doc-budget.config.mjs`): the core 8 KB, each `docs/agents/*.md` 15 KB, each `docs/domain/*.md` and `docs/layout.md` 10 KB. `pnpm check` warns (`pnpm docs:budget`). `pnpm prd land` refuses any branch (`--force` included) that makes an over-budget doc bigger than on `dev`: **trim at least what you fold in.**
- When a PRD is done, move its decisions into the area docs and mark the PRD done.

## Recovery

`pnpm prd down` before a planned restart, `pnpm prd recover` after a restart, crash or usage limit: the machinery is in [recovery](recovery.md).

- **Resuming as orchestrator:** reconcile _Status_ with git first, and **git wins**: the slice worktrees (dirty or clean), `slice/` branches ahead of `prd/<topic>`, the merges already in. Respawn each in-flight slice with no live agent (`pnpm prd prompt slice <topic> <n> --continue`). Review a slice handed off but not merged from its branch, spawning a `--continue` agent if you need its hand-off. Follow the recorded landing mode.

## Worktrees and leases

- `new.sh <kind>`: `prd <topic>` (`.loops/<topic>`, from `dev`, a stack), `slice <topic> <n>` (`.loops/<topic>-<n>`, from `prd/<topic>`, a stack only for `Stack: yes` or `--stack`), `plan <topic>` and `hotfix <name>` (stackless, from `dev`). Options: `--slot N`, `--stack`/`--no-stack`, `--base B`. An existing branch is checked out, resuming a removed worktree. Secrets come from the main checkout's env files.
- **Slots** (1–19) are lock directories in `.loops/.slots/<N>`, taken atomically; a slot is also busy while a `.env` names it or a port listens. Ports: [loop](loop.md#your-worktree-and-stack).
- **The shared test Postgres** (`pnpm prd test-db`, :5436, tmpfs, Compose project `caretook-shared-test`): a database per worktree, dropped by `rm.sh`; `test-db down` deletes them all. Older worktrees keep a `-test` container or switch with `test-db use`.
- `pnpm prd status` flags `merged:` slice worktrees and `stopped stack:`s (over `CARETOOK_GC_STOPPED_HOURS`, 24); `gc` removes them after a yes. **The disk guard** refuses a new stack or check build under `CARETOOK_MIN_FREE_GB` (10) free; `reclaim` frees merged worktrees, dangling volumes and images, check builds and Vite caches (never the main checkout's, a dirty worktree, or a running server's caches).
- `rm.sh <name>` removes the worktree, its stack, database files and slot, and deletes the branch if merged into its parent; it refuses uncommitted changes, or a PRD with slice worktrees left, unless `--force`.
- **Machine leases** (`lease.sh`, `lease.mjs`): `browser` 4, `check` 3, others 1 (`CARETOOK_<KIND>_SLOTS`), lock directories in `.loops/.lease/<kind>/<N>`, taken over from dead holders. Waits are bounded (`CARETOOK_<KIND>_WAIT`; browser 20 min, check 30) and give up with exit 75. `CARETOOK_LEASES=off` takes none. Holders of the old `.loops/.browser/<N>` path still count until every worktree has synced; then drop that counting.

## Rules across PRDs

- **Migrations take the next number when they land.** Plans say "adds a migration". A loop generates what's next on its base. When a sync brings another PRD's migration, keep `dev`'s, regenerate yours on top (`pnpm datastore:generate`) and reread its SQL order. One pending migration per PRD where you can.
- **Seeds are append-only:** `timelineEntries.ts` ids follow position, so append, or give a feature its own seed file and ids.
- **Registries are composed from area parts.** Add a route, URL, error, permission, table or procedure to your area's part (create it if missing): `routes/…/<area>/routes.ts`, `lib/<area>/urls.ts`, `errors/<area>.ts`, `permissions/<area>.ts`, `db/schema/<area>/`, `packages/api/src/<area>/`, and its rule in `scripts/loops/check-areas.d/<area>`. The top indexes change only for a new area; each composed result is frozen in a test listing its entries (`routes.test.ts`, `appUrls.test.ts`, `routerPaths.test.ts`, the schema's `index.test.ts`): add yours. Areas are the `docs/domain/` names plus `core` ([layout](../layout.md)).
- **Additive edits to the registries still shared:** the `services/`, `models/` and `seeds/` indexes, `sync-config.yaml`, the device schema, the `sync.ts` upload switch, `KIND_META` and `GROUP_SECTIONS`. Add at the end of the group; never reorder or reformat.
- **Hot files get regions first:** when two PRDs will change one screen (the backlog's PRD table lists hot files), a small slice first splits it into regions or components, and lands before both.
- Merges can break another slice's browser check with neither slice wrong; the landing checks catch it.
