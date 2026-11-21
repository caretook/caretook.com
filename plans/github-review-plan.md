# Plan: GitHub review

> Source PRD: [`plans/github-review-prd.md`](github-review-prd.md). User-story numbers (US) refer to it. Backlog item B-203. Topic `github-review`.

## Status

| Slice | Wave | State                                                                                                                   | Merge into `prd/github-review` (slice commits) |
| ----- | ---- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1     | 1    | blocked: push of throwaway fixture branch denied by permissions; module + `review` built (a8bc173b), needs live capture |                                                |
| 2     | 2    | not started                                                                                                             |                                                |
| 3     | 2    | not started                                                                                                             |                                                |

**Landing mode:** run everything through (queued with `pnpm prd queue`): start every ready slice, land each green wave without asking, clean up; ask only real questions. Wave 1 lands locally (no `--force` unless the user says so); wave 2 through the new PR path.

**Backlog:** B-203 is all three slices; claimed by `prd/github-review` (2026-11-20). No other items for this topic at wave 1.

## Architectural decisions

Durable decisions every slice follows:

- **Tooling only:** bash plus Node `.mjs` in `scripts/loops/`, `gh` for every GitHub call, no new dependencies, nothing in `apps/` or `packages/`. The logic worth testing lives in pure `.mjs` modules. No GitHub Actions; no workflow on `pull_request`.
- **Which branches use PRs:** `prd/<topic>` always. `hotfix/<name>` takes `--pr` or `--local`, chosen by the user each time. `plan/<topic>`, backlog commits and small direct changes always stay local.
- **The Codex verdict** is one of `waiting`, `clean`, `findings` or `stale`, computed against the PR's current head SHA. Only Codex's own threads count (one bot-login constant). A declined finding is replied to, then resolved.
- **Commands** (the `pnpm prd` front door, additive in `prd.sh`'s usage and dispatch; add at the end of the group):
  - `pnpm prd review <branch> [--json] [--wait [min]] [--again] [--resolve <threadId>]`: exit 0 clean, 1 findings, 2 waiting or stale, 75 when the wait times out.
  - `pnpm prd pr <branch> [-m "<subject>"]`: opens the PR, or updates it if it's already open.
  - `pnpm prd land <topic> […] [--pr|--local] [--no-review]`.
- **Pushing `dev`:** `pr` and `land` push the main checkout's `dev`, fast-forward only, and never force. Backlog writes still don't push.
- **The GitHub merge** is `gh pr merge --merge` with the `-m` subject, `--match-head-commit <checked tip>` and `--delete-branch`, followed by **dev-sync** in the main checkout:
  - fast-forward when `dev` is behind;
  - rebase local commits that are all backlog-tool commits;
  - otherwise a merge commit (`chore(dev): merge origin/dev after <branch>`).
  - It runs under the backlog lock and refuses a checkout that's off `dev`, mid-merge or rebase, or dirty where the update would touch.
- **Loops never edit AGENTS.md, `docs/` or `ops/`.** The orchestrator folds the docs at landing (below).
- **The check gate** is "none needed" (tooling and Markdown only). Each slice runs the tooling's own tests (`pnpm exec vitest run --project scripts:unit scripts/loops`) and `pnpm exec prettier --check` on its files. No browser checks.

## How to run this plan

- **Waves:** 1 → (2, 3). Slices 2 and 3 both add to `prd.sh` (usage and dispatch) and may both touch `lib.sh`: additive edits at the end of each group, with conflicts resolved by the orchestrator.
- **Wave 1 lands locally** with today's `pnpm prd land github-review --force -m …` (on the user's word), since the PR path doesn't exist yet.
- **Wave 2 lands through the new path**, so it's the first real run:
  1. `pnpm prd pr github-review`;
  2. `pnpm prd review github-review --wait`, then address the findings and ask again until clean (about three rounds, then ask the user);
  3. on the user's word, `pnpm prd land github-review -m "feat(github-review): …"`.
     If the new path fails mid-way, fall back to a local land on the user's word and record why in _Status_.
