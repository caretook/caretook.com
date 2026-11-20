# Plan: Check migration

> Source PRD: [`plans/check-migration-prd.md`](check-migration-prd.md). User-story numbers (US) refer to it. Backlog items B-114 to B-129 and B-131 (B-113 closes with slices 7 and 14). Topic `check-migration`.

## Status

| Slice | State                           | Merge into `prd/check-migration` (slice commits) |
| ----- | ------------------------------- | ------------------------------------------------ |
| 1     | landed (wave 1)                 | 372c658 (f6cd078, e262c12)                       |
| 2     | landed (wave 1)                 | 120db6e (df8db5a); ceiling 357 in 9c0b2bf        |
| 3     | landed (wave 2)                 | c7ebf04 (dc3b2ec, a1f84cb, 988c4de)              |
| 4     | landed (wave 2)                 | 7e632ee (58cfc90)                                |
| 5     | landed (wave 2)                 | 7bfa916 (3542457, e554d48)                       |
| 6     | landed (wave 3)                 | 17f91aa (3dfa6fd)                                |
| 7     | landed (wave 3)                 | 3c0418e (97af38e)                                |
| 8     | landed (wave 3)                 | 2cdba7f (c6d0b95, 55676bf)                       |
| 9     | landed (wave 4)                 | 35dceff (cc30504, 72c7166)                       |
| 10    | landed (wave 4)                 | 3bb168a (f9c1ef9, eef96ac)                       |
| 11    | landed (wave 5, 74f6723) · opus | d72b0f6 (af6b87d, f274fd5)                       |
| 12    | merged (wave 6) · sonnet        | 5cfb4ca (0277cbf)                                |
| 13    | landed (wave 4)                 | bc5104e (0b06086)                                |
| 14    | landed (wave 5, 74f6723) · opus | 6ebb3ec (cce2ed2)                                |
| 15    | landed (wave 5, 74f6723) · opus | 0e0ab28 (3b2a5ad)                                |
| 16    | merged (wave 6) · sonnet        | 222c37d (22f1f2b)                                |
| 17    | merged (wave 6) · sonnet        | d487b30 (515b3f4)                                |
| 18    | blocked by 3–17                 |                                                  |
| 19    | blocked by 18                   |                                                  |
| 20    | blocked by 19                   |                                                  |
| 21    | blocked by 19                   |                                                  |
| 22    | blocked by 19                   |                                                  |
| 23    | blocked by 20, 21, 22           |                                                  |

**Landing mode: run everything through** (queued with `pnpm prd queue check-migration`, 2026-11-19). The orchestrator starts every ready slice, lands each green wave itself with `pnpm prd land`, and cleans up; it asks the user only real questions.

**Suite:** the user chose (2026-11-19) one `pnpm prd browser --suite` run per wave, before its landing. Loops still run each check once and never the suite.

**Ceiling:** the user raised it to 357 (2026-11-19) for slice 2's sync matrix (9c0b2bf); slice 5 lowered it to 350.

