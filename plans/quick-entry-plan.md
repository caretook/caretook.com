# Plan: Quick entry picks the right kind

> Source PRD: [`plans/quick-entry-prd.md`](quick-entry-prd.md). User-story numbers (US) refer to it. Backlog item B-220 (quick entry should be more powerful and flexible: "fell", provider lines and dates make the wrong kind). Topic `quick-entry`.

## Status

| Slice | Wave | State                                              | Merge into `prd/quick-entry` (slice commits) |
| ----- | ---- | -------------------------------------------------- | -------------------------------------------- |
| 1     | 1    | merged, worktree removed                           | 285342b7 (14374ab2)                          |
| 2     | 2    | started (opus, `.loops/quick-entry-2`, no stack)   |                                              |
| 3     | 2    | started (opus, `.loops/quick-entry-3`, no stack)   |                                              |
| 4     | 2    | started (sonnet, `.loops/quick-entry-4`, no stack) |                                              |

**Landing mode (2026-11-21): run everything through** (queued with `pnpm prd queue`): start every ready slice, land each green wave, clean up; ask only real questions.

**Now (2026-11-21):** synced with `dev` after `tasks-2` (d65bf19f; brings migration 0032_todos and a sync-config change: `pnpm datastore:reset` before serving). B-220 claimed. Slice 1 merged; wave 2 (slices 2, 3, 4) running. Merge 2, 3, 4 in order (3 and 4 both touch `quickEntryCards.ts` and the card component), then `pnpm prd sync` (medications-tabs B-226 landed in `dev` at 07a6b59: `appUrls.medications` is gone, sheet helpers take a tab; no migration) and one landing. B-231 (a timeline empty-state box) isn't ours.

**Slice 1 hand-off notes (for docs at landing):** the vocabulary (`quickEntryVocabulary.ts`, roles, `unlessNext` e.g. "fell asleep"; a miss is one row plus a test row; not exported from `@caretook/data/schema`, whose list is frozen); a provider is "named clearly" by a last name, title + name, a practice's full name, or its first word after at/to/from or a verb (a bare first name doesn't make an event); titles drop time, provider words, verbs and filler; place from "at …" else the provider's address; no time → all-day today; contact verbs and note incidents rank the note first (event at 0.5), symptom incidents give the canonical symptom with severity null; the reading decides the time's direction; "25th"/"the 25th"/"on the 25th" with count-word guards, months without that day skipped. Deliberate changes: "fell in bathroom last night" is now the symptom Fall; "appointment with dr lee" is all-day today with no warning. "slipped"/"tripped" dropped (plain notes now).

**Start conditions:** wait for **both** `timeline-ux-2` in `dev` (its quick-entry slices: B-215, B-216, B-219 reshape `components/quick-entry/`) **and** `tasks-2` in `dev` (it renames the to-do action, `actionPreview`, the parser's to-do reading and the connector's tools; last item B-222). `pnpm prd sync` before slice 1.

**Landing:** no migration, no dependencies, no browser check. Land when all four slices are merged; run the checks once at the end. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. Never `--suite` without asking.

**Backlog:** claim B-220 when slice 1 starts; `done B-220` after the last slice merges.

Fold into the area docs at landing:

- **Slice 1:** the parser lines in [assistant](../docs/domain/assistant.md): the vocabulary table and its roles, provider lines as events, titles and places, the date forms and which way a time reads.
- **Slice 2:** `addNote`'s `providerIds` and note mentions in [assistant](../docs/domain/assistant.md); `noteDocFromText`'s mentions in [live-notes](../docs/domain/live-notes.md); `add_note`'s providers in [connectors](../docs/domain/connectors.md).
- **Slice 3:** the event draft and the Save flow (which card opens, mixed lines, Undo) in [assistant](../docs/domain/assistant.md); the new-event page's draft in [live-notes](../docs/domain/live-notes.md) or [appointments](../docs/domain/appointments.md), wherever `entries/new` is described.
- **Slice 4:** the kind chips in [assistant](../docs/domain/assistant.md) (replacing "alternatives as chips (Note instead)").

## Architectural decisions

