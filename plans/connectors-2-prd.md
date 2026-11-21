# PRD: Connectors 2 (easier connecting, more writes)

> **Done** (2026-11-21): every slice merged; the decisions are in [connectors](../docs/domain/connectors.md), [live notes](../docs/domain/live-notes.md) and [notifications](../docs/domain/notifications.md).

Backlog items B-193 (the in-app connect guide), B-194 (asking owners to turn assistants on), B-195 (starter prompts and a success state), B-204 (editing notes and events) and B-197 (condition writes). B-196 (directory listings) stays in the backlog until after the launch. Topic `connectors-2`. It follows the connectors PRD ([`connectors-prd.md`](connectors-prd.md), done); the rules it builds on are in [connectors](../docs/domain/connectors.md), [notifications](../docs/domain/notifications.md), [live notes](../docs/domain/live-notes.md) and [care groups](../docs/domain/care-groups.md).

## Problem Statement

A member who wants to use their own Claude or ChatGPT with Caretook has nowhere in the app that tells them the server's URL or where to paste it. If their group's owner hasn't turned assistants on, the member hits a dead end with no way to ask. Once connected, the assistant knows the tools but not what's useful to ask, and the member gets sent back to the assistant with no sign it worked. And a connected assistant can add notes and events but can't add to one that already exists (say, the questions for tomorrow's visit), nor record a diagnosis.

## Solution

- **A connect guide** on Group settings → Assistants and Settings → Devices: the server's URL with Copy, a few short steps for Claude and for ChatGPT, and a link to each vendor's help page. When the switch is off it says so, and owners see the switch right there.
- **Ask the owners.** When the switch is off, a member can press "Ask owners to turn this on", on the Assistants page or on the connect page's "no group allows assistants" state. Every owner gets an email (no health details) linking to the Assistants page. A member can ask once a week per group, and the button then reads "Asked on <date>".
- **Starter prompts.** The server offers four prompts the assistant lists: catch me up, prepare for an appointment, a weekly summary, and log what happened.
- **A success step.** After Connect, the connect page shows "Connected to <group>" with three example questions and "Return to <client>", and returns on its own after a few seconds.
- **Editing entries.** The assistant can append text to any live note or event in the group, and change its title or time. Appending merges with whoever has the note open. Each write is confirmed in the assistant's UI, like the other writes.
- **Conditions.** The assistant can add, update and resolve the care recipient's conditions.

## User Stories

### Connect guide (B-193)

1. As a member, I want the app to show the URL to give my assistant, so that I don't have to find it in docs.
2. As a member, I want to copy the URL with one tap, so that I don't mistype it on a phone.
3. As a member, I want short steps for Claude, so that I know where to add a custom connector.
4. As a member, I want short steps for ChatGPT, so that I can use the one I already pay for.
5. As a member, I want a link to each vendor's own help page, so that I can follow their current instructions if a menu moved.
6. As a member, I want the guide on the group's Assistants page, so that I find it where the feature lives.
7. As a member, I want the guide on Settings → Devices beside my connected assistants, so that I can connect another one from there.
8. As a member, I want the guide to say when the group's switch is off, so that I don't try a connection that will fail.
9. As an owner, I want the switch beside the guide, so that I can turn it on and connect in one place.
10. As a viewer, I want the guide to say my assistant can read but not write, so that I know what to expect.

### Asking owners (B-194)

11. As a member whose group has assistants off, I want to ask the owners to turn them on, so that I'm not stuck.
12. As a member, I want the ask button on the Assistants page, so that it's where I learn the switch is off.
13. As a member on the connect page with no group allowing assistants, I want to ask from there, so that I don't have to leave my assistant's flow to find the setting.
14. As a member, I want to see "Asked on <date>" after asking, so that I know it went through and don't ask again.
15. As a member, I want to be able to ask again after a week, so that a missed email isn't the end.
16. As an owner, I want an email when a member asks, saying who asked and linking to the Assistants page, so that I can turn it on quickly.
17. As an owner, I want the email to carry no health details, so that it's safe in any inbox.
18. As an owner, I want at most one email per member per week, so that a member can't flood me.
19. As an owner, I want no button for myself, since I can flip the switch.
20. As a member, I want the button gone once the switch is on, so that the page shows the guide instead.

### Prompts and success (B-195)

