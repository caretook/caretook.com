# PRD: Code health

Topic `code-health`. Backlog items B-361, B-365, B-366, B-367 here; B-362 and B-363 in the follow-on `code-health-2`; B-364, B-368 and B-369 in `code-health-3` (neither planned yet). From the 2026-11-21 code review; the planner re-checked each finding against the code (_Notes_).

## Decisions

Costliest to change first. Nothing was asked: no item changes what the product does, who can see or change what, stored data or a dependency.

| Decision                                                                                                                                                                                                                                                                                                                                                                               | Why                                                                                                                                                                | Source                                             | Cost to change later                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Nine items become three topics. `code-health` (this PRD): exact pins (B-366), dead exports (B-365), the backlog lock and merge-path tests (B-367), the domain export (B-361). `code-health-2`: the model factory, upsert and device helpers (B-362) and the role table (B-363). `code-health-3`: typed device reads (B-364), query round trips (B-369), plan-pointing comments (B-368) | a PRD stays at about six slices; this cut starts what collides least with the running PRDs and leaves what waits on `simple-mode` and `sync-safety` for after them | preference (small PRDs); the assignment is assumed | low: a backlog `set` until a slice starts                                                                   |
| `@caretook/data/schema` stops exporting the pure logic once it moves: importers switch to `@caretook/data/domain` in one sweep (slice 6), with no lasting re-export                                                                                                                                                                                                                    | two paths for one name is the mess the item describes; a re-export kept "for now" never leaves                                                                     | assumed                                            | medium: restoring the re-export is one line, but other PRDs' branches fix their imports when they next sync |
| The role-capability table (B-363) waits for `simple-mode`, and becomes "finish what it leaves"                                                                                                                                                                                                                                                                                         | `simple-mode` is running and already builds the role sets and `canWrite`/`canLog` in the same files; the item's "do it first" is no longer possible                | assumed                                            | low                                                                                                         |
| Pins take the version the lockfile already resolves: no version moves. Later bumps stay by hand, each on the user's word, as AGENTS.md says; no update bot                                                                                                                                                                                                                             | the item is about the range form only; AGENTS.md already sets the rule                                                                                             | assumed                                            | low: one `package.json` line each                                                                           |
| A test refuses any range in a workspace `package.json` from then on                                                                                                                                                                                                                                                                                                                    | the rule slipped 47 times with nothing checking it                                                                                                                 | assumed                                            | low                                                                                                         |
| Kept, not removed: the oRPC procedures the API doc keeps "for later" (`timeline.*`, `careGroup.members`, `careGroup.recipientDetails`, `search.query`) and the connector test helpers under `src`                                                                                                                                                                                      | the item's title doesn't list them, the note calls them medium confidence, and a browser check imports one helper                                                  | assumed                                            | low                                                                                                         |
| `isUserRoleName` and `isGroupRoleName` are removed in `code-health-2`'s role slice, not here                                                                                                                                                                                                                                                                                           | they live in the roles file `simple-mode` is changing now, and it may start reading them                                                                           | assumed                                            | low                                                                                                         |
| No tool for finding dead exports afterwards                                                                                                                                                                                                                                                                                                                                            | it would be a new dependency; the removal is a one-off                                                                                                             | assumed                                            | low                                                                                                         |
| The `CARETOOK_*` knobs get one reference page, and a test that every knob the scripts read is on it                                                                                                                                                                                                                                                                                    | 57 knobs are read and 25 are documented; a list nobody checks goes stale again                                                                                     | assumed                                            | low                                                                                                         |
| No comment sweep here; slices in this PRD leave no new plan pointers (B-368 stays whole in `code-health-3`)                                                                                                                                                                                                                                                                            | the item says low priority and opportunistic; a sweep across 154 files would collide with every running PRD                                                        | assumed                                            | low                                                                                                         |

**The skeptic pass:** what it changed is under _Notes_; it declined nothing and moved nothing to "ask".

## Problem

The 2026-11-21 review found the code works but is harder to change safely than it should be, for a person and for the agents that do most of the work:

