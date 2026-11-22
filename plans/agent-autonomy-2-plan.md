# Plan: The context watch (agent autonomy, part 2)

> Source PRD: [`plans/agent-autonomy-2-prd.md`](agent-autonomy-2-prd.md). User-story numbers (US) refer to it. Backlog items B-507 (a context hook), B-508 (context size in status, the dispatcher's nudge), B-509 (the rule: rotate past 160k). Topic `agent-autonomy-2`, after `agent-autonomy`.

## Status

| Slice | Wave | State | Merge into `prd/agent-autonomy-2` (slice commits) |
| ----- | ---- | ----- | ------------------------------------------------- |
| 1     | 1    | —     | —                                                 |
| 2     | 2    | —     | —                                                 |

**Backlog:** claim B-507, B-509 and B-508 when slice 1 starts; `done` B-507 and B-509 when slice 1 merges, B-508 when slice 2 merges.

Fold into the docs at landing (the PRD's _Docs at landing_): wave 1, [machinery](../docs/agents/machinery.md) (the hook, the size record, `pnpm prd context`), [orchestrator](../docs/agents/orchestrator.md) (the rotation rule: reword the 160k line already there), [loop](../docs/agents/loop.md) (the loop's reminder), [orchestration](../docs/orchestration.md); wave 2, machinery (the dispatcher's follow-up). Trim at least what you fold in.

## Architectural decisions

- **Tooling only:** `scripts/loops/`, its tests, prompts. No app code, no migration, no dependency.
- **The hook can never hurt a session:** it never blocks a tool call, exits 0 on any error, and prints nothing unless it has a reminder or a nudge to give.
- **One size record per session name** in the main checkout's `.loops/`, written atomically by the hook, read by `context`, `status` and the dispatcher. Nobody else finds or reads transcripts.
- **Pure decision, thin command:** the size read, the hook's decision and the dispatcher's context decision are functions tested alone.
- **The dispatcher rotates a session only** when its nudge was delivered, it has no keep, and it runs no `pnpm prd` command; it never touches a session opened by hand or a planner.
- **Tests never touch** real transcripts, session records, asks or sessions; transcript text in tests is fictional.

## How to run this plan

- **Waves:** 1: slice 1. 2: slice 2. Each lands something usable alone.
- **Gate:** the diff is tooling and Markdown, so the check gate needs nothing; run `pnpm test:tooling` and `pnpm exec eslint scripts` before each landing. No browser checks.
- **Models:** opus or stronger for both.
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

**Build:** the PRD's dispatcher part. The pure context decision over the size records, session records, asks and "a `pnpm prd` command is running under the session": for a live managed orchestrator over the limit with no keep, a nudge `CARETOOK_CONTEXT_NUDGE_MIN` after the first reminder; the same wait after the nudge's delivery, a defaulting question ("rotate it now", recommended, or "leave it"), one per session, with its own marker and its own entry in the dispatcher's state, apart from the reopen question; on "rotate it now" the mid-wave rotation for that topic at the first tick with no command running, and one report when rotation refuses; on "leave it" nothing more for that session; everything cleared when the session drops under the limit or ends. The tick gathers the facts and acts; `--dry-run` shows what it would do; `CARETOOK_CONTEXT_WATCH=off`. Needs `agent-autonomy`'s defaulting asks in `dev` (the row's `After`).

**Acceptance criteria:**

- Decision unit tests: under the limit, nothing; over the limit before the wait, nothing; after it, a nudge, once; an undelivered nudge never becomes a question; after the second wait, the question, once; a keep, a hand-opened session, a planner, a stale record and a paused dispatcher give nothing; "rotate it now" (given or defaulted) gives a rotate only when no command runs, and waits a tick while one does; "leave it" gives nothing for that session again; a new session of the same name starts clean.
- A pick test with a reopen question and a context question open for one topic: each is matched to its own handling, and an answer to one is never read as the other's.
- Tick tests (stub rotate and ask): the nudge is written to the size record; the question is filed as defaulting with the push helper started; the rotation is called with the topic, mid-wave and a reason; a refusing rotation files one report and isn't retried every tick; `--dry-run` writes nothing.
- `pnpm test:tooling` passes.

**Blocked by:** 1. **Blocks:** nothing.