**Now (2026-11-20, check-migration-17):** wave 5 landed in dev as 74f6723. code-layout's slice 1 landed (7fca12d: `scripts/loops/check-areas` is now `check-areas.d/<area>`, with a lint in `pnpm check` for unmapped files, dead rules and duplicate globs) and is synced in. **Wave 6 (12, 16, 17) started:** worktrees `.loops/check-migration-{12,16,17}`, one sonnet agent each, B-126, B-122 and B-127 claimed. Each agent's brief adds orchestrator notes: the Node PATH, the check-areas.d lint, waiting for the layout to settle, and avoiding code-layout wave 2's paths (packages/data errors/permissions/schema, packages/api/src, apps/web/app/lib/). All three stopped at the usage limit mid-work, with uncommitted work and no commits yet, and were resumed after the reset. A crash means respawn each with `--continue`. **16 handed off** (22f1f2b): contact and memberSharing component tests, the member-share stream folded into app-shell step 4, profiles-contacts deleted. Lean total stays at 286, the same as the ceiling. Re-measure app-shell at the suite. For the docs at landing: docs/loops.md:76 (profiles-contacts moved: the fold is app-shell step 4) and docs/domain/profiles.md:24. It found that app-shell's detailsGone/detailsBack checks always pass, filed as B-172. **17 handed off** (515b3f4): invite page, members' invites and sign-in tabs as component tests; invites.mjs trimmed (invites pass 100/100). Its usual 72 → 62 is **an estimate** (the run was at load 28–55), and it sets the ceiling to 276: set both from the wave's suite. Both 16 and 17 saw passSheet's "Add a medication logs it…" time out under load (it passes alone). Watch it at the check. **12 handed off** (0277cbf): timelineSheets component tests (add, edit, delete, validation, date picker); roundtrip keeps the converging steps, at 30 s against its listed 29. **All three merged** (5cfb4ca, 222c37d, d487b30), with B-126, B-122 and B-127 done and the worktrees removed. The manifest now has ceiling 276 and invites 62 (estimated). **Next:** `pnpm prd browser --suite` once (the user's per-wave rule), then set the lean times from it, run the full `pnpm prd check`, fold docs (loops.md: profiles-contacts and roundtrip/invites trims; profiles.md:24; invites/care-groups docs), and land. Landing needs the full `pnpm prd check`, since the sync brought in code. B-162 and B-163 are in the inbox but not this PRD's (simple mode and quick-entry UI).

