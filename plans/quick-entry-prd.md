# PRD: Quick entry picks the right kind

Backlog: B-220 (quick entry should be more powerful and flexible: "fell", provider lines and dates make the wrong kind). Topic `quick-entry`. Area: [assistant](../docs/domain/assistant.md).

## Problem Statement

Quick entry often guesses the wrong kind. Lines a caretaker types every week come out as plain notes:

- A provider and a day ("Dr. Elena Alvarez on the 25th", "see Dr. Alvarez friday", "Riverside Dialysis monday") is saved as a note. The provider isn't linked, "the 25th" isn't read at all, and a bare weekday is read as the _last_ one, so the note lands in the past.
- A provider's name on its own (what picking one from Matching names leaves in the box) is a note.
- When a line does become an event ("Alvarez tomorrow 3pm"), its title is the raw line, time words included.
- Incidents are the wrong kind: "fell" is an event, but a fall, a seizure or passing out is a symptom the caretaker tracks. "911 call" or "went to the ER" should be a note, linked to the provider when one is named.
- "called dr lee about refill" is a note that doesn't mention Dr. Lee.

No word list will ever cover every line, so a wrong guess has to be cheap to fix, and a miss has to be cheap to report and correct.

## Solution

- **Provider lines become events and open a prefilled draft.** There's no appointment kind: a future event is an appointment, as before. A line that names a provider makes an event linked to it, past or future, with or without a time. Save doesn't write that event. It opens the new-event page as a draft, already filled in: a title from the leftover words (else the provider's name), the day and time, all-day when no time was given, the provider, and the provider's address as the place. The caretaker adds notes and saves there, and Back throws the draft away.
- **Visit verbs make events, contact verbs make notes.** "saw", "visited", "went to" and "had" with a provider make an event (a draft, as above). "called", "talked to" and "emailed" make a note that @-mentions the provider.
- **Incidents.** "fell", "fall", "seizure", "passed out", "choked" and "wandered" make a symptom with no severity. "911 call", "ER" and "urgent care" make a note, which @-mentions the provider only when the line names one. There's no guessing by provider type.
- **Dates.** "the 25th", "on the 25th" and "Nov 25" are read. A bare weekday or day of the month reads forward for events and reminders, and backward for past-only kinds (symptoms, vitals, doses). A visit verb makes the event look back, and "last" or "next" always wins.
- **One reviewable vocabulary.** Every word or phrase that picks a kind lives in one table with a test row per phrase, so a miss is a one-line fix.
- **Kind chips.** Every card shows its kind as a chip, with the other plausible kinds (Symptom · Event · Note) one tap away before Save.
- **Mixed lines.** "bp 130/85, Dr. Lee friday 2pm" saves the BP (with Undo, as today), then opens the event's draft. Only the first provider event in a line opens as a draft; any later one is saved directly.
- **Connected assistants** can pass providers on a note too (`add_note` takes provider ids, as `add_event` does).

## User Stories

1. As a caretaker, I want "Dr. Elena Alvarez on the 25th" to start an event with Dr. Alvarez on the 25th, so that I don't have to retype it as an appointment.
2. As a caretaker, I want "the 25th" read as the coming 25th (next month's when this month's has passed), so that an appointment never lands in the past.
3. As a caretaker, I want "see Dr. Alvarez friday" to mean this coming Friday, so that the appointment is on the right day.
4. As a caretaker, I want "Nov 25" and "on the 25th at 2pm" to be read, so that I can type dates the way I say them.
5. As a caretaker, I want a provider line with no time to start an all-day event, so that I can add the time in the draft.
6. As a caretaker, I want picking a provider from Matching names and pressing Save to start an event with that provider, so that one tap gets me to the event form.
7. As a caretaker, I want the draft to open filled in (title, day, time, provider, place), so that I only add what's missing.
8. As a caretaker, I want the draft's title to be what I typed besides the name and time ("PT" from "PT at Riverside friday"), else the provider's name, so that titles read naturally.
9. As a caretaker, I want the draft's place to be the provider's address, so that the map action works.
10. As a caretaker, I want Back on the draft to save nothing, so that a wrong guess leaves no stray entry.
11. As a caretaker, I want to add notes to the event in the draft before saving, so that the questions for the visit are in one place.
12. As a caretaker, I want "saw Dr. Lee today" to start a past event with Dr. Lee, so that I can write down what happened at the visit.
13. As a caretaker, I want "had dialysis at Riverside this morning" to start a past event at Riverside, so that visits are tracked.
14. As a caretaker, I want "called dr lee about refill" to save a note that mentions Dr. Lee, so that the provider's page and the note link to each other.
15. As a caretaker, I want "fell in the bathroom" to save a symptom "Fall", so that falls show up with the other symptoms and in the day summary.
16. As a caretaker, I want "seizure", "passed out", "choked" and "wandered" to be symptoms too, so that these incidents are tracked the same way.
17. As a caretaker, I want those symptoms saved with no severity, so that I add one only if I want to (Edit opens the symptom sheet).
18. As a caretaker, I want "911 call" to save a note, so that the call is on record.
19. As a caretaker, I want "went to the ER at Riverside" to save a note mentioning Riverside, so that the visit links to the provider.
20. As a caretaker, I want "urgent care" with no provider named to save a plain note, so that the app never links a provider I didn't name.
21. As a caretaker, I want every card to show its kind as a chip, so that I can see at a glance what Save will make.
22. As a caretaker, I want the other plausible kinds one tap away on the card, so that a wrong guess takes one tap to fix.
23. As a caretaker, I want "bp 130/85, Dr. Lee friday 2pm" to save the BP and then open the event draft, so that one line does both.
24. As a caretaker, I want Undo for what was saved before the draft opened, so that a mistaken line is easy to take back.
25. As a caretaker, I want a second provider event in the same line to be saved directly, so that I'm never sent through two drafts in a row.
26. As a caretaker, I want "dizzy monday" to still mean last Monday, so that past-only kinds never move into the future.
27. As a caretaker, I want "last friday" and "next friday" always to mean what they say, so that I can override the default.
28. As a caretaker, I want "tomorrow 3pm Dr. Lee" and "Dr. Lee tomorrow 3pm" to read the same, so that word order doesn't matter.
29. As a caretaker using simple mode, I want the same reading rules, so that the box behaves the same in either mode.
30. As a screen-reader user, I want the kind chips to be buttons with clear names ("Make it a note"), and the draft opening announced by the page change, so that I know what happened.
31. As a member with a connected assistant, I want it to be able to add a note that mentions a provider, so that its notes link like mine do.
32. As a viewer (read-only), I want nothing new offered, so that the box stays hidden for me as today.
33. As the developer, I want every kind-picking word in one table with a test row each, so that a reported miss is a one-line, tested fix.
34. As the developer, I want the user's example lines as test rows, so that the reported cases never regress.

## Implementation Decisions

- **The vocabulary** (new, pure, in the assistant schema folder beside the parser): one exported table of phrases (one or more words), each with its role:
  - `symptomIncident`: makes a symptom named by its canonical word ("fell" → "Fall").
  - `noteIncident`: makes a note.
  - `visitVerb`: with a provider, an event that looks back.
  - `contactVerb`: with a provider, a note that mentions it.
  - `appointmentWord`: the existing appointment words, an event that looks ahead.

  The parser's event-words list goes away (its "hospital", "admitted", "discharged" and "ambulance" are re-sorted into this table). Matching is on folded tokens and multi-word phrases ("passed out", "talked to", "urgent care"). Symptom words that aren't incidents stay where they are.

- **Parser** (`parseQuickEntry`, same signature and result shape):
  - A part naming a provider (by last or practice name, as today) gets an event reading linked to it, ranked above the note, unless a contact verb or note incident makes it a note.
  - Titles drop time phrases, the provider's words and filler, and fall back to the provider's name. The `appointment` keyword titling stays.
  - The place is the provider's address unless "at <place>" names another.
  - Note readings carry `providerIds` for named providers.
  - Incidents produce a symptom reading with a null severity.
  - Readings keep their alternatives, so the cards can offer every plausible kind: symptom, event and note where they apply.
- **Time** (`quickEntryTime`): ordinal days ("25th", "the 25th", "on the 25th") and month-day forms ("Nov 25", "November 25th"). The rule for which way a time reads is set by the reading's kind: events and reminders take the future form, past-only kinds the past form, and a visit verb makes an event take the past form. "Last" and "next" are explicit. A day of the month that has passed reads as next month's (forward) or this month's (back). DST-safe, in the recipient's zone, as today.
- **Actions:** `addNote` gains `providerIds` (default empty, at most 20, as on `addEvent`). Actions still carry no device-only data.
- **Notes with providers:** `noteDocFromText(text, mentions?)` places a mention node for each named provider (label = the provider's name). The device runner and the server runner write the mention and the entry's provider link in the same transaction, refusing a provider that isn't live in the group, as events do. `actionPreview` names the providers on a note ("Note · with Dr. Lee").
- **Connector:** `add_note` takes `providerIds` (the schema's shape, described like `add_event`'s), and its result names them like `add_event`'s.
- **The event draft** (`lib/assistant/quickEntryDraft.ts`, extended): an event draft `{ title, occurredAt, allDay, place, providerIds }` passed in history state to the new-event page (`entries/new?kind=event`), which fills its fields from it. The existing `provider` URL param keeps working. A draft is never written until the page's own save.
- **Which card opens a draft** (pure, beside `openAfterSave`): the first chosen event reading with at least one provider. Save writes every other card through the runner as one batch (Undo as today, on the box's line), then pushes the draft page. If the draft is the only card, nothing is written and no Undo appears. The open-after-save rule for a single note or event without a provider is unchanged.
- **Kind chips** (`quickEntryCards.ts` and the card component): the current kind as a chip, and the other kinds this part can be as buttons ("Make it a symptom"), replacing the "X instead" chips. Same-kind alternatives (two medications) keep their named chips. A provider event's card says it opens to finish ("Opens to finish · Dr. Elena Alvarez · Fri, Nov 27").
- **Unchanged:** splitting, prefixes (`n:`, `e:`, `s:` and the rest; `e:` still forces an event, now also through the draft when it names a provider), vitals, doses, passes, the to-do reading, recent lines (no lines for notes and events), suggestions, and the box's layout (timeline-ux-2's popover and in-box hint).
- **No migration, no new dependency, no remote AI.** English only.

## Testing Decisions

- Tests check behaviour through public interfaces: what a line reads as, what a card offers, what Save writes or opens. They don't check internal token handling.
- **Unit, parser and time** (`quickEntry.test.ts`, table-driven): a row for every vocabulary phrase and every new date form, including each of the user's lines: "fell", "fell in the bathroom", "Dr. Elena Alvarez on the 25th", "Dr. Elena Alvarez", "see Dr. Alvarez friday", "Alvarez tomorrow 3pm", "Riverside Dialysis monday 9am", "saw Dr. Lee today", "called dr lee about refill", "911 call", "went to the ER at Riverside", "urgent care", "dizzy monday", "next friday" and "last friday" forms. The clock stays fixed (Thu 2026-11-19 08:00 in Los Angeles). The vocabulary gets a row-per-phrase check that every entry produces its role's kind.
- **Unit, cards and draft rules:** `quickEntryCards` (kind chips, labels, same-kind alternatives kept, the "opens to finish" summary) and the draft rule beside `openAfterSave` (which card opens, mixed lines, two provider events, none).
- **Unit:** `noteDocFromText` with mentions (nodes placed, `noteText` round-trips "@Name").
- **Component** (`timeline/timelineQuickEntry.browser.test.tsx`, entry page tests): a provider line's Save opens the new-event page prefilled, with nothing written; Back leaves no entry; a mixed line saves the BP with Undo, then opens the draft; a kind chip switches the card and Save writes that kind; a contact-verb line saves a note whose page shows the mention chip and the provider in the With row; an incident saves a symptom.
- **Integration:** one added case in the connector's existing write tests (`mcpWrites.int.test.ts`): `add_note` with a provider id writes the mention and the link, and a provider from another group is refused. This extends an existing test, because the connector change goes to the server.
- No new browser check. `live-notes` already covers a mention reaching other devices.
- Prior art: `quickEntry.test.ts` (tables), `quickEntryCards` tests, `timelineQuickEntry.browser.test.tsx` (the Edit-to-sheet draft flow), `entry/entryMentions.browser.test.tsx`.

## Out of Scope

- Remote AI or a model-based parser. The device-only rule stands.
- Learning from a user's kind switches, and a "Read this wrong?" report action (considered and left out).
- Guessing a provider by type ("ER" → the group's only hospital).
- Repeating events from quick entry ("every monday").
- End times and durations ("for an hour"), and new vital or dose phrasing.
- Other languages (`i18n`).

## Further Notes

- **Order:** after `timeline-ux-2` (it reworks the box's suggestions and hint: B-215, B-216, B-219) and `tasks-2` (it renames the to-do action, `actionPreview` and the connector's tools) are both in `dev`.
- The vocabulary is meant to grow: a new inbox bug "quick entry reads X as Y" becomes a row in the table and a test row, a `quick-fixes` slice.