- About half of the database schema folder isn't schema: the quick entry parser, due doses, medication wording, series edits and more live beside the tables, because that folder is the only broad export a browser may import. 344 web files import one barrel, and four old import paths survive as one-line shims.
- 47 dependencies float on caret ranges although the rule is exact pins, so an install can bring a version nobody approved.
- Scaffolding nobody reads is still exported (a service registry, a `serviceName` on every service, a handful of helpers), and each one looks like something a change must keep working.
- The scripts that merge work into `dev` are thinly tested (`pr.sh`, `ready.sh` and `review.sh` not at all), and the backlog's lock can be taken by two writers at once when a stale lock is cleared.
- Repeated model, upsert and device helper code, role checks, hand-typed device rows, plan-pointing comments and extra queries: real, but they wait on running work (the follow-on topics).

## Solution

Nothing a caretaker sees changes. For the user as owner and for agents:

- Pure logic has its own client-safe home, `@caretook/data/domain`, a folder per area; the schema folder holds tables, relations, row types and Zod schemas only, and a test keeps it that way.
- Every dependency is pinned exactly, and a test refuses a range.
- The unused exports are gone.
- The backlog lock can't be held twice, the merge path has tests for each script, and every `CARETOOK_*` knob is documented.

## User stories

1. As the owner, I want every dependency pinned to an exact version, so that an install never brings in a version I didn't approve. (B-366)
2. As the owner, I want a check that fails when a range is added, so that the rule holds without my reading every `package.json`. (B-366)
3. As an agent changing a service, I want no unused registry, `serviceName` or helper exports, so that I don't spend effort keeping dead code working. (B-365)
4. As an agent, I want a removal to prove the name had no reader, so that nothing live is deleted. (B-365)
5. As the owner running several agents, I want the backlog lock held by one writer at a time, even when a stale lock is cleared, so that two backlog writes never interleave. (B-367)
6. As the owner, I want tests on each script that merges, opens a PR, marks a slice ready or waits for a review, so that a tooling change can't quietly break landing. (B-367)
7. As an agent, I want every `CARETOOK_*` knob documented in one place and the leftover browser-lease path gone, so that I can find what a script reads. (B-367)
8. As an agent, I want pure logic (quick entry parsing, due doses, medication wording, series edits, vitals, search text) under a `domain` export, so that I can find and test it without reading table definitions. (B-361)
9. As an agent adding a table, I want the schema folder to hold only tables, relations, row types and Zod schemas, with a test that says so, so that the split doesn't erode. (B-361)
10. As an agent, I want one import path per name and no "keeps the old import path" shims, so that I never have to choose between two. (B-361)
11. As the owner, I want the follow-on work (model and upsert helpers, role table, typed device reads, round trips, comments) parked in named topics with what each waits on, so that none of the review is lost. (B-362, B-363, B-364, B-368, B-369)

## Implementation decisions

**Pins.** Each `^` or `~` specifier in the root, web and package manifests becomes the exact version the lockfile resolves for it. The lockfile changes only its specifier lines; no resolved version moves. `workspace:` specifiers stay. A tooling test in the default run reads every workspace manifest and fails on anything that isn't an exact version or a `workspace:` specifier, in every dependency group.

**Dead exports.** Removed after a search of the whole repository (source, tests, scripts) shows no reader: `serviceName` on every service, the `services` registry with its `getService`, `isServiceName` and the `ServiceName` types, `initClient`, `primaryContactName`, `hasContact`, `CALENDAR_CARDS`, `COMING_SOON`. The base service's own `getService` (a different function, in use) stays. A name with a reader stays and is reported. A test that only exercises a removed name goes with it.

