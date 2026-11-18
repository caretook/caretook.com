# PRD: Providers (directory, links from events and notes, suggestions)

Status: 🟡 planned in [`providers-plan.md`](providers-plan.md) (7 slices; slice 1 can start now). Backlog items: B-13, B-14. Topic `providers`. The data layer can start now; the directory screens wait for `routing`; only linking (the With row, suggestions, timeline rows) waits for `components`.

## Problem Statement

Caretakers juggle a lot of people and places: the primary care doctor, two or three specialists, the clinic they work at, the pharmacy, a home health aide, the insurer's nurse line. Today that lives in someone's phone contacts or a sheet of paper on the fridge, so the caretaker who isn't the "organized one" can't find the cardiologist's number at 7pm, doesn't know the after-hours line exists, and can't tell which pharmacy the prescriptions go to.

The timeline records visits and calls as events and notes, but they aren't tied to anyone. "Follow-up" on the timeline doesn't say with whom, and there's no way to see every visit with Dr. Patel when preparing for the next one. Typing the same provider into every event's text is tedious, and nobody does it consistently.

## Solution

A **Providers** section in every care group, next to Timeline:

- **A directory** of the group's providers: clinicians, practices and facilities, pharmacies, and other contacts (an aide, a neighbor, the insurer). Each has a name, a specialty or role, the practice a clinician works at, labelled phone numbers, email, address and website, plus shared **live notes** (parking, who to ask for, portal quirks) that everyone in the group edits together, like an entry's text.
- **Find and act fast:** search by name, specialty or practice, filter by type, with **primary** providers pinned on top and **past** providers (no longer seen) at the bottom. One tap to call, email, open the address in maps, or open their website. Works offline.
- **Links from events and notes.** An event or note gets a **With** row: chips for the providers it involved (a call with the clinic and the pharmacy links both). Writers add them through a search picker, and can add a new provider right there without leaving the entry.
- **Suggestions** while writing: while an event or note has no providers, chips suggest them by matching the title or text ("Dr. Patel follow-up" → Dr. Patel), by remembering who was linked to earlier entries with the same title, and from the providers linked most recently.
- **A provider's page** shows their details, their live notes, and every linked event and note, newest first, so preparing for a visit means opening one page.
- Everything syncs and edits offline, like the timeline. Writers (owner, admin, caretaker) add and edit; viewers see everything read-only.

## User Stories

