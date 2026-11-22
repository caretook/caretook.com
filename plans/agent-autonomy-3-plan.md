# Plan: The skeptic (agent autonomy, part 3)

> Source PRD: [`plans/agent-autonomy-3-prd.md`](agent-autonomy-3-prd.md). User-story numbers (US) refer to it. Backlog items B-511 (a skeptic before every ask), B-512 (a skeptic before risky landings), B-513 (opus planners with a Fable final check, the `design` flag). Topic `agent-autonomy-3`, after `agent-autonomy`.

## Status

| Slice | Wave | State | Merge into `prd/agent-autonomy-3` (slice commits) |
| ----- | ---- | ----- | ------------------------------------------------- |
| 1     | 1    | —     | —                                                 |
| 2     | 2    | —     | —                                                 |
| 3     | 2    | —     | —                                                 |
| 4     | 2    | —     | —                                                 |

**Backlog:** claim B-511 when slice 1 starts and `done` it when slice 2 merges; B-512 with slice 3; B-513 with slice 4.

Fold into the docs at landing (the PRD's _Docs at landing_): wave 1, [machinery](../docs/agents/machinery.md) (the store and the brief); wave 2, machinery, [orchestrator](../docs/agents/orchestrator.md), [planner](../docs/agents/planner.md), [preferences](../docs/agents/preferences.md), [backlog](../docs/agents/backlog.md). Trim at least what you fold in.

## Architectural decisions

- **Tooling only:** `scripts/loops/`, `scripts/backlog/registry`, their tests, prompts. No app code, no migration, no dependency.
- **The skeptic is a subagent the session spawns on Fable**; the tooling gives it a brief and checks its record. Nothing in the tooling calls a model.
- **Pure decision, thin command:** the record checker and the briefs are functions tested alone.
- **The never list is never decided by a skeptic**, and a skeptic's go never replaces the landing go-ahead itself.
- **Records live in the main checkout's `.loops/.skeptic/`**, untracked, written atomically; tests use temporary directories.
- **Tests never touch** the real asks queue, skeptic store, backlog or `origin`.

## How to run this plan

- **Waves:** 1: slice 1. 2: slices 2, 3 and 4. Each lands something usable alone.
- **Who owns what in wave 2:** slice 2 owns `ask.mjs`/`asks.mjs` and the asking paragraphs of the prompts; slice 3 owns `land.sh`, the landing and run-through reports, the orchestrator's landing rule and Codex step, and the preferences doc's never list; slice 4 owns the planner prompt and handbook, `registry.mjs`'s flags and the dispatcher's plan action. All three touch `prompt.sh` in different paragraphs: the orchestrator merges.
- **Gate:** tooling and Markdown; run `pnpm test:tooling` and `pnpm exec eslint scripts` before each landing. No browser checks.
- **Models:** opus for every slice.
- **Try it on itself:** sessions started before wave 2 lands carry old prompts; their questions without `--skeptic` are refused with the teaching line, and they refile. Say so in the landing report.

## Slice 1: The skeptic's brief and its record

Stack: no · Reads: docs/agents/machinery.md, docs/agents/preferences.md, docs/agents/planner.md · Tests: unit

**User stories:** the base of US 1 to 9.

**Build:** the PRD's _The skeptic store_ and _The brief_. The store and `pnpm prd skeptic record|list [--json]`; the pure checker; `pnpm prd prompt skeptic ask|land|plan --evidence <file>`, reading the never list and the rules from the docs; `CARETOOK_SKEPTIC_MAX_MIN`.

**Acceptance criteria:**

- Store tests: a record is written and listed; ids don't repeat; a bad verdict for its kind is refused (`go` for an ask, `decide` for a landing).
- Checker unit tests: the right kind and verdict pass; another topic, another tip, an old record or the wrong verdict each fail with a reason.
- Brief tests: each kind's brief includes the evidence, the never list as the preferences doc has it, and the verdict words for that kind; a missing evidence file is refused.
- `pnpm test:tooling` passes.

**Blocked by:** nothing. **Blocks:** 2, 3, 4.

## Slice 2: A skeptic before every ask

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/planner.md · Tests: unit

**User stories:** US 1, 2, 3, 4.

**Build:** the PRD's _Asking_. `pnpm prd ask --question` needs `--skeptic <id>` with an `ask` verdict (the dispatcher's session exempt, reports exempt); `--decided --skeptic <id> --chose <a>` files a settled record, never pushed, listed under "decided for you" and dismissed like a defaulted one. The orchestrator, unattended planner, hotfix and recovery prompts: write the evidence, run the skeptic on Fable, record, then ask or file the decision.

**Acceptance criteria:**

- Command tests: a question without `--skeptic` files nothing and names the steps; with a `decide` record it is refused, pointing at `--decided`; with an `ask` record it files as today, `--defaults` and `--waits` unchanged; the dispatcher's question needs none; a report needs none.
- `--decided` tests: it files a settled record with the option and why, prints no push line, is listed under "decided for you" and dismissed by `--done`; `--json` carries the verdict.
- Prompt tests cover the four asking paragraphs.
- `pnpm test:tooling` passes.

**Blocked by:** 1. **Blocks:** nothing.

## Slice 3: A skeptic's go lands `--force` and `--no-review`

Stack: no · Reads: docs/agents/machinery.md, docs/agents/orchestrator.md, docs/agents/preferences.md · Tests: unit

**User stories:** US 5, 6, 7.

**Build:** the PRD's _Landing_ and _Codex declines_. `land --force` and `--no-review` need `--skeptic <id>` (a `go` for this topic and tip) or `--by-user`; a `no` refuses with its why; the landing report and the run-through report print the verdict and every Codex-decline verdict recorded for the topic since its last landing. The orchestrator's landing rule and Codex step; the preferences doc's never list without "a forced landing".

**Acceptance criteria:**

- Landing tests (throwaway repositories, the PR seam): `--force` with neither flag is refused, naming both; with a `go` for the tip it lands and the report has the verdict; a `go` for an older tip, another topic, or an old record is refused; a `no` is refused with its why; `--by-user` lands and the report says so; the same for `--no-review`.
- A report test: Codex-decline verdicts recorded since the last landing are listed.
- Prompt tests cover the landing rule and the Codex step.
- `pnpm test:tooling` passes.

**Blocked by:** 1. **Blocks:** nothing.

## Slice 4: The planner's skeptic sends back, and the `design` flag

Stack: no · Reads: docs/agents/planner.md, docs/agents/backlog.md, docs/agents/machinery.md · Tests: unit

**User stories:** US 8, 9.

**Build:** the PRD's _Planner_ and _The `design` flag_. The planner prompts (attended and unattended) run the skeptic pass from the `plan` brief, with send-back, one retry and then a question or report; `registry.mjs` accepts `design`; the dispatcher's plan action and `pnpm prd plan <topic>` use `--model fable` for a `design` row.

**Acceptance criteria:**

- Registry tests: `design` is accepted and listed; `doctor` doesn't report it.
- Dispatcher tests: planning a `design` row runs the planner on Fable; any other row on opus.
- Command tests: `pnpm prd plan <topic>` prints or runs `--model fable` for a `design` row; `--model` still overrides.
- Prompt tests: both planner prompts describe send-back and the one retry.
- `pnpm test:tooling` passes.

**Blocked by:** 1. **Blocks:** nothing.
