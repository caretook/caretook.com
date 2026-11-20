# Plan: Agent tooling

> Source PRD: [`plans/agent-tooling-prd.md`](agent-tooling-prd.md). User-story numbers (US) refer to it. Backlog items B-147, B-148 and B-154 (B-152 and B-153 are already on `dev`). Topic `agent-tooling`.

## Status

| Slice | Wave | State                                          | Merge into `prd/agent-tooling` (slice commits)        |
| ----- | ---- | ---------------------------------------------- | ----------------------------------------------------- |
| 1     | 1    | landed (wave 1, cff4d2f) (opus)                | 8d10f6b (9faf638)                                     |
| 2     | 1    | landed (wave 1, cff4d2f) (sonnet)              | a23e77c (52a8503)                                     |
| 3     | 1    | landed (wave 1, cff4d2f) (sonnet)              | 5ba5669 (bc6bd87)                                     |
| 4     | 2    | landed (wave 2; opus)                          | 84809ac (931f2dd, d1a324c)                            |
| 5     | 3    | merged (sonnet)                                | df24172 (47950e2, ed9359a, b9c24f2, 727e640, 1225d8c) |
| 6     | 3    | started (worktree made, agent spawned; sonnet) |                                                       |

**Landing mode:** run everything through (queued with `pnpm prd queue agent-tooling`): start every ready slice, land each green wave, clean up, ask only real questions. Resume with `--auto`.

**2026-11-20:** all three wave 1 agents stopped at a usage limit with work uncommitted in their worktrees; resumed by message after the reset (not respawned).

**Slice 2 note:** its `pnpm check` had 1–3 failures in medicationList/passSheet component tests at load ~40; medicationList passed 6/6 on the base alone, and the slice touches no app code: load flakes.

**Wave 1:** landed in `dev` as cff4d2f (2026-11-20), full check on 5e08bbc (4167 tests); its decisions folded into AGENTS.md (commands table, backlog multi-id line) and docs/loops.md (the land guard). Told code-layout and check-migration to sync.

**Wave 2:** landed in `dev` as 81529fa (2026-11-20; docs and tooling only, no check needed), with the backlog timeout fix. Layout: AGENTS.md core (7678 B); docs/agents/ loop, orchestrator, backlog, planner, hotfix, recovery; docs/loops.md stub; `landExempt` removed. check-migration and timeline-ux told to sync.

**Now: wave 3 running** (2026-11-20; B-148 claimed). Both orchestrators said trim now: check-migration only renames check names in these docs; timeline-ux folds into sync, timeline, app-shell and medications at later landings and will fold onto the trimmed docs. Its wave 1 (sync.md, timeline.md) lands soon: sync it in before landing and send its additions to the slice agents to trim. Target about 9 KB per doc for headroom. Message both orchestrators when the trims land.

