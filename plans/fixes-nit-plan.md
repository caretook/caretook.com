# Plan: Fixes (nit)

Small nits: small tidies that users won't notice. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-nit`.

## Status

Landing mode: **run everything through** (the user, 2026-11-21: "Run everything through", "Every ready slice", "run in auto mode"). Land each green wave, clean up, ask only real questions (through `pnpm prd ask`). B-379: **track only** (the user: file backlog items for each contract step, no migration now).

Wave 1: slices 1–3 (written 2026-11-21).

| Slice | Item  | Model  | State   | Merge |
| ----- | ----- | ------ | ------- | ----- |
| 1     | B-326 | sonnet | planned |       |
| 2     | B-379 | sonnet | planned |       |
| 3     | B-380 | sonnet | planned |       |

## Wave 1 (written 2026-11-21 by the orchestrator, from the triaged fixes-nit items)

## Slice 1: The docs say what the repo has (B-326)

Stack: no · Reads: plans/fixes-rules.md, docs/layout.md · Tests: none (Markdown and comments)

**Problem.** A code review (2026-11-21, not re-verified) found docs drift: `docs/layout.md` omits folders (`scripts/build`, `scripts/deploy`, `ops/`, `routes/connectors`, `packages/api/src/connectors`, `lib/calendars`, `lib/connectors`, and the planner, medication, profile and search route folders) and calls the Playwright specs "headless Chrome checks"; five area docs in `docs/domain/` name old `*.mjs` check files; AGENTS.md marks Playwright and print CSS as 🟡 proposed; `sync-config.yaml` cites a `pnpm powersync:restart` that doesn't exist; `.env.example` lacks `BETTER_AUTH_SECRETS`; AGENTS.md's _Data_ line omits the `/series` client-safe export.

**Build.** This slice is the exception to "loops never edit AGENTS.md or `docs/`": the fix is the docs.

- Verify each claim against the repo first; fix only what is really wrong, and say in the hand-off which claims were stale.
- `docs/layout.md`: add the missing folders where they belong (one short line each), and name the Playwright specs for what they are. Stay inside the 10 KB budget (`pnpm docs:budget`): trim wording if needed.
- The area docs: replace the old check file names with the current ones (find what each check is now; don't guess).
- AGENTS.md: correct the ✅/🟡 marks for Playwright and print CSS only if they are built, and add `/series` to the client-safe exports if it is one. AGENTS.md must not grow past its 8 KB budget: trim at least what you add.
- `sync-config.yaml`: point the comment at the real command (or drop the reference). `.env.example`: add `BETTER_AUTH_SECRETS` with a placeholder and a one-line comment matching how the code reads it.

**Acceptance criteria.**

- [ ] Each claim in B-326 is fixed or noted as stale in the hand-off.
- [ ] `pnpm docs:budget` shows no doc over budget that grew; `pnpm exec prettier --check` on the changed files passes.
- [ ] `pnpm prd check --quick "slice hand-off"` passes (`sync-config.yaml` makes it full: let it).

**Blocks:** none. **Blocked by:** none.

## Slice 2: Track the later contract migrations (B-379)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/data-layer.md, docs/agents/backlog.md · Tests: none (backlog only)

**Problem.** Migrations stay additive (expand, then contract later), but nobody tracks the contract steps: the old columns the simple-mode and planner-2 PRDs leave behind, and medications-2's default-passes backfill.

**Build.** **Track only; no migration** (the user's choice).

- Find each contract step: read those PRDs' plans and migrations (`plans/`, `packages/data/…/migrations`, `pnpm log --grep`) for the columns still in the schema but no longer read or written, and for the backfill. List them with evidence (file and line, or the migration).
- File one backlog item per contract step with `pnpm backlog add chore "<plain title>" --prd <topic> --status triaged --note "<the columns, where they're still referenced, what must ship first>"`. Pick the topic the backlog doc gives for later migrations (ask the orchestrator if none fits); never a `fixes-*` topic for a migration.
- Add a `note` on B-379 listing the new ids. Change no code.

**Acceptance criteria.**

- [ ] One triaged item per contract step, each naming its columns or backfill and its precondition.
- [ ] B-379 notes the new ids; the slice branch has no code changes.

**Blocks:** none. **Blocked by:** none.

## Slice 3: Backlog hygiene (B-380)

Stack: no · Reads: plans/fixes-rules.md, docs/agents/backlog.md · Tests: none (backlog only)

**Problem.** A code review found: B-205 and B-206 are the same test failure; B-208 is tagged simple-mode but landed as a hotfix; B-88 is landed with no commit; B-222's title and inbox line disagree; about 150 items read "live" from one release merge though production hasn't started; B-247 (Planner Upcoming | Past toggle) is triaged and unowned yet gates list-filters slice 4 and planner-2 slice 3 (both PRDs are done now).

**Build.** Only through `pnpm backlog` commands (they commit to `dev` themselves); never edit the backlog files by hand.

- Verify each claim first (`pnpm backlog show`, `pnpm log --grep`).
- Merge or close the duplicate (B-205/B-206) the way the backlog doc says; fix B-208's topic; give B-88 its commit if one can be found (else a note); make B-222's title match what was built.
- The "live" statuses: find how the tool sets `live` and what the right status is while production hasn't launched (likely `staging`). If the tool has a bulk command, use it; if fixing needs a tool change, don't make one: file a `fixes-tooling` item and say so in the hand-off.
- B-247: note its real state now that list-filters and planner-2 are done.

**Acceptance criteria.**

- [ ] Each claim is fixed, or noted as stale or out of reach in the hand-off.
- [ ] No hand edits to backlog files; `pnpm backlog doctor` reports nothing new.

**Blocks:** none. **Blocked by:** none.
