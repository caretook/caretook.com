# Plan: Translations (i18n)

> Source PRD: [`plans/i18n-prd.md`](i18n-prd.md). User-story numbers (US) refer to it. Backlog item B-209 (multiple languages for all text). Topic `i18n`.

## Status

| Slice | Wave | State       | Merge into `prd/i18n` (slice commits) |
| ----- | ---- | ----------- | ------------------------------------- |
| 1     | 1    | not started |                                       |
| 2     | 2    | not started |                                       |
| 3     | 3    | not started |                                       |
| 4     | 3    | not started |                                       |
| 5     | 3    | not started |                                       |
| 6     | 3    | not started |                                       |
| 7     | 4    | not started |                                       |
| 8     | 4    | not started |                                       |
| 9     | 4    | not started |                                       |
| 10    | 4    | not started |                                       |
| 11    | 5    | not started |                                       |

**Start conditions:** `list-filters` (last item B-249), `planner-2` (last item B-248), the current `quick-fixes` wave and `simple-mode` (last item B-221; it renames every `simple*` file to `easy*`) are in `dev`. This PRD sweeps every user-facing file, so it **runs alone**: beside it only tooling-only work, and `quick-fixes` slices that the orchestrator checks against the wave's folders first.

**Landing:** slice 8 adds a migration (one nullable column on the invite). Three new dependencies, approved by the user on 2026-11-21: `i18next`, `react-i18next`, `eslint-plugin-i18next` (dev). The landing mode (ask, run through, or chosen waves) is the orchestrator's first question unless the PRD was queued; record it here. Landing wave by wave is encouraged: every wave leaves English unchanged and Spanish more complete, and a long-lived branch over every file invites conflicts. Never `--suite` without asking.

**Backlog:** claim B-209 when slice 1 starts; `done B-209` after the last slice merges. Slice 11 files the follow-ups.

Fold into the area docs at landing:

- **Slice 1:** a new area doc `docs/domain/i18n.md` and its _Area index_ entry (Platform); the stack line in the core (`i18next`, `react-i18next` with their pins); the language picker in [app-shell](../docs/domain/app-shell.md); the cookie in [auth](../docs/domain/auth.md).
- **Slice 2:** "all user-facing text is a catalog key; format through the central helpers" in [components](../docs/domain/components.md) and the i18n doc.
- **Slices 3 to 7:** nothing lasting beyond the i18n doc, except quick entry's plain box in [assistant](../docs/domain/assistant.md) (slice 4).
- **Slice 8:** the recipient-language rule and the invite's language in [notifications](../docs/domain/notifications.md) and [care-groups](../docs/domain/care-groups.md).
- **Slice 9:** the member's-language rule and the re-push in [calendars](../docs/domain/calendars.md).
- **Slice 10:** the `/es/` pages, `hreflang` and the governing-language notice in [marketing](../docs/domain/marketing.md).
- **Slice 11:** the guard, the pseudo-language and the review list in the i18n doc; a working rule in the core only if every session needs it ("no literal user-facing text; add the key in both languages").

## Architectural decisions

