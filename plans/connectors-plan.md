# Plan: Connectors

> Source PRD: [`plans/connectors-prd.md`](connectors-prd.md). User-story numbers (US) refer to it. Backlog item B-104. Topic `connectors`.

## Status

| Slice | Wave | State                                                                                           | Merge into `prd/connectors` (slice commits) |
| ----- | ---- | ----------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1     | 1    | merged, worktree removed (load flakes in untouched component tests; landing check reruns)       | 5225d442 (de3bedd0)                         |
| 2     | 1    | started (worktree `.loops/connectors-2`, opus agent spawned 2026-11-20)                         |                                             |
| 7     | 1    | handed off (210766d1; check green but a load flake; `marketing` browser check left for landing) |                                             |
| 3     | 2    | not started                                                                                     |                                             |
| 4     | 2    | not started                                                                                     |                                             |
| 5     | 2    | not started                                                                                     |                                             |
| 6     | 3    | not started                                                                                     |                                             |

**Landing mode:** run everything through (queued with `pnpm prd queue connectors`, 2026-11-20): start every ready slice, land each green wave without asking (here: one landing after slice 6, per _When to land_), clean up; ask only real questions.

**Models:** slice 1 sonnet (a mechanical move), slice 2 opus (design-heavy), slice 7 sonnet (text).

**Waiting on:** timeline-ux's B-164/B-165 are in `dev` (60260949): rows put ⋯ `EntryActions` over the author chip in `div[data-entry-aside]` (`ASIDE_CLASS`, `timeline/layout.ts`); cards unchanged (author in the footer); `DayHeader` has a `summary` region; `EntryHeader` untouched; the header strips became one `TodayCard`. So slice 3 waits only on slice 2: at the wave 2 boundary run `pnpm prd sync` first, and give slice 3 these placement notes. B-140 (packages/auth) is timeline-ux's last wave; they'll warn.

**When to land:** this PRD has a migration and a new dependency, so hold landing until every slice is merged, then run the checks once at the end. Ask the user before any `--suite`.

**Backlog:** B-104 claimed (slice 2 started); `done` after slice 6 merges (the last of the PRD).

## Architectural decisions

- **Dependencies (approved by the user, 2026-11-20):** `@better-auth/oauth-provider` at exactly `1.7.25` (in `packages/auth`, matching `better-auth`). **No MCP SDK.** Nothing else new.
- **One migration for the PRD, made by slice 2 with every column**, so later slices never regenerate it: the oauth-provider plugin's tables (in `db/schema/auth/`, under the auth table exceptions), `connector_grant` (`db/schema/connectors/`), `care_group.connectors_enabled` (boolean, not null, default false), and a nullable `via` text column on `timeline_entry` and `task`.
- **The grant binds a token to one group.** `connector_grant` (`user_id`, `group_id`, `oauth_client_id`, `client_name` ≤ 40 characters, `redirect_host`, `scope` `read|readWrite`, `consent_version`, `consented_at`, `last_used_at`, `revoked_at`, timestamps, audits; one live grant per user and client). `PERMISSIONS.connector_grant`: read for self and for the group's owners and admins; delete for self, owners and admins; create and update for `system`.
- **`connectorGrantService.verify` is the only way into `/mcp`.** It rechecks the membership, the current role (a viewer is read only, whatever was granted) and the group's switch on every call. `groupId` always comes from the grant, never from tool input.
- **Scopes:** OAuth `group:read`, `group:write`; the grant's effective scope filters `tools/list` and guards `tools/call`.
- **The switch:** owners only, through `careGroupService.update`. Off revokes every grant for the group in the same transaction; on restores nothing. Membership removal and leaving revoke that member's grants for the group in the same transaction.
- **The MCP module is stateless JSON-RPC over POST** (`packages/api/src/connectors/`): `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`; no sessions, no SSE (GET is 405). Tool failures are `isError: true` results with the code, a plain message and the issues; only protocol faults are JSON-RPC errors. Inputs are emitted as JSON Schema by `z.toJSONSchema`.
- **Tool annotations:** reads `readOnlyHint: true`; writes `readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false`, so Claude and ChatGPT confirm each write.
- **Writes go through `assistantActionService.run`** (one validated batch, one transaction, `via` set from the grant). The upload switch ignores any `via` from a device.
- **Never returned by any tool:** members' and emergency contacts' emails, phones and addresses; invite and access-code data; the full date of birth (age only).
- **Limits:** 60 calls a minute per grant (`createRateLimiter`, `defaultStore("connector")`); list reads at most 50 a page (search 25), with default windows of 90 days back and 30 days ahead.
- **Web only:** `/mcp`, `/connect` and the two `/.well-known/` documents are in the connectors area's `routes.ts`, under the web-only list. `/connect` may use a server loader.
- **Registries:** the connectors area's own parts (`db/schema/connectors/`, `permissions/connectors.ts`, `errors/connectors.ts`, `packages/api/src/connectors/`, `routes/…/connectors/routes.ts`, `lib/connectors/urls.ts`, `scripts/loops/check-areas.d/connectors`) plus their entries in the frozen tests (`routes.test.ts`, `appUrls.test.ts`, `routerPaths.test.ts`, the schema `index.test.ts`). Additive edits at the end of their group in `sync-config.yaml`, the device schema and `GROUP_SETTINGS`.

