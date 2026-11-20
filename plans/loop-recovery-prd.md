# PRD: Loop recovery

> Backlog: B-132. Topic `loop-recovery`. Follows `orchestration` (done). Written 2026-11-19 from an interview with the user.

## Problem Statement

The PRD tooling runs several orchestrators, each with background slice agents, Docker stacks, dev servers and machine-wide leases. All of it assumes the machine and the Claude sessions stay up. Three things have actually interrupted it: a Mac restart, a token or usage limit, and the disk running low.

After any of them, the user rebuilds the state by hand:

- **Sessions are gone or stuck.** Orchestrators stop, and their background slice agents die with them. After a usage limit the sessions may still exist, but they sit idle until someone nudges each one.
- **Infrastructure is down.** The Compose projects have no restart policy, so stacks stay stopped after a reboot. Dev servers are gone, and the shared test Postgres (on tmpfs) is empty.
- **Locks are left behind.** Slot leases, queue tickets, the PRD-start lock and the backlog lock can outlive their holders. Leases and tickets are taken over or dropped; the others need checking by hand.
- **Mid-wave state lives only in the orchestrator's context.** Its plan's _Status_ is written at wave boundaries only, so after a crash nobody knows which slices were started, handed off or merged without rebuilding it from branches.
- **Low disk kills work halfway.** Nothing warns before a new stack or a check build fills the disk, and there's no single way to see and reclaim what the worktrees, Docker and builds are using. Restarting the machine to recover from it loses everything above.

## Solution

Two commands, a disk guard and resumable sessions:

- **`pnpm prd down`** is a clean shutdown before a planned restart. It stops every dev server and stack and records what was running.
- **`pnpm prd recover`** brings everything back after a restart, a crash or a usage limit:
  - It inventories the worktrees, starts Docker Desktop if it's down, and brings back the stacks of active work one at a time. With a `down` record it brings back exactly what that recorded.
  - It restarts the shared test Postgres and the PRD worktrees' dev servers, and clears stale locks.
  - It then opens a short **recovery agent** in the main checkout:
    - live orchestrators and planners (ListAgents) get a "carry on" message;
    - each dead one gets an **iTerm2 tab** that resumes its last session (`claude --continue`), or starts a fresh orchestrator with a resume prompt when there's nothing to continue.
  - `--at HH:MM` waits until a usage limit resets. Without it, after a limit, recover probes with a tiny headless `claude -p` every 10 minutes until one succeeds, then recovers on its own.
  - `--dry-run` only prints the inventory and the actions.
- **A resumed or fresh orchestrator** rebuilds from its plan's _Status_, which orchestrators now update **at every step**: a slice started, handed off, merged, or a wave landed. It respawns one agent per in-flight slice with a "continue" prompt: pick up from the worktree's commits and uncommitted changes, don't start over.
- **The disk guard** refuses a new stack or check build when free space is under 10 GB (`CARETOOK_MIN_FREE_GB`), with a message pointing at `pnpm prd reclaim`. `status` shows free disk.
- **`pnpm prd reclaim`** lists what can be freed, with sizes, and frees it after a yes. That covers merged worktrees (gc), dangling Docker volumes and images, check builds and Vite caches.

## User Stories

