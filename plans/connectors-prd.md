# Connectors PRD (B-104)

Status: planned (2026-11-20). Plan: [`connectors-plan.md`](connectors-plan.md).

## Problem Statement

Caretakers already talk to their own AI assistants. They ask Claude or ChatGPT "what should I ask the neurologist on Friday?" or "has Mum's blood pressure been creeping up?", or say "log that she took her evening meds at 8". Today the assistant knows nothing about the care group, so the caretaker copies the timeline into the chat by hand and then types the answers back into Caretook. That's slow, the data drifts, and anything pasted into a chat sits outside our rules about who may see what. Quick entry (the `assistant` PRD) made logging fast on the device, but it deliberately sends nothing to any remote AI. There's no sanctioned way for a member to give an assistant they already use and trust a limited, revocable view of one group and let it write the same small things quick entry writes.

## Solution

A **remote MCP server** that a member adds to their own Claude (a custom connector) or ChatGPT (a developer-mode connector). Both speak standard MCP over Streamable HTTP with OAuth 2.1.

- **Connecting:** the member adds `https://caretook.com/mcp` in their assistant. The assistant registers itself (dynamic client registration) and sends them to Caretook to sign in. They land on **our consent page**, which lists the groups whose owners have turned connectors on. They pick **one** group and see what the assistant may do: read, or read and write, set by their role in that group. Then they tick the consent text. The token they get works for that group only. To connect a second group, they add a second connector.
- **Reading:** tools for the timeline (by day, kind or author, with note and event text), latest vitals, search (the existing query language), medications and what's due today, upcoming appointments, open tasks, providers, the group's members (names and roles only), and the recipient's **medical profile** (name, age, allergies and conditions; no contact details). Every read is capped and paged.
- **Writing:** one tool per **assistant action** (`logVital`, `logSymptom`, `logDose`, `givePass`, `addNote`, `addEvent`, `addTask`), the same shapes quick entry uses, carried out on the server through the services in one transaction. Write tools are marked as not read-only, so Claude and ChatGPT ask the user before each call. Each write answers with quick entry's preview wording and a link to the new entry. Nothing edits, deletes or completes: people do those in the app, and a wrong entry is deleted as usual.
- **Labelling:** an entry or task made this way is **authored by the member**, so permissions, filters and "who logged" are unchanged. It carries a small **"via Claude"** tag (the client's registered name) on the timeline, the entry page and the task page.
- **Owners decide:** a new group setting, **Assistants**, is **off until an owner turns it on**. Turning it off disconnects every member's assistant at once.
- **Managing:** each member sees and disconnects their own connections on **Settings → Devices** (client name, group, scope, connected and last used). Owners and admins see every member's connection to their group on the group's **Assistants** page, and can disconnect any of them.
- **Privacy:** the privacy page and FAQ say plainly that connecting sends the group's data to the AI vendor the member chose, under that vendor's terms, and how to disconnect.
- **Online only.** Siri and Alexa are out; dictation covers voice.

## User Stories

**Owners and the group setting**

1. As an owner, I want connectors off for my group until I turn them on, so that no member can send our care data to an AI vendor before I've decided.
2. As an owner, I want one switch on the group's Assistants page, explained in plain words (data goes to the vendor the member picks), so that I can decide quickly and knowingly.
3. As an owner, I want turning the switch off to disconnect every member's assistant immediately, so that I can stop all outside access in one step.
4. As an owner, I want turning it back on to restore nothing, so that each member has to reconnect and consent again.
5. As an owner or admin, I want to see each member's connected assistants (member, client name, scope, connected, last used), so that I know what has access to the group.
6. As an owner or admin, I want to disconnect any member's assistant from the group, so that I can remove access I don't trust without turning the feature off for everyone.
7. As a caretaker or viewer, I want the Assistants page to tell me whether the group allows assistants and to link to my own connections, so that I know why I can't connect.

**Connecting**

8. As a member, I want to add Caretook to Claude or ChatGPT with one URL, so that setup takes a minute.
9. As a member, I want to sign in on Caretook's own pages (password or email), so that my password never goes to the assistant.
10. As a member, I want the consent page to name the assistant and the site it will return to, so that I know what I'm approving.
11. As a member, I want to choose exactly one group on the consent page, from the groups that allow assistants, so that the assistant sees only that group.
12. As a member of no group that allows assistants, I want a clear explanation (ask an owner to turn Assistants on), so that I'm not left at a dead end.
13. As a viewer, I want to connect for reading only, so that I can still ask my assistant about the timeline.
14. As a caretaker, admin or owner, I want to grant read and write, or read only if I prefer, so that I choose what my assistant may do.
15. As a member, I want to tick a consent statement saying the group's data goes to my chosen AI vendor, so that I agree knowingly, and so that the group has a record of it.
16. As a member, I want to cancel on the consent page and have nothing connected, so that backing out is safe.

**Reading through my assistant**

17. As a caretaker, I want my assistant to read recent timeline entries, filtered by day range, kind or author, with notes' and events' text, so that it can summarise how the week went.
18. As a caretaker, I want it to read the latest vitals, so that it can answer "what was her last blood pressure?".
19. As a caretaker, I want it to search with the app's query language, so that it can find things like "all falls since June".
20. As a caretaker, I want it to read the medication list (current and past) and today's passes and doses, with what's due or missed, so that it can tell me what's left to give.
21. As a caretaker, I want it to read upcoming appointments, open tasks and the provider directory, so that it can help plan visits and errands.
22. As a caretaker, I want it to read the recipient's medical profile (name, age, allergies, conditions), so that its answers account for them.
23. As a member, I want contact details (members' emails and phones, emergency contacts) never sent to my assistant, so that other people's details stay in the app.
24. As a member, I want times in answers to be in the recipient's time zone, with the zone named, so that "8 pm" means the same thing in the chat as in the app.
25. As a member, I want large reads to come in pages, so that one question can't pull years of history at once.

**Writing through my assistant**

26. As a caretaker, I want my assistant to log vitals, symptoms, doses, a pass's "given all", notes, events and tasks, so that I can say what happened in my own words and have it recorded.
27. As a caretaker, I want my assistant to ask me before each write, so that nothing is recorded that I didn't approve.
28. As a caretaker, I want each write to answer with the same wording quick entry would show ("Blood pressure 130/85 · 8:05 pm") and a link to the entry, so that I can check it at a glance.
29. As a caretaker, I want a write the app would refuse (a future dose, a stopped medication, a blood pressure in the wrong order) refused with a reason the assistant can fix, so that bad data never lands.
30. As a caretaker, I want several actions in one request to land together or not at all, so that a half-logged evening never happens.
31. As a member of the group, I want entries made through an assistant to show "via Claude" (or the client's name), so that I know how they got there.
32. As a member, I want such an entry authored by the person who connected the assistant, so that the author filter, day summaries and permissions work as usual.
33. As a member, I want to delete a wrong assistant entry as I would any entry, so that there's nothing new to learn.
34. As a viewer, I want write tools absent from my assistant's tool list, so that it doesn't offer things it can't do.
35. As a caretaker demoted to viewer, I want my assistant's writes refused from that moment, so that role changes apply at once.

**Managing my connections**

36. As a member, I want Settings → Devices to list my connected assistants (client name, group, scope, connected, last used), so that I can see what has access.
37. As a member, I want to disconnect one behind a confirmation, so that its tokens stop working at once.
38. As a member removed from a group, or leaving it, I want my assistants' access to that group to end with my membership, so that no access is left behind.
39. As a member who deletes their account, I want every connection deleted with it.

**Privacy and trust**

40. As a visitor, I want the privacy page and FAQ to explain connectors (what's sent, to whom, under whose terms, how to stop), so that I can trust the promise that no data goes anywhere I didn't choose.
41. As the operator, I want no log of what an assistant read, only the consent, the connection and its last-used time, so that we don't keep a second copy of what the vendor saw.
42. As the operator, I want each connection limited to a sensible rate (60 calls a minute), so that a looping assistant can't hammer the database.

## Implementation Decisions

- **Dependencies (approved 2026-11-20):** `@better-auth/oauth-provider` pinned at `1.7.25`, matching `better-auth` (its own deps `zod` and `jose` are already in the tree). **No MCP SDK:** the protocol is a small hand-written module.
- **OAuth:** the plugin in `packages/auth` provides OAuth 2.1 authorization code with PKCE (S256 only), dynamic client registration (public clients, as Claude and ChatGPT register), refresh tokens (rotating), revocation, and authorization-server metadata. Its tables join `db/schema/auth/` under the auth table exceptions (no audits, date-mode timestamps, `system`-only permissions). Scopes: `group:read` and `group:write` (no `openid` needed). Access tokens are short-lived (1 h), refresh tokens 30 days. Discovery: `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource` (RFC 9728; `resource` = `${APP_URL}/mcp`, `authorization_servers` = our issuer) as web-only resource routes. The login step reuses `/sign-in?redirectTo=…` (checked by `safeRedirect`). The consent step is ours (below).
- **The grant** (`connector_grant`, area `connectors`): `user_id`, `group_id`, `oauth_client_id`, `client_name` (from registration, trimmed to 40 characters, and shown as text only), `redirect_host`, `scope` (`read` | `readWrite`), `consent_version`, `consented_at`, `last_used_at`, `revoked_at`, timestamps and audits. One live grant per user and client. Permissions: read for self, and for owners and admins of the group; delete (revoke) for self, owners and admins; create and update for `system` only (the service writes them).
- **`connectorGrantService`** (deep module): `grant(ctx, { clientId, groupId, scope })` checks that the group's switch is on, that the actor is a member, and that `readWrite` needs a writer role; it records the consent (`CONNECTOR_CONSENT_TEXT`/`CONNECTOR_CONSENT_VERSION`, pure and client-safe like `inviteRules`). `verify(accessToken)` → `{ authUser, groupId, scopes, grantId }`, or an error: it validates the token through the plugin, loads the live grant, **re-checks the membership, the current role (a viewer's grant is read only, whatever was granted) and the group's switch on every call**, and stamps `last_used_at` (at most once a minute). `revoke(ctx, grantId)` marks it revoked and revokes the client's tokens for that user. `listMine(ctx)` and `listForGroup(ctx, groupId)` return no tokens. Membership removal and leaving revoke the member's grants for that group in the same transaction; account deletion cascades.
- **The group switch:** `care_group.connectors_enabled` (boolean, default false), synced. `careGroupService.update` accepts it **from owners only**. Turning it off revokes every grant for the group in the same transaction. Turning it on restores nothing.
- **Entry source:** a nullable `via` text column on `timeline_entry` and `task` (the grant's client name at write time, kept after a revoke), synced through both streams. Only the server's assistant runner sets it; the upload switch ignores any `via` a device sends. The tag ("via Claude", `data-via`) sits in the entry header region, the timeline row and card, and the task row and page.
- **The server runner** (`assistantActionService.run(ctx, groupId, actions, { via })`, deep): the server twin of `runActions`. It validates the **whole batch** first (the action schemas, `futureRefusal` against the server's now, the writer role, live medications, passes and providers in the group), then writes it in **one transaction** through `timelineEntryService`, `noteDocumentService` (a note's or event's document from `noteDocFromText`, compacted), `entryProviderService`, the dose and pass writes, and `taskService`. It returns `{ ids, byAction }`, or `{ ok: false, index, error, issues }` and writes nothing.
- **Pure core moves to `@caretook/data/schema`** so the server and the device share it: `dueDoses`, `duePasses`, `givenAllWrites` and the preview wording (`actionPreview`, `whenText`) leave `apps/web/app/lib/` (the web modules re-export from their new home, or call sites switch), with their unit tests. Behaviour doesn't change.
- **The MCP module** (`packages/api/src/connectors/`, deep and pure apart from its tools): `handleMcp(message, ctx, registry)` handles JSON-RPC 2.0 `initialize` (protocol version negotiation; `tools` capability only), `notifications/initialized`, `ping`, `tools/list` (filtered by the grant's effective scopes) and `tools/call`. Batches, unknown methods and bad params get the right JSON-RPC errors. It's stateless: no sessions, no SSE, and POST answers with `application/json`. The **tool registry** entries are `{ name, title, description, scope, input (Zod), annotations, handler }`. `tools/list` emits each input as JSON Schema through Zod 4's `z.toJSONSchema`. Read tools are `readOnlyHint: true`, write tools `readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false`. A tool failure (a refused action, a not-found) is a **result with `isError: true`**, carrying the error code, a plain message and the Zod issues, so the model can correct itself; only protocol faults are JSON-RPC errors. Results give a short text rendering plus `structuredContent`.
- **The `/mcp` route** (web only, a resource route in the connectors area's `routes.ts`): POST only (GET answers 405, so clients don't expect SSE). No bearer token, or a bad one, answers 401 with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"`; a missing scope answers 403 `insufficient_scope`. It's rate limited per grant through `createRateLimiter` (60 a minute, `defaultStore("connector")`), with 429 and `Retry-After` over it. No CORS (the clients call server to server). Logging follows the api rules: codes and the `procedure` (tool name), `actorId`, `groupId` fields only, never arguments or results. `deployEnvRefusal` applies.
- **Read tools** (each in the actor's scope, through the existing services; `groupId` always comes from the grant, never from the input):
  - `group_overview` (group name, the recipient's preferred name, time zone, the member's role and scope, the units preference, members' names and roles);
  - `list_timeline` (`from`/`to` within 90 days by default, `kinds`, `authorId`, cursor; at most 50 per page; notes and events with their compacted text);
  - `latest_vitals`;
  - `search` (`searchService`, the query language, at most 25);
  - `list_medications` (current, or with past);
  - `todays_doses` (passes and slots with their state, from the moved due-doses core);
  - `upcoming` (future events, 30 days by default, 90 at most);
  - `list_tasks` (open by default);
  - `list_providers`;
  - `recipient_profile` (preferred name, age (not the full date of birth), allergies, conditions).

  Times are ISO 8601 with the recipient's offset, plus the zone name in the overview. **Never returned:** emails, phone numbers, addresses of members or emergency contacts, invite or access-code data.

- **Write tools:** `log_vitals`, `log_symptom`, `log_dose`, `give_pass`, `add_note`, `add_event`, `add_task`, each taking its action's schema minus `type`, and each a batch of one through the server runner with `via` set. They answer with the preview line(s) and the entry's (or task's) URL from `appUrls`. Vitals take the canonical units the action schema uses, and the descriptions say which.
- **Screens:**
  - `/connect` (web only, the consent step the plugin redirects to; a server loader is allowed): the client name and redirect host, the group picker (only groups with the switch on), scope radios by role (`ChoiceGroup`), the consent text with a required checkbox, then Connect or Cancel. Sign-in comes first if needed.
  - **Settings → Devices** gains a "Connected assistants" section through `connector.listMine` and `connector.revoke` (oRPC) behind a `ConfirmDialog`, online only.
  - **Group settings** gets an **Assistants** subpage (its own registry entry in the group settings list): the owners' switch (with a confirm when turning it off), the group's grants for owners and admins with Disconnect, and the read-only status for others. oRPC: `connector.listMine`, `connector.revoke`, `connector.listForGroup`; the switch goes through `careGroup.update({ connectorsEnabled })`.
- **Privacy:** a "Connecting your own AI assistant" section on `/privacy` and `/health-data-privacy`, plus an FAQ entry. The DRAFT banner stays.
- **Registries:** the connectors area's own parts: `db/schema/connectors/`, `permissions/connectors.ts`, `errors/connectors.ts`, `packages/api/src/connectors/`, `routes/…/connectors/routes.ts`, `lib/connectors/urls.ts`, `scripts/loops/check-areas.d/connectors`. Additive edits to the shared ones (the sync config, the device schema, `GROUP_SETTINGS`, `routerPaths.test.ts`, `routes.test.ts`, the schema index test).
- **One migration for the PRD** (slice 2): the plugin's tables, `connector_grant`, `care_group.connectors_enabled`, and `via` on `timeline_entry` and `task`.

## Testing Decisions

Good tests here check behaviour at a module's edge (a JSON-RPC message in, a response out; an action batch in, rows or a refusal out), never the internals. They follow `docs/loops.md`, _Browser check budget_.

- **Unit:**
  - the MCP module: a table of JSON-RPC requests and their responses (initialize and version negotiation, ping, list filtered by scope, call success, `isError` results, unknown method, bad params, a notification gets no reply);
  - the registry's JSON Schema output for every tool;
  - the consent rules (`CONNECTOR_CONSENT_*`, scope allowed by role);
  - the moved due-doses core and preview wording (their existing tests move with them, unchanged).
- **Integration** (the shared test Postgres):
  - `assistantActionService.run`: every action, every refusal, rollback of a whole batch, `via` stored, and each role;
  - `connectorGrantService`: grant (switch off, non-member, viewer asking for write), verify (revoked, expired, demoted, removed, switch off), revoke, `listMine`/`listForGroup` scoping, removal and leaving revoke, account deletion cascades;
  - the OAuth dance in process against `createAuth`: register, authorize, the consent step, code for token with PKCE, refresh, revocation, both metadata documents;
  - every tool through the `/mcp` handler with a real token, including that no contact field is ever returned;
  - the rate limit;
  - the upload switch ignoring `via`.
- **Component:** the `/connect` page (the picker, scope by role, the required consent, Cancel, no eligible groups), the Devices section, the group Assistants page (an owner's switch and its confirm, an admin's list and revoke, a caretaker's read-only view), and the `via` tag on a row, a card, the entry page and the task page.
- **End to end (no new check):** one step in `roundtrip`. A write through `/mcp` with a token made by a test helper reaches device A as an entry showing "via <name>". It covers the server write, the `via` column in the stream, and the device's display. The real OAuth browser dance stays an integration test plus the consent page's component test.
- **Manual, at going live:** connect real Claude and ChatGPT once each on staging (read, write, disconnect), added to the hosting runbook's checklist.
- Prior art: `invites` (consent text and attestation, integration tests of a token flow), `sync.upload`'s tests (`syncTasks.int.test.ts`), `quickEntry.sync.ts`'s runner tests, the Devices page's component tests.

## Out of Scope

- Edit, delete, complete or cancel through an assistant (later actions such as `completeTask` can follow the same shape).
- ChatGPT Apps SDK widgets or any custom UI inside the chat.
- Our own remote AI (summaries, chat in the app), on-device models, Siri, Alexa.
- A per-call log of tool use, and showing owners what was read.
- One token across several groups, and staff access through connectors.
- Native (Capacitor) consent flows: the OAuth pages are web only.
- MCP resources, prompts, sampling, SSE streams and sessions.

## Further Notes

- **Running beside `timeline-ux`:** it's hot on the row components, `DayHeader`, the entry header, `packages/auth` and `packages/api/src/procedures.ts`. The `via` tag and the plugin wiring land after its matching slices are in `dev`, or coordinate through the entry header region (the plan's _How to run_).
- **Client names come from the client.** Dynamic registration lets any client call itself "Claude", so the consent page also shows the redirect host, and the tag says "via <name>", not that the entry was verified.
- **Vendor terms:** we don't check which vendor plan a member uses (whether it trains on chats). The privacy text says the vendor's terms apply and points to their settings.
- **The hosting runbook** gains the manual connector check and `/mcp` in the smoke list (401 without a token) at landing.
