# Plan: Test health 2, the coverage the first pass left out

> PRD: [`plans/test-health-2-prd.md`](test-health-2-prd.md). User-story numbers (US) refer to it. Items B-371, B-372, B-373, B-374. Starts after `test-gates-2` and `sync-safety`.

## Status

| Slice                                       | Wave | State                          | Merge    |
| ------------------------------------------- | ---- | ------------------------------ | -------- |
| 1. A rejected batch can't block the queue   | 1    | landed f4281e0 (PR #147, opus) | 159df711 |
| 2. Every entry point refuses                | 1    | landed f4281e0 (PR #147, opus) | 0b9da399 |
| 3. Fixtures in the shape devices receive    | 1    | landed f4281e0 (PR #147, opus) | 04f07d63 |
| 4. Round trip compares columns              | 1    | landed f4281e0 (PR #147, opus) | 9e03018d |
| 5. Round trip through the app's own writers | 2    | landed 2724ace (PR #151, opus) | fd67ffc4 |
| 6. A second time zone                       | 3    | merged (opus)                  | 84cb89b2 |

**Landing mode:** run everything through (started run-through): start every ready slice, land each green wave, clean up, ask only real questions through `pnpm prd ask`.

**Wave 2 landed** in `dev` as 2724ace through PR #151, **without a Codex review (out of credits)**, at tier `full` (it edits `ci.yml`), run 45408126170 green on e4effb6a. Dev moved twice during the landing (symptom-catalog, then fixes-tooling wave 4, which touched `loop.md`), so `full` ran three times; budget for that. Browser checks on ec1c138e: `roundtrip` 39 s, `live-notes`, `first-sync` pass. Report a183; to-test file `to-test/2026-11-24-0903-test-health-2.md`. B-371 done. Docs folded: loop.md (the sync matrix's app writers, the module hook; trimmed, 15323 of 15360). Slice 5 worktree removed.

**Wave 3 (session 2026-11-24):** B-372 claimed; B-750 filed (fixes-bug umbrella for second-zone overflow, the new `ZONE_OVERFLOW_ITEM`); worktree `test-health-2-6` made, opus agent spawned (told: `ZONE_OVERFLOW_ITEM` → B-750). Handed off on fdbd0007 (slice check green; `web:components:ny` 53 files pass by hand, no NY skips, no new items), merged 84cb89b2, B-372 done. It edits `ci.yml`: gate tier `full`, run requested. Watch the 20-min component-shard timeout (+53 files). Fold into components.md at landing: the second-zone project, `test/zone.ts` (`inSecondZone` the only NY-only skip; `recipientTime`, `deviceTime`), medication world `CLOCK` in the recipient's zone. Follow-up idea: `check-body.sh` runs a slice's own component files only in LA.

**Wave 3, slice 6** (opus; Stack: no). Its blocker `test-gates-2` slice 5 landed (4160dee5). Tell its agent: repoint `ZONE_OVERFLOW_ITEM` in `scripts/ci/release.mjs` (and `release.test.mjs`'s two `B-372` expectations) from B-372 to a live item (file one, e.g. a `fixes-bug` umbrella for New York failures past the cap); B-706 to B-715 are the New York failures already filed; slice 3's `fixtureProblems` could run the `*World.tsx` worlds. Gate: the check plan's tier. This is the last wave: after it lands, `pnpm prd rm test-health-2`, then `cd` to the main checkout and `pnpm prd end`.

**Follow-ups noted:** B-749 (fixes-tooling): add `roundtrip` to the check-areas rules of the `*.sync.ts` writers it now calls (todos, allergies, conditions, medicationConditions, notes); slice 5's `note_update` writer types into a `Y.Text` named "matrix", not the editor's XML fragment.

**Notes from wave 1:** slice 2 found no holes; three list reads (`timeline.list`, `latestVitals`, `members`) answer an outsider with an empty list, not an error, by design. The removal step adds a 4th device to `roundtrip` (about 3 s).

## Architectural decisions

- **No migration, no schema change, no new dependency.**
- **Sweeps read the registries** (the router tree, `UPLOAD_REGISTRY`), so a new procedure or table is covered without an edit.
- **All test data is fictional.**
- **A hole a test finds:** care data exposed or writable by the wrong person is never skipped or quarantined. Fix it in the slice when the fix is small and changes no intended access; otherwise stop and ask (`pnpm prd ask --waits`).
- **No new browser check.** The round trip stays in `roundtrip`, inside its cap.
- **`sync-matrix.mjs` takes additive edits only:** it's a hot file for `planner-3` and `tags`, so writers live in a separate map keyed by table.

## How to run this plan

- **Wave 1:** slices 1, 2, 3 and 4 (uploader, API tests, device fixtures, the `roundtrip` check: no shared file).
- **Wave 2:** slice 5, on slice 4's comparison.
- **Wave 3:** slice 6, last, so its New York run includes the corrected fixtures.
- **Gates:** `pnpm prd check` per slice; `roundtrip` at the gates of waves 1 and 2.

## Slice 1: A rejected batch can't block the queue

Stack: no · Reads: docs/domain/sync.md, docs/domain/components.md · Tests: component

Covers B-374. US 1, 2, 3.

**What to build.** In the uploader: a 400 for the whole request resends the batch's ops one per request, in order. An op refused alone with a 400 is recorded as not saved, with its data, and leaves the queue. If a single-op request fails any other way, the resend stops, only the ops already answered are acknowledged (through `sync-safety` slice 3's partial acknowledgement), and the uploader throws so PowerSync retries.

**Acceptance criteria**

- [ ] A device test: a batch of three whose second op is malformed gets a 400 whole, then the first and third are applied, the second is listed in `unsaved_change` with its data, and the queue is empty.
- [ ] A device test: a 500 on the second single-op resend leaves the first acknowledged, the rest queued, nothing recorded, and the uploader throws.
- [ ] A device test: a 500, a 401 and a network failure for the whole request acknowledge nothing and record nothing.

**Blocked by:** `sync-safety` slice 3. **Blocks:** nothing.

## Slice 2: Every entry point refuses

Stack: no · Reads: docs/domain/api.md, docs/domain/data-layer.md, docs/domain/sync.md, docs/domain/care-groups.md, docs/domain/admin.md · Tests: integration

Covers B-373 (the API side). US 4, 5, 6, 7.

**What to build.** A sweep that walks the router and calls every procedure signed out, with one explicit list of public procedures. One parametrised upload test across `UPLOAD_REGISTRY`, and the oRPC care reads, as an outsider, a removed member still holding a session, a support account (`createUser` with the support role: `createWorld`'s `staff` is an admin) and an admin who isn't a member.

**Acceptance criteria**

- [ ] Integration: all non-public procedures answer `UNAUTHORIZED` signed out, and a stand-in procedure added to the walked tree is caught.
- [ ] Integration: on each of the 15 upload tables, each of the four people is refused the op types the table allows, and Postgres is unchanged.
- [ ] Integration: the same four are refused on `timeline.list`, `timeline.latestVitals`, `search.query` and the other care reads.
- [ ] A table in the registry with no case fails the test.

**Blocked by:** nothing inside this plan. **Blocks:** nothing.

## Slice 3: Fixtures in the shape devices receive

Stack: no · Reads: docs/domain/sync.md, docs/domain/components.md · Tests: component

Covers B-371 (the fixtures note). US 8.

**What to build.** A test helper that converts a device fixture from the wire shape, with a small test-only converter, and validates it against the server's Zod schema for its table. Correct the fixtures that fail.

**Acceptance criteria**

- [ ] Component-project test: the default fixture for every synced table with a server schema passes, and a deliberately wrong JSON column fails.

**Blocked by:** nothing. **Blocks:** 6.

## Slice 4: Round trip compares columns

Stack: yes · Reads: docs/domain/sync.md, docs/domain/care-groups.md, docs/agents/loop.md · Tests: unit, e2e:roundtrip

Covers B-371 (the comparison) and B-373 (a removed member's device). US 6, 10.

**What to build.** The check compares every column in each table's sync stream on both devices, with named exceptions for server-set columns. One more step removes a member and asserts the group's rows leave that member's device.

**Acceptance criteria**

- [ ] `roundtrip`: each matrix row's columns match on the second device.
- [ ] `roundtrip`: after removal, the removed member's device holds none of the group's care rows.
- [ ] Unit (`sync-matrix.test.mjs`): an exception naming a column the stream doesn't list fails.
- [ ] `roundtrip` stays inside its 120 s cap.

**Blocked by:** nothing inside this plan. **Blocks:** 5.

## Slice 5: Round trip through the app's own writers

Stack: yes · Reads: docs/domain/sync.md, docs/agents/loop.md · Tests: unit, e2e:roundtrip

Covers B-371 (the writers). US 9.

**What to build.** A separate map, keyed by table, gives each uploadable table its app writer, called through the dev and check-build module hook, which grows to include todos, allergies and conditions. A table with no single writer of its own (a link table written with its parent) names the writer that produces it.

**Acceptance criteria**

- [ ] `roundtrip`: every uploadable table's row is written by an app writer, and slice 4's comparison passes on it.
- [ ] Unit (`sync-matrix.test.mjs`): an uploadable table with no writer in the map fails.
- [ ] The module hook is absent from a production build, and `roundtrip` stays inside its 120 s cap.

**Blocked by:** 4. **Blocks:** nothing.

## Slice 6: A second time zone

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md, docs/domain/medications.md, docs/domain/appointments.md · Tests: component, unit

Covers B-372. US 11, 12.

**What to build.** A separate Vitest project, `web:components:ny`, with its own browser port and the device in America/New_York through `test-gates-2`'s zone setting, for the timeline, doses and events tests. Recipient fixtures stay in Los Angeles. Pin `TZ` in the node test projects. Fix what fails on those screens; a fix too big for the slice becomes a `fixes-bug` item with a New York-only skip naming it (never the shared quarantine). Repoint `test-gates-2`'s filing overflow from B-372 to a live item.

**Acceptance criteria**

- [ ] The named tests pass in both zones, apart from New York-only skips that each name a filed item.
- [ ] A component test with the device in New York and the recipient in Los Angeles shows a dose's day and time correctly across midnight.
- [ ] Unit: node projects report the pinned zone.
- [ ] The release tier's overflow note goes to a live item, not B-372.

**Blocked by:** 3, and `test-gates-2` slice 5. **Blocks:** nothing.
