# How work gets done

A guide for the **dev keeper** (you): how ideas become shipped work, and how several pieces of work run in parallel without stepping on each other. Agents follow the detailed rules in [AGENTS.md](../AGENTS.md) and the role docs in [`agents/`](agents/); this page is the human view of the same system.

**Where agents read the rules.** AGENTS.md is a short core (working rules, branches, the stack and architecture rules, and an _Area index_) that every session loads. The rest lives in docs it points to: [`agents/`](agents/) has a handbook per role (the _Area index_ lists them), which each agent's prompt names, and [`domain/`](domain/) has one doc per area (timeline, medications, sync, …). Each slice in a plan says which docs its agent reads (`Reads`), whether it needs a Docker stack (`Stack`) and what it tests (`Tests`), so a medications slice reads the medications doc and nothing else. When a wave lands, its orchestrator folds what it decided into the matching doc.

## The short version

1. **Write an idea down** in [`plans/inbox.md`](../plans/inbox.md).
2. **An agent files it** into the tracker, [`plans/backlog.md`](../plans/backlog.md), and proposes which PRD it belongs to. You review that.
3. **Bigger things get a PRD** (what and why) and a **plan** (cut into slices).
4. **You start a PRD** with `pnpm prd start <topic>` and open its orchestrator. From then on you steer it by talking to it: "run slices 5 and 7".
5. **When a wave is ready, the orchestrator gives you a link and a list**: a running dev server to try, and the bugs, features and changes it addresses.
6. **You say "land it"**, and it merges into `dev`. From there work goes to `staging` and `main` by pull request.

Day to day you need three commands, and the orchestrator runs the rest:

```sh
pnpm prd status          # what's running, with links
pnpm prd start <topic>   # start (or reopen) a PRD
pnpm prd ready <topic>   # is it ready to land? what's in it?
```

## Small changes: skip all of this

Not everything needs a PRD. For a small change (a docs or tooling tweak, a config change, a contained fix), open an agent in the main checkout, ask for it, and have it commit straight onto `dev`. Use a PRD when the work needs its own database and dev server, runs in parallel with other work, or adds a migration. An agent that can't tell which a request is will ask you.

To keep a small fix off `dev` until you've seen it, ask for a **hotfix**: `pnpm prd hotfix <name>` makes a stackless worktree on `hotfix/<name>`; the agent asks before each long test, commit and sync, and you land it with `pnpm prd land hotfix/<name> --pr` (reviewed) or `--local` ([hotfix](agents/hotfix.md)). Or start one with `pnpm prd hotfix <name> --open "<the fix>"`.

## Branches

```
main            live                     changes only by PR from staging
staging         what goes live next      changes only by PR from dev
dev             where work lands         PRD branches land here when you say so; the backlog tool commits here
  prd/<topic>         one PRD             its orchestrator merges slices in
    slice/<topic>/<n>   one slice         one agent's work
  plan/<topic>        writing a PRD       docs only; lands in dev like a PRD
```

- Your main checkout (`/Users/bo/git/caretook/caretook.com`) **always stays on `dev`**. Nothing else works in it.
- **Git hooks** enforce this (`pnpm hooks:install` turns them on, once per clone):
  - `main` and `staging` refuse commits, merges and pushes. Updating your local copy to what GitHub has is fine: `git fetch && git branch -f main origin/main`.
  - `dev` isn't restricted. PRD branches land there, the backlog tool commits there, and small changes can be made on it directly (above).
  - Every commit message, on every branch, must be a [Conventional Commit](#commit-messages).
  - To override the `main` and `staging` rules, put `CARETOOK_ALLOW_PROTECTED=1` in front of the command. The hook says when it was used. Agents never do this.

## The inbox and the tracker

### `plans/inbox.md`: yours

Write one line per idea, under the heading that fits:

```markdown
## Bugs

- The timeline jumps when I scroll
  It happens on my phone, in cards view. ← indent extra lines for detail
```

Headings set the item's type: **Bugs**, **Change requests**, **Feature requests**, **Big plans**, **Questions** (anything else counts as a feature). Save the file; that's all.

When an agent files a line, it adds the item's id to the end: `- The timeline jumps when I scroll (B-23)`. That's the only change agents make to your file. To change or drop something already filed, add a new line saying so.

### `plans/backlog.md`: the tracker

Agents keep it; you review it. Each item has:

- an **id** (`B-<n>`) and a **type**;
- a **status**: inbox (new) → triaged (a PRD proposed: check it) → in-progress (an orchestrator claimed it) → ready (done in its PRD branch) → landed (in `dev`) → staging → live, or dropped. From "ready" on, the status is worked out from git, so nobody updates it by hand;
- the **PRD** it belongs to, its **owner** (the branch working on it) and **notes**.

The **summary table** at the top is the quickest review. The **PRD table** lists every PRD, what it depends on and which files it touches, which decides what can run at the same time.

### Commands

Run these from the repo root (any worktree works):

| Command                                           | What it does                                                   |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `pnpm backlog inbox`                              | inbox lines not filed yet                                      |
| `pnpm backlog ingest`                             | file them (orchestrators also do this before every wave)       |
| `pnpm backlog list`                               | open items; `--all`, `--prd <topic>`, `--status <s>` to filter |
| `pnpm backlog show B-12`                          | one item, with its notes                                       |
| `pnpm backlog set B-12 prd=search status=triaged` | change a field (also `title=`, `type=`, `status=dropped`)      |
| `pnpm backlog note B-12 "text"`                   | add a dated note                                               |
| `pnpm backlog commit "message"`                   | commit your hand edits to either file                          |

Every change is committed straight onto `dev` (only those two files), so every session sees the current list at once. You can also edit `backlog.md` by hand and run `pnpm backlog commit`.

## Running PRDs in parallel

### Starting a PRD

1. A PRD needs a written PRD and plan first. Not sure which? `pnpm prd plan` with no topic opens a backlog session that reads the inbox and backlog and helps you choose. Then run `pnpm prd plan <topic> --open` (add the backlog ids it covers, e.g. `B-52 B-53`): it makes a docs-only worktree and starts a planning agent there that asks only what's costly to undo, then writes and lands the PRD and plan. Planning, backlog and hotfix sessions run on opus (the planner's final skeptic on Fable); `--model <name>` runs one on another model.
2. `pnpm prd start <topic>` creates the PRD's worktree and stack, and prints a command.
3. Open a **new terminal** and run that command. It starts the orchestrator session with the right first prompt:

   ```sh
   cd .loops/<topic> && claude --remote-control prd-<topic> "$(scripts/loops/prompt.sh orchestrator <topic>)"
   ```