- **Resumed 2026-11-20 10:25 (session check-migration-17):** Status matched git (nothing in flight). Synced (dev had only backlog commits). `timelineLayout` › "the author tooltip… hover" **fails alone at low load too**: deterministic, not load. App code is unchanged since wave 4 landed (it passed then), so it's likely time-of-day dependent and on dev as well. Cause (sonnet helper): the quick-entry suggestion chips (time-of-day dependent) land after the rows and push the list down ~40 px, so the hover lands on another row's button. Test-only fix: wait for the link to stop moving before hovering (file passes 20/20 three times). Full `pnpm prd check` passed on 76a3161 (4089 tests, 371 files). Landing wave 5. After landing, message hosting-5b (it hit the same failure on prd/hosting and is waiting for the fix in dev) as well as code-layout-d2. B-161 (sign-in flake) proposed for this PRD (slice 20 ports sign-in).
- Earlier: wave 4 (9, 10, 13) landed as 54a1880 (its suite: `roundtrip` failed twice at load 68–75 and passed alone at load 20; `sign-in` flaky at load 88, filed as B-161). Wave 3 landed as 68571c8, waves 1–2 as 2040ed3. Only `profiles-contacts` is left as an area check. Lean times are the median of the last three clean suites (waves 2, 3, 5): total and ceiling **286**.
- Running agents: none. Worktrees: only `.loops/check-migration` (slot 4).
- **Paused for code-layout:** its slice 1 rewrites `scripts/loops/check-areas` into `check-areas.d/`. Agreed with its orchestrator (code-layout-d2) not to start a slice that edits check-areas (12, 16, 17, 18, 19–23: all of them) until that lands; it messages on landing, then sync and add rules to the matching `check-areas.d/<area>` file.
- **Loop rules from ab204ec:** the check gate (none / quick / full, docs/loops.md _The check gate_) and models (_Models_): move slices are mechanical, so sonnet from now on; slices 1–15 ran on opus (the session's model). Tell each slice agent to read both sections.
- Component test polls now wait 5 s (`expect.poll.timeout` in vitest.config.ts, B-131), after load flakes at landing.

- **Ceiling 295** (2026-11-20). Slice 6 cut `session-end` from 60 to 7 (it runs in 5–6 s), which took the ceiling to 297. Then the orchestrator set every lean check's usual seconds to the median of the three suite runs so far (the listed values had drifted: `marketing` 10 vs 29 measured, `app-shell` 10 vs 18, `layout-offline` 15 vs 27, `sign-in` 10 vs 5), which made the total 295. The lean set is already under slice 18's 300; slice 18 still makes 300 the hard limit and trims what it can.
- Orchestrator fixes on this branch so far: f6a4db8 (settle test), the timelineFilters race (B-131), `retry: 2` on timelineScroll's B-133 flake (remove when B-133 is fixed), 1384054 (visit prep steps the year, not the month: B-134, date-dependent on dev).
- Filed for the user's triage (not this PRD): B-133 (timeline minute-turn remount), B-134 (a month step back from the 31st in visit prep).
- Stale comments for later slices: `groups.mjs:296` names admin.mjs (slice 15); `profiles.mjs:338` says care periods' own check covers it (slice 10).

Backlog: claim each slice's items when it starts: 1 B-131; 2 B-128; 3 B-114; 4 B-115; 5 B-120; 6 B-124; 7 B-125 (and B-113's admin part); 9 and 11 B-118 (done after 11); 10 B-121; 12 B-126; 13 B-119; 14 B-116 (and B-113's providers part; B-113 done after 14); 15 B-117; 16 B-122; 17 B-127; 19 to 23 B-129 (done after 23).

Fold into the area docs at each landing: the settle helper, parallelism and `loaderData` in `docs/domain/components.md` (_Component tests_); the lean rule, the ceiling, the sync matrix and each deleted check in `docs/loops.md` (_Browser check budget_, the area table, the manifest's list); the Playwright harness in `docs/loops.md` (_Browser checks_) and AGENTS.md's _Loop rules_ (`cdp.mjs` and `proxy.mjs` are named there).

## Architectural decisions

Durable decisions every slice follows:

- **The lean rule:** a flow stays end to end only if it exercises a server or sync path no lean step already covers (a multi-row transaction, a service-written side effect, a stream's own permission rule, a server-only refusal, email, the session). "A row reaches a second device" is the sync matrix's job (slice 2), never an area step.
- **Folds go to the lean check that owns the pattern:** `roundtrip` (devices converging, offline then reconnect, refused uploads, the matrix), `app-shell` (roles, demotion, members across devices), `session-end` (signed out elsewhere), `invites` (join codes, emails), `layout-offline` (preferences following the account), `first-sync` (what a new device receives). A fold needing a new lean check is a question for the user.
- **Every move maps every step it deletes** to a component, unit or integration test by name, or to kept (folded, and where) or dropped (why). The map is a table in the hand-off. Then the area check, its manifest line and its `check-areas` rules are deleted; its screens map to none, or to the lean check a fold went into.
- **The budget:** the manifest's `lean-ceiling` line, checked by `checks.test.mjs` against the sum of the `e2e yes` checks' usual seconds. A slice that changes a lean check updates its usual seconds from its run and lowers the ceiling if the total dropped. Nothing raises it without the user. Slice 18 takes it to ≤ 300 and makes 300 the hard limit.
- **Component tests** use the test device only (`renderWithDevice`, `fx`, `api`, `sync()`, `queued()`), the settle helper after every stored write or `sync()`, and 420 and 1280, light and dark, only where the old step was about layout.
- **Shared tooling files** (`scripts/loops/checks`, `scripts/loops/check-areas`, `apps/web/test/`) take additive edits: remove your own check's lines, append your rules, never reorder.
- **Bugs found while moving** are filed with `pnpm backlog add`, not fixed, unless the fix is a one-line test seam.
- **New dev dependency (approved 2026-11-19):** `@playwright/test` 1.65.1, pinned exactly, added in slice 19 only.

## How to run this plan

- **Wave 1: slices 1 and 2.** 1 owns the test device and the manifest's ceiling; 2 owns `roundtrip`'s new steps.
- **Wave 2: 3, 4, 5.** **Wave 3: 6, 7, 8.** **Wave 4: 9, 10.** These areas aren't being changed by `assistant`.
- **Wave 5: 11, 12, 13**, and **wave 6: 14, 15, 16**, each slice once the `assistant` slices it names are in `dev`. Ask `assistant`'s orchestrator (ListAgents, SendMessage) to message you as each wave lands, set a background check on `git log dev`, and `pnpm prd sync` first. If assistant is slower than this PRD, run wave 7's 17 early only if its assistant slices are in.
- **Wave 7: 17, 18.** 18 waits for every move.
- **Wave 8: 19.** **Wave 9: 20, 21, 22.** **Wave 10: 23.**
- Three slices a wave at most, to leave Docker room for the two running PRDs.
- Merge in number order within a wave, with no checks between merges.
- **Tests per docs/loops.md, _Browser check budget_:** while building, `pnpm test:components --changed prd/check-migration` and the one check you're shrinking or folding into; before hand-off, `pnpm check` and `pnpm prd browser --changed` once. At landing, the orchestrator runs `pnpm prd browser --suite` once (every wave here changes the lean set or what maps to it).
- Every slice ends with a hand-off (AGENTS.md, _Loop rules_) with the step → test map, the lean set's new total and the ceiling.

---

## Slice 1: Steady component tests and the budget ratchet

Stack: no · Reads: docs/loops.md, docs/domain/components.md · Tests: unit, component

**User stories:** US 1, 2, 5, 6. **Blocked by:** none. **Blocks:** 3–17.

### What to build

A settle helper on `renderWithDevice`'s result: it waits until pending live queries have rerun and the DOM is unchanged for a frame, after a stored write, `sync()` or `unsync()`. Switch the existing tests that read the screen right after a write to it. Find the B-131 race in the current files (DOM reads after a database poll), and choose and set a `web:components` worker count inside `pnpm check` that passes under load. The manifest's `lean-ceiling 356` line, and a `checks.test.mjs` test that sums the `e2e yes` usual seconds against it.

### Acceptance criteria

- [ ] `pnpm check` passes five times in a row with two other `pnpm check` runs going (the load B-131 saw); the hand-off records the loads and times.
- [ ] Helper tests in `device.browser.test.tsx`: a write then a read that raced before now passes; the helper times out with a clear message if the screen never settles.
- [ ] `checks.test.mjs` fails with a manifest whose lean total exceeds the ceiling, and passes at 356.

---

## Slice 2: One sync matrix step and refused uploads

Stack: yes · Reads: docs/loops.md, docs/domain/sync.md, docs/domain/care-groups.md · Tests: unit, e2e:roundtrip

**User stories:** US 10, 11, 13. **Blocked by:** none. **Blocks:** 3–17.

### What to build

A table-driven `roundtrip` step: for each uploadable synced table, device A writes a row and device B sees it; for each server-written table, a seeded or service-made row is on both. It fails naming the table. A unit test compares its table list with the device schema, so a new synced table must add a row. A refused-upload flow: the owner lowers a member to viewer on the server; the member's device writes locally; the upload is refused (acknowledged, not retried forever); the next sync restores the server's copy.

### Acceptance criteria

- [ ] The matrix step passes and names a table when one is broken (shown by temporarily breaking one in the run, not committed).
- [ ] The refused-upload step passes; the device's queue is empty after it.
- [ ] The unit test fails when a device-schema table is missing from the matrix.
- [ ] `roundtrip`'s usual seconds updated; the ceiling holds (raise needs the user: ask through the orchestrator if it doesn't fit).

---

## Slice 3: Move routing.mjs (B-114)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/app-shell.md, docs/layout.md · Tests: component, e2e:first-sync

**User stories:** US 3, 4, 7. **Blocked by:** 1, 2. **Blocks:** 18.

### What to build

Component tests beside the routes for `appUrls` links, sheet URLs opening and closing, settings subpages, and the group route's redirects and 404s. Keep only what needs a real page load (route discovery offline, a deep link after a full load), folded into `first-sync` or `layout-offline`. Delete `routing.mjs`.

### Acceptance criteria

- [ ] The step → test map covers every step in `routing.mjs`.
- [ ] Component tests pass; the folded steps pass in their lean check.
- [ ] `routing.mjs`, its manifest line and its `check-areas` rules are gone; `pnpm prd browser --changed --list` names no `routing`.

---

## Slice 4: Move settings-layout.mjs (B-115)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: component, e2e:layout-offline

**User stories:** US 3, 4, 7. **Blocked by:** 1, 2. **Blocks:** 18.

### What to build

The Settings ↔ timeline toggle on one device into `settings.browser.test.tsx`. Fold the choice following the account to a second browser into `layout-offline`, if the matrix doesn't already cover it. Delete `settings-layout.mjs`.

### Acceptance criteria

- [ ] Step → test map complete; component tests pass; the fold (or the reason there's none) is in the hand-off.
- [ ] The check and its rules are gone.

---

## Slice 5: Move search.mjs (B-120)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/search.md, docs/domain/timeline.md · Tests: component, unit, e2e:signout-wipe

**User stories:** US 3, 4, 7. **Blocked by:** 1, 2. **Blocks:** 18.

### What to build

The timeline's search field and chip, the search page, highlights, snippets and recent searches as component tests, with the FTS index on the test device's SQLite. Fold the index being dropped at sign-out into `signout-wipe`. Server search stays out of the lean set unless a screen calls it. Delete `search.mjs`.

### Acceptance criteria

- [ ] Step → test map complete; component tests pass (FTS on the test device); the `signout-wipe` fold passes.
- [ ] The check and its rules are gone.

---

## Slice 6: Move devices.mjs (B-124)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/auth.md, docs/domain/sync.md · Tests: component, e2e:session-end

**User stories:** US 3, 4, 7. **Blocked by:** 1, 2. **Blocks:** 18.

### What to build

The Devices page's list, labels and offline notice as component tests (sessions through the test device's `api`). Fold signing another device out (its next session check goes to sign-in) into `session-end`. Delete `devices.mjs`.

### Acceptance criteria

- [ ] Step → test map complete; component tests pass; `session-end`'s new step passes and its usual seconds are updated.
- [ ] The check and its rules are gone.

---

## Slice 7: Move admin.mjs (B-125)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/admin.md, docs/domain/data-layer.md · Tests: component, integration, e2e:app-shell

**User stories:** US 3, 4, 7, 14, 15. **Blocked by:** 1, 2. **Blocks:** 18.

### What to build

`loaderData` (and an action result) in `renderWithDevice` for routes with a server `loader`, and `fx` builders for admin rows. Component tests for users, groups, the audit log, settings and the banner. Integration tests for the loaders' service queries. Fold staff-only access (a 404 for non-staff), an audit row written by a real action, and the announcement reaching `/app` into `app-shell`. Delete `admin.mjs`. This closes B-113's admin part.

### Acceptance criteria

- [ ] A device test renders a server-loaded route from given `loaderData`.
- [ ] Step → test map complete; component and integration tests pass; the `app-shell` folds pass.
- [ ] The check and its rules are gone.

---

## Slice 8: Move care-periods.mjs (B-123)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/care-periods.md, docs/domain/timeline.md · Tests: component, unit, e2e:roundtrip

**User stories:** US 3, 4, 7, 12, 13. **Blocked by:** 1, 2. **Blocks:** 18.

### What to build

The periods list, sheets, period page, timeline line and markers, group menu and suggestions as component tests (the timeline's `timelineWorld` for the line and markers). Ties and the contiguity rule go to unit tests where they're pure, or to integration tests where the service enforces them. Plain "second device" and "offline then upload" steps are covered by the matrix. Keep anything with a mechanism of its own (a service-side split of a period, if any) in `roundtrip`. Delete `care-periods.mjs`.

### Acceptance criteria

- [ ] Step → test map complete; tests pass; folds (if any) pass.
- [ ] The check and its rules are gone.

---

## Slice 9: Move medications.mjs, part A: the list and the medication (B-118)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/medications.md · Tests: component, integration, e2e:roundtrip

**User stories:** US 3, 7, 12, 13, 16. **Blocked by:** 1, 2. **Blocks:** 11, 18.

### What to build

The list, search and status, the add and edit forms, status actions, allergies and the print sheet's layout as component tests. Service-written change entries as integration tests, plus one `roundtrip` step if they need sync to show (a change entry reaching a second device is the matrix's job). Delete these steps from `medications.mjs`; the rest stays for slice 11.

### Acceptance criteria

- [ ] Step → test map for every deleted step; tests pass; `medications.mjs` still passes on its remaining steps.

---

## Slice 10: Move profiles.mjs (B-121)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/profiles.md, docs/domain/care-groups.md · Tests: component, e2e:app-shell

**User stories:** US 3, 4, 7, 12, 16. **Blocked by:** 1, 2. **Blocks:** 18.

### What to build

The profile page, its sheets by role, offline states and the print sheet's layout as component tests (oRPC through the device's `api`). Fold demotion losing the writers' details on the next sync (a stream's own permission rule) into `app-shell`'s demotion step. A save syncing back is the matrix's job. Delete `profiles.mjs`.

