# Plan: The inbox agent

> Source PRD: [`plans/inbox-agent-prd.md`](inbox-agent-prd.md). User-story numbers (US) refer to it. Backlog items B-425 (an inbox agent that writes to `origin/dev`), B-406 (priority set from a "Next up" list in the inbox), B-435 (duplicate check on filing, finished items archived without a hand run). Topic `inbox-agent`.

## Status

| Slice | Wave | State | Merge into `prd/inbox-agent` (slice commits) |
| ----- | ---- | ----- | -------------------------------------------- |
| 1     | 1    | —     | —                                            |
| 2     | 1    | —     | —                                            |
| 3     | 2    | —     | —                                            |
| 4     | 3    | —     | —                                            |
| 5     | 4    | —     | —                                            |
| 6     | 5    | —     | —                                            |

**Backlog:** claim B-425 when slice 1 starts and `done` it when slice 5 merges; B-435 when slice 2 starts, `done` when slice 3 merges; B-406 when slice 4 starts, `done` when slice 6 merges.

Fold into the docs at landing (the PRD's _Docs at landing_): wave 1, [machinery](../docs/agents/machinery.md) (dev-sync, tidy's archiving) and [backlog](../docs/agents/backlog.md) (look-alikes, archiving); wave 2, backlog (the origin path, who may change the inbox); wave 2 also, AGENTS.md's line on how agents reach the main checkout (it gains `pnpm prd dev-sync`); wave 3, backlog (Next up) and the inbox file's opening lines; wave 4, a new `docs/agents/inbox.md` with its _Area index_ entry, and [orchestration](../docs/orchestration.md) (`pnpm prd inbox`, `queue`); wave 5, machinery (the dispatcher's pickup).

## Architectural decisions

- **Two write paths, one per file.** The inbox file is written on `origin/dev` by the origin writer (and, as before, by the user's hand and by `ingest` and `archive` in the main checkout). The tracker and the registry are written only by `pnpm backlog` onto the main checkout's `dev`. No command writes both in one step.
- **The origin writer touches no working tree:** it builds its commit from `origin/dev`'s copy with a temporary index, pushes without force, and retries a rejected push on the new tip. When local `dev` is ahead of `origin/dev` by backlog commits only, it pushes local `dev` first, so its commit sits on top and the pickup is a fast-forward. It never pushes a commit that isn't a backlog commit. Its commits carry the `Backlog-Tool:` trailer and a `chore(backlog): …` subject, and change only `plans/inbox.md`.
- **The pickup is `pnpm prd dev-sync`,** under the backlog lock as today. It never stops on the inbox: the inbox merge handles uncommitted inbox lines and inbox-only conflicts. A conflict in any other file stops as today. Of `dev`'s own commits it replays only backlog commits that no other ref or detached worktree holds; with any other it merges.
- **The inbox merge is pure and total:** text in, text and notes out, no conflict markers, every entry once.
- **Entries are known by their text without the tag** (whitespace folded), in the merge, in `inbox move` and in `next`.
- **Next up never changes the pick.** `next apply` moves registry rows; the dispatcher still reads row order.
- **Scripts only append tags to the inbox** (an id, a topic). Only the inbox commands, run on the user's word, add, move or remove a line; `archive` removes the bullets of archived items as today.
- **Tooling only:** `scripts/backlog/`, `scripts/loops/`, their tests. No app code, no migration, no dependency. Tests use throwaway repositories and directories, never the real main checkout, `origin` or asks queue.

## How to run this plan

- **Waves:** 1: slices 1 and 2 (they share no file: 1 owns the inbox merge and dev-sync in `lib.sh`; 2 owns look-alikes, `add`, `ingest`'s note, `archive`, tidy and two prompt lines). 2: slice 3. 3: slice 4. 4: slice 5. 5: slice 6. Each wave lands something usable alone.
- **Gate:** the diff is tooling and Markdown, so the check gate needs nothing; run `pnpm test:tooling` and `pnpm exec eslint scripts` before each landing. No browser checks.
- **The backlog tool's main file** is changed by slices 2, 3, 4 and 5, one per wave, never two at once.
- **Models:** every slice is opus or stronger (git plumbing, a merge, the dispatcher).
- **Other topics:** `fixes-tooling`, `test-health` and `code-health` change the same directories; don't run beside them (the hot-file rule), and sync at each wave boundary.

## Slice 1: A pickup that never stops on the inbox

Stack: no · Reads: docs/agents/backlog.md, docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 3, 4.

**Build:** the inbox merge (pure, the PRD's rules). `pnpm prd dev-sync` uses it: with uncommitted inbox edits and an update that changes the inbox, it moves `dev` and writes the merge of the old committed copy, the working copy and the new committed copy, leaving the user's lines uncommitted; when replaying or merging `dev`'s own commits conflicts only in the inbox, it resolves that file with the merge and carries on. Of `dev`'s own commits it replays only backlog commits that no other ref or detached worktree holds, and makes the merge commit otherwise. `pr` and `land`'s push of `dev` runs dev-sync first when `origin/dev` has commits `dev` lacks, instead of stopping. This slice doesn't change the backlog tool's main file.

**Acceptance criteria:**

- Unit tests of the merge, one per rule: added on either side, added on both (kept once), removed on one side, tagged on one side while a neighbour is added on the other, reworded on one and on both, moved to another heading, Next up reordered on one side and on both, details kept with their bullet. The result always parses and holds each entry once.
- dev-sync tests against temporary repositories: an uncommitted inbox line survives a fast-forward that changes the inbox, and is still uncommitted; a local `ingest` commit and a remote added line that git can't merge end with both, the line tagged once; a conflict in another file still stops with nothing changed; uncommitted edits to any other file the update touches still refuse.
- A push of `dev` with `origin/dev` ahead picks it up and then pushes; with a real conflict it stops as before.
- A local backlog commit that a `prd/` branch has merged is not replayed: dev-sync merges, and the commit keeps its id; one on no other ref is replayed as today.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 3.

## Slice 2: Look-alikes shown before filing, and archiving without a hand run

Stack: no · Reads: docs/agents/backlog.md, docs/agents/machinery.md · Tests: unit

**User stories:** US 12, 13, 14, 15, 16.

**Build:** look-alikes (pure: open and archived items ranked by shared content words, over a threshold). `pnpm backlog similar <text…>` lists them with id, status, topic and title. `pnpm backlog add` prints them and files nothing (exit 3) unless `--anyway`. `ingest` files every line; for one with look-alikes it adds a note naming them and prints them. `pnpm backlog archive [B-<n>…]` takes ids. `pnpm prd tidy` lists archiving as safe: with `--yes` it archives dropped items and finished items whose topic has no `prd/` worktree, and reports the count; it no longer puts archiving on the ask list. The tidy prompt stops calling archiving an ask; the orchestrator prompt's line on filing Codex findings says what to do when `add` stops on a look-alike (note the existing item, or `--anyway`).

**Acceptance criteria:**

- Unit tests of look-alikes: the same title reworded lightly matches; an archived match is found and marked; unrelated titles sharing only common words don't match; the best match comes first; an empty backlog returns nothing.
- Command tests: `similar` prints matches and exits 0 with none; `add` on a look-alike exits 3, names it and files nothing, and files with `--anyway`; `ingest` files a look-alike line and its item's note names the match; `archive B-1` moves only that item and refuses one that isn't finished.
- Tidy tests: finished items of a topic with a `prd/` worktree are kept, with why; dropped items and finished items of other topics are on the safe list; `--yes` archives them in one backlog commit; `--json` only lists.
- Callers that file follow-ups by script still work: any that call `pnpm backlog add` are checked and given `--anyway` only where a duplicate is intended. Prompt tests cover the two changed prompt lines.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 3.

## Slice 3: Inbox lines written straight to origin/dev

Stack: no · Reads: docs/agents/backlog.md, docs/agents/machinery.md · Tests: unit

**User stories:** US 1, 2, 5, 12.

**Build:** the origin writer (the PRD's contract: fetch; push local `dev` first when it is ahead by backlog commits only; edit `origin/dev`'s copy; a commit on that tip changing only the inbox; a push without force, five retries; then the pickup, best effort). It reads the tags in local `dev`'s committed copy too, so a bullet `ingest` filed but hasn't pushed counts as filed. `pnpm backlog ingest` runs the pickup first, before it takes the backlog lock, and carries on with a printed line when it can't. `pnpm backlog inbox add <type> <text…> [--details <text>] [--anyway]`, which stops on look-alikes among items and unfiled lines; `pnpm backlog inbox move <words> <type>` for an unfiled bullet, refusing a filed one with the `set B-<n> type=…` line and refusing words that match none or several; `pnpm backlog inbox` with no arguments lists unfiled bullets from `origin/dev`'s copy merged with the working copy.

**Acceptance criteria:**

- Tests against a temporary bare `origin` and main checkout: `inbox add bug "…"` leaves the bullet at the end of the bugs section on `origin/dev`, in one commit with the trailer that changes only the inbox; the main checkout's HEAD, index and files are untouched when the pickup is turned off; with it on, the line arrives and an uncommitted local line is still there.
- It works with the main checkout mid-merge and on another branch (the push succeeds, the pickup prints why it skipped).
- With unpushed backlog commits on local `dev`, they are pushed first and the pickup is a fast-forward; with an unpushed commit of another kind, nothing local is pushed and the pickup merges.
- `ingest` files a line that was only on `origin/dev`; with the checkout mid-merge it says so and files what is local; it never waits on its own lock.
- A push rejected because `origin/dev` moved is rebuilt on the new tip and both changes are there; after five rejections it fails and says nothing was written.
- `inbox add` on a look-alike exits 3 and pushes nothing; `--anyway` pushes. `inbox move` moves an unfiled bullet with its details, and refuses a filed one (tagged on `origin/dev` or only on local `dev`), no match and two matches.
- `pnpm prd pr`'s drift rule still ignores the inbox (a test that an inbox commit on `dev` leaves a synced branch synced).
- `pnpm test:tooling` passes.

**Blocked by:** 1, 2. **Blocks:** 4.

## Slice 4: The Next up list sets the order

Stack: no · Reads: docs/agents/backlog.md, docs/agents/machinery.md · Tests: unit

**User stories:** US 6, 8.

**Build:** the `## Next up` section: the inbox parser gives its bullets no type, so `ingest` and `pnpm backlog inbox` leave them alone, and the inbox merge keeps its order rule. Resolve (pure, the PRD's order: tag, name, item id, else unmatched; `done` topics skipped; a topic once). `pnpm backlog next [--json]` (the list as resolved, unmatched and skipped lines). `pnpm backlog next apply [--now]`: reads the main checkout's working copy, moves registry rows so listed topics come first in list order, one backlog commit only on a change, prints moves and unmatched lines; a working copy with uncommitted edits saved under a minute ago is skipped unless `--now`. `pnpm backlog prd move` warns when Next up will override it. Nothing here writes the inbox.

**Acceptance criteria:**

- Unit tests of resolve: a tagged line, a name with spaces, a name with hyphens, an item id, an item with no topic (unmatched), an unknown tag (unmatched), a `done` topic (skipped), a topic listed twice, an empty and a missing section.
- A parser test: Next up bullets are never new inbox entries, and `ingest` files none of them.
- Command tests: `next` prints the resolved list and the unmatched lines; `next apply` reorders the registry to listed-first with the rest in their old order, writes no commit when nothing changes, and prints unmatched lines without guessing; uncommitted edits saved seconds ago are skipped, a committed copy and `--now` are not.
- `prd move` of a listed topic warns and still moves.
- `pnpm backlog doctor` is clean on an inbox with a Next up section.
- `pnpm test:tooling` passes.

**Blocked by:** 3. **Blocks:** 5.

## Slice 5: Next up edits and the inbox session

Stack: no · Reads: docs/agents/backlog.md, docs/agents/machinery.md, docs/agents/planner.md · Tests: unit

**User stories:** US 1, 5, 10, 11, 12.

**Build:** `pnpm backlog next add <words or topic> [--first|--before <t>|--after <t>]`, `next move <topic> …`, `next rm <topic or words>` and `next tag <words> <topic>`, through the origin writer (creating the section when missing). `pnpm prd queue <topic>`: with a non-empty list, `next add <topic> --first` then `next apply --now`; else as today. `pnpm prd prompt inbox` and `pnpm prd inbox [--model <m>]` (opus by default; a session named `inbox`, in the main checkout's directory, on Remote Control), listed in `pnpm prd help`. The prompt, as the PRD's _The inbox session_ says: the role doc and [backlog](../docs/agents/backlog.md); the unfiled lines and Next up from `origin/dev`; one AskUserQuestion poll of what the session is for; `similar` before each add, shown to the user; writes only through `pnpm backlog inbox …` and `pnpm backlog next …`; plain titles with every id and topic; no file edits, no commits, no ingest, triage, holds or asks. The backlog prompt: priority is Next up (`pnpm backlog next …`) once the list is in use, and the overview names the list's first topics.

**With `agent-autonomy-2`** (amended 2026-11-22): if its slice 5 (the always-on backlog session) is in dev, add `inbox` to the dispatcher's kept-alive kinds and its hand-off paragraph (`pnpm prd rotate --self [--brief …]`) to the inbox prompt, and start the `inbox` session through `session.sh --kind inbox`; if not, that topic's slice 5 does it. Either way, the one that adds `inbox` sets B-515 to landed.

**Acceptance criteria:**

- Command tests against a temporary bare `origin`: `next add "sync safety" --first` writes the line first in the section on `origin/dev` and creates the section when missing; `next move` reorders; `next tag` appends the topic to one line; `next rm` removes one line and refuses words matching none or several.
- `queue` with a list puts the topic first in it and its row first in the registry in the same run; with no list it moves the row as today.
- Prompt tests: the inbox prompt names the commands it may run and the things it must not do, and runs with no topic; the backlog prompt names `pnpm backlog next` for priority, with and without a dispatcher running; an unknown kind still fails with the list of kinds, `inbox` among them.
- `pnpm prd inbox` builds the command line with the model and the session name (tested with the stand-in `claude` the session tests use); `--model` overrides opus. `pnpm prd help` lists `inbox`.
- `pnpm test:tooling` passes.

**Blocked by:** 4. **Blocks:** 6.

## Slice 6: The dispatcher follows Next up

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**User stories:** US 7, 9.

**Build:** in the dispatcher's tick, before it gathers facts: the pickup every five minutes (`CARETOOK_PICKUP_EVERY`), then `next apply`. For each unmatched line, one question in the asks queue (session `dispatch`; the three closest topics by shared words and "remove the line"), remembered in its state so a line is asked once; the push goes through the helper it already uses. On an answer: a topic becomes `next tag`, "remove the line" becomes `next rm`, anything else asks again. `--dry-run` prints what it would apply and ask and writes nothing. A failed pickup or apply is logged and the tick carries on.

**Acceptance criteria:**

- Dispatcher tests with a fake clock and temporary directories: a list naming a later topic makes that topic the next start; the pickup runs once per period, not per tick; an unmatched line files one question and no second one on later ticks; an answer naming a topic tags the line and the next tick applies it; "remove the line" removes it; a dismissed question is asked again; a line that disappears drops its remembered question.
- `--dry-run` writes no commit, files no ask and prints the order it would apply.
- A pickup that fails (no network, a busy checkout) logs one line and the tick still picks.
- The pure pick's tests are unchanged.
- `pnpm test:tooling` passes.

**Blocked by:** 5. **Blocks:** nothing.
