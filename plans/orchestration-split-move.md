# Runbook: Orchestration split, the move (stage 2)

> B-543. Run by hand in one session after `orchestration-split`, `orchestration-split-2` and `orchestration-split-3` have landed, on the user's word. Not slices: the tool can't land its own removal. Decisions: [the PRD](orchestration-split-prd.md).

## Before

- All three stage-1 topics are in `dev`; the boundary lint passes with only the named residual list.
- **Write the removal commit first and rehearse it:** on a throwaway branch of `dev`, the commit of step 5 (delete the manifest's core files, and exactly the residual list's lines). Push it and run GitHub CI (all jobs); it must be green; then delete the branch and keep the commit to reuse.
- `pnpm prd dispatch --pause`; every PRD, slice, plan and hotfix worktree landed or removed (`pnpm prd status` shows none); no managed sessions; no open asks that need the tooling. Save `pnpm prd status` and `pnpm prd dispatch --dry-run` output to compare.
- **Unload the launchd watchdog** (label `com.caretook.prd-watchdog`, runs `<main>/scripts/loops/prd.sh watchdog`): `pnpm prd autostart remove`.
- The user says go. Each step that touches Caretook's `dev` is shown to the user first.

## Steps

1. **Install the history tool:** `brew install git-filter-repo`, with the user's OK at this step.
2. **Make Risa with its history.** From a fresh clone of Caretook, `git filter-repo` keeping the manifest's core files **and their earlier names** (from `git log --follow --name-only` per file), into `~/git/risa` (local, no remote). Then one commit there for Risa's layout: `loops/`, `backlog/`, `ci/` (the core's CI parts) side by side, so relative imports such as `../ci/` and `../backlog/` still resolve; `test/sample-project/`; its own `package.json` (no runtime dependencies; vitest at Caretook's pinned version); a `risa` bin; a short README. Its tests pass there on the sample project.
3. **Make Risa a configured repo of its own** (PRD _Decisions_): its own `risa.json`, an empty backlog and inbox, and `plans/`; then move the tooling items and rows (`fixes-tooling`'s items, `self-recovery-2`, `staging-ship`, and any other topic whose hot files are all core) with their plans from Caretook's backlog to Risa's, each with a note. Show the list to the user first.
4. **Install a pinned release and put it on PATH:** tag Risa (`v0.1.0`), check the tag out to `~/.risa/releases/v0.1.0`, and symlink `~/.local/bin/risa` to its bin (the PATH agent shells get; the watchdog's plist uses the absolute path). The machine config lists Caretook and Risa, command names `risa`. `risa status` and `risa dispatch --dry-run` against Caretook match the saved output.
5. **Remove the core from Caretook:** the rehearsed commit on `dev` (`chore(orchestration-split)!: move the orchestration core to Risa (B-543)` with a `BREAKING CHANGE:` footer), plus setting `risa.json`'s command names to `risa` and changing AGENTS.md, `docs/agents/`, `docs/orchestration.md` and README to say `risa …`. `pnpm check` and `pnpm test:project` pass; push, and **GitHub CI on `dev` is green** before step 7.
6. **Permissions, the user's change:** `.claude/settings.json` allows `pnpm prd *` and `pnpm backlog *`; the user adds `risa *` (and drops the old ones when ready). Agents don't edit it.
7. **Try it.** `risa plan` makes and removes one plan worktree in each repo; `risa backlog list` reads each backlog; `risa autostart install` (label `com.risa.watchdog`, running the release's script); `risa dispatch --resume`.
8. **Close out.** B-543 done with a note; the three stage-1 rows flagged `done`; the memory notes that name `pnpm prd` updated.

## Undo

Before Caretook's history is cleaned (`risa-next`): `risa dispatch --pause` and `risa autostart remove` first (never two watchdogs); revert the removal commit on `dev`; move back any rows step 3 moved; `pnpm install`; the user restores the `pnpm prd *` and `pnpm backlog *` permissions if they dropped them; `pnpm prd autostart install`; `pnpm prd dispatch --resume`. Risa's repo can stay; nothing in Caretook depends on it.
