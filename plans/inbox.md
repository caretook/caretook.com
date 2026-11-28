# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all. Or say it to the inbox session (`pnpm prd inbox`), which pushes the line for you.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs/Nits

- Inbox handoff (risa rotate --self) didn't work (B-1045)
  risa rotate --self reported 'Opened inbox in a new background iTerm2 tab' but the handoff did not take effect, per the user.
- Timeline sometimes renders blank: only the Today header and vitals summary show, the rest of the screen is empty until the user scrolls, then everything appears (alpha tester, mobile) (B-1046)

## Change requests

- Features page "Type it the way you'd say it" section should highlight more that users can just say it with their phone's built-in dictation (B-887)
  Move this section so it's the first item after the timeline on the features page.
- Features page should highlight easy mode (B-888)
- Rate-limit audit: list every public, signed-in, sync, connector and email-sending call with its limit, and give each one a reasonable per-user and per-IP limit (B-1011)
  Builds on B-334 (no signed-in oRPC procedure is rate limited) and B-337 (/mcp limits, shared unknown IP bucket) in account-security. Output: a table in docs/domain/api.md and tests that each call is limited.
- Finishing a todo's last subtask silently completes the parent and it vanishes from the list; instead the action message asks 'Mark <parent> done too?' with Undo there (alpha tester) (B-1050)
- Todo tick Undo shows in the page (an inline 'Done: … Undo' line under the list) instead of the shared toast overlay; move it to the shared toast like other done actions (B-1052)

## Feature requests

- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- react-i18next or some other internationalization library to support multiple languages for all text in the app. (B-209)
- Tags tab on the planner: a unified view listing all tags and the items tagged with each (B-972)
  Has the common search/filter bar. Where possible, uses the shared component to display items in the list. Has condensed and full views, defaulting to condensed.
- Free plan: limit account creation per address, so one person can't make many free accounts to get past the per-user limits (sign-ups per email domain/alias, IP and device per window) (B-1013)
  The user's 'household' limit means accounts per address. Normalize email aliases (plus-addressing, dots for Gmail). Overlaps B-333 (link sign-up unlimited unverified accounts) in account-security.
- Per-user storage quota for document uploads: total bytes per user (and per group) on free, checked before upload, with usage shown in settings (B-1014)
  For B-56 (document uploads, not built yet). Also a per-file size cap. Deletions free their bytes.
- Pull down to refresh in the installed PWA (no browser reload control there; a tester had to close and reopen the app to recover a stuck screen, B-1046) (B-1047)
- Symptom catalog list: make each symptom's entry count a link to the timeline already filtered to that symptom, so you can find the last time it happened without scrolling; show the link only when it has entries (alpha tester) (B-1048)

## Big plans

- Onboarding plan for invited users, based on their user type (we already have one for care group creators) (B-901)

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.
- Research: compare Care Book to Caring Village (B-829)
  Review feature sets and identify overlap, places where we can surpass them, and places where we already do.

## Chores

- Recheck the realpath wrapper in pnpm test:tooling once Risa ships RISA-1093
  package.json's test:tooling calls Risa's runner through $(realpath …), a workaround for RISA-1048 (through the node_modules symlink the runner ran nothing and exited 0). v0.2.3 (pinned 2026-11-28) fixes the runner: the plain path ran all 35 files. Kept on the user's word until RISA-1093 (about 20 other Risa entry points with the same symlink no-op) is in a pinned release; then drop the wrapper and trim step 4 of docs/agents/project-config.md (Updating Risa).
