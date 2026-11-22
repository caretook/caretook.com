# PRD: Providers 2 (mentions and importing)

**Status: done** (2026-11-21). Its lasting decisions are in [providers](../docs/domain/providers.md), [live notes](../docs/domain/live-notes.md) and [components](../docs/domain/components.md).

Backlog items B-25 (@-mentions of providers in live notes and events) and B-48 (importing providers from another care group you belong to). Topic `providers-2`. It follows the providers PRD ([`providers-prd.md`](providers-prd.md), done); the rules it builds on are in [providers](../docs/domain/providers.md), [live notes](../docs/domain/live-notes.md) and [care groups](../docs/domain/care-groups.md).

## Problem Statement

A caretaker writing a note ("Dr. Rivera said to halve the dose") has to stop typing, go to the With row and pick the provider so the note shows up on the provider's page. Most don't, so the provider's history is thinner than the notes. And in notes outside the timeline (a medication's or a task's), there is no way to point at a provider at all.

Someone who helps in two care groups (both parents, say, who share a pharmacy and a GP) has to type the same provider in twice, phone numbers and all, even though they can already see it in the other group.

## Solution

**Mentions.** Typing `@` in any live document opens a popup of the group's providers that narrows as you type. Picking one puts a chip in the text with the provider's name. A tap on the chip opens the provider's page. In a note or event, a mention also links the provider to the entry, exactly as the With row does, so it shows in the With chips, on the timeline's "with …" line and in the provider's linked entries. Writers can create a provider from the popup ('Add "…" as a provider'). Deleting a mention from the text leaves the link alone: unlinking stays the With chip's ×.

**Importing.** A writer can copy providers from any other group they belong to into this one, from three places:

- an "Import from another group" sheet on the Providers list (pick a group, then one or more providers);
- "Copy to another group" on a provider's page;
- a "From <group>" section in the With picker and the `@` popup, where picking a provider copies it here and links it in one step.

The copy is independent: its contact details and practice come along, but the provider notes stay behind (the screens say so), and later edits on either side don't sync to the other. A provider that already exists here (same name and type) is marked "Already here" and skipped.

## User Stories

### Mentions

1. As a caretaker writing a note, I want to type `@` and pick a provider, so that I can name them without leaving the text.
2. As a caretaker, I want the `@` popup to narrow as I type more of the name, specialty or practice, so that I find the right provider in a long list.
3. As a caretaker, I want the popup to match the same way the With picker does (every word, case and accents ignored), so that search behaves the same everywhere.
4. As a caretaker, I want the popup to list providers in the directory's order (primary first, then current, then past), so that the likely ones come first.
5. As a caretaker, I want to choose with the keyboard (arrows, Enter, Escape) or by tapping, so that it works on a phone and a laptop.
6. As a caretaker, I want a mention in a note or event to link the provider to that entry, so that the provider's page lists the note without an extra step.
7. As a caretaker, I want the With chips to update as soon as I mention someone, so that I can see the link was made.
8. As a caretaker, I want mentioning an already linked provider to change nothing else, so that two mentions don't make two links.
9. As a caretaker, I want a mention typed in a brand-new note to work, so that the first line can name the doctor (the draft saves first, then links).
10. As a caretaker, I want to add a provider from the popup when nobody matches ('Add "Dr. Chen" as a provider'), so that a new name doesn't stop my note.
11. As a caretaker, I want the provider added from the popup to be a clinician I can fill in later, so that it matches what the With picker does.
12. As a caretaker, I want to mention providers in a provider's, medication's, task's or care period's notes too, so that I can point at the pharmacy from the medication's notes.
13. As a caretaker, I want mentions outside notes and events to make no link, so that only timeline entries show on a provider's page.
14. As anyone reading a note, I want to tap a mention to open the provider's page, so that their phone number is one tap away.
15. As anyone reading a note, I want a renamed provider's mention to show the new name, so that old notes stay current.
16. As anyone reading a note, I want a deleted provider's mention greyed and not a link, so that I'm not sent to a missing page.
17. As a viewer, I want to see mentions as chips I can tap, so that I can follow them even though I can't edit.
18. As a viewer, I want no popup and no add option, so that I can't change the note.
19. As a caretaker, I want deleting a mention from the text to leave the provider linked, so that a co-editor's edit can't quietly undo a link someone else made.
20. As a caretaker, I want mentions to work offline and sync to the others like the rest of the text, so that nothing depends on a connection.
21. As a member searching or asking a connected assistant, I want a mention to read as `@Name` in the note's text, so that searching for the provider's name finds the note.
22. As a co-editor on another device, I want a mention typed by someone else to appear as a chip, so that we see the same note.

### Importing

