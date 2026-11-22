# PRD: Connectors 3 (the dose schedule ahead, and repeating todos)

Backlog items B-252 (a read tool for the dosing schedule beyond today) and B-253 (`add_todo` can make a repeating todo). B-196 (directory listings) moves to `connectors-4`, on hold until after the launch. Topic `connectors-3`. It follows [`connectors-2-prd.md`](connectors-2-prd.md) (done); the rules it builds on are in [connectors](../docs/domain/connectors.md), [medications](../docs/domain/medications.md) and [todos](../docs/domain/todos.md).

## Decisions

The costliest to change first. Nothing was asked: no decision here adds a role, a permission, a data category, a migration or a dependency.

| Decision                                                                                                                                                                                                                                  | Why                                                                                                                                                                                               | Source                                                    | Cost to change later                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| B-196 (directory listings) leaves this topic for `connectors-4`, held until the production launch (B-33) and the privacy policy (B-54)                                                                                                    | the user chose "after the launch and the privacy policy" twice (the item's notes, 2026-11-20); a listing is a vendor review, not code we can finish now                                           | assumed (the item's notes: the user's choice, 2026-11-20) | low: move the item back                                                |
| The schedule ahead is a new tool, `dose_schedule`, not a day parameter on `todays_doses`                                                                                                                                                  | `todays_doses` is about now (states, yesterday's missed, as-needed counts); a future day has none of that, and one tool with two shapes is harder for an assistant to use; the item allows either | assumed                                                   | medium: assistants learn tool names, and a rename breaks saved prompts |
| `dose_schedule` reads today onward only, 7 days by default and 14 at most; a day before today is refused, pointing to `list_timeline`                                                                                                     | the item says "tomorrow's or this week's"; the schedule is the same every day, so two weeks covers every question; past doses are already in the timeline                                         | assumed                                                   | low: two limits                                                        |
| It gives the plan only: each day's rounds with their time, medications and amounts, plus the as-needed medications and their daily maximum. No given, due or missed state, even for today                                                 | one source for state (`todays_doses`); the description sends an assistant there for today                                                                                                         | assumed                                                   | low                                                                    |
| The schedule is read as it is now: current medications only, from the day each starts                                                                                                                                                     | nothing stores a future schedule change or a planned stop                                                                                                                                         | assumed                                                   | low                                                                    |
| No new consent text or version: the tool sends medications data the consent already names                                                                                                                                                 | `CONNECTOR_CONSENT_TEXT` lists medications; `list_medications` and `todays_doses` already send the schedule                                                                                       | assumed                                                   | low: a version bump                                                    |
| `add_todo` takes a structured `repeat` (`every` day, week or month; `interval`; `weekdays` for a week), never RRULE text                                                                                                                  | an assistant fills three plain fields reliably; RRULE text invites invalid rules; the item names exactly these three                                                                              | assumed                                                   | medium: the input's shape is what assistants learn                     |
| A repeat never ends through the connector (no end date or count); a member stops it in the app                                                                                                                                            | the item doesn't ask for ends; the smallest version                                                                                                                                               | assumed                                                   | low: an added optional field                                           |
| With `repeat` and no due day, the first day is worked out (today, or the next listed weekday, today included, in the recipient's zone); a weekly repeat with a due day that isn't one of its days is refused, naming the next day that is | a repeat needs a due day, and assistants get weekday arithmetic wrong; a refusal that names the right day is corrected in one step                                                                | assumed                                                   | low                                                                    |
| A monthly repeat is on the due day's day of the month; no "second Tuesday"                                                                                                                                                                | the item says "monthly"; the todo form offers the rest                                                                                                                                            | assumed                                                   | low                                                                    |
| The topic waits for `planner-3` (the `addTodo.repeatRule` action field, B-254)                                                                                                                                                            | slice 2 opens that field in the tool; both edit `add_todo`                                                                                                                                        | assumed                                                   | none                                                                   |

The skeptic pass: see _Notes_.

## Problem

A caretaker who has connected their own Claude or ChatGPT to a care group can ask it what doses are due today, but not what tomorrow or the coming week looks like: "what does Mum take on Saturday morning?", "write me the week's medication rounds for the sitter". `upcoming` deliberately leaves doses out, and `todays_doses` stops at midnight.

The same caretaker can ask the assistant to add a todo, but not one that repeats: "remind us to put the bins out every Monday" makes a single todo, and they have to open the app to set the repeat.

Separately, Caretook isn't in Claude's or ChatGPT's directories, so connecting means pasting a URL. That stays so until after the launch.

## Solution

- A new read tool, **`dose_schedule`**, gives the medication plan for today onward: for each day (a week by default, two at most) the rounds in the recipient's time, each with its medications and amounts, and the as-needed medications with their daily maximum. It says nothing about what was given; `todays_doses` keeps that.
- **`add_todo` takes a `repeat`**: every day, every week on chosen days, or every month, optionally every N. The todo it makes repeats exactly as one made in the app's todo form: ticking it makes the next.
- The directory listings (B-196) move to their own held topic, with what a listing needs written down.

## User stories

1. As a caretaker using my own assistant, I want to ask what doses are scheduled tomorrow, so that I can plan the day or brief whoever is covering.
2. As a caretaker, I want the week's rounds and times in one answer, so that the assistant can write a schedule for a sitter or a respite stay.
3. As a caretaker, I want each round to name its medications and amounts, so that the answer is usable without opening the app.
4. As a caretaker, I want as-needed medications listed with their daily maximum, so that the assistant doesn't present them as scheduled.
5. As a caretaker, I want a medication that starts on Thursday to appear from Thursday, so that the plan is right for each day.
6. As a caretaker, I want the times in the care recipient's time zone, so that the plan matches the app's Schedule tab.
7. As a caretaker, I want the assistant to use today's tool for what has been given or is due and this one for the plan, so that each question has one tool.
8. As a viewer, I want to read the schedule ahead too, so that a read-only connection is as useful as the app's read-only view.
9. As a group owner, I want the new tool to send nothing the existing tools don't (no prescription numbers, quantities or contact details), so that connecting stays as private as I agreed to.
10. As a caretaker, I want to tell my assistant "put the bins out every Monday" and get a repeating todo, so that I don't open the app to set the repeat.
11. As a caretaker, I want daily, weekly on chosen days, and monthly repeats, each optionally every N, so that the common routines are covered.
12. As a caretaker, I want the assistant to work out the first day when I give none, so that "every Monday" starts next Monday without date mistakes.
13. As a caretaker, I want a clear refusal when the due day and the repeat's days disagree, so that the assistant corrects itself instead of making a wrong todo.
14. As a caretaker, I want the assistant's answer to say how the todo repeats, so that I can confirm it understood.
15. As a caretaker, I want a repeating todo made by the assistant to behave like any other (the tick makes the next, Skip and Delete work, "via" shows), so that there is one kind of repeating todo.
16. As a member with a read-only connection, I want `add_todo` to stay unavailable, so that the repeat adds no new way to write.
17. As the product owner, I want the directory listings parked with what they need (a logo, short and long descriptions, a test account, the privacy URL) on a topic that waits for the launch, so that it isn't lost and doesn't block this work.

## Implementation decisions

### The schedule ahead

- **A pure module, `doseSchedule`**, beside the due-dose core in the data package's schema (client-safe, though only the server uses it now): given the medications, the passes, a first day, a count of days and the time zone, it returns each day's rounds. A round is a pass, or a time of its own, with its time, the instant it falls at, and its medications by name with their amounts. It is built on the existing range reader (`doseSlotsBetween` with no doses, current medications only, up to the last day's end, the slots' states dropped), never a second copy of the slot rules and no edit to the due-dose core: one slot per medication per time, a pass ahead of a time of its own, DST-safe days, a medication only from the day it starts or was added. Each day's slots are grouped as `duePasses` groups today's: a pass's medications together, a medication's own time as a round of its own, so a day here has the same rounds as `todays_doses`. It also returns the as-needed medications with their maximum.
- **The tool `dose_schedule`** (read scope, `readOnlyHint`): input `from` (a day, default today in the recipient's zone) and `days` (1 to 14, default 7). A `from` before today is an `isError` result whose message points to `list_timeline` for doses already logged. It loads what `todays_doses` loads, minus the dose entries: current, live medications with a schedule (through `normalizeSchedule`) and the passes, as the member.
  - **Structured result:** the time zone, the first day, `days` (each with its day, weekday and rounds: name, time, instant in the recipient's offset, medications with id, title and amount) and `asNeeded` (id, title, maximum a day).
  - **Text:** a line per round; consecutive days with the same rounds are written once ("Mon Nov 23 to Sun Nov 29, each day:"). A day or range with nothing scheduled says so.
  - Its description says it is the plan, not what was given, and names `todays_doses` for today's state. `upcoming`'s description names both dose tools; `todays_doses`'s description gains one sentence pointing here (its handler isn't touched: `dose-accuracy` edits it).
- It joins the tools list after `todays_doses`. The server instructions and the prompts don't change.
- **Nothing new is returned:** medication ids, titles (name and strength), amounts, pass names and times, all of which `todays_doses` and `list_medications` send. The read tools' never-returned sweep covers the new tool.

### A repeating todo

- **`add_todo`'s input gains `repeat`** (optional): `every` (`day`, `week` or `month`), `interval` (1 to the series limit, default 1) and `weekdays` (two-letter days, only with `week`). The tool turns it into the rule text with the shared rule builder and passes it as the action's `repeatRule` (planner-3's field), so the todo service, the repeat columns and the next-occurrence rules are untouched. RRULE text is never an input: a raw `repeatRule` sent to the tool is still ignored.
- **A small pure helper** (in the tool's module) maps `repeat`, the due day and today to the rule and the first day:
  - `week` without `weekdays` repeats on the due day's weekday (today's, with no due day).
  - `month` repeats on the due day's day of the month; a 29th to 31st behaves as planner-3's quick entry and the todo form do in a short month.
  - No due day: the first day is today, or for a week with `weekdays` the next listed day, today included (the recipient's zone).
  - A due day given with `weekdays` that doesn't fall on one of them is refused (the tool's usual invalid result, path `repeat`), and the message names the next day that does.
  - `weekdays` with `day` or `month` is refused.
- **The answer** is "Added todo: …" as now, with the repeat in `todoRepeatText`'s words ("Every Mon"), and the structured result gains `repeats` (the same text `list_todos` gives) and the `dueOn` used.
- The description says how to make a repeating todo and that a member stops it in the app. `via` is set as for any todo the tool adds.

### The directory listings

- B-196 moves to a new registry row, `connectors-4`, flagged `hold`, after `hosting` and `marketing`. Its note carries what a listing needs (from the connectors-2 PRD): a logo, short and long descriptions, a test account, the privacy URL, and the staging check with Claude and ChatGPT done first.

## Testing decisions

- **Unit** (`doseSchedule`, beside the due-dose tests and on their fixtures): several days; a pass and a time of its own; one slot when a medication has a pass and a time at the same time; a medication starting mid-range; as-needed medications apart; a DST day; no medications.
- **Integration** (`readTools.int.test.ts`, the prior art for every read tool): `dose_schedule`'s default week on the seeded group, `from` and `days`, the refusal before today, a viewer reads it, and the never-returned sweep includes it. The tool-list tests (`mcp.int.test.ts`, `protocol.test.ts`) gain the name.
- **Unit** (`writes.test.ts`): the repeat helper's table: each `every`, `interval`, weekdays, the worked-out first day, the mismatch refusal and its named day, `weekdays` with `day`.
- **Integration** (`mcpWrites.int.test.ts`): `add_todo` with a repeat makes a todo with the three repeat columns set; `list_todos` shows it repeating; completing it through the service makes the next; the refusals; a raw `repeatRule` is still ignored; a read grant still can't call it.
- No component tests and no end-to-end steps: no screen changes, and the tick's sync flow is already in `roundtrip`.

## Out of scope

- B-196, the directory listings (`connectors-4`, held).
- A past day's schedule, or what was missed last week (the timeline has the doses; visit prep has the missed counts).
- State (given, due, overdue) on future days, or changing `todays_doses`' output.
- Ends for a repeat (a date or a count), nth-weekday monthly repeats, repeating events through the connector.
- Editing, skipping or stopping a repeating todo through the connector (no tool edits todos today).
- Any change to consent, scopes, grants or the app's screens.

## Notes

- **Beside other PRDs:**
  - `planner-3` (planned): its slice 5 adds `addTodo.repeatRule` and has `add_todo` leave it out. This topic is `after=planner-3`.
  - `dose-accuracy` (planned): its slice 5 edits `todays_doses`' handler and the due-dose core. This topic adds a new file beside the core and edits only one sentence of `todays_doses`' description, so the two can run together; if both are in flight, the later one syncs. Once its day rule lands, `todays_doses` hides a slot whose time passed before a medication was added today, while `dose_schedule` still lists it in today's plan: the plan is the schedule as written, and the description sends an assistant to `todays_doses` for today.
  - `code-health` (planned) moves the pure schema files later; the new module moves with its neighbours.
- **Docs to fold at landing** ([connectors](../docs/domain/connectors.md), which is near its budget: trim what you add): _Tools_ gets `dose_schedule` and `add_todo`'s `repeat`, dropping "`add_todo` takes no repeat (B-253)"; [medications](../docs/domain/medications.md) names `doseSchedule` under _What's due_.
- **The skeptic pass** (2026-11-21) found nothing to ask and no uncovered need. Changed: the schedule module uses only `doseSlotsBetween` (the option of a new export from the due-dose core is gone, with the range's end, the current-only filter and the dropped states pinned); rounds are grouped as `duePasses` does, per day; the difference from `todays_doses` once `dose-accuracy`'s day rule lands is stated, and story 7 no longer promises the two agree about today; the answer's wording is `todoRepeatText`'s ("Every Mon"); a month's 29th to 31st is pinned to planner-3's behaviour and tested; slice 2 loads the group for the recipient's today and waits for planner-3's slices 5 and 6; the registry row's hot files name the new schema module. Declined: making the topic wait for `dose-accuracy` and passing the change entries in, since the plan for a day is the schedule as written and only today could differ.
