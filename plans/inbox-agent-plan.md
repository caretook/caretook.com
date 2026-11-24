# Plan: The inbox agent

> Source PRD: [`plans/inbox-agent-prd.md`](inbox-agent-prd.md). User-story numbers (US) refer to it. Backlog items B-425, B-435, B-474, B-515, B-551. Topic `inbox-agent`. Replanned 2026-11-23: the Next up list (B-406) is dropped.

## Status

| Slice | Wave | State                                    | Merge into `prd/inbox-agent` (slice commits) |
| ----- | ---- | ---------------------------------------- | -------------------------------------------- |
| 1     | 1    | landed (opus) in dev `24440550`, PR #134 | `0c37dc6d` (`ced2c458`)                      |
| 2     | 1    | landed (opus) in dev `24440550`, PR #134 | `935bc723` (`4b98c644`)                      |
| 3     | 2    | landed (opus) in dev `fb6688e6`, PR #137 | `8a2b35bc` (`edb5cd93`, `54c810c3`)          |
| 4     | 3    | landed (opus) in dev `faadbc1b`, PR #139 | `b57c2f99` (`336f9121`)                      |
| 5     | 4    | landed (opus) in dev `35946394`, PR #141 | `2a3d7845` (`47bdd9a5`)                      |
| 6     | 5    | landed (opus) in dev `c04110f8`, PR #144 | `1126910c` (`d793cb91`)                      |
| 7     | 6    | merged (opus)                            | `444b8008` (`865d17e4`)                      |

**Landing mode:** run everything through (started run-through): start every ready slice, land each green wave, clean up, ask only real questions through `pnpm prd ask`.

**Hand-over (2026-11-24): wave 5 landed; wave 6 (slice 7, B-733) waits for fixes-tooling wave 3.** Wave 5 landed in dev as `c04110f8` through PR #144 with `--no-review` (Codex out of credits), at CI integration green on `5aae995d` (run 45387484901), after `prd sync` (`d28fce0a`). Landing report a177; to-test file `to-test/2026-11-24-0652-inbox-agent.md`. Docs folded: machinery's bye line (with the slice), an orchestration row for `pnpm prd bye`. B-551 done; `inbox-agent-6` removed; fixes-tooling told of the landing. Filed B-732 (fixes-tooling: tidy-cli `beforeAll` flake came back after archived B-460).

**Wave 6 (2026-11-24, session inbox-agent-67):** fixes-tooling wave 3 landed in dev as `00894439`; synced, hot list widened, B-733 claimed. Slice 7 handed off (`865d17e4`, quick check passed), merged as `444b8008`, B-733 ready; `prd sync` merged dev again. Next: CI integration run on the synced tip, PR, land (`--no-review` if Codex is out of credits), fold docs (machinery: opener, rotation, keep-alive, session-request lines; backlog _Deciding what is next_: the captain display name), `prd rm inbox-agent-7`, `prd rm inbox-agent`, `prd end`. Hand test for the to-test file: the tab title on a real iTerm2 session (whether `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` keeps it, AppleScript name vs. OSC title). Known limit: any process with `--remote-control <Captain>` counts as the main backlog session.

**B-733 added by the user** (through the backlog session caretook-com-79, 2026-11-24, after wave 5 started): slice 7, wave 6, below. It touches the dispatcher and session files fixes-tooling's wave 3 (B-452/B-453/B-454, B-570, B-600; slices 17 to 24, merged into `prd/fixes-tooling`, landing next) is changing: `dispatch.mjs`, `session-requests.mjs`, `open-session.sh`. Our hot list was narrowed for them (no `scripts/loops/dispatch`, no `session-requests`). fixes-tooling-b2 promised to message the inbox-agent orchestrator when wave 3 lands in dev. **Next session:** set a background check that exits once `pnpm log dev` shows fixes-tooling landing (a `feat(fixes-tooling)`/landing subject after `c04110f8`, or `pnpm backlog list` shows B-452 landed), then `pnpm prd sync --force`, widen the hot list (`pnpm backlog prd set inbox-agent hot=…`, adding `scripts/loops/dispatch`, `scripts/loops/session`, `scripts/loops/keep-alive`, `scripts/loops/open-session`), `claim B-733`, `prd slice inbox-agent 7` and an opus agent. It lands at integration (it touches `scripts/loops/`). After it lands: `pnpm prd rm inbox-agent`, then `pnpm prd end` from the main checkout.

