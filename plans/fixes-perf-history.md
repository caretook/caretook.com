# History: fixes-perf

Finished-wave history moved out of [the plan](fixes-perf-plan.md)'s _Status_ by `pnpm prd status-trim fixes-perf`, the newest trim first.

## Trimmed 2026-11-27

**Wave 2: all merged; full CI green** (run 46005700354, 39535baa; tier full for scripts/build/budget.json); dev sync needed no merge; PR #254 open, Codex out of credits (land `--no-review`); docs folded (e4477848). **Landing now:** browser `layout-offline` fails at the offline edit-link step on the wave 1 tip too (slice 9 reverted), so it predates wave 2: filed as B-967 (fixes-tooling); the other 10 changed checks pass. **Then stop (the user, via the backlog session, 2026-11-27):** land wave 2, no new slices, message the backlog session (caretook-com-bb), then `pnpm prd rm fixes-perf`; B-965 and B-966 stay triaged for a later run (2026-11-27): slices 8-12 (B-956, B-958, B-959, B-960, B-963), all on Opus; dev needed no sync. Slice 11 waits for slice 10 (both measure the first load). B-963 filed this session from the wave 1 hand-over.

| Slice | Item  | State  | Merge    |
| ----- | ----- | ------ | -------- |
| 12    | B-963 | merged | 847722a6 |
| 11    | B-960 | merged | c81f220e |
| 10    | B-959 | merged | 5fe00bdf |
| 9     | B-958 | merged | 6abd6279 |
| 8     | B-956 | merged | b2d5967b |

## Trimmed 2026-11-27

| Slice | Item  | State  | Merge    |
| ----- | ----- | ------ | -------- |
| 7     | B-764 | merged | 68a26101 |
| 6     | B-798 | merged | fb6c8b7b |
| 5     | B-910 | merged | 69b26356 |
| 4     | B-884 | merged | 4c969a9d |
| 3     | B-313 | merged | 51d6df4b |
| 2     | B-755 | merged | 4adf10d3 |
| 1     | B-311 | merged | 37c40171 |
