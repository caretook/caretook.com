# Plan: Providers

> Source PRD: [`plans/providers-prd.md`](providers-prd.md). User-story numbers (US) refer to it. Backlog items B-13 (directory) and B-14 (links and suggestions). Topic `providers`.

## Status

| Slice | State                                                                               | Merge into `prd/providers` (slice commits) |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| 1     | landed in `dev` (`cc47b01`)                                                         | `8624622` (`09b62bd`, `17b861d`)           |
| 2     | merged                                                                              | `5dbd62d` (`ffd9b57`, `f131be7`)           |
| 3     | merged                                                                              | `a87e072` (`41ee0b6`, `280cef2`)           |
| 4     | merged; Edit wired by the orchestrator (`de2f2c1`), `appUrls` merge fix (`30f0d61`) | `b2b8120` (`e773c21`, `f76862d`)           |
| 5     | blocked by `components` slices 2, 3 and 4 (in `dev`)                                |                                            |
| 6     | blocked by 5                                                                        |                                            |
| 7     | blocked by 5                                                                        |                                            |

Wave 2 (slices 2–4, a usable directory) is merged and synced with `dev` at `82eb690` (routing done); awaiting the user's go-ahead to land.

Backlog: B-13 is `ready` (done at `30f0d61`, after slice 4). B-14 is `triaged` (slices 5–7). B-25 (@-mentions) is triaged to `providers` as a follow-up after slice 5, not part of this plan. B-27 (routing.mjs flakes, owned by routing) and B-28 (a machine-wide browser check lock; note on leftover Chromes) came up while running this PRD.

Slice 1 notes for later slices:

- The column is `is_primary` (TS `isPrimary`), not `primary` (an SQL keyword in Postgres, SQLite and PowerSync).
- `lib/sync/providers.ts` has the device queries and writes. `linkProvider`/`createAndLinkProvider` need the entry to exist locally, so the With row (slice 5) must materialize a draft first.
- A device-created provider document writes `subject: "provider"` and `provider_id`. `useLiveDocuments` and the Live now banner join through `timeline_entry`, so provider documents never appear there.
- `providers.mjs` drives the device module through Vite imports. Slice 2 adds its screen steps there.
- Open: changing a practice's type to clinician isn't blocked while clinicians still point at it.

Wave 2 notes for later slices:

- The provider page (`routes/app/groups/provider/`) has an empty spot after Notes for slice 5's linked entries; `providerEntriesQuery` is ready.
- The edit sheet is a child of the list route, so from the provider page it opens over the list (`PROVIDER_SHEET_STATE` makes closing go back to the page).
- Sheets import `EntrySheet` from `routes/app/groups/timeline/`; `components` should move it to `components/`. `LiveNotesEditor`, `EditorAvatars`, `ContactActions` and `ProviderTypeIcon` moved to `components/` in slice 4: tell `components` when this lands.
- `compareProviders` (JS) puts past providers below current ones even when primary; `providersQuery`'s SQL order differs.
- `providers.mjs` cleans up its `PV-` providers; an aborted run can leave past ones behind that break slice 2's "Show past (1)" step on that stack.

## Architectural decisions

Durable decisions every slice follows:

