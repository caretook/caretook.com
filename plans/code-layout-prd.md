# PRD: Code layout (registries by area, `lib/` by domain)

> Backlog items B-149 and B-150. Topic `code-layout`. Plan: [`plans/code-layout-plan.md`](code-layout-plan.md).

## Problem Statement

Several PRDs run at once, and nearly every one of them edits the same handful of files. Over the last 30 days, `scripts/loops/check-areas` changed in 69 commits, `routes.ts` in 46, `appUrls.ts` in 32, `errors/constants.ts` in 28, `db/schema/index.ts` in 26, `router.ts` in 22 and `permissions.ts` in 21. The working rule is "additive edits to shared registries": add at the end, never reorder. It keeps the conflicts small but doesn't stop them. Orchestrators still resolve the same hunks at every sync. Every PRD's hot-files column lists these files, so PRDs that share nothing else still collide on them.

`check-areas` is worse than the others because the first matching rule wins. Where a rule sits decides what it does, so a rule appended "at the end" can be shadowed by a broader one above it, and moving it to fix that is exactly the reorder the rule forbids.

`apps/web/app/lib/` has about 154 flat files, named by prefix (`medication*`, `period*`, `upcoming*`, `quickEntry*`, `simple*`…), plus 44 device-query modules in `lib/sync/`. An agent working on medications can't read "the medications code"; it greps for prefixes across two folders. `check-areas` needs one rule per file instead of one per area, which is a big part of why it changes so often. `docs/layout.md` lists about 25 lib files and is badly out of date.

## Solution

Each shared registry is split into **area parts** that live beside that area's code. A thin index puts the parts together and changes only when an area is added. A PRD that adds a route, a URL, an error, a permission, a table or a procedure edits its own area's part, not a shared list.

`check-areas` becomes a folder of per-area rule files, resolved by **most specific glob wins** instead of first match, so rule order stops mattering. A lint keeps it honest: every file maps to a rule, no rule is dead, and no glob is duplicated.

`apps/web/app/lib/` is grouped into one folder per area, named after the `docs/domain/` area docs, plus `core/` for shared helpers and `sync/` for the sync plumbing alone. Each area's device queries move into its folder, with a `.sync.ts` suffix. Imports point straight at files (no barrels), and the moves leave no re-export shims behind.

Guard tests keep the layout from sliding back: no new flat lib modules, registry completeness, and the check-areas lint.

Nothing a user sees changes. Every URL, route, procedure path, error code, permission and table stays the same, and no migration is generated.

## User Stories