**Backlog hang (code-layout's report):** `pnpm backlog commit` hung once on hash-object at 1d650af; not reproducible on a fresh clone. Guard added: backlog git calls time out after 2 minutes (2c3ee0f, lands with wave 2).

**Land guard (user's choice, 2026-11-20):** AGENTS.md and docs/loops.md were `landExempt` until slice 4, which removed the flags.

**Claimed:** B-154, B-147 (2026-11-20). B-148 is claimed at wave 3.

**Backlog:**

- B-154 is slices 1 and 2.
- B-147 is slices 3 and 4.
- B-148 is slices 5 and 6.

**Gates:**

- Slice 4 starts only when no other PRD's landing is imminent.
- Slice 6 starts only after `tasks` has landed.

## Architectural decisions

Durable decisions every slice follows:

- **Tooling is bash plus Node `.mjs`** in `scripts/backlog/` and `scripts/loops/`, with the logic worth testing in pure `.mjs` modules. No new dependencies.
- **Tests are `scripts:unit`** against throwaway repos, in the style of `scripts/backlog/backlog.test.mjs`. No app code changes, so there are no component tests and no browser checks.
  - `check-areas` maps `docs/`, `plans/`, `scripts/loops/` and `scripts/backlog/` to none.
  - A one-line script entry in the root `package.json` doesn't call for browser checks either; skip them and say so in the hand-off.
- **Backlog commits carry a trailer** (`Backlog-Tool: <command>`). It is the only way the writer recognises its own commits, and nothing else adds it.
- **Amend only when provably safe** (PRD, _Backlog commits_). These are the rules:
  - HEAD has the trailer;
  - HEAD is less than 10 minutes old;
  - no other local branch and no remote-tracking ref contains HEAD;
  - dev's HEAD hasn't moved during the write.
  - Anything else makes a new commit. The ref update always compares against the HEAD it read.
- **Doc budgets live in one config:** the core is 8 KB, each `docs/agents/*.md` 15 KB, and each `docs/domain/*.md` (and `docs/layout.md`) 10 KB. The docs/loops.md stub and docs/orchestration.md have their own entries.
  - `pnpm check` warns.
  - `pnpm prd land` fails only for a doc that is over budget and bigger than on the trunk.
- **The doc layout:**
  - AGENTS.md is the core.
  - `docs/agents/` holds `loop.md`, `orchestrator.md`, `backlog.md` and `planner.md`.
  - docs/loops.md is a pointer stub, because existing plans name it in `Reads`.
  - docs/orchestration.md stays the human guide.
  - Each rule lives in exactly one place.
- **Area docs hold contracts and pointers:** rules, invariants, naming and where things live. They drop prop lists, sizes, test-by-test coverage, backlog ids and slice history.

## How to run this plan

- **Wave 1: slices 1, 2 and 3 at once.** All are stackless.
  - Slice 1 owns `scripts/backlog/`.
  - Slice 2 owns the `pnpm log` script and the `git log` lines in `scripts/loops/prompt.sh`.
  - Slice 3 owns the budget module and the hooks into `pnpm check` and `land.sh`.
  - Slices 2 and 3 each add one line to the root `package.json`: expect an adjacent-hunk merge.
- **Wave 2: slice 4, gated.** Before starting it, check `pnpm prd status` and the running plans' _Status_ (`tasks`, `check-migration`, `hosting`, and any others). Start only if no landing is imminent. Run `pnpm prd sync` right before landing it, and if a PRD landed meanwhile, have the slice (or its follow-up) move that landing's additions into the new layout before you land.
- **Wave 3: slices 5 and 6, gated.** Before starting each one, check that no running PRD is about to fold into its docs:
  - Slice 5 covers components, sync, care-groups and medications.
  - Slice 6 covers timeline and app-shell, and waits for `tasks` to land.
  - Message the other orchestrators (ListAgents, SendMessage) when a trim lands, so they `pnpm prd sync` before their next fold.
- Merge in number order within a wave, with no checks between merges.
- **Checks:** every slice runs `pnpm check`. `pnpm prd browser --changed` names nothing for these files, so no browser checks run at the slice or at landing.
- **The tools change under running orchestrators.** At each landing of slices 1–4, message the running orchestrators to `pnpm prd sync` before they next use the changed commands. Old commands and paths keep working (docs/loops.md stays as a stub).
- Every slice ends with a hand-off (AGENTS.md, _Loop rules_). Slices 1–3 also include a _Docs_ section with the lines for the orchestrator to fold in at landing.

---

## Slice 1: Batched backlog commits

Stack: no · Reads: none · Tests: unit

**User stories:** 17, 18, 19, 20, 21, 22.

**What to build:**

- **Multi-id `set`, `note` and `claim`.** Several `B-<n>` ids before the arguments, as `done` already takes.
  - Each command is one locked write and one commit.
  - The subject names the ids, shortened past three ("B-1, B-2, B-3 +2: note").
  - `claim` is all-or-nothing: if any id is owned by another branch (without `--force`), nothing changes and the error names it.
- **The trailer:** every backlog commit gets `Backlog-Tool: <command>`.
- **A pure `shouldAmend(facts)`** with these facts: HEAD's trailer, HEAD's commit time and the current time, whether any other local branch or remote-tracking ref contains HEAD, and whether HEAD moved since the read. It returns amend or new.
- **The amend path in the commit step.**
  - The new commit's parent is HEAD's parent.
  - The subject lists all the ids the two writes covered.
  - The body keeps both writes' lines.
  - The ref update still compares against the HEAD it read.
- **The header comment** at the top of `backlog.mjs` lists the multi-id forms and the amend rule.

**Acceptance criteria:**

- [ ] Unit tests for `shouldAmend` (a new `amend.test.mjs` or in `format.test.mjs`) cover each guard on its own:
  - no trailer → new;
  - HEAD older than 10 minutes → new;
  - HEAD contained by another local branch → new;
  - HEAD contained by a remote-tracking ref → new;
  - HEAD moved → new;
  - all guards hold → amend.
- [ ] `backlog.test.mjs` covers multi-id writes:
  - `set B-1 B-2 prd=x status=triaged` and `note B-1 B-2 …` each make one commit that changes both items;
  - a multi-id `claim` that conflicts on one id changes nothing and names that id.
- [ ] `backlog.test.mjs` covers amending: two quick writes leave one commit on dev with both ids in its subject.
- [ ] `backlog.test.mjs` covers each case that must make a new commit:
  - a write after the prd/ worktree's branch merged `dev`;
  - a write after a hand commit on dev;
  - a write with HEAD's date set 11 minutes back (`GIT_COMMITTER_DATE`).
- [ ] The existing backlog tests still pass. `pnpm check` passes.

**Blocked by:** none. **Blocks:** none (slice 4's backlog doc describes the result, but can be written from this plan).

---

## Slice 2: `pnpm log`, and the prompts use it

Stack: no · Reads: none · Tests: unit

**User stories:** 23, 24.

**What to build:**

- **`pnpm log [git log args…]`:** `git log` with commits whose subject starts `chore(backlog)` filtered out (`--invert-grep --grep`), passing every other argument through. It is a small script under `scripts/loops/` plus a root `package.json` entry.
- **The prompts filter backlog commits too.** Every `git log` command that `prompt.sh` puts in a prompt (orchestrator reconcile, review, recovery) uses `pnpm log` or the same filter.

**Acceptance criteria:**

- [ ] `pnpm log --oneline -5` in this repo shows no `chore(backlog)` commits, and `pnpm log --merges dev..HEAD` works (shown in the hand-off).
- [ ] Every `git log` in `prompt.sh` filters backlog commits (`grep -n 'git log' scripts/loops/prompt.sh` in the hand-off).
- [ ] `prompt.test.mjs` and the rest of `scripts:unit` pass. `pnpm check` passes.
- [ ] The hand-off's _Docs_ section gives the one core line ("read history with `pnpm log`") for slice 4.

**Blocked by:** none. **Blocks:** 4.

---

## Slice 3: Doc budget guard

Stack: no · Reads: none · Tests: unit

**User stories:** 13, 14, 15, 16, 25.

**What to build:**

- **A budget config** (one file in `scripts/loops/`) with these entries:
  - AGENTS.md: 8 KB;
  - `docs/agents/*.md`: 15 KB each;
  - `docs/domain/*.md` and `docs/layout.md`: 10 KB each;
  - docs/loops.md (the stub-to-be): 2 KB;
  - docs/orchestration.md: its current size rounded up.
  - A file matching a folder pattern takes that folder's budget.
- **A pure module** that measures the files and compares each with its budget and with its size at a base ref. The result is within, over, or over and grown.
- **A CLI with two modes:**
  - **warn** (default) lists the docs over budget with their sizes and exits 0;
  - **land `<base>`** exits 1 if any doc is over budget and bigger than at `<base>`, naming it.
- **The hooks:**
  - `pnpm check` runs warn mode, as a step that never fails the check.
  - `land.sh` runs land mode against the trunk before merging, and `--force` doesn't skip it. A planning branch lands only docs, so it is checked too.

**Acceptance criteria:**

- [ ] Unit tests (`doc-budget.test.mjs`) against a throwaway repo cover:
  - a doc within budget;
  - a doc over budget and unchanged, which passes land mode;
  - a doc over budget that grew, which fails land mode and is named;
  - a doc over budget that shrank, which passes;
  - a new file in `docs/agents/`, which gets 15 KB;
  - warn mode exiting 0 with docs over budget.
- [ ] `pnpm check` on this branch prints today's over-budget docs (AGENTS.md, docs/loops.md and the six area docs) and still passes (output in the hand-off).
- [ ] `land.sh`'s test (or a throwaway-repo run in the hand-off) shows a landing refused when it grows an over-budget doc.
- [ ] `pnpm check` passes.

**Blocked by:** none. **Blocks:** 4.

---

## Slice 4: Split AGENTS.md and docs/loops.md by reader

Stack: no · Reads: docs/loops.md, docs/orchestration.md · Tests: unit

**User stories:** 1–10, 26.

**What to build:**

- **AGENTS.md becomes the core (≤ 8 KB):**
  - the working rules;
  - a short branch-roles summary;
  - the stack and architecture as rules and pointers;
  - compliance and open questions;
  - the commands table (with `pnpm log`);
  - the area index, with rows for the four role docs;
  - the landing rule: lasting decisions go into the area doc, process into the role doc, and only rules every session needs into the core.
- **`docs/agents/loop.md` (≤ 15 KB):**
  - the loop rules and slice fields;
  - isolation and the stack from a loop's side;
  - browser checks and the budget from a loop's side;
  - the hand-off format;
  - the loop and dev gotchas.
- **`docs/agents/orchestrator.md` (≤ 15 KB):**
  - starting and steering a PRD, and capacity;
  - running and landing a wave, and landing modes;
  - folding decisions into docs;
  - recovery and _Status_;
  - the rules across PRDs (migrations, seeds, registries, hot files).
  - The loop doc points here for those rules.
- **`docs/agents/backlog.md` (≤ 15 KB):** the inbox and tracker, ingest, triage, statuses, the commands (including slice 1's multi-id forms and amend rule) and who writes.
- **`docs/agents/planner.md` (≤ 15 KB):** the PRD and plan workflow, the plan's shape, slice fields, the test budget for acceptance criteria, and landing a plan branch.
- **docs/loops.md** becomes a stub (≤ 2 KB) that points to `loop.md` and `orchestrator.md`, so the `Reads: docs/loops.md` in existing plans still works.
- **`prompt.sh`:** each prompt names its role doc, and the inline text those docs now hold gets shorter.
  - The main session reads the backlog doc.
  - The planner reads the planner and backlog docs.
  - The orchestrator reads the orchestrator doc.
  - Slice and review prompts read the loop doc.
  - Recovery reads the orchestrator doc.
- **docs/orchestration.md:** its links point to the new docs. It isn't rewritten.
- **Every current rule lands in exactly one place.** The hand-off lists any rule dropped as stale, with the reason.
- **Remove the land exemptions** (`landExempt` on AGENTS.md and docs/loops.md in `scripts/loops/doc-budget.config.mjs`, added at wave 1's landing on the user's word so other PRDs' folds weren't blocked meanwhile).
- **Before landing:** `pnpm prd sync`. Any additions a landing made meanwhile to the old AGENTS.md or docs/loops.md are moved into the new layout and listed in the hand-off.

**Acceptance criteria:**

- [ ] The doc budget (slice 3) reports AGENTS.md ≤ 8 KB, each `docs/agents/*.md` ≤ 15 KB and docs/loops.md ≤ 2 KB (output in the hand-off).
- [ ] The hand-off has a rule map: each `##`/`###` section of the old AGENTS.md and docs/loops.md → where it now lives (or "dropped: <why>").
- [ ] Every doc path that `prompt.sh` names exists (shown with `grep -o 'docs/[a-z/-]*\.md' scripts/loops/prompt.sh | sort -u | xargs ls`). `prompt.test.mjs` passes, updated where it asserted old text.
- [ ] Every relative link in AGENTS.md, `docs/agents/*.md`, docs/loops.md and docs/orchestration.md resolves (a link check in the hand-off).
- [ ] `pnpm check` passes.

**Blocked by:** 2, 3. **Blocks:** 5, 6.

---

## Slice 5: Trim components, sync, care-groups and medications

Stack: no · Reads: docs/domain/components.md, docs/domain/sync.md, docs/domain/care-groups.md, docs/domain/medications.md · Tests: none

**User stories:** 11, 12.

**What to build:**

- Each of the four docs is trimmed to contracts and pointers, under 10 KB.
  - It keeps rules, decisions, invariants, naming and where code lives.
  - It drops prop lists, sizes, which test covers which case, step-by-step mechanics the code shows, backlog ids and slice history.
- No meaning changes: a rule that is still true stays, in fewer words.
- The orchestrator starts it only when no running PRD is about to fold into these docs. It syncs `dev` right before landing.

**Acceptance criteria:**

- [ ] The doc budget reports each of the four ≤ 10 KB (before and after sizes in the hand-off).
- [ ] `grep -nE 'B-[0-9]+|[Ss]lice [0-9]' ` on the four docs finds nothing.
- [ ] The hand-off lists, per doc, what kinds of detail were dropped, and any rule removed as no longer true, with the code that shows it.
- [ ] Every relative link in the four docs resolves. `pnpm check` passes.

**Blocked by:** 4. **Blocks:** none.

---

## Slice 6: Trim timeline and app-shell

Stack: no · Reads: docs/domain/timeline.md, docs/domain/app-shell.md · Tests: none

**User stories:** 11, 12.

**What to build:**

- The same trim as slice 5 for timeline.md and app-shell.md, after `tasks` has landed and folded into them.
- The orchestrator checks `pnpm backlog show B-55` (landed) and that no other running PRD is about to fold into either doc. It syncs `dev` right before landing.

**Acceptance criteria:**

- [ ] The doc budget reports both ≤ 10 KB (before and after sizes in the hand-off).
- [ ] `grep -nE 'B-[0-9]+|[Ss]lice [0-9]'` on both docs finds nothing.
- [ ] The hand-off lists what kinds of detail were dropped, and any rule removed as no longer true.
- [ ] Every relative link in both docs resolves. `pnpm check` passes.

**Blocked by:** 4, and `tasks` landed in `dev`. **Blocks:** none.
