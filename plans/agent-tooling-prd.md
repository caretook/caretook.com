# PRD: Agent tooling

> Topic `agent-tooling`. Backlog items B-147, B-148 and B-154. B-152 (the `permissions` block in `.claude/settings.json`) and B-153 (the scripts pick Node 24 themselves) were already done as direct changes on `dev` and are not part of this PRD.

## Problem Statement

Every agent session pays for context before it does any work, and the history agents read is mostly noise.

- **Every session loads AGENTS.md (31 KB) through CLAUDE.md.** That includes loop rules, orchestrator rules and backlog mechanics that most sessions never use. AGENTS.md changed 97 times in 30 days, so it is also a merge hotspot at every landing.
- **Loops and orchestrators read docs/loops.md (52 KB),** with bullets up to 3.4 KB. A slice agent needs perhaps a fifth of it. The orchestrator needs a different fifth.
- **The large area docs restate the code.** timeline.md and medications.md are about 19 KB each, and app-shell, care-groups, components and sync are 10–15 KB. They are full of prop lists, CSS sizes, which test covers what, and backlog and slice ids. A slice that names one of them in `Reads` loads all of it.
- **785 of the last 1,830 commits are `chore(backlog)`.** Each `pnpm backlog` write is its own commit on `dev`, so `git log` (which orchestrators and loops read to reconcile and review) is mostly backlog noise.

## Solution

- **A small core and role docs.**
  - AGENTS.md shrinks to a core of about 8 KB, holding the rules every session needs and pointers: working rules, the stack, the architecture, compliance and the area index.
  - Material for one reader moves to role docs under `docs/agents/`: the loop agent, the orchestrator, the backlog and the planner.
  - docs/loops.md is split between the loop and orchestrator docs and becomes a short stub that points to them (existing plans name it in `Reads`).
  - `prompt.sh` tells each role which doc to read.
  - docs/orchestration.md stays the human guide.
- **Area docs hold contracts and pointers,** not restated implementation. The six docs over 10 KB are trimmed to under 10 KB each, once the PRDs that fold into them have landed.
- **A doc budget keeps them small.** Byte budgets for the core, each role doc and each area doc. `pnpm check` warns when a doc is over budget. `pnpm prd land` refuses a landing that makes an over-budget doc bigger.
- **Fewer backlog commits.** `set`, `note` and `claim` take several ids in one write. A write amends the previous backlog commit when that is provably safe.
- **History without the noise.** `pnpm log` is `git log` without backlog commits. The core says to use it, and the prompts' `git log` commands filter the noise too.

## User Stories

1. As a slice agent, I want the context I load at start to hold only the rules that apply to me, so that more of my context goes to the slice.
2. As a slice agent, I want one loop handbook that covers my stack, browser checks, hand-off and gotchas, so that I don't read orchestrator material to find my rules.
3. As an orchestrator, I want one orchestrator handbook (waves, merging, landing, recovery, capacity, steering), so that I find the process in one place.
4. As a planning agent, I want a planner doc that says how to write a PRD and plan (slice fields, test budget, landing a plan branch), so that my prompt can stay short.
5. As any agent that writes the backlog, I want the backlog rules in one doc I'm pointed to, so that sessions that never touch the backlog don't load them.
6. As the user in the main checkout, I want the core loaded in my sessions to be short and stable, so that small changes on `dev` start fast.
7. As the user, I want docs/orchestration.md to stay my guide to the process, so that I'm not reading agent rules to steer.
8. As a slice agent whose plan names docs/loops.md in `Reads`, I want that path to still lead somewhere useful, so that existing plans keep working.
9. As an orchestrator, I want the prompts that `prompt.sh` writes to name the role doc each agent reads, so that no agent is told to read a doc that no longer exists.
10. As an orchestrator at landing, I want a clear rule for where a lasting decision goes (core, role doc or area doc), so that the core doesn't grow back.
11. As a slice agent reading an area doc, I want its rules, invariants and the places code lives, not a restatement of props and sizes, so that I read less and the doc doesn't go stale.
12. As a slice agent, I want area docs without backlog ids and slice history, because git already holds them, so that the docs describe what is true now.
13. As an orchestrator folding a landing into an area doc, I want a size budget that tells me when the doc is too big, so that I trim as I fold.
14. As an orchestrator, I want `pnpm check` to warn, not fail, when a doc is over budget, so that a doc that is already big doesn't block unrelated work.
15. As the user, I want `pnpm prd land` to refuse a landing that makes an over-budget doc bigger, so that the trims hold.
16. As an orchestrator, I want the budgets in one config, so that I can see and change them in one place.
17. As an orchestrator marking several items done or noted at once, I want one command and one commit, so that a wave boundary doesn't add a dozen commits.
18. As a planning agent triaging several items into my PRD, I want `set B-1 B-2 B-3 prd=x status=triaged` in one write, so that triage is one commit.
19. As an orchestrator claiming a wave's items, I want `claim` to take several ids, with the first-claim-wins rule applied to each, so that a claim conflict on one id is reported clearly.
20. As any backlog writer, I want quick back-to-back writes folded into one commit when it's safe, so that bursts of notes don't each make a commit.
21. As an orchestrator syncing `dev` into my branch, I want a backlog write never to amend a commit my branch already has, so that the old commit can't come back at landing and conflict.
22. As the user, I want a backlog write never to amend my own commits or anything already on the remote, so that my history is never rewritten.
23. As any agent, I want `pnpm log` to show history without backlog commits and to take the usual `git log` arguments, so that reviewing a branch or reconciling _Status_ isn't buried in noise.
24. As an orchestrator, I want the `git log` commands in my prompts to filter backlog commits, so that reconciliation reads only real work.
25. As a planning agent, I want the size guard to cover the new role docs, so that they don't become the next 52 KB file.
26. As the user, I want the doc restructure to land without colliding with the PRDs that are running, so that no orchestrator has to redo a fold into a doc that moved.

