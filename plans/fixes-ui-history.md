# History: fixes-ui

Finished-wave history moved out of [the plan](fixes-ui-plan.md)'s _Status_ by `pnpm prd status-trim fixes-ui`, the newest trim first.

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
