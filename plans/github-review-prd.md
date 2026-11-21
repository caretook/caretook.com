# PRD: GitHub review (Codex reviews before code lands in `dev`)

> Topic `github-review`. Backlog: B-203. Plan: [`plans/github-review-plan.md`](github-review-plan.md).

## Problem Statement

Code reaches `dev` by a local `git merge --no-ff` in the main checkout (`pnpm prd land`). Nobody but the orchestrator ever reads a wave's diff before it lands, and `dev` is pushed to GitHub by hand, often far behind. Now that the repo is on GitHub (public, staging live), the dev keeper wants a second reviewer: Codex's automatic GitHub reviews. That means code branches go up to GitHub as PRs into `dev`, Codex reviews them, its comments are addressed, and only then does the branch merge. Plans, PRDs and the backlog stay as they are (tracked in the repo, written directly), and the dev keeper still wants to land a quick hotfix locally when speed matters.

## Solution

- **PRD waves always land through a GitHub PR into `dev`.** The orchestrator opens the PR as soon as a wave is green (`pnpm prd pr <topic>`), so Codex reviews it while the user tries the wave. It reads Codex's verdict (`pnpm prd review <topic>`), sends real findings to a fix agent on `prd/<topic>`, replies on the thread to the ones it declines with the reason, then pushes and asks Codex again (`--again`). It repeats until the review is clean, asking the user after about three rounds.
- **Merging still waits for the user's word** (or the landing mode or a queue). `pnpm prd land <topic>` refuses unless the PR's head is the local tip, the check gate passed and Codex's verdict is clean. It merges on GitHub with a merge commit and the Conventional subject, deletes the remote branch, and brings the main checkout's `dev` up to date (dev-sync).
- **Hotfixes choose each time.** The hotfix agent asks the user "PR or local?" before landing. `land` needs `--pr` or `--local` for a `hotfix/` branch.
- **Plan branches, backlog commits and small direct changes stay local.** They are committed onto `dev` as now, and the tooling pushes them to `origin/dev` before each PR, so the PR's base is current.
- **No review within about 20 minutes:** `review --wait` gives up and the orchestrator asks the user whether to merge without a review (`--no-review`, on their word only) or keep waiting.
- **Codex is told what to look at:** a short _Review guidelines_ section in AGENTS.md (code only: skip `plans/` and docs prose; focus on correctness, RBAC in SQL, sync and offline, the compliance rules, fictional test data).
- **`dev` gets a GitHub ruleset** that blocks force pushes and deletion, with no PR requirement (backlog commits are still pushed directly). This is the user's manual step, written into the runbook.

## User Stories

1. As the dev keeper, I want every PRD wave reviewed by Codex on GitHub before it lands in `dev`, so that a second reviewer reads each diff.
2. As the dev keeper, I want plans, PRDs and the backlog kept out of the review flow, so that GitHub review is only about code.
3. As the dev keeper, I want backlog commits to keep going straight onto `dev`, so that the live backlog stays live.
4. As the dev keeper, I want to choose per hotfix whether it goes through a PR, so that I can work quickly when I want to.
5. As a hotfix agent, I want `land` to refuse a hotfix without `--pr` or `--local`, so that I never pick for the user silently.
6. As an orchestrator, I want to open the PR as soon as a wave is green, so that Codex reviews it while the user tests the wave.
7. As an orchestrator, I want `pnpm prd pr <topic>` to open the PR or update it if it exists, so that I can rerun it after every push.
8. As an orchestrator, I want the PR to say which backlog items it addresses and which check passed, so that a reviewer has the context.
9. As an orchestrator, I want local `dev` pushed (fast-forward only) before the branch, so that the PR's base matches the branch's last sync and the diff shows only the wave.
10. As an orchestrator, I want one command that tells me Codex's verdict on the current head (waiting, clean, findings, or stale), so that I don't read raw GitHub JSON.
11. As an orchestrator, I want the findings listed with file, line, priority and thread link, so that I can triage them and brief a fix agent.
12. As an orchestrator, I want a review of an older head to count as stale, so that a fix pushed after the review is never treated as reviewed.
13. As an orchestrator, I want `review --again` to ask Codex for a fresh review, so that fixes get re-reviewed.
14. As an orchestrator, I want `review --wait` to block in the background until Codex answers or 20 minutes pass, so that I don't poll by hand or burn context.
15. As an orchestrator, I want a distinct exit status when the wait times out, so that I know to ask the user.
16. As an orchestrator, I want to decline a finding by replying on its thread with a reason, so that the record shows why it wasn't changed.
17. As the dev keeper, I want the orchestrator to stop after about three review rounds and ask me, so that a review loop never runs unattended forever.
18. As the dev keeper, I want merging to wait for my word as landing does today, so that review doesn't take away my go-ahead.
19. As an orchestrator, I want `land` to refuse when the PR's head isn't my local tip, so that what merges is what was checked.
20. As an orchestrator, I want `land` to refuse when Codex's verdict isn't clean, so that unreviewed or unaddressed code doesn't land by accident.
21. As the dev keeper, I want `--no-review` to merge without a clean verdict only on my word, so that a missing review never blocks me forever.
22. As an orchestrator, I want `land` to keep its refusals (the sync check, the check gate, the doc budget), so that the PR path is no weaker than the local one.
23. As the dev keeper, I want the GitHub merge to be a merge commit with the Conventional subject from `-m`, so that `dev`'s history looks as it does now.
24. As an orchestrator, I want the merge pinned to the head commit I checked, so that a late push can't slip in.
25. As the dev keeper, I want the remote branch deleted after the merge, so that GitHub doesn't fill up with stale branches.
26. As the dev keeper, I want my main checkout's `dev` brought up to date after a GitHub merge, so that I never have to pull by hand.
27. As the dev keeper, I want backlog commits made while the PR was open rebased onto the merge, so that `dev` stays linear and no backlog write is lost.
28. As the dev keeper, I want any other local-only commits merged rather than rebased, so that my own commits are never rewritten.
29. As the dev keeper, I want dev-sync to refuse when the main checkout isn't on `dev`, is mid-merge or is dirty in a way that blocks it, so that it never makes a mess of my checkout.
30. As an orchestrator, I want `land` to keep printing what the main checkout needs next (a reset, a PowerSync restart, `pnpm install`), so that nothing changes there.
31. As the dev keeper, I want `pnpm prd ready` to show the PR link and Codex's verdict, so that the ready report answers "has it been reviewed?".
32. As a backlog reader, I want an item to count as landed once the main checkout's `dev` has the merge, as now, so that statuses still come from git.
33. As Codex, I want review guidelines in AGENTS.md, so that I review the code and skip planning prose.
34. As the dev keeper, I want the runbook to describe the `dev` ruleset and the Codex setup, so that the GitHub side can be rebuilt.
35. As an orchestrator, I want my prompt and handbook to describe the PR flow, so that every new session follows it.
36. As a hotfix agent, I want my prompt and handbook to say to ask "PR or local?", so that I ask before landing.
37. As the dev keeper, I want release PRs (`dev`→`staging`, `staging`→`main`) unchanged, so that deploys work as they do now.
38. As the dev keeper, I want no workflow to run on `pull_request`, so that the public repo's Actions stay out of forks' reach.