1. As a caretaker, I want a Providers tab in my care group, so that the people and places in my parent's care are in one place.
2. As a caretaker, I want to add a clinician with name, specialty, practice, phones, email, address and website, so that everyone in the group can reach them.
3. As a caretaker, I want to add a practice, facility or pharmacy as its own entry, so that its main number and address aren't copied onto every doctor.
4. As a caretaker, I want to say which practice a clinician works at, so that I can find the clinic's address from the doctor's page.
5. As a caretaker, I want to add other contacts (an aide, a neighbor, the insurer's nurse line), so that every number we need is in one list.
6. As a caretaker, I want several labelled phone numbers per provider (office, fax, after-hours), so that I call the right one.
7. As a caretaker, I want to tap a number to call it, so that I don't retype it.
8. As a caretaker, I want to tap an address to open it in maps, so that I can get directions before a visit.
9. As a caretaker, I want to tap an email or a website link, so that I can reach the patient portal quickly.
10. As a caretaker, I want to search providers by name, specialty or practice, so that "cardio" finds the cardiologist.
11. As a caretaker, I want to filter the list by type, so that I can see just the pharmacies.
12. As a caretaker, I want to mark providers as primary, so that the ones we rely on are pinned on top.
13. As a caretaker, I want to mark a provider as past when we stop seeing them, so that the list stays short but their history is kept.
14. As a caretaker, I want past providers at the bottom (or behind "Show past"), so that I don't call the old pharmacy by mistake.
15. As a caretaker, I want shared live notes on a provider, so that tips like "park on level 2, ask for Maria" are written once for everyone.
16. As two caretakers editing a provider's notes at once, I want our edits to merge, so that neither of us loses text.
17. As a caretaker, I want to see who's editing a provider's notes, so that I know someone else is updating them.
18. As a caretaker writing an event, I want a With row to link the providers involved, so that the event says who it was with.
19. As a caretaker, I want to link several providers to one event, so that a call with the doctor and the pharmacy is recorded once.
20. As a caretaker writing a note, I want the same With row, so that a note about a phone call is tied to whoever I spoke with.
21. As a caretaker, I want to remove a provider from an entry with one tap, so that a wrong link is easy to fix.
22. As a caretaker, I want to find providers in the With picker by typing, so that linking is quick with a long list.
23. As a caretaker, I want to add a new provider from the picker by typing their name, so that I don't leave the event I'm writing.
24. As a caretaker, I want suggested providers when I title an event "Dr. Patel follow-up", so that linking is one tap.
25. As a caretaker, I want picking a title I've used before ("Cardiology visit") to suggest the provider linked last time, so that repeat visits take one tap.
26. As a caretaker, I want recently linked providers suggested when nothing else matches, so that the usual suspects are one tap away.
27. As a caretaker, I want suggestions to disappear once the entry has a provider, so that they don't clutter the header.
28. As a caretaker, I want suggestions to work offline, so that I can log a visit from the waiting room.
29. As a caretaker, I want the provider chips on an event to open the provider's page, so that I can get their number from the event.
30. As a caretaker, I want a provider's page to list every linked event and note, newest first, so that I can review past visits before the next one.
31. As a caretaker, I want the timeline rows and cards to show who an event or note was with, so that I can scan visits at a glance.
32. As a caretaker, I want to delete a provider added by mistake, so that the list stays clean.
33. As a caretaker, I want entries linked to a deleted provider to keep showing the name greyed as removed, so that the timeline's history doesn't change.
34. As a caretaker offline, I want to add, edit and link providers, so that I'm not blocked by signal, and my changes sync when I reconnect.
35. As two caretakers linking providers to one event on two devices, I want both links kept, so that offline edits don't overwrite each other.
36. As a viewer, I want to see the directory, notes and links read-only, so that I can call the doctor without being able to change anything.
37. As a viewer, I want no add, edit, link or delete controls, so that I'm never shown something I can't do.
38. As a non-member, I want provider URLs to be the same 404 with no names, so that nothing about the group leaks.
39. As a member of two groups, I want each group's providers kept separate, so that my mother's and father's doctors don't mix.
40. As a screen reader user, I want the list, filters, chips, picker and call buttons named and announced, so that I can use the directory without sight.
41. As a developer of `medications`, I want providers (prescribers and pharmacies) as a stable table to link to, so that a prescription can say who prescribed it and where it's filled.
42. As a developer of `assistant`, I want provider links on entries queryable in one table, so that "when did we last see the cardiologist?" is one query.

## Implementation Decisions

- **Depends on, by part:**
  - **Data layer** (both tables, the `note_document` change, permissions, services, sync, upload, device schema, seeds): nothing. It can run while `routing` does.
  - **Directory screens** (the section, list, search, contact actions, add and edit, the provider page and its notes): `routing`'s group route, `appUrls` and sheet routes. Built on today's components if `components` hasn't landed its primitives yet; `components`' last slice then moves them onto the primitives.
  - **Linking** (the With row, picker, suggestions, "with …" on rows and cards, a provider's linked entries): `components`' primitives and its timeline and entry page splits, because those are the files it changes.
- **Schema (one migration):**
  - **`provider`:** `id`, `group_id` (FK, cascade), `type` (`clinician` | `practice` | `pharmacy` | `other`, enum check), `name` (required), `specialty` (specialty for clinicians, role for others; optional), `practice_id` (optional; a composite FK `(group_id, practice_id)` → `provider (group_id, id)`, so it stays in the group; the service only accepts a `practice` or `pharmacy` that isn't deleted), `phones` jsonb (`[{ label, number }]`, at most 6, Zod-validated), `email`, `address` (multi-line text), `website`, `status` (`current` | `past`), `primary` (boolean, any number), `deleted_at`, plus `timestamps` and `audits`. A unique `(group_id, id)` for composite FKs. An index on `(group_id, name)`.
  - **`timeline_entry_provider`** (the link table): `id`, `group_id`, `entry_id` (composite FK → `timeline_entry (group_id, id)`, cascade), `provider_id` (composite FK → `provider (group_id, id)`, cascade), `timestamps`, `audits`, unique `(entry_id, provider_id)`. **The id is derived from the pair** (a UUID v5 of entry and provider ids), so two devices linking the same provider offline write the same row and the upload is idempotent. Unlinking is a hard delete; relinking writes the same id again. Only notes and events can be linked (checked by the service and the device).
  - **`note_document` is generalized** to own a document for an entry or a provider. It gets a `subject` (`entry` | `provider`) and two nullable owner columns, `entry_id` and `provider_id`, each with a cascading composite FK (`(group_id, entry_id)` → `timeline_entry`, `(group_id, provider_id)` → `provider`). A check requires exactly one to be set and equal to `id`, so a document's id is still its owner's id. The old entry FK is replaced. **No data migration:** there's no real data yet, so the schema changes and dev databases are reseeded (`pnpm datastore:reset`); seeds write `subject` and `entry_id`. `note_update` is unchanged (it hangs off the document). `noteDocumentService.create` accepts a live note or event, or a provider that isn't deleted. Compaction, editors, `currentText` and the editor work unchanged.
- **Permissions:** `provider` and `timeline_entry_provider`: read and list for any member; create, update and delete for writers (provider delete is soft). Provider documents follow `note_document`'s rules (writers create; system compacts). Ids pointing at the group are immutable except by `system`.
- **Services:** `providerService` (create, update, soft remove, practice rules, phones validation), `entryProviderService` (link: entry is a live note or event, provider isn't deleted, same group; unlink). Both go through the base models' RBAC.
- **Sync:** both tables join the `care_groups` stream (explicit column lists, soft-deleted providers included so deletes reach devices) and the `powersync` publication. `note_document`'s query adds `subject`, `entry_id` and `provider_id`. The upload switch adds `provider` (PUT → upsert, PATCH → update or soft remove when it sets `deleted_at`, DELETE → remove; changing `group_id` is `immutable`) and `timeline_entry_provider` (PUT → link, DELETE → unlink; PATCH is `sync:readOnlyTable`). All additions append to their registries.
- **Device:** device schema entries for both tables and the new document columns; local queries (list with search and filters, one provider, its linked entries, an entry's providers, link history for suggestions) and local writes that validate with the shared Zod schemas and check the role, as `timeline.ts` does. Creating a provider from the picker writes the provider and the link in one local transaction.
- **Routes** (children of the group route, through `appUrls`):
  - `providers`: the list. Search `?q=`, type `?type=`, and past behind `?past=1`. Order: primary, then current by name, then past.
  - `providers/new` (optional `?type=`) and `providers/:providerId/edit`: sheet routes over the list or the provider page (the `routing` sheet pattern).
  - `providers/:providerId`: the provider page: header (name, type, specialty, practice link, primary and past badges), contact actions, live notes (`LiveNotesEditor`), and linked entries. A deleted or other group's provider is a 404 with no names.
- **Group section:** one `GROUP_SECTIONS` entry, Providers (lucide `Stethoscope`), appended after Timeline. `match` claims `/providers/*`.
- **Entry page:** the entry header gets a **With** region (a "regions first" change: the region lands empty in the first slice that touches the header). Writers see linked providers as removable chips, an Add button opening the picker (a combo box over local providers, current first, with "Add "<typed>" as a provider"), and suggestion chips while nothing is linked. Viewers see the chips only (each opens the provider page). Drafts: linking on a draft materializes it first, like a title.
- **Suggestions** (a pure module, like `suggestTitles`): `suggestProviders({ title, text, providers, history, now, limit: 5 })` ranks (1) name matches in the title or document text (case-insensitive whole words; a clinician's last name or full name, a practice's or pharmacy's name; tokens under 3 characters and honorifics such as "Dr" are ignored), (2) providers linked to earlier entries with the same normalized title, (3) recently linked providers with a 14-day half-life. Only current, not deleted providers. A tap links through the same path as the picker.
- **Timeline rows and cards** show "with <names>" for notes and events with links (up to 2 names, then "+N"), read from a live query alongside the entries.
- **Contact actions** (a pure module): `tel:` from a number (digits and a leading `+` kept), `mailto:`, a maps search URL for the address, and websites normalized to `https://` when no scheme is given. Shown as a row of icon buttons with accessible names ("Call Dr. Patel, office").
- **Seeds** (their own file, append-only): fictional providers for Dev Family (a primary care clinician and her practice, a cardiologist, a pharmacy, a home health aide, one past provider), a few provider notes, and links to some existing seeded events and notes by id. Dev Family 2 gets one provider, to check group separation.
- **Hot files:** `sync-config.yaml`, the upload switch, `PERMISSIONS`, `db/schema/index.ts`, the device schema, `GROUP_SECTIONS`, `routes.ts`, the entry header, the timeline row and card body, and `note_document` (migration). Keep one pending migration for the PRD.

## Testing Decisions

- A good test checks what a caller or user sees (a returned row or error, a rendered list, a link that works), never internals.
- **Integration (`*.int.test.ts`):** `providerService` (every role × create, update, delete; practice must be a practice or pharmacy in the same group and not deleted; phones limits; soft delete hides from lists), `entryProviderService` (only notes and events; same group; deleted provider refused; the same pair twice is idempotent; cross-group ids are unauthorized), the generalized `noteDocumentService` (a provider document is created, compacted and cascades with its provider; an entry document still works exactly as before), and the upload switch for both tables. Prior art: `careGroup.int.test.ts`, the timeline and note document integration tests, `packages/data/test/fixtures.ts`.
- **Unit (`web:unit` and `data:unit`):** `suggestProviders` (matching rules, title memory, decay, exclusions, limit), the contact actions, the pair-derived link id, list ordering and search matching, and the Zod schemas (phones, website, type rules). Prior art: `titleSuggestions.test.ts`, `liveNow.test.ts`, `timelineEntry.test.ts`.
- **Seeds:** a test validates every provider seed and link against the schemas, as `timelineEntries.test.ts` does.
- **Browser check `providers.mjs`:** add a clinician with two phones and a practice; search and filter; mark primary and past; tap to call (the `href`); provider live notes merge between two browsers; link two providers to an event, from the picker and from a title suggestion; add a provider inline from the picker; the provider page lists the event; offline add and link sync after reconnect; viewer read-only; a non-member 404; delete a linked provider and see it greyed on the event. Order-independent and self-cleaning, like the other checks. `live-notes.mjs` and `phase2.mjs` must pass unchanged apart from the new With row and row text.

## Out of Scope

- @-mentions inside the document text (they'd need new Tiptap dependencies; the With row covers linking). Filed for later as its own backlog item.
- Sharing one provider across care groups, or a personal (account-wide) directory.
- Importing from phone contacts, vCard export, or lookups in external directories (NPI, pharmacy finders).
- Appointments and scheduling (a richer event kind with time, place and provider), and calendar sync.
- Structured insurance details, portal credentials, or anything that stores passwords.
- Linking symptoms or vitals to providers.
- Prescriber and pharmacy links on medications (the `medications` PRD adds them on top of this table).
- Full-text search across providers and entries (the `search` PRD).

## Further Notes

- Source: the inbox lines "Add in providers directory with search and linking to event entries in timeline" (B-13) and "Add provider linking/suggestions to event entries in timeline and live notes" (B-14).
- Interview decisions (2026-11-18): one table with a type (clinician, practice, pharmacy, other) and a clinician → practice link; a link table for entry ↔ provider (a meeting can include several providers); events and notes both link; all three kinds of suggestions; the section is called Providers; core contact fields, live notes, past status, and a primary flag (any number); synced with offline writes, like the timeline; tap to call, email and map, search and filter, a provider's timeline, and adding from an event; provider notes by generalizing `note_document`; delete is soft and linked entries show the name greyed.
- Health-data rules apply: providers are care data (synced only to members, never to staff by default, never in notification subjects).
