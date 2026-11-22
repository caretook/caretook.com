# Plan: Providers 2

> Source PRD: [`plans/providers-2-prd.md`](providers-2-prd.md). User-story numbers (US) refer to it. Backlog items B-25 (@-mentions of providers) and B-48 (importing providers from another group). Topic `providers-2`.

## Status

| Slice | Wave | State           | Merge into `prd/providers-2` (slice commits)         |
| ----- | ---- | --------------- | ---------------------------------------------------- |
| 1     | 1    | merged (opus)   | 4e1bf908 (01e0ebf3, 4847e3a2)                        |
| 2     | 2    | merged (opus)   | 680de235 (4952a984)                                  |
| 3     | 1    | merged (opus)   | 0de633e1 (eeb1218a, fd7e1deb)                        |
| 4     | 2    | merged (sonnet) | 2a3f4f66 (bab7192d); conflict fix in the next commit |
| 5     | 3    | merged (opus)   | fc0d2e20 (cd6b09a8)                                  |

**Landing mode (2026-11-20): run everything through** (queued with `pnpm prd queue`): start every ready slice, land each green wave, clean up; ask only real questions. Per _Landing_, land when every slice is merged.

**Log:** 2026-11-20: backlog ingest: nothing new. `conditions` is in `dev` (a95acb73), so slice 4 waits only on slice 3. Overlap check: `appointments-2` (all merged, landing) touches `components/entry/EntryActions` etc., not `LiveNotesEditor` or the With row; `quick-fixes` not running. Wave 1: B-25 and B-48 claimed; worktrees `providers-2-1` (slot 5, stack) and `providers-2-3` (stackless) made; agents spawned (opus both: new UX).

Slice 1 handed off (pnpm check green bar one load-timing tooling test that passes alone; `prd browser --changed` ran the lean set 12/12, live-notes 58 s, usual seconds unchanged). Merged as 4e1bf908; worktree removed. Its component tests are a new `entry/entryMentions.browser.test.tsx`.

**Synced** `dev` (appointments-2, f49aa958) into prd/providers-2 as b4d47ea0, conflict-free; `pnpm install`, `datastore:reset`. Slice 3 still on the pre-sync base.

Slice 2 worktree `providers-2-2` (stackless) made from b4d47ea0; agent spawned (opus).

Slice 3 handed off (pnpm check green; a `roles.int` load timeout passed on rerun). Merged as 0de633e1, conflict-free; worktree removed. Its `--changed` names **roundtrip, layout-offline, first-sync**: run at landing. Wave 1 done. Slice 4 worktree `providers-2-4` (stackless) made; agent spawned (sonnet: small, spelled out).

Slice 2 handed off (pnpm check green; `--changed` names **roundtrip, live-notes**: run at landing). It made the `@` query allow spaces (`mentionQueryOpen`), so a two-word new name reaches the add row; slice 1's tests adjusted. Merged as 680de235 (before 4, plan order); B-25 done (ready); worktree removed. Slice 5 worktree `providers-2-5` (stackless) made; agent spawned (opus).

Slice 4 handed off (pnpm check green; `prd browser --changed` ran ui.spec on a temporary stack, pass, stack down). It added `ConfirmDialog`'s optional `confirmClassName` (default `btn-error`) and `secondGroup(role)` in `providerWorld.tsx`; it edited `docs/domain/providers.md` (the provider page's Copy to another group): accurate, kept, counts as slice 4's fold. Merged as 915e1643; worktree removed. Wave 2 done.

Slice 4 handed off (pnpm check green; `prd browser --changed` ran ui.spec on a temporary stack, pass, stack down). It added `ConfirmDialog`'s optional `confirmClassName` (default `btn-error`) and `secondGroup(role)` in `providerWorld.tsx`, and edited `docs/domain/providers.md` (the provider page's Copy to another group): accurate, kept as slice 4's fold. **Merge 2a3f4f66** went in with conflict markers and a wrong subject ("docs(providers-2): status: slice 4 merged"; a chained command committed past the conflict; a reset was refused, so fixed forward). The conflict was slices 2 and 4 each appending a `describe` to `provider.browser.test.tsx`: both kept, the file's 17 tests pass. **A code conflict was resolved: the landing check must be full.** Wave 2 done.