1. As a loop agent adding a route, I want to edit only my area's route part, so that my change never conflicts with another PRD's new route.
2. As a loop agent adding a URL builder, I want it to sit in my area's URL part, so that `appUrls` isn't a file every PRD edits.
3. As a loop agent adding a service error, I want to add it to my area's error part, so that the 500-line `SERVICE_ERRORS` object stops being a conflict hotspot.
4. As a loop agent adding a table, I want to add its file and its export inside my area's schema folder, so that the top schema index doesn't change.
5. As a loop agent adding a table's permissions, I want to write them in my area's permissions part, so that `permissions.ts` stops collecting every PRD's hunk.
6. As a loop agent adding procedures, I want an area router in `packages/api/src/<area>/`, so that `router.ts` only lists areas.
7. As a loop agent adding a browser-check rule, I want to put it in my area's rule file, without caring where it sits in the file, so that a broader rule can't shadow it.
8. As a loop agent, I want the resolver to pick the most specific matching glob, so that a rule for one file beats its folder's rule wherever it is written.
9. As a loop agent, I want the check-areas lint to tell me when a file I added maps to no rule, so that I add one before hand-off instead of the run falling back to the default checks.
10. As an orchestrator, I want the lint to fail when two rule files hold the same glob, so that two PRDs can't silently give one path different checks.
11. As an orchestrator, I want the lint to flag a rule that matches no tracked file, so that rules for moved or deleted files don't pile up.
12. As an orchestrator, I want `pnpm prd browser --changed` to name the same checks for the same files before and after the conversion, so that the browser check budget doesn't shift under me.
13. As an orchestrator syncing `dev`, I want two PRDs' registry additions to land in different files, so that most syncs have no conflicts at all.
14. As an agent reading one area, I want all of its web-side modules (pure logic, device queries, URL builders) in one `lib/<area>/` folder, so that I can read the area without grepping prefixes.
15. As an agent, I want the lib folders named after the area docs, so that the area index tells me both which doc to read and which folder to open.
16. As an agent, I want shared helpers (format, paging, zoned days, initials, redirects, forms) in `lib/core/`, so that I know they belong to no one area.
17. As an agent, I want `lib/sync/` to hold only the sync client, the device schema and shared plumbing, so that "the sync layer" is small and readable.
18. As an agent, I want device-query modules to end in `.sync.ts`, so that I (and the resolver) can tell them from pure modules at a glance.
19. As an agent writing a pure module with a unit test, I want it to still need no browser check, so that the unit-tested fallback keeps working in the new folders.
20. As an agent writing a device-query module, I want the unit-tested fallback not to apply to it, so that a sync change still runs the checks its area needs.
21. As an agent, I want to import a lib module by its file path, so that there's no barrel to edit or to drag the lazy sync client into a static import.
22. As an agent, I want a guard test to fail if I add a module directly under `lib/` (outside `core/` and `sync/`), so that the flat layout doesn't come back.
23. As an agent, I want a guard test to fail if a domain device module is left in `lib/sync/`, so that the split stays clean.
24. As an agent, I want a completeness test to fail when a table has no permissions entry, so that a part I forgot to wire into the index is caught before review.
25. As an agent, I want a test to fail when two error parts define the same code, so that spreading the parts can't silently overwrite one.
26. As an agent, I want a test to fail when two route parts claim the same path or id, so that a route part can't shadow another.
27. As an orchestrator, I want the composed routes, URL keys, procedure paths and error codes to equal what they were before the split, so that a pure refactor is shown to be pure.
28. As the user, I want no migration generated by moving the schema files, so that the database is untouched.
29. As the user, I want no screen, URL or API to change, so that this PRD can land without release notes.
30. As an orchestrator of a later PRD, I want each PRD's hot-files column to name area parts, not shared registries, so that more PRDs can run side by side.
31. As the dev keeper, I want the old "additive edits to shared registries" rule replaced by "edit your area's part" at landing, so that the rules match the code.
32. As the dev keeper, I want `docs/layout.md` rewritten to the new layout at landing, so that agents stop reading a stale map.
33. As an orchestrator, I want each slice's moves and import rewrites in one commit with no shims, so that a later PRD rebasing onto `dev` gets compile errors pointing at the new paths, not stale stubs.
34. As an orchestrator, I want the lean browser set run once at landing, so that a refactor across every screen is checked end to end without a suite per slice.
35. As a loop agent, I want my slice's hand-off to include a table of moved paths (old → new), so that the orchestrator and later PRDs can map stale references.

## Implementation Decisions

### Scope

- **The seven registries B-149 names:** `scripts/loops/check-areas`, `routes.ts`, `appUrls.ts`, `errors/constants.ts`, `db/schema/index.ts`, `permissions.ts` and `packages/api/src/router.ts`. Plus **all of `apps/web/app/lib/`** (B-150).
- Not in scope: `services/index.ts`, `models/index.ts`, `seeds/index.ts`, the `sync.ts` upload switch, the device schema, `sync-config.yaml`, `KIND_META` and `GROUP_SECTIONS`. They keep the additive-edit rule for now.

### Areas

- One area list, used for every folder and part name: the `docs/domain/` areas: `app-shell`, `care-groups`, `timeline`, `live-notes`, `providers`, `medications`, `appointments`, `care-periods`, `search`, `profiles`, `assistant`, `auth`, `admin`, `marketing`, `notifications` where needed. Plus `core` for helpers no single area owns.
- A module goes to the area whose doc owns its concept. When a module serves two areas, it goes to the area that defines the data it reads, and the hand-off records the call.
- A registry gets parts only for the areas that have entries in it. No empty parts.

### check-areas

