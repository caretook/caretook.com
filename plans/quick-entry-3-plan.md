# Plan: Quick entry everywhere

> Source PRD: [`plans/quick-entry-3-prd.md`](quick-entry-3-prd.md). User-story numbers (US) refer to it. Backlog items B-1038, B-1039. Topic `quick-entry-3`; follow-ons `quick-entry-find`, `undo-first` and `quick-entry-4` (PRD, _The whole plan_).

## Status

**From the user:** none yet in this topic.

**Landing mode:** run everything through (dispatcher start, 2026-11-28): start every ready slice, land each green wave, ask only real questions.

**Now (2026-11-28):** wave 1 running: slices 1, 3, 4 worktrees made, agents spawned (opus); watch running. Backlog at the boundary: nothing new for this topic.

| Slice | Wave | State   | Merge into `prd/quick-entry-3` (slice commits) |
| ----- | ---- | ------- | ---------------------------------------------- |
| 1     | 1    | started |                                                |
| 2     | 2    | planned |                                                |
| 3     | 1    | started |                                                |
| 4     | 1    | started |                                                |
| 5     | 2    | planned |                                                |

**Backlog:** claim a slice's item when it starts; `risa backlog done` an item when its last slice merges.

| Item                             | Slices  |
| -------------------------------- | ------- |
| B-1038 quick entry on every page | 1, 2, 3 |
| B-1039 go to a page and new tab  | 4, 5    |

## Architectural decisions

- **Commands are not actions** (PRD _Decisions_): a command is read whole by `readCommand` before `parseQuickEntry` splits the line, runs on the device, and never reaches `runActions`, the server runner, the connector or recent lines. No action shape, schema or migration changes; a slice that finds it needs one stops and tells the orchestrator.
- **One box, one Undo:** the sheet and the timeline render the same `QuickEntryBox`, with its own Undo; nothing is forked per place, and `useQuickEntry.save` and `offerUndoToast` don't change.
- **The sheet lives under the group:** mounted in the group layout (`GroupProvider`), opened through one open-state store by the frame's button and the shortcut.
- **Pure pieces live in the assistant domain folder** (`packages/data/src/domain/assistant/`), exported from its index; the domain imports only types from the schema.
- **Every wording and every neighbour that must stay an entry gets a test row.** Vocabularies are named row sets (like `QUICK_ENTRY_VOCABULARY`).
- **English only, no new dependency. Loops don't edit docs.**

## How to run this plan

