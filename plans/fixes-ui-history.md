# History: fixes-ui

Finished-wave history moved out of [the plan](fixes-ui-plan.md)'s _Status_ by `pnpm prd status-trim fixes-ui`, the newest trim first.

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
