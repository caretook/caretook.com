# Plan: Loop recovery

> Source PRD: [`plans/loop-recovery-prd.md`](loop-recovery-prd.md). User-story numbers (US) refer to it. Backlog item B-132. Topic `loop-recovery`.

## Status

| Slice | Wave | State                         | Merge into `prd/loop-recovery` (slice commits) |
| ----- | ---- | ----------------------------- | ---------------------------------------------- |
| 1     | 1    | merged                        | 6e18d83 (d1383c0)                              |
| 2     | 1    | in progress                   |                                                |
| 3     | 1    | handed off (ec3a08e, a27285a) |                                                |
| 4     | 2    | in progress                   |                                                |
| 5     | 3    | blocked by 3, 4               |                                                |

**Landing:** land each wave as soon as it's green. **Landing mode: run everything through** (queued with `pnpm prd queue loop-recovery`): start every ready slice, land each green wave without asking, clean up. Ask only real questions.

**Backlog:** B-132 (claimed by `prd/loop-recovery`; `done` once slice 5 merges). Wave 1 (slices 1, 2, 3) started 2026-11-19. Slice 1 merged; slice 4 started early (only blocked by 1) and lands in its own wave. Slice 1 docs text (command row, inventory under _Isolation_) to fold into docs/loops.md at the wave 1 landing.

## Architectural decisions

Durable decisions every slice follows:

- **Tooling is bash plus Node `.mjs`** in `scripts/loops/`, with logic worth testing in pure `.mjs` modules. No new dependencies.
- **Tests are `scripts:unit`** against throwaway repos with fake `docker`, `lsof`, `df`, `claude` and `osascript` on PATH, in the style of `stack.test.mjs` and `lease.test.mjs`. Nothing touches real containers, slots, sessions or worktrees. No component tests and no browser checks: `check-areas` maps `scripts/loops/*` to none.
- **One inventory** (slice 1) is the only place that decides a worktree's class and what recovery does to it. `down`, `recover`, `reclaim` and the recovery agent read it; they don't re-derive it.
  - **Classes:** `prd`, `plan`, slice `active`, slice `merged`, `stackless`.
  - **Without a `down` record**, recovery brings back:
    - stacks of `prd` and active slices;
    - dev servers for `prd` worktrees only;
    - the shared test Postgres.

    Merged slices are offered to gc.

  - **With a record**, exactly what it lists comes back, and the record is deleted.
- **Stale means the holder is gone:** a dead pid, or (for a slot lease) no worktree. Live locks are never touched.
- **Every recovery step is idempotent**, so a second `recover` is a no-op.
- **The disk guard** (slice 2) is one shell function in `lib.sh`:
  - it reads free GB on the main checkout's volume;
  - the threshold is `CARETOOK_MIN_FREE_GB`, default 10;
  - `CARETOOK_FREE_GB` overrides the reading in tests.
- **Sessions:** a worktree's dead session reopens with `claude --continue --remote-control <name>` when the worktree has a saved conversation. Otherwise a fresh session gets the resume prompt. Names stay `prd-<topic>` and `plan-<topic>`.
  - Tabs open in iTerm2 via AppleScript. Without iTerm2, the command is printed.
  - No session registry.
- **_Status_ is updated at every step** (slice started, handed off, merged, wave landed), and git wins over a stale line.
- **Docs:**
  - Slice 3 owns `docs/loops.md` and `docs/orchestration.md` edits; this PRD may edit them, as `orchestration` did.
  - Slices 1, 2, 4 and 5 put their doc text in a _Docs_ section at the end of their hand-off. The orchestrator folds it into `docs/loops.md` at landing.
  - AGENTS.md gets pointers only.
- **Shared files stay additive:**
  - `prd.sh` (a dispatch line and a help line per command);
  - `lib.sh` (new functions at the end);
  - `ls.sh` (one status line);
  - `browser.sh` (one guard call before the check build). `check-migration` also edits `browser.sh` and `check-areas`; whichever merges second resolves.

## How to run this plan

- **Wave 1: slices 1, 2 and 3 at once.** All are stackless (`new.sh --no-stack` is the default for `Stack: no`).
  - 1 owns the inventory module and `recover --dry-run`.
  - 2 owns the disk guard, `reclaim.sh` and the status line.
  - 3 owns the prompts and the docs.
- **Wave 2: slice 4** (`down.sh`, `recover.sh`).
- **Wave 3: slice 5** (the opener, the recovery agent, the hand-off from `recover`).
- Merge in number order within a wave, with no checks between merges.
- **Checks:** every slice runs `pnpm check`. `pnpm prd browser --changed` names nothing for these files, so no browser checks run, at the slice or at landing.
- **Running beside other PRDs:** this plan can run next to `assistant` and `quick-fixes`. Next to `check-migration`, expect a small merge in `browser.sh`. Message its orchestrator (ListAgents, SendMessage) when a wave that touches `browser.sh` lands.
- **The tools change under running orchestrators.** At each landing, message the running orchestrators to `pnpm prd sync` before they next use the new commands. Old commands keep working.
- Every slice ends with a hand-off (AGENTS.md, _Loop rules_), plus a _Docs_ section for slices 1, 2, 4 and 5.

