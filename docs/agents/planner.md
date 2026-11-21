# Planner handbook

For a planning agent: writing a PRD and its plan on `plan/<topic>` in `.loops/plan-<topic>` (stackless, from `dev`). Read [backlog](backlog.md) too: you triage items into the topic.

## From idea to plan

**Decide, then report.** The user accepts nearly every recommendation, so don't interview: explore, decide, write, and ask only what _What to ask_ names.

1. **Explore:** the items, the area docs, the code and [preferences](preferences.md) (what the user has already settled).
2. **Ask once, if at all** (_What to ask_), then decide everything else yourself.
3. **PRD:** the `write-a-prd` skill for its exploration and template, without its interview, saved as `plans/<topic>-prd.md` with a _Decisions_ table (below). No GitHub issues: the PRD, the plan and the backlog are the record.
4. **Plan:** `prd-to-plan` cuts it into tracer-bullet vertical slices in `plans/<topic>-plan.md`. The breakdown is yours; don't ask for approval.
5. **The skeptic pass** (below), then land and report.
6. **Loops** run the slices, one agent per slice, under the PRD's [orchestrator](orchestrator.md). When the PRD is done, its decisions move into the area docs and it's marked done.

`pnpm prd plan <topic> --open [B-<n> …]` does steps 1 to 5 in one session: it makes the worktree and starts an agent there (`prompt.sh plan`).

## What to ask

Ask only when a wrong guess is costly to undo or the choice is the user's alone, and neither the items, the area docs nor [preferences](preferences.md) answer it:

- **Scope:** dropping or deferring an item, or adding work no item asks for.
- **Who can see or change what:** a role, a permission, sharing with someone new.
- **Existing data:** deleting it, or changing what it means.
- **Compliance:** consent, a vendor that sees health data, retention (AGENTS.md, _Compliance_).
- **A new dependency or paid service.**
- **Product direction:** removing or renaming a feature users know, or two designs that change what the product does (not how it looks or where a control sits), where you can't pick with confidence.

Never ask about module layout, naming, the slice breakdown, test choices, or **any UX or UI detail**: how a page or component looks, where a control sits, icons or text, wording and labels, colours, spacing, motion, defaults, empty states, which pages get a look first, optional extras. A UX or UI choice is never product direction, however visible. The test: if one slice could change it later with no migration and no lost data, don't ask. Pick the smallest version that fits the item's own words and the existing screens, record it as `assumed`, and the user vetoes from the table. An item's note saying "ask when the PRD is written" doesn't make a question worth asking: this list decides. Ask in **one** AskUserQuestion round (at most four questions, your recommendation first, never numbered lists) after exploring; with nothing to ask, say so and carry on. **Notify first:** the user is often away, so send a PushNotification naming the topic and the decision just before you ask (it reaches their phone through Remote Control), and again when you report. A skipped question is no answer: take your recommendation and record it as assumed.

## The Decisions table

The PRD opens with it, the costliest to change first, so the user can veto by reading one table:

```
| Decision | Why | Source | Cost to change later |
| -------- | --- | ------ | -------------------- |
| Owners only can export | least exposure | assumed | low: one permission |
| Keep reminders until wave 2 | the user's call | asked: recommended drop, chose keep | high |
```

**Source** is `assumed` (you decided), `asked: as recommended`, `asked: recommended X, chose Y`, or `preference` (from the preferences doc). The `chose` rows show which kinds of question are still worth asking; when one states a rule that will outlast this topic, add it to [preferences](preferences.md) on your branch.

## The skeptic pass

Before landing, spawn one fresh agent (the session's own model) that reads the PRD, the plan and the items cold and returns a short list: an `assumed` decision that _What to ask_ says to ask; an item's need left uncovered; a slice too big for one agent or missing a `Blocked by`; a broken [rule across PRDs](orchestrator.md#rules-across-prds) or test budget. Fix what's right, note what you declined and why under the table, and ask the user only the decisions it rightly moved to "ask". It never moves a UX or UI detail there.

## The plan's shape

- A _Status_ table (slice, wave, state, merge SHAs), which the orchestrator keeps current; the durable architectural decisions every slice follows; _How to run this plan_ (waves, gates, what each slice owns).
- Each slice: its fields line, user stories, what to build, acceptance criteria, and what it's **Blocked by** and **Blocks**, so independent slices can run at once.
- Follow the [rules across PRDs](orchestrator.md#rules-across-prds): say "adds a migration", never a number; plan a regions slice first when two PRDs share a hot file.
- **Keep a PRD small: about six slices at most.** Cut a bigger one into follow-on topics (`<topic>-2`) that each land something usable, so the next planner or the user can reorder fixes between them. Say in the report what you cut and where it went.
- **Small fixes land by category.** Every `quick-fixes` item's triage note names one: `ui` (UI and UX), `tooling`, `perf` (optimizations), `bug` or `nit`. Each category lands separately, never mixed in one wave; their order of priority isn't decided yet, so don't invent one. Until the plan is split (B-395), the orchestrator groups a wave by category.
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
4. **Report:** the _Decisions_ table's `assumed` rows (the top five, the costliest first), what the skeptic changed, and how to start it: `pnpm prd start <topic>` or `pnpm prd queue <topic>`. A veto is a docs edit until its slice starts: the user tells any planning or backlog session.