## Implementation Decisions

- **Tooling only:** bash plus Node `.mjs` in `scripts/loops/`, `gh` for every GitHub call, and no new dependencies. Nothing in `apps/` or `packages/` changes. No GitHub Actions: the local check gate (`pnpm prd check`) stays the only check, and Codex review sits on top of it.
- **The codex-review module (deep, pure):** it takes the PR's state as JSON (head SHA, reviews, review threads with resolved and outdated flags, issue comments, reactions on the PR) and returns `{ state: "waiting" | "clean" | "findings" | "stale", findings: [{ path, line, priority, body, url, threadId }], reviewedSha }`.
  - It recognises Codex by its bot login, kept as one constant.
  - A review of an older head is stale.
  - Clean means Codex answered on the current head with no unresolved threads of its own: either a review without comments or its "no issues" signal (a 👍 reaction or its summary comment, whichever the captured fixtures show).
  - It looks only at Codex's threads: a human's comment never blocks.
  - A thread the orchestrator replied to (declined) counts as addressed once it's resolved. Replying alone doesn't clear it, so declining is reply, then resolve.
- **`pnpm prd review <branch>`:** finds the open PR for the branch and fetches its state through `gh api` (GraphQL for the threads), then prints the verdict and findings. Exits 0 when clean, 1 for findings, 2 for waiting or stale.
  - `--json` prints the verdict as JSON.
  - `--wait [min]` polls every 60 s (default 20 min). `gh event listen` is a preview feature, so it isn't relied on. It exits when the verdict isn't waiting, or with 75 on timeout (the lease convention).
  - `--again` comments `@codex review` on the PR.
  - `--resolve <threadId>` resolves a declined thread.
- **`pnpm prd pr <branch>`:** works for `prd/<topic>` or `hotfix/<name>`; plan branches are refused.
  - It refuses unless the branch is synced with `dev` (the same `trunk_drift` check as `land`).
  - It pushes the main checkout's `dev` to `origin/dev`, fast-forward only. If `origin/dev` has diverged, it stops and says so.
  - It pushes the branch, then opens the PR into `dev`, or updates the body of the one already open.
  - The title is the landing subject (`-m`, else the one `land` would build). The body lists the backlog items (ready for the topic), the check pass (`checked_how`) and a note that plans and the backlog are written outside review.
  - It prints the URL.
