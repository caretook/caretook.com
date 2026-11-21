# Connectors (a member's own Claude or ChatGPT, over MCP)

The connectors area's rules and decisions. An orchestrator folds a landing's lasting decisions for this area in here.

PRD: [`plans/connectors-prd.md`](../../plans/connectors-prd.md); plan: [`plans/connectors-plan.md`](../../plans/connectors-plan.md) (B-104). A member connects an assistant they already use to **one care group**; it reads what they can see and, if allowed, writes through the same rules as quick entry. **No MCP SDK:** the protocol is a small hand-written module. **Web only:** `/mcp`, `/connect` and the `/.well-known/` documents (`routes/connectors/routes.ts`) are in the web-only list; `/connect` uses a server loader.

## OAuth (`packages/auth/src/connectors.ts`)

- `@better-auth/oauth-provider` (pinned `1.7.25`): PKCE S256 only, open dynamic registration of public clients, scopes `group:read`, `group:write`, `offline_access`; 1 h access tokens, 30-day rotating refresh tokens, revocation. Replaying a rotated refresh token or reusing a code revokes the whole family.
- **Opaque tokens** (`disableJwtPlugin: true`): revocable, and the `jwt` plugin stays PowerSync's. The resource is `${BETTER_AUTH_URL}/mcp`; the issuer `${APP_URL}/api/auth`.
- `CONNECTOR_DISABLED_PATHS` turns off client and consent admin, userinfo and end-session; `clientPrivileges` and `resourcePrivileges` refuse everything. Introspect stays (discovery advertises it; it needs client auth). The `caretook-connectors` plugin adds two `SERVER_ONLY` endpoints (`/connector/verify-token`, `/connector/check-query`), 404 over HTTP.
- The plugin's 7 tables are in `db/schema/auth/oauth.ts`, under the auth table exceptions. `personalAccess.ts` excludes the access and refresh tokens and `oauth_client.client_secret`.
- B-140's `/token` before-hook matches `/token` exactly, so `/oauth2/*` is never caught.

## Consent (`/connect`)

