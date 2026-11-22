# PRD: Translations (i18n)

Backlog: B-209 (multiple languages for all text). Interviewed 2026-11-21.

## Problem Statement

Caretook is English only. Every label, message, error, email and public page is hardcoded English, dates are formatted with fixed English locales in many places, and there is no way to choose a language. Many caretakers and the people who help them (family, paid helpers) are more comfortable in another language, Spanish above all in the US. A care group often mixes people who read different languages, so one person's language can't decide it for the rest.

## Solution

Every user picks their own language. It is a setting on the account that follows them across devices, starts from the browser's language, and decides the language of the app, the emails they receive, and their calendar feed and Google Calendar events. Two languages ship: English and Spanish (neutral Latin American, informal "tú"), with Spanish drafted by AI and flagged for a human review before launch. The public site is available in Spanish at `/es/…`. Adding a third language later means adding catalogs, not changing code.

What people write (notes, names, medication names) is never translated. Quick entry's understanding of typed text and search's word matching stay English; a Spanish-language user gets a plain quick entry box instead of one that half-works.

## User Stories

1. As a Spanish-speaking caretaker, I want the whole app in Spanish, so that I can use it without guessing at labels.
2. As a new visitor whose browser is set to Spanish, I want the sign-in and sign-up pages in Spanish straight away, so that I don't have to find a setting first.
3. As a user, I want to choose my language in Settings, so that I can override what my browser says.
4. As a user, I want to change language from the sign-in page, so that I can read it before I have an account.
5. As a user, I want my language to follow me to my other devices, so that I set it once.
6. As a user, I want the app to switch language without signing out, so that changing it is quick.
7. As a user who is offline, I want the app to stay in my language, so that losing the connection doesn't flip it to English.
8. As a user of the native app, I want it to open in my language with no server round trip, so that it works from a cold, offline start.
9. As a member of a mixed-language care group, I want to see the app in my language while others see theirs, so that nobody is forced into a language they don't read.
10. As a user, I want dates, times, weekdays and months in my language's conventions, so that "Tuesday, March 3" reads naturally.
11. As a user, I want relative times ("2 hours ago", "tomorrow") in my language, so that the timeline reads naturally.
12. As a user, I want counts to read correctly ("1 medicamento", "2 medicamentos"), so that the text isn't broken grammar.
13. As a user, I want lists ("A, B and C") joined the way my language does it, so that sentences read correctly.
14. As a user, I want numbers and vitals formatted for my language, so that decimals and separators look right.
15. As a user, I want my chosen units (°F, lb, mg/dL) to stay what I chose, so that changing language doesn't change my measurements.
16. As a user, I want form errors ("Enter a name") in my language, so that I know what to fix.
17. As a user, I want errors that come back from the server in my language, so that a refused action is understandable.
18. As a user, I want role names and their descriptions in my language, so that I understand what an invite gives someone.
19. As a user, I want medication types, forms, statuses and stop reasons in my language, so that the medications list is readable.
20. As a user, I want vitals names and entry kinds in my language, so that the timeline and its menus are readable.
21. As a user, I want page titles (the browser tab) in my language, so that tabs and history are readable.
22. As a screen reader user, I want labels and the page's language attribute to match my language, so that it is pronounced correctly.
23. As a user, I want confirmation dialogs, toasts and undo messages in my language, so that I know what just happened.
24. As a user, I want empty states and hints in my language, so that I know what to do next.
25. As a user, I want the print views in my language, so that what I hand a doctor's office matches what I see.
26. As a Spanish-language user, I want quick entry to simply save what I type as a note, so that it doesn't misread Spanish as English commands.
27. As a Spanish-language user, I want no English-only suggestions or hints under quick entry, so that nothing looks half-translated.
28. As an English-language user, I want quick entry to work exactly as it does today, so that nothing regresses.
29. As a user, I want search screens in my language, so that I can use search even though matching is unchanged.
30. As a member, I want reminder emails in my language, so that I understand them at a glance.
31. As a member, I want every other email (notices, sign-in links, account emails) in my language, so that none of them looks like it came from somewhere else.
32. As an owner inviting a Spanish-speaking helper, I want to pick the invite's language, so that the helper can read it.
33. As an inviter, I want the invite's language to default to mine, so that the common case needs no extra step.
34. As an invited person, I want my new account to start in the invite's language, so that the app matches the email I just read.
35. As an invited person, I want to change that language later, so that the inviter's guess isn't permanent.
36. As a member, I want my calendar feed's wording in my language, so that my calendar app shows events I can read.
37. As a member with Google Calendar connected, I want event wording in my language, and updated when I change it, so that my calendar stays consistent.
38. As a visitor, I want the public site in Spanish at its own addresses, so that I can read about Caretook and share a Spanish link.
39. As a visitor, I want a language switcher on the public site, so that I can move between the English and Spanish version of the same page.
40. As a visitor arriving from a search engine, I want to land on the page in the language I searched in, so that I don't bounce.
41. As a visitor reading the Spanish privacy policy or terms, I want to be told the English version is the binding one, so that I know which text governs.
42. As a visitor, I want the contact form and its errors in Spanish on the Spanish site, so that I can write to Caretook.
43. As the product owner, I want every AI-drafted Spanish text marked as awaiting review, so that I know what a native speaker still has to check before launch.
44. As the product owner, I want medical and legal wording called out for review separately, so that the riskiest text gets the closest look.
45. As the product owner, I want to add a third language by adding catalogs only, so that the next language is cheap.
46. As a developer or agent, I want a missing Spanish key to fail the type check, so that an untranslated string can't ship unnoticed.
47. As a developer or agent, I want a lint rule to refuse hardcoded text in screens, so that English doesn't creep back in.
48. As a developer or agent, I want existing tests to keep matching English text, so that the sweep can be verified by the tests already there.
49. As a developer or agent, I want one place to format dates and numbers, so that no screen invents its own locale.
50. As a staff member, I want the staff area to keep working in English, so that support work is unaffected.
51. As a user of a connected assistant, I want the connector to keep working as it does today, so that this change doesn't disturb it.
52. As a user, I want anything not yet translated to fall back to English rather than show a key, so that a gap is never gibberish.
53. As the product owner, I want the first-load size to stay inside the bundle budget, so that translations don't slow the app for English users.

