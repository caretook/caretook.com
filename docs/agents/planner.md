# Planner handbook

For a planning agent: writing a PRD and its plan on `plan/<topic>` in `.loops/plan-<topic>` (stackless, from `dev`). Read [backlog](backlog.md) too: you triage items into the topic.

## From idea to plan

1. **PRD:** the `write-a-prd` skill (explore the code, interview the user, sketch the modules and test choices with them), saved as `plans/<topic>-prd.md`. No GitHub issues: the PRD, the plan and the backlog are the record.
2. **Plan:** `prd-to-plan` cuts it into tracer-bullet vertical slices in `plans/<topic>-plan.md`. Ask the user to approve the breakdown before writing it.
3. **Loops** run the slices, one agent per slice, under the PRD's [orchestrator](orchestrator.md).
4. When the PRD is done, its decisions move into the area docs and it's marked done.

`pnpm prd plan <topic> --open [B-<n> …]` does steps 1 and 2 in one session: it makes the worktree and starts an agent there (`prompt.sh plan`) that interviews the user, writes both files, triages the items and lands them. Interview with AskUserQuestion, a few questions at a time, never numbered lists.

## The plan's shape

- A _Status_ table (slice, wave, state, merge SHAs), which the orchestrator keeps current; the durable architectural decisions every slice follows; _How to run this plan_ (waves, gates, what each slice owns).
- Each slice: its fields line, user stories, what to build, acceptance criteria, and what it's **Blocked by** and **Blocks**, so independent slices can run at once.
- Follow the [rules across PRDs](orchestrator.md#rules-across-prds): say "adds a migration", never a number; plan a regions slice first when two PRDs share a hot file.
- **`quick-fixes`** has a plan and no PRD (`plans/quick-fixes-plan.md`): small standalone fixes, one slice and one backlog item each, appended as the next slice. `prompt.sh` treats the plan as the whole spec.

## Slice fields

Every slice has a fields line directly under its heading (blank lines allowed between):

```
## Slice 3: Backlog write safety

Stack: no · Reads: docs/agents/loop.md, docs/domain/sync.md · Tests: unit, e2e:invites
```

- **`Stack: yes|no`**: whether the worktree needs a Docker stack (database, PowerSync, dev server, browser checks). `new.sh slice` reads it. Say yes only when needed: stackless worktrees still run integration tests.
- **`Reads:`** the docs the loop reads besides the core, from the _Area index_ (comma-separated; `none`).
- **`Tests:`** `unit`, `integration`, `component`, `e2e:<check>` (comma-separated).
- `·`, `;` or `|` separate fields; names are case-insensitive. A missing field means no stack and nothing extra to read, and `prompt.sh slice` warns. The parser is `scripts/loops/slice-fields.mjs`.

## The test budget

Acceptance criteria name the tests. Screens get component tests ([components](../domain/components.md#component-tests)), pure modules unit tests, services integration tests. End-to-end steps only for flows across the server and sync, added to the lean check that owns the flow ([the checks](loop.md#browser-checks)), never a new check per feature ([loop](loop.md#tests)).

## Landing a plan branch

A `plan/<topic>` branch touches no code, so its agent lands it whenever the PRD or plan is ready, without a go-ahead:

1. Commit both files (`docs(<topic>): …`). Through `pnpm backlog`, set the items' `prd=<topic> status=triaged` with a note, and add or update the topic's row in the PRD table.
2. Check `git diff --stat dev...plan/<topic>` lists only `plans/` and `docs/` files; if anything else changed, it isn't a planning branch: ask first.
3. `pnpm prd sync` if `dev` moved, then `pnpm prd land plan/<topic> --force -m "docs(<topic>): PRD and plan for … (B-<n>, …)"` and `pnpm prd rm plan-<topic>`.
4. Tell the user how to start it: `pnpm prd start <topic>` or `pnpm prd queue <topic>`.