23. As a caretaker in two groups, I want to import providers from my other group, so that I don't retype their details.
24. As a caretaker, I want to start an import from the Providers list ("Import from another group"), so that I can bring several over at once.
25. As a caretaker, I want to pick the source group first, then tick providers, so that the list isn't a mix of groups.
26. As a caretaker, I want the source list to use the same search and type chips as the directory, so that I can find providers quickly.
27. As a caretaker, I want providers that already exist here (same name and type) marked "Already here" and not selectable, so that I don't make duplicates.
28. As a caretaker, I want a clinician's practice to come along, so that the copy shows where they work.
29. As a caretaker, I want a practice that already exists here (same name and type) reused instead of copied, so that clinicians from the same office share one practice.
30. As a caretaker, I want imported providers' contact details (type, name, specialty, phones, email, address, website, current or past) copied, so that the copy is useful right away.
31. As a caretaker, I want "primary" turned off on imported providers, so that the other group's primary doesn't become mine.
32. As a caretaker, I want to be told that provider notes aren't copied ("Provider notes stay in <group>"), so that I know to look there for them.
33. As a caretaker, I want the import to say how many providers were added and skipped, so that I know what happened.
34. As a caretaker, I want to copy a provider to another group from its page ("Copy to another group"), so that I can share one I just added.
35. As a caretaker, I want that action to list only groups where I can write, so that I'm not offered groups where it would fail.
36. As a caretaker, I want the action hidden when I have no other group where I can write, so that I don't see a dead end.
37. As a caretaker, I want copying a provider that's already in the target group to say so instead of copying, so that duplicates don't creep in.
38. As a caretaker linking a provider in the With picker or the `@` popup, I want matches from my other groups listed under "From <group>", so that I can use a provider I already typed elsewhere.
39. As a caretaker, I want picking one of those to copy it here and link it in one step, so that it feels like picking a local provider.
40. As a caretaker, I want other groups' providers that already exist here left out of that section, so that I only see the local copy.
41. As a caretaker, I want other groups' matches to show only once I've typed something, so that the empty picker isn't crowded.
42. As a caretaker, I want imports to work offline and upload later, so that I can do it anywhere.
43. As a viewer, I want no import or copy options in a group where I can't write, so that I'm not offered something I can't do.
44. As a viewer in the source group, I want to be able to copy its providers into a group where I'm a writer, so that I can reuse what I can already read.
45. As a caretaker, I want later edits to a copy not to change the original (and the other way round), so that each group keeps its own directory.
46. As a member of the source group, I want nothing in my group to change when someone copies from it, so that imports are invisible to us.

## Implementation Decisions

### Mentions