## Implementation Decisions

**Languages and the choice**

- Supported languages: `en` (the source and fallback) and `es` (neutral Latin American, "tú"). One list of supported languages, client-safe, in the data package; everything else reads it.
- The choice is per user: a `language` field in the existing per-user preferences (jsonb, optional, so no migration). Unset means "follow the browser".
- Resolution order, one pure function: the user's saved preference, then the language cookie, then the browser's languages (`Accept-Language` on the server, `navigator.languages` on the device), then English. Regional variants map to their base (`es-MX` to `es`).
- A language cookie (not HttpOnly, a year, not health data) mirrors the choice so server rendering picks the language before any JavaScript runs and signed-out pages remember it. Saving the preference sets it; signing in with a saved preference sets it. The device also keeps the last choice locally for offline and for the native build, which has no server render.
- `<html lang>` follows the resolved language on the server and on the device. No right-to-left support in this PRD.
- Pickers: Settings (the account's settings, beside units) and the sign-in and sign-up pages. Changing it applies at once, with no reload or sign-out.

**Library and catalogs**

- New dependencies, approved: `i18next` and `react-i18next` (runtime), `eslint-plugin-i18next` (dev). Each pinned exactly at the newest release that is at least a day old (`minimumReleaseAge`). If the lint plugin doesn't support ESLint 10's flat config, the guard is a small local rule instead and the plugin is not added.
- Catalogs are TypeScript modules, one namespace per area (the Area index's areas, plus `common`, `errors`, `emails`, `marketing`). English is the source; its type is what keys are checked against (i18next's typed resources through module augmentation, no codegen). Each Spanish namespace is declared against the English one's shape, so a missing or extra key fails `typecheck`.
- Message format is i18next's own (v4 JSON plurals: `_one`, `_other`, `_many` as the language needs; `{{name}}` interpolation). Sentences with links or emphasis inside use the `Trans` component. No sentence is built by concatenating translated fragments; each whole sentence is one key.
- Catalogs live where both the web app and the server packages can import them (emails and calendar text are rendered on the server).
- Loading: English is in the bundle. Other languages load on demand, one chunk per language and area group, and are cached by the service worker so the chosen language works offline after first use. The server has every language in memory. Server rendering sends only the namespaces the page used.
- One i18next instance per request on the server (never a shared mutable one); one on the device. Missing keys fall back to English; in development and tests a missing key is an error.
- The bundle budget is raised only by what the two runtime libraries cost, and the Spanish chunks stay out of the entry, root and app groups.

**Formatting**

- All date, time, number, list and relative-time formatting goes through the central format helpers, which take the active language. Ad hoc `Intl` and `toLocale*` calls and hardcoded English locales in screens are replaced. Machine formats (ISO days, `en-CA` used to build `YYYY-MM-DD`, iCal fields) stay and are named as such.
- Time zones are untouched: the language changes wording and conventions, never the zone logic.
- Units stay the user's own setting; language doesn't change them.
- Pluralization uses catalog plural forms; the hand-rolled `n === 1 ? … : …` strings and local `plural()` helpers go.

**Server text**

- Service errors keep their codes and English messages. The client translates by code through the `errors` namespace and falls back to the server's English message when a code has no entry, so the API contract doesn't change. Only codes a user can actually see need a Spanish entry; the rest fall back.
- Validation (Zod) messages shown to users become keys resolved where they're displayed; schemas stay client-safe and language-free.
- Display label maps (roles and their descriptions, medication type, form, status and stop reason, vitals, entry kinds, search result kinds, conditions, repeat choices) return keys or take a translate function; the duplicated role label maps collapse into one.
- Emails: the notification registry's `email` function gets the recipient's language in its context; subjects and bodies come from the `emails` namespace; the layout's `lang` follows it. The recipient's language is their saved preference, else English. Auth emails use the same path; for a signed-out request (a sign-in link) the language is the request's resolved language.
- Invites: the invite form has a language choice defaulting to the inviter's language. It is stored on the invite (adds a migration: one nullable column), used for the invite email, and becomes the new account's starting preference when the invite is accepted by a new user. An existing user's preference is never overwritten.
- Calendar text (the feed, Google Calendar events, reminder wording) is written in the member's language. A language change queues a push for that member's Google connections, like a consent change does. Golden `.ics` files gain a Spanish variant.
- Web push text, when it exists, follows the same recipient rule; nothing to build now.

**Marketing**

- English stays at its current addresses; Spanish is the same pages under `/es/`. Each page's content module has an English and a Spanish version of the same typed shape.
- Every public page carries `hreflang` alternates (`en`, `es`, `x-default`), a canonical for its own language, and the matching `og:locale`; the sitemap lists both.
- A language switcher in the public header or footer links to the same page in the other language and sets the cookie. A signed-out visitor to `/` is not redirected by browser language (search engines and shared links stay predictable); the switcher is the way across.
- The privacy policy, terms and health-data privacy pages are translated, each with a notice at the top that the English version governs, linking to it.
- The contact form's labels and validation are translated.

**Quick entry and search**

- Quick entry's parser, vocabulary and time grammar stay English. When the user's language isn't English, the box saves typed text as a plain note and shows no suggestions, cards, forced-prefix hints or "due now" parsing affordances that depend on the parser. One switch, read from the language, decides it. English users see no change.
- Search screens are translated. Matching (the device's FTS stemmer, the server's `english` configuration, the highlighter's stemmer) is unchanged.

**Not translated**

- The staff area (`/admin`) stays hardcoded English and is exempt from the lint rule.
- The connector (MCP instructions, tool descriptions and results, the consent text) stays English.
- Seeds, dev-only routes, logs, audit records and commit-facing text stay English.
- User-written content is never translated.

**The guard**

- The lint rule refuses literal user-facing text in JSX and in the attributes that reach users (`aria-label`, `placeholder`, `title`, `alt`), in the app and marketing routes and the shared components. Exempt: the staff area, tests, seeds, dev routes.
- A pseudo-language (accented, lengthened English generated from the English catalog at test time, not shipped) is available to tests to spot unextracted text and tight layouts.

**Translation process**

- Loops write the Spanish catalogs with the area's English catalog and a short glossary (the product's terms: care group, care recipient, helper, todo, dose, pass, care period; "tú"; neutral Latin American) so terms stay the same across areas. The glossary is written once, in the first slice, and lives beside the catalogs.
- Every Spanish namespace carries a review marker (not reviewed, reviewed by whom and when). Medical wording (medication forms, stop reasons, vitals, symptoms) and the legal pages are listed separately as needing a qualified reviewer. Review itself is the user's, before launch.

**Rollout**

- The sweep touches every user-facing file, so this PRD runs alone, or beside tooling-only work, after the feature PRDs in flight have landed. It is cut by area so slices in a wave don't share files; the shared machinery, format helpers and the `common` namespace land first.
- English behaviour must be unchanged at every step: each slice keeps the existing English tests passing without editing their expected text.

## Testing Decisions

A good test here checks what a user or caller sees (the resolved language, the rendered words, the email's subject), not how catalogs are wired.

- **Unit (new):** language resolution (preference, cookie, browser list, regional variants, unsupported languages); catalog parity beyond the type check (the same interpolation placeholders and plural forms the language requires in every Spanish entry); the format helpers per language (dates, times, relative times, lists, numbers, with the pinned test zone); the error-code lookup and its fallback; the pseudo-language generator. Prior art: the existing unit tests for the format helpers and `dayLabel`.
- **Integration (new):** a Spanish recipient gets a Spanish subject and body for each notification; an invite carries its chosen language into the email and the new account's preference, and doesn't overwrite an existing user's; calendar text and a golden `.ics` in Spanish; a language change queues a Google push. Prior art: `reminders.int.test.ts`, the invite service tests, the golden `.ics` tests.
- **Existing tests are the regression net:** tests stay pinned to English (`en-US`, Los Angeles), and the roughly 86 text-matching test files and 17 browser checks must pass without changes to their expected text. A slice that has to change expected English text has changed behaviour and says why.
- **Not adding:** Spanish component tests per screen, or a new browser check. The quick entry switch (plain box for non-English) and the language picker get component tests as ordinary new UI, per the components doc.

## Out of Scope

- Quick entry understanding Spanish (vocabulary, time grammar) and language-aware search matching: filed as follow-up backlog items.
- The connector's text, and assistants answering in the user's language.
- The staff area.
- Right-to-left languages, and any language beyond Spanish.
- Regional Spanish variants (`es-ES`, `es-US` as separate catalogs).
- Translating user-written content, or seeds and demo data.
- Professional translation and the human review itself.
- A per-group language, or a group default language for new members beyond the invite's choice.
- Redirecting public visitors by browser language.

## Further Notes

- Dependency versions are pinned at slice time: `i18next`'s newest release was published on the day of this PRD, so the pin is whatever is at least a day old then.
- Compliance: the language cookie holds a language code only. No translation service sees user data; AI drafting works on catalog text, which contains no user content.
- The consent texts shown in the app (calendar details, connectors) have versions. Translating a consent text doesn't bump its version; the Spanish text is a rendering of the same version, and the legal-review list includes them.
- Open at planning time: whether the lint plugin supports ESLint 10 (decided in the first slice), and the exact chunking of Spanish namespaces (decided against the bundle budget's numbers once a build exists).
