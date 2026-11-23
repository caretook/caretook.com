# PRD: Test health 2 (the coverage the first pass left out)

> Topic `test-health-2`. Backlog: B-371 (round trip per table), B-372 (a second time zone), B-373 (role coverage gaps), B-374 (upload errors can't wedge the queue). Plan: [`plans/test-health-2-plan.md`](test-health-2-plan.md). Follows [`test-health`](test-health-prd.md), which listed new coverage as out of scope.

## Decisions

| Decision                                                                                                                                                                                                                | Why                                                                                                                    | Source                      | Cost to change later                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------- |
| A batch the server rejects whole with a 400 is resent one change at a time: good changes save, and only the bad one moves to "Changes not saved", with its data kept on the device                                      | a 400 is repeatable, so today's retry never ends and blocks everything queued behind it                                | asked: as recommended       | high: decides what happens to a user's unsent changes |
| A test that finds care data exposed or writable by the wrong person is never skipped or quarantined: the slice stops and asks the user (`pnpm prd ask --waits`), unless the fix is small and changes no intended access | a known hole must not ship behind a skipped test                                                                       | assumed (the skeptic's fix) | low                                                   |
| The topic runs after `sync-safety`                                                                                                                                                                                      | its slice 3 rewrites the uploader and adds per-op `failed`; B-374's tests must describe that code                      | assumed                     | medium: reorder the row, rebase slice 1               |
| The topic runs after `test-gates-2`                                                                                                                                                                                     | that PRD owns the zone setting and the full-suite New York run, and hands fixing second-zone failures to B-372         | assumed                     | medium: the zone slice would need its own setting     |
| B-372 adds an everyday New York project for the timeline, doses and events screens only; the whole suite in New York stays `test-gates-2`'s release tier                                                                | the screens where a zone mistake misdates care data, at a fraction of the cost of doubling 170 files                   | assumed                     | low: widen the include list                           |
| This topic fixes second-zone failures on those three screens. A fix too big for the slice becomes a `fixes-bug` item, with a New York-only skip naming it                                                               | `test-gates-2` assigns the fixing here; the shared quarantine has no zone, so it would also drop the Los Angeles run   | assumed                     | low                                                   |
| The unauthenticated sweep keeps one explicit list of public procedures                                                                                                                                                  | a new public procedure should be a deliberate, reviewed edit; this is a security rule, not a frozen list of everything | assumed                     | low                                                   |
| The round trip stays in the `roundtrip` browser check, with no new check                                                                                                                                                | only real PowerSync proves what a second device receives                                                               | assumed                     | medium                                                |
| Node test projects pin `TZ` to America/Los_Angeles                                                                                                                                                                      | they follow the machine's zone today, so a result can differ between the Mac and CI                                    | assumed                     | low                                                   |

**The skeptic pass** changed:

- The second zone is its own Vitest project, because one project's browser instances can't have different provider settings.
- It moves the device's zone only, so the recipient stays in Los Angeles and the two really differ.
- Second-zone skips are New York-only, and a permission hole is never quarantined.
- A removed member's device is now checked end to end, since devices read care data through PowerSync and not the API.
- The round trip is split in two (compare columns, then the app's writers), with writers in their own map so the shared matrix file only gets additive edits.
- The procedure count is corrected to 89, and support is tested as a real support account.

Declined: moving the wire-shape converters out of the server registry. Slice 3 keeps a small test-only converter, because moving production code isn't worth it for one test helper.

## Problem

The review of 2026-11-21 found four places where the tests say less than they appear to. Each was checked against the code on 2026-11-23.

- **The sync matrix proves a row arrives, not that it arrived intact.** It writes with hand-written INSERTs and compares only the id on the second device. A writer that drops or mangles a column passes. Device fixtures are also written by hand, with nothing tying them to what the server's schemas accept.
- **Almost everything runs in one time zone.** The component tests, Playwright and the seeds all use America/Los_Angeles, while 31 production lines read the device's zone. A caretaker travelling, or a family across zones, runs code no test has run. (The review's "106 of 113 files" no longer matches: there are 170 component test files and 6 mention another zone.)
- **Role coverage has holes at the entry points.** The "rejects every procedure without a user" test calls two of the 81 procedures that need a session (the router has 89, 8 of them public). Sync upload tests a viewer on every soft-delete table, but no one outside the group on most tables. A removed member and staff support have no test against the care tables.
- **An upload failure can stop a device syncing.** The uploader has device tests, and `sync-safety` slice 3 will handle a 5xx on one op. A 400 for the whole request is still retried forever, so everything queued behind it never uploads.

## Solution

From the dev keeper's side: when these tests pass, a change that reaches a second device is known to be intact, the screens that show care times work in a second zone, every entry point refuses anyone who shouldn't be there, and no single bad change can stop a device from syncing.

## User stories

1. As a caretaker, I want one malformed change not to stop my other changes uploading, so that the family still sees what I logged. (B-374)
2. As a caretaker, I want a change that can't be saved to be listed under "Changes not saved", so that I know about it. (B-374)
3. As the dev keeper, I want tests of the uploader against a 400 and a 500 for the whole request, so that the queue's behaviour is pinned. (B-374)
4. As the dev keeper, I want every procedure called signed out, so that a new procedure can't ship open by accident. (B-373)
5. As the dev keeper, I want someone outside the group refused on all 15 upload tables, so that sync upload can't write across groups. (B-373)
6. As a family, I want a removed member unable to read or write our care tables, and our rows gone from their device, so that removal really ends access. (B-373)
7. As a family, I want staff support unable to read or write care tables through the app's API, so that "staff never see care data" is proven. (B-373)
8. As the dev keeper, I want device fixtures to have the shape PowerSync delivers and to pass the server's schemas, so that component tests run on realistic rows. (B-371)
9. As the dev keeper, I want each uploadable table written by the app's own writer in the round trip, so that the code users run is what's tested. (B-371)
10. As the dev keeper, I want the second device's column values compared with the first's, so that a dropped or altered column fails. (B-371)
11. As a caretaker in another zone, I want the timeline, doses and events to show the right day and time, so that care records aren't misdated. (B-372)
12. As the dev keeper, I want node tests pinned to one zone, so that a result doesn't depend on the machine. (B-372)

## Implementation decisions

- **Uploader:** when `sync.upload` answers a whole request with a 400, the device resends that batch's ops one per request, in order. An op that gets a 400 alone is recorded in `unsaved_change` as refused, with its data, and leaves the queue. The others take their normal result. If a single-op request fails any other way (offline, a 401, a 5xx), the resend stops, only the ops already answered are acknowledged (`sync-safety`'s partial acknowledgement), and PowerSync retries the rest. A 401, a network failure and a 5xx keep today's meaning: nothing is acknowledged and PowerSync retries (with `sync-safety`'s set-aside for a failing op).
- **Procedure sweep:** walks the router tree, so a new procedure is covered with no edit. Every procedure outside the explicit public list must answer `UNAUTHORIZED` signed out, with no valid input needed. The eight public procedures are in the public forms, announcement, access-code and invite areas.
- **Upload sweep:** one parametrised integration test across `UPLOAD_REGISTRY`, so a new table without a case fails. It runs as an outsider, a removed member (removed through the service, session still valid), a support account and an admin who isn't a member. It covers PUT, PATCH and DELETE where the table allows them, and asserts the refusal and that Postgres is unchanged.
- **Care reads:** the same four people are refused on the oRPC care reads, `timeline.list`, `timeline.latestVitals` and `search.query` among them.
- **A removed member's device:** one step in the `roundtrip` check, asserting the group's rows leave the device after removal.
- **Fixture shape:** a test helper validates the device fixtures for each synced table against the server's Zod schemas, after a small test-only conversion from the wire shape (JSON text, 1/0 booleans, PowerSync timestamps). Fixtures that fail are corrected.
- **Round trip:** first, the check compares every column the sync stream lists, on both devices, normalising only what the server sets by design, with each exception named. Then uploadable tables are written by the app's own writers, kept in a separate map keyed by table so `sync-matrix.mjs` only takes additive edits. The dev and check-build module hook grows to include the missing areas (todos, allergies, conditions); it never reaches a production build.
- **Second zone:** a separate Vitest project, `web:components:ny`, with its own browser port and the device in America/New_York through `test-gates-2`'s zone setting. It includes only the timeline, doses and events tests. Recipient fixtures stay in Los Angeles.
- No migration, no schema change and no new dependency.