## Implementation Decisions

### Backlog commits (B-154)

- **Multi-id writes.**
  - `set`, `note` and `claim` accept several `B-<n>` ids before their arguments, as `done` already does. Each is one locked read-change-write and one commit.
  - The subject names every id, shortened past a few (for example "B-1, B-2 +3: note").
  - `claim` is all-or-nothing. If any id is owned by another branch (without `--force`), nothing is claimed and the error names that id.
- **Amend, with strict guards.** A pure rule, `shouldAmend`, takes facts about dev's HEAD and returns amend or new commit. The writer amends only when all of these hold:
  - HEAD carries the backlog tool's trailer. Every backlog commit gets one; hand commits and the user's commits never do.
  - HEAD's commit time is less than 10 minutes ago.
  - No other local branch and no remote-tracking ref contains HEAD. That covers prd/ branches that synced `dev`, and `origin/dev`.
  - dev's HEAD is still the commit read at the start of the write (the existing compare-and-swap ref update).
  - Otherwise it makes a new commit, as today.
- **The amended commit:**
  - Its subject lists every id it covers.
  - Its body keeps each write's lines.
  - Its parent is HEAD's parent.
  - The ref update still compares against the HEAD it read, so a concurrent writer can't be lost.
- Reads and `doctor` are unchanged. Git-derived statuses are recomputed as today.

### `pnpm log`

- `pnpm log [git log args…]` runs `git log` with backlog commits filtered out (by subject `^chore\(backlog\)`), passing every other argument through.
- `pnpm log --help` notes the filter.
- The core gets one line: read history with `pnpm log`.
- The `git log` commands that `prompt.sh` puts in the orchestrator, recovery and review prompts filter backlog commits the same way.

### Doc budget

- **One config** lists the budgets in bytes:
  - the core (AGENTS.md): 8 KB;
  - each doc in `docs/agents/`: 15 KB;
  - each area doc in `docs/domain/`, plus docs/layout.md: 10 KB.
  - The docs/loops.md stub and docs/orchestration.md (the human guide) are listed with their own budgets.
- **A pure module:**
  - It measures a set of files and compares each to its budget: within, over, or over and grown against a base version.
  - Its CLI has two modes. Warn mode (in `pnpm check`) prints the docs over budget and exits 0. Land mode (in `pnpm prd land`, against the trunk) exits non-zero only for a doc that is over budget and bigger than on the trunk.
  - A new doc in a budgeted folder gets that folder's budget.
- Docs that are over budget today never block a landing that doesn't grow them.

### Core and role docs (B-147)

- **AGENTS.md (the core, ≤ 8 KB)** keeps:
  - the working rules (commits, Conventional Commits, small changes on `dev`, fictional data, dependencies);
  - a short summary of the branch roles;
  - the stack;
  - the architecture (two targets, data layer, sync, hosting) as rules and pointers;
  - compliance and open questions;
  - the commands table;
  - the area index (with the role docs added);
  - the rule for where decisions go at landing.