- **Languages:** `en` (source, fallback) and `es` (neutral Latin American, "tú"). One client-safe list in `@caretook/data`'s schema; nothing else names a language.
- **The choice:** `language` in `user.preferences` (optional; no migration). `resolveLanguage({ preference, cookie, browserLanguages })` is pure: preference, then cookie, then browser list, then `en`; regional variants map to their base; unsupported values are ignored.
- **The cookie** `caretook:lang` (not HttpOnly, one year, `SameSite=Lax`, a language code only) lets the server render in the right language and signed-out pages remember it. Saving the preference and signing in set it. The device also keeps the last choice locally (the offline and native start).
- **Instances:** one i18next instance per server request, one on the device; never a shared mutable server instance. `<html lang>` follows it. Missing keys fall back to English; in development and tests a missing key throws.
- **Catalogs** are TypeScript modules in a workspace location both the web app and the server packages import (decided in slice 1; client-safe). One namespace per area, plus `common`, `errors`, `emails`, `marketing`. English is the source and types the keys (module augmentation, no codegen); each Spanish namespace is typed against the English one, so a missing or extra key fails `typecheck`.
- **Message format:** i18next v4 JSON (`_one`, `_other`, `_many`; `{{name}}`). `Trans` for sentences with links or emphasis. One key per whole sentence: no concatenating translated fragments, no `n === 1 ? … : …`.
- **Keys** are named by meaning, not by English text (`medications.list.empty`, not `noMedicationsYet`), and never reused across unrelated screens; shared words live in `common`.
- **Loading:** English is bundled. Spanish is one lazy chunk per namespace group, precached by the service worker once Spanish is chosen, and never in the entry, root or app budget groups. The server holds every language.
- **Formatting:** dates, times, numbers, lists and relative times only through the central format helpers, which take the active language. Machine formats (ISO days, the `en-CA` day trick, iCal fields) stay and are named as machine formats. Zones and units are untouched.
- **Server text:** services keep codes and English messages; the client translates by code through `errors` and falls back to the server's message. Zod messages shown to users are keys resolved at display. Emails and calendar text are rendered in the recipient's or member's saved language, else English.
- **Tests stay English:** the test defaults pin `en`, `en-US` and Los Angeles. A slice doesn't edit a test's expected English text; if it must, the hand-off says why.
- **Not translated:** `/admin`, the connector (MCP text, consent text), seeds, dev routes, logs, audits, user-written content. Quick entry's parser and search's matching stay English.
- **Spanish drafts:** written by the loop from the English catalog and the glossary (slice 1). Each Spanish namespace carries a review marker (`reviewed: false`); medical and legal entries are listed for a qualified reviewer in slice 11.
- **The glossary** (beside the catalogs): care group, care recipient, helper, owner, viewer, todo, dose, pass, care period, timeline, entry, note, event, provider, Planner, and the voice rules. Every sweep slice reads it and may append, never redefine.

## How to run this plan

- **Wave 1: slice 1** (the machinery, end to end, proven on the sign-in pages).
- **Wave 2: slice 2** (the shared pieces every sweep needs).
- **Wave 3: slices 3, 4, 5, 6** together (app frame and groups; timeline; medications; the Planner side).
- **Wave 4: slices 7, 8, 9, 10** together (the rest of the app; emails and invites; calendar text; the public site). Slices 8, 9 and 10 depend only on slice 2 and may join wave 3 if the orchestrator has room.
- **Wave 5: slice 11** (close out).
- **Ownership:** a sweep slice owns its route folders, its `components/<area>/` and `lib/<area>/` folders, and its own namespaces (English and Spanish). It adds to `common` only through slice 2's file by appending keys at the end of its own region (slice 2 lays out one region per sweep slice). Shared `ui/` and the format helpers are slice 2's; a sweep slice that finds English left in them reports it instead of editing.
- **The lint rule** is installed in slice 1 and switched on folder by folder: each sweep slice turns it on (as an error) for the folders it owns once they're clean. Slice 11 turns it on for everything left.
- **Stacks:** slice 1 needs a stack (server rendering, the cookie, a browser check). The rest are stackless.
- **Checks:** every slice runs `pnpm check` and `pnpm test:components --changed prd/i18n`, and `pnpm prd browser --changed` once before hand-off, reporting what it named. The sweep changes no English, so a failing existing test is a regression to fix, not a test to update.
- **Sync:** `pnpm prd sync` at every wave boundary. Anything that lands in `dev` during the run arrives with new hardcoded English; the wave's owner of that folder extracts it, and slice 11 catches the rest.
- Every slice ends with a hand-off ([loop](../docs/agents/loop.md)), plus a _Docs_ section listing what the orchestrator should fold into the area docs, and a _Review_ list of Spanish entries the loop was unsure of.

---

## Slice 1: The machinery, end to end

Stack: yes · Reads: docs/domain/components.md, docs/domain/app-shell.md, docs/domain/auth.md, docs/domain/security-headers.md, docs/layout.md · Tests: unit, component, e2e:sign-in

