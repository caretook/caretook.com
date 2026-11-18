# How work gets done

A guide for the **dev keeper** (you): how ideas become shipped work, and how several pieces of work run in parallel without stepping on each other. Agents follow the detailed rules in [AGENTS.md](../AGENTS.md) (_PRDs and parallel loops_); this page is the human view of the same system.

## The short version

1. **Write an idea down** in [`plans/inbox.md`](../plans/inbox.md).
2. **An agent files it** into the tracker, [`plans/backlog.md`](../plans/backlog.md), and proposes which PRD it belongs to. You review that.
3. **Bigger things get a PRD** (what and why) and a **plan** (cut into slices).
4. **You start an orchestrator** for a PRD. It runs one agent per slice, each in its own sandbox, and merges their work into the PRD's branch.
5. **When a wave of slices is ready, you merge it into `dev`.** From there it goes to `staging` and `main` by pull request.

## Branches

```
main            live                     changes only by PR from staging
staging         what goes live next      changes only by PR from dev
dev             where work lands         you merge PRD branches in; the backlog tool commits here
  prd/<topic>         one PRD             its orchestrator merges slices in
    slice/<topic>/<n>   one slice         one agent's work
  plan/<topic>        writing a PRD       docs only; lands in dev like a PRD
```

- Your main checkout (`/Users/bo/git/caretook/caretook.com`) **always stays on `dev`**. Nothing else works in it.
- **Git hooks** enforce this (`pnpm hooks:install` turns them on, once per clone):
  - `main` and `staging` refuse commits, merges and pushes. Updating your local copy to what GitHub has is fine: `git fetch && git branch -f main origin/main`.
  - `dev` accepts merges, and commits that touch only `plans/inbox.md` and `plans/backlog.md`.
  - To override any of it, put `CARETOOK_ALLOW_PROTECTED=1` in front of the command. The hook says when it was used. Agents never do this.

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

1. A PRD needs a written PRD and plan first. To write one, ask an agent to use `write-a-prd` and then `prd-to-plan` on a planning branch (`scripts/loops/new.sh plan <topic>`). It will interview you.
2. Create the PRD's worktree: `scripts/loops/new.sh prd <topic>`. It prints a command.
3. Open a **new terminal** and run that command. It starts the orchestrator session with the right first prompt:

   ```sh
   cd .loops/<topic> && claude "$(scripts/loops/prompt.sh orchestrator <topic>)"
   ```

4. The orchestrator summarises the plan and the backlog, and asks which slices to run. It runs one wave, then stops. Start a fresh session for the next wave.

**At most three PRDs run at once.** `new.sh` refuses a fourth (raise `CARETOOK_MAX_PRDS` to override).

### What runs where

Every PRD and every slice gets its own **worktree** in `.loops/` (a separate checkout of its branch), and most get their own **stack**: a private Postgres, test Postgres, PowerSync and dev server on their own ports. So agents can reset databases and run browser checks without touching yours or each other's.

- `scripts/loops/ls.sh` lists them all: slot, branch, how far ahead it is, and whether its stack is up.
- Ports come from a **slot** (1–19) each worktree leases: slot 3's dev server is on port 6373, slot 12's on 7273.
- Planning worktrees (`new.sh plan …`) have no stack.

### Landing work in `dev`

When a wave is green, the orchestrator first merges `dev` into its PRD branch, resolves any conflicts and reruns its checks. Then it tells you it's ready. You merge, in the main checkout:

```sh
git merge --no-ff prd/<topic>
pnpm datastore:reset && pnpm check
git push origin dev
```

Merge one PRD at a time. If a merge conflicts (because `dev` moved since the orchestrator's sync), run `git merge --abort` and ask that orchestrator to sync again.

When a whole PRD is done: `scripts/loops/rm.sh <topic>` removes its worktree and stack, and deletes its branch once it's merged.

### Going live

Open pull requests on GitHub: `dev` → `staging`, then `staging` → `main`. The tracker then shows the items as staging, then live (`pnpm backlog refresh` writes those statuses into the file).

## Tools at a glance

| Tool                                            | What it's for                                                 |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `scripts/loops/new.sh prd\|slice\|plan <topic>` | create a worktree (and stack) for a PRD, a slice, or planning |
| `scripts/loops/ls.sh`                           | list worktrees, slots and stacks                              |
| `scripts/loops/rm.sh <name>`                    | remove one, its stack and (if merged) its branch              |
| `scripts/loops/prompt.sh orchestrator <topic>`  | the first prompt for an orchestrator session                  |
| `pnpm backlog …`                                | the inbox and tracker (above)                                 |
| `pnpm hooks:install`                            | turn on the branch protection hooks                           |

## When something's off

- **"refused: a commit on dev that touches more than the backlog files"**: you (or an agent) tried to commit feature work on `dev`. Commit it on a `prd/`, `slice/` or `plan/` branch instead.
- **"backlog is locked"**: another session is writing the backlog. Try again in a moment. A lock left by a crashed run clears itself after 30 seconds.
- **"the main checkout is on …, not dev"**: the backlog tool only writes while your main checkout is on `dev`. Switch back with `git switch dev`.
- **A stale slot** in `ls.sh` output: a worktree was deleted by hand. Remove the lease directory it names.