## How to run this plan

- **Wave 1: slices 1, 2 and 7**, in parallel. 1 is a pure move with no overlap with 2. 2 is the tracer bullet: it owns the migration, the dependency, the auth wiring and the MCP module. 7 is text only.
- **Wave 2: slices 3, 4 and 5**, after 1 and 2 are merged. 3 owns the write tools and the `via` tag. 4 owns the remaining read tools. 5 owns the management screens and the `connector.*` procedures. They touch different tool files. Only the registry's tool list (`packages/api/src/connectors/tools/index.ts`) takes additive lines from 3 and 4.
- **Wave 3: slice 6**, the `roundtrip` step, after 3.
- Merge in plan order within a wave (1, 2, 7; then 3, 4, 5), with no checks between merges.
- **Stacks:** only slices 2 (the real OAuth flow against a dev server and the seeded switch) and 6 (`roundtrip`) need one. The rest are stackless (integration tests on the shared test Postgres, component tests on the test device). A stackless slice whose `--changed` names a browser check reports it for the orchestrator to run at landing (slice 7 names `marketing`).
- **Checks:** every slice runs `pnpm check`. Screen slices run `pnpm test:components --changed prd/connectors`. Only slice 6 adds an end-to-end step. Every slice runs `pnpm prd browser --changed` once before hand-off and reports what it named.
- **The lean budget:** `roundtrip`'s usual is 29 s against a ceiling of 286 s (2026-11-20). Slice 6's step must fit, and should share an existing step's device and window. If the lean total goes over the ceiling, report it for the user; nothing raises the ceiling without them.
- **Running beside other PRDs:**
  - `timeline-ux` (running): hot on the row components, `DayHeader`, the entry header, `packages/auth` and `packages/api/src/procedures.ts`. **Slice 3's `via` tag waits until timeline-ux's row and header slices (the author under the menu) are in `dev`**, then syncs `dev` and places the tag in the regions they left. Slice 2 touches `packages/auth/src/auth.ts` (the plugin) and doesn't need `procedures.ts`. If timeline-ux's cheaper-auth slice (B-140) is about to land, sync it first.
  - `agent-tooling`: it trims `docs/domain/` docs; this plan's loops don't edit docs, so the only overlap is at landing (fold into the trimmed docs).
  - `check-migration`: owns `roundtrip`'s structure and the Playwright port (B-129). Slice 6 follows whatever form `roundtrip` is in on `dev` when it starts. Additive `check-areas.d/` edits only.
  - Migrations: if another PRD's migration lands first, regenerate on top (`docs/agents/orchestrator.md`, _Rules across PRDs_).
- Every slice ends with a hand-off (`docs/agents/loop.md`, _Hand-off_), plus a _Docs_ section listing what the orchestrator should fold into the area docs. At the final landing the orchestrator writes a new `docs/domain/connectors.md`, adds its _Area index_ row, adds `/mcp` to the hosting smoke list and the manual Claude and ChatGPT check to [`ops/runbook.md`](../ops/runbook.md), and updates the assistant, auth, api, care-groups, sync, app-shell and marketing docs.

