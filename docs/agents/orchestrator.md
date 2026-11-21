# Orchestrator handbook

For a PRD orchestrator: a top-level session (spawned agents can't spawn more), one per PRD, opened by the user in the integration worktree `.loops/<topic>` on `prd/<topic>`, where the user steers that PRD. It reads `dev`, never works in the main checkout, and runs loops ([loop](loop.md)). **At most three PRDs run at once** (`CARETOOK_MAX_PRDS`). Also here: the [rules across PRDs](#rules-across-prds) every slice follows. Hotfixes have [their own doc](hotfix.md). [orchestration](../orchestration.md) is the human guide.

## Branches and protection

- `main` (live) and `staging` change only by PR merge on GitHub (`staging` from `dev`, `main` from `staging`). `dev` takes landings, `pnpm backlog` commits and small direct changes. `prd/<topic>` takes its slices' merges and `dev` syncs; `slice/<topic>/<n>` its loop's commits; `plan/<topic>` (docs) and `hotfix/<name>` their session's commits; all three land in `dev` like a PRD.
- **Hooks** (`.githooks/`; `pnpm hooks:install` sets `core.hooksPath` for every worktree, and `new.sh` runs it): on `main` and `staging`, no commits, merges or pushes, and no local moves but a fast-forward to `origin`'s copy (`git fetch && git branch -f main origin/main`). The dev keeper overrides with `CARETOOK_ALLOW_PROTECTED=1` (the hook says so); agents never set it. `dev` isn't restricted. `commit-msg` checks Conventional Commits on every branch (`--no-verify` skips one). GitHub rulesets come once `gh` can see the repo.
- `pnpm prd sync`, `pnpm prd land` and `pnpm backlog` write their own commit subjects. `pr` and `land` push `dev` (fast-forward only); backlog writes don't. Tool tests against GitHub use `throwaway/*` branches and `CARETOOK_PR_THROWAWAY=1`, closed unmerged.

## Commands

`pnpm prd <command>` (`scripts/loops/prd.sh`, from any worktree) is the one front door; `pnpm prd help` lists every command, and each script's header has the details. `pnpm prd prompt orchestrator|plan|slice|hotfix|backlog|recover …` prints a session's first prompt (`orchestrator <topic> --auto` run-through, `--resume`; `slice <topic> <n> --continue`).

## Starting and steering

- **Starting (the user):** `pnpm prd start <topic>`, then the command it prints in a new terminal (`cd .loops/<topic> && claude --remote-control prd-<topic> "$(scripts/loops/prompt.sh orchestrator <topic>)"`).
- **The landing mode:** unless _Status_ records one, ask first: before each landing, run everything through (start every ready slice, land each green wave, clean up, ask only real questions), or land chosen waves or slices automatically. Record it in _Status_.
- **Queueing (the user):** `pnpm prd queue <topic>`, left running in its terminal, waits for fewer than `CARETOOK_MAX_PRDS` PRD worktrees (in queue order: tickets in `.loops/.queue/`, one lock in `.loops/.prd-start.lock`), then opens the orchestrator in run-through mode (`--manual` for the asking prompt). Queueing is the go-ahead for every landing of that PRD.
- **Waiting on another PRD:** ask its orchestrator (ListAgents, SendMessage) to message you when the work lands in `dev`, and set a background check that exits when `pnpm log dev` or `pnpm backlog list` shows it; then sync and carry on.
- **Keep your context small.** Work from _Status_, the backlog, hand-offs, `git diff --stat` and check output. Don't read whole diffs or debug inside a loop: send the problem back to its agent with SendMessage.
- **One session per wave: drain, then rotate.** After a landing (not the last) and its docs, start no new slice; once the slices in flight are merged, commit _Status_ and `pnpm prd rotate` (at once with none in flight): a fresh session with the same name opens from _Status_ in a background tab and the old one is ended. `--mid-wave` only on the user's word. After the last landing: `pnpm prd rm <topic>` (it sets the registry's `done`, except for a `standing` topic), then `cd` to the main checkout and `pnpm prd end`.
- **Run-through sessions never ask in the terminal:** `pnpm prd ask` (a question, or a report at each landing), then a PushNotification with the line it prints, then `pnpm prd ask --wait <id>` in the background; carry on with what doesn't depend on it.
- **Update _Status_ at every step:** a slice started (worktree made, agent spawned), handed off, merged (with the SHA), a wave landed; plus what's ready, open issues and the landing mode. Write it as you go, and commit it with your merges and before `pnpm prd check`, so a fresh orchestrator loses nothing.
- **Capacity:** the limits are CPU and attention (a stack idles at about 250 MB); three PRDs with two or three slices each is about 12 slots. Every check is `pnpm prd check`, in one of two check leases. Each run appends a line to `.loops/.check-times.log` (mode, reason, seconds, load, exit, test files); `pnpm prd check --times [--since <date>]` summarises it. No load gate: the log is the evidence for one. Under heavy load tests and sign-ins time out: rerun once it drops before debugging.