- **Waves:** (1, 3, 4) → (2, 5).
- **Gates:** each slice hands off on `risa check --quick "slice hand-off"`; quick checks between waves. No browser check is edited or added.
- **Ownership:** slice 1 the sheet, its store, the frame's button and the group layout mount; slice 2 the shortcut hook (mounted beside the sheet); slice 3 page context (the parser's context and `useQuickEntry`); slice 4 the pure reader; slice 5 running a command (`runCommand`, the command card, `useQuickEntry`'s go). Slices 3 and 5 both touch `useQuickEntry.ts` in different waves; slices 2 and 5 share no file.
- **Beside other topics:** `fixes-ui` (running) owns todo and tag components; nothing here touches them. The frame route is a hot file: slice 1 fills a header region only.

---

## Slice 1: Quick entry from any group page

Stack: no · Reads: docs/domain/assistant.md, docs/domain/app-shell.md, docs/domain/components.md · Tests: component · Check: apps/web/app/components/quick-entry/quickEntrySheet.browser.test.tsx

**User stories:** 1, 3, 8.

### What to build

`QuickEntrySheet` (new, `components/quick-entry/QuickEntrySheet.tsx`) wraps the shared `QuickEntryBox` in the kit `Sheet`, with a small open-state store in the same file (`openQuickEntry`, `closeQuickEntry`, a subscribe hook; module state like `components/ui/toastQueue.ts`). It is mounted once in the group layout (`routes/app/groups/layout/route.tsx`, under `GroupProvider`). The frame (`routes/app/layout/route.tsx`, `AppLayout`) gets a header button beside the search button that calls `openQuickEntry`, on group routes (it knows one from `useRouteLoaderData("group")`, as `useEasyFrame` does) and not in the easy frame; its icon says quick entry. Readers get the button too; the box refuses their write cards as on the timeline. The sheet stays open after Save with the box's own Undo; Escape closes it.

### Acceptance criteria

- [ ] Component test `quickEntrySheet.browser.test.tsx` (new): the button opens the sheet on a non-timeline group page; "bp 120/80" saves and the box's Undo removes it; Escape closes the sheet; a reader sees the button and "bp 120/80" shows no Save; the easy frame has no button; no button outside a group.
- [ ] The timeline's quick entry tests pass unchanged.
- [ ] `risa check --quick "slice hand-off"` passes.

**Blocked by:** none. **Blocks:** 2, 5.

---

## Slice 2: A key opens it

Stack: no · Reads: docs/domain/assistant.md, docs/domain/app-shell.md, docs/domain/components.md · Tests: component · Blocked by: 1 · Check: apps/web/app/components/quick-entry/quickEntryShortcut.browser.test.tsx

**User stories:** 2.

### What to build

`useQuickEntryShortcut` (new, `components/quick-entry/useQuickEntryShortcut.ts`), used by `QuickEntrySheet`: `/` (not in an input, textarea, select or contenteditable, no modifier) and Cmd/Ctrl+K call `openQuickEntry` and focus the box; Cmd/Ctrl+K also works from inside a field. Off in the easy frame. The kit's own key handlers (dialogs, combo boxes) keep theirs.

### Acceptance criteria

- [ ] Component test `quickEntryShortcut.browser.test.tsx` (new): `/` opens the sheet with the box focused; `/` typed in an input or the box itself types a slash; Cmd+K and Ctrl+K open it, also from an input; nothing in the easy frame.
- [ ] `risa check --quick "slice hand-off"` passes.

**Blocked by:** 1. **Blocks:** none.

---

## Slice 3: The box knows the page it opened on

Stack: no · Reads: docs/domain/assistant.md, docs/domain/app-shell.md · Tests: unit · Check: packages/data/src/domain/assistant/quickEntryPage.test.ts

**User stories:** 4, 5.

### What to build

`pageContextFor(params)` (new, pure, `packages/data/src/domain/assistant/quickEntryPage.ts`, exported from the domain index) maps route params (a plain record) to `{ providerId?, medicationId? }`. `useQuickEntry` passes it from `useParams` into `parseQuickEntry`'s context as `page` (`QuickEntryContext` gains `page?`). In the parser (`packages/data/src/db/schema/assistant/quickEntry.ts`): a note or event with no provider named links `page.providerId` (as a named provider does; title and place rules unchanged); a dose line naming no medication ("gave 1", "gave it", "skipped", "refused") reads as a dose of `page.medicationId`. A named provider or medication always wins; with no page, nothing changes. On the timeline there is no page context.

### Acceptance criteria

- [ ] Unit rows in `quickEntryPage.test.ts` (new), through `parseQuickEntry`: with a provider page, "called back, refill sent" is a note linking that provider; "follow up next tuesday" an event with that provider; "called dr alvarez" links Dr. Alvarez, not the page's. With a medication page, "gave 1" is a dose of 1 of it, "skipped" a skipped dose; "gave tylenol" is Tylenol; "bp 120/80" stays a vital. Without a page, each line reads as today.
- [ ] A `pageContextFor` row per param kind, and none for params without a provider or medication.
- [ ] `risa check --quick "slice hand-off"` passes.

**Blocked by:** none. **Blocks:** none.

---

## Slice 4: Read "go to <page>", in place or in a new tab

Stack: no · Reads: docs/domain/assistant.md, docs/domain/app-shell.md · Tests: unit · Check: packages/data/src/domain/assistant/quickEntryGoTo.test.ts

**User stories:** 6, 7.

### What to build

In `packages/data/src/domain/assistant/quickEntryGoTo.ts`, `readGoTo` grows into `readCommand(text, context)` (keep `readGoTo` exported until slice 5 swaps its caller): go to / open / show + a page name from `QUICK_ENTRY_PAGES` (new rows: timeline, todos, planner, upcoming, calendar, medications, meds, schedule, providers, doctors, care periods, profile, allergies, settings, members, tags, search), each mapped to a page key; new-tab wording from `NEW_TAB_PHRASES` ("in a new tab", "in a new window", "new tab …", "pop out …") sets `newTab`. The day rule is unchanged. A command is `{ kind: "day" | "page", …, newTab }`.

### Acceptance criteria

- [ ] Unit rows in `quickEntryGoTo.test.ts`: each page name and each new-tab wording; "go to tuesday" still a day; neighbours are not commands: "go to dr lee at 3", "show of hands at church", "open wound looks better", "went to the pharmacy".
- [ ] The existing go-to rows pass.
- [ ] `risa check --quick "slice hand-off"` passes.

**Blocked by:** none. **Blocks:** 5.

---

## Slice 5: Run a command from the box

Stack: no · Reads: docs/domain/assistant.md, docs/domain/app-shell.md, docs/domain/components.md · Tests: component · Blocked by: 1, 4 · Check: apps/web/app/components/quick-entry/quickEntryCommand.browser.test.tsx

**User stories:** 6, 7, 8.

### What to build

`runCommand` (new, `apps/web/app/lib/assistant/runCommand.ts`) turns a command into an `appUrls` URL and navigates, or opens it with `window.open(url, "_blank", "noopener")` (in place when `BUILD_TARGET` is native); the day case keeps today's timeline jump. `QuickEntryGoToCard` becomes `QuickEntryCommandCard` (what it will do, then Go; its export in `components/quick-entry/index.ts` follows). `useQuickEntry` calls `readCommand` where it called `readGoTo`, and its go runs `runCommand`, closing the sheet (`closeQuickEntry`) after navigating.

### Acceptance criteria

- [ ] Component test `quickEntryCommand.browser.test.tsx` (new): "go to medications" shows a command card and Go opens the medications page and closes the sheet; "open the planner in a new tab" calls a stubbed `window.open` with the planner's URL; "go to tuesday" still jumps the timeline; a reader can go to a page.
- [ ] `risa check --quick "slice hand-off"` passes.

**Blocked by:** 1, 4. **Blocks:** none.
