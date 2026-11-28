# History: fixes-bug

Finished-wave history moved out of [the plan](fixes-bug-plan.md)'s _Status_ by `pnpm prd status-trim fixes-bug`, the newest trim first.

## Trimmed 2026-11-28

**Wave 29 landed** (2026-11-28): PR #356 (dev 38d31d9), Codex clean, CI components green (run 46188882999); slice 99 merged e51817358 (Today and later days never contained; no `content-visibility` on WebKit, `timeline/webkit.ts`); to-test `2026-11-28-1603-fixes-bug.md`; landing report filed; worktree removed; doc folded into timeline (trimmed to budget).

| Slice | Item   | State                     | Merge     |
| ----- | ------ | ------------------------- | --------- |
| 99    | B-1046 | landed (wave 29, PR #356) | e51817358 |

## Trimmed 2026-11-28

**Wave 28** (2026-11-28): dev synced (d48ce5cd0; app-shell doc conflict resolved and trimmed under budget). Slices 96-98 written and starting in parallel. Models: all three opus (the plan's Model field). All three merged in plan order; CI components run 46186862084 on a5f62d0e: flake (todayCard.browser.test.tsx, not the branch's), so it lands. Sync: none needed. Slice worktrees removed. PR #354 open, Codex reviewing; no browser checks needed (`risa browser --changed`). B-1046 not fixed: slice 96's lead is WebKit not painting `content-visibility: auto` rows (`offscreenRows.ts`, B-139); report 2 looks like the local database not answering after an iOS resume. Decided (ask a430, skeptic s105, the user may veto): wave 29 gets a slice that stops `content-visibility: auto` on WebKit or the newest days; B-1046 stays open for report 2. Wave 27 landed earlier (PR #323); its history is in the history file. Held: B-750 (only once its notes name files), B-752 (only if B-753's watchdog names a recurrence). Gotcha: run prettier on the plan after editing the Status table.

| Slice | Item   | State                                                      | Merge     |
| ----- | ------ | ---------------------------------------------------------- | --------- |
| 98    | B-1058 | merged                                                     | 19a8a6163 |
| 97    | B-1056 | merged                                                     | ab844fbec |
| 96    | B-1046 | merged: tests only, no repro in Chromium (item stays open) | 2e7ac9335 |

## Trimmed 2026-11-27 (wave 19)

Wave 19 landed through PR #268 (2026-11-27), Codex clean on c730262, integration CI green on 587de6c6 (run 46055609322), landed unsynced (dev's 2 commits shared no file). To-test: `to-test/2026-11-27-1446-fixes-bug.md`.

| Slice | Item  | State                                                             | Merge     |
| ----- | ----- | ----------------------------------------------------------------- | --------- |
| 80    | B-976 | merged (Opus; quick entry reads a vital's label after its number) | d268a0ca5 |

## Trimmed 2026-11-27 (wave 18)

Wave 18 landed through PR #258 (2026-11-27).

| Slice | Item  | State                                                             | Merge    |
| ----- | ----- | ----------------------------------------------------------------- | -------- |
| 79    | B-971 | merged (Opus; test-only: split label assumed LA)                  | 2375e299 |
| 78    | B-970 | merged (Opus; app: quick tags line covered the row link, `w-fit`) | 8028c782 |
| 77    | B-969 | merged (Opus; test-only: LA device zone hard-coded)               | 641ecbb5 |
| 76    | B-968 | merged (Opus; test-only: LA time hard-coded)                      | d8ce4a4e |

## Trimmed 2026-11-27

| Slice | Item  | State         | Merge    |
| ----- | ----- | ------------- | -------- |
| 75    | B-951 | merged (opus) | 3618ca7a |
| 74    | B-936 | merged (opus) | 6bed3d06 |

## Trimmed 2026-11-26

**Wave 16 landed** as 3dd61650 (PR #208, full, run 45764032795; Codex out of credits, --no-review; report a256). Idle: no triaged fixes-bug items ready. **Next session:** `pnpm prd sync`, ingest, `pnpm backlog list`; write wave 17 from new triaged items (B-750 only once its notes name files; B-752 once B-753 lands). Standing topic: never `pnpm prd rm fixes-bug`.

| Slice | Item  | State  | Merge    |
| ----- | ----- | ------ | -------- |
| 73    | B-840 | merged | 9dd61dda |
| 72    | B-830 | merged | ab6da878 |

## Trimmed 2026-11-25

**Wave 15 landed in dev through PR #183 as c605a868** (2026-11-25): `components` CI green on cb856531 (run 45616812492), browser lean set 11/11. **Codex did not review it** (out of credits, `--no-review`). Landed unsynced (dev's 2 newer commits shared no file). To-test: `to-test/2026-11-25-0805-fixes-bug.md`; landing report filed. Docs folded (connectors, app-shell, timeline; all under 10 240 B). Slice worktrees removed. Slice 68 (B-752) made no change: not reproducible; back to triaged, waits on B-753's watchdog (fixes-tooling).

| Slice | Item  | State                                                      | Merge    |
| ----- | ----- | ---------------------------------------------------------- | -------- |
| 71    | B-792 | merged                                                     | 9f675672 |
| 70    | B-787 | merged                                                     | 9e62f2b5 |
| 69    | B-779 | merged                                                     | d63d7a67 |
| 68    | B-752 | no fix (not reproducible; back to triaged, waits on B-753) | —        |

## Trimmed 2026-11-25

**Wave 14 waiting (2026-11-24, resumed after an interruption; git matched _Status_, no slice worktree, inbox empty).** `prd/fixes-bug` is 12 commits behind dev (sync at wave start). Ask a168 not vetoed (defaulted to A). Only B-689, B-690, B-715 wait, all held by member-avatars (`running`, slice 4 handed off; its CI on 054bb015 was `brake`). Its orchestrator `member-avatars-4c` was asked to message `fixes-bug-69` at landing; a background watch exits when its row leaves `running`. It replied: its last wave (slice 4) is merged and waiting on `components` CI; its Planner changes touch `PlannerHeader`, `UpcomingRow`, `UpcomingRowParts`, `planner/route.tsx` and `past/route.tsx` (expect B-689/B-690 to build on those after the sync). **member-avatars landed as 7d69b3ba (PR #138);** `prd sync --force` merged dev as 8ad25909 (no migration; needed for its Planner code). Wave 14 written: slices 65 (B-715), 66 (B-689), 67 (B-690), all on opus, run at once. Hot files set (planner/, todos/, entry/, lib/appointments/), items claimed. **Worktrees made and agents spawned for 65, 66, 67 (opus)**; if they're gone after a crash, respawn with `--continue`. Merge in order 65, 66, 67; 66 and 67 both touch `PlannerHeader.tsx` (different menu items). **All three merged** (65 5a088bc9, 66 c25d2c1b, 67 ce0cbf74; slice checks passed); worktrees stay until the wave is green. Slice 67 changed `components/ui/BackLink.tsx` (an optional `onClick`), which maps to the `ui` browser check. Not covered by tests (memory router): Back after landing on Todos doesn't reopen the form; reload keeps the Planner return; scroll restore on Back. **`components` CI green on efed38b1 (run 45373891260).** Slice worktrees 65-67 removed. Database migrated (no new migration, no sync config change), server restarted, `browser --changed --base dev` 2/2 (live-notes, ui; don't rerun). Docs folded (`appointments.md` _Back to the Planner_ and tests, `todos.md` sheets; both under 10 KB). **Next:** `pnpm prd pr fixes-bug`, `pnpm prd review fixes-bug --wait`, then `pnpm prd land fixes-bug --tier components -m "fix(fixes-bug): Planner todos land on Todos, Planner events return to the Planner, Planner test passes in New York (B-689, B-690, B-715)"`. No Status commit between the review and the landing. Hand tests for the report: Back after a Planner todo save; reload on an entry opened from the Planner; scroll on Back.

**Wave 13 (2026-11-24; git matched _Status_, no slice in flight; `prd sync` needed no merge, dev's inbox-agent landing shares no file).** Slice 63 (B-726) on opus. **B-728:** question drafted (`A`: viewer's zone for day and time, recommended; `B`: recipient's zone, labelled); skeptic s20 decided A (ask a168, filed for veto under "decided for you"); slice 64 (B-728) on opus. **Still held:** B-689, B-690, B-715 (member-avatars holds `routes/app/groups/planner/`); a background watch exits when its row leaves `running`, and they become a later wave (this one only if 63 and 64 are still in flight). **Both merged** (63 as 731dd3fa after a quick check on f5b17cc3; 64 as 5f29ce60 after a quick check on dffccc4f); worktrees stay until the wave is green. No migration. `browser --changed --base dev --list` names no check for this diff (none run). Database migrated, server restarted on the tip. **Docs folded** (`medications.md`, now 10 230 B; `appointments.md`; `sync.md` has no upload rule to change). Were: `medications.md` and `sync.md` _On upload_: every accepted dose upload is recorded in `dose_duplicate_upload` (the name dates from B-627), not only duplicates and restores; server-written doses (connector, assistant, Given all round) aren't. `appointments.md` _Repeating_: a timed visit's preview line is its day and time in the viewer's zone (B-728). Hand test for the report: the repeat preview in a browser set to another zone than the group's. **`components` CI green on 9d3f2e2c (run 45362438054; one quarantined failure, `scripts/loops/lease.test.mjs`, not this branch's).** Slice worktrees 63-64 removed; `prd sync` needs no merge. **Next:** `pnpm prd pr fixes-bug`, `pnpm prd review fixes-bug --wait`, then `pnpm prd land fixes-bug --tier components -m "fix(fixes-bug): retried dose uploads leave undone doses undone, repeat preview in the viewer's zone (B-726, B-728)"`. No Status commit between the review and the landing. The report names ask a168 (B-728 decided, vetoable) and the hand test: the repeat preview with the browser in another zone than the group's.

**Hand-off (2026-11-22, after the wave 2 landing; no slices in flight).** Wave 1 landed as 7a205be1 (PR #46). **Wave 2 (slices 13–17, all on opus) landed in dev through PR #52** (dev 4f94740): full check passed on 99023ba (557/557, quiet machine, after 7 earlier runs failed on load flakes only; flakes filed B-489–B-502), Codex clean on 608a759, tooling 47/47, browser `--changed` 8/8; lean `--suite` was skipped (said in the report). Report: ask a39; to-test `to-test/2026-11-22-0812-fixes-bug.md`. Docs folded (todos, search, app-shell, care-groups; all at ~10.2 KB, trim when adding). B-450 stopgap (roles test 60 s timeouts) landed with it; the query fix stays on B-450.

**Wave 14 landed in dev through PR #140 as 3e16f92** (2026-11-24): `components` CI green on efed38b1 (run 45373891260; a later dev sync brought tooling and docs only), `browser --changed --base dev` 2/2. **Codex did not review it** (out of credits, `--no-review`). Report filed; to-test: `to-test/2026-11-24-0535-fixes-bug.md`. Docs folded (`appointments.md`, `todos.md`). Slice worktrees removed. Land first refused on a stale dev-brake notice for B-729 (landed in wave 12) until `prd sync --force`.

**Wave 13 landed in dev through PR #136 as 99598435** (2026-11-24): `components` CI green on 82a3cf1 (run 45364779288), after a `sync --force` that brought dev's trimmed `machinery.md` (land refused on its budget). **Codex did not review it** (out of credits, `--no-review`). Report: ask a170. To-test: `to-test/2026-11-24-0433-fixes-bug.md`. Docs folded (`medications.md` at 10 236 B, `appointments.md`). Slice worktrees removed.

**Wave 12 landed in dev through PR #135 as bcf6ffff** (2026-11-24): `components` CI green on 3f0707eb (run 45358073493), `browser --changed --base dev` 11/11 (lean set included). **Codex did not review it** (out of credits, `--no-review`). Report: ask a166. To-test: `to-test/2026-11-24-0353-fixes-bug.md`. Docs folded (medications, connectors, assistant, calendars; all within a few bytes of 10 KB: trim when adding). Slice worktrees removed. B-729 (the dev brake) was a test reading due slots at the real clock; inbox-agent-37 was told it's in dev.

**Wave 12 (slices 49–61, all on opus):** resumed after a rotation; git matched _Status_, no slice in flight, already up to date with dev. **Held for a later wave:** B-689, B-690 and B-715, because member-avatars holds `routes/app/groups/planner/`. New York run of the nine other zone files on b21f66d2: 25 of 93 tests fail. Most hard-code Los Angeles times; B-708's all-day day (Jul 24 for Jul 25) may be a real bug, so each slice decides from evidence.

**Wave 11 landed in dev through PR #131 as ae42c519** (2026-11-23): `components` CI green on 9f3264ca (run 45248060450). **Codex did not review it** (out of credits, `--no-review`). To-test: `to-test/2026-11-23-1432-fixes-bug.md`. Docs folded (care-periods, calendars, assistant; the last two at their 10 KB budget: trim when adding). **Next session:** `pnpm prd sync`, ingest, recheck hot files (`pnpm backlog prd list`), then write wave 12 from the triaged items: B-615 (stay off the upsert's duplicate return and `mayRestoreDose`), B-689, B-690, B-717, B-718, B-719 and the America/New_York component test failures B-706 to B-715.

**Wave 11 landing (resumed after a rotation; git matched this Status).** Slices 43-48 are merged and their worktrees and branches are already gone. Synced with dev as 481a2563 (brings app code and migration 0042), so the verdict on 89125c4c no longer covers the tip: `components` CI requested on the synced tip, no quick check (the user's word). **Next:** on green, `pnpm datastore:migrate` (never reset), `pnpm prd serve --restart`, `pnpm prd browser --changed --base dev`, fold docs (care-periods, calendars, assistant), `pnpm prd pr fixes-bug`, review, land `--tier components`. **Done since:** migrated (0042), docs folded (42db5f13), `browser --changed --base dev` passed (sign-in, session-end, invites, ui; `roundtrip` after a PowerSync restart: don't rerun). `roundtrip` first failed 4 times on the avatar step because this stack's PowerSync still had the sync config from before a dev sync. **`components` CI green on 9f3264ca (run 45248060450; one quarantined failure, a Planner test this branch doesn't touch).** PR opened next, then `pnpm prd review fixes-bug --wait`, then `pnpm prd land fixes-bug --tier components -m "fix(fixes-bug): six bug fixes across timeline, sheets, consent, quick entry and sign-up (B-656, B-657, B-659, B-662, B-666, B-675)"`. No Status commit between the review and the landing: it moves the PR's head. The report names the B-666 hand test and B-717, B-718.

**Wave 11 progress:** all six slices merged; worktrees stay until the wave's verdict is green. Follow-up B-717 (consent refused on an old bundle). At landing also fold B-662 into `assistant.md` (_Doses_; at its 10 KB budget, trim). Browser: `roundtrip` is named by `carePeriodTrack.ts`; run `browser --changed --base dev`. Slice 44 changed the shared sheet guard: watch other sheets in the `components` run. Hand test for B-666: real password manager on join, link invite and email invite. **CI on 5850c33f (synced with dev; quick check passed): `file`, run 45241794955.** Three `providers.browser.test.tsx` tests (B-603, asking before losing ticks) are the branch's per blame (green on dev, run 45243680483); sent to slice 44's agent as a fix request, in flight: no rotation until it is merged and the wave is green. `pnpm datastore:reset` was refused by the permission classifier: use `pnpm datastore:migrate` (0041 from dev) before the browser checks. Follow-ups filed: B-717, B-718 (quick entry asks an amount on a skipped or refused dose). Slice 44's fix (arrival rule only inside `data-sheet-arrives`, used by the pass log) merged as 990dd9bc; CI rerun next. **User's word for wave 11: no orchestrator quick check when a CI run follows** (`components` CI runs all of it; the backlog session is hotfixing the brief). The quick check on 527a3e71 was stopped on that word; code there equals c37e20a4, whose slice check passed. **Next:** wait for the `components` verdict on this tip (`pnpm prd ci run components --wait`); on green `pnpm datastore:migrate` (never reset), `pnpm prd serve --restart`, `pnpm prd browser --changed --base dev`, `pnpm prd rm` slices 43-48, fold docs (care-periods, calendars, assistant), `pnpm prd pr fixes-bug`, review, land `--tier components`. The landing report names the B-666 hand test and B-717, B-718. **`components` CI green on 89125c4c (run 45246214936; the only quarantined failure is `scripts/loops/lease.test.mjs`, not this branch's). Rotated here for context, no slice in flight. Next:** the steps above from `pnpm datastore:migrate` on (the verdict is in; don't rerun it, and this Status commit is docs only). **Next wave:** B-615 is free (dose-accuracy wave 5 landed as 1b2723a2), but stay off the upsert's duplicate return and `mayRestoreDose` (dose-accuracy slice 7, B-627).

**Wave 11 (slices 43–48, B-656, B-657, B-659, B-662, B-666, B-675, all on opus):** resumed after an interruption; git matched this Status, no slice in flight, already synced with dev (fa432c69). **Held for a later wave:** B-615 (dose-accuracy's wave 5 is still changing the `timelineEntryService` upsert; it will message), B-689 and B-690 (member-avatars holds `routes/app/groups/planner/`). At landing, fold the B-659 consent rule into `calendars.md` and B-656 into `care-periods.md`; `calendars.md` is near its 10 KB budget, so trim when adding.

**Wave 10 landed in dev through PR #124 as 07529c63** (2026-11-23): `components` CI green on c3d6f826 (run 45227226270). **Codex did not review it** (out of credits, `--no-review`). Report: ask a151. To-test: `to-test/2026-11-23-1235-fixes-bug.md`. Docs already folded (`care-periods.md`). **Next session:** `pnpm prd sync`, ingest, recheck hot files, then write wave 11 from the triaged items: B-615, B-656, B-657, B-659, B-662, B-666, B-675, B-689, B-690.

**Wave 10 (slices 41–42, B-620, B-631, both on opus):** ui-kit-5's last wave landed as a5ec12da, which frees the timeline files; synced as 7f2e8685. B-615 and B-616 stay held as above. Slice 41 merged (slice check passed on c957fd24); its worktree stays until the wave is green. At landing, fold into `docs/domain/care-periods.md`: a day header counts to its own viewer-zone date. New item B-656 (a period starting just after midnight in the recipient's zone shows day 1 on two headers for a viewer behind that zone) waits for a later wave. Slice 42 merged (slice check passed on 09f40ff6); its worktree stays until the wave is green. New item B-657 (after a successful Add a medication, Back loses unsaved dose edits without asking) waits for a later wave. Synced as 7ab994fc (brings migrations 0039 and 0040; database reset): quick check passed, `components` CI green (run 45221463090). Slice worktrees removed; `care-periods.md` folded. `browser --changed --base dev` (roundtrip, ui) passed on c617e7f5 (don't rerun). Synced again as c3d6f826 (dose-accuracy wave 4, no migration): quick check passed, `components` CI green (run 45227226270). **PR #124 is open. Rotated here for context (no slice in flight). Next:** `pnpm prd review fixes-bug --wait` in the background, triage, then `pnpm prd land fixes-bug --tier components -m "fix(fixes-bug): day headers never repeat a care period day, Back asks after a refused action (B-620, B-631)"`. No Status commit between the review and the landing: it moves the PR's head. Land's report names Codex's verdict; the report text covers B-620, B-631 and the follow-ups B-656, B-657. The tier command reads files from stdin: `git diff --name-only dev...HEAD | node scripts/loops/check-plan.mjs --propose --repo "$PWD" --base dev --head HEAD`.

**Hand-over (after the wave 9 landing; no slice in flight).** **Next wave:** `pnpm prd sync`, ingest, then plan any new triaged item. **Held:** recheck `pnpm backlog prd list` for B-615 and B-616 (dose-accuracy holds `timelineEntryService.ts`, `assistantActionService.ts`) and B-620 and B-631 (ui-kit-5 holds `routes/app/groups/timeline/`; B-620's fix is user-approved, see its note).

**Wave 9 (slice 40, B-655, on opus) landed in dev through PR #111 as ce672f1a** (2026-11-23): `integration` CI green on 221fc48b (run 45165557565; `lease.test.mjs` quarantined and passed), quick check and Codex clean on 221fc48; `browser --changed` needs none. To-test: `to-test/2026-11-23-0633-fixes-bug.md`. No doc fold: `assistant.md` already states the rule. Slice worktree removed.

**Wave 8 (slices 38–39, B-651, B-652, both on opus) landed in dev through PR #109 as c1c5b0bf** (2026-11-23): `integration` CI on 53ab862c was `flake` (run 45159391173; only `scripts/loops/lease.test.mjs`, not this branch's, noted on B-654), quick check on 53ab862c, Codex clean on b29e187; `browser --changed` needs none. To-test: `to-test/2026-11-23-0558-fixes-bug.md`. Docs folded (`assistant.md`, exactly at its 10 KB budget: trim when adding). Slice worktrees removed.

**Wave 7 (slices 35–37, B-648, B-647, B-646, all on opus) landed in dev through PR #108 as bdff2e8** (2026-11-23): `integration` CI on 943a1b2c was `flake` (run 45155090185; only `scripts/loops/lease.test.mjs`, not this branch's, filed as B-654), quick check and Codex clean on 943a1b2c; `browser --changed` needs none. To-test: `to-test/2026-11-23-0529-fixes-bug.md`. Docs folded (`assistant.md`, at its 10 KB budget: trim when adding). Slice worktrees removed.

**Wave 6 (slices 32–34, B-644, B-643, B-641, all on opus) landed in dev through PR #105 as a235304c** (2026-11-23): `integration` CI green on d7dab0c5 (run 45147868591), quick check and Codex clean on d7dab0c5; `browser --changed` needs none. To-test: `to-test/2026-11-23-0442-fixes-bug.md`. Docs folded (`assistant.md`, at its 10 KB budget: trim when adding). Slice worktrees removed.

**Wave 5 (slices 28–31, B-628, B-632, B-634, B-635, all on opus) landed in dev through PR #102 as a04034ec** (2026-11-23): `integration` CI green on de1b975c (run 45140076884), quick check on 039ea84f, Codex clean on 039ea84f; `browser --changed` needs none. To-test: `to-test/2026-11-23-0359-fixes-bug.md`. Docs folded (`assistant.md`, exactly at its 10 KB budget: trim when adding). Slice worktrees removed. Known limit left as is: `finished 2nd at the race` reads as a day.

**Wave 4 (slices 19–27, B-527, B-578, B-580, B-581, B-591, B-599, B-601, B-602, B-605, all on opus) landed in dev through PR #100 as b97b5d69** (2026-11-23): `components` CI green on 336578d3 (run 45131667111), Codex clean, browser `roundtrip` and `ui` passed; lean `--suite` not run (the user's standing rule: ask first). To-test: `to-test/2026-11-23-0247-fixes-bug.md`. Docs folded (assistant, ui-kit, todos, connectors; all at the 10 KB line, trim when adding). Slice worktrees removed.

**Wave 3 (slice 18, B-510) landed in dev through PR #57** (2026-11-22). `pnpm prd check` takes no reason (only `--quick` does).

| Slice | Item  | State                                      | Merge    |
| ----- | ----- | ------------------------------------------ | -------- |
| 67    | B-690 | landed (PlannerHeader import conflict)     | ce0cbf74 |
| 66    | B-689 | landed                                     | c25d2c1b |
| 65    | B-715 | landed (test only)                         | 5a088bc9 |
| 64    | B-728 | landed (ask a168, vetoable)                | 5f29ce60 |
| 63    | B-726 | landed                                     | 731dd3fa |
| 62    | B-729 | landed (test only)                         | 7c92d280 |
| 61    | B-714 | landed                                     | e1fb3268 |
| 60    | B-713 | landed                                     | 417c0719 |
| 59    | B-712 | landed                                     | 57459518 |
| 58    | B-711 | landed                                     | 00c8c823 |
| 57    | B-710 | landed                                     | 2767bd9d |
| 56    | B-709 | landed                                     | 4d419f6f |
| 55    | B-708 | landed                                     | b965c5cd |
| 54    | B-707 | landed                                     | db29dbe1 |
| 53    | B-706 | landed                                     | b692a863 |
| 52    | B-719 | landed                                     | 09e91a94 |
| 51    | B-718 | landed                                     | 01632c12 |
| 50    | B-717 | landed                                     | 16156d44 |
| 49    | B-615 | landed (ask a161)                          | ec9155df |
| 48    | B-675 | landed                                     | 3d8e9cf5 |
| 47    | B-666 | landed (needs a hand test)                 | 288e9cbe |
| 46    | B-662 | landed (assistant.md folded)               | 8c930686 |
| 45    | B-659 | landed (calendars.md folded)               | 0a8ccfcc |
| 44    | B-657 | landed (with its CI fix)                   | 990dd9bc |
| 43    | B-656 | landed (care-periods.md folded)            | a449f67c |
| 42    | B-631 | landed                                     | 2a479df8 |
| 41    | B-620 | landed (care-periods.md folded)            | ab9dcfae |
| 40    | B-655 | landed                                     | 487cb235 |
| 39    | B-652 | landed                                     | 7be34f48 |
| 38    | B-651 | landed                                     | a447334a |
| 37    | B-646 | landed                                     | ce4d22b1 |
| 36    | B-647 | landed                                     | 3e6adea0 |
| 35    | B-648 | landed                                     | 11820cae |
| 34    | B-641 | landed                                     | 501a58bf |
| 33    | B-643 | landed                                     | ce9c55a2 |
| 32    | B-644 | landed                                     | a4252709 |
| 31    | B-635 | landed                                     | b1cf109f |
| 30    | B-634 | landed                                     | c2c53eee |
| 29    | B-632 | landed                                     | 82eebf78 |
| 28    | B-628 | landed                                     | 46f779de |
| 27    | B-605 | landed                                     | 23e69857 |
| 26    | B-602 | landed                                     | 43e222d4 |
| 25    | B-601 | landed                                     | efb9d552 |
| 24    | B-599 | landed                                     | f8c90c02 |
| 23    | B-581 | landed                                     | b0cd6f61 |
| 22    | B-580 | landed                                     | 330d9639 |
| 21    | B-591 | landed                                     | c177aa58 |
| 20    | B-578 | landed                                     | 5d7cfdcf |
| 19    | B-527 | landed                                     | 04f5e825 |
| 18    | B-510 | landed                                     | 5d096ce3 |
| 17    | B-472 | landed (+B-482; layout-offline at landing) | 3114a864 |
| 16    | B-470 | landed                                     | 7e65e0ab |
| 15    | B-469 | landed (search.md at landing)              | 681f425b |
| 14    | B-382 | landed (todos.md at landing)               | 586cee75 |
| 13    | B-318 | landed                                     | 61d7355f |
| 12    | B-393 | landed (test only)                         | f9fb803b |
| 11    | B-386 | landed                                     | 1327d9bd |
| 10    | B-385 | landed (resetStaging flake: B-466)         | 9736353b |
| 9     | B-323 | landed (live-notes at landing)             | e7cb1d5e |
| 8     | B-322 | landed                                     | 59763904 |
| 7     | B-321 | landed                                     | c2605057 |
| 6     | B-320 | landed                                     | a40b9713 |
| 5     | B-317 | landed                                     | 7fb498ee |
| 4     | B-315 | landed (first-sync at landing)             | 3dc2f3cd |
| 3     | B-314 | landed                                     | 8fa65e6f |
| 2     | B-312 | landed                                     | 233dd07d |
| 1     | B-310 | landed                                     | 6afc3f58 |

**Wave 12 hand-over (rotated mid-wave for context, 2026-11-23). Nothing is merged yet; merge in plan order, 49 to 61.** Handed off, clean, quick check passed: 50 at 55b32372, 51 at dd042445, 52 at d880bd00, 53 at c96afea4, 54 at dc764a2e, 55 at a549ae6a, 56 at 9134375e, 57 at f5745c73, 58 at 88bd4c2b, 59 at 662973e9, 60 at 803c90cc, 61 at a432a42b. All zone slices (53–61) were test-only: the app was right, including B-708's all-day day.

- **Slice 49 (B-615) is the only one in flight.** Its first hand-off was af715f46. Skeptic s18 decided (ask a161, the user can veto): a `log_dose` is a repeat only when the amount and note also match; a differing call records a separate dose on a random id. The fix is committed as 4b5bc80d and its quick check was running at rotation. Respawn with `--continue` if there's no hand-off for that tip; confirm the check passed and that a test covers different amount, different note and identical retry.
- **Expect a conflict check** between 49 and 52 only if `timelineEntryService.ts` appears in 49's diff (it shouldn't).
- **Gate:** slice 50 changes `serviceWorkerRegister.ts`, which `check-areas` maps to `@suite`, so `browser --changed --base dev` pulls in the lean set; run it once. Tier: take the check plan's proposal. Use `pnpm datastore:migrate`, never reset.
- **Follow-ups filed:** B-726 (a retried dose upload can still bring back an undone dose after a time edit), B-728 (repeat preview pairs the recipient's day with the viewer's time; the fix needs a product choice). Both triaged for fixes-bug. B-719's new tests were never seen failing on the old code (the agent's direct run was blocked): say so in the report.
- **Hand test for the report:** B-717's Reload with a real service worker update after a deploy; unit tests use fakes.
- **Docs at landing:** `connectors.md` and `medications.md` (`log_dose` slot identity, "Already logged", the repeat rule); `assistant.md` _Doses_ (`asksAmount` is for a given dose only; at budget, trim); `calendars.md` (reload on an outdated consent; at budget, trim). `docs/agents/machinery.md` is 8 B over budget from before this wave: don't grow it.
- **Still held:** B-689, B-690, B-715 (member-avatars holds the Planner folder).
- **Resumed after the mid-wave rotation (2026-11-23); git matched this Status.** Nothing merged, 50–61 clean at the SHAs above, `prd/fixes-bug` is 35 commits behind `dev`. Slice 49 respawned with `--continue` on opus to confirm its tests and check on 4b5bc80d. Its slice check passed on 4b5bc80d (30 of 30 integration tests). **All of 49 to 61 are merged (tip e1fb3268); worktrees stay until the wave is green.** The landing report must say: a `log_dose` that leaves out the amount or note counts as a repeat of the recorded dose (`saysTheSame`), so a real second dose logged bare reports "Already logged"; this is looser than a161's wording. Synced with dev as 64d52d8c (no migration or sync config change); `components` CI requested on the synced tip, no quick check. **`components` CI on 4bd1a186: `brake`** (run 45258699609), one failure: `syncMedications.int.test.ts` "two members' doses for one slot keeps Given and Skipped as two rows". It fails on dev too (inbox-agent's narrowed run 45259937817 on 54a43bf1; our blame returned unknown, GitHub unreachable), filed as B-729 to fixes-bug. **Slice 62 (B-729) started on opus** to find the cause and fix it; inbox-agent-37 waits on it (told yes; message it when B-729 lands in dev). No rotation until 62 is merged and the wave is green. Slice 62 merged as 7c92d280: the test read due slots at the real clock, so after 20:00 UTC the dose answered tomorrow's slot; test only, no app change. **`components` CI green on 3f0707eb (run 45358073493).** Slice worktrees 49-62 removed; database migrated, server restarted (no sync config change since wave 11, so no PowerSync restart); docs folded (medications, connectors, assistant, calendars, all under 10 KB). `browser --changed --base dev` running (pulls the lean set; run once). **Next:** `pnpm datastore:migrate` (never reset), PowerSync restart if `sync-config.yaml` changed, `pnpm prd serve --restart`, `pnpm prd browser --changed --base dev` once, `pnpm prd rm` slices 49-61, fold docs, `pnpm prd pr fixes-bug`, review, land `--tier components`.

**Next session (wave 13):** `pnpm prd sync`, ingest, recheck hot files (`pnpm backlog prd list`), then write wave 13 from the triaged items: B-726 (a retried dose upload after a time edit), and B-689, B-690, B-715 once member-avatars no longer holds `routes/app/groups/planner/`. B-728 (repeat preview pairs the recipient's day with the viewer's time) needs a product choice first: ask through `pnpm prd ask` before planning it.

**Next session (wave 14):** `pnpm prd sync`, ingest, recheck hot files (`pnpm backlog prd list`). The only waiting items are B-689, B-690 and B-715, all held while member-avatars (`running`, its slice 4 handed off) holds `routes/app/groups/planner/`. If it still runs, ask its orchestrator (ListAgents, SendMessage) to message at landing and set a background watch that exits when its row leaves `running`; write wave 14 from the three once it clears. If ask a168 is vetoed, B-728 goes back as a new slice.

**Next session:** no fixes-bug item waits. `pnpm prd sync`, ingest, `pnpm backlog list` for new triaged `fixes-bug` items, then write wave 15 from them.

**Wave 20** (landed PR #273, 2026-11-27): | 81 | B-978 | merged (opus) | e524785a8 |, an installed app checks for a new version on resume and hourly (5-min throttle).
