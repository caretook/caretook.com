# The live backlog

For anyone who reads or writes the backlog: the user, orchestrators, planning and backlog sessions, and loops (notes only). Everything planned (bugs, changes, features, big plans, questions) lives in two files, **only on `dev`**.

## The two files

- **`plans/inbox.md` is the user's.** Plain bullets under `##` headings (Bugs, Changes, Features, Big plans, Questions; the heading sets the type), with indented lines for details. No ids or fields.
- **`plans/backlog.md` is the tracker** that agents keep and the user reviews: one item per bullet, with id `B-<n>`, type, status, `prd` (its topic), `owner` (the branch that claimed it), `commit` and notes, and a summary table at the top.
- **The PRD table** at its top (topics, dependencies, hot files) says which PRDs can run at once. Change it when you add, reorder or finish a PRD.
- `pnpm backlog archive` moves landed, staging, live and dropped items to `plans/backlog-archive.md`; `show` and `list --all` read it, and ids are never reused.

## Ingest and triage

- **Ingest links them.** `pnpm backlog ingest` files every untagged inbox bullet as an item (status `inbox`) and appends its id to the bullet: `- Login link can be clicked twice (B-1)`. That's the only change agents make to the inbox. Editing or deleting a filed bullet doesn't change its item: say so in a new bullet, or change the tracker. `pnpm backlog inbox` shows bullets not filed yet.
- **When:** orchestrators at every wave boundary (with `doctor`, then rereading the list); the user whenever they like. Nothing ingests on its own, so a half-typed bullet is never filed.
- **Agents propose, the user reviews.** An orchestrator or planning agent sets a new item's PRD (`set B-<n> prd=<topic> status=triaged`) with a `note` saying why; the user checks the summary table.

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

The backlog session (`pnpm prd plan` with no topic, in the main checkout) ingests, lists, checks `pnpm prd status`, and proposes which PRDs to write or start, given the PRD table's dependencies and hot files and the cap of three running at once. Standing priorities:

1. Write the PRDs the table marks "to write" (`pnpm prd plan <topic>`), then run them.
2. Tests: cover every role against every table.
3. Hosting: go live by working through [`ops/runbook.md`](../../ops/runbook.md) with the user, staging first.
4. After invites: the launch work in [notifications](../domain/notifications.md); then Capacitor (bearer storage, `VITE_API_ORIGIN`).