### Acceptance criteria

- [ ] Step → test map complete; tests pass; the `app-shell` fold passes.
- [ ] The check and its rules are gone.

---

## Slice 11: Move medications.mjs, part B: Today, the strip, doses and passes (B-118)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/medications.md, docs/domain/timeline.md · Tests: component, unit, e2e:roundtrip

**User stories:** US 3, 4, 7, 12, 13. **Blocked by:** 9, and `assistant` slice 7 in `dev`. **Blocks:** 18.

### What to build

Today, the medication strip, the Dose sheet's states, passes and Given all with Undo as component tests (slot logic already has unit tests: add any a step asserted). Fold Given all's multi-row batch uploading as one into `roundtrip` if no lean step covers a batch. Delete `medications.mjs`.

### Acceptance criteria

- [ ] Step → test map complete for the rest of `medications.mjs`; tests pass; the fold (or why none) is in the hand-off.
- [ ] The check and its rules are gone.

---

## Slice 12: Move roundtrip.mjs's sheet steps (B-126)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/timeline.md · Tests: component, e2e:roundtrip

**User stories:** US 3, 5, 7. **Blocked by:** 1, 2, and `assistant` slices 1 and 5 in `dev`. **Blocks:** 18.

### What to build

The add and edit sheets' validation, When's date picker, and edit and delete as component tests beside `new/`, `edit/` and `EntryForm`. Delete those steps from `roundtrip.mjs`, keeping devices converging, offline then reconnect, the viewer, the matrix and refused uploads. Lower the ceiling.

