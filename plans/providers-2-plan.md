# Plan: Providers 2

> Source PRD: [`plans/providers-2-prd.md`](providers-2-prd.md). User-story numbers (US) refer to it. Backlog items B-25 (@-mentions of providers) and B-48 (importing providers from another group). Topic `providers-2`.

## Status

| Slice | Wave | State           | Merge into `prd/providers-2` (slice commits) |
| ----- | ---- | --------------- | -------------------------------------------- |
| 1     | 1    | not started     |                                              |
| 2     | 2    | blocked by 1    |                                              |
| 3     | 1    | not started     |                                              |
| 4     | 2    | blocked by 3    |                                              |
| 5     | 3    | blocked by 2, 3 |                                              |

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