**Docs folded** into providers.md (mentions, importing; trimmed to 10225 B), live-notes.md (the mention node, popup), components.md (`ComboBox` `sections`, `ConfirmDialog` `confirmClassName`). First full check failed at lint: `apps/web/.react-router` missing (typegen); generated it and reran.

**Full check passed** on 0698e829 (510 files, 5217 tests, build budget ok). Served (`pnpm prd serve --restart`, :6473). `--changed --base dev` wants the whole lean set (deps); slice 1 already ran it 12/12 on its branch, so landing runs only the later slices' named checks, once each: roundtrip, live-notes, layout-offline, first-sync, ui.

**Browser checks passed** (load ~28): roundtrip 44 s, live-notes 1m09s, layout-offline 24 s, first-sync 24 s, ui 11 s. `pnpm prd ready` clean (one warning: dependencies, `pnpm install` in the main checkout). PRD marked done. Landing (run-through mode).

**Docs to fold (slice 1):** live-notes.md: `MENTION_NODE` (attrs `id`, `label`) always in the schema; `noteText` writes `@<label>`; `providers`/`onMention` props; popup keyboard/ARIA (listbox "Providers to mention", focus stays in the editor via `aria-activedescendant`); the two packages in `optimizeDeps`. providers.md (_Linking from notes and events_): a mention on an entry links like the With row (draft first, idempotent); deleting keeps the link; `mentionOptions` keeps linked ones; chip shows the current name, greyed for deleted/unknown.

**Docs to fold (slice 3):** providers.md: importing is a copy (new ids, ordinary local creates, no server path/migration/source record; notes, links, tasks not copied); `planImport` rules in `lib/providers/providerImport.ts` (fields, primary off, already here by type + `foldName`, practice mapped by type + name else copied once, deleted source practice dropped, practices first, per-provider results with `id`/`practiceId`); wording in `importWording.ts`; the sheet (`providers/import`, `appUrls.importProviders`, `importProvidersGuard`, writers with another group; groups named by recipient display name, else group name); tests in `providers.browser.test.tsx` and `syncProviders.int.test.ts`.

**Docs to fold (slice 2):** providers.md: mentions in every document, only notes and events link; add row (`mentionChoices`, last, writers, hidden when a live provider has the exact folded name; `createAndLinkProvider` on entries, else `createProvider` clinician); spaces in the query and when the popup closes (`mentionQueryOpen`); renamed / deleted / unknown chips; `useMentionProviders` (`lib/providers/mentionProviders.sync.ts`).

Slice 5 handed off (pnpm check green; `--changed` names **roundtrip, live-notes, ui**; it changed the shared `ui/ComboBox.tsx` to static children with optional `sections`: if `ui` fails, look there). Merged as fc0d2e20, conflict-free; B-48 done (ready); worktree removed. **All five slices merged.**

**Synced** `dev` (medications-3, 82221a92: migration 0030, seeds) as 57dce7e2; one conflict in the frozen export list `packages/data/src/db/schema/index.test.ts` (MEDICATION_TYPE* and MENTION_NODE, both kept in order; test passes). `pnpm install`, `datastore:reset`.