### Acceptance criteria

- [ ] Step → test map complete; tests pass; `roundtrip` passes, with its usual seconds and the ceiling lowered.

---

## Slice 13: Move upcoming.mjs (B-119)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/appointments.md, docs/domain/medications.md · Tests: component, e2e:roundtrip

**User stories:** US 3, 4, 7, 12. **Blocked by:** 1, 2, and `assistant` slice 4 in `dev`. **Blocks:** 18.

### What to build

The section, Past, filters, adding at `?when=pick`, the cancel and reschedule dialogs, the Next strip and block, and due doses in Upcoming as component tests. Fold reschedule's one transaction (cancel plus new event) uploading and reaching another device into `roundtrip`, as one step. Delete `upcoming.mjs`.

### Acceptance criteria

- [ ] Step → test map complete; tests pass; the `roundtrip` fold passes.
- [ ] The check and its rules are gone.

---

## Slice 14: Move providers.mjs (B-116)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/providers.md, docs/domain/live-notes.md · Tests: component, integration, e2e:roundtrip

**User stories:** US 3, 4, 7, 12, 13. **Blocked by:** 1, 2, and `assistant` slice 4 in `dev`. **Blocks:** 18.

### What to build

The directory (list, search, filters), the sheets, the provider page, the entry page's With row and suggestions as component tests. The viewer's refused writes are covered by slice 2's refused upload and by the permission integration tests. Two-browser notes are `live-notes`' job, and offline add then upload is the matrix's. Keep only what has a mechanism of its own. Delete `providers.mjs`. This closes B-113.

