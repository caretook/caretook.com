# Inbox

Add anything here: one line per item, under the heading that fits. Indent extra lines under it for details. Save; that's all. Or say it to the inbox session (`pnpm prd inbox`), which pushes the line for you.

Agents file each new line into the tracker ([backlog.md](backlog.md)) and add its id, like `(B-12)`. To change something already filed, add a new line saying so.

## Bugs/Nits

## Change requests

- App first load is way too long. (B-764)
  We need to either speed it up or make the loading message more friendly with a progress bar.
- Time limit gate for component tests to keep them from growing too long (B-837)
  5 minute goal, 6 minute hard cutoff.
- Features page "Type it the way you'd say it" section should highlight more that users can just say it with their phone's built-in dictation (B-887)
  Move this section so it's the first item after the timeline on the features page.
- Features page should highlight easy mode (B-888)
- Quick entry should use the similar symptom by default on Enter, with an option to add new instead, rather than waiting for a button click to confirm (B-898)

## Feature requests

- Ability to download all data from the app to a file for backup or transfer to another device. (B-52)
- Ability to delete ALL data from the app. (B-53)
- privacy policy and terms of service. (B-54)
- ability to upload photos of patient drivers license, insurance card, DNR, etc. (B-56)
- react-i18next or some other internationalization library to support multiple languages for all text in the app. (B-209)
- Connector: tags and tagging (list tags, filter by a tag, add and remove tags on records) for groups that have turned on sharing medical information with connectors (B-861)
  The user's word 2026-11-25: connectors DO need tags when the group shares medical information; the tags PRD (B-548) keeps them out, so this follows it.
- Tags tab on the planner: a unified view listing all tags and the items tagged with each (B-972)
  Has the common search/filter bar. Where possible, uses the shared component to display items in the list. Has condensed and full views, defaulting to condensed.

## Big plans

- Onboarding plan for invited users, based on their user type (we already have one for care group creators) (B-901)

## Questions

- Encrypt the device's local copy? SQLite and the cached user in `localStorage` are unencrypted, for up to 3 days offline. (B-145)
  Decide for Capacitor (SQLCipher, secure storage) against the "encryption at rest" commitment.
- Research: compare Care Book to Caring Village (B-829)
  Review feature sets and identify overlap, places where we can surpass them, and places where we already do.

## Chores
