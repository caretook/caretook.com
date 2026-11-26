# Connectors (a member's own Claude or ChatGPT, over MCP)

PRDs: [`connectors-prd.md`](../../plans/connectors-prd.md), [`connectors-2-prd.md`](../../plans/connectors-2-prd.md). A member connects their own assistant to **one care group**: it reads what they see and writes by quick entry's rules. **No MCP SDK**. **Web only:** `/mcp`, `/connect` (a server loader) and `/.well-known/` (`routes/connectors/routes.ts`).

## OAuth (`packages/auth/src/connectors.ts`)

- `@better-auth/oauth-provider` (`1.7.25`): PKCE S256, open dynamic registration of public clients, scopes `group:read`, `group:write`, `offline_access`; 1 h access, 30-day rotating refresh. A replayed refresh token or code revokes the family.
- **Opaque tokens** (`disableJwtPlugin: true`): revocable. The resource is `${BETTER_AUTH_URL}/mcp`.
- `CONNECTOR_DISABLED_PATHS` turns off client and consent admin, userinfo and end-session; `clientPrivileges` and `resourcePrivileges` refuse everything; introspect stays. The `caretook-connectors` plugin's `SERVER_ONLY` endpoints (`/connector/verify-token`, `/connector/check-query`) are 404 over HTTP.
- The plugin's 7 tables are in `db/schema/auth/oauth.ts`, under the auth table exceptions. `personalAccess.ts` excludes tokens and `oauth_client.client_secret`.

## Consent (`/connect`)

- Authorize sends to `/connect?…&sig=…` (signed, 10 minutes); signed out, to `/sign-in?redirectTo=…`. **It reads the session live** (`getAuthUser(…, { live: true })`): it mints 30-day tokens. A browser's dead end (error redirect, 4xx, 429) gets an HTML page (`withConnectorAuthorizePage`); other requests keep JSON.
- `ConnectConsent.tsx`: client and redirect host, groups with the switch on, scope by role, the consent checkbox (`CONNECTOR_CONSENT_TEXT`, `_VERSION`), Connect, Cancel. With none on: the off groups, the ask button for non-owners, Assistants' link for owners.
- **Success:** Connect returns `{ connected }` (Cancel redirects): "Connected to <group>", three examples, "Return to <client>". **Needs JS:** CSP `form-action 'self'` blocks a cross-origin 302, so it's `window.location`.

## Grants (`connector_grant`, `connectorGrantService`)

- One grant binds a token to one group (`scope` `read|readWrite`, `consent_version`, `revoked_at`). One live grant per user and client; a new one ends the old one's tokens.
- `PERMISSIONS.connector_grant`: read, delete for the member, owners, admins; create, update for `system`.
- **`verify(token)` is the only way into `/mcp`.** Each call rechecks account, membership, role (`scopesForRole`: viewers read, easy roles none), the switch and read only; token scopes narrow it (`effectiveScope`). It returns the member with `roleNames: ["member"]` and stamps `last_used_at` at most once a minute. `groupId` comes from the grant, never tool input.
- `revoke` ends the tokens and the `oauth_consent` row. `revokeForMember` runs in `careGroupMemberService.remove` (and `leave`).
- **The switch** `care_group.connectors_enabled` (default off; Dev Family on): owners only, via `careGroupService.update`. Off revokes every grant; on restores nothing.
- **Read only** `connectors_read_only` (synced): owners only, survives the switch, revokes nothing. `verify` narrows each call; grants keep their scope, so switching back restores it. A blocked write: `mcp:groupReadOnly`, not a 403. Labels follow the synced value; only `readOnlyByOwner` names the owner.

## Asking owners (`assistant_request`, `assistantRequestService`)

- Cascades from the group and the membership. Not synced. Read: the member, owners, admins; writes `system`.
- `request`: not owners (`owner`), not while on (`alreadyOn`). Within 7 days it returns the last ask (`created: false`). Else, membership locked, the row plus `assistantsRequested` to each owner (names only), then `deliverSoon`.
- oRPC `connector.requestEnable`, `myRequest`. The button (`components/connectors/ask/`) sits under the off note.

## `/mcp` (`packages/api/src/connectors/`)

- `protocol.ts` (`handleMcp`, pure): stateless JSON-RPC over POST. `initialize` (2025-11-25 down to 2024-11-05; `tools`, `prompts`), notifications get 202, `ping`, `tools/list` and `prompts/list` filtered by scope, `tools/call`, `prompts/get` (an unknown, out-of-scope or invalid one is -32602). Batches and non-2.0 messages are -32600. **Tool failures are `isError: true` results** (code, message, issues); only protocol faults are JSON-RPC errors; a server fault is a 500.
- `http.ts` (`createMcpHandler`): GET 405; a foreign `Origin` refused; no or a bad token 401 with `WWW-Authenticate: Bearer resource_metadata=…`; a write on a read grant 403 `insufficient_scope`; 60 calls a minute per grant, then 429 (`Retry-After: 60`). Logs: code, `mcp.<tool>`, actor, group only.
- `registry.ts`: `defineTool`, inputs by `z.toJSONSchema`. Reads `readOnlyHint: true`; writes `WRITE_ANNOTATIONS` (all false), so clients confirm each. `tools/index.ts` lists them, reads then writes.
- `prompts.ts`: `definePrompt` (Zod string arguments, rendered to one user message naming the tools; reads nothing), `CONNECTOR_PROMPTS`: `catch_me_up` (`since`), `prepare_for_event` (`event`), `weekly_summary`, `log_what_happened` (`account`, write only). The instructions point at them.

