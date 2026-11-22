# The live backlog

For anyone who reads or writes the backlog: the user, orchestrators, planning and backlog sessions, and loops (notes only). Everything planned (bugs, changes, features, big plans, questions) lives in two files, **only on `dev`**.

## The two files

- **`plans/inbox.md` is the user's.** Plain bullets under `##` headings (Bugs, Changes, Features, Big plans, Questions; the heading sets the type), with indented lines for details. No ids or fields.
- **`plans/backlog.md` is the tracker** that agents keep and the user reviews: one item per bullet, with id `B-<n>`, type, status, `prd` (its topic), `owner` (the branch that claimed it), `commit` and notes, and a summary table at the top.
- **The PRD table** at its top is the registry: `PRD`, `Flags` (`hold`: waits on the user; `done`; `standing`: never finishes; `alone`: nothing beside it; or `—`; `standing` and `hold` are separate: a standing topic is dispatchable while it has waiting items, and is on hold only when it carries `hold`, the user's brake), `After` (topics), `Hot files` (path prefixes) and `Doc and notes`. **Row order is the priority.** Edit it only with `pnpm backlog prd add|set|move` (one backlog commit each; `migrate` converted the old prose table once). `pnpm backlog prd list [--json]` gives each topic's state, worked out, never stored: `done` or `hold` from the flag, `running` when a `prd/<topic>` worktree exists, a `standing` topic `planned` with triaged items and `idle` without, else `planned` when its plan is on `dev` and `to-write` when not. `doctor` reports an unknown `After` topic, a cycle, waiting items with no row or a done row, an unknown flag.
- `pnpm backlog archive` moves landed, staging, live and dropped items to `plans/backlog-archive.md`; `show` and `list --all` read it, `set` and `note --archived` change an archived item in place (it stays archived), and ids are never reused.

## Ingest and triage

- **Ingest links them.** `pnpm backlog ingest` files every untagged inbox bullet as an item (status `inbox`) and appends its id to the bullet: `- Login link can be clicked twice (B-1)`. That's the only change agents make to the inbox. Editing or deleting a filed bullet doesn't change its item: say so in a new bullet, or change the tracker. `pnpm backlog inbox` shows bullets not filed yet.
- **When:** orchestrators at every wave boundary (with `doctor`, then rereading the list); the user whenever they like. Nothing ingests on its own, so a half-typed bullet is never filed.
- **Agents propose, the user reviews.** An orchestrator or planning agent sets a new item's PRD (`set B-<n> prd=<topic> status=triaged`) with a `note` saying why; the user checks the summary table. A small fix goes to `prd=fixes-<cat>` by the category rule in [`plans/fixes-rules.md`](../../plans/fixes-rules.md), never `quick-fixes`.

## Statuses

inbox → triaged (has a PRD) → in-progress (claimed) → ready → landed → staging → live, or dropped.

- `claim B-<n>` takes an item for your branch; **the first claim wins**, and others get an error (`--force` overrides).
- `done B-<n>` (the orchestrator, after merging the slice into `prd/<topic>`) records the commit and sets ready.
- From then on the status is **worked out from git**: landed once `dev` contains the commit, staging and live once `origin/staging` and `origin/main` do. `list` shows it; `refresh` fetches and writes it. Every write recomputes it from local refs.

## Writing

`pnpm backlog` (`scripts/backlog/`) runs from any worktree. Each write takes a lock, edits the main checkout's copies, and commits onto `dev`, so the lists are live for everyone without merges. The header of `scripts/backlog/backlog.mjs` lists the commands and is the source for these rules.

- **Who writes:** the user (the inbox, and anything in the tracker), orchestrators, planning agents and loops. Others write too, so agents change the tracker only through `pnpm backlog`, which rereads it under the lock, never by writing back a copy read earlier. Hand edits in the main checkout are fine: `pnpm backlog commit` commits them, and the next tool write includes them. Agents may commit backlog changes without asking.
- **Never on your own branch.** Neither file is edited or committed on `prd/`, `slice/`, `plan/` or `hotfix/` branches; those copies are stale. Read with `pnpm backlog list` and `inbox`.
- **Writes commit only what they changed:** `backlog.md`; the inbox only for `ingest`, and `archive`'s own removals; never your uncommitted inbox lines or staged work.
- **Several ids, one commit:** `set`, `note`, `claim`, `release` and `done` take several ids (`set B-1 B-2 prd=x status=triaged`; `note B-1 B-2 <text>`, where ids after the first need the `B-` prefix). The subject names them, shortened past three (`B-1, B-2, B-3 +2: note`). `claim` is all-or-nothing: if any id is another branch's, nothing is claimed and the error names it.
- **Trailers and amending:** every backlog commit ends with `Backlog-Tool: <command>` and `Backlog-Ids: …`, and nothing else adds them. A write amends dev's HEAD instead of adding a commit only when HEAD has that trailer, changes only the backlog files, has one parent, wasn't rewritten by hand, is under 10 minutes old, is on no other ref (a `prd/` branch that merged `dev`, `origin/dev`, a tag, a stash) or detached worktree, isn't an item's commit, and is still the HEAD read at the start. Otherwise it makes a new commit. The amended commit keeps HEAD's parent, lists every id and keeps each write's lines, and the ref update still compares against the HEAD it read (`scripts/backlog/amend.mjs`). So a backlog write never rewrites the user's commits or anything a branch or the remote has.
- `pnpm backlog doctor [--fix]` finds mis-tags, duplicate ids, stale statuses and summary drift (`--fix`: statuses and the summary only).
- `pnpm log` hides backlog commits (`chore(backlog)`) when you read history.

## Deciding what's next

The backlog session (`pnpm prd plan` with no topic, in the main checkout) asks first and collects after, so a fresh one stays small: one line on the open asks, then one multi-select poll of what the session is for (catch up, write a PRD from the backlog, decide what to run next, or triage a new issue or idea). Only then does it ingest, list and check what the picks need; catch up prints the overview (the backlog, the orchestrators, what it triaged or left for review). While the dispatcher runs, deciding what runs next is moving and holding rows (`pnpm backlog prd move`, `hold`), and it prints no start commands. Later questions follow only from the picks; it never asks about a task the user didn't pick, and does routine chores without polling. Its proposals weigh the PRD table's dependencies and hot files and the cap of three running at once. To plan a topic it asks first: a planner in a new terminal (the user runs `pnpm prd plan <topic> --open`; an agent never runs `--open` from its own shell, where the planner would run inside the command) or planning inline in this session (`pnpm prd plan <topic>`, in its worktree). It never starts a PRD run from its own shell (`pnpm prd start`, `pnpm prd queue`): it prints the commands as options for the user to run. On "hand off" it asks once (a short brief, recommended, or nothing), writes any brief to the path `pnpm prd rotate --self --brief-path` prints, then runs `pnpm prd rotate --self [--brief <file>]`. Past the context limit it hands off with a brief at the next pause in the talk, without asking which mode. When the user wants another backlog session for a task, it writes a brief and runs `pnpm prd session request backlog <name> --brief <file>`; the dispatcher opens `backlog - <name>` and leaves a notice (`pnpm prd session requests` lists them). Standing priorities:

1. Write the PRDs the table marks "to write" (`pnpm prd plan <topic>`), then run them.
2. Tests: cover every role against every table.
3. Hosting: go live by working through [`ops/runbook.md`](../../ops/runbook.md) with the user, staging first.
4. After invites: the launch work in [notifications](../domain/notifications.md); then Capacitor (bearer storage, `VITE_API_ORIGIN`).