**Landing:** full `pnpm prd check` (code conflicts resolved; sync brought a migration and seeds). Browser checks (screens change; slice 1's deps already ran the lean set on its branch): `pnpm prd browser --changed --base dev` covers roundtrip, layout-offline, first-sync, live-notes, ui. Per _Landing_, no `--suite` without asking.

**Docs to fold (slice 5):** providers.md: "From <group>" sections in both pickers once typed (up to 5 per group, live matches minus already here by type + folded name, after this group's options, before the add row); a pick copies the provider and its practice, on an entry linked in one transaction (`importAndLinkProvider`), elsewhere mentioned without a link (`LiveNotesEditor`'s default `onImport`); `lib/providers/fromGroups.ts`, `otherGroupProviders.sync.ts`. components.md: `ComboBox`'s optional `sections` (heading + options, between options and create row; the caller filters).

**Start conditions:** none for wave 1, but before slice 1 check the open `appointments-2` and `quick-fixes` slices for changes to `LiveNotesEditor`, the entry page or the With row. Slice 4 waits for `conditions` in `dev` (it changes the provider page); `pnpm prd sync` before it.

**Landing:** no migration. Slice 1 adds dependencies (the lean set). Land when every slice is merged; run the checks once at the end. The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. Never `--suite` without asking, beyond slice 1's own.

**Backlog:** claim B-25 when slice 1 starts and B-48 when slice 3 starts; `done B-25` after slice 2 merges, `done B-48` after slice 5.

**New dependencies:** `@tiptap/extension-mention` and `@tiptap/suggestion`, exactly `3.34.0` (approved by the user, 2026-11-20), in slice 1.

Fold into the area docs at each landing:

- **Slice 1:** the mention node, its rendering, linking on entries and the `@Name` text in `docs/domain/live-notes.md` (the editor) and `docs/domain/providers.md` (_Linking from notes and events_).
- **Slice 2:** mentions in every document, the add row and deleted or renamed rendering in `providers.md`.
- **Slice 3:** importing (a copy, the planner's rules, the sheet) in `providers.md`.
- **Slice 4:** Copy to another group in `providers.md` (the provider page).
- **Slice 5:** the pickers' "From <group>" sections in `providers.md`.

## Architectural decisions

- **Mention node:** inline atom, attributes `id` (provider id) and `label` (name when typed). Renders the current local name (fallback `label`); deleted or unknown: greyed text, no link; otherwise a link through `appUrls.provider`.
- **Derived text:** `noteText` writes `@<label>`; the server's compaction and device previews share it.
- **Linking:** only notes and events link, through the existing `linkProvider` / `createAndLinkProvider` (after `ensureStored()` on a draft). `LiveNotesEditor` takes an optional mention callback; the entry page passes the linker. Removing a mention changes no link.
- **Options:** pure `mentionOptions`, on `providerDirectory`'s matching and display order, up to 20, already linked included, an add row for writers.
- **Import is a copy:** new ids, ordinary local creates that upload as provider creates. No server path, no migration, no source record. Notes, links and tasks aren't copied.
- **Planner:** pure, client-safe `providerImport` (source, target, chosen ids → rows and per-provider results). Duplicates by type and folded name; practices mapped by type and folded name, else copied once; primary off; practices first.
- **Device:** `importProviders` and `importAndLinkProvider` in `providers.sync.ts`, one local transaction each.
- **Who:** writers in the target; any membership in the source (the device holds only the user's groups).
- **Wording:** one pure module beside `entryProviders.ts` (section headings, "Already here", "Provider notes stay in <group>", the counts).

## How to run this plan

- **Wave 1: slices 1 and 3.**
  - Slice 1 owns `LiveNotesEditor`, the mention node and popup, `noteText`, the dependencies and the `live-notes` check.
  - Slice 3 owns `providerImport`, the device import writes, the import sheet and the Providers list's header.
  - No shared files but additive lines in `providers.sync.ts` and the wording module (slice 3 creates it, slice 1 doesn't need it).
- **Wave 2: slices 2 and 4.**
  - Slice 2 owns `mentionOptions`' add row and the other pages' editor props.
  - Slice 4 owns the provider page's actions and its dialog.
- **Wave 3: slice 5** (the With picker's `pickerOptions` and `mentionOptions`' other-group section).
- Merge in number order within a wave, with no checks between merges.
- **Stacks:**
  - Slice 1 needs one: new dependencies map to the lean set, and it changes the `live-notes` check.
  - The others are stackless: integration tests on the shared test Postgres, component tests on the test device. A stackless slice whose `--changed` names a browser check reports it for the orchestrator to run at landing.
- **The lean ceiling:** the lean set's usual seconds already equal `lean-ceiling` (255). Slice 1 folds its step into the existing cross-device typing step. If the median still rises past the ceiling, stop and ask the user; never raise it yourself.
- **Checks:** every slice runs `pnpm check`. Screen slices run `pnpm test:components --changed prd/providers-2`. Every slice runs `pnpm prd browser --changed` once before hand-off and reports what it named.
- **Running beside other PRDs:**
  - `conditions` (running) changes the provider page: slice 4 after it lands.
  - `appointments-2` (running) and `quick-fixes`: check their open slices for the entry page and the With row before slices 1 and 5.
  - `medications-3` (queued): no overlap.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs.

---

## Slice 1: Mentions in notes and events (tracer bullet)

Stack: yes · Reads: docs/domain/live-notes.md, docs/domain/providers.md, docs/domain/components.md · Tests: unit, integration, component, e2e:live-notes

**User stories:** 1–9, 14, 17, 18, 19, 20, 21, 22.

**What to build.**

- Add `@tiptap/extension-mention` and `@tiptap/suggestion` at exactly `3.34.0` to the web app; keep Vite's pre-bundling and dedupe lists working (add them to `optimizeDeps.include` if needed).
- The mention node (attributes `id`, `label`) and its node view: the provider's current name from the local database (fallback `label`), a link to the provider's page.
- The `@` popup: a listbox under the caret, arrows, Enter, Escape and tap; options from a first `mentionOptions` (this group's live providers, `providerDirectory` matching, display order, up to 20). Accessible names per the components doc.
- `LiveNotesEditor` takes an optional `onMention(providerId)` and the group's providers. Viewers' read-only editor has no popup.
- The entry page passes a callback that runs `ensureStored()` on a draft, then `linkProvider` (a repeat is a no-op). Deleting a mention changes no link.
- `noteText` writes a mention as `@<label>`.
- `live-notes` check: in the existing cross-device typing step, type a mention on one device; the other device shows the chip and the With chip.

**Acceptance criteria.**

- [ ] Unit tests: `noteText` with a mention (`noteYjs.test.ts`); `mentionOptions` (matching, order, limit, deleted excluded).
- [ ] Integration test (`noteDocument.int.test.ts`): compacting updates that hold a mention derives `@Name` text.
- [ ] Component tests (`entry.browser.test.tsx` or `entryWithRow.browser.test.tsx` on `providerWorld.tsx`): `@` opens the popup and narrows; Enter picks; the chip shows and the With row gains the provider; a first-line mention in a new note saves the draft and links; mentioning a linked provider makes no second link; deleting the mention keeps the link; a viewer sees the chip as a link and gets no popup.
- [ ] `live-notes` passes with the mention step; its usual seconds updated in `scripts/loops/checks` and the lean set within `lean-ceiling`.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** none. **Blocks:** 2, 5.

---

## Slice 2: Mentions everywhere, adding from the popup

Stack: no · Reads: docs/domain/live-notes.md, docs/domain/providers.md, docs/domain/components.md · Tests: unit, component

**User stories:** 10, 11, 12, 13, 15, 16.

**What to build.**

- Provider, medication, task and care-period pages pass the group's providers to `LiveNotesEditor` and no `onMention`, so mentions there are chips only.
- `mentionOptions` ends with 'Add "<typed>" as a provider' for writers when nothing matches the typed text exactly. On entries it uses `createAndLinkProvider`; elsewhere `createProvider` (a clinician), then inserts the mention.
- Rendering: a renamed provider shows the current name; a deleted or unknown one is greyed text, not a link.

**Acceptance criteria.**

- [ ] Unit tests: the add row (when it shows, exact-match rule, writers only).
- [ ] Component tests: on a provider's notes (`provider.browser.test.tsx`), a mention shows a chip and makes no entry link; on the entry page, the add row creates and links a clinician; a renamed provider's chip shows the new name; a deleted provider's chip is greyed and not a link.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 1. **Blocks:** 5.

---

## Slice 3: Import from another group (tracer bullet)

Stack: no · Reads: docs/domain/providers.md, docs/domain/care-groups.md, docs/domain/components.md, docs/domain/app-shell.md · Tests: unit, integration, component

**User stories:** 23–33, 42, 43, 44, 45, 46.

**What to build.**

- The pure `providerImport` planner (PRD _Importing_): fields copied, primary off, already here by type and folded name, practice reused or copied once, a deleted source practice dropped, practices first; per-provider results.
- The wording module (headings, "Already here", "Provider notes stay in <group>", counts).
- `importProviders(db, targetGroupId, sourceProviders, chosenIds)` in `providers.sync.ts`: one local transaction.
- The import sheet (a child of the Providers list, routing's sheet pattern, an `appUrls` builder): pick one of the user's other groups, then a list with the directory's search and type chips, checkboxes, "Already here" rows disabled, the notes rule, "Import N", and a status with the counts. "Import from another group" beside "Add provider", for writers who belong to another group. Viewers and missing groups get the list.

**Acceptance criteria.**

- [ ] Unit tests: the planner (each rule above, a clinician and its practice chosen together, two clinicians of one practice copying it once).
- [ ] Integration test (`syncProviders.int.test.ts`): an offline import of a clinician and a copied practice uploads in one batch; a replay succeeds; into a group where the uploader is a viewer it's refused.
- [ ] Component tests (`providers.browser.test.tsx` on `providerWorld.tsx`): the button only for writers with another group; picking a group lists its providers; already-here rows disabled; the notes rule shows; importing adds them to the list with counts; a reused practice is the clinician's practice.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** none. **Blocks:** 4, 5.

---

## Slice 4: Copy to another group from the provider page

Stack: no · Reads: docs/domain/providers.md, docs/domain/components.md · Tests: component

**User stories:** 34, 35, 36, 37.

**What to build.**

- In the provider page's actions, for writers who write in another group: "Copy to another group", a `<dialog>` listing those groups, the notes rule, and Copy through `importProviders`. Already there: says so and copies nothing. A status after copying names the group.

**Acceptance criteria.**

- [ ] Component tests (`provider.browser.test.tsx`): the action only when the user writes in another group (hidden for viewers and for a user whose other groups are all viewer roles); copying adds the provider to the other group's directory; a provider already there says so and adds nothing.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 3, and `conditions` in `dev`. **Blocks:** none.

---

## Slice 5: Other groups' providers in the pickers

Stack: no · Reads: docs/domain/providers.md, docs/domain/components.md · Tests: unit, component

**User stories:** 38, 39, 40, 41.

**What to build.**

- `pickerOptions` (the With picker) and `mentionOptions` take the user's other groups' providers. Once something is typed, a "From <group>" section per group lists matches minus ones already here (the planner's duplicate rule), up to 5 per group, after this group's options and before the add row.
- `importAndLinkProvider` in `providers.sync.ts`: imports one (with its practice) and links it to the entry in one local transaction. The `@` popup on an entry inserts the mention with the new id; on other documents it imports and mentions without linking.

**Acceptance criteria.**

- [ ] Unit tests: the sections (empty query shows none, matches only, already-here left out, limit, order).
- [ ] Component tests (`entryWithRow.browser.test.tsx`, the entry page): the With picker's "From <group>" pick imports and links (the chip opens this group's copy); the `@` popup's pick does the same and inserts the mention.
- [ ] `pnpm check` passes; `pnpm prd browser --changed` once.

**Blocked by:** 2, 3. **Blocks:** none.
