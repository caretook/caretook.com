# PRD: Assistant (quick actions, voice, questions about the timeline)

Status: 📝 **draft**, not planned or sliced. Backlog item: B-12. Topic `assistant`. Written to inform other PRDs (search, medications, providers, invites, marketing) before it's built; the _Effects on other PRDs_ section lists what it asks of them. Questions need `search`'s server side; quick actions don't.

## Problem Statement

Logging care is a two-handed job done by someone with their hands full. A caretaker who has just taken a blood pressure at the bedside, or is walking out of an appointment with a list of instructions, has to open the timeline, pick the right kind, find the right fields, type numbers on a phone keyboard and save, once per thing. Several readings and a symptom is several trips through a form. So things get logged later, from memory, or not at all.

Reading the timeline is just as slow. "When did she last have a fever?", "how has her blood pressure been this week?" or "what did the cardiologist say last time?" means scrolling back through weeks of entries, or filtering by kind and reading each one. The caretaker preparing for an appointment wants a summary, and the timeline only offers a list.

## Solution

An **assistant** in every care group: a button on every group screen that opens a small chat sheet. Each person can type or speak to it.

- **Quick actions:** "BP 130 over 85, pulse 72, and she had a headache, about a 4" becomes **draft cards** (a vital with two readings, a symptom at severity 4), each with Save, Edit and Discard. Save writes the entry exactly as the regular forms do, so it works offline and syncs. Edit opens the usual sheet, already filled in. It can also change recent entries ("make that 135", "move the last temperature to 9am"), again as a draft of the change to confirm. Nothing reaches the timeline until a person confirms it.
- **Voice:** a mic button records a request. The audio is transcribed on our server by a speech-to-text vendor that keeps nothing and trains on nothing, then handled like typed text. The transcript is shown so mistakes are visible before anything is saved.
- **Offline:** a typed or spoken request made offline waits on the device. When the connection returns, it's processed and its drafts wait in the sheet (with a badge on the button) until someone saves or discards them. Each draft keeps the time it was asked, not the time it synced.
- **Questions:** "When did she last have a fever?" is answered from the group's timeline, providers and (later) medications. The assistant looks things up through read tools that run as the asking user, so it sees exactly what they can see. Answers link to the entries they're based on.
- **Saving answers:** any answer can be saved as a note or event (a draft to confirm), which becomes a normal live document the group can edit. Later, "plan questions for the cardiology visit" makes a visit plan the same way.
- **Conversations aren't kept.** The chat lasts until the sheet closes. What lasts is what people confirm into the timeline.
- **Opt-in per group:** an owner turns the assistant on in group settings, after reading what it sends to the AI vendors. Each member sees a one-time notice the first time they open it. Turning it off hides it for everyone.
- Entries made through the assistant are authored by the person who confirmed them, with a small "via assistant" marker on the entry page.

## User Stories

### Turning it on

1. As a group owner, I want to turn the assistant on for my group from group settings, so that we can use it.
2. As a group owner, I want to read what the assistant sends to outside services (the AI and speech vendors), and that they keep nothing and don't train on it, before I turn it on, so that I can make an informed choice for my family.
3. As a group owner, I want my consent recorded with my name and the time, so that the group can see who turned it on.
4. As a group owner, I want to turn the assistant off, so that nothing more from our group is sent to the vendors.
5. As a member, I want a one-time notice the first time I open the assistant, saying what it sends where, so that I know before I use it.
6. As an admin, caretaker or viewer, I want to see whether the assistant is on and who turned it on, so that I know how our data is used.
7. As a member of a group where it's off, I want no assistant button at all, so that the screen isn't cluttered with something I can't use.

### Opening it

8. As a caretaker, I want an assistant button on every group screen, so that I can log something without leaving where I am.
9. As a caretaker on a phone, I want the assistant to open as a bottom sheet over the current screen, so that I keep my place.
10. As a caretaker on a wide screen, I want it as a dialog, so that it doesn't stretch across the whole window.
11. As a keyboard user, I want to open the assistant, type, send and act on drafts without a mouse, so that I can use it fully.
12. As a screen reader user, I want new drafts and answers announced, so that I know when the assistant has responded.
13. As a caretaker, I want the button to stay out of the way of the tab bar and quick-add buttons, so that it doesn't cover anything I tap often.

