# Machinery

The scripts behind `pnpm prd` (`scripts/loops/`) that every session leans on: worktrees and leases, recorded sessions and the asks queue. Moved out of [orchestrator](orchestrator.md).

## Worktrees and leases

- `new.sh <kind>`: `prd <topic>` (`.loops/<topic>`, from `dev`, a stack), `slice <topic> <n>` (`.loops/<topic>-<n>`, from `prd/<topic>`, a stack only for `Stack: yes` or `--stack`), `plan <topic>` and `hotfix <name>` (stackless, from `dev`). Options: `--slot N`, `--stack`/`--no-stack`, `--base B`. An existing branch is checked out, resuming a removed worktree. Secrets come from the main checkout's env files.
- **Slots** (1–19) are lock directories in `.loops/.slots/<N>`, taken atomically; a slot is also busy while a `.env` names it or a port listens. Ports: [loop](loop.md#your-worktree-and-stack).
- **The shared test Postgres** (`pnpm prd test-db`, :5436, tmpfs, Compose project `caretook-shared-test`): a database per worktree, dropped by `rm.sh`; `test-db down` deletes them all. Older worktrees keep a `-test` container or switch with `test-db use`.
- `pnpm prd status` flags `merged:` slice worktrees and `stopped stack:`s (over `CARETOOK_GC_STOPPED_HOURS`, 24); `gc` removes them after a yes. **The disk guard** refuses a new stack or check build under `CARETOOK_MIN_FREE_GB` (10) free; `reclaim` frees merged worktrees, dangling volumes and images, check builds and Vite caches (never the main checkout's, a dirty worktree, or a running server's caches).
- **`pnpm prd tidy`** (`tidy.mjs` sorts, `tidy-cli.mjs` collects and acts) lists leftovers as **safe** (merged clean slice worktrees with nothing running in them, landed plan worktrees, dead lease, queue and slot tickets, orphan test databases, stale remote refs, dangling `caretook` volumes, week-old browser-hang logs, ended records with no worktree) or **ask** (live sessions that look finished, branches with no worktree, items to archive, registry rows that look done; `hold` rows are skipped). `--yes` removes the safe ones and files the ask list as one `pnpm prd ask --report`; `--json` only lists. Never: a dirty worktree, live caches, the main checkout, an unmerged branch, a session. `pnpm prd prompt tidy` is a haiku brief that runs it every few hours with `/loop` and asks finished-looking sessions over SendMessage.
- `rm.sh <name>` removes the worktree, its stack, database files and slot, and deletes the branch if merged into its parent; it refuses uncommitted changes, or a PRD with slice worktrees left, unless `--force`.
- **`pnpm prd dev-sync`** (run by `land`) brings the main checkout's `dev` up to `origin`: a fast-forward, else it rebases unpushed backlog-tool commits, else a merge commit; it stops on uncommitted edits to files the landing changed.
- **Machine leases** (`lease.sh`, `lease.mjs`): `browser` 3, `check` 2, others 1 (`CARETOOK_<KIND>_SLOTS`), lock directories in `.loops/.lease/<kind>/<N>`, taken over from dead holders. Waits are bounded (`CARETOOK_<KIND>_WAIT`; browser 20 min, check 30) and give up with exit 75. `CARETOOK_LEASES=off` takes none.

## Recorded sessions

- **`session.sh <name> [--kind prd|plan] [--topic <t>] [--auto] -- <claude args>`** runs `claude` (`CARETOOK_CLAUDE_BIN` in tests) in the foreground and keeps a record in the main checkout's `.loops/.sessions/<name>.json`: `pid` (claude's own), `kind`, `topic`, `started`, `command`, `auto`, `rotating`, and `ended` and `exit` once it exits. Names are `prd-<topic>` and `plan-<topic>`. Records outlive the session; `rm.sh` deletes the worktree's. Nothing is written inside a worktree.
- `pnpm prd start`'s printed command, `queue.sh` (`--auto` unless `--manual`), `prd plan --open` and the opener all start through it.
- **Live** means no `ended`, the pid exists and that process started within a minute of `started` (a reused pid isn't). `node scripts/loops/sessions.mjs self` prints the calling shell's session pid: its worktree's live record, else its ancestor `claude` process (a session started before the wrapper).
- **`pnpm prd end [<name>]`** ends a session (TERM, KILL after `CARETOOK_END_WAIT`, 10 s): the named record, or with no name the caller's own, so it works after `pnpm prd rm`. With neither a record nor an ancestor it refuses.
- **The opener** (`open-session.sh`) writes `cd <dir> && exec …` to the tab it made, so the tab closes with the session. It carries a record's `auto` over and opens fresh, never `--continue`, after a `rotating` record. `--background` doesn't bring iTerm2 forward and reselects the earlier tab; `--command <line> --title <t>` opens any line.

## Rotation

- **`pnpm prd rotate [<topic>] [--mid-wave] [--reason <text>]`** (`rotate.sh`) finds the session to end (the live `prd-<topic>` record, else the calling shell's ancestor `claude` from that worktree) and opens `rotate-into.sh` in a background tab, then returns. It refuses with uncommitted plan changes, with slice worktrees left (unless `--mid-wave`), or with no session found. Without iTerm2 it prints the command and ends nothing.
- `rotate-into.sh <name> <pid>` sets `rotating`, ends the pid (TERM, KILL after `CARETOOK_ROTATE_WAIT`, 20 s), waits for its wrapper to record the end, then execs `session.sh` with `prompt.sh orchestrator <topic> --resume` (`--auto` from the record or _Status_): fresh, the same name.
- `rm.sh`, removing a merged `prd/` worktree whose _Status_ has no slice left, sets the registry's `done` flag (dropping `hold`), except for a `standing` topic.
- `pnpm prd status` adds the recorded sessions (live, rotating or ended, age, run-through; ended over a day ago left out) and the open asks (count, the oldest).

## The asks queue

- One place for the user to answer: `.loops/.asks/<id>.json` in the main checkout (`CARETOOK_ASKS_DIR`), ids `a1`, `a2`…, created exclusively. A question stays open until answered or dismissed; a report until dismissed.
- `pnpm prd ask --topic <t> --question <text> --option <a>… --recommend <a>` or `--report <text>` (the topic and session default to the worktree's) prints the id and a "Now send a PushNotification" line; it shows a macOS notification and runs `$CARETOOK_ASK_NOTIFY <id> <kind> <topic> <text>` when set (failures and hangs ignored, `CARETOOK_ASK_NOTIFY_TIMEOUT`).
- `pnpm prd ask --wait <id> [--timeout <s>]` prints the answer (exit 0; 75 at the timeout, 1 if dismissed). `pnpm prd asks [--json]` lists the open ones oldest first; `pnpm prd answer <id> <n|text>`; `pnpm prd asks --done <id>` dismisses.

## Landing reports

- After merging a `prd/` or `hotfix/` branch (fix topics included) whose diff isn't Markdown only (`docs_only` in `lib.sh`), `land.sh` writes `to-test/<date>-<HHMM>-<topic>.md` in the main checkout (gitignored), itself, so it exists even if the session dies: the topic's title, what changed and landed, the commit and PR, the dev URL and seed accounts, and what wasn't checked (browser checks land can't see). The user reads and deletes them; agents only add. A failure writing it never fails the landing.