## Testing decisions

A good test here states an access or data rule and fails only when that rule breaks. Prior art: `syncRegistry.int.test.ts` (one case per table), the role matrix in `easyRoles.int.test.ts`, `uploader.browser.test.tsx` (a stubbed server), `sync-matrix.test.mjs`.

- Uploader: device tests with a stubbed server.
- Sweeps, removed member, staff: integration tests in the API package.
- A removed member's device: one step in `roundtrip`.
- Fixture shape: a component-project test, since fixtures run in the browser.
- Round trip: the existing `roundtrip` check, with no new check, inside its 120 s cap.
- Second zone: the existing component tests, run again in New York.

## Out of scope

- The full suite in a second zone, and CI gating on it (`test-gates-2`).
- The per-op 5xx handling and set-aside (`sync-safety` slice 3).
- Second-zone failures outside the timeline, doses and events screens: `test-gates-2`'s release tier files them as `fixes-bug` items.
- Fixing unrelated bugs the new tests surface.
- A native-app zone or device matrix.

## Notes

- The review's counts were estimates. The numbers above were recounted on 2026-11-23; a slice that finds a different one says so in its hand-off.
- `test-gates-2` sends its filing overflow to a note on B-372. Slice 6 repoints it to a live item before B-372 closes.
- Docs to fold at landing: [sync](../docs/domain/sync.md) (the uploader's 400), [loop](../docs/agents/loop.md) (the matrix's column comparison), [components](../docs/domain/components.md) (the second zone).