- **Ownership:**
  - Slice 1 owns the verdict module, its fixtures and `review`.
  - Slice 2 owns `pr`, `land.sh` and dev-sync.
  - Slice 3 owns `ready.sh`, `prompt.sh` and `rm.sh`.
- **Docs at landing (the orchestrator):**
  - `docs/agents/orchestrator.md`: _Branches and protection_ and _Landing a wave_ (PR as soon as the wave is green, review rounds, the cap of about three rounds, `--no-review` only on the user's word, the tooling pushes `dev`).
  - `docs/agents/hotfix.md`: ask "PR or local?".
  - `docs/orchestration.md`: the landing and push lines.
  - `ops/runbook.md`: the `dev` ruleset (block force pushes and deletion, no bypass, no PR requirement; the user's manual step) and Codex auto-review on PRs into `dev`.
  - AGENTS.md: the _Branches and roles_ line, plus a _Review guidelines_ section of about 300 bytes for Codex (review code only, skip `plans/` and docs prose; focus on correctness, RBAC in SQL, sync and offline, the compliance rules, fictional test data). The core is at 7.8 of 8 KB, so trim at least as much as you add.
  - `docs/agents/orchestrator.md` is at 14.0 of 15 KB: trim as you fold.

---

## Slice 1: Codex verdict

Stack: no · Reads: docs/agents/loop.md, docs/agents/orchestrator.md, ops/runbook.md · Tests: unit

**User stories:** 10, 11, 12, 13, 14, 15, 16, 21 (the verdict half)

### What to build

The pure codex-review module and `pnpm prd review <branch>`. It finds the open PR for the branch (a helper slices 2 and 3 reuse), fetches its state through `gh` (GraphQL for review threads with their resolved and outdated flags, plus reviews, issue comments and reactions), and prints the verdict and findings (file, line, priority, short body, thread URL).

- `--json` prints the verdict as JSON.
- `--wait [min]` polls every 60 s (default 20 min) until the state isn't `waiting`, or exits 75.
- `--again` comments `@codex review`.
- `--resolve <threadId>` resolves a thread.

**Capturing real fixtures (approved by the user):**

1. Push a throwaway branch from `dev` with a small, obvious bug in a scratch file, and open a PR into `dev` titled `chore(github-review): throwaway PR for Codex fixtures (do not merge)`.
2. Wait for Codex's auto-review, then save the PR's JSON (`findings`).
3. Push a fix (save the JSON again: `stale`), comment `@codex review` and save the clean result.
4. Reply to one finding and resolve it.
5. Close the PR unmerged and delete its remote branch.

Strip anything not needed from the fixtures, and confirm how Codex signals "no issues" (a reaction or a summary comment). Encode what the capture shows. The throwaway branch never merges anywhere.

### Acceptance criteria

- [ ] A `codex-review` unit test (Vitest `scripts:unit`) over the captured fixtures covers:
  - `waiting` when there's no Codex activity;
  - `findings` with path, line, priority and thread id;
  - `clean` on the head;
  - `stale` when the review is on an older SHA;
  - a resolved, replied-to finding that no longer blocks;
  - a human's comment ignored.
- [ ] `pnpm prd review <branch>` prints the verdict for a live PR, with exit codes 0, 1 and 2 as specified. `--json`, `--wait` (and its 75 on timeout, shown with a short `--wait 1` on a PR with no review), `--again` and `--resolve` all work against the throwaway PR before it's closed.
- [ ] The throwaway PR is closed unmerged and its branch deleted, both on GitHub and locally. The hand-off gives its number.
- [ ] `prd.sh` usage lists `review`.
- [ ] The tooling tests pass, prettier is clean, and shellcheck is clean on changed scripts.

**Blocked by:** none. **Blocks:** 2, 3.

---

## Slice 2: PR and merge path

Stack: no · Reads: docs/agents/loop.md, docs/agents/orchestrator.md, docs/agents/hotfix.md, docs/agents/backlog.md · Tests: unit

**User stories:** 3, 4, 5, 6, 7, 8, 9, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 37

### What to build

**`pnpm prd pr <branch> [-m]`** works for `prd/` and `hotfix/` branches and refuses `plan/` ones.

- It refuses a branch that isn't synced (`trunk_drift`).
- It pushes `dev` to `origin/dev`, fast-forward only, and stops with a clear message if `origin/dev` has diverged.
- It pushes the branch, then opens the PR into `dev` or updates the open one's body.
- The title is the landing subject; the body lists the topic's ready backlog items, the check pass (`checked_how`), and a note that plans and the backlog are written outside review.
- It prints the URL.

**`land`'s PR path:** `prd/` always, `hotfix/` with `--pr`; a hotfix with neither `--pr` nor `--local` is refused with a message telling the agent to ask the user.

- Every existing refusal stays.
- It refuses unless the PR is open, its head equals the local tip, and `review`'s verdict is `clean`. `--no-review` skips only the verdict, and only on the user's word.
- Then it does the GitHub merge (pinned to the head commit, the `-m` subject, branch deleted) and dev-sync, and prints the same next-step lines as now, minus "publish it with git push".
- `plan/` and `hotfix/ --local` merge locally as today.

**dev-sync**, as in _Architectural decisions_. Backlog-tool commits are identified by their `Backlog-Tool:` trailer plus touching only `plans/backlog.md` and `plans/backlog-archive.md`.

### Acceptance criteria

- [ ] Checked by hand on a throwaway PR into `dev` (closed unmerged at the end), with each step in the hand-off:
  - `pr` opens it, then a second run updates it;
  - `pr` refuses an unsynced branch;
  - `land --pr` refuses a stale head (a local commit not pushed);
  - `land --pr` refuses a non-clean verdict;
  - a `hotfix/` land without `--pr` or `--local` is refused.
- [ ] dev-sync is exercised by hand in a throwaway clone with a bare `origin`, for the three outcomes (fast-forward, backlog-only rebase, merge) and the dirty or mid-merge refusal. (The user chose no automated tests here.)
- [ ] The merge itself isn't run in this slice. It's first used when this PRD's wave 2 lands.
- [ ] The local paths (`plan/`, `hotfix/ --local`) behave as before: the existing tooling tests pass (`check-gate.test.mjs` included).
- [ ] `prd.sh` usage lists `pr` and the new `land` flags, and `land.sh`'s header documents them. Prettier and shellcheck are clean.

**Blocked by:** 1. **Blocks:** none.

---

## Slice 3: Ready report and prompts

Stack: no · Reads: docs/agents/loop.md, docs/agents/orchestrator.md, docs/agents/hotfix.md · Tests: unit

**User stories:** 31, 35, 36, 25 (cleanup)

### What to build

- **`pnpm prd ready`:** with an open PR it shows the PR's URL and the one-line verdict (from slice 1's module); without one, `no PR yet: pnpm prd pr <topic>`.
- **The orchestrator prompt** (`prompt.sh orchestrator`, both normal and `--auto`/`--resume`) gets one or two lines: open the PR as soon as a wave is green, run `review --wait` in the background, triage the findings to fix agents or decline them with a reply and resolve, ask again until clean (about three rounds, then ask the user), and land on the user's word through the PR.
- **The hotfix prompt:** ask the user "PR or local?" before landing.
- **`rm`:** when the removed branch's PR merged and its remote branch still exists, delete it on `origin`.

### Acceptance criteria

- [ ] `prompt.test.mjs` asserts the new orchestrator and hotfix lines.
- [ ] `ready` shows the PR line and the verdict for a live PR (the slice opens and closes a throwaway PR, or reuses slice 2's while it's open), and the "no PR yet" line for a topic without one.
- [ ] `rm` deletes a merged leftover remote branch and leaves an unmerged one alone (checked by hand; the hand-off says how).
- [ ] The tooling tests pass, prettier is clean, and shellcheck is clean on changed scripts.

**Blocked by:** 1. **Blocks:** none.