21. As a member in my assistant, I want a "Catch me up" prompt, so that I get what happened since a time (today by default): the timeline, doses due and what's coming.
22. As a member, I want a "Prepare for an appointment" prompt, so that it pulls recent symptoms, vitals and medication changes for an upcoming appointment and drafts questions.
23. As a member, I want a "Weekly summary" prompt, so that I get a plain-language summary of the last 7 days to share with family.
24. As a member, I want a "Log what happened" prompt, so that I can describe the day and have it turned into vitals, doses, symptoms and notes, each confirmed.
25. As a member, I want prompts my role can't use (logging for viewers) left out, so that I don't pick one that fails.
26. As a member who just pressed Connect, I want to see "Connected to <group>", so that I know it worked.
27. As a member, I want three example questions on that step, so that I know what to try first.
28. As a member, I want to return to my assistant with one tap, or on its own after a few seconds, so that the flow isn't slowed down.

### Editing entries (B-204)

29. As a member, I want my assistant to add questions to the end of an existing visit note, so that it can help me prepare without making a new note.
30. As a member, I want appended text to show up in a co-caretaker's open editor without clobbering their typing, so that we can work on the same note.
31. As a member, I want appended text to support paragraphs and bullets, so that lists read as lists.
32. As a member, I want my assistant to fix an entry's title or time, so that a mislabelled event can be corrected.
33. As a member, I want my assistant to be able to edit any live note or event in the group, as I can in the app, so that it can add to one a co-caretaker started.
34. As a member, I want my assistant to confirm each edit with me first, so that nothing changes without my say.
35. As a member, I want the edit recorded as mine (in the note's recent editors), so that others know who changed it.
36. As a viewer, I want my assistant refused, so that a read-only role stays read-only.
37. As a member, I want edits to deleted entries, symptoms, vitals and other groups' entries refused, so that only what I could edit in the app is editable.
38. As a member, I want the answer to say what changed and link to the entry, so that I can check it.

### Conditions (B-197)

39. As a member, I want my assistant to add a condition (name, status, since, note), so that a new diagnosis from a visit is recorded.
40. As a member, I want my assistant to update a condition's status, since date or note, so that changes are kept current.
41. As a member, I want my assistant to resolve a condition, so that a past one stops showing as active.
42. As a member, I want condition writes to follow the app's rules and show on the timeline as condition changes, so that they look the same as ones I make.
43. As a viewer, I want condition writes refused.

## Implementation Decisions

### Connect guide

- A pure, client-safe wording module (`connectGuide`): the server's URL (from the configured origin, `VITE_API_ORIGIN || location.origin` plus `/mcp`), 3 or 4 short steps each for Claude and ChatGPT, and one vendor help link each, plus the switch-off and viewer notes. All vendor wording lives there; it's checked by hand before launch (the runbook's connector check).
- A `ConnectGuide` component (Copy through the clipboard with a "Copied" status, as the entry page's share does) on Assistants (after the switch, for everyone) and Devices (after "Connected assistants"). Off: the guide is replaced by the off note and, for non-owners, the ask button.

### Asking owners

- **Table `assistant_request`** (adds a migration): `group_id`, `user_id`, `requested_at`, timestamps; composite FKs cascade from the group and the membership's user. Not synced; read through oRPC. `PERMISSIONS`: read the member and the group's owners and admins; writes `system`.
- **`assistantRequestService.request(ctx, groupId)`:** any member except owners; refused while the switch is on (`alreadyOn`); within 7 days of the member's last request it returns that request (no email). Otherwise one transaction: the row, then `notify("assistantsRequested", …)` to every owner, keyed by the request id, then `deliverSoon` after commit. The email names the member and the group only (the `groupDisplayName` rules) and links to the Assistants page through `APP_URL`.
- **oRPC:** `connector.requestEnable({ groupId })` and `connector.myRequest({ groupId })` (the last request's date or null).
- **`/connect`'s empty state** lists the member's groups with the switch off, each with the ask button (it uses the same procedure; the page is web only).

### Prompts and success

- **MCP prompts** in the hand-written protocol module: the `prompts` capability in `initialize`, `prompts/list` filtered by scope (logging needs write), `prompts/get` with arguments. A `definePrompt` registry beside `defineTool`: name, title, description, arguments (Zod, emitted as MCP arguments), and a function that renders the user message text naming the tools to use. Prompts read nothing themselves.
  - `catch_me_up` (`since`, optional, default the start of today).
  - `prepare_for_appointment` (`appointment`, optional: a title or date; otherwise the next one).
  - `weekly_summary` (no arguments).
  - `log_what_happened` (`account`, required free text); write scope only.
- The server instructions gain one sentence pointing at the prompts.
- **Success step:** after a successful consent, the page shows "Connected to <group>", three example questions (from the wording module), and "Return to <client>". It redirects through the existing fetch-then-`window.location` path after about 5 seconds, or at once on the button.

### Editing entries

- **`appendNoteSection(doc, lines)`** (client-safe, beside `prependNoteSection`): typed lines (paragraph, bullet) appended at the end of the document in one transaction, never touching existing content. Encoded as one Yjs update.
- **`assistantActionService`** gains two action kinds:
  - `appendToEntry` (`entryId`, `lines`, at most 50 lines and 5,000 characters): a live note or event in the grant's group. It creates the document if there's none, and writes one `note_update` through `noteDocumentService.appendUpdate` with the member as the editor.
  - `updateEntry` (`entryId`, `title?`, `occurredAt?`, at least one): through the timeline entry service's update, with the same future-skew rule as creates.
  - Refusals: viewer, a deleted entry, a symptom or vital, an id in another group (`notFound`, never revealing it exists).
- **Tools:** `append_to_entry` and `update_entry`, appended to the writes group with the write hints (so clients confirm each write). Answers use quick entry's preview wording and a link. The `via` tag stays create-only.
- `list_timeline` and `search` answers must include entry ids (check; add if missing).

### Conditions

- **Tools:** `add_condition` (name, status, since, note), `update_condition` (`conditionId` and any of status, since, note) and `resolve_condition` (`conditionId`, optional `since`/resolved date), through `recipientConditionService` inside `assistantActionService` as three action kinds. The service's own rules, refusals and condition change entries apply. Fields follow the conditions PRD's schema at landing time.
- `recipient_profile` (conditions slice 6) already returns condition ids; check it.

## Testing Decisions

- Tests check behaviour through each module's interface: what a pure module returns, what a service writes and refuses, what a tool answers, and what a screen shows.
- **Unit:** the guide wording (URL from the origin, the off and viewer notes); the prompts (list by scope, `prompts/get` text and argument validation) in the protocol tests; `appendNoteSection` (`noteYjs.test.ts`: appended at the end, bullets, existing content untouched, merging with a concurrent update).
- **Integration:**
  - `assistantRequest.int.test.ts`: owners refused, switch on refused, the 7-day window, one email per owner with no health details, the outbox key.
  - `mcp.int.test.ts`: `initialize` advertises prompts; list and get.
  - `mcpWrites.int.test.ts`: append (text derived after compaction, pending updates merged, the member in editors), update title and time, viewer refused, deleted and other-group entries refused, symptoms refused; the three condition tools and their refusals.
  - `connect` integration (the page's server code): the success step's data.
- **Component:** the guide on Assistants and Devices (copy, off, viewer), the ask button and "Asked on", `/connect`'s empty state with the ask button, the success step (examples, Return, the auto-return).
- **End to end:** none. The lean set is at its 255 s ceiling, and `roundtrip` already writes through `/mcp`.
- Prior art: `mcpWrites.int.test.ts`, `connector.int.test.ts`, `ConnectConsent` tests, the join-request emails in `joinRequestService`.

## Out of Scope

- B-196: listing in Anthropic's and ChatGPT's directories (after the launch and the privacy policy; vendor review). A listing will need a logo, short and long descriptions, a test account and the privacy URL.
- Rewriting or deleting existing text through a connector; deleting entries or conditions.
- In-app notices or push for the owners' request.
- Prompts that read data themselves (resources) or sampling.
- Remembering a member's prompts or history.

## Further Notes

- **Running beside other PRDs:**
  - `conditions` (running): the condition tools wait for it to land; its slice 6 touches `recipient_profile` and the tools list (additive).
  - `appointments-2` (running): "prepare for an appointment" only names existing tools; no overlap.
  - `providers-2` (planned): no shared files.
- The success step and the empty state's ask button need JS, like the rest of `/connect`.
