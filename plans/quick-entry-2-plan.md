# Plan: Quick entry reads what was typed

> Source PRD: [`plans/quick-entry-2-prd.md`](quick-entry-2-prd.md). User-story numbers (US) refer to it. Backlog items B-300, B-301, B-302, B-303. Topic `quick-entry-2`.

## Status

**Where it stands:** orchestrator started 2026-11-22. Wave 1 (slices 1, 3, 5) is starting; all slices run on opus.

**Landing mode:** run everything through (start every ready slice, land each green wave, clean up; questions and reports go through `pnpm prd ask`). The PRD lands once, after wave 2.

| Slice | Wave | State                                                   | Merge into `prd/quick-entry-2` (slice commits)       |
| ----- | ---- | ------------------------------------------------------- | ---------------------------------------------------- |
| 1     | 1    | merged (opus)                                           | 85128423 (fc942dc7)                                  |
| 2     | 2    | started, opus (worktree `quick-entry-2-2`)              |                                                      |
| 3     | 1    | merged (opus)                                           | 235487f7 (694ed6e7)                                  |
| 4     | 2    | handed off, fix reviewed, awaiting merge after 2 (opus) | slice commits 087641c7, dce726f6; slice check passed |
| 5     | 1    | merged (opus)                                           | 26d0b935 (42d56eb5)                                  |

**Wave 1:** merged, not yet gated; B-300 and B-303 are done, B-302 finishes with slice 4. No check has run on the merged tip.

**For the gate:** the other quick entry component tests render the box and haven't run on slice 5 (`timelineQuickEntrySuggestions`, `Passes`, `Todos`, the easy-mode files); the full check covers them. Lint runs out of memory at the default heap (B-576): run checks with `NODE_OPTIONS=--max-old-space-size=6144`, CI's value.

