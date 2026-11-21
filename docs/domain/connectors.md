# Connectors (a member's own Claude or ChatGPT, over MCP)

PRDs: [`connectors-prd.md`](../../plans/connectors-prd.md) (B-104), [`connectors-2-prd.md`](../../plans/connectors-2-prd.md) (B-193–B-197, B-204). A member connects their own assistant to **one care group**: it reads what they can see and writes through quick entry's rules. **No MCP SDK** (a hand-written protocol). **Web only:** `/mcp`, `/connect` (a server loader) and `/.well-known/` (`routes/connectors/routes.ts`).

## OAuth (`packages/auth/src/connectors.ts`)

- `@better-auth/oauth-provider` (`1.7.25`): PKCE S256, open dynamic registration of public clients, scopes `group:read`, `group:write`, `offline_access`; 1 h access, 30-day rotating refresh tokens. A replayed refresh token or reused code revokes the family.
- **Opaque tokens** (`disableJwtPlugin: true`): revocable, and the `jwt` plugin stays PowerSync's. The resource is `${BETTER_AUTH_URL}/mcp`; the issuer `${APP_URL}/api/auth`.
- `CONNECTOR_DISABLED_PATHS` turns off client and consent admin, userinfo and end-session; `clientPrivileges` and `resourcePrivileges` refuse everything; introspect stays. The `caretook-connectors` plugin's `SERVER_ONLY` endpoints (`/connector/verify-token`, `/connector/check-query`) are 404 over HTTP.
- The plugin's 7 tables are in `db/schema/auth/oauth.ts`, under the auth table exceptions. `personalAccess.ts` excludes the access and refresh tokens and `oauth_client.client_secret`.
- B-140's `/token` before-hook matches `/token` exactly, so `/oauth2/*` is never caught.

## Consent (`/connect`)

- Authorize sends to `/connect?…&sig=…` (signed, 10 minutes); signed out, to `/sign-in?redirectTo=…`. **It reads the session live** (`getAuthUser(…, { live: true })`): it mints 30-day tokens. A browser navigation's dead end (error redirect, 4xx, 429) gets an HTML page (`withConnectorAuthorizePage`, `connectorAuthorize.ts`); other requests keep JSON.
- `ConnectConsent.tsx`: client and redirect host, groups with the switch on, scope by role, the consent checkbox (`CONNECTOR_CONSENT_TEXT`, which lists todos; `_VERSION` "2026-11-21"), Connect, Cancel. With none on: the off groups (`offGroups`), the ask button for non-owners, Assistants' link for owners.
- **Success:** Connect returns `{ connected }` (Cancel redirects): "Connected to <group>", three examples (`lib/connectors/connectSuccess.ts`), "Return to <client>", auto-return after 5 s. **Needs JS:** CSP `form-action 'self'` blocks a cross-origin 302, so it's `window.location`. Server side: `packages/api/src/connectors/connect.ts`.

## Grants (`connector_grant`, `connectorGrantService`)

- One grant binds a token to one group (`client_name` ≤ 40, `redirect_host`, `scope` `read|readWrite`, `consent_version`, `last_used_at`, `revoked_at`). One live grant per user and client; a new one ends the old one's tokens.
- `PERMISSIONS.connector_grant`: read and delete for the member and the group's owners and admins; create and update for `system`.
- **`verify(token)` is the only way into `/mcp`.** Each call rechecks the account, membership, current role (viewers read only) and the switch; token scopes narrow it (`effectiveScope`). It returns the member with `roleNames: ["member"]` (no staff powers) and stamps `last_used_at` once a minute at most. `groupId` comes from the grant, never tool input.
- `revoke` ends the tokens and the `oauth_consent` row (the next authorize returns to `/connect`). `revokeForMember` runs in `careGroupMemberService.remove` (and `leave`); account deletion cascades.
- **The switch** `care_group.connectors_enabled` (default off; Dev Family seeded on): owners only, through `careGroupService.update`. Off revokes every grant in the same transaction; on restores nothing.

## Asking owners (`assistant_request`, `assistantRequestService`)

- Cascades from the group and the membership. Not synced. Read: the member, owners, admins; writes `system`.
- `request`: not owners (`owner`), not while on (`alreadyOn`). Within 7 days it returns the last ask (`created: false`). Else, membership locked `FOR UPDATE`, the row plus `assistantsRequested` to each owner (key `…:<requestId>:<ownerId>`; names only), then `deliverSoon`.
- oRPC `connector.requestEnable`, `myRequest`. The button (`components/connectors/ask/`, a light index for `/connect`) sits under the off note; "Asked on <date>" for a week.

## `/mcp` (`packages/api/src/connectors/`)