---

## Slice 1: The shared due-doses core and preview wording

Stack: no · Reads: docs/domain/assistant.md, docs/domain/medications.md, docs/layout.md · Tests: unit

**User stories:** 20, 26, 28 (groundwork).

**What to build:**

- Move the pure `dueDoses`, `duePasses` and `givenAllWrites` modules (and whatever pure helpers they need) from `apps/web/app/lib/medications/` to `@caretook/data/schema` (the medications schema area), with their unit tests. Types that come from device modules (`DoseInput`) become plain shapes in the new home.
- Move `actionPreview` and `whenText` (`lib/assistant/quickEntryPreview.ts`) and the display helpers they need to `@caretook/data/schema` (the assistant area), with their tests.
- Update the web call sites, or leave thin re-exports where many files import the old path. **Behaviour doesn't change.**
- Update `check-areas.d/` rules for the moved files.

**Acceptance criteria:**

- [ ] Unit: the moved tests pass unchanged in `data:unit` (no assertion edited, only imports).
- [ ] Nothing in the moved modules imports from `apps/web`, PowerSync or React (`pnpm typecheck` and lint pass).
- [ ] Component tests for quick entry, the medication strip and Today pass unchanged (`pnpm test:components --changed prd/connectors`).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** none. **Blocks:** 3, 4.

---

## Slice 2: Connect and read (the tracer bullet)

Stack: yes · Reads: docs/domain/auth.md, docs/domain/api.md, docs/domain/data-layer.md, docs/domain/care-groups.md, docs/domain/sync.md, docs/domain/components.md, docs/domain/security-headers.md, docs/layout.md · Tests: unit, integration, component

**User stories:** 1, 8–16, 17, 23–25, 34, 35, 38, 39, 41, 42.

**What to build:**

- **The dependency and the migration:** add `@better-auth/oauth-provider` (exactly `1.7.25`) to `packages/auth`, and generate the PRD's one migration (_Architectural decisions_). Add its schema parts and permissions.
- **OAuth wiring** (`packages/auth`): the plugin with PKCE S256 only, dynamic registration for public clients, scopes `group:read` and `group:write`, 1 h access tokens, 30-day rotating refresh tokens, revocation; our login page (`/sign-in?redirectTo=…`) and our consent page (`/connect`). The two `/.well-known/` documents as web-only resource routes. Check the CSP (`security-headers.md`) still allows the redirect back to the client.
- **The consent rules** (pure, client-safe): `CONNECTOR_CONSENT_TEXT`, `CONNECTOR_CONSENT_VERSION`, `scopesForRole(role)`.
- **`connectorGrantService`:** `grant`, `verify`, `revoke`, `listMine`, `listForGroup`; revocation from membership removal and leaving (`careGroupMemberService`) in the same transaction; the cascade on account deletion. **The switch** in `careGroupService.update` (owners only; off revokes all in the same transaction). Errors in `errors/connectors.ts`.
- **`/connect`:** the client name and redirect host, the group picker (switch on, member), scope by role (`ChoiceGroup`; viewers see read only), the consent checkbox, Connect and Cancel; the "no group allows assistants" state. Built on `ui/` primitives.
- **The MCP module and route:** `handleMcp` with the tool registry (_Architectural decisions_); `/mcp` (POST; 401 with `WWW-Authenticate` and `resource_metadata`; 403 `insufficient_scope`; 405 on GET; the per-grant rate limit; logging by the api rules).
- **The first two tools:** `group_overview` and `list_timeline`.
- **Seeds:** turn the switch on for Dev Family (not Dev Family 2), so the flow can be tried locally; no seeded grants.
- **`check-areas.d/connectors`** rules for every new file.

**Acceptance criteria:**

