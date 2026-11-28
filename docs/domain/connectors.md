# Connectors (a member's own Claude or ChatGPT, over MCP)

PRDs: `plans/connectors{,-2,-3,-5}-prd.md`. A member connects their own assistant to **one care group**: it reads what they see and writes by quick entry's rules. **No MCP SDK**. **Web only:** `/mcp`, `/connect` (a server loader) and `/.well-known/` (`routes/connectors/routes.ts`).

## OAuth (`packages/auth/src/connectors.ts`)

- `@better-auth/oauth-provider` (`1.7.25`): PKCE S256, open dynamic registration of public clients, scopes `group:read`, `group:write`, `offline_access`; 1 h access, 30-day rotating refresh. A replayed refresh token or code revokes the family.
- **Opaque tokens** (`disableJwtPlugin: true`). The resource is `${BETTER_AUTH_URL}/mcp`.
- `CONNECTOR_DISABLED_PATHS` turns off client and consent admin, userinfo and end-session; `clientPrivileges` and `resourcePrivileges` refuse everything; introspect stays. The `caretook-connectors` plugin's `SERVER_ONLY` endpoints (`/connector/verify-token`, `/connector/check-query`) 404 over HTTP.
- The plugin's 7 tables: `db/schema/auth/oauth.ts`. `personalAccess.ts` excludes tokens and `client_secret`.

## Consent (`/connect`)

- Authorize sends to `/connect?…&sig=…` (signed, 10 min); signed out, `/sign-in`. **It reads the session live** (`getAuthUser(…, { live: true })`): it mints 30-day tokens. A browser's dead end gets HTML (`withConnectorAuthorizePage`); others keep JSON.
- `ConnectConsent.tsx`: client and redirect host, groups with the switch on, scope by role, the consent checkbox (`CONNECTOR_CONSENT_TEXT`, `_VERSION`; new words, new version, pinned by hash), Connect, Cancel. None on: the off groups, the ask button (non-owners) or Assistants' link (owners).
- **Success:** Connect returns `{ connected }`: "Connected to <group>", examples, "Return to <client>". **Needs JS:** CSP `form-action 'self'` blocks a cross-origin 302; it's `window.location`.

## Grants (`connector_grant`, `connectorGrantService`)

- One grant binds a token to one group (`scope` `read|readWrite`, `consent_version`, `revoked_at`). One live grant per user and client; a new one ends the old's tokens.
- `PERMISSIONS.connector_grant`: read, delete for the member, owners, admins; create, update for `system`.
- **`verify(token)` is the only way into `/mcp`.** Each call rechecks account, membership, role (`scopesForRole`: viewers read, easy roles none), the switch and read only; token scopes narrow it (`effectiveScope`). It returns the member (`roleNames: ["member"]`), stamping `last_used_at` each minute. `groupId` comes from the grant, never tool input.
- `revoke` ends the tokens and the `oauth_consent` row. `revokeForMember` runs in `careGroupMemberService.remove`/`leave`.
- **The switch** `care_group.connectors_enabled` (default off; Dev Family on): owners only (`careGroupService.update`). Off revokes every grant.
- **Read only** `connectors_read_only` (synced): owners only, survives the switch, revokes nothing. `verify` narrows each call; grants keep their scope, so switching back restores it. A blocked write: `mcp:groupReadOnly`, not a 403; only `readOnlyByOwner` names the owner.

## Asking owners (`assistant_request`, `assistantRequestService`)

- Cascades from group and membership. Not synced. Read: the member, owners, admins; writes `system`.
- `request`: not owners (`owner`), not while on (`alreadyOn`). Within 7 days it returns the last ask (`created: false`); else it locks the membership, writes the row plus `assistantsRequested` to each owner (names only), `deliverSoon`.
- oRPC `connector.requestEnable`, `myRequest`. The button (`components/connectors/ask/`) is under the off note.

## `/mcp` (`packages/api/src/connectors/`)

- `protocol.ts` (`handleMcp`, pure): stateless JSON-RPC over POST. `initialize` (2025-11-25 down to 2024-11-05; `tools`, `prompts`), notifications get 202, `ping`, `tools/list`, `prompts/list` filtered by scope, `tools/call`, `prompts/get` (unknown, out-of-scope or invalid: -32602). Batches and non-2.0 messages are -32600. **Tool failures are `isError: true` results** (code, message, issues); only protocol faults are JSON-RPC errors; a server fault is 500.
- `http.ts` (`createMcpHandler`): GET 405; foreign `Origin` refused; no or bad token 401 with `WWW-Authenticate: Bearer resource_metadata=…`; a write on a read grant 403 `insufficient_scope`; 60 calls a minute per grant, then 429 (`Retry-After: 60`).
- `registry.ts`: `defineTool`, inputs by `z.toJSONSchema`. Reads `readOnlyHint: true`; writes `WRITE_ANNOTATIONS` (all false), so clients confirm each. `tools/index.ts` lists them, reads then writes.
- `prompts.ts`: `definePrompt` (Zod string arguments, one user message naming the tools; reads nothing), `CONNECTOR_PROMPTS`: `catch_me_up` (`since`), `prepare_for_event` (`event`), `weekly_summary`, `log_what_happened` (`account`, write only); the instructions point at them.

## Tools

