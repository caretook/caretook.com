# Planner handbook

For a planning agent: writing a PRD and its plan on `plan/<topic>` in `.loops/plan-<topic>` (stackless, from `dev`). Read [backlog](backlog.md) too: you triage items into the topic.

## From idea to plan

**Decide, then report.** The user accepts nearly every recommendation, so don't interview: explore, decide, write, and ask only what _What to ask_ names.

1. **Explore:** the items, the area docs, the code and [preferences](preferences.md) (what the user has already settled).
2. **Ask once, if at all** (_What to ask_), then decide everything else yourself.
3. **PRD:** `plans/<topic>-prd.md`, opening with a _Decisions_ table (below), then _The PRD's shape_. No GitHub issues: the PRD, the plan and the backlog are the record.
4. **Plan:** cut it into tracer-bullet vertical slices in `plans/<topic>-plan.md` (_The plan's shape_). The breakdown is yours; don't ask for approval.
5. **The skeptic pass** (below), then land and report.
6. **Loops** run the slices, one agent per slice, under the PRD's [orchestrator](orchestrator.md). When the PRD is done, its decisions move into the area docs and it's marked done.

**Don't load the `write-a-prd`, `prd-to-plan` or `grill-me` skills.** They tell you to interview the user and wait for approval, which this handbook forbids; what they were used for is written here.

`pnpm prd plan <topic> --open [B-<n> …]` does steps 1 to 5 in one session: it makes the worktree and starts an agent there (`prompt.sh plan`), on opus, or on Fable for a row flagged `design` (`--model` overrides).

## What to ask

Ask only when a wrong guess is costly to undo or the choice is the user's alone, and neither the items, the area docs nor [preferences](preferences.md) answer it:

- **Scope:** dropping or deferring an item, or adding work no item asks for.
- **Who can see or change what:** a role, a permission, sharing with someone new.
- **Existing data:** deleting it, or changing what it means.
- **Compliance:** consent, a vendor that sees health data, retention (AGENTS.md, _Compliance_).
- **A new dependency or paid service.**
- **Product direction:** removing or renaming a feature users know, or two designs that change what the product does (not how it looks or where a control sits), where you can't pick with confidence.

Never ask about module layout, naming, the slice breakdown, test choices, or **any UX or UI detail**: how a page or component looks, where a control sits, icons or text, wording and labels, colours, spacing, motion, defaults, empty states, which pages get a look first, optional extras. A UX or UI choice is never product direction, however visible. The test: if one slice could change it later with no migration and no lost data, don't ask. Pick the smallest version that fits the item's own words and the existing screens, record it as `assumed`, and the user vetoes from the table. An item's note saying "ask when the PRD is written" doesn't make a question worth asking: this list decides. Ask in **one** AskUserQuestion round (at most four questions, your recommendation first, never numbered lists) after exploring; with nothing to ask, say so and carry on. Send no PushNotification, for the question or the report: pushes are only for questions filed with `pnpm prd ask`. A skipped question is no answer: take your recommendation and record it as assumed.

**Unattended** (`prompt.sh plan <topic> --auto`, the dispatcher's): no one watches the terminal, so each question is a `pnpm prd ask` with a PushNotification after it, waited on in the background with no timeout: `--defaults` with a recommendation (the tool takes it after 30 minutes, never you), `--waits` for the [never list](preferences.md#planning-and-slices). The report is a `pnpm prd ask --report` (the assumed rows, how to veto; never pushed), filed after landing and before `pnpm prd rm`.

## The Decisions table

The PRD opens with it, the costliest to change first, so the user can veto by reading one table:

```
| Decision | Why | Source | Cost to change later |
| -------- | --- | ------ | -------------------- |
| Owners only can export | least exposure | assumed | low: one permission |
| Keep reminders until wave 2 | the user's call | asked: recommended drop, chose keep | high |
```

**Source** is `assumed` (you decided), `asked: as recommended`, `asked: recommended X, chose Y`, or `preference` (from the preferences doc). The `chose` rows show which kinds of question are still worth asking; when one states a rule that will outlast this topic, add it to [preferences](preferences.md) on your branch.

## The PRD's shape

After the _Decisions_ table: **Problem** and **Solution** (both from the user's side); **User stories** (numbered, "As a …, I want …, so that …", covering every item); **Implementation decisions** (modules built or changed and their interfaces, schema, API contracts, interactions; prefer deep modules, a lot behind a small interface that tests alone; no file paths or code); **Testing decisions** (which modules, at which level, the prior art); **Out of scope**; **Notes**.

## The skeptic pass

Before landing, `pnpm prd prompt skeptic plan --evidence <file>` prints the brief for one fresh agent on Opus (`model: "opus"`). It reads the PRD, the plan and the items cold and returns **go** or **send-back** with a short list: an `assumed` decision that _What to ask_ says to ask; an item's need left uncovered; a slice too big for one agent or missing a `Blocked by`; a broken [rule across PRDs](orchestrator.md#rules-across-prds) or test budget. It never moves a UX or UI detail to "ask". Record it: `pnpm prd skeptic record --kind plan --verdict go|send-back --why "…"`.

- **Go:** fix what's right, note what you declined and why under the table, and ask the user only the decisions it rightly moved to "ask".
- **Send-back:** rework, then run a fresh skeptic once more (one retry).
- **A second send-back** is the user's. Attended: AskUserQuestion. Unattended: first flag the row `hold`, keeping its other flags, so the dispatcher never starts the plan; then a `--waits` question with `--skeptic <its id>`. Land only after the answer, with `hold` still on; the report says how to lift it.

## The plan's shape

- A _Status_ table (slice, wave, state, merge SHAs), which the orchestrator keeps current; the durable architectural decisions every slice follows; _How to run this plan_ (waves, gates, what each slice owns).
- Each slice: its fields line, user stories, what to build, acceptance criteria, and what it's **Blocked by** and **Blocks**, so independent slices can run at once.
- **A slice is a tracer bullet:** a thin, complete path through every layer it needs (schema, service, API, screen, tests) that can be shown or checked alone, never one layer across the feature. Name durable things (routes, tables, models), not files or functions.
- Follow the [rules across PRDs](orchestrator.md#rules-across-prds): say "adds a migration", never a number; plan a regions slice first when two PRDs share a hot file.
- **Keep a PRD small: about six slices at most.** Cut a bigger one into follow-on topics (`<topic>-2`) that each land something usable, so the next planner or the user can reorder fixes between them. Say in the report what you cut and where it went.
- **Small fixes go to five standing topics**, `fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`: a plan each and no PRD, one slice and one item per fix, appended by its orchestrator before a wave; `prompt.sh` treats the plan as the whole spec. An item's topic is its category; [`plans/fixes-rules.md`](../../plans/fixes-rules.md) has the rules and the tie-break (`bug`, `perf`, `ui`, `tooling`, `nit`: for triage only). The order between the topics is the user's; never invent one. Never file a new fix as `quick-fixes`.

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

1. Commit both files (`docs(<topic>): …`). Through `pnpm backlog`, set the items' `prd=<topic> status=triaged` with a note, and the topic's row: `prd set <topic> after=… hot=…` (path prefixes; never a hand edit), after `pnpm backlog prd add <topic>` only when `prd list` has no row yet. After `pnpm prd rm plan-<topic>` and the report, `cd` to the main checkout and `pnpm prd end`.
2. Check `git diff --stat dev...plan/<topic>` lists only `plans/` and `docs/` files; if anything else changed, it isn't a planning branch: ask first.
3. `pnpm prd sync` if `dev` moved, then `pnpm prd land plan/<topic> -m "docs(<topic>): PRD and plan for … (B-<n>, …)"` (plain: no check gate applies, so never `--force`) and `pnpm prd rm plan-<topic>`.
4. **Report:** the _Decisions_ table's `assumed` rows (the top five, the costliest first), what the skeptic changed, and how to start it: `pnpm prd start <topic>` or `pnpm prd queue <topic>`. A veto is a docs edit until its slice starts: the user tells any planning or backlog session.

**Bye:** a message of just 'bye' runs `pnpm prd bye` after your own checks: the plan landed (or the user keeps it out), the report filed.