### Quick actions

14. As a caretaker, I want to type "BP 130/85, pulse 72" and get one vital draft with both readings, so that I log a set of readings in one go.
15. As a caretaker, I want one request to make several drafts ("temp 100.4 and she's nauseous, a 3"), so that I don't split what I say.
16. As a caretaker, I want "note: slept badly, up twice" to become a note draft, so that I can jot something quickly.
17. As a caretaker, I want "PT visit at 2, went well" to become an event draft with a title and text, so that visits are logged as events.
18. As a caretaker, I want each draft to show its kind, values with units, and time, so that I can check it at a glance.
19. As a caretaker, I want numbers read in my units (°F, lb) and stored in the app's canonical units, so that "temp 101" means what I meant.
20. As a caretaker, I want an unusual value to carry the same "That's unusual. Double-check it" warning as the form, so that a misheard number stands out.
21. As a caretaker, I want an impossible value to be refused with the form's message, so that it never reaches the timeline.
22. As a caretaker, I want times like "at 9", "this morning" or "yesterday at 6pm" understood in my time zone, so that entries land on the right day.
23. As a caretaker, I want a request with no time to use the time I asked, so that "BP 130/85" means now.
24. As a caretaker, I want to save a draft with one tap, so that logging is fast.
25. As a caretaker, I want "Save all" when there are several drafts, so that a set of readings takes one tap.
26. As a caretaker, I want Edit to open the usual sheet already filled in, so that I can fix a draft with the controls I know.
27. As a caretaker, I want to discard a draft, so that a misunderstanding goes nowhere.
28. As a caretaker, I want to say "make that 135" right after, and get a corrected draft, so that I can fix it by talking.
29. As a caretaker, I want "change the last temperature to 9am" to find my recent entry and draft the change, so that I can correct the timeline without hunting for it.
30. As a caretaker, I want an edit draft to show the old and the new value, so that I see exactly what will change.
31. As a caretaker, I want the assistant to ask when a request is ambiguous ("which temperature: 8:10 or 11:30?"), so that it doesn't guess on health data.
32. As a caretaker, I want "add to today's note: ate half her lunch" to add a paragraph to that note, so that I can append to a note without opening it.
33. As a caretaker, I want saved drafts to appear on the timeline at once and sync to others, as form entries do, so that the assistant isn't a separate record.
34. As a caretaker, I want the assistant to say what it can't do yet ("I can't log medications yet") instead of making something up, so that I trust what it drafts.
35. As a viewer, I want quick actions not offered to me, so that I'm not shown drafts I can't save.
36. As a writer, I want edit drafts limited to entries I could edit in the app, so that the assistant never goes beyond my role.

### Voice

37. As a caretaker with my hands full, I want to tap the mic and speak, so that I don't type.
38. As a caretaker, I want to see that it's recording and how long, and stop with one tap, so that I'm in control of what's recorded.
39. As a caretaker, I want to see the transcript before the drafts, so that I can spot a misheard word.
40. As a caretaker, I want to edit the transcript and resend it, so that a mishearing doesn't mean re-recording.
41. As a caretaker, I want the browser or app to ask for the microphone only when I first tap the mic, so that permissions make sense.
42. As a caretaker who denied the microphone, I want a clear message and typing still available, so that I'm not stuck.
43. As a caretaker, I want recordings deleted once they're transcribed, so that my voice isn't kept anywhere.
44. As a caretaker, I want a cap on recording length, so that a forgotten recording doesn't run on.

### Offline