- **The resolver** is a new Node module in `scripts/loops/` (with a small CLI), replacing the bash loop in `browser.sh`. `browser.sh --changed` calls it and its output format doesn't change.
- **Rule files:** `scripts/loops/check-areas.d/<area>`, plus a `_global` file for docs, tooling, build, config, migrations and the checks themselves. The line format stays the same: a glob (bash pattern, where `*` also matches `/`), then checks, `-`, `@suite` or `@self`. Comments are allowed.
- **Most specific wins.** Among all matching rules in all files, the winner is the one with the longest literal prefix before its first wildcard. Ties go to fewer wildcards, then to the longer pattern. Any tie that remains is a lint error. File order and line order never matter.
- **Built-in fallbacks** stay after the rules:
  - A `.ts`/`.tsx` module under `apps/web/app/lib/` with a sibling `.test.ts` needs no check, **unless** it ends in `.sync.ts` or sits under `lib/sync/`.
  - Anything else unmapped gets the default checks, with a warning.
- **The lint**, run by a unit test over the real tree:
  - every tracked app file resolves to a rule or a fallback;
  - every rule matches at least one tracked file;
  - no glob appears twice across the files;
  - no unresolvable tie.
- **Conversion:** a one-off run, kept only in the slice's hand-off, shows that the old and new resolvers give every tracked file the same checks. Where folders now get one rule in place of many per-file rules, any check a file gains or loses is listed in the hand-off and justified.

### Registries split by area (parts beside the area's code)

- **Errors** (`packages/data/src/errors/`): `SERVICE_ERRORS` is split into one part per area (`errors/<area>.ts`). `DB_ERRORS`, `MODEL_ERRORS`, `PERMISSION_ERRORS` and `NOTIFICATION_ERRORS` stay as they are. `ERRORS` and `ERROR_KEYS` are composed from the parts, and the `as const` literal types are kept, so `isError(…, code)` narrowing doesn't change.
- **Permissions** (`packages/data/src/permissions/`): one part per area (`permissions/<area>.ts`), each `satisfies` a partial of `Permissions`. The building blocks (`NO_ACCESS`, `SYSTEM_ONLY_*`…) move to a shared module. `PERMISSIONS` is the spread of the parts and still `satisfies Permissions`, so a missing table is a type error, and the completeness test catches it at runtime too.
- **Schema** (`packages/data/src/db/schema/`):
  - table files move into area folders, each with its own `index.ts`; shared column helpers (`columns`, `uuidV5`, `timeZone`…) go in a `core/` folder;
  - the top `index.ts` lists only the area folders;
  - drizzle-kit's schema entry stays the top index;
  - `pnpm datastore:generate` must produce **no migration**;
  - `@caretook/data/schema` exports exactly the same names.
- **API router** (`packages/api/src/`):
  - one folder per area holding its procedure files (the existing `invites.ts`, `groupsAdmin.ts`, `profiles.ts`… move in) and an area router;
  - procedures defined inline in `router.ts` move into their area routers;
  - `router.ts` composes the area routers, and the **procedure path tree stays identical**, so web callers and the inferred client types don't change;
  - shared helpers (`procedures`, `errors`, `dto`, `handler`, `rateLimit`) stay at the top. So does `sync.ts` (the upload switch is out of scope).
- **Routes** (`apps/web/app/routes.ts`):
  - each area exports its route config pieces from a `routes.ts` beside its route folders;
  - the top `routes.ts` keeps the frame (the `/app` layout, the group layout, the web/native split) and spreads the area pieces into it;
  - route files, paths and ids stay the same;
  - **Shared routes still never export server loaders**; nothing about the native build changes.
- **URLs** (`appUrls`):
  - each area's builders and its param constants (`DOSE_*_PARAM`, `PROFILE_SHEETS`, `SEARCH_*_PARAM`…) move to `lib/<area>/urls.ts`;
  - the composed `appUrls` object lives in `lib/app-shell/appUrls.ts` and is the only place that imports every area's URL part;
  - callers import param constants straight from the area part;
  - `appUrls.test.ts` is split into tests beside each part.

### `lib/` by domain

