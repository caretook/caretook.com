# Plan: Connectors 2

> Source PRD: [`plans/connectors-2-prd.md`](connectors-2-prd.md). User-story numbers (US) refer to it. Backlog items B-193, B-194, B-195, B-204 and B-197 (B-196 stays in the backlog). Topic `connectors-2`.

## Status

| Slice | Wave | State          | Merge into `prd/connectors-2` (slice commits) |
| ----- | ---- | -------------- | --------------------------------------------- |
| 1     | 1    | merged (opus)  | c691be06 (3a8100d7)                           |
| 2     | 2    | started (opus) |                                               |
| 3     | 1    | merged (opus)  | 0b8c30f7 (9a92a2ba, cf033821)                 |
| 4     | 1    | started (opus) |                                               |
| 5     | 2    | blocked by 4   |                                               |

**Landing mode: run everything through** (queued with `pnpm prd queue connectors-2`): start every ready slice, land each green wave, clean up, ask only real questions.

**Wave 1** (2026-11-21): worktrees `.loops/connectors-2-{1,3,4}` made, agents spawned on opus; B-193, B-195, B-204 claimed. To keep the merges conflict-free, slice 1 creates the wording module at `apps/web/app/lib/connectors/connectGuide.ts` and slice 3 puts its success-step examples in its own `apps/web/app/lib/connectors/connectSuccess.ts` (instead of appending to `connectGuide`).