---

## Slice 1: Inventory and `recover --dry-run`

Stack: no · Reads: docs/loops.md · Tests: unit

**User stories:** 3, 4, 8, 9, 12, 35.

**What to build:**

- **A pure inventory module.** It takes a facts object and returns one entry per worktree (name, class, and why), stale and live locks, and an ordered action list.
  - **The facts:**
    - worktrees: name, branch, parent, merged, dirty, stack project, containers up, stopped-since, web port and server running;
    - slot leases, queue tickets, `.prd-start.lock` and the backlog lock, each with its pid and whether it's alive;
    - whether Docker answers;
    - the `down` record, if any;
    - free GB.
  - **The actions:** `docker start`, `clear-lock <path>`, `test-db up`, `stack up <name>`, `serve <name>`, `offer-gc <name>`, `open-session <name>`, `delete-down-record`.
- **A collector** (Node, shelling out to git, docker, lsof and the disk reading) that builds the facts.
- **`pnpm prd recover --dry-run`** prints the inventory table and the actions, and does nothing else. `--json` prints them for slice 4 and the recovery agent.

**Acceptance criteria:**

- [ ] The inventory unit tests (`inventory.test.mjs`) classify every class, including a dirty merged slice, which is offered to gc but kept.
- [ ] Without a `down` record: stacks for `prd` and active slices, servers for `prd` only, and the test Postgres. With a record: exactly its list, then `delete-down-record`.
- [ ] Stale locks get `clear-lock`; live ones don't.
- [ ] No Docker puts `docker start` first.
- [ ] Actions come in a fixed order: Docker, locks, test Postgres, stacks (one at a time), servers, gc offers, sessions.
- [ ] `recover --dry-run` runs in a throwaway repo with fake docker and lsof (`recover.test.mjs`) and changes nothing on disk.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 4.

---

## Slice 2: Disk guard and `reclaim`

Stack: no · Reads: docs/loops.md · Tests: unit

**User stories:** 27, 28, 29, 30, 31, 32, 33, 34.

**What to build:**

- **A disk guard in `lib.sh`** (free GB, the threshold, `require_disk <what>`), called by:
  - `new.sh` for a stacked worktree;
  - `stack.sh up`;
  - `browser.sh` before a check build.

  A refusal says how much is free, the threshold, and to run `pnpm prd reclaim`.