### Acceptance criteria

- [ ] Step → test map complete; tests pass.
- [ ] The check and its rules are gone; B-113's note says how each of its three checks ended.

---

## Slice 15: Move groups.mjs (B-117)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/care-groups.md · Tests: component, e2e:invites, e2e:first-sync

**User stories:** US 3, 4, 7, 12. **Blocked by:** 1, 2, and `assistant` slices 5 and 6 in `dev`. **Blocks:** 18.

### What to build

The New care group sheet, the invite card, and `/join/:code`'s form states as component tests. Fold `/join` sign-up and refused codes into `invites`, and `careGroup.create` followed by the new group syncing in into `first-sync`. Admin's 404 is slice 7's. The QR is a component test. Delete `groups.mjs`.

### Acceptance criteria

- [ ] Step → test map complete; tests pass; the folds pass.
- [ ] The check and its rules are gone.

---

## Slice 16: Move profiles-contacts.mjs (B-122)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/profiles.md · Tests: component, e2e:app-shell

**User stories:** US 3, 4, 7, 12. **Blocked by:** 1, 2, and `assistant` slices 5 and 6 in `dev`. **Blocks:** 18.

### What to build

Account Contact details and the Members page's sharing form as component tests. A share reaching a co-member's device exercises the member-profile stream's own rule, so fold one step into `app-shell`. Delete `profiles-contacts.mjs`.

