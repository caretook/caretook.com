# Plan: Code layout

> Source PRD: [`plans/code-layout-prd.md`](code-layout-prd.md). User-story numbers (US) refer to it. Backlog items B-149 and B-150. Topic `code-layout`.

## Status

| Slice | Wave | State                                         | Merge into `prd/code-layout` (slice commits) |
| ----- | ---- | --------------------------------------------- | -------------------------------------------- |
| 1     | 1    | landed (wave 1, 7fca12d)                      | c1954ac (1914958)                            |
| 2     | 2    | merged (sonnet)                               | 7bad436 (fdd21a0)                            |
| 3     | 2    | merged (sonnet; admin rule conflict resolved) | 821894d (9728b64, 7137146)                   |
| 4     | 2    | started (opus, worktree code-layout-4)        |                                              |
| 5     | 3    | blocked by 4                                  |                                              |

**Landing mode: run everything through** (queued with `pnpm prd queue code-layout`, 2026-11-20). The orchestrator starts every ready slice, lands each green wave itself with `pnpm prd land`, and cleans up; it asks the user only real questions.

**Now (2026-11-20):** wave 1 landed in `dev` as 7fca12d (its check-areas docs folded in then: loops.md, AGENTS.md _Loop rules_, components.md; the test built-in accepted). Told `check-migration-17` to resume and that wave 2 moves its paths. Wave 2 started: slices 2 and 3 on sonnet (mechanical moves), 4 on opus (module → area calls, about 267 importers); B-150 claimed. `hosting` is finished (nothing to replay). `check-migration` resumed with wave 6 (its slices 12, 16, 17): component tests and `check-areas.d` edits, avoiding our wave 2 paths; whichever PRD lands second resolves the rule hunks, and its new tests' `~/lib/…` imports get replayed at our new paths by whoever syncs second. All three wave 2 agents hit the usage limit mid-slice (work uncommitted in their worktrees: 4 was at its layout-guard demo, 2 and 3 were running checks); resumed with SendMessage after the reset. Slices 2 and 3 merged (7bad436, 821894d). **Wave 2's landing needs the full `pnpm prd check`, not `--quick`:** slice 2's own full check was never confirmed (typecheck, lint, format, `data:unit`, lint and generate were), slice 3's had a load flake in an untouched medications component test, and merge 3 resolved a rule conflict. Waiting on slice 4.

- **check-migration agreed** (2026-11-20): it lands 11, 14 and 15 as one wave (about an hour) and messages us, then **pauses all its remaining slices** (12, 16–23 all edit check-areas) until we message it that slice 1 is in `dev`. So land slice 1 promptly and message `check-migration-7b` at once.
- **Pass to slice 1's agent:** keep check names as plain tokens in `check-areas.d/` files, so check-migration's later deletions (`groups`, `profiles-contacts`, …) stay one-line edits; keep the resolver independent of the CDP harness, since check-migration slice 23 deletes the harness that `browser.sh --changed` drives today.