- **Dependencies:** `@tiptap/extension-mention` and `@tiptap/suggestion`, pinned at 3.34.0 like the other Tiptap packages (approved by the user, 2026-11-20). The popup UI is ours.
- **The mention node:** an inline atom with attributes `id` (the provider's id) and `label` (its name when typed). It's stored in the Yjs document like any other node, so it syncs, merges and works offline through the existing live-notes path. On screen it renders the provider's **current** name from the local database, falling back to `label`. A deleted or unknown provider renders greyed, as text, with no link. Otherwise it's a link to the provider's page through `appUrls`.
- **Derived text:** `noteText` (client-safe, used by the server's compaction and by device previews) writes a mention as `@<label>`. Search, previews and the connectors read that text. `noteDocFromText` doesn't create mentions.
- **Where:** `LiveNotesEditor` gets the mention for every document. The editor takes an optional mention callback. The entry page passes one that links the provider (`linkProvider`, after `ensureStored()` on a draft). The other pages pass none, so a mention there is only a chip.
- **Options:** a pure `mentionOptions` reuses the With picker's matching (`providerDirectory`'s every-word match; not deleted; display order; up to 20). The ones already linked aren't left out, unlike the With picker, since a mention is also text. When nothing matches exactly, writers get 'Add "<typed>" as a provider'. That goes through `createAndLinkProvider` on entries and `createProvider` elsewhere, as a clinician. From slice 5, the options end with a "From <group>" section (see _Importing_).
- **Removing:** deleting a mention changes no link.
- **Viewers:** the editor is read-only for viewers, so no popup. Chips still open the provider's page.
- **Older builds:** a client without the mention node would drop or refuse it. The web app ships as one deploy, so all web clients move together. Native isn't built yet.

### Importing

- **A copy, not a share.** An import writes new `provider` rows in the target group with new ids, through the device's ordinary local create path. They upload as ordinary provider creates, so the server's existing checks apply (writer in the target group, a practice in the same group). **No new server path, no migration, and no record of the source.**
- **Who:** a writer in the target group who is any member of the source. The device holds only the groups its user belongs to, so "member there" holds by construction. The screens show the import options only to writers, and list only target groups where the user writes (for "Copy to another group").
- **The pure planner** (`providerImport`, the deep module, client-safe): given the source group's providers, the target's providers and the chosen ids, it returns the rows to create and a result per chosen provider (`added`, `alreadyHere`, `practiceReused`). Its rules:
  - Copy type, name, specialty, phones, email, address, website and status. `is_primary` is off.
  - **Already here:** the same type and the same name, folded (case, accents and spacing ignored, as in `providerDirectory`), among the target's live providers. Those are skipped.
  - **Practice:** a clinician's or other contact's practice maps to a live practice or pharmacy here with the same name and type; otherwise the practice is copied too (once, however many of its clinicians are chosen). A deleted source practice isn't copied, and the copy has no practice.
  - Practices are written before the providers that name them.
- **The device writes:** `importProviders(db, targetGroupId, sourceProviders, chosenIds)` writes the planner's rows in one local transaction. `importAndLinkProvider` does the same for one provider and then links it to an entry, for the pickers. Both return the planner's results.
- **Screens:**
  - **The import sheet** (a child of the Providers list, routing's sheet pattern, through `appUrls`): it's reached from "Import from another group" next to "Add provider", shown to writers who belong to another group. Step one picks the group (other groups only); step two is a list with the directory's search and type chips, a checkbox per provider, and "Already here" rows disabled. A note says "Provider notes stay in <group>". The button reads "Import N", and a status line reports the counts.
  - **Copy to another group** (the provider page's actions, writers, when the user writes in another group): a `<dialog>` that picks the target group, names the notes rule and copies. If the provider is already there, it says so and copies nothing.
  - **The pickers:** the With picker's `pickerOptions` and `mentionOptions` take the user's other groups' providers. Once something is typed, they add a "From <group>" section per group, with matches only, minus ones already here, up to 5 per group. Picking one runs `importAndLinkProvider`.
- **Wording** lives in one place beside `entryProviders.ts`: section headings, "Already here", the notes rule, the counts.

## Testing Decisions

- Tests check behaviour through each module's interface: what a planner returns, and what a screen shows and writes. They don't check how the result is built.
- **Unit:**
  - `providerImport`: fields copied, primary off, duplicates by folded name and type, practice reused or copied once, a deleted practice dropped, order (practices first).
  - `mentionOptions` and the pickers' other-group sections: matching, order, limits, the add row, already here.
  - `noteText` with mentions (`noteYjs.test.ts`).
  - Prior art: `withProviders.test.ts`, `providerSuggestions` tests.
- **Integration:**
  - `noteDocument.int.test.ts`: compacting updates that hold a mention derives `@Name` text.
  - `syncProviders.int.test.ts`: an offline import of a clinician and a copied practice uploads in one batch, and replaying it succeeds.
  - Uploading an import into a group where the user is a viewer is refused.
- **Component** (on `providerWorld.tsx`, which has a second group):
  - The entry page: `@` opens the popup; picking links and the With chips update; a draft's first-line mention; add-as-provider; viewers get chips without a popup; a deleted provider greyed; a renamed one current.
  - Another document (a provider's notes): a chip, no link.
  - The import sheet: group choice, ticking, already here, the notes rule, the counts, and the providers in the list afterwards.
  - The provider page's Copy to another group: only writable groups, hidden with none, already there.
  - The With picker's "From <group>" section: import and link.
  - Prior art: `entryWithRow.browser.test.tsx`, `providers.browser.test.tsx`, `provider.browser.test.tsx`.
- **End to end:** one step in the `live-notes` lean check. A mention typed on one device shows as a chip on the other, and the provider's link reaches it. Fold it into the existing cross-device typing step: the lean set's usual seconds already equal its 255 s ceiling, and only the user raises it.

## Out of Scope

- Mentioning anything but providers (members, medications, tasks).
- Notifications to a mentioned person (providers aren't users).
- Unlinking a provider by deleting its mention.
- Sharing one provider between groups, syncing edits between copies, or recording where a copy came from.
- Copying provider notes, links, linked tasks or visit prep.
- Bulk copying out of a group (the provider page copies one).
- Merging into an existing provider.
- Mentions created by the connectors or by `noteDocFromText`.

## Further Notes

- **Running beside other PRDs:**
  - `conditions` (running) adds diagnosed-by and managed-by to the provider page, so the provider page action waits for it in `dev`.
  - `appointments-2` and `quick-fixes` may touch the entry page. Check their open slices for `LiveNotesEditor` and the With row before starting.
- The new dependencies put slice 1 in the lean set (dependency changes map to `@suite`).