### Acceptance criteria

- [ ] Step → test map complete; tests pass; the fold passes.
- [ ] The check and its rules are gone.

---

## Slice 17: Move invites.mjs's screen steps (B-127)

Stack: yes · Reads: docs/loops.md, docs/domain/components.md, docs/domain/care-groups.md, docs/domain/auth.md · Tests: component, e2e:invites

**User stories:** US 3, 5, 7. **Blocked by:** 1, 2, and `assistant` slices 5 and 6 in `dev`. **Blocks:** 18.

### What to build

The invite page's views, the wrong-account view, the sign-in tabs, the invite sheet and the pending list as component tests. Delete those steps from `invites.mjs`, keeping emails, sign-up, consent, join, links and requests. Lower the ceiling.

### Acceptance criteria

- [ ] Step → test map complete; tests pass; `invites` passes, with its usual seconds and the ceiling lowered.

---

## Slice 18: Trim the lean set to 300 s

Stack: yes · Reads: docs/loops.md · Tests: unit, e2e:session-end, e2e:live-notes, e2e:first-sync

**User stories:** US 5, 6, 9. **Blocked by:** 3–17. **Blocks:** 19.

### What to build

Measure every lean check in full mode on a quiet machine. Cut fixed waits, repeated sign-ins and steps another lean check already covers (session-end, live-notes and first-sync first), until the total is ≤ 300 s. Set the ceiling to the total, and make `checks.test.mjs` also fail if the ceiling exceeds 300.

### Acceptance criteria

- [ ] `pnpm prd browser --suite` once, on a quiet machine, takes ≤ 300 s of check time (the table in the hand-off).
- [ ] Every cut step is mapped (covered elsewhere, or dropped with why).
- [ ] The test fails at a ceiling of 301.

---

## Slice 19: Playwright Test harness behind pnpm prd browser (B-129)