45. As a caretaker offline, I want to type or speak a request anyway, so that I can log in the moment without signal.
46. As a caretaker offline, I want to see that my request is waiting for a connection, so that I know it isn't lost.
47. As a caretaker, I want waiting requests processed when I'm back online, even if I've closed the sheet, so that I don't have to remember them.
48. As a caretaker, I want a badge on the assistant button when drafts are waiting, so that I come back to confirm them.
49. As a caretaker, I want waiting drafts to survive a reload or app restart, so that nothing is lost before I confirm it.
50. As a caretaker, I want each draft's default time to be when I asked, not when it synced, so that the timeline is right.
51. As a caretaker, I want to discard a waiting request before it's processed, so that I can take something back.
52. As a caretaker, I want waiting requests and drafts wiped when I sign out, so that the next person on the device sees none of it.
53. As a caretaker who signs in on another device, I want my waiting drafts to stay on the device where I made them, so that they're never synced as half-finished health data.

### Questions

54. As a caretaker, I want to ask "when did she last have a fever?" and get a direct answer with the date, so that I don't scroll.
55. As a caretaker, I want "how has her blood pressure been this week?" answered with the readings and a plain summary, so that I see the trend.
56. As a caretaker, I want "what did the cardiologist say last time?" answered from linked events and their notes, so that I can prepare for the next visit.
57. As a caretaker, I want every answer to link to the entries it used, so that I can check it.
58. As a caretaker, I want the assistant to say when it can't find something, rather than guess, so that I trust it.
59. As a caretaker, I want follow-up questions to use the conversation so far ("and the week before?"), so that I don't repeat myself.
60. As a viewer, I want to ask questions too, so that I can keep up without writing anything.
61. As any member, I want answers to use only what I can see in the app, so that the assistant never reveals more than my role allows.
62. As a caretaker, I want answers to stream in as they're written, so that I'm not staring at a spinner.
63. As a caretaker, I want to stop an answer that's going the wrong way, so that I can rephrase.
64. As a caretaker, I want questions to say they need a connection when I'm offline, so that I'm not left waiting.

### Saving answers

65. As a caretaker, I want "Save as note" on an answer, so that a useful summary becomes part of the record.
66. As a caretaker, I want to ask "summarize this week as a note" and get a note draft, so that I can share a summary with the family.
67. As a caretaker, I want a saved note to be a normal live document others can edit, so that it isn't special.
68. As a caretaker, I want to choose note or event and set the title before saving, so that it lands where it belongs.
69. As a caretaker (later), I want "plan questions for the cardiology visit" to make a visit plan linked to that provider, so that we walk in prepared.

### Attribution and limits

70. As a member, I want entries made through the assistant to show the person who confirmed them as the author, so that responsibility is clear.
71. As a member, I want a small "via assistant" marker on such entries' pages, so that I can judge them knowing how they were made.
72. As a caretaker, I want a clear message when I've reached today's limit, so that I know why it stopped and when it resets.
73. As the app's operator, I want usage counted per user per day (requests, audio seconds, tokens) without any content, so that I can track cost without storing health data.
74. As the app's operator, I want the daily limits configurable without a deploy, so that I can adjust them.

### Safety and privacy

75. As a member, I want the assistant to treat text inside entries as data, never as instructions, so that a note can't make it do something.
76. As a member, I want the assistant to have no way to delete entries, change roles or change settings, so that the worst a mistake can do is a wrong draft.
77. As a member, I want nothing I ask, and no answer, stored on the server, so that conversations don't become a second health record.
78. As a member, I want the AI and speech vendors to retain nothing and never train on our data, so that the promise on the privacy page holds.
79. As a developer, I want every tool the model can call to run through the services as the asking user, so that permissions are enforced in one place.

## Implementation Decisions

- **Depends on:**
  - **Quick actions, voice, offline:** nothing beyond what's in `dev` today: the shared Zod content schemas, the vitals spec and unit conversion, the device's local writes, and the edit sheet's route. Built on `components`' primitives if they've landed.
  - **Questions:** `search`'s **server side** (Postgres full-text search over titles, bodies and document text, callable as a service function in the actor's scope). Until then a question slice can't start.
  - **Provider tools:** `providers` (in `dev`). **Medication tools and dose actions:** `medications`, later.
