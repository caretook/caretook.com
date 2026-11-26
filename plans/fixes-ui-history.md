# History: fixes-ui

Finished-wave history moved out of [the plan](fixes-ui-plan.md)'s _Status_ by `pnpm prd status-trim fixes-ui`, the newest trim first.

## Trimmed 2026-11-26

**Wave 14 (2026-11-25, this session):** synced dev (d2d851b7) into prd/fixes-ui first. Slices 79–84: B-819 no-group loading (opus), B-833 quick entry tips use the group's names (opus), B-843 members invite cards on a phone (opus), B-848 header overlap at medium widths (opus), B-849 View menu Condensed/Full (sonnet, a rename), B-850 Full view rich live notes (opus; may outgrow a fix). All six run at once; hot files set on the registry row; items claimed. All six merged. CI components run 45742849440 (a9c81be4): brake; blame: branch's timelineRichText.browser.test ("Cards" after 83's rename, sent to 84) and groupChoicePending.browser.test (loads read before the loader ran, sent to 79); groups.int admin codes flaky (not ours). Fixes merged: 79 (10ee64c0), 84 (8ccf1fef); CI components green (run 45744852768, 39c3f1a4). Synced dev (local 731fa6da); slice worktrees removed; recheck components on the synced tip out; `browser --suite` blocked by the permission classifier (as in wave 5), `browser --changed --base dev` 5/6: layout-offline.spec failed on the old "Cards" label (slice 83 missed scripts/browser-checks); fixed by a sonnet fix agent (merge 858da9a4), layout-offline then passed. Recheck components green on the synced tip (run 45746157575, 6759b1b2). PR and Codex review next, then land. Slice 83 also renamed Settings > Timeline layout and edited docs/domain/timeline.md (a loop shouldn't; kept as the wave's fold). Slice 80 added "event"/"events" as quick entry `appointmentWord` rows (packages/data vocabulary); the parser's preview still titles events "Appointment with …" (follow-up, B-537 wording). At landing fold into live-notes.md: Full view cards render a note's formatting from its Yjs snapshot via `lib/live-notes/noteRichText.ts` and `components/entry/NoteRichText.tsx` (no Tiptap on the timeline; cache per doc in notes.sync.ts; mentions show their typed name) (slice 84). At landing fold into app-shell.md: header section links are icons only (label sr-only, `title` hint) from `sm` to `lg`; the group menu trigger shrinks and truncates (slice 82). Still held: B-694 (the user approves each form live), B-325 (Capacitor). Wave 13 landed as dev 62ebbeeb (PR #190), details in the history file.

| Slice | Item  | State           | Merge    |
| ----- | ----- | --------------- | -------- |
| 84    | B-850 | merged (opus)   | c492621a |
| 83    | B-849 | merged (sonnet) | df82660c |
| 82    | B-848 | merged (opus)   | 4f356153 |
| 81    | B-843 | merged (opus)   | 606ed5da |
| 80    | B-833 | merged (opus)   | 3632f035 |
| 79    | B-819 | merged (opus)   | cf023ddf |

## Trimmed 2026-11-25

**Wave 13 (2026-11-25, the user's pre-call wave):** only B-342, B-817, B-828 (slices 76–78, all opus). Held for later: B-325 (native safe area), B-694 (long create forms on tabs), B-819 (no-group page feedback), B-833 (quick entry tip uses a group provider). Slice worktrees made with `CARETOOK_USAGE_WATCH=off` (split week). **Deadline:** land and `pnpm prd rm fixes-ui` within about 2 to 2.5 h of 2026-11-25 start, before orchestration-split wave 6 (if late, wave 6 waits). Hot files set on the registry row.

| Slice | Item  | State         | Merge    |
| ----- | ----- | ------------- | -------- |
| 78    | B-828 | merged (opus) | ee6117ca |
| 77    | B-817 | merged (opus) | e57ed71a |
| 76    | B-342 | merged (opus) | dc2e5fc4 |

## Trimmed 2026-11-25

**Next step (hand-over):** wave 12 landed 2026-11-24 23:51 as dev ea38277 through PR #180, `--no-review` (Codex out of credits); CI components green (run 45547361491, 2246ae8f), landed unsynced (dev shared no file); browser --changed --base dev 11/11. Slices, all opus: 73 (B-803, 3rem glass tab bar, sliding `data-tab-bar-indicator` pill), 74 (B-804, `OfflineBanner` after a 3 s grace, mounted after the staff announcement), 75 (B-806, `brand/AppLoading` as root HydrateFallback, 300 ms CSS delay). Sent back twice: the banner flashed on every online cold load (grace added); the first CI run (45545458788) broke staff.browser.test (`header + [data-region="announcement"]`). Lesson: a new region in the layout breaks frame tests that pin sibling order; name staff/frame tests in such a slice. Report filed; to-test/2026-11-24-2351-fixes-ui.md. Docs folded into app-shell.md (trimmed to budget). Slice worktrees removed. **Next session:** `pnpm backlog ingest` and `list`; no triaged fixes-ui item waits except the held B-694 (user approves each form live) and B-325 (Capacitor; its blank-start half now done by B-806).

## Trimmed 2026-11-25

| Slice | Item  | State                                       | Merge    |
| ----- | ----- | ------------------------------------------- | -------- |
| 69    | B-793 | merged; CI green; worktree removed; PR #177 | 4bc3c614 |

## Trimmed 2026-11-25

| Slice | Item  | State           | Merge                  |
| ----- | ----- | --------------- | ---------------------- |
| 68    | B-697 | landed (wave 9) | 1b24ff73               |
| 67    | B-693 | landed (wave 9) | 8ba36ee2               |
| 66    | B-669 | landed (wave 9) | e2f1d254, fix da4d28c8 |

## Trimmed 2026-11-25

| Slice | Item  | State                      | Merge    |
| ----- | ----- | -------------------------- | -------- |
| 65    | B-695 | merged                     | 336425e9 |
| 64    | B-695 | merged (tests only)        | 5e79829a |
| 63    | B-695 | merged (22 files, over 12) | 93a86cc8 |
| 62    | B-788 | merged                     | e00d3ae5 |

## Trimmed 2026-11-24

**Wave 6** (session started 2026-11-24 after wave 5's landing): slices 49–58 written; base prd/fixes-ui 06a7d588 (dev f7d3ec8b plus docs). Asks a199–a201 decided by skeptics (B-698 Log opens the Dose sheet, B-700 Given all as Schedule, B-680 builds from its notes). Chains 54→55, 53+55→56, 57→58. Models: opus for all but 58 (sonnet). Still held, with why: B-684 and B-695 (app-wide sweeps, a wave each, after wave 6); B-693, B-697 (toast system B-669, onboarding-2 held); B-694 (user approves each form live); B-325 (Capacitor). Consent text in connectorRules.ts says "appointments": slice 49 left it (a consent change is the user's). At landing fold into connectors.md: `upcoming` is "Upcoming events and todos" (items `event`/`todo`), prompt `prepare_for_event` with arg `event`, `add_event` titled "Add an event"; no aliases. components.md Motion: two durations, `--motion-fast` 120 ms and `--motion` 240 ms (`--motion-slow` gone); menus/popovers on `--motion`; sheets only fade; Collapse and Chevron on `--motion` (slice 50). Hand tests: Today card vs day summary side by side, a toast by eye. live-notes.md: full screen is a native dialog the editor frame moves into (same Tiptap/Yjs instance); it closes on Escape itself since ProseMirror swallows Escape, except while the mention popup is open (slice 51; that case untested). app-shell.md: failed chunks reload once to the target (`staleChunk.ts`, entry.client.tsx, web only); bug not reproduced (slice 52). Hand test: stale tab across a staging deploy. medications.md: passes order by time, then name; no manual order (sort_order kept, unused) (slice 53). medications.md: DoseSlot.extra / AsNeededToday.extra mark a double dose; ExtraDoseWarning on Today rows, pass cards, as-needed past max and the medication page (slice 54). ui-kit.md/components.md: `ui/SearchFilterBar` ("Type to search", `?q=`, FilterMenu + chips) on medications, providers, Planner (below the tabs, per tab, text not carried) and Todos; substring match via `lib/core/textFilter.ts`, Past filters ids into the paged SQL (slice 57). Hand test: phone, bar under the Planner tabs. medications.md: `MedicationCard` (stretched link with state, controls z-10) for list, Today and as-needed rows; list Log opens the Dose sheet (closing it lands on the timeline, not the list: follow-up candidate) (slice 55).

| Slice | Item  | State           | Merge    |
| ----- | ----- | --------------- | -------- |
| 58    | B-748 | merged (sonnet) | 27823c3e |
| 57    | B-680 | merged (opus)   | e020375b |
| 56    | B-700 | merged (opus)   | e0e5dbb3 |
| 55    | B-698 | merged (opus)   | 0419f380 |
| 54    | B-606 | merged (opus)   | c312d03e |
| 53    | B-701 | merged (opus)   | a30cf79a |
| 52    | B-735 | merged (opus)   | 12bcaa29 |
| 51    | B-765 | merged (opus)   | 15167ea9 |
| 50    | B-613 | merged (opus)   | 0157d117 |
| 49    | B-583 | merged (opus)   | aef5557c |

## Trimmed 2026-11-24

**Wave 5 landed 2026-11-24** as dev f7d3ec8b through PR #164, `--no-review` (Codex out of credits), components CI `flake` (run 45485782241, usersAdmin int test, not ours, filed B-782); report filed; to-test/2026-11-24-1608-fixes-ui.md. Slices 34–48 merged; the three components failures were test-only fixes (34, 42, 48). Docs folded (ui-kit, medications, care-groups, assistant, timeline). All slice worktrees removed. Browser suite not run (permission classifier blocked it). Lesson: keep slice worktrees until land's own tier is green (land ranks components above integration). **Next session:** wave 6: `pnpm backlog ingest`/`list`, write slices for the triaged items not held (see the held list), then run them.

| Slice | Item  | State                                                                                                       | Merge    |
| ----- | ----- | ----------------------------------------------------------------------------------------------------------- | -------- |
| 48    | B-737 | merged (easy mode gets no copy links)                                                                       | a2a3ebd2 |
| 47    | B-736 | merged                                                                                                      | da9de73f |
| 46    | B-692 | merged (DateTimeField `onCalendarPick`: ui-kit doc at landing)                                              | 438dd248 |
| 45    | B-691 | merged (touches ui/Popover.tsx: all popovers scroll inside)                                                 | 4ad16c07 |
| 44    | B-756 | merged                                                                                                      | d59db667 |
| 43    | B-617 | merged (ui kit: OUTLINED, motion-press, IconButton count; docs at landing)                                  | abb099ce |
| 42    | B-762 | merged (17 files: quick entry parser in packages/, MedicationForm, ProviderForm; assistant doc at landing)  | b7c7882c |
| 41    | B-676 | merged                                                                                                      | ec911d5d |
| 40    | B-621 | merged (other quick entry tests may now see the panel: watch CI)                                            | 6df9f7cb |
| 39    | B-636 | merged                                                                                                      | 5cbbe830 |
| 38    | B-664 | merged                                                                                                      | 221141c3 |
| 37    | B-679 | merged (packages/: integration tier)                                                                        | 3d21f402 |
| 36    | B-673 | merged (shared matcher lib/core/nameSuggestions.ts; edits allergies.browser.test.tsx, may conflict with 34) | f0f672c7 |
| 35    | B-672 | merged (typing-mode lists cover the next field: tests Tab after a fill)                                     | d1cdca07 |
| 34    | B-594 | merged                                                                                                      | 86d98496 |

## Trimmed 2026-11-24

**Wave 4** (2026-11-24, session 1): slices 18–33 written from the triaged items; base `prd/fixes-ui` = dev 91f30299. Running topic: symptom-catalog (its hot files excluded). Chains: 22→23, 25→26→27→28, 30→31. Models: sonnet for 20, 21, 28; opus for the rest. Merge order: handed-off slices merge in plan order among themselves, without waiting for an earlier slice still running when a chain waits on a later one (20 and 25 merged before 19, 21, 22, 24). At landing fold into docs: care-groups.md (RoleHelp dialog, GROUP_ROLES sees/changes; member rows carry no role description on purpose), providers.md (phone label select with Custom).

| Slice | Item  | State           | Merge    |
| ----- | ----- | --------------- | -------- |
| 33    | B-699 | merged (opus)   | 98a3381c |
| 32    | B-629 | merged (opus)   | 4cbcd7b2 |
| 31    | B-678 | merged (opus)   | dad4b7b0 |
| 30    | B-677 | merged (opus)   | 7603ae58 |
| 29    | B-668 | merged (opus)   | 760dca52 |
| 28    | B-674 | merged (sonnet) | e6739d85 |
| 27    | B-688 | merged (opus)   | a7d65e3c |
| 26    | B-687 | merged (opus)   | 3c1d55a1 |
| 25    | B-686 | merged (opus)   | 948eebc8 |
| 24    | B-685 | merged (opus)   | 4fee8d5d |
| 23    | B-763 | merged (opus)   | 633ba99c |
| 22    | B-683 | merged (opus)   | d832219e |
| 21    | B-682 | merged (sonnet) | 5d3a4404 |
| 20    | B-702 | merged (sonnet) | a0510b3d |
| 19    | B-663 | merged (opus)   | 28e7247b |
| 18    | B-618 | merged (opus)   | 4ecaa3f5 |
| 17    | B-603 | merged (opus)   | 18180d36 |
| 16    | B-592 | merged (opus)   | 6af2f056 |
| 15    | B-585 | merged (opus)   | 52d2e14b |
| 14    | B-316 | merged (opus)   | 3c7a6607 |
| 13    | B-535 | merged (opus)   | 1dc972d8 |
| 12    | B-537 | merged (opus)   | 5566480a |
| 11    | B-575 | merged (sonnet) | 123f2b24 |
| 10    | B-536 | merged (sonnet) | c9c510cf |
| 9     | B-319 | merged (opus)   | 488e09bf |
| 8     | B-421 | merged (opus)   | fc5dbe18 |
| 7     | B-422 | merged (opus)   | 8834115b |
| 6     | B-413 | merged (opus)   | 13ac9f5a |
| 5     | B-519 | merged (opus)   | b2aa214a |
| 4     | B-412 | merged (opus)   | 91aced06 |
| 3     | B-538 | merged (opus)   | 439b6571 |
| 2     | B-416 | merged (opus)   | f6f40e4f |
| 1     | B-256 | merged (opus)   | b5373bc9 |