## Models

**Coding goes to opus (Opus 5.5) or stronger, never below:** any slice or fix with real logic (a table or permission, sync, state, new UX, a refactor, a bug whose cause isn't known, a Codex fix). A weaker model there is slower and worse, not cheaper. When unsure whether a slice is mechanical, it isn't: use opus. Give helpers a tight brief asking for a short answer, and note each slice's model in _Status_. **haiku:** reading long check output (report failures, ■ lines, the table), searches and summaries (sonnet when it needs judgement), backlog chores and triage proposals. **sonnet:** only a slice with no logic to work out (a rename, moving files or checks, an edit the plan spells out line by line). **You:** reviewing hand-offs, conflicts, choosing the check, landing, talking with the user. Redo a thin or wrong result on a stronger model rather than patching it.

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
2. **Open the PR** as soon as it's green: `pnpm prd pr <topic>` (pushes `dev` fast-forward only, then the branch; opens or updates the PR into `dev`). Rerun it after every push.
3. **Report:** show the user `pnpm prd ready` (the link and seed accounts, items addressed, what's open, commits, migration/seed/sync-config/dependency warnings, the PR and Codex's verdict), the checks you ran and two or three things to try by hand. Fix any blockers first.
4. **Codex review, while the user tries it:** `pnpm prd review <topic> --wait` in the background (exit 0 clean, 1 findings, 2 waiting or stale, 75 timed out, 3 no PR). Verify each finding, then **push it off to the backlog**: a real one becomes an item (`pnpm backlog add bug … --prd <topic> --status triaged --note …`, or a `note` on the item that already covers it) and only a critical, breaking one goes to a fix agent now. **Reply on every thread** before resolving it: the backlog id with its title (`Tracked as B-<n>: …`), the fixing commit, or why you decline. Codex never resolves its own threads, so `--resolve <threadId>` each answered one, then `--again`. After about three rounds, or a 75, ask the user.
5. **Wait for the user.** Changes go back to a loop, then repeat from step 1.
6. **Land on their word only:** `pnpm prd land <topic> -m "feat(<topic>): <what the wave adds> (B-<n>, …)"`. On top of the sync, check-gate and doc-budget refusals, it needs the PR open with the local tip as its head and a clean verdict (none for a Markdown-only `prd/` diff, so don't run `review`; `--no-review` skips it, on the user's word only). It merges on GitHub pinned to that head, deletes the remote branch, then dev-syncs the main checkout (reruns as `pnpm prd dev-sync`) and prints what it needs next (`pnpm datastore:reset`, a PowerSync restart, `pnpm install`). `--local` is the fallback, on the user's word. Hotfixes: `--pr` or `--local`, asked each time; plan branches merge locally. A code landing also writes a [`to-test/` file](machinery.md#landing-reports); the run-through report names it.
7. **Fold the docs** (below), then tell other orchestrators to `pnpm prd sync` at their next wave boundary, never mid-wave. Then drain and rotate (above).

- A go-ahead covers one landing, unless the landing mode or a queue covers more. Never land on your own judgement, never `--force` unless the user says so, never another PRD.
- **Run each browser check once:** never rerun one that passed, never `--suite` twice for a landing. This overrides any plan that asks for checks after each merge.
- **The backstop:** the dev keeper runs `pnpm prd browser --suite` on `dev` on a quiet machine before opening the PR to `staging`.

### The check gate

`pnpm prd land` and `ready` accept a tip on one of these, and say which (`lib.sh`, `checked_ok`, `checked_how`):

- **None needed:** everything `dev...<tip>` changes is Markdown, `scripts/loops/`, `scripts/backlog/` or `.githooks/`; later commits of only those also keep an earlier pass. Still run `pnpm test:tooling`.
- **Full:** `pnpm prd check` (`pnpm check`, then `pnpm build:budget`: the entry and `/app` shell chunk ceilings in `scripts/build/budget.json`) passed on the tip.
- **Quick:** `pnpm prd check --quick "<why>"` passed on the tip: typecheck, lint, format, the tests related to the diff since the last full pass, the always-run list (tests that read files by path), the check-areas lint and the docs budget; it prints how many test files it ran and warns above half. The reason is shown at landing.

The plan is `check-plan.mjs` (pure, tested): a quick check on a diff touching a migration, seeds, `sync-config.yaml`, the lockfile, a `package.json` or `vitest.config.ts` runs full and records `full`; `pnpm test:tooling` joins either when the diff touches the tooling. Loops hand off on quick; **wave gates are quick, and the full check runs once per landing**, on the wave's tip before its PR.

Quick is enough on top of a full pass for a conflict-free `pnpm prd sync` whose sides share no file, or a hotfix. Run full when a conflict was resolved in code, when both sides changed a shared registry or hot file, or when unsure. Quick passes keep the last full pass as their base.

### Docs at landing

- Fold the wave's lasting decisions into the matching area doc (add a doc and an _Area index_ entry for a new area), process changes into the role doc, and only rules every session needs into AGENTS.md. Keep in-flight status in your plan. Loops never edit AGENTS.md or `docs/`.
- **Byte budgets** (`scripts/loops/doc-budget.config.mjs`): the core 8 KB, each `docs/agents/*.md` 15 KB, each `docs/domain/*.md` and `docs/layout.md` 10 KB. `pnpm check` warns (`pnpm docs:budget`). `pnpm prd land` refuses any branch (`--force` included) that makes an over-budget doc bigger than on `dev`: **trim at least what you fold in.**
- When a PRD is done, move its decisions into the area docs and mark the PRD done.

## Recovery

`pnpm prd down` before a planned restart, `pnpm prd recover` after a restart, crash or usage limit: the machinery is in [recovery](recovery.md).

- **Resuming as orchestrator:** reconcile _Status_ with git first, and **git wins**: the slice worktrees (dirty or clean), `slice/` branches ahead of `prd/<topic>`, the merges already in. Respawn each in-flight slice with no live agent (`pnpm prd prompt slice <topic> <n> --continue`). Review a slice handed off but not merged from its branch, spawning a `--continue` agent if you need its hand-off. Follow the recorded landing mode.

## Worktrees, leases, sessions and asks

The machinery (worktrees, slots, the shared test Postgres, leases, recorded sessions, the asks queue) is in [machinery](machinery.md).

## Rules across PRDs

- **Migrations take the next number when they land.** Plans say "adds a migration". A loop generates what's next on its base. When a sync brings another PRD's migration, keep `dev`'s, regenerate yours on top (`pnpm datastore:generate`) and reread its SQL order. One pending migration per PRD where you can.
- **Seeds are append-only:** `timelineEntries.ts` ids follow position, so append, or give a feature its own seed file and ids.
- **Registries are composed from area parts.** Add a route, URL, error, permission, table or procedure to your area's part (create it if missing): `routes/…/<area>/routes.ts`, `lib/<area>/urls.ts`, `errors/<area>.ts`, `permissions/<area>.ts`, `db/schema/<area>/`, `packages/api/src/<area>/`, and its rule in `scripts/loops/check-areas.d/<area>`. The top indexes change only for a new area; each composed result is frozen in a test listing its entries (`routes.test.ts`, `appUrls.test.ts`, `routerPaths.test.ts`, the schema's `index.test.ts`): add yours. Areas are the `docs/domain/` names plus `core` ([layout](../layout.md)).
- **Additive edits to the registries still shared:** the `services/`, `models/` and `seeds/` indexes, `sync-config.yaml`, the device schema, the `sync.ts` upload switch, `KIND_META` and `GROUP_SECTIONS`. Add at the end of the group; never reorder or reformat.
- **Hot files get regions first:** when two PRDs will change one screen (the backlog's PRD table lists hot files), a small slice first splits it into regions or components, and lands before both.