1. As the user, I want one command after a reboot that brings my PRDs back, so that I don't rebuild stacks, servers and sessions by hand.
2. As the user, I want recovery to start Docker Desktop when it isn't running and wait for it, so that a cold boot needs no extra step.
3. As the user, I want recovery to bring back only the stacks of active work (PRD worktrees and unmerged slices), so that merged leftovers don't eat CPU and disk.
4. As the user, I want merged leftovers offered to gc during recovery rather than restarted, so that recovery also tidies up.
5. As the user, I want stacks started one at a time, so that a recovering machine isn't overloaded and Postgres's first-boot restart doesn't fail migrations.
6. As the user, I want dev servers restarted for PRD integration worktrees, so that the links in `pnpm prd status` work again.
7. As the user, I want the shared test Postgres started again, so that `pnpm check` works in every worktree.
8. As the user, I want stale slot leases, queue tickets, the PRD-start lock and the backlog lock cleared when their holders are gone, so that new work isn't blocked by dead processes.
9. As the user, I want live locks left alone, so that recovery never breaks a running holder.
10. As the user, I want `pnpm prd down` before a planned restart to stop everything and record what was running, so that recovery restores exactly that.
11. As the user, I want recovery to use the `down` record when there is one and then delete it, so that an old record never applies twice.
12. As the user, I want `pnpm prd recover --dry-run` to show the inventory and the actions without doing anything, so that I can check before acting.
13. As the user, I want recovery to message every live orchestrator and planner to carry on, so that sessions idled by a usage limit resume without me visiting each.
14. As the user, I want each dead orchestrator or planner reopened in its own iTerm2 tab, so that I can watch and steer it.
15. As the user, I want a reopened orchestrator to continue its last conversation when one exists, so that it keeps its context.
16. As the user, I want a fresh orchestrator with a resume prompt when there's nothing to continue, so that recovery always ends with a running orchestrator.
17. As the user, I want reopened sessions to keep their Remote Control names (`prd-<topic>`, `plan-<topic>`), so that I can still reach them from my phone.
18. As the user, I want `pnpm prd recover --at 15:00` to wait until my usage limit resets and then recover, so that work resumes while I'm away.
19. As the user, I want recovery without `--at` to probe every 10 minutes with a tiny headless call after a limit, so that it resumes as soon as the limit resets.
20. As the user, I want the probe to stop as soon as one call succeeds, so that it spends almost no tokens.
21. As an orchestrator, I want my plan's _Status_ updated at every step (slice started, handed off, merged, wave landed), so that a crash at any moment loses nothing a fresh orchestrator needs.
22. As a resumed orchestrator, I want a resume prompt that tells me to reconcile _Status_ with the branches and worktrees, so that I trust what git says over a stale line.
23. As a resumed orchestrator, I want to respawn one agent per in-flight slice with a "continue" prompt, so that work already done in the worktree isn't redone.
24. As a resumed slice agent, I want my prompt to say I'm continuing and to read my worktree's commits, diff and uncommitted changes first, so that I finish instead of restarting.
25. As a resumed slice agent whose work is already committed and checked, I want to just write the hand-off again, so that a slice that had finished isn't rebuilt.
26. As a resumed orchestrator, I want slices that were handed off but not merged reviewed from their branch, so that a lost hand-off message doesn't block the merge.
27. As the user, I want new stacks and check builds refused below 10 GB free, so that nothing dies halfway through a write.
28. As the user, I want the threshold set by `CARETOOK_MIN_FREE_GB`, so that I can tune it.
29. As the user, I want the refusal to say how much is free and to point at `pnpm prd reclaim`, so that I know what to do.
30. As the user, I want `pnpm prd status` to show free disk and flag it when low, so that I see trouble coming.
31. As the user, I want `pnpm prd reclaim` to list what it would free, with sizes, before asking, so that I decide what goes.
32. As the user, I want reclaim to cover merged worktrees, dangling Docker volumes and images, check builds and Vite caches, so that one command frees the usual culprits.
33. As the user, I want reclaim never to touch the main checkout's data, active worktrees' databases or uncommitted work, so that freeing space can't lose work.
34. As the user, I want `reclaim --yes` and `--list`, like gc, so that it can run unattended or just report.
35. As an agent, I want recovery's report to name each worktree's class and what was done to it, so that I can explain the state to the user.

## Implementation Decisions

- **This PRD may edit `docs/loops.md`, `docs/orchestration.md` and the orchestrator and slice prompts.** Its subject is the process those describe, as with `orchestration`. AGENTS.md changes stay to pointers.
- **Tooling stays bash plus Node `.mjs`.** Logic worth testing lives in pure `.mjs` modules. No new dependencies.
- **Inventory (a deep, pure module).** Input is a facts object, collected separately:
  - each worktree's name, branch, parent, merged or not, dirty or not, stack project and whether it was stopped, and server port;
  - slot leases, queue tickets, the start and backlog locks, and live pids;
  - the `down` record, if any, and free disk.

  Output is a classification per worktree and an ordered list of actions:
  - **Classes:** `prd`, `plan`, slice `active`, slice `merged`, `stackless`.
  - **Actions:** start Docker, stack up, serve, clear a lock, offer gc, open a session.

  The collector is thin shell or Node around git, docker, lsof and `df`. `recover --dry-run` prints the result.

- **What comes back without a `down` record:**
  - stacks of `prd` and active-slice worktrees that have a stack;
  - dev servers for `prd` worktrees only;
  - the shared test Postgres.

  Merged slices are offered to gc. With a record, exactly what it lists comes back. The record is a JSON file in `.loops/`, and recovery deletes it once used.

- **`down`** stops dev servers, then each stack (`compose stop`, keeping data), then the shared test Postgres. It writes the record first, so a `down` cut off halfway still recovers.
- **`recover` order:**
  1. Docker: `open -a Docker`, then wait for `docker info`.
  2. Stale locks.
  3. The shared test Postgres.
  4. Stacks, one at a time. Each waits for its Postgres to accept connections before the next starts; a migrate failure is retried once.
  5. Dev servers (`serve.sh`).
  6. The recovery agent.

  Every step is idempotent, so running it twice is safe.