**Earlier (wave 4):** Wave 4 landed in dev as `35946394` through PR #141 with `--no-review` (Codex out of credits), at CI integration green on `4468be44` (run 45376608990), after `sync --force` (`dbfb89a9`) because land refused an unsynced tip under the stale B-729 brake notice n83. Landing report a174; to-test file `to-test/2026-11-24-0543-inbox-agent.md`. Docs folded: machinery (inbox keep-alive and its trust gate, the pickup, `dir`, hook and opener for inbox; trimmed under dev's size) and inbox (trust gate, always on). B-515 done; `inbox-agent-5` removed. No slice in flight. Next: ingest, claim B-551 and start slice 6 (opus). Slice 5 notes for slice 6: `prompt.sh`'s inbox prompt has a hand-off line (`prd rotate --self`) and its size test allows 1900 characters; if `prd.sh inbox` refuses mid-rotation the record stays `rotating` and the keep-alive retries after the grace period. Slice 6 is the last wave: after it lands, `pnpm prd rm inbox-agent`, then `pnpm prd end` from the main checkout.

**Earlier (wave 3):** Wave 3 landed in dev as `faadbc1b` through PR #139 with `--no-review` (Codex out of credits), at CI integration green on `146487aa` (run 45370404316), after `sync --force` (`67239401`): land refused an unsynced tip under the stale B-729 brake notice n83 (B-729 is fixed). The landing report is filed; the to-test file is `to-test/2026-11-24-0504-inbox-agent.md`. Docs folded: `docs/agents/inbox.md`, its _Area index_ entry, an orchestration row, the inbox file's opening lines. B-425 done; `inbox-agent-4` removed. No slice in flight. Next: claim B-515 and start slice 5; it lands at integration (it touches `scripts/loops/`). Models: every slice on opus.

**Slice 4 hand-off:** both real-session checks passed (debug logs: no CLAUDE.md/AGENTS.md/memory loaded in the bare directory; `fastMode` through `--settings` is requested). But the API refuses fast mode without usage credits, so the session falls back to normal Opus with Claude Code's own notice (the PRD's fallback). Not asked: the fallback is the PRD's answer; the report says it. For slice 5 (noted on B-515): a new directory's "trust this folder?" prompt defaults to "No, exit", so a keep-alive would hang until the user accepts it once by hand; `session.sh` doesn't export `CARETOOK_CONTEXT_HOOK` for kind inbox, so export it and give `context.mjs` an inbox reminder.

**Earlier (wave 2):** Wave 2 landed in dev as `fb6688e6` through PR #137 with `--no-review` (Codex out of credits), at CI integration green on `295fc0c6` (run 45364603017). The landing report is ask a169; the to-test file is `to-test/2026-11-24-0429-inbox-agent.md`. Docs folded: backlog (the origin path, who may change the inbox) and AGENTS.md (`pnpm prd dev-sync`). B-474 and B-435 done; B-425 stays claimed until slice 4 merges. No slice in flight. Accepted gap (noted on B-425): `ingest` with the main checkout mid-merge prints that the pickup skipped, then refuses as before. Models: every slice on opus.

**Slice 3 notes for slice 4:** the inbox session runs `pnpm backlog similar`, `inbox add`, `inbox move` and `inbox` by the main checkout's path; pickup output is on stderr, the result line ("added under <heading> on origin/dev as <sha>: …") on stdout. `BACKLOG_PICKUP=off` turns the pickup off. Slice 4 starts with two real-session checks (fast mode through `--settings`, and the bare directory loading neither AGENTS.md nor memory); if either fails, ask the user.

**Gate, corrected:** `scripts/loops/lib.sh` counts as the browser harness, so a wave that touches it lands at the **integration** tier (land requests the CI run itself). `pnpm test:tooling` and `pnpm exec eslint scripts` remain the local pre-check. The B-729 dev brake that held wave 1 about 12 hours is fixed in dev (`bcf6ffff`, fixes-bug). Skeptic s19 / ask a165 (wait for fixes-bug) is settled. Open issues: none. `pnpm backlog doctor` still reports two old inbox-line mismatches (B-548, B-549), not this topic's.