## Tools

- **Reads:** `group_overview`, `list_timeline` (day, kind, author; 90 days; changes via `changeText`/`conditionChangeText`), `latest_vitals`, `search` (≤ 25; no todos), `list_medications` (`includePast`; `type`), `todays_doses` (`dueDoses`, `duePasses`: agrees with Today; each pass's `passId` is `give_pass`'s), `upcoming` ("Upcoming events and todos": 30 days, 90 max; below), `list_todos` (open; done 90 days back; `mine`; `todos`, each with `repeats` from `todoRepeatText`, `eventId` (first linked event), `linkedEntryIds` (live ones; `linkedEntriesOf`), `parentId`; no "task" in descriptions), `list_providers`, `recipient_profile` (`conditions` with ids by `sortConditions`, `noKnownConditions`; providers by name). Pages of 50. Times carry the recipient's offset (`zonedIso`).
  - **`upcoming`** gives events plus open todos with a due day, from overdue through the window's last day (recipient's days): overdue todos first, then by day (all-day or untimed before timed), then time. Items are `kind: "event"` or `kind: "todo"` (`id`, `title`, `dueOn`, `dueTime`, `overdue`, `assignee {id, name}`, `repeats`). No notes, done or undated todos. Its description points to `todays_doses` for doses.
- **Never returned:** members', the recipient's and emergency contacts' emails, phones and addresses; invite and access-code data; the date of birth (age only); `rxNumber`, quantity; a provider's email, or more than name, role and status for an "other" provider. A sweep test guards this.
- **Writes** (`tools/writes.ts`): `log_vitals` (canonical units), `log_symptom` (an exact catalog match's spelling, else adds it), `log_dose`, `give_pass`, `add_note`, `add_event`, `add_todo`, `append_to_entry`, `update_entry`, `add_condition`, `update_condition`, `resolve_condition`. Each runs through **`assistantActionService.run(ctx, groupId, actions, { via })`**, `runActions`' server twin: one transaction, all checked first (schemas, skew, writer role, live medications, providers, passes), errors with `meta.index`. `add_note` takes `providerIds` (`noteDocFromText`; `providerGone` outside the group). `add_todo` takes an assignee's name, returns `todoId`. `log_dose` takes a scheduled slot's id: a repeat (same status, amount, note or none) answers "Already logged, nothing added".
  - **Notes are for what has happened:** `add_note`, `update_entry` and `append_to_entry` refuse a note ahead with "A note can't be in the future. Use add_todo with a due day for something to do later." (from `FUTURE_DATE_MESSAGE`); `append_to_entry` also refuses a stored future note. Descriptions say so. `add_todo` drops a `repeatRule` (B-253). They say "event" (`add_event` "Add an event"; no aliases); the consent text still says appointments (the user's call).
  - Answers use quick entry's `actionPreview` wording and a link (`links.ts`, kept equal to `appUrls` by a test).
- **Edits and conditions** are server-only kinds (`runnableActionZSchema`). `append_to_entry` (≤ 50 lines, 5,000 chars): a live note or event, one `note_update` as the member (`appendNoteSection`), compacted at once. `update_entry`: title, time (the end follows; a series visit detaches). Conditions use `recipientConditionService` (no provider links). Refused: deleted (`entryDeleted`, `conditionDeleted`), symptoms, vitals, doses (`notEditable`); another group's id is `entryNotFound`/`conditionNotFound`. Edits set no `via`.

## The "via" tag

- `timeline_entry.via`, `todo.via` (condition changes too) come only from the grant's `client_name`: `create(…, { via })` is server-only, create schemas strip it, it's `SYSTEM_ONLY` on update, uploads drop it.
- `ui/ViaTag` shows in `EntryBody`'s and a card's footer, `EntryHeader`'s time line, the todo row and `TodoHeader`.

## Managing connections

- oRPC (`connectors/connector.ts`): `connector.listMine`, `listForGroup` (owners and admins; 404 non-members), `revoke`; `careGroup.update` takes `connectorsEnabled`. Nothing returns a token.
- **Group settings → Assistants**: owners get the switch; owners and admins the group's connections with Disconnect; others the status from local data. Online only.
- **Settings → Devices:** "Connected assistants" after the sessions, Disconnect behind a `ConfirmDialog`.
- **The connect guide** (`components/connectors/ConnectGuide`; wording in `lib/connectors/connectGuide.ts`): the `/mcp` URL with Copy, steps and help links for Claude and ChatGPT; on Assistants and Devices. Off, viewers: notes; none when every group's role is easy.

## Tests

- `testing.ts`: `connectAssistant` runs the whole OAuth flow in process for real tokens; `/mcp` calls go through `mcpPost`, `callTool`, `toolResultOf`, `textOf`. Trims are tested here and via sync upload, not per router.
- Browser checks mint a token (`mintToken.ts <email> <groupId> [clientName]`); `roundtrip` writes through `/mcp`.
- By hand before launch: connect from Claude and ChatGPT, and check the guide's vendor steps and links ([runbook](../../ops/runbook.md)).