- **Reads:** `group_overview`, `list_timeline` (day, kind, author; 90 days), `latest_vitals`, `search` (≤ 25, no todos), `list_medications` (`includePast`; `type`), `todays_doses` (as Today; `passId` is `give_pass`'s), `dose_schedule` (`doseSchedule`: rounds from today, no doses; 7 days, 14 max), `past_doses` (`doseRecord`; 7 days to today, 14 max, 90 back; only the window; 40 full pages: `TOO_BUSY_REFUSAL`), `upcoming` (30 days, 90 max), `list_todos` (open; done 90 days back; `mine`; with `repeats`, `eventId` (first linked event), `linkedEntryIds` (live ones), `parentId`), `list_providers`, `recipient_profile` (`conditions` with ids by `sortConditions`, `noKnownConditions`; providers by name). Pages of 50; times carry the recipient's offset.
  - **`upcoming`** gives events plus open todos with a due day, overdue through the window's end (recipient's days): overdue todos first, then by day (all-day or untimed before timed), then time. Items are `kind` `event` or `todo`. Subtasks: assigned or due before the parent (`upcomingListsSubtask`). No notes, done or undated todos or doses.
- **Tags** (`tagSupport.ts`): `list_tags` (live counts by kind), `tagged_items` (`tag` a name or id, `kinds`; unknown or another group's: `tagFound: false`); `tag_record`, `untag_record` (`tagWrites.ts`: `canTagRecord` on a live record before any write; names fold by `tagKey`). List tools' records carry `tags`. No colors.
- **Never returned:** members', recipient's and emergency contacts' emails, phones, addresses; invite and access-code data; the date of birth (age only); `rxNumber`, quantity; a provider's email, or more than name, role and status for an "other" provider. A sweep test guards it.
- **Writes** (`tools/writes.ts`): `log_vitals` (canonical units), `log_symptom` (a catalog spelling, else adds it), `log_dose`, `give_pass`, `add_note`, `add_event`, `add_todo`, `append_to_entry`, `update_entry`, `add_condition`, `update_condition`, `resolve_condition`, `add_provider` (as the member; a repeat of type and name isn't added), `add_medication` (as the member). Each runs through **`assistantActionService.run(ctx, groupId, actions, { via })`**, `runActions`' server twin: one transaction, all checked first (schemas, skew, writer role, live medications, providers, passes), errors with `meta.index`. `add_note` takes `providerIds` (`noteDocFromText`; `providerGone` outside the group). `add_todo` takes an assignee's name and a structured `repeat` (`todoRepeatInput`; never RRULE text), returns `todoId`, `dueOn`, `repeats`. `log_dose` takes a scheduled slot's id: a repeat (same status, amount, note or none) answers "Already logged, nothing added".
  - **`log_past_doses`** (a weekly sheet; ≤ `SHEET_DOSE_MARKS_MAX` `sheetDoseMarkZSchema` marks) runs `assistantActionService.logPastDoses` (shared `openBatch`): ids from `doseSlotIdFor`, reach 14 days; each slot locked whatever its answer (`lockDoseSlot`), then its id. Outcomes by `sheetDoseOutcomes`: `add`, `alreadyLogged`, `conflict`, `noSlot`, `notYet`, `tooOld`, `repeated`. Never changes a recorded dose.
  - **Notes are for what has happened:** `add_note`, `update_entry` and `append_to_entry` refuse a note ahead with "A note can't be in the future. Use add_todo with a due day for something to do later." (from `FUTURE_DATE_MESSAGE`); `append_to_entry` also refuses a stored future note. Descriptions say so and say "event"; consent text still says appointments.
  - Answers use `actionPreview` wording and a link (`links.ts`; tested against `appUrls`).
- **Edits and conditions** are server-only kinds (`runnableActionZSchema`). `append_to_entry`: a live note or event, one `note_update` as the member (`appendNoteSection`), compacted. `update_entry`: title, time (the end follows; a series visit detaches). Conditions use `recipientConditionService` (no provider links). Refused: deleted (`entryDeleted`, `conditionDeleted`), symptoms, vitals, doses (`notEditable`); another group's id: `entryNotFound`/`conditionNotFound`. No `via`.

## The "via" tag

- `timeline_entry.via`, `todo.via` (condition changes too) come only from the grant's `client_name`: `create(…, { via })` is server-only, create schemas strip it, it's `SYSTEM_ONLY` on update, uploads drop it.
- `ui/ViaTag` shows in `EntryBody`'s and a card's footer, `EntryHeader`, the todo row and `TodoHeader`.

## Managing connections

- oRPC (`connectors/connector.ts`): `connector.listMine`, `listForGroup` (owners and admins; 404 non-members), `revoke`; `careGroup.update` takes `connectorsEnabled`. No token returned.
- **Group settings → Assistants**: owners get the switch; owners and admins the connections with Disconnect; others the local status. Online only.
- **Settings → Devices:** "Connected assistants" after the sessions, Disconnect behind a `ConfirmDialog`.
- **The connect guide** (`ConnectGuide`, `connectGuide.ts`): the `/mcp` URL with Copy, vendor steps and links; on Assistants and Devices. Off, viewers: notes; none for easy roles.

## Tests

- `testing.ts`: `connectAssistant` runs the whole OAuth flow in process for real tokens; `/mcp` calls use `mcpPost`, `callTool`, `toolResultOf`, `textOf`.
- Browser checks mint a token (`mintToken.ts`); `roundtrip` writes via `/mcp`.
- By hand before launch: connect from Claude and ChatGPT, and check the guide's steps ([runbook](../../ops/runbook.md)).
