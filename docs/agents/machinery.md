# Machinery

The scripts behind `pnpm prd` (`scripts/loops/`): worktrees and leases, recorded sessions and the asks queue.

## Worktrees and leases

- `new.sh <kind>`: `prd <topic>` (`.loops/<topic>`, from `dev`, a stack), `slice <topic> <n>` (`.loops/<topic>-<n>`, from `prd/<topic>`, a stack only for `Stack: yes` or `--stack`), `plan <topic>` and `hotfix <name>` (stackless, from `dev`). Options: `--slot N`, `--stack`/`--no-stack`, `--base B`. An existing branch is checked out, resuming a removed worktree. Secrets come from the main checkout's env files.
- **Slots** (1–19) are lock directories in `.loops/.slots/<N>`, taken atomically; a slot is also busy while a `.env` names it or a port listens. Ports: [loop](loop.md#your-worktree-and-stack).
- **The shared test Postgres** (`pnpm prd test-db`, :5436, tmpfs, Compose project `caretook-shared-test`): a database per worktree, dropped by `rm.sh`; `test-db down` deletes them all.
- `pnpm prd status` flags landed `merged:` slice worktrees and `stopped stack:`s (over `CARETOOK_GC_STOPPED_HOURS`, 24); `gc` removes them after a yes. **The disk guard** refuses a new stack or check build under `CARETOOK_MIN_FREE_GB` (10) free; `reclaim` frees merged worktrees, dangling volumes and images, check builds and Vite caches (never the main checkout's, a dirty worktree, or a running server's caches).
- **A merged slice is held** until its wave has landed and no run of its topic is out (`scripts/ci/outstanding.mjs`: a `ci/` ref whose commit has a CI run going or none yet; unreadable GitHub holds too): `tidy`, `gc` and `reclaim` keep it and say why; `pnpm prd rm` doesn't check.
- **`pnpm prd tidy`** lists leftovers as **safe** (merged clean slice worktrees with nothing running in them, landed plan worktrees, dead lease and slot tickets, orphan test databases, stale remote refs, dangling `caretook` volumes, week-old browser-hang logs, ended records with no worktree) or **ask** (live sessions that look finished, branches with no worktree, items to archive, registry rows that look done; `hold` rows are skipped). `--yes` removes the safe ones and files the ask list as one `pnpm prd ask --report`; `--json` only lists. When `lsof` fails, every worktree is kept. Never: a dirty worktree, live caches, the main checkout, an unmerged branch, a session. `pnpm prd prompt tidy` is a haiku brief that runs it every few hours with `/loop` and asks finished-looking sessions over SendMessage.
- `rm.sh <name>` removes the worktree, its stack, database files and slot, and deletes the branch if merged into its parent; it refuses uncommitted changes, or a PRD with slice worktrees left, unless `--force`.
- **`pnpm prd dev-sync`** (run by `land`) brings the main checkout's `dev` up to `origin`: a fast-forward, else it rebases unpushed backlog-tool commits, else a merge commit; it stops on uncommitted edits to files the landing changed.
- **Machine leases** (`lease.sh`, `lease.mjs`): `browser` 2, `check` 2, others 1 (`CARETOOK_<KIND>_SLOTS`), lock directories in `.loops/.lease/<kind>/<N>`, taken over from dead holders. Waits are bounded (`CARETOOK_<KIND>_WAIT`; browser 20 min, check 30) and give up with exit 75. `CARETOOK_LEASES=off` takes none.
- **`pnpm prd wait [check|browser|<kind>] [--timeout S] [--worktree W]`** (`lease.sh wait`) blocks until the worktree's lease, held or queued, is gone; 75 at the timeout (3600 s). Never `pgrep -f`.

## Recorded sessions

- **`session.sh <name> [--kind prd|plan|backlog|hotfix|recovery] [--topic <t>] [--auto] [--managed] -- <claude args>`** runs `claude` (`CARETOOK_CLAUDE_BIN` in tests) in the foreground and keeps a record in the main checkout's `.loops/.sessions/<name>.json`: `pid` (claude's own), `kind`, `topic`, `started`, `command`, `auto`, `managed` (the dispatcher started it), `model`, `rotating`, and `ended` and `exit` once it exits. Names are `prd-<topic>`, `plan-<topic>`, `backlog`, `backlog-<name>`, `hotfix-<name>` and `recover`. Records outlive the session; `rm.sh` deletes the worktree's, and `tidy` an ended backlog or recovery one. Nothing is written inside a worktree.
- `pnpm prd start`'s printed command, the dispatcher, `prd plan` (with or without a topic), `prd hotfix`, `recover.sh` and the opener all start through it.
- **Live** means no `ended`, the pid exists and that process started within a minute of `started` (a reused pid isn't). `node scripts/loops/sessions.mjs self` prints the calling shell's session pid: its worktree's live record, else its ancestor `claude` process.
- **`pnpm prd end [<name>]`** ends a session (TERM, KILL after `CARETOOK_END_WAIT`, 10 s): the named record, or with no name the caller's own, so it works after `pnpm prd rm`. With neither a record nor an ancestor it refuses.
- **The opener** (`open-session.sh`) writes `cd <dir> && exec …` to the tab it made, so the tab closes with the session. It carries a record's `auto` and `managed` over (an `auto` planner reopens with `--auto`) and opens fresh, never `--continue`, after a `rotating` record. Backlog and recovery sessions always reopen fresh in the main checkout on their recorded model (`--continue` there would resume another conversation); a hotfix reopens with `--continue` in its worktree; a live one of these three is refused. `--background` doesn't bring iTerm2 forward and reselects the earlier tab.

## Rotation

- **`pnpm prd rotate [<topic>] [--mid-wave] [--reason <text>]`** (`rotate.sh`) finds the session to end (the live `prd-<topic>` record, else the calling shell's ancestor `claude` from that worktree) and opens `rotate-into.sh` in a background tab, then returns. It refuses with uncommitted plan changes, with a requested run out or GitHub unreadable, with slice worktrees left (those two unless `--mid-wave`), or with no session found. A leftover `ci/` ref with no run counts as out. Without iTerm2 it prints the command and ends nothing.
- `rotate-into.sh <name> <pid>` sets `rotating`, ends the pid (TERM, KILL after `CARETOOK_ROTATE_WAIT`, 20 s), waits for its wrapper to record the end, then execs `session.sh` with `prompt.sh orchestrator <topic> --resume` (`--auto` from the record or _Status_): fresh, the same name.
- **`rotate --self [--brief <file>]`** finds the caller by its ancestor `claude` pid. A backlog session reopens fresh in the main checkout (same name, model, Remote Control), the brief on top of its prompt; an orchestrator rotates as plain `rotate`; other kinds and `slice/` branches are refused. `--brief-path` prints where to write the brief; a stale one is deleted at session start.
- `rm.sh`, removing a merged `prd/` worktree whose _Status_ has no slice left, sets the registry's `done` flag (dropping `hold`), except for a `standing` topic.
- `pnpm prd status` adds the recorded sessions (ended over a day ago left out), pending session requests, the open asks and _Slices_: each slice working, handed off, waiting for the run, or fixing.

## The context watch

- **The hook** (`context.mjs`, from `context-settings.json`): `session.sh` passes `claude --settings` for `prd` and backlog sessions (named ones too), so the user's own sessions and planners never run it. After each tool call it reads the size (the transcript's last assistant usage), writes the record and stays silent under `CARETOOK_CONTEXT_LIMIT` (160,000; subagents: below). Over it, it reminds at the first crossing and every `CARETOOK_CONTEXT_REMIND_MIN` (10). It never blocks a tool call and always exits 0.
- **A subagent** is sized from its own transcript (unreadable: silent); a backlog session's get nothing. Past **175k** it's asked to judge, again every further 25k; past **300k** told to hand off each call.
- **The size record:** `.loops/.context/<name>.json` in the main checkout (subagents under `.agents/<name>/`). A record whose pid isn't the live session's is ignored.
- **`pnpm prd context`** prints the session's size (a subagent's shell: its orchestrator's) and the limit; `--all [--json]` lists live sessions; `--keep "<why>"` silences the watch for `CARETOOK_CONTEXT_KEEP_MIN` (30). It's refused on a `slice/` branch.

## The dispatcher

- **`pnpm prd dispatch`** (`dispatch.mjs`; the user starts it in a tab of its own; `--every <s>`, 60): each tick gathers the facts, asks the pure pick (`dispatch-pick.mjs`) for one action and does it: **start** (`new.sh prd`, then a managed run-through orchestrator), **plan** (`new.sh plan`, a managed `--auto` planner on opus), **reopen** a dead managed session (the opener, counted), or **ask** after the third death. The record is written before the tab opens. `--once`, `--dry-run` (writes nothing; shows each passed-over reason), `--pause [<why>]`, `--resume`, `--stop` work from any shell. Without iTerm2 only `--dry-run` runs.
- **The pick**, in order: paused does nothing; reopens (not a record `rotating` under five minutes; a session live 30 minutes resets its count); busy stops starts and plans; then starts before plans, in row order, within `CARETOOK_MAX_PRDS` (unmanaged worktrees are only reported but take a slot and their hot files), skipping `hold`, `done`, an `After` not done, a hot-file collision (prefixes as plain text), `alone`, and a topic with a question awaiting an answer (a defaulted one doesn't count; each tick settles due asks first). A second fixes topic waits while one runs; a fixes topic with fewer than `CARETOOK_FIXES_MIN` (3) waiting items starts only when nothing else may; `idle` never starts. One planner at a time (`CARETOOK_MAX_PLANNERS`), a second only while the first waits on an ask. No hold after planning.
- **Its asks:** filed with `pnpm prd ask` (session `dispatch`), then a one-shot haiku helper tab sends the PushNotification and ends. A later tick acts on the answer: "reopen again" resets the count, "hold the topic" flags the row `hold`.
- **The context follow-up** (`dispatch-context.mjs`; `CARETOOK_CONTEXT_WATCH=off`): a live managed orchestrator or backlog session over the limit, unkept, is nudged `CARETOOK_CONTEXT_NUDGE_MIN` (15) after its first reminder and asked the same wait after delivery ("rotate it now", the default, or "leave it"). It rotates once no `pnpm prd` or `pnpm backlog` command runs under it: an orchestrator mid-wave; a backlog session through `rotate-into.sh`, with a brief newer than the delivery, else `--no-brief`.
- **The keep-alive** (`keep-alive.mjs`; `CARETOOK_KEEP_SESSIONS=off`, or pause): opens a managed `backlog` session when none is live (a record, one `rotating`, or a `--remote-control backlog` process), outside the PRD slots. Three quick deaths ask "open again" or "stop keeping it alive".
- **Session requests** (`session-requests.mjs`, `.loops/.requests/`): one per tick, after the keep-alive, opens `backlog-<name>` (Remote Control `backlog - <name>`), managed, not kept alive, or refuses a live name or past `CARETOOK_MAX_BACKLOG_SESSIONS` (4). A notice says which.
- **Files** in the main checkout's `.loops/`: `.dispatch.lock` (pid; a dead one is taken over), `.dispatch.json`, `.dispatch.log`. On an idle tick every six hours it runs `pnpm prd tidy --yes`.

## The load gate

- `load-gate.mjs`: busy when the 5-minute load is above `CARETOOK_LOAD_BUSY` (default 20, twice the cores: full checks, browser checks, the dispatcher; 30 for quick and slice checks and slice starts, through `CARETOOK_LOAD_LANE=light`); `CARETOOK_LOAD_GATE=off` and an unreadable load are never busy. A check (inside its check lease, which it holds while waiting), a browser run (before its lease) and a slice worktree's creation wait while busy, polling every `CARETOOK_LOAD_POLL` (15 s), at most `CARETOOK_LOAD_WAIT` (600 s), then proceed and say so. `pnpm prd start` only warns, the dispatcher starts and plans nothing, `pnpm prd status` prints the gate line.

## The check runner

- **The log:** `.check-times.log` lines have 15 fields; the last three are the failed step, the failed test files and the flaky ones.
- **The limit:** 20 minutes for a slice or quick check, 40 for a full one (`CARETOOK_CHECK_LIMIT`). Past it, TERM to the process tree, KILL after `CARETOOK_CHECK_KILL_GRACE` (10 s), exit 124, and the step is logged.
- **The rerun:** a failed test step reruns only its failed files, once, one at a time; a pass there passes the check and logs them as flaky. No rerun after an unhandled error, or past `CARETOOK_CHECK_RERUN_MAX` (20) failed files.
- **Static steps:** one typegen, then tsc, ESLint and Prettier side by side.

## The asks queue

- `.loops/.asks/<id>.json` in the main checkout (`CARETOOK_ASKS_DIR`), ids `a1`…, created exclusively. A question waits until answered, dismissed or defaulted; a report until dismissed.
- `pnpm prd ask --topic <t> --question <text> --option <a>… --recommend <a>` or `--report <text>` prints the id and, for a question only, a PushNotification line; it shows a macOS notification and runs `$CARETOOK_ASK_NOTIFY <id> <kind> <topic> <text>` when set (failures ignored, `CARETOOK_ASK_NOTIFY_TIMEOUT`).
- `pnpm prd ask --wait <id> [--timeout <s>]` prints the answer (exit 0; 75 at the timeout, 1 if dismissed). `pnpm prd asks [--json]` lists them oldest first; `pnpm prd answer <id> <n|text>`; `pnpm prd asks --done <id>` dismisses.
- **Defaults** (`asks.mjs`): a question with `--recommend` must say `--defaults` or `--waits` (neither files nothing and names the [never list](preferences.md#planning-and-slices)). A defaulting one takes its recommendation `CARETOOK_ASK_DEFAULT_MIN` (30) minutes after it was asked, settled only by `--wait` and the dispatcher's tick; answering and settling share a lock, so the first wins. The push line and listing show when (`due` once past, still answerable); a defaulted ask is listed under _decided for you_ until dismissed and can't be answered. The dispatcher's own question waits.

## The skeptic

- `skeptics.mjs`, `skeptic.mjs`: one verdict per file in `.loops/.skeptic/` (main checkout, `CARETOOK_SKEPTIC_DIR`), ids `s1`…. `pnpm prd skeptic record|list`; `pnpm prd prompt skeptic ask|land|plan --evidence <file>` prints the brief. A verdict is bound to its kind, topic, age (`CARETOOK_SKEPTIC_MAX_MIN`, 60), tip and action or question hash; `decide` on `--waits` is refused.

## The notice board

- One-way and advisory (`notices.mjs`, `notice.mjs`): `.loops/.notices/<id>.json` in the main checkout (`CARETOOK_NOTICES_DIR`), ids `n1`, `n2`… never reused. `pnpm prd notice "<text>" [--for <min>] [--topic <t>]` (one line, 200 characters; 60 minutes, 24 hours at most), `pnpm prd notices [--json]`, `notices --done <id>`.
- `check`, `sync`, `slice`, `browser`, `pr`, `ready` and `land` print other sessions' live notices to stderr first (five lines at most; a slice counts as its orchestrator's session); `pnpm prd status` prints all. Notices never block or change an exit.
- A code landing posts "landed `<branch>` in dev as `<sha>`: sync at your next wave boundary" for six hours.

## Landing reports

- After merging a `prd/` or `hotfix/` branch whose diff isn't Markdown only, `land.sh` writes `to-test/<date>-<HHMM>-<topic>.md` in the main checkout, so it survives the session: what landed, commit and PR, dev URL, seed accounts, what wasn't checked. Agents only add to them.
- **Unsynced:** land skips the sync if dev's new files miss the branch and the risky list (`dev-brought.mjs`), dev has no known brake and the merge typechecks. Never with `--force`/`--fixes`.