- **Folders:** `lib/<area>/` for each area that has modules, `lib/core/` for shared helpers, and `lib/sync/` for the client, the device schema, `index`, `pageCache`, `useLiveRows` and other shared plumbing only.
- **Device queries:** each domain module in `lib/sync/` moves into its area folder, renamed `<name>.sync.ts` (e.g. `lib/medications/medications.sync.ts`). Tests move with their modules and keep their names (`medications.sync.test.ts`).
- **The lazy-client rule is unchanged:** no static import of the sync client. A `.sync.ts` file imports the plumbing exactly as it does today.
- **Imports are direct file paths** (`~/lib/medications/medicationList`); no `index.ts` in lib folders.
- **Codemod, no shims:** each slice moves its files and rewrites every import in the same commit (a small throwaway script, not committed and not a dependency). No re-export stubs are left at old paths.
- **Layout guard** (unit test):
  - no module directly under `lib/` except an explicit, short allowlist (expected empty);
  - nothing under `lib/sync/` except the plumbing allowlist;
  - every `*.sync.ts` sits in an area folder.
- `check-areas.d` gets one rule per lib area folder, plus per-file rules only where a file needs different checks.

### Order and running beside other PRDs

- It runs alone on these files. It starts after `tasks` and `hosting` wave 1 are in `dev`, with nothing else touching `lib/` or the registries while it runs. Slice 1 starts only when no running PRD has unmerged `check-areas` edits (`check-migration` adds rules there).
- After it lands, other PRDs add to their area's parts. The orchestrator replaces the "additive edits to shared registries" rule in AGENTS.md for these seven registries, keeps it for the out-of-scope ones, rewrites `docs/layout.md`, and points the `docs/loops.md` check-areas text at the resolver and `check-areas.d/`.

## Testing Decisions

- **A good test here checks the composed result against the behaviour that must not change** (the same paths, keys, codes and checks), never the internal layout of a part.
- **Resolver unit tests** (`scripts:unit`, beside the module, like `slice-fields.test.mjs`):
  - most-specific ordering, ties and the tie error;
  - `-`, `@suite`, `@self` (including a deleted check);
  - the unit-tested fallback and its `.sync.ts` and `lib/sync/` exclusions;
  - the unmapped default.
  - Small rule fixtures, written inline.
- **The check-areas lint test** runs over the real `check-areas.d/` and `git ls-files`: no unmapped app file, no dead rule, no duplicate glob, no tie.
- **Registry completeness units:**
  - every table name in the schema has a `PERMISSIONS` entry;
  - error codes are unique across parts;
  - no two route parts give the same path or route id, for both targets' composed configs;
  - the composed route list (path, file, id), the `appUrls` keys and the API procedure paths equal frozen lists taken before the split. Each list is a small inline fixture in its test, and a later PRD updates it when it adds an entry.
- **The layout guard unit** (`web:unit`): the lib folder rules above.
- **Existing tests keep passing, moved and not rewritten:** the lib unit tests, the component tests, the API and data integration tests, and `permissions.test.ts`. A slice changes only their import paths.
- **No new browser checks**, and loops run none: every change here maps to `@suite` or to every screen. The orchestrator runs the lean set once (`pnpm prd browser --suite`) before landing the PRD.
- Prior art: `slice-fields.test.mjs` and `checks.test.mjs` (tooling units), `permissions.test.ts` (the permission table), `appUrls.test.ts` (URL builders).

## Out of Scope

- Splitting `services/index.ts`, `models/index.ts`, `seeds/index.ts`, the `sync.ts` upload switch, the device schema, `sync-config.yaml`, `KIND_META` or `GROUP_SECTIONS`.
- Regrouping `packages/data` models and services, `apps/web/app/components/` or `routes/` into area folders (they are already foldered by route or feature).
- Any behaviour, URL, API, schema or permission change, and any migration.
- New dependencies (the codemod is a throwaway script).
- Splitting the browser checks themselves (`check-migration` owns them).

## Further Notes

- Run it when few PRDs are open: it touches about 300 importers. The backlog's PRD table already says it needs `tasks` and `hosting` wave 1 in `dev` first.
- `agent-tooling` (B-147, B-148…) also rewrites AGENTS.md and `docs/loops.md`. Whichever lands second rebases its doc edits onto the first.
- After this lands, a PRD's hot-files column should name area parts (e.g. "`lib/medications/`, the medications parts"), so the PRD table can show real overlaps.