- **`docs/agents/loop.md`:** the loop rules, slice fields, the stack and isolation a loop sees, browser checks and their budget from the loop's side, the hand-off format, and loop and dev gotchas.
- **`docs/agents/orchestrator.md`:** starting and steering a PRD, capacity, running and landing a wave, landing modes, folding decisions into docs, recovery and _Status_, and the rules across PRDs.
- **`docs/agents/backlog.md`:** the inbox and tracker, ingest, triage, statuses, the commands, and who writes what.
- **`docs/agents/planner.md`:** writing a PRD and plan, the plan's shape, slice fields, the test budget for acceptance criteria, and landing a plan branch.
- **docs/loops.md** becomes a stub of a few lines that points to the loop and orchestrator docs, so the `Reads` fields in existing plans still work.
- **The rules across PRDs** (migrations, seeds, registries, hot files) live in one place, the orchestrator doc. The loop doc points to them.
- **Content moves, then tightens.** Every current rule ends up in exactly one place, or is dropped as stale with a reason in the slice's hand-off. Rationale that git history already holds goes.
- **prompt.sh** points each prompt (main session, planner, orchestrator, slice, review, recovery) at its role doc, and shortens the inline text those docs now hold.
- **docs/orchestration.md** (the human guide) keeps its role and gets updated links. It isn't rewritten.

### Area docs (B-148)

- **In scope:** the docs over 10 KB: timeline, medications, app-shell, care-groups, components and sync. Each ends up under 10 KB.
- **The level of detail is contracts and pointers.** A doc keeps rules, decisions, invariants, naming and where things live. It drops restated implementation that the code shows: prop lists, CSS sizes, which test covers which case, and step-by-step mechanics. Backlog ids and slice history go.
- The trims change no meaning. A rule that is still true stays, in fewer words.

### Sequencing

- Slices 1–3 change scripts only and can run alongside any PRD.
- **Slice 4** (the split) touches AGENTS.md and docs/loops.md, which every landing edits. It starts only when the orchestrator has checked `pnpm prd status` and the other plans' _Status_ and found no landing imminent, and it syncs `dev` right before its own landing. A PRD that lands in between is folded into the new layout at that sync.
- **Slices 5 and 6** (area trims) wait until no running PRD is about to fold into their docs. Slice 6 (timeline, app-shell) waits for `tasks` to land.

## Testing Decisions

- **Good tests check behaviour from outside:** what the CLI writes, commits and prints, not how it does it. The tooling's tests are `scripts:unit` against throwaway repos, in the style of `scripts/backlog/backlog.test.mjs`.
- **`shouldAmend`:** unit tests over the facts. These cover the trailer, the age, containment by another branch or a remote ref, and HEAD having moved.
- **The backlog CLI:** end-to-end tests in `backlog.test.mjs` for:
  - multi-id `set`, `note` and `claim`, including an all-or-nothing claim conflict;
  - a quick second write amending the first;
  - a write after `dev` was merged into a prd/ worktree branch making a new commit;
  - a write after a hand commit making a new commit;
  - a write after the 10-minute window making a new commit (time injected through the environment or git dates).
- **Doc budget:** unit tests for measuring and comparing (within, over, over and grown), for warn mode exiting 0, for land mode failing only on growth, and for a new doc getting its folder's budget.
- **Not tested (the user's choice):** `pnpm log` and the role-doc names in prompts. `prompt.test.mjs` and the rest of `scripts:unit` must stay green.
- **No app code changes,** so there are no component tests and no browser checks. `check-areas` maps `scripts/` and `docs/` to none.

## Out of Scope

- B-152 and B-153 (already on `dev`).
- Per-worktree CLAUDE.md files. One CLAUDE.md loads the core, and prompts name role docs.
- Squashing backlog commits on a timer, or rewriting existing history.
- Trimming area docs under 10 KB, and rewriting docs/orchestration.md.
- Any change to how the backlog files are stored, or to the status model.

## Further Notes

- AGENTS.md's _Keep these files current_ rule becomes: lasting decisions go into the area doc, process changes into the role doc, and only rules every session needs into the core. The budget guard enforces this.
- If a running PRD lands between slice 4's start and its landing, slice 4's sync is where its additions to the old AGENTS.md and docs/loops.md are moved into the new layout. The slice's hand-off lists them.