- **`land` gains a PR path.** Branch kinds: `prd/` always uses it; `hotfix/` must say `--pr` or `--local`; `plan/` always merges locally.
  - It runs the refusals `land` has now (synced, check gate unless `--force`, doc budget, main checkout on `dev` and not mid-merge), then:
  - the PR is open and its head equals the local tip;
  - the verdict is clean, unless `--no-review` (only on the user's word, like `--force`).
  - It merges with `gh pr merge --merge --subject "<msg>" --match-head-commit <tip> --delete-branch`, then runs dev-sync and prints the same next steps as now. The "publish it with git push" line goes, because the tooling pushes now.
- **dev-sync (a lib function):** it runs in the main checkout after a GitHub merge: fetch `origin`, then
  - fast-forward `dev` to `origin/dev` when local `dev` is behind;
  - when local `dev` has commits `origin/dev` lacks and every one is a backlog-tool commit (it has the `Backlog-Tool:` trailer and touches only the backlog files), rebase them onto `origin/dev`. These are unpushed, so no shared history is rewritten;
  - otherwise merge `origin/dev` with a Conventional subject (`chore(dev): merge origin/dev after <branch>`).
  - It refuses when the main checkout isn't on `dev`, is mid-merge or rebase, or has uncommitted changes to tracked files that the update would touch.
  - It takes the backlog lock while it moves `dev`, so no backlog write races it.
- **Pushing `dev` becomes the tooling's job** for these paths (`pr`, `land`). Backlog writes still don't push. The release PRs and their hooks don't change.
- **`pnpm prd ready`** adds the PR's URL and the one-line verdict when a PR is open, and says "no PR yet: `pnpm prd pr <topic>`" when there isn't one.
- **`rm`** works as now: after dev-sync, local `dev` contains the merge, so the merged-branch deletion holds. It also deletes a leftover remote branch, if any, for a removed worktree whose PR merged.
- **Prompts:** the orchestrator and hotfix prompts (`prompt.sh`) carry the new flow in a line or two each. The handbooks hold the detail.
- **Docs, folded by the orchestrator at landing (loops never edit `docs/` or AGENTS.md):**
  - orchestrator.md: _Landing a wave_ and _Branches and protection_ get the PR flow, review rounds, the cap of about three rounds, `--no-review`.
  - hotfix.md: "PR or local?".
  - orchestration.md: the human guide's landing and push lines.
  - ops/runbook.md: the `dev` ruleset (block force pushes and deletion, no bypass, no PR requirement) and that Codex auto-review is on for PRs into `dev`.
  - AGENTS.md: the _Branches and roles_ line, plus a _Review guidelines_ section of about 300 bytes. The core is at 7.8 of 8 KB, so trim at least that much elsewhere.
- **Bootstrapping:** this PRD's first wave lands with the local `land` it replaces (`--pr` doesn't exist on `dev` yet). From the wave that brings slice 2 on, the orchestrator lands through the new path, so this PRD's own landing is the first real use.

## Testing Decisions

- **Good tests check the verdict from the outside:** given a PR's JSON, which state and which findings come back. They don't test how the JSON is walked.
- **The codex-review module is the only module with tests** (the user's choice): Vitest `scripts:unit`, like the other `scripts/loops/*.test.mjs` (for example `slice-fields.test.mjs`, `recover-lib.test.mjs`).
  - The fixtures are captured from a real Codex review, not hand-written. Slice 1 opens a throwaway PR into `dev` with a deliberate bug, lets Codex auto-review it, saves the JSON, fixes it, asks again with `--again`, saves the clean JSON, then closes the PR unmerged and deletes its branch. The user approved this.
  - Cases: waiting (no Codex activity), findings (unresolved threads, with priority parsed), clean (Codex's no-issues signal on the head), stale (a review on an older SHA), a resolved declined thread, a human comment ignored.
- **No automated tests for `pr`, `land`'s PR path or dev-sync** (the user's choice). Instead, slice 2 is checked by hand against a throwaway PR (open, update, review, refuse on a stale head, and close unmerged), and this PRD's own landing is the merge path's first real run. shellcheck-clean, like the other scripts.
- No app code changes, so there are no component tests and no browser checks. The check gate is "none needed" (tooling and Markdown only), plus the tooling's own tests.

## Out of Scope

- GitHub Actions or any CI on PRs. A `pull_request` workflow is forbidden for the public repo, and the local check gate stays.
- Moving plans, PRDs or the backlog out of the repo.
- PRs for slice merges into `prd/<topic>`: review happens once per wave, at `dev`.
- PRs for plan branches, backlog commits or small direct changes on `dev`.
- A PR-required ruleset on `dev`, and approvals (one maintainer can't approve their own PR).
- Changing the release PRs (`dev`→`staging`, `staging`→`main`) or the deploy.
- Other review bots, or human reviewers beyond the dev keeper.

## Further Notes

- Codex auto-review is already on for the repo (the user). How it signals "no issues" (a reaction, or a summary comment) is confirmed by slice 1's captured fixtures, which the module encodes.
- `land` and `pr` push to a public repo. Nothing secret is committed today, and the runbook's rule stands.
- If Codex is down or slow, `--wait` times out (exit 75), and the orchestrator asks the user whether to merge with `--no-review` or keep waiting.
