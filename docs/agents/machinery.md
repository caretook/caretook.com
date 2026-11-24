# Machinery

What runs `pnpm prd` (`scripts/loops/`).

## Worktrees and leases

- `new.sh <kind>`: `prd <topic>` (`.loops/<topic>`, from `dev`, a stack), `slice <topic> <n>` (`.loops/<topic>-<n>`, from `prd/<topic>`, a stack only for `Stack: yes` or `--stack`), `plan <topic>` and `hotfix <name>` (stackless, from `dev`). Options: `--slot N`, `--stack`/`--no-stack`, `--base B`. An existing branch is checked out, resuming a removed worktree. Secrets come from the main checkout's env files.
- **Slots** (1–19): atomic locks in `.loops/.slots/<N>`, also busy while a `.env` names one or a port listens. Ports: [loop](loop.md#your-worktree-and-stack).
- **The shared test Postgres** (`pnpm prd test-db`, :5436, tmpfs, Compose project `caretook-shared-test`): a database per worktree, dropped by `rm.sh`; `test-db down` deletes them all.
- `pnpm prd status` flags landed `merged:` slice worktrees and `stopped stack:`s (over `CARETOOK_GC_STOPPED_HOURS`, 24); `gc` removes them on a yes. **The disk guard** refuses a stack or check build under `CARETOOK_MIN_FREE_GB` (10); `reclaim` frees merged worktrees, dangling Docker data, check builds and Vite caches (never in use).
- **A merged slice is held** until its wave has landed and no run of its topic is out (`scripts/ci/outstanding.mjs`; unreadable GitHub holds too): `tidy`, `gc` and `reclaim` keep it and say why; `pnpm prd rm` doesn't check.
- **`pnpm prd tidy`** lists leftovers as **safe** or **ask**. `--yes` removes the safe ones, files the ask list as a report; `--json` lists. Never dirty worktrees, live caches, the main checkout, unmerged branches, sessions.
- `rm.sh <name>` removes the worktree, stack, database files and slot, and the branch if merged; it refuses uncommitted changes, or a PRD with slice worktrees left, unless `--force`; `--no-registry` leaves the registry alone.
- **`pnpm prd dev-sync`** (`land`; `pr`'s push when `origin/dev` is ahead) brings `dev` up to `origin`: a fast-forward, else a replay of backlog commits no other ref holds, else a merge. The inbox never stops it (`inbox-merge.mjs`); another file's conflict or edits do. `land` picks up only backlog files and CI's lists.
- **Machine leases** (`lease.sh`, `lease.mjs`): `browser` 2, `check` 2, others 1 (`CARETOOK_<KIND>_SLOTS`), locks in `.loops/.lease/<kind>/<N>`, taken over from dead holders. Bounded waits (`CARETOOK_<KIND>_WAIT`; browser 20 min, check 30), then 75. `CARETOOK_LEASES=off` takes none.
- **`pnpm prd wait [check|browser|<kind>] [--timeout S] [--worktree W]`** (`lease.sh wait`) blocks until the worktree's lease, held or queued, is gone; 75 at the timeout (3600 s). Never `pgrep -f`.

## Recorded sessions

- **`session.sh <name> [--kind <k>] [--topic <t>] [--auto] [--managed] -- <claude args>`** runs `claude` (`CARETOOK_CLAUDE_BIN` in tests) and keeps a record in the main checkout's `.loops/.sessions/<name>.json` (`pid`, claude's own; `kind`, `topic`, `started`, `rotating`, `ended`, …). Records outlive the session (`rm.sh`, `tidy` delete them).
- **Live:** no `ended`, and the pid exists, started within a minute of `started`.
- **`pnpm prd end [<name>]`** ends the named session, else the caller's (TERM, KILL after `CARETOOK_END_WAIT`, 10 s).
- **`pnpm prd bye`** (`bye.mjs`; `--dry-run`, `--json`), on just 'bye': by role, what's open: uncommitted or unpushed work, worktrees, unmerged branches, a stack or server, a lease, background shells, unanswered questions. Clean: the hand-off line, its own leases freed, `end` (a slice only reports). Else each thing, exit 3, nothing closed.
- **The opener** (`open-session.sh`) writes `cd <dir> && exec …` to its tab, which closes with the session. It carries `auto` and `managed` over and opens fresh after a `rotating` record. Backlog and recovery reopen fresh in the main checkout on their model; inbox via `prd.sh inbox` with its `dir` and model; a hotfix with `--continue` in its worktree; a live one is refused.

## Rotation

- **`pnpm prd rotate [<topic>] [--mid-wave] [--reason <text>]`** (`rotate.sh`) finds the session (the live `prd-<topic>` record, else the shell's ancestor `claude`) and opens `rotate-into.sh` in a background tab. It refuses with uncommitted plan changes, a requested run out or GitHub unreadable, slice worktrees left (those two unless `--mid-wave`), or no session. A leftover `ci/` ref counts as out.
- `rotate-into.sh <name> <pid>` sets `rotating`, ends the pid (as `end`; `CARETOOK_ROTATE_WAIT`, 20 s), waits for the recorded end, then execs `session.sh` with `prompt.sh orchestrator <topic> --resume` (`--auto` from the record or _Status_): fresh, the same name.
- **`rotate --self [--brief <file>]`** finds the caller by its ancestor `claude` pid. A backlog session reopens fresh in the main checkout (same record and model), the brief on top of its prompt; an orchestrator rotates as plain `rotate`; other kinds and `slice/` branches are refused. `--brief-path` prints where to write the brief; a stale one is deleted at session start.
- **Captains** (`captain.mjs`): the main backlog session's Remote Control name and tab title is a captain, drawn at each start, rotate, hand-off and reopen, never the last; the record stays `backlog`; a `--remote-control <Captain>` process is live. Its prompt names it (`CARETOOK_CAPTAIN`), never in questions or commands.
- `rm.sh`, removing a merged `prd/` worktree whose _Status_ has no slice left, sets the registry's `done` flag (dropping `hold`), except for a `standing` topic.
- `pnpm prd status` adds the recorded sessions, session requests, open asks, _Slices_ (working, handed off, waiting, fixing) and WORKERS ([heartbeat](#the-context-watch)).

## The context watch

- **The hook** (`context.mjs`, from `context-settings.json`): `session.sh` passes `claude --settings` for `prd`, backlog and inbox sessions, never the user's own or planners. After each tool call it records the size; silent under the soft `CARETOOK_CONTEXT_LIMIT` (160,000; subagents: below); past it a judge reminder every 25k, past the hard `CARETOOK_CONTEXT_HARD_LIMIT` (225,000) a rotate one every `CARETOOK_CONTEXT_REMIND_MIN` (10). Backlog: soft only (it asks; silence keeps going). Inbox: hard = soft. It never blocks.
- **The heartbeat** (`heartbeat.mjs`, on every tool and stop event): each agent's open calls, last start and end, and stop, in `.loops/.heartbeat/<session>/<agent>.json`; its worktree: the `.loops/<name>` its calls name most (none: unknown). `workers.mjs` adds leases, commits, unignored changes and live processes: `pnpm prd status`'s WORKERS.
- **`pnpm prd watch [<topic>]`** (`watch.mjs`, pure `decide`): each slice agent's state (quiet: 20 min, no-progress: 45) and action: nudge, restart (10 min after an unreplied nudge), skeptic (dirty tree, migration, merge, second stall). Never on a running command, lease, handed-off, stopped or unknown agent, open ask, or several quiet at once (one finding); sleep resets clocks. `--wait` exits with it; `--mark` in `.loops/.watch/<topic>/`.
- **A subagent** is sized from its own transcript; a backlog session's get nothing. Past **175k** it's asked to judge, again every further 25k; past **300k** told to hand off each call.
- **The size record:** `.loops/.context/<name>.json` in the main checkout (subagents: `.agents/<name>/`); a stale pid's is ignored.
- **`pnpm prd context`** prints the session's size and both limits; `--all [--json]` lists live sessions; `--keep "<why>"` silences the watch for `CARETOOK_CONTEXT_KEEP_MIN` (30). It's refused on a `slice/` branch.

## The dispatcher

- **`pnpm prd dispatch`** (`dispatch.mjs`, its own tab; `--every <s>`, 60): each tick the pick (`dispatch-pick.mjs`) takes one action: **start** (`new.sh prd`, then a managed run-through orchestrator), **plan** (`new.sh plan`, a managed `--auto` planner on opus, Fable for a `design` row), **reopen** a dead managed session (counted), or **ask** after the third death. A failed open or `new.sh`: uncounted, worktree removed. `--once`, `--dry-run` (why), `--pause [<why>]`, `--resume`, `--stop`, `--cap <n>|default` (`.loops/.prd-cap`, over `CARETOOK_MAX_PRDS`). No iTerm2: `--dry-run` only.
- **The pick**, in order: paused does nothing; reopens (not a record `rotating` under five minutes; 30 minutes live resets the count); busy stops starts and plans; then starts before plans, in row order, within the cap (unmanaged worktrees take a slot and their hot files), skipping `hold`, `done`, an `After` not done, a hot-file collision, `alone`, and a topic with a question awaiting an answer (a defaulted one doesn't count; each tick settles due asks first). A second fixes topic waits while one runs; a fixes topic with fewer than `CARETOOK_FIXES_MIN` (3) waiting items starts only when nothing else may; `idle` never starts. One planner at a time (`CARETOOK_MAX_PLANNERS`), a second only while the first waits on an ask. No hold after planning.
- **Its asks:** filed with `pnpm prd ask` (session `dispatch`), then a one-shot haiku helper tab sends the PushNotification and ends. A later tick acts on the answer: "reopen again" resets the count, "hold the topic" flags the row `hold` (consumed once written).
- **The context follow-up** (`dispatch-context.mjs`; `CARETOOK_CONTEXT_WATCH=off`): a live managed orchestrator, backlog or inbox session over the hard limit, unkept, is nudged `CARETOOK_CONTEXT_NUDGE_MIN` (15) after crossing it and asked the same wait after delivery ("rotate it now", or "leave it", the backlog default). It rotates once no `pnpm prd` or `pnpm backlog` command runs under it: an orchestrator mid-wave; backlog through `rotate-into.sh` (a newer brief, else `--no-brief`); inbox with none.
- **The keep-alive** (`keep-alive.mjs`; `CARETOOK_KEEP_SESSIONS=off`, or pause): keeps one managed `backlog` and one `inbox` session open (live: a record, one `rotating`, or a `--remote-control <kind>` process), outside the PRD slots. The inbox one needs a trusted folder: open it by hand first. Three quick deaths ask whether to keep it.
- **The pickup:** `prd.sh dev-sync` every `CARETOOK_PICKUP_EVERY` s (300; `off`), not while paused, at most 120 s (`lastPickup` in `.dispatch.json`); failures log a line.
- **Session requests** (`session-requests.mjs`, `.loops/.requests/`): one per tick, after the keep-alive, opens `backlog-<name>` (Remote Control `backlog - <name>`), managed, not kept alive, or refuses a live name or past `CARETOOK_MAX_BACKLOG_SESSIONS` (4). A notice says which.
- **Files:** `.loops/.dispatch.lock` (pid; a dead one is taken over), `.dispatch.json`, `.dispatch.log`. On an idle tick every six hours it runs `pnpm prd tidy --yes`.

## The load gate

- `load-gate.mjs`: busy over `CARETOOK_LOAD_BUSY` (5-minute load 20; 30 for quick and slice checks and starts, `CARETOOK_LOAD_LANE=light`); `CARETOOK_LOAD_GATE=off` or an unreadable load is never busy. Checks (in the lease), browser runs (before it) and slice starts wait, polling `CARETOOK_LOAD_POLL` (15 s) up to `CARETOOK_LOAD_WAIT` (600 s). `start` warns; the dispatcher starts and plans nothing.

## The check runner

- **Scripts:** `prompts/<kind>.sh` (golden: `CARETOOK_UPDATE_GOLDEN=1`), `slice-brief.mjs`, `ci-*.mjs`; lint at 6 GB; `pnpm prd tier`.
- **The log:** `.check-times.log`, 16 fields; the last four: failed step, failed files, flaky ones, the limit that stopped it.
- **The limits** (`check-budget.mjs`): the budget, max(2× median, slowest + 20%) of the last 20 passes of that mode and branch kind, load-scaled ×1–3, between 10 minutes and the hard limit (20, full 40, `CARETOOK_CHECK_LIMIT`; it alone under 5 runs). Silence: `CARETOOK_CHECK_SILENCE` (480 s), scaled alike. A clock gap over `CARETOOK_CHECK_SLEEP_GAP` (30 s) is sleep and counts for neither. A breach: TERM to the tree, KILL after 10 s, step and last 30 lines, exit 124.
- **The rerun:** a failed test step reruns only its failed files, once, one at a time; a pass there passes the check and logs them as flaky. No rerun after an unhandled error, or past `CARETOOK_CHECK_RERUN_MAX` (20) failed files.
- **The run log** (`run-log.mjs`, silent on failure): `.loops/.run-log.jsonl` (`CARETOOK_RUN_LOG`), JSON lines: slice and landing start and end, browser results, Codex verdicts once per PR and head. `pnpm prd metrics` sums it with the check and flake logs.

## The asks queue

- `.loops/.asks/<id>.json` (main checkout, `CARETOOK_ASKS_DIR`).
- `pnpm prd ask --topic <t> --question <text> --option <a>… --recommend <a> --skeptic <id>` or `--report <text>` prints the id (a question: a PushNotification line), notifies macOS and runs `$CARETOOK_ASK_NOTIFY <id> <kind> <topic> <text>` when set (`CARETOOK_ASK_NOTIFY_TIMEOUT`).
- `pnpm prd ask --wait <id> [--timeout <s>]` prints the answer (exit 0; 75 at the timeout, 1 if dismissed). `asks [--json]` lists; `answer <id> <n|text>`; `asks --done <id>` dismisses.
- **Defaults** (`asks.mjs`): a question with `--recommend` must say `--defaults` or `--waits` (neither: nothing filed; see the [never list](preferences.md#planning-and-slices)). A defaulting one takes its recommendation after `CARETOOK_ASK_DEFAULT_MIN` (30) minutes, settled only by `--wait` and the dispatcher's tick (a shared lock; a stale one is taken atomically). A defaulted ask stays in _decided for you_ until dismissed; the dispatcher's waits.

## The skeptic

- `skeptics.mjs`, `skeptic.mjs`: one verdict per file in `.loops/.skeptic/` (main checkout, `CARETOOK_SKEPTIC_DIR`), ids `s1`…. `pnpm prd skeptic record|list`; `pnpm prd prompt skeptic ask|land|plan --evidence <file>` prints the brief. A verdict is bound to its kind, topic, age (`CARETOOK_SKEPTIC_MAX_MIN`, 60), tip and action or question hash; `decide` on `--waits` is refused.
- **Asks:** a question needs `--skeptic` (an `ask`, a land `no` or a plan `send-back`, used once), except the dispatcher's. `ask --decided --skeptic <id> --chose <a>` files it settled, unpushed, under _decided for you_.
- **Landing:** `--force` and `--no-review` need `--skeptic <id>` (a `go` for the topic, tip and action) or `--by-user`; Codex out of credits needs neither. On a brake or unsynced tip `--force` needs `--by-user`. The report lists the verdicts and Codex declines since the last landing.

## The notice board

- One-way and advisory (`notices.mjs`, `notice.mjs`): `.loops/.notices/<id>.json` in the main checkout (`CARETOOK_NOTICES_DIR`), ids `n1`, `n2`… never reused. `pnpm prd notice "<text>" [--for <min>] [--topic <t>]` (one line, 200 characters; 60 min, 24 h at most), `pnpm prd notices [--json]`, `notices --done <id>`.
- `check`, `sync`, `slice`, `browser`, `pr`, `ready` and `land` print live notices first (five lines); `status` counts them. Never blocking.
- A code landing posts a "sync at your next wave boundary" notice for six hours.

## Landing reports

- After merging a `prd/` or `hotfix/` branch not Markdown only, `land.sh` writes `to-test/<date>-<HHMM>-<topic>.md` in the main checkout: what landed, commit, PR, dev URL, seed accounts, what wasn't checked; agents only add.
- **Unsynced:** sync, pr, ready and land skip a merge if dev's files miss the branch's (Markdown aside) and the risky list (`dev-brought.mjs`); land needs no brake, a typecheck. Never with `--fixes`; `--force` needs `--by-user`. `sync` always brings dev's CI lists (quarantine, brake): a merge, or a `take dev's CI lists` commit; the recorded check stands.