**For the docs at landing:** the negation rules (plus the extra n't words and curly apostrophes slice 1 added), the time-word rules, the card pruning and Clear.

**To file at the wave boundary (known limits from the hand-offs):** "no pain gave tylenol" (no comma) reads skipped; a line ending in "sat" ("she sat") reads as Saturday; "dr lee the 2nd at the clinic" gets no date; "bp 12/8" reads as Dec 8 and "pain 5/5" as May 5; a less common fraction with no unit ("gave 1/6 tylenol", "gave 3/8 tylenol") still reads as a date; `AMOUNT_UNIT_WORDS` in the time module must be kept in step with the parser's `AMOUNT_UNITS` by hand; "call the pharmacy in the morning" at 7:00 stays a note; "at 12 this morning" is midnight.

**For the docs at landing (slice 4):** month/day dates, bare hours forward never before 7:00, zero-padded hours are am, Feb 29 takes the nearest leap year, a period underway is now.

**Backlog:** claim a slice's item when it starts; run `pnpm backlog done` on an item when its last slice merges.

| Item                       | Slices |
| -------------------------- | ------ |
| B-300 negated doses        | 1      |
| B-301 typed counts         | 2      |
| B-302 silently wrong times | 3, 4   |
| B-303 the box gets stuck   | 5      |

## Architectural decisions

Durable decisions every slice follows:

- **The parser's interface doesn't change:** `parseQuickEntry(text, context)` and its result, `findTime`, `resolveTime`. No action shape, runner, service, connector tool, schema or migration changes. A slice that finds it must change one stops and tells the orchestrator.
- **The PRD's _Decisions_ table is the spec** for each rule; a slice that finds a rule breaks an existing test row says so in its hand-off instead of bending either.
- **Every rule gets a test row, and so does each neighbour it must not break** (the PRD's _Testing decisions_ lists them). An existing row changes only when the PRD says the behaviour changes ("25th dr alvarez").
- **A kind-picking word is a vocabulary row** (`QUICK_ENTRY_VOCABULARY`) when it picks a kind; negating words, counts and time words are parser rules, each a named set beside the code that uses it.
- **English only, no new dependency.**
- **Loops don't edit docs.** The orchestrator folds the rules into [assistant](../docs/domain/assistant.md) at landing.

## How to run this plan

- **Waves:** (1, 3, 5) → (2, 4). All five are small; the PRD lands once, after wave 2.
- **Gates:** each slice hands off on `pnpm prd check --quick "slice hand-off"`; the wave gates are quick checks. No browser check is edited or added.
- **Ownership:**
  - Slices 1 and 2: the dose and pass readings and the amount finder in the parser, and their rows in `quickEntry.test.ts`. Slice 2 follows slice 1 because both change the dose reading.
  - Slices 3 and 4: `quickEntryTime.ts` and a new `quickEntryTime.test.ts`. Slice 3 touches the parser file only if a case can't pass without it, and says so in the hand-off; slice 4 may change the parser's time state and `noteAhead`, never the dose or pass readings, so it merges beside slice 2. Slice 4 follows slice 3 because both change `findTime`.
  - Slice 5: the quick entry components (`components/quick-entry/`) and the timeline's quick entry component test.
- **Beside other topics:** `code-health` moves the parser files whole to the domain folder: if it lands first, `pnpm prd sync` and carry on in the new place; if this lands first, nothing to do. `dose-accuracy` edits the runner (`lib/assistant/quickEntry.sync.ts`), which no slice here touches. `simple-mode` owns `lib/assistant/simpleMode*`. `fixes-bug` (running) lists the timeline route folder as hot: slice 5 edits only `timelineQuickEntry.browser.test.tsx` there, so the orchestrator checks the open fixes for that file before wave 1.

---

## Slice 1: A dose that wasn't given is never logged as given

Stack: no · Reads: docs/domain/assistant.md, docs/domain/medications.md · Tests: unit

**User stories:** 1–4.

### What to build

One negation helper in the parser (the PRD's word list), used by the dose reading and the pass reading. In the dose reading, position decides: a negating word within three words before a give or take verb, "not given" / "wasn't given" after the name, or a negating word opening a part that carries the status over from the part before, makes the status `skipped`; a negating word after the verb is note text and changes nothing; did not / would not before take, have or swallow stays `refused`; a negating word before a skip or refuse verb gives no dose reading. The negating words that decided are claimed with the verb, so they don't land in the dose's note. Confidence: below a plain verb's, above the note's. The pass reading returns nothing when the part has a negating word anywhere.

### Acceptance criteria

- [ ] Unit rows (`quickEntry.test.ts`): "did not give metoprolol", "didn't give metoprolol", "metoprolol not given", "metoprolol wasn't given", "couldn't give metoprolol", "never gave metoprolol", "forgot to give metoprolol", "no metoprolol given" each read a `logDose` with status skipped first and a note second.
- [ ] "gave tylenol and not metoprolol": given, then skipped.
- [ ] A negating word after the verb changes nothing: "gave metformin without food", "gave metformin with no problems", "gave tylenol not long ago" are given, with the words in the note (or the time).
- [ ] "wouldn't take metoprolol", "did not swallow metoprolol" stay refused; "gave metoprolol", "skipped metoprolol", "refused metoprolol" are unchanged.
- [ ] "didn't skip metoprolol", "didn't refuse metoprolol": the top reading is a note, with no dose reading.
- [ ] With passes in the context: "couldn't give evening meds", "didn't give meds", "never gave evening meds", "evening meds not given" have no `givePass` reading; "gave evening meds" still does.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** nothing. **Blocks:** 2.

---

## Slice 2: A typed count is the amount

Stack: no · Reads: docs/domain/assistant.md, docs/domain/medications.md · Tests: unit

**User stories:** 5–7.

### What to build

The amount finder takes a count with no unit directly before the medication's matched words (with "of" or "a" between) or directly after them ("tylenol 2", "tylenol x2"), after the medication is matched. The recorded amount is the count with the usual dose's unit word when the usual dose is a count and a unit, singular for one or less and plural above ("2 tablets" → "3 tablets", "1 tablet", "half a tablet"), else the count as typed. After the name, a number equal to the medication's strength number isn't a count; anywhere, a number above 20 isn't. A medication match of any strength (its name, or a brand word in its directions) with a count is a dose line without a verb, at the name-only confidence. The symptom reading is dropped when its name is made of words the part matched to a medication.

### Acceptance criteria

- [ ] Unit rows (`quickEntry.test.ts`), with the fixture whose usual dose is "2 tablets": "gave 3 tylenol" → amount "3 tablets", note null; "gave 1 tylenol" → "1 tablet"; "gave half a tylenol" → "half a tablet"; "gave 1/2 tylenol" → "1/2 tablet"; "tylenol x2" and "tylenol 2" → "2 tablets". The rows cover a medication named Tylenol and the fixture that carries "Tylenol" only in its directions.
- [ ] With a usual dose of "500 mg" or none: "gave 3 tylenol" → amount "3".
- [ ] "tylenol 2 at 8": the top reading is a dose, amount "2 tablets", at the nearest 8:00 back; no reading is a symptom named Tylenol, for both fixtures.
- [ ] "tylenol 500" and "gave tylenol 25" keep the usual dose; "lisinopril 10" (strength 10 mg) keeps it; "gave 2 warfarin" (strength 2 mg, usual "1 tablet") → "2 tablets".
- [ ] "gave 2 tablets tylenol", "gave half a tablet metoprolol" and "gave tylenol" are unchanged; "pain 4" and "nausea 3/10" are still symptoms.
- [ ] After slice 1: "didn't give 2 tylenol" is skipped with amount "2 tablets".
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** 1. **Blocks:** nothing.

---

## Slice 3: Words that aren't times leave the time alone

Stack: no · Reads: docs/domain/assistant.md · Tests: unit

**User stories:** 8, 11.

### What to build

In `findTime`: "sat" and "sun" are days only when a clock time, am/pm or a period follows (an "at" counts only with a clock after it), they end the line and "the" doesn't lead, or "on", "last", "next" or "this" leads; the existing oxygen rule stays. An ordinal is a day of the month only after "on", beside a month, at the end of the line, or before a time word; the count-word list stays as a second guard. A separate "a" or "p" is not am or pm; joined ("8a"), "am"/"pm" and the dotted forms still are.

### Acceptance criteria

- [ ] Unit rows in a new `quickEntryTime.test.ts`: `findTime` finds nothing in "sat up in chair", "sat at the table", "sat in the sun", "sun was out", "2nd tylenol", "the 2nd tylenol", "pain 8 a bit better".
- [ ] It still finds the day in "sat 2pm", "sat at 2", "on sat", "last sat", "dr lee sat", "on the 2nd", "dr lee the 2nd", "25th at 2pm", "nov 2nd", and the clock in "8a", "8 am", "8 a.m.", "at 8 pm".
- [ ] Through `parseQuickEntry`: "sat up in chair" is a note dated now; "pain 8 a bit better" is a symptom, severity 8, dated now; "o2 sat 95" is unchanged.
- [ ] The existing time rows in `quickEntry.test.ts` pass; a row is changed only where the PRD says the behaviour changes, and the hand-off names it.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** nothing. **Blocks:** 4.

---

## Slice 4: Dates and hours read right

Stack: no · Reads: docs/domain/assistant.md · Tests: unit

**User stories:** 9, 10, 12.

### What to build

In `findTime`: a month/day word ("11/25", "11/25/26", "11/25/2026"), month first, with a real month and day, is a day; a number out of ten ("3/10") and 1/2, 1/3, 2/3, 1/4, 3/4 are left alone unless "on" leads; three-digit halves ("120/80") never match. Resolving: reading forward with no day and no am/pm, a candidate before 7:00 is skipped; a clock beside a morning period is am. A period with no clock, today or with no day said, that has begun (morning 4:00, afternoon 12:00, evening 17:00, night 20:00) while its usual hour is still ahead: the past-only readings (vitals, symptoms, doses, a forced note, a past visit) take now and aren't blocked. `noteAhead` keeps seeing the usual hour, so a plain note line is read as today (todo first, its note card dated now). This slice may touch the parser's time state and `noteAhead` for that, never the dose or pass readings (slice 2's).

### Acceptance criteria

- [ ] Unit rows (`quickEntryTime.test.ts`), with fixed `now` values in the recipient's zone: "11/25 at 2pm" resolves to Nov 25, 14:00; "11/25" alone is all day ahead and that day back; "on 1/4" is Jan 4; "on 11/10" is Nov 10; "gave 1/2 tylenol", "nausea 3/10", "6/10 pain in left knee" and "bp 120/80" find no date.
- [ ] "dr alvarez at 2" read forward at 20:00 is 14:00 tomorrow, and at 9:00 is 14:00 today; "at 8" read forward at 15:00 is 20:00 today; "at 2am" stays 2 AM; "gave tylenol at 2" read back at 9:00 is still 2:00 today.
- [ ] Through `parseQuickEntry` at 7:00: "bp 120/80 this morning", "bp 120/80 in the morning" and "n: had dialysis this morning" are dated 7:00 with no blocking warning; "woke at 5 this morning" is 5:00 today. At 10:00, "bp 120/80 this morning" is 8:00, as now.
- [ ] The todo rows keep their order: "call the pharmacy this afternoon" at 12:30 and "call the pharmacy tonight" at 21:00 read a todo first; "walk this evening" at 10:00 too; "last night" is unchanged; the existing rows in `quickEntry.test.ts` ("3/10" and "11/20" are notes, the n/10 severities) pass unchanged.
- [ ] "dr alvarez 11/25 at 2pm" is an event on Nov 25 at 14:00.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** 3. **Blocks:** nothing.

---

## Slice 5: The box never gets stuck

Stack: no · Reads: docs/domain/assistant.md, docs/domain/components.md · Tests: unit, component

**User stories:** 13, 14.

### What to build

A pure function beside the card rules that keeps card state (the chosen reading, the removed set, the per-card errors) only for the keys of the current parts; the box's state applies it whenever the parts change, so emptying the text or changing a part forgets its removal. Clear is offered whenever the box has text, also when every card was removed. Save, Edit, Undo and the draft are unchanged.

### Acceptance criteria

- [ ] Unit (`quickEntryCards.test.ts`): the pruning keeps state for keys still present, drops the rest, and returns the same maps when nothing changed (no render loop).
- [ ] Component (`timelineQuickEntry.browser.test.tsx`): type a line, remove its card, clear the text, type the same line: the card and Save are back and Enter saves.
- [ ] Component: with two parts, removing the second and then editing the first keeps the second removed.
- [ ] Component: with the only card removed and the text still there, Clear is shown and empties the box.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocked by:** nothing. **Blocks:** nothing.