- **Routes** (children of `routing`'s `/app/groups/:groupId` route, built through `appUrls`):
  - `providers`: the list (`?q=`, `?type=clinician|practice|pharmacy|other`, `?past=1`)
  - `providers/new` (optional `?type=`) and `providers/:providerId/edit`: sheet routes (the `routing` pattern)
  - `providers/:providerId`: the provider page
- **Group section:** one `GROUP_SECTIONS` entry, Providers (lucide `Stethoscope`), appended after Timeline; its `match` claims `/providers/*`.
- **Schema** (one pending migration for the PRD, made in slice 1; regenerate it on top if a sync brings in another):
  - `provider`: `id`, `group_id`, `type` (`clinician | practice | pharmacy | other`), `name`, `specialty`, `practice_id` (composite FK in the group), `phones` jsonb `[{ label, number }]` (≤ 6), `email`, `address`, `website`, `status` (`current | past`), `primary` (boolean), `deleted_at`, timestamps, audits; unique `(group_id, id)`.
  - `timeline_entry_provider`: `id` (UUID v5 of the entry and provider ids), `group_id`, `entry_id`, `provider_id` (composite FKs, cascade), timestamps, audits; unique `(entry_id, provider_id)`. Notes and events only. Unlink is a hard delete.
  - `note_document` gains `subject` (`entry | provider`), `entry_id` and `provider_id` (one set, equal to `id`, each a cascading composite FK). **No data migration:** reseed (`pnpm datastore:reset`).
- **Permissions:** both tables readable by any member, written by writers (owner, admin, caretaker); provider delete is soft. Provider documents follow `note_document`.
- **Sync:** both tables in the `care_groups` stream and the publication (explicit columns; soft-deleted providers included). Writes are local first and upload through `sync.upload`, like timeline entries.
- **Display order:** primary first, then current by name, then past by name. Deleted providers never list; linked entries show their name greyed as "(removed)".
- **Registries are appended to, never reordered:** `db/schema/index.ts`, `PERMISSIONS`, `sync-config.yaml`, the upload switch, the device schema, `routes.ts`, `GROUP_SECTIONS`.
- **UI building blocks:** slices 2–4 use whatever `components` has landed by then (its primitives if slice 2 is in `dev`, otherwise today's components). Slices 5–7 use the primitives and the split timeline and entry page.

## How to run this plan

- **Slice 1 starts now**, beside `routing`: it touches only `packages/`, `powersync/`, the device schema and seeds, none of `routing`'s files. It needs a stack (migration and integration tests).
- **2 after 1 and after `routing` slice 1 lands** (the group route, `appUrls`, folders). Sync `dev` into `prd/providers` first.
- **3 after 2 and after `routing` slice 2 lands** (the sheet route pattern). **4 after 2**; 3 and 4 run in parallel.
- **5 after 3 and 4, and after `components` slices 2, 3 and 4 land** (primitives, the timeline split, the entry page split). **6 and 7 after 5**, in parallel.
- Merge in number order. After each merge, run `providers.mjs` plus the checks the slice's files touch: `live-notes.mjs` (slices 1, 4, 5, 6), `phase2.mjs` and `roundtrip.mjs` (slices 5, 7), `app-shell.mjs` and `routing.mjs` (slice 2, the new section). Run `pnpm datastore:reset` and `docker compose restart powersync` after slice 1, and after any sync that brings a migration.
- **Land in waves:** slice 1 (data) on its own if it helps other PRDs; then 2–4 (a usable directory); then 5–7 (linking).
- Every slice ends with `pnpm check`, `pnpm build:native`, its browser checks and a hand-off (AGENTS.md, _Loop rules_).

```
1 ── 2 ──┬── 3 ──┐
         └── 4 ──┴── 5 ──┬── 6
                         └── 7
routing 1 → 2 · routing 2 → 3 · components 2, 3, 4 → 5
```

---

## Slice 1: The data layer

**User stories:** US 34–36, 38, 39, 41, 42. **Blocked by:** none. **Blocks:** 2.

### What to build

The `provider` and `timeline_entry_provider` tables with their Zod schemas, `PERMISSIONS` entries, models and services (`providerService`: create, update, soft remove, practice and phones rules; `entryProviderService`: link and unlink, notes and events only, same group, not deleted, idempotent on the pair-derived id). Generalize `note_document` (subject and owner columns, one cascading FK each), with `noteDocumentService.create` accepting a provider. One migration, no backfill. Add both tables and the new document columns to the publication, the `care_groups` stream, the upload switch and the device schema, with local queries (list, one provider, an entry's providers, a provider's entries, link history) and local writes (create, update, soft remove, link, unlink, create-and-link in one transaction). Fictional seeds in their own file for both groups, including provider notes and links to existing seeded events and notes.

### Acceptance criteria

- [ ] Integration tests: every role × provider create, update and delete; the practice rule (a practice or pharmacy in the same group, not deleted); phones limits; soft delete hides a provider from lists.
- [ ] Integration tests: links only to live notes and events in the same group; a deleted provider is refused; linking the same pair twice is one row; another group's ids are unauthorized; unlink removes the row.
- [ ] Integration tests: a provider document is created, takes updates, compacts and cascades with its provider; every existing note document test passes unchanged.
- [ ] Upload tests for both tables (PUT, PATCH, DELETE, immutable group, read-only PATCH on links).
- [ ] Unit tests for the Zod schemas, the pair-derived link id, and the seeds (validated like `timelineEntries.test.ts`).
- [ ] After `pnpm datastore:reset` and a PowerSync restart, `window.caretookSync` on a signed-in device shows Dev Family's providers, links and provider documents; Dev Family 2's member sees only its own.
- [ ] A device-side write (create and link, offline) uploads and appears in Postgres.
- [ ] `live-notes.mjs`, `phase2.mjs` and `roundtrip.mjs` pass unchanged.

---

## Slice 2: The Providers tab and list

**User stories:** US 1, 7–14, 36–40. **Blocked by:** 1, `routing` slice 1. **Blocks:** 3, 4.

### What to build

The Providers section (one `GROUP_SECTIONS` entry) and the `providers` route under the group route: the list from local data, live, in the display order, each row with name, type, specialty, practice, primary and past badges, and contact actions (call the first number, email, map). Search across name, specialty and practice (`?q=`), type filter chips (`?type=`), and past providers behind "Show past" (`?past=1`), all in the URL. A pure module for contact actions (`tel:`, `mailto:`, a maps search URL, `https://` for bare websites) and one for ordering and matching. Read-only: no add or edit yet. Start `providers.mjs`.

### Acceptance criteria

- [ ] The tab bar (420) and header nav (1280) show Timeline and Providers, with `aria-current` on the right one.
- [ ] The seeded list shows primary providers first, then current by name; past ones only with "Show past".
- [ ] "cardio" finds the cardiologist by specialty; the clinic's name finds its clinicians; filters and search survive a reload.
- [ ] Call, email and map controls have accessible names ("Call Dr. …, office") and correct `href`s.
- [ ] Works offline from the device's copy; a non-member's `…/providers` is the 404 with no names.
- [ ] Unit tests for contact actions, ordering and search matching.
- [ ] `providers.mjs` covers the above; `app-shell.mjs` and `routing.mjs` pass.

---

## Slice 3: Add, edit and delete

**User stories:** US 2–6, 12, 13, 32, 34, 37. **Blocked by:** 2, `routing` slice 2. **Blocks:** 5.

### What to build

Sheet routes `providers/new` (optional `?type=`) and `providers/:providerId/edit`, for writers, over the list (or the provider page once it exists). The form: type, name, specialty or role, practice (a select of the group's practices and pharmacies, for clinicians), phones (add, label, remove, up to 6), email, address, website, primary and past. It saves locally and closes; offline writes upload later. Delete (in the edit sheet, with a confirm) is soft. An Add button on the list for writers; viewers get no add, edit or delete controls, and their sheet URLs show the list.

### Acceptance criteria

- [ ] A writer adds a clinician with two phones and a practice; it appears in the list at once and on a second device after sync.
- [ ] Validation messages show through the form's fields (name required, phone count, website and email shape).
- [ ] Marking primary pins it; marking past moves it behind "Show past".
- [ ] Delete removes it from the list after a confirm, on every device.
- [ ] Offline add and edit sync after reconnecting.
- [ ] As viewer@, no Add, edit or delete controls; `…/providers/new` shows the list with no form.
- [ ] `providers.mjs` covers the above; `routing.mjs` passes.

---

## Slice 4: The provider page and live notes

**User stories:** US 4, 15–17, 38. **Blocked by:** 2. **Blocks:** 5.

### What to build

The `providers/:providerId` page: a header (name, type, specialty, the practice as a link to its page, primary and past badges), every contact action (each phone with its label, email, map, website), and the provider's live notes in `LiveNotesEditor` on its provider document, with `EditorAvatars` for who's editing. The document is created on the first real change, as for a draft entry. Viewers read the notes. A deleted, missing or other group's provider is the 404 with no names. List rows open the page; writers get Edit (the slice 3 sheet, once merged).

### Acceptance criteria

- [ ] Opening a seeded provider shows their details and seeded notes; a clinician's practice links to the practice's page.
- [ ] Two browsers editing the same provider's notes converge, and each sees the other's avatar.
- [ ] Notes edit offline and merge after reconnecting.
- [ ] Viewers see the notes read-only; a deleted provider's URL is a 404.
- [ ] The editor's chunk loads only on this route and the entry route.
- [ ] `providers.mjs` covers the above; `live-notes.mjs` passes.

---

## Slice 5: The With row

**User stories:** US 18–23, 29, 30, 33, 35. **Blocked by:** 3, 4, `components` slices 2, 3 and 4. **Blocks:** 6, 7.

### What to build

A With region in the entry header for notes and events (added empty first if the header has no slot for it). Writers see the linked providers as removable chips and an Add button opening a picker (a combo box over the group's current providers by name, specialty and practice, with "Add "<typed>" as a provider", which creates a clinician with that name and links it in one write). Linking on a draft saves the draft first. Viewers see the chips only. Every chip opens the provider's page; a deleted provider's chip is greyed "(removed)" and not a link. The provider page gets a "Linked entries" list (notes and events, newest first, each opening its entry).

### Acceptance criteria

- [ ] A writer links two providers to an event; both chips show on a second device; removing one removes it everywhere.
- [ ] Two devices linking the same provider offline end up with one link.
- [ ] Typing a new name in the picker adds the provider and links it, without leaving the entry.
- [ ] Linking on a new note's draft saves the note and keeps the editor.
- [ ] The provider page lists the event, newest first; tapping it opens the entry.
- [ ] A deleted provider's chip is greyed; the entry is otherwise unchanged.
- [ ] As viewer@, chips only, no Add or remove.
- [ ] `providers.mjs` and `live-notes.mjs` pass (tap counts unchanged).

---

## Slice 6: Suggestions

**User stories:** US 24–28. **Blocked by:** 5. **Blocks:** none.

### What to build

The pure `suggestProviders({ title, text, providers, history, now, limit: 5 })`, ranking name matches in the title or text, then providers linked to earlier entries with the same normalized title, then recent links (14-day half-life); current, not deleted providers only. Read history locally, so it works offline. While a note or event has no linked providers, writers see up to 5 suggestion chips in the With region; a tap links through the picker's path. Picking a suggested title chip on an unnamed event updates the suggestions.

### Acceptance criteria

- [ ] Titling an event "Dr. <seeded last name> follow-up" suggests that clinician first; a tap links them (one tap after the title).
- [ ] An event titled like an earlier linked one suggests that provider.
- [ ] With nothing else matching, recently linked providers are suggested.
- [ ] Suggestions hide once a provider is linked, and work offline.
- [ ] Unit tests: whole-word matching, ignored honorifics and short tokens, title memory, decay, past and deleted exclusions, the limit.
- [ ] `providers.mjs` covers the above; `live-notes.mjs` passes.

---

## Slice 7: "with …" on the timeline

**User stories:** US 31. **Blocked by:** 5. **Blocks:** none.

### What to build

Timeline rows and cards for notes and events with links show "with <names>" (up to 2 names, then "+N"; a removed provider greyed), from a live query beside the entries, through the shared entry body from `components`. Text only: the row's open target and icons are unchanged.

### Acceptance criteria

- [ ] A seeded event with two linked providers shows both names in rows and cards; one with three shows two and "+1".
- [ ] Linking on another device updates the row without a reload.
- [ ] Infinite scroll and filters behave as before (no extra queries per row).
- [ ] `phase2.mjs`, `roundtrip.mjs` and `providers.mjs` pass.

---

## For the orchestrator

- **Claim:** B-13 for slices 1–4 and B-14 for 5–7. Mark B-13 `done` after slice 4 merges and B-14 after slice 7.
- **Before slices 2, 3 and 5,** check the backlog's PRD table: `routing` slice 1, `routing` slice 2, and `components` slices 2–4 must be in `dev`. Then `pnpm prd sync`.
- **Tell `components`** when slices 2–4 land: its last slice moves the provider screens onto the primitives if they were built before them.
- B-25 (@-mentions) is a follow-up for after slice 5, not this plan.