**User stories:** 2–8, 22, 45, 46, 52, 53.

### What to build

Add `i18next` and `react-i18next` (and `eslint-plugin-i18next` as a dev dependency), each pinned exactly at the newest release at least a day old. If the lint plugin doesn't work with ESLint 10's flat config, write a small local rule with the same job and don't add the plugin; say which in the hand-off.

The language core in the data package's schema: the supported list, the `language` preference field with its resolver, and `resolveLanguage`. The catalog package or folder, its typing (English types the keys; Spanish is checked against English), the `common` namespace's skeleton with one region per sweep slice, and the glossary.

The wiring: an instance per request on the server, reading the cookie and `Accept-Language`; one on the device, reading the saved preference, the local copy and `navigator.languages`; `<html lang>`; the provider at the root for both build targets; lazy Spanish chunks and their service-worker caching; the missing-key rule (fallback in production, throw in development and tests); the test setup pinning English.

The language picker: in Settings beside units (saves the preference, sets the cookie and the local copy, applies at once) and on the sign-in and sign-up pages (cookie and local copy only). Translate the sign-in, sign-up and sign-out pages fully, English and Spanish, as the proof.

Install the lint rule with every folder off except the sign-in routes. Record the bundle sizes before and after and raise the budget only by the libraries' cost.

### Acceptance criteria

