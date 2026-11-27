# Plan: Fixes (nit)

Small nits: small tidies that users won't notice. There is no PRD: this plan is the whole spec, and its orchestrator appends one slice per waiting item. Rules: [`plans/fixes-rules.md`](fixes-rules.md). Topic `fixes-nit`.

## Status

**History:** earlier hand-offs and landed waves' rows are in [`plans/fixes-nit-history.md`](fixes-nit-history.md) (`pnpm prd status-trim`).

Landing mode: **run everything through** (the user, 2026-11-21: "Run everything through", "Every ready slice", "run in auto mode"; the dispatcher's run-through start again 2026-11-26). Land each green wave, clean up, ask only real questions (through `pnpm prd ask`). B-379: **track only** (the user: file backlog items for each contract step, no migration now).

Wave 1 (slices 1–3) landed in dev (72298bc8). Wave 2 (slices 4–7) landed as a1d501f7 (PR #239). Wave 3 (slice 8, B-931) landed 2026-11-26 as 30315b3 through PR #240: CI `components` green on 87f36114 (run 45916082224), browser `--changed` 2/2, Codex out of credits (`--no-review`); report a292 filed; ui-kit _Tokens_ unchanged (the /80 → `text-muted`, /40 → `text-faint` picks live in the code). Slice worktree removed.

| Slice | Item  | State                            | Merge     |
| ----- | ----- | -------------------------------- | --------- |
| 9     | B-973 | merged, three cut lines restored | d5b824f11 |

Wave 4 (slice 9, B-973, docs only: no CI tier, `pnpm test:tooling`; sonnet, no logic) started 2026-11-27 after a dev sync. B-950 held for a later wave (todo-subtasks-3 holds `routes/app/groups/timeline/`).

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

## Wave 2 (written 2026-11-26 by the orchestrator, from the triaged fixes-nit items)

## Slice 4: The vitest worker-database comment names today's names (B-544)

Stack: no · Reads: plans/fixes-rules.md · Tests: none (a comment)

**Problem.** `vitest.config.ts` (about line 346) says each worker's database is `<name>_w<VITEST_POOL_ID>`; since B-405 they're `caretook_tw_<stem>_<hash>_w<n>`.

**Build.** Find where the name is really built (search for `caretook_tw_`) and make the comment say what it builds, in one line, naming that file. Change nothing else in `vitest.config.ts`.

**Acceptance criteria.**

- [ ] The comment matches the code that names the databases; no other line changes.
- [ ] `pnpm prd check --quick "slice hand-off"` passes (`vitest.config.ts` may make it full: let it).

**Blocks:** none. **Blocked by:** none.

## Slice 5: One helper builds the legal page links (B-630)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/auth.md, docs/layout.md · Tests: unit

**Problem.** `apps/web/app/lib/auth/legalLinks.ts` (`legalHref`, used by `routes/account/LegalAgreement.tsx`) and `apps/web/app/routes/app/settings/account/legalLinks.ts` (`legalLinks`, used by the account settings route and `settings.browser.test.tsx`) both build links to the legal pages, each handling `VITE_API_ORIGIN` on native.

**Build.** Fold them into one module in `lib/auth/legalLinks.ts`: keep the list of pages and the href rule in one place, and have both callers use it. Delete the settings copy and move its test cases into `lib/auth/legalLinks.test.ts` (no case lost). Behaviour doesn't change: same labels, same hrefs on web and native.

**Acceptance criteria.**

- [ ] One legal-links module; `settings/account/legalLinks.ts` and its test are gone; both callers and the settings browser test import from `~/lib/auth/legalLinks`.
- [ ] Unit test: `lib/auth/legalLinks.test.ts` covers both the web (relative) and native (`VITE_API_ORIGIN`) hrefs and the page list.
- [ ] `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** slice 7. **Blocked by:** none.

## Slice 6: Settings calendar, assistants, details and providers use the UI kit's text tones (B-637)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md · Tests: component (existing)

**Problem.** These files still use `text-base-content/<n>` for secondary text instead of the UI kit's tokens: `routes/app/groups/settings/calendar/{FeedCard,RemindersCard,DetailsCard,GoogleCard}.tsx`, `settings/assistants/route.tsx`, `settings/details/{DetailsOutsideCard,EasyTilesCard}.tsx`, `routes/app/groups/providers/providerWorld.tsx`.

**Build.** In those eight files only: `text-base-content/70` becomes `text-muted`; `/60` and `/50` become `text-faint` (ui-kit, _Tokens_). Keep any variant prefix (`hover:`, `group-hover:` …). Don't touch other classes or files. If a component test asserts the old class, update it.

**Acceptance criteria.**

- [ ] No `text-base-content/` left in the eight files; nothing else changed.
- [ ] The existing component tests for those screens pass; `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** none.

## Slice 7: Members settings and account settings use the UI kit's text tones (B-930)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md · Tests: component (existing)

**Problem.** As slice 6, in `routes/app/groups/settings/members/{MemberItem,InviteLinks,YourSharing,SharingForm,PendingInvites,JoinRequests,InviteSheet}.tsx` and `routes/app/settings/{account,contact,units,devices,timeline}/route.tsx`.

**Build.** The same mapping as slice 6 in those twelve files only.

**Acceptance criteria.**

- [ ] No `text-base-content/` left in the twelve files; nothing else changed.
- [ ] The existing component tests for those screens pass; `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** slice 5.

## Wave 3 (written 2026-11-26 by the orchestrator, from the triaged fixes-nit items)

## Slice 8: The UI kit's own primitives use its text tones (B-931)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/ui-kit.md · Tests: component (existing)

**Problem.** Three `ui/` primitives still use `text-base-content/<n>` for secondary text instead of the UI kit's tokens: `components/ui/ChipList.tsx:42` (`/50`, muted chips), `components/ui/tabLook.tsx:38` (`/80`, a tab that isn't current), `components/ui/date/DateTimeField.tsx:265` (`/60`, the weekday header cells) and `:282` (`/40`, days outside the month).

**Build.** In those three files only, per ui-kit _Tokens_ (`text-muted` 70%, `text-faint` 62%): `/50` and `/60` become `text-faint`; `/80` becomes `text-muted` (the orchestrator's pick: the nearest token; a tab that isn't current is secondary); `/40` becomes `text-faint` (the orchestrator's pick: outside-month days lift to 4.5:1 and stay quieter than the month's days). Keep any variant prefix. Don't touch other classes or files. If a component test asserts the old class, update it.

**Acceptance criteria.**

- [ ] No `text-base-content/` left in the three files; nothing else changed.
- [ ] The existing component tests for `ChipList`, `TabNav`/`FormTabs` and `DateTimeField` pass; `pnpm prd check --quick "slice hand-off"` passes.

**Blocks:** none. **Blocked by:** none.

## Wave 4 (written 2026-11-27 by the orchestrator, from the triaged fixes-nit items)

B-950 (move TimelineEntryRow out of the timeline route) waits for a later wave: it touches `routes/app/groups/timeline/`, a hot path of the running todo-subtasks-3.

## Slice 9: The components doc fits its budget again (B-973)

Stack: no · Reads: plans/fixes-rules.md, docs/domain/components.md · Tests: none (Markdown)

**Problem.** `docs/domain/components.md` is 10513 B on `dev`, over its 10240 B budget (`pnpm docs:budget`); it made fixes-ui's land need `risa sync --force`.

**Build.** This slice is the exception to "loops never edit `docs/`": the fix is the doc.

- Trim `docs/domain/components.md` to at most about 10 000 B (some room for the next fold-in) by tightening wording: drop repetition, stale lines (check a claim against the code before dropping it as stale) and examples the rule already makes plain. Keep every rule and every link; move nothing to other docs.
- Change no other file.

**Acceptance criteria.**

- [ ] `pnpm docs:budget` shows `docs/domain/components.md` under budget; no rule or link lost (say in the hand-off what was cut).
- [ ] `pnpm exec prettier --check docs/domain/components.md` and `pnpm test:tooling` pass.

**Blocks:** none. **Blocked by:** none.
