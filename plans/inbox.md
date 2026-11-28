# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all. Or say it to the inbox session (`pnpm prd inbox`), which pushes the line for you.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs/Nits

## Change requests

- Time limit gate for component tests to keep them from growing too long (B-837)
  5 minute goal, 6 minute hard cutoff.
- Features page "Type it the way you'd say it" section should highlight more that users can just say it with their phone's built-in dictation (B-887)
  Move this section so it's the first item after the timeline on the features page.
- Features page should highlight easy mode (B-888)
- Rate-limit audit: list every public, signed-in, sync, connector and email-sending call with its limit, and give each one a reasonable per-user and per-IP limit (B-1011)
  Builds on B-334 (no signed-in oRPC procedure is rate limited) and B-337 (/mcp limits, shared unknown IP bucket) in account-security. Output: a table in docs/domain/api.md and tests that each call is limited.
- Timeline entries: merge TimelineEntryRow and TimelineEntryCard into one shared entry display with a Full and a Condensed look (B-1015)
  The user's words (2026-11-28): 'I'd like for them to merge and just have a full/condensed view. Full SHOULD have more spacing between items whereas condensed has less. I like the way time is laid out on current full screen more (it leaves more column width for content). Both should use user avatar for user information the same way as the current condensed view.' Today routes/app/groups/timeline/TimelineEntryList.tsx:194 picks TimelineEntryCard (Full, still in routes/app/groups/timeline/) or components/entry/TimelineEntryRow (Condensed); both take EntryViewProps. Model it on ProviderCard's look: "full" | "condensed" (shared-displays, B-961). One component in components/entry with a look prop: both looks use the current Full view's time layout (more column width for content) and the current Condensed view's author avatar; Full spaces items further apart, Condensed closer. Other callers of TimelineEntryRow (search, provider links, todo links) keep working.
- Todos page: show the Done section as todo trees (the open list's TodoTree) instead of a flat list of rows
  The user's words (2026-11-28): 'We should use the tree view for complete todos instead of a weird flat view. It breaks the "unified ux" rule and is confusing.' Today routes/app/groups/todos/DoneTodos.tsx lists each done todo as a flat TodoRow (newest first, paged with More), so a done parent and its done subtasks show as unrelated rows, while the open list uses TodoTree. Use the same tree display for Done (one shared display, the user's rule). To settle in the slice: page by tree (a whole done tree per item, newest completion first), and where a done subtask whose parent is still open appears (in the open tree, as today's tree does).

## Feature requests

- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- react-i18next or some other internationalization library to support multiple languages for all text in the app. (B-209)
- Tags tab on the planner: a unified view listing all tags and the items tagged with each (B-972)
  Has the common search/filter bar. Where possible, uses the shared component to display items in the list. Has condensed and full views, defaulting to condensed.
- Free plan: cap how many care groups one user can create (owner of), with a clear message at the cap; staff can lift it per user (B-1012)
  Part of 'reasonable limits on free'. Count groups the user created or owns, not ones they were invited to. Pick a default (e.g. 3) in the plan.
- Free plan: limit account creation per address, so one person can't make many free accounts to get past the per-user limits (sign-ups per email domain/alias, IP and device per window) (B-1013)
  The user's 'household' limit means accounts per address. Normalize email aliases (plus-addressing, dots for Gmail). Overlaps B-333 (link sign-up unlimited unverified accounts) in account-security.
- Per-user storage quota for document uploads: total bytes per user (and per group) on free, checked before upload, with usage shown in settings (B-1014)
  For B-56 (document uploads, not built yet). Also a per-file size cap. Deletions free their bytes.

## Big plans

- Onboarding plan for invited users, based on their user type (we already have one for care group creators) (B-901)

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.
- Research: compare Care Book to Caring Village (B-829)
  Review feature sets and identify overlap, places where we can surpass them, and places where we already do.

## Chores
