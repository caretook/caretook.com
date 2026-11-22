# Plan: The context watch and long-lived sessions (agent autonomy, part 2)

> Source PRD: [`plans/agent-autonomy-2-prd.md`](agent-autonomy-2-prd.md). User-story numbers (US) refer to it. Backlog items B-507 (a context hook), B-508 (context size in status, the dispatcher's nudge), B-509 (the rule: rotate past 160k), B-437 (record backlog, hotfix and recovery sessions), B-514 (hand off from the phone), B-515 (always-on backlog and inbox sessions). Topic `agent-autonomy-2`; amended 2026-11-22 by the backlog session.

## Status

| Slice | Wave | State                                                            | Merge into `prd/agent-autonomy-2` (slice commits) |
| ----- | ---- | ---------------------------------------------------------------- | ------------------------------------------------- |
| 1     | 1    | merged (opus)                                                    | e2e4a366 (9bfc245b, 81689593)                     |
| 2     | 2    | started (opus), worktree agent-autonomy-2-2                      | —                                                 |
| 3     | 1    | merged (opus); conflicts resolved in session.sh and status-extra | 5162f553 (9da26376, 41a67e83)                     |
| 4     | 2    | started (opus), worktree agent-autonomy-2-4                      | —                                                 |
| 5     | 2    | started (opus), worktree agent-autonomy-2-5                      | —                                                 |
| 6     | 3    | —                                                                | —                                                 |
| 7     | 3    | —                                                                | —                                                 |

**Landing mode:** run everything through (started by the dispatcher): land each green wave, clean up, ask only real questions through `pnpm prd ask`.

**Now (2026-11-22):** wave 1 **landed** in dev as 2b3a27d5 through PR #69 (Codex clean on dcd939f; report a60; to-test `2026-11-22-1632-agent-autonomy-2.md`). Docs folded; slice worktrees removed. B-507, B-509 and B-437 done; B-508 stays claimed until slice 2. Gate: `pnpm test:tooling` (855 passed) and `eslint scripts`.

**Wave 2 (started 2026-11-22):** the wave boundary is done (nothing new for this topic; synced with dev). B-514 and B-515 claimed. Slices 2, 4 and 5 are running on opus as background agents; on a takeover, respawn with `--continue`. Merge in plan order (2, 4, 5). `test-gates` had not landed when wave 2 started.

**Hook live test:** passed for the session's own size: this orchestrator read 53k from `pnpm prd context` after a wrapper start. Whether a subagent's PostToolUse names its own transcript is still unproven.

**Skipping the browser tooling test (until `test-gates` slice 8 lands):** the user's decision, relayed 2026-11-22 by the session `caretook-com-6a`. Slices may leave `scripts/loops/browser.test.mjs` out of their own tooling runs, because it is the slowest by far. They keep it if the slice changes `scripts/loops/browser.sh`, `lib.sh`, `lease.sh`, `scripts/loops/checks` or `scripts/browser-checks/`, and every hand-off says whether it was skipped. Vitest's `--exclude` doesn't drop it, so use the file list:

```sh
node scripts/loops/tooling-lint.mjs
files=$(pnpm exec vitest list --filesOnly --project tooling:unit --project scripts:unit | awk '/\.test\.[a-z]+$/ {print $NF}' | sort -u | grep -v 'loops/browser\.test\.mjs$')
pnpm exec vitest run --project tooling:unit --project scripts:unit $files # zsh: ${=files}
```

`pnpm prd check` still runs the file when a diff touches tooling (no skip switch yet): don't edit `check-body.sh` or bypass the gate. This orchestrator's landing gate keeps the full `pnpm test:tooling`.

**Open issues:**

- The hook has only run against a stub `claude`. `claude` 2.1.330 takes `--settings`, but the docs don't say that hooks passed this way merge with the others, or which transcript a subagent's PostToolUse names. First live test: this orchestrator's first session after the wave 1 landing should get a size in `pnpm prd context`. Slice 2 can time the nudge from `firstOverAt` (`remindedAt` moves on each repeat), setting `nudgeAt` through `updateRecord`.

- `test-gates` runs beside this topic and also changes rotation and the dispatcher; whichever lands second resolves those merges. If this topic is unlanded once `test-gates` lands, add `scripts/loops/dispatch`, `scripts/loops/status-extra` and `scripts/loops/prd.sh` back to this topic's hot list (narrowed in 784def6a).
- For slice 5 (from slice 3's hand-off): `tidy --yes` deletes an ended backlog record, so the keep-alive must not rely on one surviving. A second by-hand backlog session takes over the `backlog` record and the first runs unrecorded, so the `--remote-control backlog` process check still matters.
- Slice 3's first check crashed inside `eslint .` (Node exit 134) and passed on rerun with no lint change. Undiagnosed; watch for it at the wave gate.
- B-551 ('bye' for every agent role) is filed under this topic but has no slice in this plan. It is not being built here unless a later slice is planned for it.

**Backlog:** claim B-507, B-509 and B-508 when slice 1 starts; `done` B-507 and B-509 when slice 1 merges, B-508 when slice 2 merges. B-437 with slice 3, B-514 with slice 4, B-541 with slice 7; claim B-515 when slice 5 starts and leave it open with a note when slice 6 merges unless `inbox` is in the kept-alive kinds by then (`inbox-agent`'s slice 5 then closes it).

Fold into the docs at landing (the PRD's _Docs at landing_): wave 1, [machinery](../docs/agents/machinery.md) (the hook, the size record, `pnpm prd context`), [orchestrator](../docs/agents/orchestrator.md) (the rotation rule: reword the 160k line already there), [loop](../docs/agents/loop.md) (the loop's reminder), [orchestration](../docs/orchestration.md); wave 2, machinery (the dispatcher's follow-up, `rotate --self`), [backlog](../docs/agents/backlog.md) (the hand-off); wave 1 also [hotfix](../docs/agents/hotfix.md) and [recovery](../docs/agents/recovery.md) (recorded sessions); wave 3, machinery and backlog (the keep-alive). Trim at least what you fold in.

## Architectural decisions

- **Tooling only:** `scripts/loops/`, its tests, prompts. No app code, no migration, no dependency.
- **The hook can never hurt a session:** it never blocks a tool call, exits 0 on any error, and prints nothing unless it has a reminder or a nudge to give.
- **One size record per session name** in the main checkout's `.loops/`, written atomically by the hook, read by `context`, `status` and the dispatcher. Nobody else finds or reads transcripts.
- **Pure decision, thin command:** the size read, the hook's decision and the dispatcher's context decision are functions tested alone.
- **The dispatcher rotates a session only** when its nudge was delivered, it has no keep, and it runs no `pnpm prd` command; it never touches a session opened by hand or a planner.
- **Every session the tooling opens is recorded** through `session.sh`, with Remote Control under the record's name; the dispatcher only reopens or keeps alive what it can find a record for.
- **Tests never touch** real transcripts, session records, asks or sessions; transcript text in tests is fictional.

## How to run this plan

- **Waves:** 1: slices 1 and 3. 2: slices 2, 4 and 5. 3: slices 6 and 7. Each lands something usable alone.
- **Who owns what in a shared wave.** Wave 1: slice 1 owns the hook, the size record, `pnpm prd context` and status's size column; slice 3 owns `session.sh`'s kinds, the commands that start backlog, hotfix and recovery sessions, status's kind column and the opener's main-checkout case. Both touch `session.sh` (slice 1 the settings file it passes, slice 3 the kinds) and status's session lines: the orchestrator merges. Wave 2: slice 2 owns the dispatcher's context decision; slice 4 owns `rotate.sh`/`rotate-into.sh` and the backlog prompt. Slice 5 owns the keep-alive decision, its question and its tick step; slices 2 and 5 both add to the dispatcher's tick and state, in separate entries: the orchestrator merges. Slice 2's rotation calls slice 4's `--self` only for backlog sessions, and that wiring is slice 6's. Wave 3: slice 6 owns the context watch's backlog case; slice 7 owns the request queue, its commands and its tick step; both touch the dispatcher's tick in separate steps.
- **Gate:** the diff is tooling and Markdown, so the check gate needs nothing; run `pnpm test:tooling` and `pnpm exec eslint scripts` before each landing. No browser checks.
- **Models:** opus or stronger for every slice.
- **Reaching sessions:** the hook reaches a session only when it is next started through the wrapper, so this PRD's own orchestrator gets it at its first rotation after wave 1. Say so in the landing report.
- **Other topics:** `test-health`, `inbox-agent`, `code-health` and `fixes-tooling` change the same directory; don't run beside them and sync at each wave boundary.

## Slice 1: A session past 160k is told to hand off

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/loop.md · Tests: unit

**User stories:** US 1, 2, 3, 4, 5.

**Build:** the PRD's context watch without the dispatcher's part. **First, read the current Claude Code hook documentation** (the PRD's _Check the hook's contract first_) and build to what it says, with the PRD's two fallbacks; report in the hand-off which path was taken. Then: the pure size read from transcript text; the hook (after each tool call; writes the size record; silent under `CARETOOK_CONTEXT_LIMIT`; the reminder at the first crossing and then every `CARETOOK_CONTEXT_REMIND_MIN`; delivers a waiting nudge once and marks it delivered; silent while kept); the session wrapper gives it to `prd` sessions and leaves planner sessions alone; the orchestrator's and the loop's reminder words; the size record; `pnpm prd context`, `--keep "<why>"`, `--all [--json]`; `pnpm prd status` shows each live session's size, the over-limit mark, the keep reason, and "no size yet". The orchestrator prompt's rotation line: past the limit rotate at the next safe point, mid-wave included, without asking; a step that can't resume from _Status_ finishes first with `--keep` and the reason in _Status_.

**Acceptance criteria:**

- Size unit tests on fictional transcript text: the last assistant usage wins; input, cache read and cache creation are summed; lines without usage, a half-written last line and an empty transcript give no size.
- Hook command tests (a temporary transcript and record directory, the hook input on stdin): under the limit it prints nothing and writes the size; at the first crossing it prints the orchestrator's reminder with the size and the limit; a second call inside the repeat time is silent and one after it reminds again; a waiting nudge is delivered once and marked; a keep silences it until it expires; a subagent's call gets the loop's words from its own transcript and doesn't change the session's size (or, on the fallback, such a call is ignored); a missing transcript, bad input or an unwritable record directory exits 0 with no output.
- Wrapper tests (the stub `claude`): a `prd` session is started with the hook; a `plan` session isn't; the user's own session in the main checkout gets no reminder.
- Command tests: `context` prints the caller's size; `--keep` without a reason is refused, with one it sets the expiry; `--all --json` lists live sessions only and ignores a record whose pid isn't the live session's. `status` shows the size, the mark, the keep reason and "no size yet".
- Prompt tests cover the rotation line.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 2.

## Slice 2: The dispatcher follows up on a session that stays large

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md · Tests: unit

**User stories:** US 6.

**Build:** the PRD's dispatcher part. The pure context decision over the size records, session records, asks and "a `pnpm prd` command is running under the session": for a live managed orchestrator over the limit with no keep, a nudge `CARETOOK_CONTEXT_NUDGE_MIN` after the first reminder; the same wait after the nudge's delivery, a defaulting question ("rotate it now", recommended, or "leave it"), one per session, with its own marker and its own entry in the dispatcher's state, apart from the reopen question; on "rotate it now" the mid-wave rotation for that topic at the first tick with no command running, and one report when rotation refuses; on "leave it" nothing more for that session; everything cleared when the session drops under the limit or ends. The tick gathers the facts and acts; `--dry-run` shows what it would do; `CARETOOK_CONTEXT_WATCH=off`. Uses `agent-autonomy`'s defaulting asks (wave 1, in dev).

**Acceptance criteria:**

- Decision unit tests: under the limit, nothing; over the limit before the wait, nothing; after it, a nudge, once; an undelivered nudge never becomes a question; after the second wait, the question, once; a keep, a hand-opened session, a planner, a stale record and a paused dispatcher give nothing; "rotate it now" (given or defaulted) gives a rotate only when no command runs, and waits a tick while one does; "leave it" gives nothing for that session again; a new session of the same name starts clean.
- A pick test with a reopen question and a context question open for one topic: each is matched to its own handling, and an answer to one is never read as the other's.
- Tick tests (stub rotate and ask): the nudge is written to the size record; the question is filed as defaulting with the push helper started; the rotation is called with the topic, mid-wave and a reason; a refusing rotation files one report and isn't retried every tick; `--dry-run` writes nothing.
- `pnpm test:tooling` passes.

**Blocked by:** 1. **Blocks:** nothing.

## Slice 3: Backlog, hotfix and recovery sessions are recorded

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md, docs/agents/hotfix.md, docs/agents/recovery.md · Tests: unit

**User stories:** US 7.

**Build:** the PRD's _More kinds_. `session.sh --kind backlog|hotfix|recovery`, the record's model; the start sites through the wrapper with Remote Control: `pnpm prd plan` with no topic (backlog), `pnpm prd hotfix`'s `--open` exec and printed line, `recover.sh`'s `recover` session (kind `recovery`); `pnpm prd status` lists every kind; `pnpm prd open <name>`: backlog and recovery fresh in the main checkout, a hotfix with `--continue` in its worktree (the opener's main-checkout and `hotfix/` cases); `tidy` and `end-session` with worktree-less kinds.

**Acceptance criteria:**

- Wrapper tests (the stub `claude`): each new kind writes its record with the model; an unknown kind is refused naming all five.
- Start-site tests: `prd plan` with no topic, `prd hotfix` (open and printed) and `recover.sh` start through `session.sh` with the kind and Remote Control.
- Opener tests: a recorded backlog session reopens fresh in the main checkout, never `--continue`, even with other conversations there; a hotfix reopens with `--continue` in its worktree.
- Status and tidy tests: live backlog and hotfix sessions show with their kinds; an ended backlog record with no worktree is safe to remove; a live one is never touched.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 4, 5.

## Slice 4: Hand off from the phone

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**User stories:** US 8, 9.

**Build:** the PRD's _`rotate --self`_ and _The prompts_. `pnpm prd rotate --self [--brief <file>]`: the caller found by its ancestor `claude` pid against live records; backlog (and later inbox) sessions rotate into a fresh session of the same kind, name, model and Remote Control with the backlog prompt; an orchestrator behaves as plain `rotate`; other kinds are refused. `--brief` puts the file's text at the top of the new prompt and deletes it once read; a stale brief is deleted when a session starts. The backlog prompt's hand-off paragraph.

**Acceptance criteria:**

- Rotate tests (stub `claude`, stub opener): `--self` from a backlog session ends it and opens a backlog session of the same name and model; with `--brief` the new prompt starts with the brief and the file is gone; without, no brief section; a stale brief file is deleted at start and not used; `--self` from an orchestrator behaves as plain `rotate`; a hotfix, recovery or unrecorded caller is refused, saying why.
- A brief file that can't be read is refused before anything ends.
- Prompt tests: the backlog prompt has the hand-off paragraph with both modes.
- `pnpm test:tooling` passes.

**Blocked by:** 3. **Blocks:** 6.

## Slice 5: An always-on backlog session

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**User stories:** US 10, 12.

**Build:** the PRD's _The keep-alive_. The pure decision (kinds kept alive: `backlog`, and `inbox` if `inbox-agent`'s inbox session is in dev by then); live means a live record, a record `rotating` within the grace period, or a `claude` process with `--remote-control <kind>`; the tick opens a fresh managed backlog session, no PRD slot; its own question after three quick deaths with its own marker and state entry; paused stops it; `CARETOOK_KEEP_SESSIONS=off`.

**Acceptance criteria:**

- Decision unit tests: nothing live and not paused gives "open"; a live recorded session, a `rotating` record inside the grace, and an unrecorded `--remote-control backlog` process each give nothing; a third quick death gives the keep-alive question, not a fourth open; "stop keeping it alive" gives nothing again until the next dispatcher start; paused, or the switch off, gives nothing; the kinds list drives it (a test with `inbox` added).
- A pick test with a reopen question and a keep-alive question open: each goes to its own handling.
- A pick test: a backlog session never takes a slot, so a start the slots allow still happens.
- `pnpm test:tooling` passes.

**Blocked by:** 3. **Blocks:** 6.

## Slice 6: The context watch rotates backlog sessions

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**User stories:** US 11.

**Build:** the PRD's _The context watch for backlog sessions_. The hook given to backlog sessions with the backlog words; slice 2's nudge and question extended to managed backlog sessions; the guard counts `pnpm backlog` as well as `pnpm prd` commands; the rotation is `rotate --self` with the brief only if written after the nudge's delivery.

**Acceptance criteria:**

- Hook tests: a backlog session over the limit gets the backlog words.
- Decision and tick tests: a managed backlog session over the limit is nudged and then asked like an orchestrator; a running `pnpm backlog` command holds the rotation a tick; the rotation runs `--self` with a brief written after the delivery, and without one when the only brief is older.
- `pnpm test:tooling` passes.

**Blocked by:** 2, 4, 5. **Blocks:** nothing.

## Slice 7: Named backlog sessions on request

Stack: no · Reads: docs/agents/machinery.md, docs/agents/backlog.md · Tests: unit

**User stories:** US 13, 14.

**Build:** the PRD's _Named sessions on request_. `pnpm prd session request backlog <name> [--brief <file>] [--model <m>]` and `pnpm prd session requests [--json]`; the request store in `.loops/.requests/`; the dispatcher's tick step (the oldest pending request; refuse a live name or over `CARETOOK_MAX_BACKLOG_SESSIONS`; else open `backlog-<name>` with Remote Control `backlog - <name>`, the brief on top, managed, not kept alive; a notice either way; the request marked done); paused leaves requests pending; `pnpm prd status` lists pending ones. The backlog prompt: when the user asks for another backlog session for a task, write a brief and request it, then tell the user the name.

**Acceptance criteria:**

- Request tests: a good name files a request and prints its id; a bad name, or a brief file that can't be read, is refused; `requests --json` lists it.
- Decision unit tests: the oldest pending request is taken; a live name is refused with a reason; the limit counts every live backlog-kind session, the default and by-hand ones included; paused takes nothing; a refused or opened request is never taken again.
- Tick tests (stub opener): an accepted request opens `backlog-<name>` through `session.sh --kind backlog` with Remote Control `backlog - <name>` and the brief at the top of the prompt, posts the opened notice and marks it done; a refusal posts its notice; the keep-alive never reopens a named session.
- Prompt tests: the backlog prompt has the request paragraph.
- `pnpm test:tooling` passes.

**Blocked by:** 3, 4. **Blocks:** nothing.