- [ ] Unit: the MCP module table (initialize and version negotiation, `notifications/initialized` gets no reply, ping, `tools/list` filtered by scope, a call's success and `isError` result, unknown method, bad params, a batch refused or handled per the spec); every registered tool's JSON Schema; `scopesForRole`.
- [ ] Integration (OAuth, in process against `createAuth`): register a public client, authorize, consent through the `/connect` action, exchange the code with PKCE (a wrong verifier is refused), refresh (the old refresh token stops working), revoke; both metadata documents' fields.
- [ ] Integration (`connectorGrantService`): grant refused when the switch is off, for a non-member, and for a viewer asking for write; `verify` refuses a revoked grant, an expired token, a removed member and a group switched off, and makes a demoted caretaker read only; `listMine`/`listForGroup` scoping by role; switching off revokes all; removal and leaving revoke; account deletion cascades.
- [ ] Integration (`/mcp`): no token → 401 with the header; a read-only grant doesn't list write tools; `group_overview` and `list_timeline` return the seeded fixture's data in the actor's scope, paged at 50, with note text, and **no email or phone field anywhere in the output**; the 61st call in a minute → 429.
- [ ] Component (`/connect`): the picker lists only enabled groups; a viewer sees read only; Connect is disabled until consent is ticked; Cancel connects nothing; the empty state.
- [ ] By hand on the slice's stack: the whole flow from an MCP client you drive with `curl` (register → authorize → sign in → consent → token → `tools/call list_timeline`), written up in the hand-off.
- [ ] `pnpm datastore:reset` seeds the switch on for Dev Family; `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** none. **Blocks:** 3, 4, 5, 6.

---

## Slice 7: The privacy page and FAQ

Stack: no · Reads: docs/domain/marketing.md · Tests: unit

**User stories:** 40.

**What to build:**

- A "Connecting your own AI assistant" section in the privacy and health-data-privacy content modules (`sections/legal.ts` types): what's sent (the chosen group's data that the member can see, minus contact details), to whom (the AI vendor the member chose, under that vendor's terms), what we keep (consent, the connection, last used; no log of what was read), and how to stop (Settings → Devices, or an owner's switch). Update the plain summary and the last-updated date, and keep the DRAFT banner.
- An FAQ entry saying the same in two or three sentences.

**Acceptance criteria:**

- [ ] Unit: `legal.test.ts` (or its equivalent) covers the new section's heading anchor and table of contents entry.
- [ ] The text matches the PRD's decisions, with no promise the code doesn't keep (no call log, contact details excluded, owners' switch off by default).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported (expect `marketing`, for the orchestrator to run at landing if the slice can't).

**Blocked by:** none. **Blocks:** none.

---

## Slice 3: Write tools and the "via" tag

Stack: no · Reads: docs/domain/assistant.md, docs/domain/timeline.md, docs/domain/live-notes.md, docs/domain/medications.md, docs/domain/tasks.md, docs/domain/sync.md, docs/domain/components.md · Tests: integration, component

**User stories:** 26–35.

**What to build:**

- **`assistantActionService.run(ctx, groupId, actions, { via })`:** the server twin of `runActions` (_Architectural decisions_), through `timelineEntryService`, `noteDocumentService` (documents from `noteDocFromText`, compacted), `entryProviderService`, the dose and pass writes (planned with slice 1's `duePasses` and `givenAllWrites`), and `taskService`.
- **The write tools:** `log_vitals`, `log_symptom`, `log_dose`, `give_pass`, `add_note`, `add_event`, `add_task`, each answering with slice 1's preview wording and the entry's or task's URL.
- **Sync of `via`:** the column in the `timeline_entry` and `task` streams and the device schema (additive); the upload switch drops `via` from device writes.
- **The tag:** "via <name>" (`data-via`) on timeline rows and cards, the entry page header and the task row and page. **Start only once timeline-ux's row and header slices are in `dev`, and sync `dev` first** (_How to run_).

**Acceptance criteria:**

- [ ] Integration (`assistantActionService.run`): each action writes what quick entry's runner writes (vitals, a symptom, a dose, a pass's given all across its open slots, a note and an event with their documents and providers, a task); a batch with one refused action (a future dose, a stopped medication, an unknown provider, BP in the wrong order, a gone pass) writes nothing and reports its index; a viewer is refused; `via` is stored.
- [ ] Integration (`/mcp`): each write tool through the handler with a real read-and-write token; a read-only grant's call is refused; a refusal is an `isError` result with the code and issues.
- [ ] Integration (upload): a device PUT or PATCH carrying `via` doesn't change it.
- [ ] Component: the tag on a row, a card, the entry page and the task page, and no tag when `via` is null.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 1, 2 (and timeline-ux's row and header slices in `dev`). **Blocks:** 6.

---

## Slice 4: The rest of the read tools

Stack: no · Reads: docs/domain/api.md, docs/domain/timeline.md, docs/domain/search.md, docs/domain/medications.md, docs/domain/appointments.md, docs/domain/tasks.md, docs/domain/providers.md, docs/domain/profiles.md · Tests: integration

**User stories:** 18–25.

**What to build:**

- `latest_vitals`, `search` (`searchService`, at most 25), `list_medications` (current, or with past), `todays_doses` (slice 1's core, in the recipient's zone), `upcoming` (30 days, 90 at most), `list_tasks` (open by default), `list_providers`, `recipient_profile` (preferred name, age, allergies, conditions).
- Each is read only, in the actor's scope through the existing services, with times in the recipient's offset.

**Acceptance criteria:**

- [ ] Integration (`/mcp`, one test per tool): fixture data comes back in scope, a second group's data never does, paging and caps hold, and times carry the recipient's offset.
- [ ] Integration: a sweep over every read tool's output finds no email, phone, address or full date of birth (a fixture recipient and members with all of them set).
- [ ] `todays_doses` agrees with the device's Today for the same fixture and `now` (the same core).
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 1, 2. **Blocks:** none.

---

## Slice 5: Managing connections

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/care-groups.md, docs/domain/components.md, docs/domain/api.md · Tests: integration, component

**User stories:** 2–7, 36, 37.

**What to build:**

- **oRPC** (`packages/api/src/connectors/`): `connector.listMine`, `connector.listForGroup` (owners and admins), `connector.revoke`; `connectorsEnabled` on `careGroup.update` (owners only). Paths in `routerPaths.test.ts`.
- **Group settings → Assistants** (its own entry at the end of `GROUP_SETTINGS`): for owners, the switch with a confirm when turning it off ("Disconnects N assistants"); for owners and admins, the group's grants (member, client name, scope, connected, last used) with Disconnect behind a `ConfirmDialog`; for others, the status and a link to Devices. Online only.
- **Settings → Devices:** a "Connected assistants" section after the sessions (client name, group, scope, connected, last used, Disconnect behind a `ConfirmDialog`). Online only.

**Acceptance criteria:**

- [ ] Integration: `listMine` returns only the caller's grants; `listForGroup` refuses caretakers and viewers (403) and non-members (404); revoke by self, owner and admin, refused for another caretaker; the switch refused for admins; nothing returns a token.
- [ ] Component (Assistants page): an owner turns it on, and off through the confirm; an admin sees the list and disconnects one but has no switch; a caretaker sees the read-only status; offline shows the usual online-only state.
- [ ] Component (Devices): the section lists the caller's connections, and Disconnect removes one after the confirm.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 2. **Blocks:** none.

---

## Slice 6: A connector write across devices (the roundtrip step)

Stack: yes · Reads: docs/agents/loop.md, docs/domain/sync.md · Tests: e2e:roundtrip

**User stories:** 26, 31.

**What to build:**

- A test helper that makes a grant and an access token for a seeded member without the browser dance (through the services and the plugin's token store, test-only).
- One `roundtrip` step, sharing an existing step's devices and window: `tools/call add_note` (or `log_vitals`) through `/mcp` with that token, then device A shows the entry with "via <name>".
- Update `roundtrip`'s usual seconds in `scripts/loops/checks` from its run.

**Acceptance criteria:**

- [ ] `pnpm prd browser roundtrip` passes with the new step, on the form `roundtrip` has on `dev` when the slice starts (CDP or Playwright).
- [ ] The lean total stays within the ceiling, or the hand-off reports the overage for the user.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` run once and reported.

**Blocked by:** 3. **Blocks:** none.