- [ ] Unit tests for `resolveLanguage`: preference wins; cookie next; the browser list in order; `es-MX` gives `es`; unsupported and malformed values are skipped; nothing gives `en`.
- [ ] A type-level proof: a Spanish namespace missing a key, or with an extra one, fails `typecheck` (shown once in the hand-off, not committed).
- [ ] A catalog parity unit test: every Spanish entry has the same interpolation placeholders as English and the plural forms Spanish needs.
- [ ] Component tests: the Settings picker saves and the page switches without a reload; the sign-in page renders in Spanish with the cookie set; a missing key throws in tests.
- [ ] `e2e:sign-in` gains one step: with a Spanish `Accept-Language` and no cookie, the server-rendered sign-in page is Spanish with `<html lang="es">`; choosing English sets the cookie and survives a reload.
- [ ] The native build starts in the locally saved language with no server (a unit or component test of the device resolver's inputs is enough).
- [ ] The CSP is unchanged or its change is explained ([security-headers](../docs/domain/security-headers.md)).
- [ ] `pnpm build:budget` passes; Spanish chunks are outside the entry, root and app groups; the hand-off gives the before and after sizes.
- [ ] Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** the start conditions. **Blocks:** every other slice.

---

## Slice 2: The shared pieces

Stack: no · Reads: docs/domain/components.md, docs/domain/data-layer.md, docs/domain/api.md, docs/domain/i18n.md · Tests: unit, component

**User stories:** 10–24, 49.

### What to build

The format helpers take the active language (dates, times, zoned times, relative times, day labels, lists, numbers), with one way for screens to get them already bound to it. Replace hardcoded English locales in the helpers themselves and in shared code; leave and name the machine formats.

The `errors` namespace and the lookup by code with the server-message fallback, used wherever the client shows a service error. Spanish entries for the codes a user can see (those thrown by procedures reachable from the app's screens); list the ones left to fall back.

Validation: Zod messages that reach users become keys, resolved by the shared form helpers at display. Schemas stay client-safe and language-free.

The label maps (roles and descriptions, medication type, form, status, stop reason and field labels, vitals, entry kinds, search result kinds, conditions, repeat choices) return keys or take a translate function; collapse the duplicated role label maps into one (the staff area keeps reading English through it).

The shared `ui/` components and the `common` namespace: every literal in `components/ui/` (default labels, `aria-label`s, the confirm dialog's buttons, toasts, undo) in both languages. Turn the lint rule on for `components/ui/`.

### Acceptance criteria

- [ ] Unit tests for each format helper in `en` and `es` at the pinned zone: a day, a time, a relative time on both sides of now, a list of one, two and three, a decimal number.
- [ ] Unit tests for the error lookup: a known code in Spanish; an unknown code gives the server's message; a 500 gives the generic message in the user's language.
- [ ] Unit tests for the label maps: every value of each enum has an entry in both languages (driven from the enum, so a new value fails).
- [ ] A component test: a form's validation error renders in Spanish when the language is Spanish, in English otherwise.
- [ ] No `n === 1 ? … : …` plural or sentence concatenation remains in shared code.
- [ ] Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** slice 1. **Blocks:** slices 3–11.

---

## Slice 3: The app frame and groups

Stack: no · Reads: docs/domain/components.md, docs/domain/app-shell.md, docs/domain/care-groups.md, docs/domain/i18n.md · Tests: component

**User stories:** 1, 9, 18, 21–24, 48.

### What to build

Extract every user-facing string, in both languages, from: the `/app` layout and its navigation, the update notice, the group switcher, account and device settings, the theme and units pages, the account routes, care group creation and settings (Details, Members, roles and their descriptions), the invite and access-code screens (not the invite email or the invite's language field: slice 8). Route `meta` titles included. Replace ad hoc date and plural code in these folders with slice 2's helpers. Turn the lint rule on for these folders.

### Acceptance criteria

- [ ] The lint rule is on, as an error, for every folder this slice owns, with no disables beyond justified ones listed in the hand-off.
- [ ] No hardcoded locale or hand-rolled plural remains in these folders.
- [ ] A component test renders the Members page in Spanish: role names, descriptions and the page title are Spanish.
- [ ] Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** slice 2. **Blocks:** slice 11.

---

## Slice 4: The timeline

Stack: no · Reads: docs/domain/components.md, docs/domain/timeline.md, docs/domain/live-notes.md, docs/domain/assistant.md, docs/domain/i18n.md · Tests: unit, component

**User stories:** 1, 10–14, 20, 23–28, 48.

### What to build

Extract every user-facing string, in both languages, from: the timeline route and its Today card, day headers and summaries, rows and cards, filters and the view menu, the easy (formerly simple) timeline, entry pages and forms for every kind (notes, events, symptoms, vitals, doses, passes), the live-note editor's chrome, print views of entries, and quick entry's own interface. Replace ad hoc date and plural code with slice 2's helpers. Turn the lint rule on for these folders.

Quick entry's plain box: one switch read from the language. When it isn't English, typed text is saved as a plain note and the box shows no suggestions, preview cards, kind chips, prefix hints or parser-driven affordances; its placeholder and help say so plainly. English is unchanged. The parser, vocabulary and time grammar are not touched.

### Acceptance criteria

- [ ] The lint rule is on, as an error, for every folder this slice owns.
- [ ] A unit test for the switch: `en` keeps the parser; `es` gives the plain mode.
- [ ] A component test: in Spanish, typing "fell at 3pm" and saving makes one note with that text and shows no preview card or suggestion; in English the existing quick entry tests pass unchanged.
- [ ] A component test renders the timeline in Spanish: the day header, a relative time, a count ("2 …") and an entry kind are Spanish.
- [ ] Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** slice 2. **Blocks:** slice 11.

---

## Slice 5: Medications

Stack: no · Reads: docs/domain/components.md, docs/domain/medications.md, docs/domain/i18n.md · Tests: component

**User stories:** 1, 12, 14, 15, 19, 25, 48.

### What to build

Extract every user-facing string, in both languages, from the medications area: the Schedule and Medications tabs, the list and its filters, a medication's page and form, log a dose and its quick add, passes, the strip and status text, history, and the print views. Replace ad hoc date and plural code with slice 2's helpers. Units stay the user's choice. Turn the lint rule on for these folders. List every medical term's Spanish entry in the hand-off's _Review_ section.

### Acceptance criteria

- [ ] The lint rule is on, as an error, for every folder this slice owns.
- [ ] A component test renders the medications list in Spanish: type, form and status labels and a plural count are Spanish; a dose amount keeps the user's units.
- [ ] Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** slice 2. **Blocks:** slice 11.

---

## Slice 6: The Planner side

Stack: no · Reads: docs/domain/components.md, docs/domain/providers.md, docs/domain/appointments.md, docs/domain/todos.md, docs/domain/care-periods.md, docs/domain/i18n.md · Tests: component

**User stories:** 1, 10–13, 23, 24, 48.

### What to build

Extract every user-facing string, in both languages, from: the providers directory, a provider's page, forms, import and mention sheets; appointments and series (the repeat choices' sentences, "every 2 weeks on Monday", as whole-sentence keys with plurals, not fragments); the Planner and its filters; todos (list, page, form, repeat, undo); care periods. Replace ad hoc date and plural code with slice 2's helpers. Turn the lint rule on for these folders.

### Acceptance criteria

- [ ] The lint rule is on, as an error, for every folder this slice owns.
- [ ] Unit tests for the repeat sentences in both languages: daily, weekly on several days, every n weeks, monthly on a date, monthly on the last weekday.
- [ ] A component test renders the Planner in Spanish: a day heading, a repeat line and the todo undo message are Spanish.
- [ ] Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** slice 2. **Blocks:** slice 11.

---

## Slice 7: The rest of the app

Stack: no · Reads: docs/domain/components.md, docs/domain/profiles.md, docs/domain/search.md, docs/domain/connectors.md, docs/domain/calendars.md, docs/domain/i18n.md · Tests: component

**User stories:** 1, 21–25, 29, 48, 51.

### What to build

Extract every user-facing string, in both languages, from what the earlier sweeps don't own: profiles and the emergency list (its "A and B" joins and count-dependent verbs become list formatting and plural keys), conditions, the search screen and result kinds (matching unchanged), the Calendar & reminders settings page and its cards, the in-app assistant settings and connection guide (the app's own screens; the connector's MCP text and the versioned consent text's English wording are not touched, the consent's Spanish rendering is added and listed for legal review), and any remaining `/app` route. Turn the lint rule on for these folders.

### Acceptance criteria

- [ ] The lint rule is on, as an error, for every folder this slice owns; after this slice no `/app` route folder has it off.
- [ ] Unit tests for the emergency list's sentences in both languages (one, two and three names; singular and plural verbs).
- [ ] A component test renders search in Spanish with an English-stemmed match still found.
- [ ] The connector's tool text and tests are unchanged.
- [ ] Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** slice 2. **Blocks:** slice 11.

---

## Slice 8: Emails and invites

Stack: no · Reads: docs/domain/notifications.md, docs/domain/care-groups.md, docs/domain/auth.md, docs/domain/data-layer.md, docs/domain/i18n.md · Tests: unit, integration, component

**User stories:** 30–35.

### What to build

The notification registry's `email` function receives the recipient's language in its context (their saved preference, else English; for a signed-out auth email, the request's resolved language). Every template's subject and body come from the `emails` namespace in both languages; the layout's `lang` follows. Dates in emails go through the format helpers in the recipient's language and zone rule as today.

The invite's language: adds a migration (one nullable column on the invite). The invite form gains a language choice defaulting to the inviter's language; the service stores it; the invite email uses it; accepting as a new user sets it as their starting preference; an existing user's preference is never changed. RBAC is unchanged (who may invite).

### Acceptance criteria

- [ ] Integration tests: for each notification, a recipient with `es` gets a Spanish subject and body, one with no preference gets English; a sign-in link requested from a Spanish page is Spanish.
- [ ] Integration tests: an invite made with `es` sends a Spanish email; a new user accepting it starts with `es`; an existing user with `en` accepting it keeps `en`; an invite with no language behaves as before.
- [ ] A component test: the invite form's language choice defaults to the inviter's language and is sent.
- [ ] The migration is additive and passes `check-migration`.
- [ ] All data in tests is fictional. Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** slice 2. **Blocks:** slice 11.

---

## Slice 9: Calendar text

Stack: no · Reads: docs/domain/calendars.md, docs/domain/notifications.md, docs/domain/i18n.md · Tests: unit, integration

**User stories:** 36, 37.

### What to build

`calendarText` takes the member's language: the feed, Google Calendar events and the reminder wording are written in it, at the member's share level as today. Its dates go through the format helpers. Changing the language preference queues a push for each of that member's live Google connections (the existing job, a new or reused reason). The feed needs nothing queued: it renders on request. Reminder emails' templates are slice 8's; this slice owns the wording they take from `calendarText`.

### Acceptance criteria

- [ ] Unit tests for `calendarText` in both languages at each share level.
- [ ] A Spanish golden `.ics` beside the English ones; the English goldens are unchanged.
- [ ] Integration tests: a member with `es` gets a Spanish feed; changing language queues one push per live connection and none for a member without Google; the fake Google client then holds Spanish event text.
- [ ] Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** slice 2. **Blocks:** slice 11.

---

## Slice 10: The public site

Stack: no · Reads: docs/domain/marketing.md, docs/domain/components.md, docs/domain/security-headers.md, docs/domain/i18n.md · Tests: unit, component

**User stories:** 38–42.

### What to build

Spanish versions of every public page under `/es/`, from a Spanish content module of the same typed shape as each page's English one (a missing section fails `typecheck`). English addresses don't change. `hreflang` alternates (`en`, `es`, `x-default`), a per-language canonical, `og:locale`, and both languages in the sitemap. A language switcher in the public frame linking to the same page in the other language and setting the cookie; no redirect by browser language. The privacy policy, terms and health-data privacy pages carry a notice at the top of the Spanish version that the English version governs, linking to it. The contact form's labels, validation and confirmation in both languages. Turn the lint rule on for the marketing routes. List the three legal pages in the hand-off's _Review_ section.

### Acceptance criteria

- [ ] Unit tests: every page in the page list has both languages; each page's meta has the three alternates and its own canonical; the sitemap lists both.
- [ ] Component tests: `/es/` renders Spanish with `lang="es"`; the switcher on a page links to the same page in the other language; each Spanish legal page shows the governing-language notice; the Spanish contact form shows a Spanish validation error.
- [ ] `/` for a Spanish browser with no cookie is still English (no redirect).
- [ ] The lint rule is on, as an error, for the marketing routes.
- [ ] Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** slice 2. **Blocks:** slice 11.

---

## Slice 11: Close out

Stack: no · Reads: docs/domain/components.md, docs/domain/i18n.md, docs/agents/loop.md · Tests: unit, component

**User stories:** 43–47, 50, 52, 53.

### What to build

Turn the lint rule on, as an error, for every remaining folder, with the standing exemptions written into the config: the staff area, tests, seeds, dev routes. Extract whatever it finds (including English that landed in `dev` during the run).

The pseudo-language: generated from the English catalog at test time (accented, about a third longer, never shipped), with a test helper to render in it, and component tests that render the timeline, the medications list, Settings and sign-in in it and fail on any plain-English text that isn't user data.

The review list, in the i18n area doc or beside the catalogs: every Spanish namespace with its marker; the medical entries and the legal texts (the three legal pages, the consent renderings) called out for a qualified reviewer. Gather the slices' _Review_ sections into it.

Final bundle budget numbers. File the follow-ups through `pnpm backlog`: Spanish quick entry (vocabulary and time grammar), language-aware search matching, the connector's text and answering language, a human review of the Spanish before launch.

### Acceptance criteria

- [ ] The lint config has no folder switched off except the named exemptions; `pnpm lint` passes.
- [ ] The pseudo-language tests pass on the four screens.
- [ ] A unit test: no Spanish namespace is missing its review marker.
- [ ] A grep in the hand-off shows no hardcoded `"en-US"`-style locale outside machine formats, tests, seeds, the staff area and the connector.
- [ ] `pnpm build:budget` passes; the hand-off gives the final sizes against slice 1's.
- [ ] The staff area and the connector behave and test as before.
- [ ] The follow-up items are filed and named in the hand-off.
- [ ] Every existing test passes with its expected text unchanged. `pnpm check` passes.

**Blocked by:** slices 3–10. **Blocks:** none.
