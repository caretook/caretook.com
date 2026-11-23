# Plan: The skeptic (agent autonomy, part 3)

> Source PRD: [`plans/agent-autonomy-3-prd.md`](agent-autonomy-3-prd.md). User-story numbers (US) refer to it. Backlog items B-511 (a skeptic before every ask), B-512 (a skeptic before risky landings), B-513 (opus planners with an Opus final check, the `design` flag). Topic `agent-autonomy-3`, after `agent-autonomy` and `agent-autonomy-2`.

## Status

| Slice | Wave | State                           | Merge into `prd/agent-autonomy-3` (slice commits) |
| ----- | ---- | ------------------------------- | ------------------------------------------------- |
| 1     | 1    | merged, worktree removed (opus) | f84b26e1 (be4214ea)                               |
| 2     | 2    | —                               | —                                                 |
| 3     | 2    | —                               | —                                                 |
| 4     | 2    | —                               | —                                                 |

**Landing mode:** run everything through (started run-through): start every ready slice, land each green wave, clean up. Questions go through `pnpm prd ask`, never the terminal.

**Models:** opus for every slice (the plan's _Models_).

**Open issues:** none of ours. `pnpm backlog doctor` reports three findings on other topics (B-548, B-549, B-568), left alone.

**Backlog:** B-511 claimed (slice 1 started); `done` it when slice 2 merges; B-512 with slice 3; B-513 with slice 4.

**From slice 1's hand-off, for wave 2:**

- Slice 2: on `skeptic record`, `--option` is the option chosen and `--offer <a>` (repeated) the question's options; the hash covers the trimmed question and the options in order, so `ask` passes the same ones in the same order. A question with no recommendation counts as `waits`. `useRecord` spends the record before filing, so validate the question first or a failed `createAsk` burns the verdict.
- Slice 3: land verdicts need the full 40-character tip and an action of `force`, `no-review` or `decline <thread>`. They aren't spent, so a retry on the same tip works: use `checkRecord`, not `useRecord`.
- Slice 4: plan verdicts are `go` or `send-back`. A land `no` or plan `send-back` used for an ask is bound only by topic, age and single use.

**Wave 1:** quick check passed on the synced tip; tier `none` (tooling and docs), no CI run. PR #103, Codex clean on 32515ef; this docs-only trim (machinery was 18 bytes over budget) needs its verdict again. Next: land, then file the report and rotate. Wave 2 (slices 2, 3, 4) starts in the next session.

Fold into the docs at landing (the PRD's _Docs at landing_): wave 1, [machinery](../docs/agents/machinery.md) (the store and the brief); wave 2, machinery, [orchestrator](../docs/agents/orchestrator.md), [planner](../docs/agents/planner.md), [preferences](../docs/agents/preferences.md), [backlog](../docs/agents/backlog.md). Trim at least what you fold in.

## Architectural decisions

- **Tooling only:** `scripts/loops/`, `scripts/backlog/registry`, their tests, prompts. No app code, no migration, no dependency.
- **The skeptic is a subagent the session spawns, on Fable for a risky landing and on Opus for an ask or a plan**; the tooling gives it a brief and checks its record. Nothing in the tooling calls a model.
- **Pure decision, thin command:** the record checker and the briefs are functions tested alone.
- **The never list is never decided by a skeptic**, and a skeptic's go never replaces the landing go-ahead itself.
- **Records live in the main checkout's `.loops/.skeptic/`**, untracked, written atomically; tests use temporary directories.
- **Tests never touch** the real asks queue, skeptic store, backlog or `origin`.

## How to run this plan

- **Waves:** 1: slice 1. 2: slices 2, 3 and 4. Each lands something usable alone.
- **Who owns what in wave 2:** slice 2 owns `ask.mjs`/`asks.mjs` and the asking paragraphs of the prompts; slice 3 owns `land.sh`, the landing and run-through reports, the orchestrator's landing rule and Codex step, and the preferences doc's never list; slice 4 owns the planner prompt and handbook, `registry.mjs`'s flags and the dispatcher's plan action and the opener's planner line. All three touch `prompt.sh` in different paragraphs: the orchestrator merges.
- **Gate:** tooling and Markdown; run `pnpm test:tooling` and `pnpm exec eslint scripts` before each landing. No browser checks.
- **Models:** opus for every slice.
- **Try it on itself:** sessions started before wave 2 lands carry old prompts; their questions without `--skeptic` are refused with the teaching line, and they refile. Say so in the landing report.

## Slice 1: The skeptic's brief and its record

Stack: no · Reads: docs/agents/machinery.md, docs/agents/preferences.md, docs/agents/planner.md · Tests: unit

**User stories:** the base of US 1 to 9.

**Build:** the PRD's _The skeptic store_ and _The brief_. The store and `pnpm prd skeptic record|list [--json]`; the pure checker (kind, verdict, action, topic, tip, question hash and single use, age; the set an ask accepts; `decide` refused on a `--waits` class); `pnpm prd prompt skeptic ask|land|plan --evidence <file>`, reading the never list and the rules from the docs; `CARETOOK_SKEPTIC_MAX_MIN`.

**Acceptance criteria:**

- Store tests: a record is written and listed; ids don't repeat; a bad verdict for its kind is refused (`go` for an ask, `decide` for a landing).
- Checker unit tests: the right kind, verdict and action pass; another topic, another tip, another action (a decline go for `--force`), another question hash, a used record, an old record or the wrong verdict each fail with a reason; an ask accepts an ask `ask`, a land `no` and a plan `send-back`; a `decide` on a `--waits` class is refused at record time.
- Brief tests: each kind's brief includes the evidence, the never list as the preferences doc has it, and the verdict words for that kind; a missing evidence file is refused.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 2, 3, 4.

## Slice 2: A skeptic before every ask

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/planner.md · Tests: unit

**User stories:** US 1, 2, 3, 4.

**Build:** the PRD's _Asking_. `pnpm prd ask --question` needs `--skeptic <id>` with an `ask` verdict (the dispatcher's session `dispatch` exempt, on the honor system; reports exempt; also accepted: a land `no` and a plan `send-back`); the record is marked used; `--decided --skeptic <id> --chose <a>` files a settled record, never pushed, listed under "decided for you" and dismissed like a defaulted one. The run-through orchestrator's and unattended planner's prompts: write the evidence, run the skeptic on Opus, record, then ask or file the decision.

**Acceptance criteria:**

- Command tests: a question without `--skeptic` files nothing and names the steps; with a `decide` record it is refused, pointing at `--decided`; with an `ask` record it files as today, `--defaults` and `--waits` unchanged; the dispatcher's question needs none; a report needs none.
- `--decided` tests: it files a settled record with the option and why, prints no push line, is listed under "decided for you" and dismissed by `--done`; `--json` carries the verdict.
- Command tests: a question with a land `no` or a plan `send-back` record files; a reused record is refused; `--decided` with a `--waits`-class record is refused.
- Prompt tests cover the two asking paragraphs.
- `pnpm test:tooling` passes.

**Blocked by:** 1. **Blocks:** nothing.

## Slice 3: A skeptic's go lands `--force` and `--no-review`

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/preferences.md · Tests: unit

**User stories:** US 5, 6, 7.

**Build:** the PRD's _Landing_ and _Codex declines_. `land --force` and `--no-review` need `--skeptic <id>` (a `go` for this topic, tip and action) or `--by-user`; an out-of-credits Codex state lets `--no-review` through with neither; on a brake, in pre-deployment mode or on an unsynced tip `--force` needs `--by-user`; a `no` refuses with its why; the landing report and the run-through report print the verdict and every Codex-decline verdict recorded for the topic since its last landing. The orchestrator's landing rule and Codex step; the hotfix handbook and prompt (`--by-user`); the preferences doc's never list without "a forced landing".

**Acceptance criteria:**

- Landing tests (throwaway repositories, the PR seam): `--force` with neither flag is refused, naming both; with a `go` for the tip it lands and the report has the verdict; a `go` for an older tip, another topic, or an old record is refused; a `no` is refused with its why; `--by-user` lands and the report says so; the same for `--no-review`.
- Out-of-credits: `--no-review` with neither flag lands when the review state is `out-of-credits`, and is refused otherwise.
- Modes: a go is refused for `--force` on a brake, in pre-deployment mode and on an unsynced tip; `--by-user` lands there.
- A report test: Codex-decline verdicts recorded since the last landing are listed.
- **Try it:** from an orchestrator session, run `land --force --skeptic <id>` through the throwaway seam; if the agent's permission rules block it, say so in the hand-off and the landing report (only the user can add an allow rule).
- Prompt tests cover the landing rule and the Codex step.
- `pnpm test:tooling` passes.

**Blocked by:** 1. **Blocks:** nothing.

## Slice 4: The planner's skeptic sends back, and the `design` flag

Stack: no · Reads: docs/agents/planner.md, docs/agents/backlog.md, docs/agents/machinery.md · Tests: unit

**User stories:** US 8, 9.

**Build:** the PRD's _Planner_ and _The `design` flag_. The planner prompts (attended and unattended) run the skeptic pass from the `plan` brief, with send-back, one retry and then a question or report; `registry.mjs` accepts `design`; the dispatcher's plan action, the opener's planner line and `pnpm prd plan <topic>` use `--model fable` for a `design` row; unattended, a second send-back files a `--waits` question and flags the row `hold` before the plan lands.

**Acceptance criteria:**

- Registry tests: `design` is accepted and listed; `doctor` doesn't report it.
- Dispatcher and opener tests: planning or reopening a `design` row's planner runs it on Fable; any other row on opus.
- Command tests: `pnpm prd plan <topic>` prints or runs `--model fable` for a `design` row; `--model` still overrides.
- Prompt tests: both planner prompts describe send-back and the one retry.
- `pnpm test:tooling` passes.

**Blocked by:** 1. **Blocks:** nothing.
