# Hotfix handbook

One contained fix in its own worktree, outside the PRD rules, when the user asks for it there rather than straight onto `dev`: `.loops/hotfix-<name>` on `hotfix/<name>` from `dev`, stackless, worked by the session the user asked in; no PRD, plan, orchestrator, slices or fields, and it doesn't count toward the PRD cap.

- **Starting:** a session in the main checkout runs `pnpm prd hotfix <name>` and from then on works only in the worktree, with absolute paths. For a fresh session, `pnpm prd hotfix <name> --open "<the fix>"` (without `--open` it prints the command).
- **Talk it through first** when the fix is a judgement call: summarise what's there, then ask with AskUserQuestion.
- **Ask the user before every step that takes time or changes shared state**, unless they say not to: a long test (`pnpm check`, `pnpm prd check`, component tests, a browser check, `stack up`), committing, syncing, landing and removing. Reads, edits, a typecheck, one unit-test file and making the worktree need no ask.
- Background agents are allowed, in the hotfix worktree only.
- One change the size of a small change on `dev`; bigger, parallel, a hot file or a migration is a PRD or a `quick-fixes` slice. Screens still get component tests. Update the docs the fix makes stale on the branch (a hotfix may edit `docs/` and AGENTS.md), and write any new hotfix rule you and the user settle on into this doc. A small tooling change the user asks for may ride along as its own `chore(loops): …` commit.
- Commit only when asked. Then, each on the user's go-ahead: the check the [gate](orchestrator.md#the-check-gate) asks for (quick by default; none for docs and tooling), `pnpm prd browser --changed` once (needs `pnpm prd stack up`), `pnpm prd sync` if `dev` moved. Land on their word, as a PRD lands ([orchestrator](orchestrator.md#landing-a-wave)): `pnpm prd land hotfix/<name> -m "fix(<area>): …"`, then `pnpm prd rm hotfix-<name>`.
- **Named tests only**, when the user asks: run the tests the fix changed and those that directly cover it, plus typecheck, lint and format; list them; land with `--force` only on their word. First update tests asserting an exact shape you changed.
- Backlog items go through `pnpm backlog`, never edits on the branch.