- **`pnpm prd status`** prints a disk line (free GB, flagged under the threshold).
- **`pnpm prd reclaim [--list|--yes]`** lists, with sizes:
  - merged slice worktrees (gc's list);
  - dangling Docker volumes and images;
  - check builds (`apps/web/build/` in `.loops` worktrees);
  - Vite caches (`node_modules/.vite` in `.loops` worktrees).

  It frees them after a yes, then prints the space freed.

- **What reclaim never touches:** the main checkout, any volume a worktree's Compose project still uses, or a dirty worktree.

**Acceptance criteria:**

- [ ] Unit tests (`disk.test.mjs`, with `CARETOOK_FREE_GB` faked) cover:
  - `new.sh` with a stack, `stack up` and the check build refusing below 10 GB, and allowed above it;
  - `CARETOOK_MIN_FREE_GB` moving the line;
  - the refusal message.
- [ ] A stackless `new.sh` isn't refused.
- [ ] `status` shows the disk line, flagged when low.
- [ ] Reclaim tests (`reclaim.test.mjs`, fake docker and du):
  - `--list` changes nothing;
  - `--yes` removes the merged worktree, prunes dangling volumes and images, and deletes `.loops` check builds and Vite caches;
  - it keeps a dirty merged worktree, an in-use volume and anything in the main checkout.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** none.

---

## Slice 3: Resume prompts, and _Status_ at every step

Stack: no · Reads: docs/loops.md, docs/orchestration.md · Tests: unit

**User stories:** 21, 22, 23, 24, 25, 26.

**What to build:**

- **`prompt.sh orchestrator <topic> --resume`**, which may be combined with `--auto`. It says:
  - you're taking over after an interruption;
  - read _Status_, then reconcile it with git: slice worktrees, `slice/<topic>/<n>` branches ahead of `prd/<topic>`, merges already in `prd/<topic>`, dirty worktrees;
  - git wins, so correct _Status_ first;
  - respawn one background agent per in-flight slice with `prompt.sh slice <topic> <n> --continue`;
  - review handed-off but unmerged slices from their branch diff, and ask for a fresh hand-off when you need one;
  - follow the recorded landing mode.
- **`prompt.sh slice <topic> <n> --continue`**: the slice prompt plus "you're continuing". Read `git log`, `git status` and the diff against `prd/<topic>` first, and finish from there. If everything is committed and `pnpm check` passes, write the hand-off without rebuilding.
- **The orchestrator prompt** (both modes) says to update _Status_ at every step: a slice started, handed off or merged, a wave landed.
- **`docs/loops.md`** (_Starting and steering_, _Running a wave_) and **`docs/orchestration.md`** say the same, and describe resuming.

**Acceptance criteria:**

- [ ] Prompt unit tests (`prompt.test.mjs`) cover:
  - `--resume` alone and with `--auto` (run-through text kept);
  - `slice --continue` (the continue text, the fields line kept);
  - the plain prompts unchanged, apart from the every-step _Status_ line.
- [ ] `docs/loops.md` and `docs/orchestration.md` describe resuming and every-step _Status_.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 5.

---

## Slice 4: `down` and `recover` (infrastructure)

Stack: no · Reads: docs/loops.md · Tests: unit

**User stories:** 1, 2, 5, 6, 7, 10, 11, 18, 19, 20.

**What to build:**

- **`pnpm prd down`:**
  - writes the record first (`.loops/.down.json`: the stacks and servers that are up);
  - then stops dev servers, then each stack (`compose stop`, keeping data), then the shared test Postgres;
  - prints what it stopped.
- **`pnpm prd recover`** runs slice 1's actions, apart from sessions, which are slice 5's:
  - starts Docker Desktop (`open -a Docker`) and waits for `docker info`, with a timeout;
  - clears stale locks;
  - `test-db up`;
  - brings stacks up one at a time, each waiting for its Postgres to accept connections, and retries a migrate failure once;
  - starts servers through `serve.sh`;
  - prints the gc offers and deletes the record once used.

  It ends by printing the sessions to reopen (slice 5 turns that into the recovery agent).

- **`recover --at HH:MM`** sleeps until then (tomorrow if that time has passed), then recovers.
- **`recover --wait`** probes with `claude -p` and a one-word prompt every `CARETOOK_RECOVER_PROBE_SECS` (600) until one exits 0, then recovers. Both print what they're waiting for.

**Acceptance criteria:**

- [ ] The round-trip tests (`recover.test.mjs`, throwaway repo, fake docker, lsof, serve and claude) cover:
  - `down` writing the record before stopping anything, and stopping each stack and server;
  - `recover` issuing exactly the recorded starts in order, deleting the record, and clearing only stale locks;
  - a second `recover` doing nothing;
  - without a record, only active stacks and `prd` servers coming back;
  - Docker being started and waited for when it isn't running.
- [ ] `--at` (fake clock) and `--wait` (a fake `claude` that fails twice, then succeeds) wait the right way and then recover.
- [ ] `pnpm prd help` lists `down` and `recover`.
- [ ] `pnpm check` passes.

**Blocked by:** 1. **Blocks:** 5.

---

## Slice 5: The recovery agent and the iTerm2 opener

Stack: no · Reads: docs/loops.md, docs/orchestration.md · Tests: unit

**User stories:** 13, 14, 15, 16, 17.

**What to build:**

- **The session opener:** given a worktree, it chooses the command.
  - If the worktree has a saved Claude conversation (a transcript under `~/.claude/projects/` for that path; the location can be overridden in tests), it's `claude --continue --remote-control <name>`.
  - Otherwise it's a fresh session: `prompt.sh orchestrator <topic> --resume`, plus `--auto` when _Status_ records run-through, or the plan prompt for a `plan-` worktree.
  - It opens the command in a new iTerm2 tab with `osascript`, or prints it when iTerm2 isn't there or `--print` is given.
- **`prompt.sh recover`:** the recovery agent's prompt, for the main checkout.
  - Read `pnpm prd recover --dry-run --json`.
  - ListAgents: send each live `prd-<topic>` or `plan-<topic>` session a carry-on message ("the machine recovered; reconcile your _Status_ with git and carry on").
  - Open each PRD or plan worktree with no live session through the opener.
  - Report what was messaged and opened, then end. It makes no code changes and no commits.
- **`pnpm prd recover`**, after its infrastructure steps, opens the recovery agent in the current terminal (`claude --remote-control recover`); `--no-agent` stops before it.
- **`pnpm prd help`** and the _Docs_ hand-off section cover the whole flow.

**Acceptance criteria:**

- [ ] Opener unit tests (`open-session.test.mjs`, fake `osascript`, a temporary projects directory) cover:
  - continue when a transcript exists, fresh otherwise;
  - `--auto` when _Status_ says run-through;
  - the plan prompt for planners;
  - Remote Control names kept;
  - the print fallback without iTerm2.
- [ ] Prompt tests cover the `prompt.sh recover` text (ListAgents, carry-on message, opener, no code changes).
- [ ] `recover` launches the agent (a fake `claude` records its args), and `--no-agent` doesn't.
- [ ] `pnpm check` passes.

**Blocked by:** 3, 4. **Blocks:** none.
