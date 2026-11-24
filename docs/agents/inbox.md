# Inbox session

For people and maintainers: the session itself never reads this doc. Its rules live in its prompt (`pnpm prd prompt inbox`), which stays short and self-contained.

## What it is

A session that helps the dev keeper add to and edit the inbox (`plans/inbox.md`), from a terminal or the phone. It only writes inbox lines; filing, triage, priority, holds and asks stay with the [backlog](backlog.md) session.

## Starting it

`pnpm prd inbox [--model <m>]` opens a session named `inbox` on Remote Control, through `session.sh --kind inbox`, on Opus in fast mode (`--model` picks another).

- **A bare directory.** It runs in `$CARETOOK_INBOX_DIR` (default `~/.caretook/inbox`), created when missing, so AGENTS.md and the project's memory don't load. It refuses a directory inside a git repository or under a `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md`. A real session there loads no instruction or memory file (checked 2026-11-24).
- **Trust once.** The first time, Claude Code asks whether to trust the folder ("No, exit" is the default): choose Yes. Until then the dispatcher doesn't keep it open.
- **Always on:** the [dispatcher](machinery.md#the-dispatcher) reopens a dead one and the context watch rotates it; its hand-off is `pnpm prd rotate --self`, keeping the model, fast mode and folder.
- **Bye:** a message of just 'bye' runs `pnpm prd bye`; its own check (every idea added) is in its prompt.
- **Fast mode** comes from `scripts/loops/inbox-settings.json`: the context hook settings (`context-settings.json`, kept in step by a test) plus `fastMode`. Without usage credits the API refuses fast mode, and Claude Code says so and carries on on normal Opus.

## What it runs

Only the inbox commands, by the main checkout's path (`pnpm -s -C <main> backlog …`), which also works from a shell with an old pnpm on its PATH:

- `similar <text…>` before each add, showing what it finds;
- `inbox add <type> <text…> [--details <text>]`, with `--anyway` only on the user's word;
- `inbox move <words> <type>` for an unfiled bullet (a filed one prints a `set` line, which it doesn't run);
- `inbox` to list unfiled lines, only when a request needs them.

These write to `origin/dev` and never touch the main checkout's files ([backlog](backlog.md)). It edits no file and commits nothing. A priority request changes nothing and points to the backlog session.