Stack: yes · Reads: docs/loops.md · Tests: unit, e2e:sign-in, e2e:ui, e2e:marketing

**User stories:** US 17, 18. **Blocked by:** 18. **Blocks:** 20, 21, 22.

### What to build

Add `@playwright/test` 1.65.1, pinned exactly. A shared fixture module replaces `cdp.mjs` and `proxy.mjs`: pages with their own `x-forwarded-for`, sign-in helpers, two-device contexts, offline through the context, the PowerSync teardown filter, and `PG_CONTAINER`. `browser.sh` runs a spec per check, with one worker, and keeps the lease, the three limits, the retry and FLAKY log, trimmed output, smoke mode and the check build. Either `.mjs` or a spec can sit on a manifest line during the port. Port `sign-in`, `ui` and `marketing`.

### Acceptance criteria

- [ ] `browser.test.mjs` covers the limits, the retry and smoke mode for a spec, as it does for an `.mjs` check.
- [ ] The three ported checks pass through `pnpm prd browser` and under `--suite` beside unported ones; each step of each is mapped to a test in its spec.

---

## Slice 20: Port the session checks (B-129)

Stack: yes · Reads: docs/loops.md, docs/domain/sync.md, docs/domain/auth.md · Tests: e2e:first-sync, e2e:signout-wipe, e2e:session-end, e2e:layout-offline

**User stories:** US 17. **Blocked by:** 19. **Blocks:** 23.

### What to build

Port `first-sync`, `signout-wipe`, `session-end` and `layout-offline` as specs, with step-for-step parity. The never-exits behaviour of `signout-wipe` and `layout-offline` becomes ordinary test completion.

### Acceptance criteria

- [ ] Each passes through `pnpm prd browser`; step map in the hand-off; manifest updated (never-exits `no`).

---

## Slice 21: Port the device checks (B-129)

Stack: yes · Reads: docs/loops.md, docs/domain/sync.md, docs/domain/timeline.md, docs/domain/live-notes.md · Tests: e2e:phase2, e2e:roundtrip, e2e:live-notes

**User stories:** US 17. **Blocked by:** 19. **Blocks:** 23.

### What to build

Port `phase2`, `roundtrip` (the matrix and refused uploads included) and `live-notes` as specs, with step-for-step parity.

### Acceptance criteria

- [ ] Each passes through `pnpm prd browser`; step map in the hand-off.

---

## Slice 22: Port the group checks (B-129)

Stack: yes · Reads: docs/loops.md, docs/domain/care-groups.md, docs/domain/app-shell.md, docs/domain/notifications.md · Tests: e2e:app-shell, e2e:invites

**User stories:** US 17. **Blocked by:** 19. **Blocks:** 23.

### What to build

Port `app-shell` and `invites` (emails through `/dev/mail.json`) as specs, with step-for-step parity.

### Acceptance criteria

- [ ] Each passes through `pnpm prd browser`; step map in the hand-off.

---

## Slice 23: Delete the CDP harness (B-129)

Stack: yes · Reads: docs/loops.md, docs/domain/marketing.md · Tests: unit

**User stories:** US 19, 20. **Blocked by:** 20, 21, 22. **Blocks:** none.

### What to build

Delete `cdp.mjs`, `proxy.mjs`, `smoke.mjs` and every remaining `.mjs` check, along with `browser.sh`'s `.mjs` path and their tests. Port `marketing-screenshots` as a Playwright script outside the manifest; nothing runs it (B-40 is parked). Update `check-areas`, the manifest header and `checks.test.mjs`.

### Acceptance criteria

- [ ] No file imports `cdp.mjs` or `proxy.mjs`; `pnpm check` passes.
- [ ] `marketing-screenshots` runs by hand against a check build (one run, the output listed, no images committed).
- [ ] Every manifest line is a spec; `pnpm prd browser --suite` runs only specs.