- **Vendor and SDK:** Claude through the **official Anthropic TypeScript SDK** (`@anthropic-ai/sdk`), on the Messages API with the SDK's tool runner over tools we define. We host the loop. Not Managed Agents and not message threads: neither is eligible for zero data retention, which AGENTS.md's _Compliance_ section requires. **This replaces "the Vercel AI SDK with Claude" in AGENTS.md's stack**; update it when this PRD is planned. A new dependency: needs the user's approval at planning, pinned exactly.
- **Model:** **chosen by an eval**, not up front. The first slice builds a small eval set (fictional phrases and questions with expected drafts and facts) and compares `claude-opus-5-5` at low and medium effort with `claude-haiku-5-5` for parsing. The default until measured is Opus 5.5. The choice is a server config value, so changing it needs no client release. Refusals are handled (`stop_reason: "refusal"` shows "I can't help with that one").
- **Speech-to-text vendor:** ❓ open. Requirements: no retention, no training, a written agreement saying so, a TypeScript-friendly HTTP API, and good accuracy on numbers and medical words. Chosen in the voice slice; adds one vendor and probably one dependency. Behind a `transcribe(audio, { language }) → { text }` interface with `log` and `memory` fakes for dev and tests, like the planned notification senders.
- **A new server-only package for the assistant**, used by the API and nothing else. Its surface is small:
  - `parse({ actor, groupId, text, askedAt, timeZone, units, conversation }) → { drafts, reply }`: turns a request into drafts.
  - `answer({ actor, groupId, question, conversation }) → stream of { text | citation | draft }`: answers a question with read tools.
  - `transcribe(audio) → text`, through the vendor adapter.
  - Inside: the prompts, the tool definitions, the model client, refusal handling and usage recording. Nothing outside it knows which model or vendor is used.
- **Drafts are a client-safe shared type** (beside the other schemas): a discriminated union of
  - `createEntry`: a full timeline entry content (kind, title, details or text, `occurredAt`, `timeZone`), validated with the same content schemas the forms use;
  - `editEntry`: an entry id plus the changed fields, with the old values for display;
  - `appendToNote`: a note's or event's id plus text to add as new paragraphs.

  The server validates every draft before returning it and drops (with a reply line) any that fail; the device validates again before saving. Values come back in the user's display units with the unit named, and are converted with the existing `fromDisplay`. The union is open for later kinds (a medication dose, a visit plan).

