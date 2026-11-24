# Plan: Test health 2, the coverage the first pass left out

> PRD: [`plans/test-health-2-prd.md`](test-health-2-prd.md). User-story numbers (US) refer to it. Items B-371, B-372, B-373, B-374. Starts after `test-gates-2` and `sync-safety`.

## Status

| Slice                                       | Wave | State         | Merge    |
| ------------------------------------------- | ---- | ------------- | -------- |
| 1. A rejected batch can't block the queue   | 1    | merged (opus) | 159df711 |
| 2. Every entry point refuses                | 1    | merged (opus) | 0b9da399 |
| 3. Fixtures in the shape devices receive    | 1    | merged (opus) | 04f07d63 |
| 4. Round trip compares columns              | 1    | merged (opus) | 9e03018d |
| 5. Round trip through the app's own writers | 2    | not started   |          |
| 6. A second time zone                       | 3    | not started   |          |

**Landing mode:** run everything through (started run-through): start every ready slice, land each green wave, clean up, ask only real questions through `pnpm prd ask`.

**Now (2026-11-24):** `sync-safety` and `test-gates-2` slice 5 are in `dev`, so wave 1 is ready. B-371, B-373, B-374 claimed. Slices 1 to 4 worktrees made (`.loops/test-health-2-<n>`; 4 has a stack), one opus agent each spawned. Slice 2 found no holes; the router now has 91 procedures (8 public), not 89. Slice 3 changed `fx.group` and `fx.member` defaults (not-null switches), so other component tests first meet them in the wave's CI run. Slice 4 merged 9e03018d (roundtrip 48 s at load 66, removal step adds a 4th device, ~3 s); B-373 done, B-371 stays open for slice 5. **Wave 1 gate:** `components` CI run (the check plan's proposal) requested on the prd tip; `roundtrip` runs locally at landing. Slice worktrees 1 to 4 stay until the verdict is green. B-372 holds `test-gates-2`'s New York overflow (7 files, `roundtrip` among them): slice 6 repoints it.

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
