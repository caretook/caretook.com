- **A bare directory.** It runs in `$CARETOOK_INBOX_DIR` (default `~/.caretook/inbox`), created when missing, so AGENTS.md and the project's memory don't load. It refuses a directory inside a git repository or under a `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md`. A real session there loads no instruction or memory file (checked 2026-11-24).

## What it runs

Only the inbox commands, by the main checkout's path (`pnpm -s -C <main> backlog …`), which also works from a shell with an old pnpm on its PATH:

- `inbox add <type> <text…> [--details <text>]`, which stops on a look-alike (exit 3); `--anyway` only on the user's word;
- `inbox edit <words> --to <text> [--details <text>]`, `inbox move <words> <type>` and `inbox remove <words>` for an unfiled bullet; each refuses a filed one (move prints a `set` line, which it doesn't run);
- `inbox` to list unfiled lines, only when a request needs them.

These write to `origin/dev` and never touch the main checkout's files ([backlog](backlog.md)). It never reads the backlog and does no extra work: dedupe and triage stay with ingest, the backlog session and the planner. It edits no file and commits nothing. A priority request changes nothing and points to the backlog session.