**Slice 1 notes for later:** it added `land_push_trunk` (a landing refuses when the pickup brings anything but the backlog files and CI's two lists). Slice 3's origin writer can call `dev_sync` as the pickup, and must treat its refusal of a checkout off `dev` or mid-merge as "skipped" (tell slice 3's agent this).

**Slice 2 notes for later:** the look-alike threshold (Dice 0.6, at least two shared words) was tested only on fictional titles, so its noise on the real backlog is unmeasured. `tidy --yes` exits 1 if the archive step fails (main checkout mid-merge or off `dev`); its other removals still run. Slice 3 changes the same `scripts/backlog/backlog.mjs`.

**Backlog:** claim B-425 and B-474 when slice 1 starts, `done` B-474 when slice 3 merges and B-425 when slice 4 merges; B-435 when slice 2 starts, `done` when slice 3 merges; B-515 when slice 5 starts, `done` when it merges; B-551 when slice 6 starts, `done` when it merges; B-733 when slice 7 starts, `done` when it merges.

Fold into the docs at landing (the PRD's _Docs at landing_): wave 1, [machinery](../docs/agents/machinery.md) (dev-sync, tidy's archiving) and [backlog](../docs/agents/backlog.md) (look-alikes, archiving); wave 2, backlog (the origin path, who may change the inbox); wave 2 also, AGENTS.md's line on how agents reach the main checkout (it gains `pnpm prd dev-sync`); wave 3, a new `docs/agents/inbox.md` with its _Area index_ entry, the inbox file's opening lines, and [orchestration](../docs/orchestration.md) (`pnpm prd inbox`, `queue`); wave 5, machinery (the dispatcher's pickup).

## Architectural decisions

- **Two write paths, one per file.** The inbox file is written on `origin/dev` by the origin writer (and, as before, by the user's hand and by `ingest` and `archive` in the main checkout). The tracker and the registry are written only by `pnpm backlog` onto the main checkout's `dev`. No command writes both in one step.
- **The origin writer touches no working tree:** it builds its commit from `origin/dev`'s copy with a temporary index, pushes without force, and retries a rejected push on the new tip. When local `dev` is ahead of `origin/dev` by backlog commits only, it pushes local `dev` first, so its commit sits on top and the pickup is a fast-forward. It never pushes a commit that isn't a backlog commit. Its commits carry the `Backlog-Tool:` trailer and a `chore(backlog): …` subject, and change only `plans/inbox.md`.
- **The pickup is `pnpm prd dev-sync`,** under the backlog lock as today. It never stops on the inbox: the inbox merge handles uncommitted inbox lines and inbox-only conflicts. A conflict in any other file stops as today. Of `dev`'s own commits it replays only backlog commits that no other ref or detached worktree holds; with any other it merges.
- **The inbox merge is pure and total:** text in, text and notes out, no conflict markers, every entry once.
- **Entries are known by their text without the tag** (whitespace folded), in the merge and in `inbox move`.
- **Priority stays with the backlog session.** Nothing here reads or changes the registry's order.
- **Scripts only append tags to the inbox** (an id). Only the inbox commands, run on the user's word, add or move a line; `archive` removes the bullets of archived items as today.
- **Tooling only:** `scripts/backlog/`, `scripts/loops/`, their tests. No app code, no migration, no dependency. Tests use throwaway repositories and directories, never the real main checkout, `origin` or asks queue.

## How to run this plan

- **Waves:** 1: slices 1 and 2 (they share no file). 2: slice 3. 3: slice 4. 4: slice 5. 5: slice 6 (both change the prompts). 6: slice 7 (after fixes-tooling's wave 3 lands). Each wave lands something usable alone.
- **Gate:** the diff is tooling and Markdown, so the check gate needs nothing; run `pnpm test:tooling` and `pnpm exec eslint scripts` before each landing. No browser checks.
- **The backlog tool's main file** is changed by slices 2 and 3, one per wave, never two at once.
- **Models:** every slice is opus or stronger (git plumbing, a merge, the dispatcher).
- **Other topics:** `fixes-tooling`, `test-health` and `code-health` change the same directories; don't run beside them (the hot-file rule), and sync at each wave boundary.

## Slice 1: A pickup that never stops on the inbox

Stack: no · Reads: docs/agents/backlog.md, docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 3, 4.

**Build:** the inbox merge (pure, the PRD's rules). `pnpm prd dev-sync` uses it: with uncommitted inbox edits and an update that changes the inbox, it moves `dev` and writes the merge of the old committed copy, the working copy and the new committed copy, leaving the user's lines uncommitted; when replaying or merging `dev`'s own commits conflicts only in the inbox, it resolves that file with the merge and carries on. Of `dev`'s own commits it replays only backlog commits that no other ref or detached worktree holds, and makes the merge commit otherwise. `pr` and `land`'s push of `dev` runs dev-sync first when `origin/dev` has commits `dev` lacks, instead of stopping. This slice doesn't change the backlog tool's main file.

**Acceptance criteria:**

- Unit tests of the merge, one per rule: added on either side, added on both (kept once), removed on one side, tagged on one side while a neighbour is added on the other, reworded on one and on both, moved to another heading, details kept with their bullet. The result always parses and holds each entry once.
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

**User stories:** US 1, 2, 5, 11, 12.

**Build:** the origin writer (the PRD's contract: fetch; push local `dev` first when it is ahead by backlog commits only; edit `origin/dev`'s copy; a commit on that tip changing only the inbox; a push without force, five retries; then the pickup, best effort). It reads the tags in local `dev`'s committed copy too, so a bullet `ingest` filed but hasn't pushed counts as filed. `pnpm backlog ingest` runs the pickup first, before it takes the backlog lock, and carries on with a printed line when it can't. `pnpm backlog inbox add <type> <text…> [--details <text>] [--anyway]`, which stops on look-alikes among items and unfiled lines; `pnpm backlog inbox move <words> <type>` for an unfiled bullet, refusing a filed one with the `set B-<n> type=…` line and refusing words that match none or several; `pnpm backlog inbox` with no arguments lists unfiled bullets from `origin/dev`'s copy merged with the working copy.

**Acceptance criteria:**

- Tests against a temporary bare `origin` and main checkout: `inbox add bug "…"` leaves the bullet at the end of the bugs section on `origin/dev`, in one commit with the trailer that changes only the inbox; the main checkout's HEAD, index and files are untouched when the pickup is turned off; with it on, the line arrives and an uncommitted local line is still there.
- It works with the main checkout mid-merge and on another branch (the push succeeds, the pickup prints why it skipped).
- With unpushed backlog commits on local `dev`, they are pushed first and the pickup is a fast-forward; with an unpushed commit of another kind, nothing local is pushed and the pickup merges.
- `ingest` files a line that was only on `origin/dev`; with the checkout mid-merge it says so and files what is local; it never waits on its own lock.
- A push rejected because `origin/dev` moved is rebuilt on the new tip and both changes are there; after five rejections it fails and says nothing was written.
- `inbox add` on a look-alike exits 3 and pushes nothing; `--anyway` pushes. `inbox move` moves an unfiled bullet with its details, and refuses a filed one (tagged on `origin/dev` or only on local `dev`), no match and two matches.
- After every inbox command, including a failed push, the main checkout's index and files are unchanged by the writer (B-474).
- `pnpm prd pr`'s drift rule still ignores the inbox (a test that an inbox commit on `dev` leaves a synced branch synced).
- `pnpm test:tooling` passes.

**Blocked by:** 1, 2. **Blocks:** 4.

## Slice 4: The inbox session on fast Opus

Stack: no · Reads: docs/agents/backlog.md, docs/agents/machinery.md, docs/agents/planner.md · Tests: unit

**User stories:** US 1, 5, 6, 7, 12.

**Build:** first, on a real interactive session, check that a settings file with `fastMode` turns fast mode on through `--settings` alongside the context hook. If it doesn't, stop and ask the user; never change their global settings. On the same real session, check the bare start: opened in a small directory outside the repository, it loads neither AGENTS.md nor the project's memory, and the inbox commands work by the main checkout's path. If either fails, stop and ask. Then `pnpm prd prompt inbox` and `pnpm prd inbox [--model <m>]` (Opus in fast mode by default; a session named `inbox`, in that directory, which it creates, on Remote Control, through `session.sh --kind inbox`), listed in `pnpm prd help`. The prompt follows the PRD's _The inbox session_: self-contained and short, with no doc to read and no opening poll. The role doc `docs/agents/inbox.md` (for people and maintainers; the session never reads it) and its _Area index_ entry.

**Acceptance criteria:**

- Prompt tests: the inbox prompt names the commands it may run and what it must not do, runs with no topic, sends a priority request to the backlog session with no write, tells the session to read no doc and to open no poll, and stays under a small fixed size.
- `pnpm prd inbox` starts the session in a directory outside the repository, creating it if needed. The hand-off records that a real session loaded neither AGENTS.md nor the project's memory.
- `pnpm prd inbox` builds the command line with the model, the name and one settings file holding both the hook and `fastMode` (tested with the stand-in `claude`); `--model` overrides Opus.
- An unknown kind still fails with the list of kinds, `inbox` among them. `pnpm prd help` lists `inbox`.
- The hand-off records whether fast mode was confirmed on a real session.
- `pnpm test:tooling` passes.

**Blocked by:** 3. **Blocks:** 5.

## Slice 5: Always on, and the dispatcher's pickup

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**User stories:** US 8, 9.

**Build:** `inbox` joins `KEPT_KINDS`, `open-session.mjs`'s session prompts and `rotate --self`, keeping its model, fast mode and bare directory; the inbox prompt gains a short hand-off line. The dispatcher runs the pickup every five minutes (`CARETOOK_PICKUP_EVERY`).

**Acceptance criteria:**

- Dispatcher tests with a fake clock: a dead inbox session is reopened outside the PRD slots; quick deaths stop and ask as for the backlog session; the pickup runs once per period, not per tick; a failed pickup logs one line and the tick still picks.
- A rotation or reopen keeps the model, the fast setting and the bare directory.
- `--dry-run` writes and opens nothing. The pure pick's tests are unchanged.
- `pnpm test:tooling` passes.

**Blocked by:** 4. **Blocks:** nothing.

## Slice 6: 'bye' for every role

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/loop.md, docs/agents/planner.md, docs/agents/backlog.md, docs/agents/hotfix.md, docs/agents/recovery.md · Tests: unit

**User stories:** US 10.

**Build:** `pnpm prd bye` as the PRD's _Bye_ says, and one line in every role's prompt and doc: a message of just 'bye' runs it. Each role doc names its own extra checks; the inbox session's are in its prompt, which stays short.

**Acceptance criteria:**

- Against temporary repositories: a clean session prints its hand-off line, releases its leases and ends; each open thing (uncommitted work, unpushed commits, a held lease, an open ask it filed) is listed and nothing closes; a second run after clearing them closes.
- It never discards work on its own.
- Prompt tests cover the line for every role.
- `pnpm test:tooling` passes.

**Blocked by:** 4. **Blocks:** nothing.

## Slice 7: A captain's name for the main backlog session

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**Backlog:** B-733 (added by the user, 2026-11-24).

**Build:** the main backlog session (kind `backlog`, the one `pnpm prd plan` with no topic and the dispatcher's keep-alive open) shows a captain's name as its display name: its Remote Control name and its tab title. Each new session draws one at random from Archer, April, Pike, Kirk, Decker, Harriman, Garrett, Picard, Shelby, Riker, never the same as the last one; a rotate, a hand-off ("hand off") and a keep-alive reopen are new sessions too. Display name only: the `.loops/.sessions` record stays `backlog`, and keep-alive, rotate, asks, `session request` and every lookup still find it as `backlog` (keep-alive's live check matches by `--remote-control backlog`, `session-requests.mjs` tells `backlog-<name>` request sessions apart by it, so both must keep working with the captain's name, e.g. through the record's `remote` field or the pid). Only the main backlog session: `backlog-<name>` request sessions, inbox and every other role are unchanged. The last captain is remembered somewhere the next start reads (the record, or a small file under `.loops/`).

**Acceptance criteria:**

- A pure pick: a name from the pool, never the last one; with a fixed random source, the choice is deterministic; with no last one, any of the ten.
- Start, rotate, hand-off and keep-alive reopen each build a command with `--remote-control <Captain>` and the tab title `<Captain>`, a different captain from the last (tested with the stand-in `claude` and fake records).
- The session record's name and kind stay `backlog`; keep-alive sees a live captain-named backlog session as live (no reopen) and a dead one as dead; `session request` still tells `backlog-<name>` sessions from the main one.
- `backlog-<name>`, inbox, prd, plan and hotfix sessions' names are unchanged.
- `pnpm test:tooling` passes.

**Blocked by:** 6, and fixes-tooling's wave 3 landing in dev (it changes `dispatch.mjs`, `session-requests.mjs`, `open-session.sh`). **Blocks:** nothing.