- `protocol.ts` (`handleMcp`, pure): stateless JSON-RPC over POST. `initialize` (versions 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05; `tools` and `prompts`), notifications get 202, `ping`, `tools/list` and `prompts/list` filtered by scope, `tools/call`, `prompts/get` (an unknown, out-of-scope or invalid prompt is -32602). Batches and non-2.0 messages are -32600. **Tool failures are `isError: true` results** (code, message, issues); only protocol faults are JSON-RPC errors; a server fault is a 500.
- `http.ts` (`createMcpHandler`): GET 405; a foreign `Origin` refused; no or a bad token 401 with `WWW-Authenticate: Bearer resource_metadata=…`; a write on a read grant 403 `insufficient_scope`; 60 calls a minute per grant, then 429 (`Retry-After: 60`). Logs carry only code, `mcp.<tool>`, actor and group. Options: `now`, `appOrigin`, `prompts`.
- `registry.ts`: `defineTool`, inputs by `z.toJSONSchema`. Reads `readOnlyHint: true`; writes `WRITE_ANNOTATIONS` (all hints false), so clients confirm each write. `tools/index.ts` lists them, reads then writes; a new tool adds a line at the end of its group.
- `prompts.ts`: `definePrompt` (Zod string arguments, a render to one user message naming the tools; prompts read nothing), `CONNECTOR_PROMPTS`: `catch_me_up` (`since`), `prepare_for_appointment` (`appointment`), `weekly_summary`, `log_what_happened` (`account`, write only). The instructions point at them.

## Tools

- **Reads:** `group_overview`, `list_timeline` (day, kind, author; 90 days; changes as `changeText`/`conditionChangeText` before → after), `latest_vitals`, `search` (≤ 25; no todos), `list_medications` (`includePast`; `type`), `todays_doses` (`dueDoses`, `duePasses`: agrees with Today), `upcoming` (30 days, 90 max), `list_todos` (open; done 90 days back; `mine`; structured `todos`), `list_providers`, `recipient_profile` (`conditions` with ids by `sortConditions`, `noKnownConditions`; providers by name). Entries carry ids. Lists page at 50 (`readSupport.ts`). Times carry the recipient's offset (`zonedIso`).
- **Never returned:** members', the recipient's and emergency contacts' emails, phones and addresses; invite and access-code data; the date of birth (age only); `rxNumber`, quantity; a provider's email, or more than name, role and status for an "other" provider. A sweep test (`readTools.int.test.ts`) guards this.
- **Writes** (`tools/writes.ts`): `log_vitals` (canonical units), `log_symptom`, `log_dose`, `give_pass`, `add_note`, `add_event`, `add_todo`, `append_to_entry`, `update_entry`, `add_condition`, `update_condition`, `resolve_condition`. Each runs through **`assistantActionService.run(ctx, groupId, actions, { via })`**, the server twin of `runActions`: one transaction, all checked first (schemas, future skew, writer role, live medications and providers, passes by `givenAllWrites`), errors with `meta.index`. `add_note` takes `providerIds` (mentions placed by `noteDocFromText`, refused as `providerGone` outside the group) and names them in its answer. `add_todo` (action kind `addTodo`) takes the assignee by name, answers "Added todo: …" and returns `todoId`; `add_task` is an unknown tool. Answers use quick entry's `actionPreview` wording and a link (`links.ts`, kept equal to `appUrls` by a test).
- **Edits and conditions** are server-only kinds (`runnableActionZSchema`). `append_to_entry` (≤ 50 lines, 5,000 characters): a live note or event, one `note_update` as the member (`appendNoteSection`), compacted at once. `update_entry`: title, time (an event's end follows; a series visit detaches). Conditions go through `recipientConditionService` (no provider links). Refused: deleted (`entryDeleted`, `conditionDeleted`), symptoms, vitals, doses (`notEditable`); another group's id is `entryNotFound`/`conditionNotFound`. Edits set no `via`.

## The "via" tag

- `timeline_entry.via`, `todo.via` (condition changes too) come only from the grant's `client_name`: `create(…, { via })` is server-only, create schemas strip it, it's `SYSTEM_ONLY` on update, uploads drop it.
- `ui/ViaTag` shows in `EntryBody`'s footer, a card's footer, `EntryHeader`'s time line, the todo row and `TodoHeader`.

## Managing connections

- oRPC (`connectors/connector.ts`): `connector.listMine`, `listForGroup` (owners and admins; 404 non-members), `revoke`; `careGroup.update` takes `connectorsEnabled`. Nothing returns a token or client id.
- **Group settings → Assistants** (the last subpage): owners get the switch (off through a `ConfirmDialog`); owners and admins the group's connections with Disconnect; others the status from local data (`lib/care-groups/assistantsSwitch.sync.ts`). Online only.
- **Settings → Devices:** "Connected assistants" after the sessions, Disconnect behind a `ConfirmDialog`; a 404 counts as done.
- **The connect guide** (`components/connectors/ConnectGuide`; wording only in `lib/connectors/connectGuide.ts`): the `/mcp` URL with Copy, steps and help links for Claude and ChatGPT; on Assistants and Devices (every group on the device). Off: the off note instead; viewers: the viewer note.

## Tests

- `testing.ts`: `connectAssistant` and `registerClient` run the whole OAuth flow in process and return real tokens. Integration: `oauth`, `connectorGrant`, `mcp`, `readTools`, `mcpWrites`, `assistantAction`, `assistantRequest`, `connector`, `syncVia` (`*.int.test.ts`).
- Browser checks mint a token with `mintToken.ts` (`pnpm --filter @caretook/data exec tsx ../api/src/connectors/mintToken.ts <email> <groupId> [clientName]`); `roundtrip` writes through `/mcp`.
- By hand before launch: connect from Claude and ChatGPT, and check the guide's vendor steps and links ([runbook](../../ops/runbook.md)).