- **Saving a draft** goes through the device's existing local writes (create, update, the note document's Yjs update for appends), so permissions, validation, offline behavior and sync are unchanged. Edit opens the existing add or edit sheet with the draft's values. An `appendToNote` adds paragraphs through the same Yjs path as typing, so it merges with anyone editing. "Save all" saves in order and stops at the first failure.
- **Edit recent:** the model finds entries through a read tool (`findEntries`: kind, a time window, newest first, default the last 48 hours, only entries the actor can update), and asks when more than one fits. Only symptoms, vitals, times, titles and note appends. **No delete action.**
- **Read tools for questions** (each a thin wrapper over a service call with the actor's context, returning compact JSON with entry ids):
  - `searchEntries` (text query, kinds, date range; from `search`);
  - `listEntries` (kind, date range, author; keyset-paged, capped);
  - `latestVitals` and `vitalSeries` (one type over a range, in the user's units);
  - `getEntry` (one entry with its document text);
  - `listProviders`, `providerEntries` (an entry's providers, a provider's entries);
  - later `listMedications`.

  Tool results carry entry ids; the answer cites them, and the client turns them into links through `appUrls`. Tools are read-only. A tool result is wrapped and labelled as data, and the system prompt says text inside entries is never an instruction. The worst a prompt injection in a note can do is shape an answer or a draft that a person still has to confirm.

- **API:** oRPC procedures under `assistant`: `parse`, `answer` (an event-iterator stream), `transcribe` (a file upload, size and duration capped) and `usage` (today's remaining). Each checks: signed in, a member of the group, the assistant on for the group, and the user's daily limit. `parse` and the draft-making parts of `answer` also require a writer role. A non-member gets a 404, a group with it off a 403, and a limit reached a 429 with when it resets.
- **Conversation state** is held by the client and sent with each request (bounded: the last few turns, trimmed). The server stores none of it. Prompt caching (a stable system prompt and tool list) keeps repeat turns cheap.
- **Consent and the group switch:** `care_group` gets `assistant_enabled_at`, `assistant_enabled_by` and `assistant_consent_version` (null when off). Only owners change them, through a service method that records who and when; turning it off clears them. They join the `care_groups` stream, so devices show or hide the button live. Each member's one-time notice is recorded in `user.preferences` (`assistantNoticeSeen`, a consent version), so no migration for that.
- **Attribution:** `timeline_entry` gets a nullable `created_via` (`assistant` | null), set by the device when it saves an assistant draft, synced, and shown as a small "via assistant" marker on the entry page. Edits through the assistant don't change it.
- **Usage limits:** a server-only `assistant_usage` table: `user_id`, `day` (UTC), `requests`, `audio_seconds`, `input_tokens`, `output_tokens`, and no content. Counters increment atomically before (requests, audio) and after (tokens) each call. Limits come from env (`ASSISTANT_DAILY_REQUESTS`, `ASSISTANT_DAILY_AUDIO_SECONDS`), so changing them needs a restart but no deploy of code. Logs carry ids and counts, never request or answer text.
- **Device:**
  - **Queue and drafts are local-only tables** in the PowerSync database (never uploaded or synced), so `disconnectAndClear` at sign-out wipes them with everything else. `assistant_request` (id, group, text or audio reference, asked at, time zone, status) and `assistant_draft` (id, request, group, the draft JSON, status). Audio blobs live in the device's file storage (OPFS on the web, the app's files in Capacitor), are deleted after transcription, and are cleared at sign-out with the database.
  - A **processor** runs when the device is online and signed in: oldest request first, transcribe if needed, `parse`, store drafts, mark done. Failures retry with backoff; a 403 (assistant turned off) or 404 drops the request with a note in the sheet.
  - **Recording** uses `MediaRecorder` (web and Capacitor's web view), capped at 2 minutes, with the elapsed time shown.
- **UI:**
  - `AssistantButton`: a floating button on group screens when the assistant is on, above the tab bar's height (`--tab-bar-height`) and clear of the timeline's quick-add bar, with a badge for waiting drafts. Hidden on the entry page (the editor needs the space), where the header's menu gets an "Ask the assistant" item instead.
  - `AssistantSheet`: a RAC Modal (a bottom sheet on phones, a dialog from `sm`) with the conversation, a text field, the mic button, and draft cards. A new group sheet route (`assistant`), so Back closes it and it can be deep-linked, following the routing PRD's sheet pattern.
  - `DraftCard`: kind icon and color from `KIND_META`, values with units, time, the unusual-value warning, and Save, Edit and Discard. Edit drafts show old → new.
  - Answers render as plain text with entry links; "Save as note" opens a small form (note or event, title) that makes a `createEntry` draft.
  - Live regions announce new drafts and the end of an answer.
- **Group settings:** an **Assistant** subpage (owners can change it; others see the state and who turned it on), with the consent text and a link to the privacy pages.
- **Registries (append only):** `PERMISSIONS` (`assistant_usage`: system only), `db/schema/index.ts`, `sync-config.yaml` (the new `care_group` and `timeline_entry` columns), the device schema (the two new columns and two local-only tables), the router, `routes.ts`, `appUrls`, the group settings registry. One migration for the PRD.

## Testing Decisions

- **What makes a good test here:** test what a caller sees (the drafts for a phrase, the facts in an answer, what a role is refused), never prompt wording or which tool was called in which order. The model is non-deterministic, so unit and integration tests never call it.
- **A fake model client** in the assistant package returns scripted responses (text, tool calls), so the loop, tool execution, permission checks, draft validation, refusal handling and usage counting are tested deterministically.
- **Unit tests (pure):** the draft schema and its validation (every kind, units, impossible and unusual values, edit drafts, appends); converting a draft to the local write's input; relative time resolution in a zone (DST, "yesterday at 6pm"); the queue processor's state machine with a fake clock and fake API.
- **Integration tests (test Postgres):** each read tool as each role and as a non-member (a viewer sees no more than in the app; a non-member gets nothing); the group switch (owner only, recorded, cleared); usage counters and the limit (concurrent requests don't overrun it); the procedures' 403, 404 and 429. Prior art: the services' `*.int.test.ts`, `router.int.test.ts`.
- **The eval (not in `pnpm check`):** a script that runs the real model over the fictional eval set and scores drafts (exact values, units, kinds, times) and answers (the expected facts and citations). It costs money, so it runs by hand: in the first slice to pick the model, and whenever the prompts or model change. Its set grows with every bug found.
- **Browser check** (`assistant.mjs`, with the model and transcription faked by a dev-only switch on the server so it's deterministic and free): turn it on as owner and the notice as a member; a typed quick action to a saved vital; several drafts and Save all; Edit opening the sheet filled in; an edit draft; offline queueing and the drafts after reconnect; viewer sees questions but no drafts; off hides the button; sign-out wipes the queue.

## Out of Scope

- Saving conversations, on the server or the device (beyond the offline queue and unconfirmed drafts).
- Deleting entries, changing settings, roles or memberships through the assistant.
- Actions on providers (adding or editing them) and medications; they're later additions to the draft union and tools.
- Visit plans (designed for: a `createEntry` event draft linked to providers, with the questions as its text; built later).
- Live, streaming voice (talking back and forth in real time), and spoken answers (text to speech).
- On-device speech recognition, and the browser's built-in speech recognition (it sends audio to a third party we have no agreement with).
- Embeddings or a vector store.
- Answers drawn from anything outside the group's own data (no web search, no medical advice beyond restating the record).
- Billing, plans and paid tiers; the daily caps stand in for them.
- Proactive suggestions (the assistant speaking first).

## Effects on other PRDs

These are the decisions this draft asks other PRDs to make now:

- **`search`:** its server side must be a service function (text, kinds, date range, author) that runs in the actor's scope and includes note and event document text, so the assistant can call it as a tool. Writing the search PRD first unblocks this one's question slices.
- **`medications`:** expose `listMedications` and dose history through services the assistant can wrap, and keep the "dose given" entry content a shared Zod schema, so "gave her 5 mg of X at 8" can become a draft later.
- **`providers`:** visit plans will be events linked to providers; nothing to change now.
- **`invites`:** the group switch's consent is a separate, recorded consent from the invite's; reuse the same consent-record pattern if invites defines one.
- **`marketing`:** the privacy page and the consumer health data notice must name the AI and speech vendors, what's sent, and that they keep nothing and don't train on it.
- **`components`:** the sheet, draft card and floating button should use its modal, card and button primitives; the floating button needs a place in the group layout that doesn't collide with the tab bar.
- **AGENTS.md:** the stack line changes from the Vercel AI SDK to the Anthropic SDK when this is planned.

## Further Notes

- **Order of slices (rough, for planning):** (1) the assistant package, the eval and model choice, `parse` with typed text, the group switch and limits; (2) the sheet, draft cards and saving; (3) edit recent and note appends; (4) voice; (5) the offline queue; (6) questions with read tools (after `search`); (7) Save as note and summaries.
- **Cost:** a typical quick action is one short call with a cached system prompt; a question is a few tool calls. The eval should report cost per request alongside accuracy, so the model choice weighs both.
- **Native:** `MediaRecorder` works in Capacitor's iOS and Android web views; the microphone permission strings go in the native projects when Capacitor is set up.
- **Open questions:** ❓ the speech vendor; ❓ whether `appendToNote` should also offer "new note" when no note exists for today; ❓ the daily limits' starting values; ❓ whether viewers should be able to save answers (they can't write entries today, so no, unless that changes).