**Slice 1 hand-off notes:** the vendor steps and help links in `connectGuide.ts` are unverified (the runbook's hand check before launch). `check-areas.d/connectors` maps `assistantsSwitch.sync.ts` to no browser check (only Assistants and Devices read it). The off and viewer notes carry `data-guide-note="off|viewer"` for slice 2's ask button. Docs to fold: the guide's placement and wording module (`connectors.md`, _Managing connections_), how the notes are chosen (Devices uses every group on the device), and the new `components/connectors/` folder (`components.md`).

**Slice 3 hand-off notes:** `/connect`'s action data is now `{ error } | { connected }` (Connect returns the redirect as data; Cancel still redirects). Its `pnpm check` had one load timeout in `scripts/loops/browser.test.mjs` ("kills a spec at its cap…"), passing alone. Docs to fold (`connectors.md`): _`/mcp`_ gets `prompts.ts` (`definePrompt`, `CONNECTOR_PROMPTS`), the four prompts, scope filtering, `prompts/get`'s -32602 cases, the instructions' sentence; _Consent_ gets the success step (`connectSuccess.ts`, 5 s auto-return through `window.location`, clear of CSP `form-action`) and `shouldRevalidate`.

**Slice 4 hand-off notes:** `pnpm prd browser --changed` names `live-notes` (`noteYjs.ts`); the slice was stackless, so run it at landing. Edit kinds are server-only (`runnableActionZSchema` in `assistantActionService.ts`, outside `assistantActionZSchema`). Docs to fold: `appendNoteSection` and `noteDocumentService.currentDoc` (`live-notes.md`); `connectors.md` _Tools_ gets `append_to_entry`/`update_entry` and limits, an event's end moving with its start, a series visit detaching, the refusal codes (`entryNotFound` for other groups), edits never set `via`, and drop "Nothing edits" from _Writes_.

**Wave 2:** slice 2 started after slice 3's merge (worktree `.loops/connectors-2-2` with a stack, opus; B-194 claimed). Slice 5 started after slice 4's merge (worktree `.loops/connectors-2-5`, no stack, sonnet: it follows slice 4's pattern; B-197 claimed).

**Slice 5 hand-off notes:** 111d1e14, `pnpm check` passed, `--changed` names nothing. `recipient_profile` now returns condition ids; `recipientConditionService`'s write options gain a server-only `via` (stored on the change entry). Docs to fold: `connectors.md` _Tools_ (the three tools and action kinds, `conditionNotFound`/`conditionDeleted`, service refusals pass through, provider links not editable, `via` on change entries, condition ids); `profiles.md` (the server-only `via`).

**Slice 2 hand-off notes:** adds migration `0030_groovy_robbie_robertson` (regenerate if `dev` gains one first). Its `pnpm check` had one load flake (`timelineSimpleNow.browser.test.tsx` "nothing due and nothing ahead", passed alone 3x); its `pnpm prd browser --changed` ran the whole lean set on its branch: 12/12 pass (before slices 4 and 5 merged). Docs to fold: `connectors.md` (`assistant_request`, the service's rules, the membership lock, the outbox key `assistantsRequested:<requestId>:<ownerUserId>`, the two procedures, `/connect`'s `offGroups` with an owner link, `components/connectors/ask/` light index); `notifications.md` (`assistantsRequested`); `care-groups.md` (the table's permissions, cascades from the membership); `components.md` (the `ask` sub-index).

**Landing (in progress):** every slice merged (2026-11-21); items B-193, B-194, B-195, B-197, B-204 done. Next: sync, full check (a migration), serve, browser checks (`live-notes` by name, since slice 2's lean set ran before slice 4), ready, land, fold docs, `pnpm prd rm connectors-2`.

**Syncs before landing:** medications-3 landed with migration 0030 (`medication_types`); ours was regenerated on top as `0031_assistant_requests` (same SQL, only `assistant_request`) in fbc1a861. providers-2 (df4d0c05) synced after it (new Tiptap deps, `pnpm install`). An earlier full check passed on fe049520 before these syncs; `live-notes` passed there too.

**Start conditions:** none for wave 1. Slice 5 waited for `conditions`: landed in `dev` (B-181, a95acb73) and already in `prd/connectors-2`, so slice 5 is ready once slice 4 merges.

**Landing:** slice 2 adds a migration, so hold landing until every slice is merged, then run the checks once at the end. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. Never `--suite` without asking.

**Backlog:** claim each slice's item when it starts (1: B-193, 2: B-194, 3: B-195, 4: B-204, 5: B-197); `done` each after its slice merges.

**New dependencies:** none.

Fold into the area docs at each landing:

- **Slice 1:** the guide (where, the wording module, the off and viewer notes) in `docs/domain/connectors.md` (_Managing connections_).
- **Slice 2:** `assistant_request`, the service's rules and the email in `connectors.md`; the email's name in `notifications.md`; the table's permissions in `care-groups.md`.
- **Slice 3:** prompts (`definePrompt`, the four, scope filtering) and the success step in `connectors.md` (_`/mcp`_ and _Consent_).
- **Slice 4:** `appendNoteSection` in `live-notes.md`; the two tools in `connectors.md` (_Tools_).
- **Slice 5:** the condition tools in `connectors.md`.

## Architectural decisions

- **Wording:** one pure, client-safe module for the guide, the off and viewer notes, the ask button's states and the success step's example questions.
- **Requests:** `assistant_request` (not synced, oRPC only), one per member per group per 7 days, an email to every owner through the outbox in the same transaction, no health details.
- **Prompts:** `definePrompt` beside `defineTool`; `prompts` capability; list filtered by scope; prompts render text only and read nothing.
- **Entry edits:** append only (`appendNoteSection`, a `note_update` with the member as editor) and title or time (`updateEntry`); both through `assistantActionService`, any live note or event in the grant's group, writers only; other groups' ids are `notFound`.
- **Conditions:** through `recipientConditionService` as three action kinds; its rules and change entries apply.
- **Tools list:** new tools append at the end of the writes group; write hints on all of them.

## How to run this plan

- **Wave 1: slices 1, 3, 4.**
  - Slice 1 owns the guide component, the wording module (it creates it) and the Assistants and Devices pages' additions.
  - Slice 3 owns `protocol.ts`'s prompts, the prompt registry, the server instructions and `ConnectConsent.tsx`'s success step. It adds its examples to the wording module after slice 1's lines (merge in number order).
  - Slice 4 owns `appendNoteSection`, `assistantActionService`'s new kinds, and `writes.ts`.
- **Wave 2: slices 2 and 5.**
  - Slice 2 owns the migration, the service, the email, the oRPC procedures, the ask button on Assistants and `/connect`'s empty state.
  - Slice 5 owns the condition action kinds and tools.
- Merge in number order within a wave, with no checks between merges.
- **Migration:** slice 2 adds one (say "adds a migration"; it takes the next number when it lands). If `dev` gains one first, regenerate it (`pnpm datastore:generate`) and reread the SQL.
- **Stacks:** only slice 2 needs one (the migration on a fresh database, the email in the dev mailbox, `--changed`). The others are stackless: integration tests on the shared test Postgres, component tests on the test device. A stackless slice whose `--changed` names a browser check reports it for the orchestrator to run at landing.
- **Checks:** every slice runs `pnpm check`. Screen slices run `pnpm test:components --changed prd/connectors-2`. No slice adds an end-to-end step. Every slice runs `pnpm prd browser --changed` once before hand-off and reports what it named.
- **Running beside other PRDs:**
  - `conditions` (running): slice 5 after it lands; its slice 6 adds to the tools list and `recipient_profile` (additive).
  - `appointments-2` (running): no shared files expected; check its open slices for `assistantActionService`.
  - `providers-2` (planned): no overlap.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: The connect guide

Stack: no · Reads: docs/domain/connectors.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: unit, component

**User stories:** 1–10.

**What to build.**

- The wording module: the `/mcp` URL from the configured origin, 3 or 4 steps each for Claude and ChatGPT, one vendor help link each, the off note and the viewer note.
- `ConnectGuide`: the URL with Copy ("Copied" status; a failed copy shows the URL to copy by hand), the two clients' steps, the links. On Group settings → Assistants after the switch, and on Settings → Devices after "Connected assistants". With the switch off, the off note instead of the steps; viewers get the viewer note.

**Acceptance criteria.**

- [ ] Unit tests: the URL from an origin, the notes by state.
- [ ] Component tests (the Assistants and Devices tests): the guide shows with the URL and steps; Copy reports "Copied"; switch off shows the off note; a viewer sees the viewer note.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** none. **Blocks:** 2.

---

## Slice 2: Ask owners to turn assistants on

Stack: yes · Reads: docs/domain/connectors.md, docs/domain/notifications.md, docs/domain/care-groups.md, docs/domain/data-layer.md, docs/domain/api.md, docs/domain/components.md · Tests: integration, component

**User stories:** 11–20.

**What to build.**

- `assistant_request` and its migration; `PERMISSIONS` (read the member, owners and admins; writes `system`).
- `assistantRequestService.request` and `latest` (PRD _Asking owners_); the `assistantsRequested` notification (subject and text name only the member and the group; a link to Assistants through `APP_URL`; plain text too), sent to every owner in the transaction, keyed by the request id, `deliverSoon` after commit.
- oRPC `connector.requestEnable` and `connector.myRequest`.
- The ask button for non-owners when the switch is off, on Assistants and in `/connect`'s empty state (each group with the switch off); after asking, "Asked on <date>"; gone when on.

**Acceptance criteria.**

- [ ] Integration tests (`assistantRequest.int.test.ts`): a caretaker's and a viewer's request email every owner once; an owner is refused; switch on is refused; a second request within 7 days returns the first and sends nothing; after 7 days a new one sends; the email has no health details; a non-member gets `notFound`.
- [ ] Component tests: the button on Assistants for a caretaker with the switch off, then "Asked on"; no button for an owner; the `/connect` empty state lists off groups with the button.
- [ ] The migration runs on a fresh database; `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 1, 3. **Blocks:** none.

---

## Slice 3: Starter prompts and the success step

Stack: no · Reads: docs/domain/connectors.md, docs/domain/components.md · Tests: unit, integration, component

**User stories:** 21–28.

**What to build.**

- `definePrompt` and the four prompts (PRD _Prompts and success_); `initialize` advertises `prompts`; `prompts/list` filtered by scope (`log_what_happened` needs write); `prompts/get` validates arguments (invalid params as -32602) and returns one user message. One sentence about the prompts added to the server instructions.
- `/connect`'s success step after consent: "Connected to <group>", three example questions from the wording module, "Return to <client>" and an auto-return after about 5 s through the existing redirect path.

**Acceptance criteria.**

- [ ] Unit tests (the protocol tests): the capability; list for a read and a write grant; get for each prompt with and without arguments; a missing required argument is -32602.
- [ ] Integration test (`mcp.int.test.ts`): prompts over HTTP with a real token.
- [ ] Component tests (the `ConnectConsent` tests): after Connect the success step shows the group and examples; Return redirects at once; the timer redirects after the delay (fake timers).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** none. **Blocks:** 2.

---

## Slice 4: Appending to and retitling notes and events

Stack: no · Reads: docs/domain/connectors.md, docs/domain/live-notes.md, docs/domain/timeline.md, docs/domain/data-layer.md · Tests: unit, integration

**User stories:** 29–38.

**What to build.**

- `appendNoteSection(doc, lines)` beside `prependNoteSection`.
- `assistantActionService`'s `appendToEntry` and `updateEntry` kinds (PRD _Editing entries_): limits, the document created if missing, one `note_update` with the member as editor, title or time through the entry service, the future-skew rule, the refusals.
- The tools `append_to_entry` and `update_entry` (write hints, preview wording and a link). Check `list_timeline` and `search` return entry ids; add them if not.

**Acceptance criteria.**

- [ ] Unit tests (`noteYjs.test.ts`): appended at the end; bullets; existing content untouched; an append and a concurrent update merge.
- [ ] Integration tests (`mcpWrites.int.test.ts`, `assistantAction.int.test.ts`): append to a note with pending updates, then compaction's text has both; the member in `editors`; append to an event with no document creates it; update title and time; too many lines refused; viewer refused; deleted entry, symptom and other-group id refused (`notFound` for the last).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** none. **Blocks:** 5.

---

## Slice 5: Condition tools

Stack: no · Reads: docs/domain/connectors.md, docs/domain/profiles.md, plans/conditions-prd.md · Tests: integration

**User stories:** 39–43.

**What to build.**

- `assistantActionService` kinds for adding, updating and resolving a condition through `recipientConditionService`; the tools `add_condition`, `update_condition` and `resolve_condition` (write hints, preview wording, a link to the profile). Fields follow the conditions schema in `dev`. Check `recipient_profile` returns condition ids.

**Acceptance criteria.**

- [ ] Integration tests (`mcpWrites.int.test.ts`): add, update and resolve, each with its condition change on the timeline and the `via` tag where entries are created; the service's refusals surface as tool errors; viewer refused; another group's condition is `notFound`.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 4, and `conditions` landed. **Blocks:** none.