- Authorize sends to `/connect?…&sig=…` (the plugin's signed query, 10 minutes). Signed out, it redirects to `/sign-in?redirectTo=…`. **It reads the session live** (`getAuthUser(…, { live: true })`), not from the 3-minute cookie cache, because it mints 30-day tokens. **A browser navigation's dead end** (the plugin's error redirect, a 4xx; a 429 says too many tries) gets an HTML page, not JSON (`withConnectorAuthorizePage` in `connectorAuthorize.ts`, around the web `/api/auth/*` route); other requests keep the JSON.
- The page (`ConnectConsent.tsx`, `ui/plain`'s `ChoiceGroup`) shows the client name and redirect host, a picker of groups with the switch on, the scope by role (viewers read only), the consent checkbox (`CONNECTOR_CONSENT_TEXT`, naming allergies and conditions in the medical profile; `CONNECTOR_CONSENT_VERSION`), Connect and Cancel; and the "no group allows assistants" and invalid-or-expired states.
- **It needs JS to return to the client:** CSP `form-action 'self'` blocks a native form post's 302 to another origin, so the redirect is React Router's fetch, then `window.location`.
- Its server side is framework-free (`packages/api/src/connectors/connect.ts`), so the integration test drives the page's own code.

## Grants (`connector_grant`, `connectorGrantService`)

- One grant binds a token to one group: `user_id`, `group_id`, `oauth_client_id`, `client_name` (≤ 40), `redirect_host`, `scope` (`read|readWrite`), `consent_version`, `consented_at`, `last_used_at`, `revoked_at`, timestamps, audits. A partial unique index keeps one live grant per user and client; a new grant replaces the old one and ends its tokens.
- `PERMISSIONS.connector_grant`: read and delete for the member and the group's owners and admins; create and update for `system`.
- **`verify(token)` is the only way into `/mcp`.** Every call it rechecks the account, the membership, the current role (a viewer is read only, whatever was granted) and the group's switch; the token's own scopes narrow it further (`effectiveScope`). It returns the member with `roleNames: ["member"]` (staff powers never come through) and stamps `last_used_at` at most once a minute. `groupId` always comes from the grant, never from tool input.
- `revoke` also revokes the plugin's tokens and deletes its `oauth_consent` row, so the next authorize comes back to `/connect`. `revokeForMember` runs inside `careGroupMemberService.remove` (and so `leave`); account deletion cascades.
- **The switch** `care_group.connectors_enabled` (default off; Dev Family seeded on): owners only, through `careGroupService.update`. Off revokes every grant in the same transaction; on restores nothing.

## `/mcp` (`packages/api/src/connectors/`)

- `protocol.ts` (`handleMcp`, pure): stateless JSON-RPC over POST. `initialize` (versions 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05), notifications get 202, `ping`, `tools/list` filtered by scope, `tools/call`. Batches and non-2.0 messages are -32600. **Tool failures are `isError: true` results** with the code, a plain message and the issues; only protocol faults are JSON-RPC errors; a server fault is thrown for the HTTP layer (500).
- `http.ts` (`createMcpHandler`): GET is 405. A foreign browser `Origin` is refused. No or a bad token is 401 with `WWW-Authenticate: Bearer resource_metadata=…` (`error="invalid_token"` for a bad one); a write on a read grant is 403 `insufficient_scope`. 60 calls a minute per grant (`defaultStore("connector")`), then 429 with `Retry-After: 60`. Logs carry only the code, `mcp.<tool>`, actor and group. Options: `now` (tests' clock), `appOrigin` (links).
- `registry.ts`: `defineTool`; inputs are emitted by `z.toJSONSchema` (`io: "input"`). Reads are `readOnlyHint: true`; writes `readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false`, so Claude and ChatGPT confirm each write. `tools/index.ts` lists them, reads then writes; a new tool adds a line at the end of its group.

## Tools

- **Reads:** `group_overview`, `list_timeline` (by day, kind or author, note text; 90 days back; text lines are whole, and a medication or condition change gives `changeText`'s or `conditionChangeText`'s before → after), `latest_vitals`, `search` (`searchService`, ≤ 25, default 10; tasks aren't searched), `list_medications` (current, or `includePast`; `type` or null, the label in the text line when set), `todays_doses` (slice 1's `dueDoses` and `duePasses` in the recipient's zone, so it agrees with Today), `upcoming` (from the start of today; 30 days, 90 at most), `list_tasks` (open by default; done back 90 days; `mine`), `list_providers`, `recipient_profile` (with `conditions`, ordered by the shared `sortConditions` in `@caretook/data/schema`, and `noKnownConditions`; providers by name only, deleted ones left out). Lists page at 50 (`readSupport.ts` offset cursors; `list_timeline` and `search` keep their service cursors). Times carry the recipient's offset (`zonedIso`).
- **Never returned:** members', the recipient's and emergency contacts' emails, phones and addresses; invite and access-code data; the full date of birth (age only); `rxNumber`, quantity. Providers' business phone, address and website are returned for clinicians, practices and pharmacies; never a provider email, nor anything but name, role and status for an "other" provider. There is no conditions field yet (B-181). A sweep test (`readTools.int.test.ts`) guards this.
- **Writes** (`tools/writes.ts`): `log_vitals` (canonical units in its description), `log_symptom`, `log_dose`, `give_pass`, `add_note`, `add_event`, `add_task`. Each runs a batch of one through **`assistantActionService.run(ctx, groupId, actions, { via })`**, the server twin of `runActions`: one transaction, the whole batch checked first (schemas, the future skew against the server's now, writer role, live and current medications, live providers, passes planned with `givenAllWrites`), errors returned as an AppError with `meta.index`. `occurredAt` defaults to now; `add_task` takes the **assignee by name** (no member ids are exposed). Answers use quick entry's `actionPreview` wording and a link (`links.ts`, kept equal to `appUrls` by a test).

## The "via" tag

- `timeline_entry.via` and `task.via` (nullable) are set only server side from the grant's `client_name`: `create(ctx, input, { via })` is server-only, the create schemas strip it, `via` is `SYSTEM_ONLY` on update, and the upload's column lists drop it.
- `ui/ViaTag` ("via X", `data-via`) shows in a row's `EntryBody` footer, a card's footer after the author, `EntryHeader`'s time line, the task row after the assignee and `TaskHeader`.

## Managing connections

- oRPC (`connectors/connector.ts`, composed in `router.ts`): `connector.listMine`, `connector.listForGroup` (owners and admins; 403 caretakers and viewers, 404 non-members), `connector.revoke`; `careGroup.update` takes `connectorsEnabled` (owners only). Nothing returns a token or the OAuth client id.
- **Group settings → Assistants** (the last subpage): owners get the switch (off through a `ConfirmDialog`, "Disconnects N assistants…"); owners and admins the group's connections with Disconnect; others the status from local data (`lib/care-groups/assistantsSwitch.sync.ts`) and a link to Devices. Online only.
- **Settings → Devices:** "Connected assistants" after the sessions, Disconnect behind a `ConfirmDialog`; a 404 counts as done.

## Tests

- `testing.ts`: `connectAssistant` and `registerClient` run the whole OAuth flow in process and return real tokens. Integration: `oauth.int.test.ts`, `connectorGrant.int.test.ts`, `mcp.int.test.ts`, `readTools.int.test.ts`, `mcpWrites.int.test.ts`, `assistantAction.int.test.ts`, `connector.int.test.ts`, `syncVia.int.test.ts`.
- Browser checks mint a token with `mintToken.ts` (`pnpm --filter @caretook/data exec tsx ../api/src/connectors/mintToken.ts <email> <groupId> [clientName]`, the stack's env and seed password); `roundtrip` writes a note through `/mcp` and sees the tag on device A.
- By hand before launch: connect from Claude and ChatGPT ([runbook](../../ops/runbook.md)).