- **Stale locks:** a lock is stale when its recorded pid is dead, or it has no worktree (slot leases). Live ones are never touched. Machine-wide leases already take over dead holders, so recovery only reports them.
- **The usage-limit wait:**
  - `--at HH:MM` sleeps until that local time (the next day's if it has passed).
  - Without `--at`, when asked to wait (`--wait`), it runs `claude -p` with a one-word prompt every 10 minutes (`CARETOOK_RECOVER_PROBE_SECS`) until it exits 0, then recovers.
  - It's meant to run left alone in a terminal, like `queue`.
- **The recovery agent:** a prompt kind (`prompt.sh recover`) for a short session in the main checkout. It reads the inventory, and:
  - uses ListAgents to find live sessions named `prd-<topic>` or `plan-<topic>`, and sends each a carry-on message;
  - opens a session for each PRD or plan worktree with no live session (the opener below);
  - reports, then ends.

  It changes no code and commits nothing.

- **The session opener:** given a worktree, it chooses `claude --continue --remote-control <name>` when that worktree has a saved Claude conversation. Otherwise it chooses a fresh session with the resume prompt (`prompt.sh orchestrator <topic> --resume`, or the plan prompt).
  - It opens the command in a **new iTerm2 tab** via AppleScript. Without iTerm2, it prints the command.
  - Choosing the command is separate from launching it, so it can be tested.
  - A PRD started by `queue` (run-through mode) keeps that mode, which is recorded in its _Status_.
- **Prompts:**
  - `orchestrator <topic> --resume` reconciles _Status_ with git: slice worktrees, branches ahead of `prd/<topic>`, merges already in. It respawns in-flight slices with `slice <topic> <n> --continue`, reviews handed-off but unmerged slices from their branches, and follows the recorded landing mode.
  - `slice … --continue` says: read your commits, `git status` and diff first; finish; if it's all committed and `pnpm check` passes, write the hand-off.
  - The orchestrator prompt and `docs/loops.md` say to update _Status_ at every step, not only at wave boundaries.
- **The disk guard** (in the shared shell library): free GB of the volume holding the main checkout, against `CARETOOK_MIN_FREE_GB` (default 10).
  - `new.sh` (a stacked worktree), `stack up` and the check build in `browser.sh` call it and refuse below the line, saying how much is free and naming `pnpm prd reclaim`.
  - `status` prints free disk and flags it when low.
- **`reclaim`:**
  - It lists sizes first: merged worktrees (via gc), dangling Docker volumes and images, check builds (`apps/web/build/` in `.loops` worktrees) and Vite caches (`node_modules/.vite` in `.loops` worktrees).
  - It frees them after a yes, or `--yes`; `--list` only lists.
  - It never touches the main checkout, an active worktree's database volumes, or uncommitted work (gc already refuses dirty worktrees).
- **`pnpm prd help`** and `docs/loops.md` list `down`, `recover` and `reclaim`. Entries are additive in `prd.sh`.

## Testing Decisions

- **Tests check behaviour through each module's interface:** facts in, classifications and actions out; a command's effects on a throwaway repo with fake `docker`, `lsof`, `df`, `claude` and `osascript` on PATH. They never check internals. This follows `scripts/loops/stack.test.mjs` and `lease.test.mjs` (the `scripts:unit` project, 20 s timeout).
- **The inventory classifier** gets unit tests. Fixture facts cover every class, a dirty merged slice, stale and live locks, a `down` record and low disk, each with the expected actions and their order.
- **The disk guard** gets unit tests with a faked free-space reading: the threshold, the env override, and refusals (with their message) from `new.sh`, `stack up` and the check build.
- **The `down` / `recover` round trip** runs in a throwaway repo with fake docker and lsof. `down` writes the record and stops each stack. `recover` issues exactly those starts in order, deletes the record, clears only stale locks, and is a no-op the second time. It also covers `--dry-run`, and `--at` and the probe with a fake clock and a fake `claude`.
- **Prompts and the opener** get unit tests:
  - the `prompt.sh recover`, `orchestrator --resume` and `slice --continue` output;
  - the opener's chosen command (continue when a saved conversation exists, fresh otherwise, and the Remote Control name), without launching iTerm2;
  - the print-only fallback.
- **Every slice:** no component tests and no browser checks (tooling; `check-areas` maps `scripts/loops/*` to none). Every slice runs `pnpm check`.

## Out of Scope

- Automatic recovery at login (a LaunchAgent); the user runs `recover`.
- A session registry; `claude --continue` per worktree is enough.
- Saving slice hand-offs to files; the branch is the record, and a respawned agent rewrites the hand-off.
- Terminals other than iTerm2, beyond printing the command.
- Disk-full recovery inside Docker (resizing the VM disk).
- Changes to `pnpm backlog` beyond clearing its stale lock.
- Production hosting or anything app-side.

## Further Notes

- `check-migration` also edits `scripts/loops/` (`check-areas`, `browser.sh`). This PRD's edits there are small: the check-build disk guard in `browser.sh`, and additive commands in `prd.sh`. The two can run side by side, and whichever merges second resolves the small overlap.
- Disk on 2026-11-19: 127 GB free, `.loops` 6.6 GB, Docker 0.8 GB of images and 0.3 GB of reclaimable volumes.