- **The vocabulary** is one exported table in the assistant schema folder (`quickEntryVocabulary.ts`, pure, client-safe): `{ phrase, role, name? }` rows. The roles are `symptomIncident` (with its canonical symptom name, "fell" → "Fall"), `noteIncident`, `visitVerb`, `contactVerb` and `appointmentWord`. The parser's `EVENT_WORDS` and `APPOINTMENT_WORDS` are replaced by lookups into it. Every phrase has a test row. A new kind-picking word is always a row here, never a list elsewhere.
- **Kinds from a provider:** a part that names a provider reads as an event linked to it (ranked first), unless a `contactVerb` or `noteIncident` makes it a note that carries the provider. With no time, the event is all-day today (forward reading: the next matching day). Its title is the leftover words with time phrases, the provider's words and filler dropped, else the provider's name. Its place is the provider's address unless "at <place>" names another.
- **Which way a time reads** belongs to the reading, not the part. Events and reminders take the forward form, symptoms, vitals and doses the backward one, and a `visitVerb` makes an event take the backward one. "last" and "next" are explicit. New forms are ordinal days and month-day dates; a passed day of the month reads as next month's (forward) or this month's (back).
- **Readings offer every plausible kind:** a part keeps a symptom, an event and a note reading where each applies, so the cards can switch between them. The parser's result shape is unchanged.
- **`addNote.providerIds`** (default `[]`, max 20) is the only action change. Both runners write a note's providers as mention nodes (`noteDocFromText(text, mentions?)`) and entry provider links, in the note's transaction, refusing a provider that isn't live in the group.
- **The event draft** goes in history state to `entries/new?kind=event` (`lib/assistant/quickEntryDraft.ts`): `{ title, occurredAt, allDay, place, providerIds }`. Nothing is written until the page saves. The `provider` URL param keeps working.
- **Save with a draft:** the first chosen event reading with a provider opens as the draft. Every other card is written as one batch (Undo on the box's line), then the draft page is pushed. A draft alone writes nothing. The pure rule lives beside `openAfterSave`.
- **Unchanged:** splitting, prefixes, vitals, doses, passes, to-dos, recent lines, suggestions and the box's layout.

## How to run this plan

- **Wave 1: slice 1** (the parser, the vocabulary, time). Pure `packages/data` work.
- **Wave 2: slices 2, 3 and 4 together**, after slice 1 is merged.
  - Slice 2 owns `assistantActions` (`addNote`), `noteYjs` (`noteDocFromText`), the device runner (`lib/assistant/quickEntry.sync.ts`), the server runner (`assistantActionService`), `quickEntryPreview` and the connector's `add_note`. It also adds note `providerIds` in the parser, a few lines.
  - Slice 3 owns `quickEntryDraft.ts`, the draft rule beside `openAfterSave`, `useQuickEntry`'s Save, and the entry page's new-event draft. It adds one field to the card model (`opensDraft`, and its summary line).
  - Slice 4 owns the kind chips in `quickEntryCards.ts` and the card component.
  - Slices 3 and 4 both edit `quickEntryCards.ts` and the card component: additive changes, merged by the orchestrator (slice 3's field, slice 4's chips).
- **Stacks:** all stackless (unit, component on the test device, and integration on the shared test Postgres).
- **Checks:** every slice runs `pnpm check`. The UI slices (3, 4) also run `pnpm test:components --changed prd/quick-entry`, and `pnpm prd browser --changed` once before hand-off, reporting what it named.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: The vocabulary, provider lines and dates

Stack: no · Reads: docs/domain/assistant.md, docs/domain/appointments.md, docs/domain/providers.md · Tests: unit

**User stories:** 1–6 (the reading), 8, 9, 12, 13, 15–20 (the kind), 26–29, 33, 34.

### What to build

Add the vocabulary table and rewire the parser and time reader as the decisions say: provider lines as events with titles and places, visit and contact verbs, symptom and note incidents, every plausible kind kept as a reading, ordinal and month-day dates, and the per-reading direction rule. Notes don't carry providers yet (slice 2), and Save still writes events directly (slice 3).

### Acceptance criteria

- [ ] `quickEntry.test.ts` has a row for each of the PRD's example lines with its top reading's kind, title, time, all-day, place and providers. "Dr. Elena Alvarez on the 25th" is an all-day event on Wed Nov 25 linked to Dr. Alvarez; "see Dr. Alvarez friday" is Fri Nov 20; "fell in the bathroom" is the symptom "Fall" with no severity; "911 call" and "urgent care" are notes; "called dr lee about refill" is a note with an event alternative; "dizzy monday" is last Monday.
- [ ] A vocabulary test checks every row of the table: its phrase alone (and with a provider, for verbs) gives its role's kind.
- [ ] Time tests (in `quickEntry.test.ts` or beside `quickEntryTime`) cover "25th", "the 25th", "on the 25th at 2pm", "Nov 25", "November 25th", a passed day of the month both ways, "next friday" and "last friday" on an event and on a symptom, and a DST week.
- [ ] Every existing row still passes, or is changed deliberately with the reason in the hand-off ("fell" was an event).
- [ ] `pnpm check` passes.

**Blocked by:** `timeline-ux-2` and `tasks-2` in `dev`. **Blocks:** slices 2, 3, 4.

---

## Slice 2: Notes that mention providers

Stack: no · Reads: docs/domain/assistant.md, docs/domain/live-notes.md, docs/domain/providers.md, docs/domain/connectors.md · Tests: unit, component, integration

**User stories:** 14, 19, 20, 31.

### What to build

`addNote.providerIds`; `noteDocFromText` placing mentions; both runners writing a note's mentions and provider links in one transaction (refusing a provider not live in the group); the parser putting named providers on note readings (contact verbs, note incidents); `actionPreview` naming a note's providers; the connector's `add_note` taking `providerIds` and naming them in its result.

### Acceptance criteria

- [ ] Unit: `noteDocFromText` with mentions places a mention node per provider, and `noteText` reads it back as "@Name". With no mentions, the output is unchanged.
- [ ] Unit: parser rows for "called dr lee about refill" and "went to the ER at Riverside" carry the provider on the note; "urgent care" carries none. `quickEntryPreview` tests name the providers on a note.
- [ ] Component (`timelineQuickEntry.browser.test.tsx`): saving "called dr lee about refill" makes a note whose entry page shows the mention chip and Dr. Lee in the With row.
- [ ] Integration (one added case in `mcpWrites.int.test.ts`): `add_note` with a provider id writes the mention and the link, and a provider from another group is refused.
- [ ] `pnpm check` passes.

**Blocked by:** slice 1. **Blocks:** none.

---

## Slice 3: Provider events open a prefilled draft

Stack: no · Reads: docs/domain/assistant.md, docs/domain/live-notes.md, docs/domain/appointments.md, docs/domain/components.md · Tests: unit, component

**User stories:** 6, 7, 10, 11, 23–25, 30.

### What to build

The event draft in `quickEntryDraft.ts`; the new-event page (`entries/new?kind=event`) filling its title, time, all-day, place and providers from it; the pure rule for which card opens as the draft; Save writing the other cards as one batch with Undo, then pushing the draft page; the card model's `opensDraft` and its summary ("Opens to finish · Dr. Elena Alvarez · Wed, Nov 25").

### Acceptance criteria

- [ ] Unit: the draft rule picks the first provider event in a line and none when there isn't one, and a second provider event is written. The draft round-trips through history state.
- [ ] Component (`timelineQuickEntry.browser.test.tsx`): "Dr. Elena Alvarez on the 25th" then Save opens the new-event page with the title, the day (all-day), Dr. Alvarez and the address filled in, and nothing is written; Back leaves no entry; saving there writes one event linked to the provider.
- [ ] Component: "bp 130/85, Dr. Lee friday 2pm" saves the BP with Undo on the box's line, then opens the draft. Undo removes the BP.
- [ ] Component (entry page tests): the new-event page opened with a draft shows its fields, and opened with only `?provider=` behaves as before.
- [ ] `pnpm check` passes.

**Blocked by:** slice 1. **Blocks:** none.

---

## Slice 4: Kind chips on the cards

Stack: no · Reads: docs/domain/assistant.md, docs/domain/components.md · Tests: unit, component

**User stories:** 21, 22, 30.

### What to build

Each card shows its kind as a chip and offers the other plausible kinds as buttons ("Make it a symptom", "Make it a note"), replacing the "X instead" chips. Same-kind alternatives (two medications) keep their named chips.

### Acceptance criteria

- [ ] Unit (`quickEntryCards` tests): a part with symptom, event and note readings gives the current kind chip and the two others as buttons with those names; two dose readings keep "Metoprolol 25 mg instead".
- [ ] Component (`timelineQuickEntry.browser.test.tsx`): "fell" shows Symptom with Event and Note one tap away; tapping "Make it a note" switches the card and Save writes a note; the buttons are reachable by Tab and named for screen readers.
- [ ] `pnpm check` passes.

**Blocked by:** slice 1. **Blocks:** none.