**Landing (plan's note):** the landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued. Record it here. The lean browser set runs **once, before the PRD's last landing** (the user's choice, 2026-11-20). Earlier waves land on `pnpm prd check` alone.

**Start condition:** `tasks` and `hosting` wave 1 in `dev`, and no running PRD with unmerged `scripts/loops/check-areas` edits (check `pnpm prd status`; `check-migration` adds rules there). While this PRD runs, no other PRD starts work that touches `apps/web/app/lib/` or the seven registries.

Backlog: claim B-149 when slice 1 starts (`done` after slice 5), and B-150 when slice 4 starts (`done` after slice 4).

Fold into the docs at the final landing (the orchestrator; loops never edit them):

- **`docs/layout.md`:** rewritten from the tree as it is after slice 5: lib area folders, `core/`, `sync/` plumbing, `.sync.ts`, schema area folders, API area folders, route and URL parts, `check-areas.d/`.
- **AGENTS.md:** _Rules across PRDs_. "Additive edits to shared registries" becomes: "**Registries are composed from area parts.** Add a route, URL, error, permission, table or procedure to your area's part (create the part when your area has none), and a check-areas rule to `scripts/loops/check-areas.d/<area>`. The top indexes change only when an area is added." Keep the additive rule for what's out of scope: `services/`, `models/` and `seeds/` indexes, `sync-config.yaml`, the device schema, the `sync.ts` upload switch, `KIND_META`, `GROUP_SECTIONS`. Also update the _Loop rules_ line "A new screen, check or shared module adds its rule to `scripts/loops/check-areas`", and the _Architecture_ pointers (`lib/sync/` is plumbing only).
- **`docs/loops.md`:** the check-areas text describes the resolver, most specific wins, the fallbacks and the lint.
- **`docs/domain/data-layer.md`, `api.md`, `sync.md`, `app-shell.md`, `components.md`:** where each one says "add an entry at the end of …", point it at the area part instead.
- **The backlog's PRD table:** hot-file entries that name the old registries are rewritten to area parts.

## Architectural decisions

Durable decisions every slice follows:

- **Pure refactor.** No URL, route path or id, procedure path, error code, permission, table, column or screen changes. `pnpm datastore:generate` generates nothing.
- **One area list** for every folder and part: the `docs/domain/` areas (`app-shell`, `care-groups`, `timeline`, `live-notes`, `providers`, `medications`, `appointments`, `care-periods`, `search`, `profiles`, `assistant`, `auth`, `admin`, `marketing`, `notifications`), plus `core` for helpers no one area owns.
  - A module goes to the area whose doc owns its concept, or, when it serves two, to the area that defines the data it reads.
  - Parts exist only where an area has entries.
- **Parts live beside the area's code**; a thin index composes them and changes only when an area is added.
- **No barrels in `lib/`**: imports are direct file paths. Schema area folders and API area folders do have an index (Drizzle and oRPC need one surface).
- **Codemod, no shims.** Every move rewrites every importer in the same commit. No re-export stubs at old paths. The codemod is a throwaway script (not committed, no dependency).
- **Device queries are `<name>.sync.ts`** in their area folder. `lib/sync/` holds only the client, the device schema, `index`, `pageCache`, `useLiveRows` and other shared plumbing. The client still loads lazily.
- **check-areas: most specific glob wins** across `scripts/loops/check-areas.d/*`. The order of files and lines never matters. A remaining tie is a lint error.
- **Composed results are frozen in tests.** Each completeness test holds a small inline list taken before its split (route path, file and id; `appUrls` keys; procedure paths). A later PRD that adds an entry adds it to the list.
- **Every moved path** is listed in the slice's hand-off as an old → new table.
- No new dependencies.

## How to run this plan

- **Wave 1: slice 1 alone.** It rewrites `check-areas` wholesale, so it must not run beside anything that edits it.
- **Wave 2: slices 2, 3 and 4 at once.** All stackless. Integration tests use the shared test Postgres.
  - 2 owns `packages/data/src/errors/`, `permissions/` and `db/schema/`.
  - 3 owns `packages/api/src/`.
  - 4 owns `apps/web/app/lib/` and its importers.
  - All three edit `scripts/loops/check-areas.d/`. Each one adds and changes only the rules for paths it moves, on separate lines. Merge in number order and resolve any adjacent hunks.
  - 3 and 4 don't overlap: web code calls the API through the inferred client, and its paths don't change.
- **Wave 3: slice 5** (routes and URLs), on top of 4's lib folders.
- Merge in number order within a wave, with no checks between merges.
- **Checks:**
  - Every slice runs `pnpm check`, plus `pnpm test:components --changed prd/code-layout` when it moves files that screens import.
  - **Loops run no browser checks.** The changes map to `@suite`, or to every screen, and the user chose one lean `--suite` at the final landing. The hand-off still shows `pnpm prd browser --changed --list` output, so the orchestrator knows what the suite covers.
- **Running beside other PRDs:** none on these files (see _Start condition_). If `dev` gains a change to a moved file during a wave, the orchestrator replays it at the new path during `pnpm prd sync`.
- Every slice ends with a hand-off (AGENTS.md, _Loop rules_), plus the old → new path table and a _Docs_ section listing what the orchestrator should fold in.

---

## Slice 1: check-areas by area, most specific wins

Stack: no · Reads: docs/loops.md · Tests: unit

**User stories:** 7, 8, 9, 10, 11, 12, 19, 20.

**What to build:**

- A Node resolver module in `scripts/loops/`, with a small CLI (`resolve <file>…` prints each file's checks in today's format, and `lint`):
  - reads every file in `scripts/loops/check-areas.d/`, with today's line format (a bash-style glob where `*` also matches `/`, then checks, `-`, `@suite` or `@self`, and comments);
  - picks the most specific match across all files: the longest literal prefix before the first wildcard, then fewer wildcards, then the longer pattern; anything still tied is an error;
  - then the built-in fallbacks: a lib module with a sibling `.test.ts` needs no check unless it is `*.sync.ts` or under `lib/sync/`, and anything else unmapped gets `$unmapped_default` with the warning.
  - `@self` keeps today's behaviour, including "`- (deleted)`" for a check the change removed.
- `browser.sh --changed` calls the resolver in place of its bash loop. Its output (the ■ lines, the table, the unmapped warning) doesn't change.
- Split today's `check-areas` into `check-areas.d/_global` (docs, tooling, config, build and `@suite` files, the checks themselves, email) and one file per area. Delete the old file, and point every reference to it (`browser.sh` and the `prompt.sh` text) at the folder.
- A one-off comparison, run before deleting the old file and pasted into the hand-off: for every `git ls-files` path, the old and new resolvers give the same checks. Any difference is listed and justified (expected: none).

**Acceptance criteria:**

- [ ] A resolver unit test covers specificity order across two files, a tie reported as an error, `-`, `@suite`, `@self` (present and deleted), the unit-tested fallback with its `.sync.ts` and `lib/sync/` exclusions, and the unmapped default.
- [ ] A lint unit test over the real tree passes: every tracked app file maps, no rule is dead, no glob is duplicated across files, and no tie remains.
- [ ] The old/new comparison is in the hand-off with no unexplained difference.
- [ ] `pnpm prd browser --changed --list` on a sample diff (one lib module, one screen, one doc) gives the same output before and after.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 2, 3, 4.

---

## Slice 2: Data registries by area (errors, permissions, schema)

Stack: no · Reads: docs/domain/data-layer.md, docs/layout.md · Tests: unit, integration

**User stories:** 3, 4, 5, 24, 25, 27, 28.

**What to build:**

- **Errors:**
  - split `SERVICE_ERRORS` into `errors/<area>.ts` parts, keeping the `DB`, `MODEL`, `PERMISSION` and `NOTIFICATION` groups;
  - compose `ERRORS` and `ERROR_KEYS` from the parts, with literal types intact (`isError` narrowing and `AppError` codes unchanged).
- **Permissions:**
  - move the building blocks into a shared module, and put each area's tables in `permissions/<area>.ts`, each `satisfies` a partial `Permissions`;
  - `PERMISSIONS` is their spread and still `satisfies Permissions`.
- **Schema:**
  - move the table files into `db/schema/<area>/` folders, each with an `index.ts`, and the shared helpers (`columns`, `uuidV5`, `timeZone`, `contactFields`, `entryTiming`…) into `db/schema/core/`;
  - the top `index.ts` lists the folders only;
  - rewrite the imports inside `packages/data` (and any deep imports elsewhere);
  - the `@caretook/data/schema` export names stay the same.
- Update the `check-areas.d` rules for the moved schema paths (one rule per schema area folder where the checks agree).

**Acceptance criteria:**

- [ ] `pnpm datastore:generate` against this branch generates no migration (say so in the hand-off).
- [ ] A unit test: every table exported by the schema has a `PERMISSIONS` entry. This is in addition to the type check.
- [ ] A unit test: error codes are unique across the parts (a duplicate in two parts fails).
- [ ] A unit test: `Object.keys` of the schema module's exports equals the frozen list taken before the move.
- [ ] `permissions.test.ts` and every integration test pass, with only their import paths changed.
- [ ] The check-areas lint passes, and the hand-off has the old → new path table.
- [ ] `pnpm check` passes.

**Blocked by:** 1. **Blocks:** none.

---

## Slice 3: API router by area

Stack: no · Reads: docs/domain/api.md, docs/layout.md · Tests: unit, integration

**User stories:** 6, 27.

**What to build:**

- One folder per area in `packages/api/src/`. Move each existing procedure file into its area (invites and join requests to `care-groups/`, the `*Admin` files to `admin/`, `profiles`, `search`, `publicForms` and `announcement` to theirs), with its integration tests beside it.
- Move the procedures defined inline in `router.ts` (care groups, members, recipients, timeline entries, preferences, simple mode…) into their area routers.
- `router.ts` composes the area routers into **the same procedure path tree**. The shared helpers (`procedures`, `errors`, `dto`, `handler`, `rateLimit`, `index`) and `sync.ts` stay at the top.
- Update the `check-areas.d` rules for the moved API paths.

**Acceptance criteria:**

- [ ] A unit test: the router's flattened procedure paths equal the frozen list taken before the split.
- [ ] Every API integration test passes, moved beside its area and with only its import paths changed.
- [ ] `apps/web` typechecks with no change to any web file, which shows that the inferred client is unchanged.
- [ ] The check-areas lint passes, and the hand-off has the old → new path table.
- [ ] `pnpm check` passes.

**Blocked by:** 1. **Blocks:** none.

---

## Slice 4: `lib/` grouped by domain

Stack: no · Reads: docs/layout.md, docs/domain/sync.md, docs/domain/components.md · Tests: unit, component

**User stories:** 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 33, 35.

**What to build:**

- Move every module in `apps/web/app/lib/`, with its tests, into `lib/<area>/` or `lib/core/` by the area rule. `appUrls.ts` and its test move to `lib/app-shell/` as they are; slice 5 splits them.
- Move each domain module in `lib/sync/` into its area folder as `<name>.sync.ts` (its test becomes `<name>.sync.test.ts`, or `.sync.browser.test.tsx`). `lib/sync/` keeps only `client`, `schema`, `index`, `pageCache`, `useLiveRows` and the plumbing they need; the hand-off lists that set.
- Rewrite every importer (about 267 files) with a throwaway codemod. Use direct file paths, with no barrels and no shims.
- Keep the sync client lazy: no module gains a static import of `client`.
- A layout guard unit test (`web:unit`):
  - no `.ts`/`.tsx` directly under `lib/`;
  - nothing under `lib/sync/` outside the plumbing allowlist;
  - every `*.sync.ts` sits in an area folder.
- Rewrite the lib rules in `check-areas.d`: one rule per area folder, and per-file rules only where a file needs different checks. Today's per-file lib rules mostly fold away.

**Acceptance criteria:**

- [ ] The layout guard test passes, and fails on a planted `lib/foo.ts` (shown in the hand-off, then removed).
- [ ] Every moved unit, component and browser-mode test passes unchanged apart from its imports (`pnpm test:components --changed prd/code-layout` and `pnpm check`).
- [ ] `grep` shows no import of `~/lib/sync/<domain module>` and no static import of the sync client outside today's allowed places.
- [ ] The check-areas lint passes. `pnpm prd browser --changed --list` for one pure module, one `.sync.ts` and one screen names what it did before the move (pure: `- (unit-tested)`; sync: its area's checks).
- [ ] The hand-off has the old → new path table and the module → area calls that weren't obvious.
- [ ] `pnpm check` passes.

**Blocked by:** 1. **Blocks:** 5.

---

## Slice 5: Routes and URLs by area

Stack: no · Reads: docs/domain/app-shell.md, docs/domain/components.md, docs/layout.md · Tests: unit, component

**User stories:** 1, 2, 26, 27, 29.

**What to build:**

- **Routes:**
  - each area exports its route pieces from a `routes.ts` beside its route folders (e.g. the medications pieces next to `routes/app/groups/medications/`);
  - the top `apps/web/app/routes.ts` keeps the frame (the `/app` layout, account settings, the group layout, the account routes, the web/native split) and spreads each area's pieces into place;
  - route files, paths and ids stay the same, and the comments explaining static-segment ranking move with their routes.
- **URLs:**
  - move each area's builders and param constants from `appUrls` into `lib/<area>/urls.ts`;
  - `lib/app-shell/appUrls.ts` composes `appUrls` from the parts and keeps the shared helpers (`searchString`, `Search`);
  - callers import param constants from the area part (codemod, no shims);
  - split `appUrls.test.ts` into tests beside each part.
- Update the `check-areas.d` rules for the new `routes.ts` parts and URL parts.

**Acceptance criteria:**

- [ ] A unit test: the composed route config, flattened to (path, file, id), equals the frozen list taken before the split, for both the web and the native composition. It also asserts that no path or id appears twice.
- [ ] A unit test: the `appUrls` keys equal the frozen list. The existing URL tests pass from their new files.
- [ ] `pnpm test:components --changed prd/code-layout` and `pnpm check` pass.
- [ ] The check-areas lint passes, and the hand-off has the old → new path table.

**Blocked by:** 4. **Blocks:** none.