4. The orchestrator summarises the plan and the backlog, then asks how to land (before each landing, run everything through, or automatically for the waves or slices you pick) and which slices to run. If a session gets slow or confused, close it and rerun the same command (`pnpm prd start <topic>` reprints it). It picks up from the plan's _Status_ section, which the orchestrator updates at every step (a slice started, handed off or merged, a wave landed), so nothing is lost whenever it stops.

**At most four PRDs run at once.** `pnpm prd start` refuses a fifth (raise `CARETOOK_MAX_PRDS` to override).

**The dispatcher:** `pnpm prd dispatch` plans and starts topics in the PRD table's order as slots free up, never two that share hot files, waits on a busy machine, and reopens sessions that die. `pnpm prd queue <topic>` moves a topic first; a row's `hold` flag or `pnpm prd dispatch --pause` holds it back, `--dry-run` shows why each topic waits. Its orchestrators land each wave without asking; their questions and reports wait in `pnpm prd asks` (answer with `pnpm prd answer <id> <n>`, [machinery](agents/machinery.md#the-dispatcher)); a recommended one may default in 30 minutes; `pnpm prd notices` lists heads-ups. `CARETOOK_UNSYNCED=off` stops unsynced landings.

### After a restart, a crash or a usage limit

Orchestrators and their slice agents stop when the machine restarts or a session dies, and sit idle after a usage limit. Each worktree keeps its work (commits and uncommitted changes), and each plan's _Status_ says where its orchestrator was, step by step. **The easy way:** before a planned restart, run `pnpm prd down` (it remembers what was running and stops it cleanly). Afterwards, run `pnpm prd recover` in a terminal: it starts Docker, clears stale locks, brings the stacks and dev servers back, then opens a recovery agent that tells every live orchestrator to carry on and reopens the rest in new iTerm2 tabs. After a usage limit, `pnpm prd recover --at 14:00` or `--wait` waits until you can work again, then does the same. `pnpm prd recover --dry-run` shows what it would do, and `pnpm prd reclaim` frees disk when new stacks are refused for low space.

To pick a PRD up again by hand, in a new terminal:

```sh
# its last conversation, if it had one
cd .loops/<topic> && claude --continue --remote-control prd-<topic>
# or a fresh orchestrator told it's taking over (add --auto for a queued or run-through PRD)
cd .loops/<topic> && claude --remote-control prd-<topic> "$(scripts/loops/prompt.sh orchestrator <topic> --resume)"
```

A resumed orchestrator first checks its _Status_ against git (the slice worktrees and branches, and what's already merged), trusting git where they differ. It then restarts one agent per unfinished slice, told to continue from what's in its worktree rather than start over (a slice that had finished just writes its hand-off again), reviews any slice that was handed off but not merged, and carries on in the landing mode you chose before. You don't need to repeat your answers.

### What runs where

Every PRD and every slice gets its own **worktree** in `.loops/` (a separate checkout of its branch), and most get their own **stack**: a private Postgres, test Postgres, PowerSync and dev server on their own ports. So agents reset databases and run browser checks without touching yours.

`pnpm prd status` lists them all, with each one's dev server link and whether it's running. `pnpm prd serve <name>` starts one; `--stop` stops it.

### Ready to land: try it first

When a wave's slices are merged and green, the orchestrator syncs with `dev`, reruns the checks, restarts the PRD's dev server and shows you a report. You can ask for it yourself at any time with `pnpm prd ready <topic>`:

```
# prd/app-shell is ready to land

## Try it
- http://localhost:6273 (running)
- Sign in as member@example.com … the password is SEED_USER_PASSWORD

## What it addresses
Bugs fixed / Features / Changes: the backlog items done in this branch
Still open in this PRD: the items this landing doesn't finish

## What changed
The commits, and warnings if it adds a migration, changes seeds, the sync config or dependencies
```

If something isn't ready (not synced with `dev`, checks not passed on the latest commit, uncommitted work), the report says so instead.

Open the link, try it, and then tell the orchestrator one of:

- **"land it"**: it runs `pnpm prd land <topic>`, which merges the wave's GitHub PR into `dev` and updates your main checkout. The PR opens once the wave is green, so Codex reviews it while you try it (about three rounds, then the orchestrator asks you). It refuses unless the branch is synced and checked, the PR's head is that tip and the review is clean (`--no-review` on your word), so what lands is what you tried. It tells you if your main checkout then needs `pnpm datastore:reset` or `pnpm install`.
- **what to change**: it sends the work back to a slice agent and comes back with a new report.

You can also land it yourself from any terminal: `pnpm prd land <topic>`. `pr` and `land` push `dev` (fast-forward only). A hotfix asks "PR or local?".

Land one PRD at a time. The others sync with `dev` at their next wave.

When a whole PRD is done: `pnpm prd rm <topic>` removes its worktree, stack and dev server, and deletes its branch once it's merged.

### Going live

`staging` takes a release candidate: `pnpm prd ci candidate cut --wait` fixes a `dev` commit on an `rc/*` branch, opens its PR and runs the whole suite and the browser checks in CI; `pnpm prd ci promote` merges it only if that run passes. Merging the PR by hand on GitHub is your override. Then open the pull request `staging` → `main`. The tracker then shows the items as staging, then live (`pnpm backlog refresh` writes those statuses into the file).

## Commit messages

Every commit follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `<type>(<scope>): <description>`. A git hook refuses anything else, merges included.

```
feat(app-shell): group settings page (B-9)
fix(sign-in): one request on a double click (B-1)
docs(timeline-polish): the PRD and plan
chore(app-shell): merge dev into prd/app-shell
```

- **Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `style`, `build`, `ci`, `chore`, `revert`.
- **Scope** (optional): the PRD topic, or the area. Backlog ids go at the end, in parentheses.
- **Breaking change:** `feat(api)!: …`, with a `BREAKING CHANGE:` footer.
- The tools write their own: `pnpm backlog` commits as `chore(backlog): …`, `pnpm prd sync` as `chore(<topic>): merge dev …`, and `pnpm prd land` takes `-m "feat(<topic>): …"` (or writes a default).

## Commands at a glance

| Command                           | What it's for                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm prd status`                 | every worktree and session: kind, context size (`pnpm prd context`), server link   |
| `pnpm prd status-watch [seconds]` | the same, redrawn every few seconds (default 5) until Ctrl-C                       |
| `pnpm prd start <topic>`          | create or reopen a PRD's worktree; prints the orchestrator command                 |
| `pnpm prd queue <topic>`          | wait for a free slot, then open a run-through orchestrator in this terminal        |
| `pnpm prd plan <topic> --open`    | a docs-only worktree and a planning session that writes and lands the PRD and plan |
| `pnpm prd plan`                   | a backlog and inbox session in the main checkout; say "hand off" for a fresh one   |
| `pnpm prd inbox`                  | a bare session outside the repo that only adds and edits inbox lines               |
| `pnpm prd serve [name]`           | run a worktree's dev server (`--restart`, `--stop`)                                |
| `pnpm prd ready [topic]`          | the ready-to-land report                                                           |
| `pnpm prd land <topic>`           | merge the PRD's branch into `dev`                                                  |
| `pnpm prd rm <name>`              | remove a worktree, its stack and (if merged) its branch                            |
| `pnpm prd slice`, `check`, `sync` | what orchestrators run: a slice's worktree, record a passing check, merge `dev` in |
| `pnpm backlog …`                  | the inbox and tracker (above)                                                      |
| `pnpm hooks:install`              | turn on the git hooks (once per clone)                                             |

`pnpm prd help` prints the full list. The scripts behind it are in `scripts/loops/`.

## When something's off

- **"backlog is locked"**: another session is writing the backlog. Try again in a moment. A lock left by a crashed run clears itself after 30 seconds.
- **"the main checkout is on …, not dev"**: the backlog tool only writes while your main checkout is on `dev`. Switch back with `git switch dev`.
- **"the commit subject isn't a Conventional Commit"**: reword it as `type(scope): description` (see [Commit messages](#commit-messages)).
- **"dev has moved since prd/… last synced"** when landing: another PRD landed first. The orchestrator syncs and checks again ([the check gate](agents/orchestrator.md#the-check-gate)).
- **"pnpm check hasn't passed on …'s tip"**: something was committed after the last check. Ask the orchestrator to check again; docs and tooling-only commits never trip this.
- **A stale slot** in `pnpm prd status` output: a worktree was deleted by hand. Remove the lease directory it names.
