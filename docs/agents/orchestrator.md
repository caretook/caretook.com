- **Waiting on another PRD:** ask its orchestrator (ListAgents, SendMessage) to message you when the work lands in `dev`, and set a background check on `pnpm log dev` or `pnpm backlog list`; then `pnpm prd sync --force`. **Unsure, or a choice past your topic:** ask the backlog session (SendMessage); it advises.
- **Run-through sessions never ask in the terminal:** `pnpm prd ask` (a question, or a report at each landing). A fresh Opus [skeptic](machinery.md#the-skeptic) reads each question first. A recommended one takes `--defaults` (the tool takes it after 30 minutes) or `--waits` ([never list](preferences.md#planning-and-slices)). Then a PushNotification with its line and `pnpm prd ask --wait <id>` in the background; carry on meanwhile. **Only a question's line is pushed.**

## Branches and protection

- `main` (live) and `staging` change only by PR merge on GitHub (`staging` from an `rc/*` candidate, `main` from `staging`). `dev` takes landings, `pnpm backlog` commits and small direct changes; `prd/<topic>` its slices' merges and `dev` syncs; the other branches their session's commits.
- **Hooks** (`.githooks/`; `pnpm hooks:install` sets `core.hooksPath` for every worktree, and `new.sh` runs it): on `main` and `staging`, no commits, merges or pushes, and no local moves but a fast-forward to `origin`'s copy (`git fetch && git branch -f main origin/main`). The dev keeper overrides with `CARETOOK_ALLOW_PROTECTED=1` (the hook says so); agents never set it. `dev` isn't restricted. `commit-msg` checks Conventional Commits on every branch.
- `pnpm prd sync`, `pnpm prd land` and `pnpm backlog` write their own commit subjects; backlog writes don't push `dev`.

## Running a wave

At every wave boundary: `pnpm backlog ingest`, `doctor` and `list`; propose new items for your topic ([backlog](backlog.md)). A new item becomes a slice in a later wave; a running slice never changes scope.

1. A slice is **ready** when every slice it's blocked by is merged into `prd/<topic>`. Start only what the user (or the landing mode) allows, and `claim` its items.
2. `pnpm prd slice <topic> <n>` for each.
3. Spawn one background agent per slice (not `isolation: worktree`: it is one) with `pnpm prd prompt slice <topic> <n>`, plus anything it needs that the plan doesn't say.
4. On each hand-off, mark it, then review: `git diff prd/<topic>...slice/<topic>/<n>`, the hand-off, the acceptance criteria.
5. Merge **in plan order** in your worktree: `git merge --no-ff -m "feat(<topic>): <what it adds> (slice <n>, B-<n>)" slice/<topic>/<n>`. Resolve shared-file conflicts yourself. No local quick check: the wave's run is the gate.
6. Record the merge SHA, `pnpm backlog done B-<n>`; start what it unblocked. **The slice keeps its worktree and branch** until the wave's verdict is green; `pnpm prd rm <topic>-<n>` then.
7. **The wave's run:** `pnpm prd ci run <tier> --wait` in the background, at the [proposed tier](#the-check-gate) unless you have a reason. On `file` or `brake`, `pnpm prd ci blame` (0 all dev's, 2 some the branch's, 5 unknown), then SendMessage each of the branch's failures to its slice's agent, with the tests and the run link. A failure no one slice explains gets a fresh fix agent in that slice's worktree. After its fix (`prd doc loop`), merge it again.
8. **No rotation while a run is out or a fix is in flight** (`rotate` refuses only the run; the fix is on you). **Land the wave** when it's green; don't wait for the whole PRD.

- **Stalls:** `pnpm prd watch <topic> --wait` runs in the background through a wave (rerun on exit); `--mark <n>` before acting. `nudge`: SendMessage (`replied` on an answer). `restart` (once): TaskStop, wait for `stopped`, then a `--continue` agent in that worktree. `skeptic`: a fresh Opus on `prompt skeptic stall`, recorded `--kind stall --slice <n>` (`--waits`, never list: only ask); then restart, `left` or `asked`.

## Landing a wave

1. **Sync and check** in your worktree: `pnpm prd sync` (`--force` if land refuses; resolve conflicts; regenerate a migration if `dev` gained one; `datastore:reset`), `pnpm prd serve --restart`, then the browser checks: a wave that changes screens or flows runs `caffeinate -i pnpm prd browser --suite` (**the lean set, once**) plus, by name, any `e2e no` check `pnpm prd browser --changed --base dev --list` names; any other wave only `pnpm prd browser --changed --base dev`. Then the recheck on the synced tip at the tier `pnpm prd ci gate prd/<topic> --tier <t> --base dev --peek` names (none for docs and tooling).
2. **Open the PR** as soon as it's green: `pnpm prd pr <topic>` (pushes `dev` fast-forward only, then the branch; opens or updates the PR into `dev`). Rerun it after every push.
3. **Report:** show the user `pnpm prd ready` (the link, seed accounts, items, commits, warnings, the PR and Codex's verdict), the checks you ran and two or three things to try by hand. Fix any blockers first.
4. **Codex review, while the user tries it:** `pnpm prd review <topic> --wait` in the background (exits: 0 clean, 1 findings, 2 waiting or stale, 3 no PR, 4 out of credits, 75 timeout). Verify each finding, then **push it off to the backlog**: a real one becomes an item (`pnpm backlog add bug … --prd <topic> --status triaged --note …`) or a `note` on one; only a critical, breaking one goes to a fix agent. Before declining one, run a land skeptic (`--action "decline <thread>"`): quote its `go` in the reply; a `no` makes it an item. **Reply on every thread** (`Tracked as B-<n>: …`, the fixing commit, or why you decline), `--resolve <threadId>` each, then `--again`. After about three rounds, or a 75, ask the user. **Out of credits** (exit 4): land with `--no-review` as the landing mode allows, unasked, and say so in the report. **A clean verdict carries over a dev sync** when every commit since is a plain merge of `dev`, the PR's diff is unchanged, and `dev` changed none of its files; else it's stale, and the line says why.
5. **Wait for the user.** Changes go back to a loop, then repeat from step 1.
6. **Land on their word only:** `pnpm prd land <topic> --tier <t> -m "feat(<topic>): <what the wave adds> (B-<n>, …)"`. On top of the sync and doc-budget refusals, it needs the PR open with the local tip as its head and a clean verdict, carried or not (none for a Markdown-only `prd/` diff, so don't run `review`; `--no-review` skips it), then [the gate](#the-check-gate). It merges on GitHub pinned to that head, then dev-syncs the main checkout. If `dev` moved only in other files, it typechecks the merge and lands unsynced ([machinery](machinery.md#landing-reports)). `--local` is the fallback, on the user's word: no PR or Codex, the same gate. Plan branches merge locally, with no gate. A code landing writes a [`to-test/` file](machinery.md#landing-reports).
7. **Fold the docs** (below); land's notice tells other orchestrators to sync at their next wave boundary. Then drain and rotate (above).

- A go-ahead covers one landing, unless the landing mode covers more. Never land on your own judgement, never another PRD.
- **`--force` and `--no-review`** need a fresh Fable land skeptic's `go` for this tip and action (`--skeptic <id>`, in the report for a veto) or the user's word (`--by-user`). A `no`: fix it or ask. On a brake or an unsynced tip, `--force` needs `--by-user`.
- **Staging takes a candidate:** `pnpm prd ci candidate cut`, then `pnpm prd ci promote` (refuses a failing tip). Agents merge one no other way; the user's hand merge is the override. **Main:** only `pnpm prd ci release` writes `release-gate`.

### The check gate

`pnpm prd land` waits for a **CI verdict of its declared tier** (`ci.mjs gate`, `gate.mjs`), after every other refusal, and requests the run when there is none (30 minutes; a timeout refuses).

- **The tier:** `--tier <t>` (`pr` takes it too); the default is the minimum `check-plan.mjs` proposes. `full`: a migration, seeds, `sync-config.yaml`, the lockfile, a `package.json` beyond `scripts`, the Vitest config, the workflow, `scripts/ci/`, or a file no rule covers. `components`: `apps/`. `integration`: `packages/`, the browser harness. `none`: Markdown and tooling (still run `pnpm test:tooling`). Below the proposal needs `--why "<reason>"`, named in the PR and the report. `--tier none` over a real proposal is refused even with `--why`; only `--force` skips the gate.
- **What counts:** a whole-tier verdict that ran this tier or higher, on the tip or on a first-parent ancestor with only docs, tooling or CI's two lists changed since. Never a narrowed run. A browser-harness change or a scripts-only `package.json` commit doesn't keep a verdict.
- **Behind a dev sync:** a recheck newer than it at the tier of what dev brought (`syncTier`: the harness counts as tooling unless the branch touched it), carrying the pre-sync one if it lands without blame; both runs' flakes are filed. Bringing the wave's tier or more needs it.
- **How each kind lands:** a flake in a file the branch touched refuses, whatever the kind. `green` lands. `flake` lands, filed after the merge. `file` and `brake` go through blame against dev's tip, which files dev's failures even if the landing is then refused: they land only when every failure is dev's and filed, and a dev brake needs `--fixes B-<n>` naming its item. The branch's failures refuse, named; `infra` and unknown refuse with how to retry. `time` refuses, exit 6, unblamed.

### Docs at landing

- Fold the wave's lasting decisions into the matching area doc (add a doc and an _Area index_ entry for a new area), process changes into the role doc, and only rules every session needs into AGENTS.md. Keep in-flight status in your plan. Loops never edit AGENTS.md or `docs/`.
- **Byte budgets** (`scripts/project/doc-budget.config.mjs`): the core 8 KB, each role 15 KB (a split one's two halves share it), each `docs/domain/*.md` and `docs/layout.md` 10 KB. `pnpm check` warns (`pnpm docs:budget`). `pnpm prd land` refuses any branch (`--force` included) that makes an over-budget doc bigger than on `dev`: **trim at least what you fold in.**
- When a PRD is done, move its decisions to the area docs and mark it done.

## Rules across PRDs

- **Migrations take the next number when they land.** Plans say "adds a migration". A loop generates what's next on its base. When a sync brings another PRD's migration, keep `dev`'s, regenerate yours on top (`pnpm datastore:generate`) and reread its SQL order. One pending migration per PRD where you can.
- **Seeds are append-only:** `timelineEntries.ts` ids follow position, so append, or give a feature its own seed file and ids.
- **Registries are composed from area parts.** Add a route, URL, error, permission, table or procedure to your area's part (create it if missing): `routes/…/<area>/routes.ts`, `lib/<area>/urls.ts`, `errors/<area>.ts`, `permissions/<area>.ts`, `db/schema/<area>/`, `packages/api/src/<area>/`, and its rule in `scripts/loops/check-areas.d/<area>`. The top indexes change only for a new area; no test lists the entries. Areas are the `docs/domain/` names plus `core` ([layout](../layout.md)).
- **Additive edits to the registries still shared:** the `services/`, `models/` and `seeds/` indexes, `sync-config.yaml`, the device schema, the `sync.ts` upload switch, `KIND_META` and `GROUP_SECTIONS`. Add at the end of the group; never reorder or reformat.
- **Hot files get regions first:** when two PRDs will change one screen (the backlog's PRD table lists hot files), a small slice first splits it into regions or components, and lands before both.