**The backlog lock.** One rule in both implementations (the shell helper the loop scripts use and the backlog CLI's): a stale lock is taken over under a second, short-lived takeover lock that re-reads the age, so of any number of waiters exactly one clears it and a fresh lock is never removed. The lock's age is read one portable way. The 30-second staleness and the waiters' deadline are unchanged.

**The merge path.** Tooling tests in the existing style (throwaway git repositories, a stub `gh` on the path) for the PR opener, the ready gate, the review waiter and the paths of the lander that have none today (the local slice merge, a plan branch, a conflict, the subject rule, the backlog status it writes). A defect a test exposes is fixed when it's a few lines, else filed.

**Knobs.** One reference page lists each `CARETOOK_*` variable the scripts and hooks read: what reads it, its default, what it changes. A tooling test reads the scripts and the page and fails when they disagree in either direction. The browser lease's old-directory handling is removed.

**The domain export.**

- A new client-safe export, `@caretook/data/domain`, with a folder per area (the `docs/domain/` names plus `core`), mirroring the schema folder. `/series` keeps its name and stays a separate export (it loads `rrule`).
- **What moves:** a module under the schema folder that defines no table, relation, row type or Zod schema, with its tests. **What stays:** those definitions, and the column helpers tables are built from. A pure module that needs a Zod schema's value stays, on a short allow-list with its reason.
- **Direction:** the schema may import values from the domain (a list of kinds a table's check uses); the domain imports only types from the schema, and never the database driver or the ORM.
- **Two steps.** First the files move and `/schema` re-exports the domain, so no importer changes and the schema's frozen export list proves no name was lost. Then every importer in the web app and the other packages switches, the re-export and the shims go, the frozen list splits in two (schema, domain), and a layout test enforces what moves, what stays and the direction.
- No behaviour, bundle entry or name changes; the build budget must hold.

## Testing decisions

- **Prior art:** the tooling tests beside the loop scripts (`land.test.mjs`: throwaway repositories and a stub `gh`), the frozen-list tests (`index.test.ts` for the schema's exports), the layout guard for `app/lib`.
- **Pins:** one tooling unit test over the real manifests, with a fixture proving it rejects a caret, a tilde, a tag and `*`.
- **Dead exports:** no new tests; typecheck and the existing suites are the proof.
- **The lock:** a tooling test starts several waiters against a stale lock and asserts their critical sections never overlap, for both implementations; one asserts a fresh lock survives.
- **The merge path:** tooling tests per script, a lean set (shared repository setup per group; about 25 cases in all), because each case spawns git.
- **Knobs:** the agreement test.
- **Domain:** the frozen export lists and the new layout test; the moved modules' unit tests move unchanged and still pass. No component or end-to-end test: nothing a screen does changes.

## Out of scope

- B-362, B-363 (`code-health-2`) and B-364, B-368, B-369 (`code-health-3`).
- Any version bump, an update bot, a dead-export tool.
- The "for later" oRPC procedures and the connector test helpers under `src`.
- Known tooling bugs filed elsewhere (B-239 to B-241, B-454 in `fixes-tooling`), beyond pinning today's behaviour in a test.
- Splitting the quick entry parser or any moved module: files move whole.

## Notes

**What the planner re-checked (2026-11-21):**

- Pure files under the schema folder: 48 files, about 9,300 of 14,300 non-test lines (the item says 6,862 of 14,058; the count depends on what "pure" means, and slice 5 re-derives it). 344 web files and 16 files in the other packages import `/schema`. Six shims under `app/lib`, one of them (todo display) partly real code.
- 47 caret ranges: confirmed.
- `land.sh` already has tests (the PR path, `--recheck`, the to-test file); `pr.sh`, `ready.sh` and `review.sh` have none. The lock race is as described, and the backlog CLI's own lock has the same takeover.
- 57 `CARETOOK_*` names are read under `scripts/`; 25 appear in the docs.
- `simple-mode` (running) defines the role sets in one place and `canWrite`/`canLog` on the device; `sync-safety` (planned) rewrites every soft-delete `upsert` and the upload switch. Hence the follow-on topics' order.

**Follow-on topics:**

- **`code-health-2`** (after `code-health`, `simple-mode`, `sync-safety`): B-363 as what `simple-mode` leaves (a `canComplete`, the role checks in the API's invites and join requests, a test refusing role names outside the role module, removing `isUserRoleName` and `isGroupRoleName` if still unread); B-362 (the soft-delete model factory; one upsert helper on `sync-safety`'s create-if-absent shape; one `invalid`; the device side's `refuse`, `invalid`, `canWrite`, `formString` and `shouldRevalidate`).
- **`code-health-3`** (after `code-health-2`): B-364 (device row types derived from the device schema; the layout guard refusing SQL outside `*.sync.ts`, starting from a frozen list of today's 17 files); B-369 (the list count only on request; the sync PATCH's round trips, after `sync-safety-2`); B-368 (a count that may only fall, then a sweep).

**The skeptic pass (2026-11-21)** found nothing that must be asked. Changed on its findings: slice 5 now owns the browser-check rules that name a moved file (they would have gone dead and failed the check); the pins test lives where the default run already looks, so no slice edits the Vitest config; slice 4's ready-gate cases match what the script does today; six shims, one partial, not four; slice 6 waits for all of `simple-mode` to land, not one slice; the plan says how each shared hot file is handled (`dose-accuracy`, `fixes-bug`, `inbox-agent`, `test-health`) and the registry row lists them; B-363 carries a note that it removes the two role-name guards B-365 names. Declined: nothing.
