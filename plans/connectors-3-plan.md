# Plan: Connectors 3 (the dose schedule ahead, and repeating todos)

> Source PRD: [`plans/connectors-3-prd.md`](connectors-3-prd.md). User-story numbers (US) refer to it. Backlog items B-252, B-253 (B-196 moved to `connectors-4`, held). Topic `connectors-3`.

## Status

**Where it stands:** wave 1 green (2026-11-27); CI `integration` run 46059491494 braked on my plan file's format (fixed); run 46060325211 green on e7bcfb58a. Slice worktrees removed; sync skipped (no shared files). Docs folded (5d389ed91). PR and Codex review next. Slice worktrees kept until green. `planner-3` landed in `dev` (start condition met).

**Landing mode:** run everything through (dispatcher start): start every ready slice, land each green wave, ask only real questions through `risa ask`.

**Models:** slice 1 opus, slice 2 opus (both have real logic); both agents spawned 2026-11-27, watch running.

**Anchors (2026-11-27):** two misses, both things the slices create (`doseSchedule.test.ts`, `todoRepeatInput`); nothing to fix.

**Notes for the landing fold:** slice 1 added error code `connectorTool:invalid` (400) for a read tool's zone-dependent input check; the frozen export list no longer exists (test-health removed it), so nothing to add. Slice 2: connectors doc's "drops a `repeatRule` (B-253)" becomes the structured `repeat`; planner-3's `firstDayOf` could be exported to drop the tool's copy (a nit).

**Wave 2 (the user's pick, via the backlog session, 2026-11-27):** keep connectors-3 open and plan a wave 2 for B-760 (`add_provider`), B-761 (`add_medication`) and B-917 (log doses from a photo of the weekly sheet). Don't re-home them; no `risa rm` after wave 1 lands. Land PR #272, then plan wave 2.

| Slice | Wave | State  | Merge into `prd/connectors-3` (slice commits) |
| ----- | ---- | ------ | --------------------------------------------- |
| 1     | 1    | merged | a2383ef8b (ad3342564, c6147c2f9)              |
| 2     | 1    | merged | 6e026ab18 (f0f00891c, f2edd4a62)              |

**Backlog:** claim a slice's item when it starts; run `pnpm backlog done` on it when the slice merges.

| Item                                    | Slice |
| --------------------------------------- | ----- |
| B-252 the dosing schedule beyond today  | 1     |
| B-253 `add_todo` makes a repeating todo | 2     |

## Architectural decisions

Durable decisions every slice follows:

- **No migration, no new dependency, no new route, no screen change, no consent or scope change.** Both slices are server-side tool work on `/mcp`.
- **One source for each rule.** The schedule ahead comes from the due-dose core's slot expansion, never a second copy; a repeat's rule text comes from the shared rule builder (`ruleText`) and is checked by `parseRule`; the todo is written through `assistantActionService.run` like every connector write.
- **`dose_schedule` is the plan; `todays_doses` is the state.** The new tool never reads dose entries and never reports given, due, overdue or missed.
- **RRULE text is never a tool input.** `add_todo` takes the structured `repeat` and builds the rule; a raw `repeatRule` stays ignored.
- **Tools follow the registry's pattern** (`defineTool`, Zod input, failures as `isError` results with issues, times through `zonedIso`, the group from the grant). A new read tool joins the never-returned sweep and the frozen tool lists.
- **Nothing here edits `todays_doses`' handler or the due-dose core** (`dose-accuracy`'s files): slice 1 adds a file beside the core, appends to the schema's index and frozen export list and, in `todays_doses`, one sentence of description.

## How to run this plan

