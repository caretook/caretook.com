# Rules for every fix slice

Shared by the five fix topics (`fixes-ui`, `fixes-tooling`, `fixes-perf`, `fixes-bug`, `fixes-nit`). Each fix slice's `Reads` field names this file. They are copied from the `quick-fixes` plan's _Writing and running new slices_ (that plan is left as it is).

## Shape

- **One slice and one backlog item per fix.** The orchestrator appends a slice per waiting item at a wave boundary (the next number: `pnpm prd status-trim <topic> --next`, which counts the plan and its history), and claims the item before it runs.
- **Split a big item.** A fix likely to touch more than 12 files (the commit hook's warning) becomes two or more slices, each its own item (fixes-ui slices 54 and 57 ran to 13 and 27).
- **Hot files.** A fix that would touch a running topic's hot files (`pnpm backlog prd list`) waits for a later wave. Once a wave's slices are written, the orchestrator sets its row's hot files to the path prefixes they will touch (`pnpm backlog prd set fixes-<cat> hot=<prefixes>`); removing the topic's worktree clears them.
- **Fields line** under each slice heading (AGENTS.md, _Slice fields_): `Stack: yes|no · Reads: <docs> · Tests: <unit | integration | component | e2e:<check>>`. `Stack: yes` only when the slice needs a dev server, database or an end-to-end check; component and integration tests run without one. `Reads` names this file and the docs the fix touches.

## Tests

- A screen fix gets a component test beside the screen (docs/domain/components.md, _Component tests_), never new CDP steps; a pure module gets a unit test; a service rule an integration test.
- An end-to-end step only for a flow across the server and sync (sign-in and the session, first sync, sign-out, two devices, offline then reconnect, uploads refused, invites and email, the CSP), in the lean check that owns it. A fix in an unmoved area (`e2e no`: providers, medications, search, …) updates that area's check only if it already asserts the changed behaviour.
- Acceptance criteria name the tests ("component test: …"), not "`<check>` passes".

## Checks

- **Before hand-off:** `pnpm prd check --quick "slice hand-off"`, then `pnpm prd browser --changed` once; its ■ lines and table go in the hand-off. Never the suite.
- **At landing:** a wave that changes screens or flows runs `pnpm prd browser --suite` once, plus any `e2e no` check `pnpm prd browser --changed --base dev --list` names; any other wave runs only `pnpm prd browser --changed --base dev`. No checks between merges; never rerun a check that passed.

## The category rule (for triage only)

An item's category is its topic (`prd=fixes-<cat>`).

- `bug`: wrong behaviour or data.
- `perf`: speed and load.
- `ui`: look, layout, wording and flow.
- `tooling`: scripts, checks, tests and flakes.
- `nit`: a small tidy that users won't notice.

An item that fits two takes the first that applies in this order: `bug`, `perf`, `ui`, `tooling`, `nit`. This is a tie-break for triage and says nothing about which topic runs first; the order between the topics is the user's.
