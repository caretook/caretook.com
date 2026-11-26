- `new.sh <kind>`: `prd <topic>` (`.loops/<topic>`, from `dev`, a stack), `slice <topic> <n>` (`.loops/<topic>-<n>`, from `prd/<topic>`, a stack only for `Stack: yes` or `--stack`), `plan <topic>` and `hotfix <name>` (stackless, from `dev`). Options: `--slot N`, `--[no-]stack`, `--base B`. Reuses a branch; env files from the main checkout.
- **Slots** (1–19): atomic locks in `.loops/.slots/<N>`, busy too while a `.env` names one or a port listens. Ports: [loop](loop.md#your-worktree-and-stack).
- **The shared test Postgres** (`pnpm prd test-db`, :5436, tmpfs): a database per worktree (`rm.sh` drops it); `test-db down` drops all.
- `pnpm prd status` flags landed `merged:` worktrees and `stopped stack:`s (over `CARETOOK_GC_STOPPED_HOURS`, 24); `gc` removes them on a yes. **The disk guard** refuses a stack or check build under `CARETOOK_MIN_FREE_GB` (10); `reclaim` frees merged worktrees, dangling Docker data, check builds and Vite caches (never in use).
- **A merged slice is held** until its wave has landed and no run of its topic is out (`scripts/ci/outstanding.mjs`; unreadable GitHub holds too): `tidy`, `gc`, `reclaim` keep it, say why; `pnpm prd rm` doesn't check.
- **`pnpm prd dev-sync`** (`land`; `pr`'s push when `origin/dev` is ahead) brings `dev` up to `origin`: a fast-forward, else a replay of backlog commits no other ref holds, else a merge. The inbox never stops it (`inbox-merge.mjs`); another file's conflict or edits do.
- **Machine leases** (`lease.sh`; the core's Node tools `lease.mjs`, a project's code the config's `lease` hook): `browser` 2, `check` 2, others 1 (`CARETOOK_<KIND>_SLOTS`), locks in `.loops/.lease/<kind>/<N>`, taken from dead holders. A taker links `name` in from its own temp file (a loser backs off); `tidy` removes a dead lease via `lease_take_over`. Waits are bounded (`CARETOOK_<KIND>_WAIT`; browser 20 min, check 30), then 75; `CARETOOK_LEASES=off` takes none.
- **`pnpm prd wait [check|browser|<kind>] [--timeout S] [--worktree W]`** (`lease.sh wait`) waits until the worktree's lease, held or queued, is gone; 75 at the timeout (3600 s).

## Recorded sessions

- **`session.sh <name> [--kind <k>] [--topic <t>] [--auto] [--managed] -- <claude args>`** runs `claude` and keeps a record in the main checkout's `.loops/.sessions/<name>.json` (`pid`, claude's own; `kind`, `topic`, `started`, `rotating`, `ended`, …). Records outlive the session (`rm.sh`, `tidy` delete). Under Vitest, writes to a non-temp `.loops/.sessions` are refused.
- **Live:** no `ended`; the pid exists, started within 1 min of `started`.
- **`pnpm prd end [<name>]`** ends the named session's live claude (the record's pid if it is that session's, else the one under `session.sh <name>`; unclear: refused), else the caller's (TERM; KILL after `CARETOOK_END_WAIT`, 10 s).
- **`pnpm prd bye`** (`bye.mjs`; `--dry-run`, `--json`), on just 'bye': by role, what's open (unpushed work, worktrees, unmerged branches, a stack, server or lease, background shells, unanswered questions). Clean: the hand-off line, its own leases freed, `end` (a slice only reports). Else each thing, exit 3, nothing closed.
- **The opener** (`open-session.sh`) writes `cd <dir> && exec …` to its tab (closing with it). It carries `auto` and `managed` over; opens fresh after a `rotating` record. Backlog and recovery reopen fresh in the main checkout, inbox via `prd.sh inbox`, a hotfix with `--continue`; a live one is refused.

## Rotation

- **`pnpm prd rotate [<topic>] [--mid-wave] [--reason <text>]`** (`rotate.sh`) finds the session (`prd-<topic>`'s record, else the ancestor `claude`), opens `rotate-into.sh` in a background tab. It refuses on uncommitted plan changes, a requested run out or GitHub unreadable, slice worktrees left (those two unless `--mid-wave`), no session; `--mid-wave --reason context` also while a slice isn't handed off, until past the hard limit. A leftover `ci/` ref counts as a run out.
- `rotate-into.sh <name> <pid>` sets `rotating`, ends the pid (as `end`; `CARETOOK_ROTATE_WAIT`, 20 s), waits for the recorded end, then execs `session.sh` with `prompt.sh orchestrator <topic> --resume` (`--auto` from the record or _Status_): fresh, the same name.
- **`rotate --self [--brief <file>]`** finds the caller by its ancestor `claude` pid. A backlog session reopens fresh in the main checkout (same record and model), the brief on top of its prompt; an orchestrator rotates as plain `rotate`; other kinds and `slice/` branches are refused. `--brief-path` prints where to write the brief; a stale one is deleted at start.
- **Captains** (`captain.mjs`): the main backlog session's Remote Control name and tab title, drawn at each start, rotate, hand-off and reopen, never the last; the record stays `backlog`; a `--remote-control <Captain>` process is live. Its prompt names it (`CARETOOK_CAPTAIN`).
- **Done:** `rm.sh` and a topic's last `land` set the registry's `done` (dropping `hold`) once _Status_ has no slice left and every item is landed, never `standing`; rm drops a plan-only tail past the landing, merges a docs one into dev.

## The context watch

- **The hook** (`context.mjs`, from `context-settings.json`): `session.sh` passes it for `prd`, backlog and inbox sessions (not planners or the user's own). Each tool call records the size; past the soft `CARETOOK_CONTEXT_LIMIT` (120,000 orchestrator, 160,000 backlog and inbox) a reminder every 25k (an orchestrator: rotate between waves only; others judge); past the hard `CARETOOK_CONTEXT_HARD_LIMIT` (225,000) one every `CARETOOK_CONTEXT_REMIND_MIN` (10): rotate at the next safe point. Backlog: soft only; inbox: hard = soft. It never blocks.
- **The heartbeat** (`heartbeat.mjs`, on every tool and stop event): each agent's open calls, last start, end and stop, in `.loops/.heartbeat/<session>/<agent>.json`; its worktree: the `.loops/<name>` its calls name most. `workers.mjs` adds leases, commits, unignored changes and live processes: `pnpm prd status`'s WORKERS.
- **`pnpm prd watch [<topic>]`** (`watch.mjs`, pure `decide`): each slice agent's state (quiet 20 min, no progress 45) and action: nudge, restart (10 min after an unreplied nudge), skeptic (dirty tree, migration, merge, second stall, unconfirmed stop; a second `restarted` is refused). Never on a running command, lease, handed-off, stopped or unknown agent, open ask, or several quiet at once. `--wait` exits with it; `--mark` in `.loops/.watch/<topic>/`.
- **A subagent** is sized from its transcript; a backlog session's get nothing. Past **175k** it's asked to judge, again every 25k; past **300k** told to hand off each call.
- **The size record:** `.loops/.context/<name>.json` in the main checkout (subagents: `.agents/<name>/`); a stale pid's is ignored.
- **`pnpm prd context`** prints the session's size and both limits; `--all [--json]` lists live sessions; `--keep "<why>"` silences the watch for `CARETOOK_CONTEXT_KEEP_MIN` (30). It's refused on a `slice/` branch.

## The dispatcher

- **`pnpm prd dispatch`** (`dispatch.mjs`, own tab; `--every <s>`, 60): each tick, the pick (`dispatch-pick.mjs`) does one: **start** (`new.sh prd`, a managed run-through orchestrator), **plan** (`new.sh plan`, an `--auto` planner: opus, Fable for `design`), **resume** after a [limit](recovery.md), **reopen** a dead managed session (counted), or **ask** at the third death. A failed open or `new.sh` is uncounted. `--once`, `--dry-run` (why), `--pause [<why>]`, `--resume`, `--stop`, `--cap <n>|default` (`.loops/.prd-cap`, over `CARETOOK_MAX_PRDS`).
- **The pick**, in order: paused does nothing; [draining](recovery.md) holds all; reopens (not a record `rotating` under 5 minutes; 30 live resets the count); busy stops starts and plans; then starts before plans, in row order, within the cap (unmanaged worktrees take a slot and their hot files), skipping `hold`, `done`, a landed topic (never reopened either), an `After` not done, a hot-file collision, `alone`, and a topic awaiting an answer (not a defaulted one; each tick settles due asks first). A second fixes topic waits while one runs; a fixes topic with fewer than `CARETOOK_FIXES_MIN` (3) waiting items starts only when nothing else may; `idle` never starts. One planner at a time (`CARETOOK_MAX_PLANNERS`), a second while the first waits on an ask. Plans run at most the lane cap + 1 ahead: planned topics not yet started (not `standing`, not `hold`) plus running planners; past that the pick says the lookahead is full (plan early by hand: `pnpm prd plan`). No hold after planning.
- **Its asks:** filed with `pnpm prd ask` (session `dispatch`), a haiku tab pushes it. A later tick acts on the answer: "reopen again" resets the count, "hold the topic" flags the row `hold` (consumed once written).
- **The context follow-up** (`dispatch-context.mjs`; `CARETOOK_CONTEXT_WATCH=off`): a live managed orchestrator, backlog or inbox session over the hard limit, unkept, is nudged `CARETOOK_CONTEXT_NUDGE_MIN` (15) after crossing it, then asked as long again ("rotate it now", or "leave it", the backlog default). It rotates once no `pnpm prd` or `pnpm backlog` command runs under it.
- **The stuck orchestrator** (`dispatch-stuck.mjs`; `CARETOOK_STUCK_WATCH=off`): a managed orchestrator quiet `CARETOOK_STUCK_MIN` (30) (no heartbeat, call, non-wait command or question) or with a watch action unmarked that long: one waiting question, "rotate it now" (mid-wave) or "leave it".
- **The keep-alive** (`keep-alive.mjs`; `CARETOOK_KEEP_SESSIONS=off`, or pause): keeps one managed `backlog` and one `inbox` session open (live: a record, `rotating`, or a `--remote-control` process), outside PRD slots. The inbox needs a trusted folder. Three quick deaths ask.
- **The pickup:** `dev-sync` every `CARETOOK_PICKUP_EVERY` s (300; `off`), unless paused.
- **Session requests** (`session-requests.mjs`, `.loops/.requests/`): one per tick, after the keep-alive, opens `backlog-<name>` (Remote Control `backlog - <name>`), managed, not kept alive, or refuses a live name or past `CARETOOK_MAX_BACKLOG_SESSIONS` (4).
- **New code:** it re-execs between ticks when the main checkout's `scripts/loops/` or `scripts/backlog/` changed (`code` in `.dispatch.json`; status: current, stale or unknown).
- **Files:** `.loops/.dispatch.lock` (pid; dead: taken over), `.dispatch.json`, `.dispatch.log`. An idle tick every six hours runs `prd tidy --yes`.

## The load gate

- `load-gate.mjs`: busy over `CARETOOK_LOAD_BUSY` (5-minute load 20; 30 for quick and slice checks and starts, `CARETOOK_LOAD_LANE=light`); `CARETOOK_LOAD_GATE=off` or unreadable: never busy. Checks (in the lease), browser runs and slice starts wait (`CARETOOK_LOAD_POLL`, 15 s; up to `CARETOOK_LOAD_WAIT`, 600 s); `start` warns.

## The check runner

- **Scripts:** `prompts/<kind>.sh` (two goldens: `vitest -u`), `slice-brief.mjs`, `ci-*.mjs`; `pnpm prd tier`.
- **The log:** `.check-times.log`, 18 fields, last: failed step, files, flaky ones, stopping limit, time verdict, step times.
- **Time gate** (`time-gate.mjs`): a passed quick or slice check, quiet (load ≤ cores) at both ends, else `unjudged`; armed `fail` exits 125. `--times` and `metrics` count tests, budget, silence, time apart.
- **The limits** (`check-budget.mjs`): budget max(2× median, slowest + 20%) of the last 20 passes (mode, branch kind), load-scaled ×1–3, from 10 minutes to the limit (20, full 40, `CARETOOK_CHECK_LIMIT`; alone under 5 runs). Silence: `CARETOOK_CHECK_SILENCE` (480 s), scaled alike. A clock gap over `CARETOOK_CHECK_SLEEP_GAP` (30 s) is sleep. A breach: TERM, KILL after 10 s, the step and last 30 lines, exit 124.
- **The rerun:** a failed test step reruns its failures once, one at a time; a pass there is logged flaky. None after an unhandled error (Vitest's report line only) or past `CARETOOK_CHECK_RERUN_MAX` (20) files.
- **The run log** (`run-log.mjs`, silent on failure): `.loops/.run-log.jsonl` (`CARETOOK_RUN_LOG`): slice and landing spans, browser and Codex results.

## The asks queue

- `.loops/.asks/<id>.json` (main checkout).
- `pnpm prd ask --topic <t> --question <text> --option <a>… --recommend <a> --skeptic <id>` or `--report <text>` prints the id (a question: a PushNotification line), notifies macOS.
- `pnpm prd ask --wait <id> [--timeout <s>]` prints the answer (exit 0; 75 at the timeout, 1 if dismissed). `asks [--json]` lists; `answer <id> <n|text>`; `asks --done <id>` dismisses.
- **Defaults** (`asks.mjs`): a question with `--recommend` must say `--defaults` or `--waits` (neither: nothing filed; [never list](preferences.md#planning-and-slices)). A defaulting one takes its recommendation after `CARETOOK_ASK_DEFAULT_MIN` (30) minutes, settled only by `--wait` and the dispatcher's tick (a shared lock).

## The skeptic

- `skeptics.mjs`, `skeptic.mjs`: one verdict per file in `.loops/.skeptic/` (main checkout). `pnpm prd skeptic record|list`; `prompt skeptic ask|land|plan|stall --evidence <file>` prints the brief. A verdict is bound to its kind, topic, age (`CARETOOK_SKEPTIC_MAX_MIN`, 60), tip and action, question hash or slice; `decide`, or a `stall` restart or leave, on `--waits` is refused.
- **Asks:** a question needs `--skeptic` (an `ask`, a stall `ask` naming its slice, a land `no` or a plan `send-back`, used once), except the dispatcher's. `ask --decided --skeptic <id> --chose <a>` files it settled, unpushed, under _decided for you_.
- **Landing:** `--force` and `--no-review` need `--skeptic <id>` (a `go` for the topic, tip and action) or `--by-user`. On a brake or unsynced tip `--force` needs `--by-user`.

## The notice board

- One-way, advisory (`notices.mjs`, `notice.mjs`): `.loops/.notices/<id>.json` in the main checkout, ids `n1`, `n2`… not reused. `pnpm prd notice "<text>" [--for <min>] [--topic <t>]` (one line, 200 characters; 60 min, 24 h max), `pnpm prd notices [--json]`, `notices --done <id>`.
- `check`, `sync`, `slice`, `browser`, `pr`, `ready` and `land` print live notices first (five lines); `status` counts them.

## Landing reports

- After merging a `prd/` or `hotfix/` branch not Markdown only, `land.sh` writes `to-test/<date>-<HHMM>-<topic>.md` in the main checkout: what landed, commit, PR, dev URL, seed accounts, what wasn't checked (docs-and-tooling-only: commands to try, no dev URL); agents only add. A dependency change runs the install in the main checkout only on dev, at the landed tip, clean; else a notice.
- **Unsynced:** sync, pr, ready and land skip a merge if dev's files miss the branch's (Markdown aside) and the risky list (`dev-brought.mjs`); land needs no brake, a typecheck. Never with `--fixes`; `--force` needs `--by-user`. `sync` always brings dev's CI lists (quarantine, brake): a merge, or a `take dev's CI lists` commit; the recorded check stands.