- **One wave, both slices at once.** They share no file: slice 1 owns the new pure module, the new tool's file, the tools list, the two descriptions and the read-tool tests; slice 2 owns `add_todo` in the writes module and the write tests.
- **Start condition:** `planner-3` in `dev` (the registry's `After`). Slice 1 doesn't need it; if the user wants the schedule sooner, slice 1 can start alone on their word.
- **Beside other PRDs:** `dose-accuracy` edits `todays_doses`' handler and the due-dose core; if it lands while this runs, sync at the wave boundary (both append to the medications schema index and the frozen export list: keep both). After its day rule, today's plan here can list a slot `todays_doses` hides for a medication added today; that is meant (the PRD's _Notes_). `code-health` moves the pure schema files; whichever lands second follows the move.
- **Checks:** stackless slices hand off on `pnpm prd check --quick`. The landing runs the full check once and `pnpm prd browser --changed --base dev` (no screens or flows change, so no suite).
- **Docs at landing:** fold into [connectors](../docs/domain/connectors.md) (_Tools_: `dose_schedule`; `add_todo`'s `repeat`; drop "takes no repeat (B-253)"; the doc is near its budget, so trim what you add) and [medications](../docs/domain/medications.md) (_What's due_: `doseSchedule`).
- **When it's done:** `pnpm prd rm connectors-3` sets the row done. `connectors-4` (B-196, the directory listings) stays held until the launch.

---

## Slice 1: The dose schedule ahead (`dose_schedule`)

Stack: no · Reads: docs/domain/connectors.md, docs/domain/medications.md, docs/domain/data-layer.md · Tests: unit, integration

**Backlog:** B-252. **User stories:** 1 to 9.

**What to build**

A member's assistant can ask for the medication plan from today on and get each day's rounds, end to end: a pure schedule module, the tool, its place in the list, and the pointers between the dose tools.

- **`doseSchedule`** (pure, in the data package's medications schema, exported with its neighbours and added to the schema's frozen export list): `doseSchedule({ medications, passes, from, days, timeZone })` → `{ days: [{ day, rounds: [{ passId, name, time, at, medications: [{ medication, amount }] }] }], asNeeded: [{ medication, max }] }`. Built on `doseSlotsBetween` with `doses: []`, from the first day's start to the last day's end (exclusive: a 00:00 slot of the next day stays out), given current, live medications only (the range reader would otherwise keep stopped ones), with each slot's `state` dropped; no edit to `dueDoses.ts`. Each day's slots are grouped as `duePasses` groups them: a pass's medications in one round, a medication's own time as its own round, ordered by time, a pass's name from the passes, so a day has the same rounds `todays_doses` shows. Each medication appears from the day it starts or was added.
- **The tool `dose_schedule`** (read scope, read-only annotations), after `todays_doses` in the tools list:
  - Input: `from` (`YYYY-MM-DD`, default today in the recipient's zone), `days` (integer 1 to 14, default 7).
  - `from` before today: an invalid result (path `from`): "The schedule is for today onward. Use list_timeline for doses already logged."
  - Loads medications and passes as the member, as `todays_doses` does (through `normalizeSchedule`), and no entries.
  - Structured: `timeZone`, `from`, `days` (`day`, `weekday`, `rounds`: `name`, `time`, `at` in the recipient's offset, `medications`: `medicationId`, `medication`, `amount`), `asNeeded` (`medicationId`, `medication`, `maxPerDay`).
  - Text: a line per round with its medications; consecutive days with the same rounds written once as a range; "No scheduled doses" for an empty day or range; a last line for as-needed medications.
  - Description: the plan for today onward (rounds, times, medications, amounts), not what was given; for today's given, due and missed doses use `todays_doses`.
- **Pointers:** `upcoming`'s description ends "Doses are not here: use todays_doses for today and dose_schedule for the days ahead."; `todays_doses`' description gains "For the days ahead, use dose_schedule." Nothing else in `todays_doses` changes.

**Acceptance criteria**

- [ ] Unit (`doseSchedule.test.ts`, on the due-dose tests' fixtures): three days give three days of rounds; a pass round and a time of its own, ordered by time, grouped as `duePasses` groups the same day; a 00:00 slot belongs to its own day only; a medication with a pass slot and its own slot at the same time appears once; a medication starting on day 2 is absent on day 1; as-needed medications are only in `asNeeded`, with their maximum; a completed, discontinued or deleted medication is absent; a DST change day keeps wall-clock times; no medications gives days with no rounds.
- [ ] Integration (`readTools.int.test.ts`): `dose_schedule` with no input gives 7 days from today for the seeded group, each with the seeded rounds, in the recipient's offset; `from` tomorrow and `days: 1` gives one day; `days: 15` and a `from` before today are `isError` results, the second naming `list_timeline`; a viewer's read grant can call it; the never-returned sweep covers it.
- [ ] Integration and unit (the tool lists in `mcp.int.test.ts` and `protocol.test.ts`): `dose_schedule` is listed for read and write grants, after `todays_doses`.
- [ ] The schema's frozen export list names the new exports.
- [ ] `todays_doses`' structured result and text are unchanged (its existing tests pass untouched).
- [ ] `pnpm prd check --quick` passes.

**Blocked by:** nothing. **Blocks:** nothing.

---

## Slice 2: `add_todo` makes a repeating todo

Stack: no · Reads: docs/domain/connectors.md, docs/domain/todos.md, docs/domain/assistant.md · Tests: unit, integration

**Backlog:** B-253. **User stories:** 10 to 16.

**What to build**

A member's assistant can add a todo that repeats daily, weekly on chosen days or monthly, and the todo behaves like one made in the app's form.

- **Input:** `add_todo` gains optional `repeat`: `{ every: "day" | "week" | "month", interval?: 1..SERIES_LIMITS.interval (default 1), weekdays?: ("MO" … "SU")[] }`, each field described for the assistant. The raw `repeatRule` stays out of the input, as `assigneeId` does.
- **`todoRepeatInput`** (pure, in the writes module): `(repeat, dueOn, today)` → `{ repeatRule, dueOn }` or an issue.
  - `day`: every `interval` days. `week`: on `weekdays`, or the due day's weekday (today's without a due day). `month`: on the due day's day of the month (today's without one); a 29th to 31st gives the rule planner-3's `readRepeat` gives for "every month on the 31st". No end.
  - No `dueOn`: today, or for a week with `weekdays` the next listed day, today included. `today` is the recipient's day at `ctx.now`.
  - `dueOn` not on one of `weekdays`: an issue at path `repeat`, "The due day isn't one of the repeat's days. The next one is <YYYY-MM-DD>."
  - `weekdays` with `day` or `month`: an issue at path `repeat`.
  - The rule is built with `ruleText`; reuse planner-3's first-day arithmetic if it is exported, else the same small date arithmetic (no `rrule` import in the tool).
- **The handler** loads the group (`loadGroup`) for the recipient's zone and today, and passes `repeatRule` and the worked-out `dueOn` in the `addTodo` action to `assistantActionService.run`, with `via` as now. A `dueTime` with a worked-out day is kept.
- **The answer:** "Added todo: …" with the repeat in `todoRepeatText`'s words ("Every Mon"; if the action preview from planner-3 already says it, don't say it twice); the structured result gains `repeats` (that text) and `dueOn`.
- **Description:** adds how to repeat ("to repeat it, pass repeat: every day, week (optionally on weekdays) or month, optionally every N; without a due day it starts on the first matching day; a member stops a repeat in the app").

**Acceptance criteria**

- [ ] Unit (`writes.test.ts`, a table over `todoRepeatInput`): every day; every 2 days; every week from a due day (that weekday); weekdays MO, WE, FR with no due day on a Tuesday starts Wednesday, on a Monday starts today; a due day on a listed weekday is kept; a due day off the list is the issue naming the next listed day; every month from the 15th, and from the 31st (planner-3's short-month behaviour); `interval` beyond the limit and `weekdays` with `day` are refused; each rule passes `parseRule`.
- [ ] Integration (`mcpWrites.int.test.ts`): `add_todo` with `repeat: { every: "week", weekdays: ["MO"] }` and no due day makes a todo due the next Monday with `repeat_rule`, `repeat_starts_on` and `repeat_id` set and `via` the client's name; its answer says the repeat and `list_todos` returns it with `repeats`; completing it through `todoService.complete` makes the next occurrence; the mismatch refusal is an `isError` result with the issue and makes nothing; a raw `repeatRule` without `repeat` still makes a todo that doesn't repeat; a read grant can't call `add_todo`.
- [ ] `add_todo` without `repeat` behaves as before (its existing tests pass untouched).
- [ ] `pnpm prd check --quick` passes.

**Blocked by:** nothing in this plan; `planner-3`'s slices 5 and 6 in `dev` (the action's `repeatRule`, and the preview's wording). **Blocks:** nothing.
